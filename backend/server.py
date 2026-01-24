from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Cookie
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import os
import logging
import httpx
import razorpay
import uuid
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Razorpay client
razorpay_client = razorpay.Client(auth=(
    os.environ.get('RAZORPAY_KEY_ID', 'test_key'),
    os.environ.get('RAZORPAY_KEY_SECRET', 'test_secret')
))

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============= Models =============

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    active_role: str = "seeker"  # "seeker" or "company"
    created_at: datetime

class SessionDataResponse(BaseModel):
    id: str
    email: str
    name: str
    picture: Optional[str] = None
    session_token: str

class SeekerProfile(BaseModel):
    user_id: str
    project_title: str
    location: str
    budget_min: int
    budget_max: int
    styles: List[str]
    project_type: str
    timeline: str
    photos: List[str] = []
    created_at: datetime
    updated_at: datetime

class CompanyProfile(BaseModel):
    user_id: str
    company_name: str
    service_areas: List[str]
    specializations: List[str]
    budget_min: int
    budget_max: int
    portfolio: List[str] = []
    experience_years: int
    description: str
    contact: str
    created_at: datetime
    updated_at: datetime

class Match(BaseModel):
    match_id: str
    seeker_id: str
    company_id: str
    match_score: float
    seeker_liked: bool = False
    company_liked: bool = False
    matched: bool = False
    created_at: datetime

class Appointment(BaseModel):
    appointment_id: str
    match_id: str
    seeker_id: str
    company_id: str
    requested_by: str
    date: datetime
    location: str
    status: str = "pending"  # pending, approved, completed, cancelled
    created_at: datetime
    updated_at: datetime

class MeetingConfirmation(BaseModel):
    appointment_id: str
    seeker_confirmed: bool = False
    company_confirmed: bool = False
    seeker_confirmed_at: Optional[datetime] = None
    company_confirmed_at: Optional[datetime] = None
    transaction_completed: bool = False
    admin_notified: bool = False
    resolved: bool = False

class Wallet(BaseModel):
    user_id: str
    balance: float = 0.0
    currency: str = "INR"
    created_at: datetime
    updated_at: datetime

class Transaction(BaseModel):
    transaction_id: str
    from_user_id: Optional[str] = None
    to_user_id: str
    amount: float
    type: str  # meeting_reward, topup, withdrawal
    status: str = "pending"
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    appointment_id: Optional[str] = None
    created_at: datetime

class Rating(BaseModel):
    rating_id: str
    appointment_id: str
    from_user_id: str
    to_user_id: str
    stars: int
    review: str
    created_at: datetime

# ============= Request Models =============

class RoleToggleRequest(BaseModel):
    role: str

class SeekerProfileRequest(BaseModel):
    project_title: str
    location: str
    budget_min: int
    budget_max: int
    styles: List[str]
    project_type: str
    timeline: str
    photos: List[str] = []

class CompanyProfileRequest(BaseModel):
    company_name: str
    service_areas: List[str]
    specializations: List[str]
    budget_min: int
    budget_max: int
    portfolio: List[str] = []
    experience_years: int
    description: str
    contact: str

class LikeRequest(BaseModel):
    target_user_id: str

class AppointmentRequest(BaseModel):
    target_user_id: str
    date: str
    location: str

class ConfirmMeetingRequest(BaseModel):
    appointment_id: str

class TopupRequest(BaseModel):
    amount: int  # in paise

class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

class WithdrawRequest(BaseModel):
    amount: float
    proof_text: str

class RatingRequest(BaseModel):
    appointment_id: str
    to_user_id: str
    stars: int
    review: str

# ============= Auth Helpers =============

async def get_current_user(
    authorization: Optional[str] = None,
    session_token: Optional[str] = Cookie(None)
) -> Optional[User]:
    """Get current authenticated user from session token"""
    token = session_token
    
    # Fallback to Authorization header
    if not token and authorization:
        if authorization.startswith('Bearer '):
            token = authorization.replace('Bearer ', '')
    
    if not token:
        return None
    
    # Find session
    session = await db.user_sessions.find_one(
        {"session_token": token},
        {"_id": 0}
    )
    
    if not session:
        return None
    
    # Check expiry
    expires_at = session.get("expires_at")
    if expires_at:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            return None
    
    # Get user
    user_doc = await db.users.find_one(
        {"user_id": session["user_id"]},
        {"_id": 0}
    )
    
    if user_doc:
        return User(**user_doc)
    return None

async def require_user(
    authorization: Optional[str] = None,
    session_token: Optional[str] = Cookie(None)
) -> User:
    """Require authenticated user, raise 401 if not"""
    user = await get_current_user(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return user

# ============= Auth Routes =============

@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    """Exchange session_id for user data and create session"""
    session_id = request.headers.get("X-Session-ID")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing X-Session-ID header")
    
    # Call Emergent Auth API
    async with httpx.AsyncClient() as http_client:
        try:
            auth_response = await http_client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id},
                timeout=10.0
            )
            auth_response.raise_for_status()
            user_data = auth_response.json()
            logger.info(f"Auth successful for email: {user_data.get('email')}")
        except httpx.HTTPStatusError as e:
            logger.error(f"Auth API HTTP error: {e.response.status_code} - {e.response.text}")
            raise HTTPException(status_code=401, detail=f"Auth failed: {e.response.status_code}")
        except Exception as e:
            logger.error(f"Auth API error: {e}")
            raise HTTPException(status_code=401, detail="Invalid session")
    
    # Generate user_id
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    
    # Check if user exists
    existing_user = await db.users.find_one(
        {"email": user_data["email"]},
        {"_id": 0}
    )
    
    if existing_user:
        user_id = existing_user["user_id"]
    else:
        # Create new user
        new_user = {
            "user_id": user_id,
            "email": user_data["email"],
            "name": user_data["name"],
            "picture": user_data.get("picture"),
            "active_role": "seeker",
            "created_at": datetime.now(timezone.utc)
        }
        await db.users.insert_one(new_user)
        
        # Create wallet
        wallet = {
            "user_id": user_id,
            "balance": 0.0,
            "currency": "INR",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        await db.wallets.insert_one(wallet)
    
    # Create session
    session_token = user_data["session_token"]
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    })
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7 * 24 * 60 * 60,
        path="/"
    )
    
    return {
        "user_id": user_id,
        "email": user_data["email"],
        "name": user_data["name"],
        "picture": user_data.get("picture"),
        "session_token": session_token
    }

@api_router.get("/auth/me")
async def get_me(
    authorization: Optional[str] = None,
    session_token: Optional[str] = Cookie(None)
):
    """Get current user info"""
    user = await require_user(authorization, session_token)
    return user

@api_router.post("/auth/logout")
async def logout(
    response: Response,
    authorization: Optional[str] = None,
    session_token: Optional[str] = Cookie(None)
):
    """Logout user"""
    user = await get_current_user(authorization, session_token)
    if user:
        token = session_token or (authorization.replace('Bearer ', '') if authorization else None)
        if token:
            await db.user_sessions.delete_one({"session_token": token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out"}

# ============= User Routes =============

@api_router.put("/users/role")
async def toggle_role(
    req: RoleToggleRequest,
    authorization: Optional[str] = None,
    session_token: Optional[str] = Cookie(None)
):
    """Toggle user's active role"""
    user = await require_user(authorization, session_token)
    
    if req.role not in ["seeker", "company"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"active_role": req.role}}
    )
    
    return {"message": "Role updated", "role": req.role}

@api_router.get("/users/wallet")
async def get_wallet(
    authorization: Optional[str] = None,
    session_token: Optional[str] = Cookie(None)
):
    """Get user's wallet"""
    user = await require_user(authorization, session_token)
    
    wallet = await db.wallets.find_one(
        {"user_id": user.user_id},
        {"_id": 0}
    )
    
    return wallet or {"balance": 0.0, "currency": "INR"}

# ============= Profile Routes =============

@api_router.post("/seeker/profile")
async def create_seeker_profile(
    req: SeekerProfileRequest,
    authorization: Optional[str] = None,
    session_token: Optional[str] = Cookie(None)
):
    """Create or update seeker profile"""
    user = await require_user(authorization, session_token)
    
    now = datetime.now(timezone.utc)
    
    # Check if profile exists
    existing = await db.seeker_profiles.find_one({"user_id": user.user_id})
    
    profile_data = {
        "user_id": user.user_id,
        "project_title": req.project_title,
        "location": req.location,
        "budget_min": req.budget_min,
        "budget_max": req.budget_max,
        "styles": req.styles,
        "project_type": req.project_type,
        "timeline": req.timeline,
        "photos": req.photos,
        "updated_at": now
    }
    
    if existing:
        await db.seeker_profiles.update_one(
            {"user_id": user.user_id},
            {"$set": profile_data}
        )
    else:
        profile_data["created_at"] = now
        await db.seeker_profiles.insert_one(profile_data)
    
    return {"message": "Profile saved"}

@api_router.get("/seeker/profile")
async def get_seeker_profile(
    authorization: Optional[str] = None,
    session_token: Optional[str] = Cookie(None)
):
    """Get seeker profile"""
    user = await require_user(authorization, session_token)
    
    profile = await db.seeker_profiles.find_one(
        {"user_id": user.user_id},
        {"_id": 0}
    )
    
    if not profile:
        return None
    
    return profile

@api_router.post("/company/profile")
async def create_company_profile(
    req: CompanyProfileRequest,
    authorization: Optional[str] = None,
    session_token: Optional[str] = Cookie(None)
):
    """Create or update company profile"""
    user = await require_user(authorization, session_token)
    
    now = datetime.now(timezone.utc)
    
    existing = await db.company_profiles.find_one({"user_id": user.user_id})
    
    profile_data = {
        "user_id": user.user_id,
        "company_name": req.company_name,
        "service_areas": req.service_areas,
        "specializations": req.specializations,
        "budget_min": req.budget_min,
        "budget_max": req.budget_max,
        "portfolio": req.portfolio,
        "experience_years": req.experience_years,
        "description": req.description,
        "contact": req.contact,
        "updated_at": now
    }
    
    if existing:
        await db.company_profiles.update_one(
            {"user_id": user.user_id},
            {"$set": profile_data}
        )
    else:
        profile_data["created_at"] = now
        await db.company_profiles.insert_one(profile_data)
    
    return {"message": "Profile saved"}

@api_router.get("/company/profile")
async def get_company_profile(
    authorization: Optional[str] = None,
    session_token: Optional[str] = Cookie(None)
):
    """Get company profile"""
    user = await require_user(authorization, session_token)
    
    profile = await db.company_profiles.find_one(
        {"user_id": user.user_id},
        {"_id": 0}
    )
    
    if not profile:
        return None
    
    return profile

# ============= Matching Routes =============

def calculate_match_score(seeker_profile: dict, company_profile: dict) -> float:
    """Calculate match score between seeker and company"""
    score = 0.0
    
    # Location match (30%)
    if seeker_profile["location"] in company_profile["service_areas"]:
        score += 30
    
    # Budget overlap (30%)
    seeker_min = seeker_profile["budget_min"]
    seeker_max = seeker_profile["budget_max"]
    company_min = company_profile["budget_min"]
    company_max = company_profile["budget_max"]
    
    if seeker_min <= company_max and seeker_max >= company_min:
        score += 30
    
    # Specialization match (20%)
    if seeker_profile["project_type"] in company_profile["specializations"]:
        score += 20
    
    # Style compatibility (20%)
    # Simplified - assume compatibility
    score += 20
    
    return min(score, 100.0)

@api_router.get("/matches/potential")
async def get_potential_matches(
    authorization: Optional[str] = None,
    session_token: Optional[str] = Cookie(None)
):
    """Get potential matches based on user role"""
    user = await require_user(authorization, session_token)
    
    current_user = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    role = current_user["active_role"]
    
    matches = []
    
    if role == "seeker":
        # Get seeker profile
        seeker_profile = await db.seeker_profiles.find_one({"user_id": user.user_id}, {"_id": 0})
        if not seeker_profile:
            return []
        
        # Get all company profiles
        companies = await db.company_profiles.find({}, {"_id": 0}).to_list(100)
        
        # Get already matched (both parties liked)
        existing_matches = await db.matches.find(
            {"seeker_id": user.user_id},
            {"_id": 0}
        ).to_list(1000)
        
        # Only exclude if BOTH have liked (matched = True) OR if seeker already liked
        existing_company_ids = {m["company_id"] for m in existing_matches if m.get("matched") or m.get("seeker_liked")}
        
        for company in companies:
            if company["user_id"] not in existing_company_ids:
                score = calculate_match_score(seeker_profile, company)
                
                # Get company user info
                company_user = await db.users.find_one({"user_id": company["user_id"]}, {"_id": 0})
                
                # Check if company already liked this seeker
                existing_match = next((m for m in existing_matches if m["company_id"] == company["user_id"]), None)
                has_liked_you = existing_match and existing_match.get("company_liked", False)
                
                matches.append({
                    "user_id": company["user_id"],
                    "name": company_user["name"] if company_user else "Unknown",
                    "picture": company_user.get("picture") if company_user else None,
                    "company_name": company["company_name"],
                    "description": company["description"],
                    "portfolio": company["portfolio"][:3],  # First 3 images
                    "experience_years": company["experience_years"],
                    "match_score": score,
                    "has_liked_you": has_liked_you  # New field to highlight
                })
    
    else:  # company
        # Get company profile
        company_profile = await db.company_profiles.find_one({"user_id": user.user_id}, {"_id": 0})
        if not company_profile:
            return []
        
        # Get all seeker profiles
        seekers = await db.seeker_profiles.find({}, {"_id": 0}).to_list(100)
        
        # Get already matched (both parties liked)
        existing_matches = await db.matches.find(
            {"company_id": user.user_id},
            {"_id": 0}
        ).to_list(1000)
        
        # Only exclude if BOTH have liked (matched = True) OR if company already liked
        existing_seeker_ids = {m["seeker_id"] for m in existing_matches if m.get("matched") or m.get("company_liked")}
        
        for seeker in seekers:
            if seeker["user_id"] not in existing_seeker_ids:
                score = calculate_match_score(seeker, company_profile)
                
                # Get seeker user info
                seeker_user = await db.users.find_one({"user_id": seeker["user_id"]}, {"_id": 0})
                
                # Check if seeker already liked this company
                existing_match = next((m for m in existing_matches if m["seeker_id"] == seeker["user_id"]), None)
                has_liked_you = existing_match and existing_match.get("seeker_liked", False)
                
                matches.append({
                    "user_id": seeker["user_id"],
                    "name": seeker_user["name"] if seeker_user else "Unknown",
                    "picture": seeker_user.get("picture") if seeker_user else None,
                    "project_title": seeker["project_title"],
                    "location": seeker["location"],
                    "budget_min": seeker["budget_min"],
                    "budget_max": seeker["budget_max"],
                    "photos": seeker["photos"][:3],
                    "match_score": score,
                    "has_liked_you": has_liked_you  # New field to highlight
                })
                    "location": seeker["location"],
                    "budget_min": seeker["budget_min"],
                    "budget_max": seeker["budget_max"],
                    "photos": seeker["photos"][:3],
                    "match_score": score
                })
    
    # Sort by match score
    matches.sort(key=lambda x: x["match_score"], reverse=True)
    
    return matches

@api_router.post("/matches/like")
async def like_profile(
    req: LikeRequest,
    authorization: Optional[str] = None,
    session_token: Optional[str] = Cookie(None)
):
    """Like a profile"""
    user = await require_user(authorization, session_token)
    
    current_user = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    role = current_user["active_role"]
    
    # Determine seeker and company IDs
    if role == "seeker":
        seeker_id = user.user_id
        company_id = req.target_user_id
    else:
        seeker_id = req.target_user_id
        company_id = user.user_id
    
    # Check if match already exists
    existing = await db.matches.find_one({
        "seeker_id": seeker_id,
        "company_id": company_id
    }, {"_id": 0})
    
    if existing:
        # Update like status
        update_data = {}
        if role == "seeker":
            update_data["seeker_liked"] = True
        else:
            update_data["company_liked"] = True
        
        # Check if both liked
        if role == "seeker" and existing.get("company_liked"):
            update_data["matched"] = True
        elif role == "company" and existing.get("seeker_liked"):
            update_data["matched"] = True
        
        await db.matches.update_one(
            {"seeker_id": seeker_id, "company_id": company_id},
            {"$set": update_data}
        )
        
        return {"message": "Match updated", "matched": update_data.get("matched", False)}
    
    else:
        # Create new match
        match_data = {
            "match_id": f"match_{uuid.uuid4().hex[:12]}",
            "seeker_id": seeker_id,
            "company_id": company_id,
            "match_score": 0.0,
            "seeker_liked": role == "seeker",
            "company_liked": role == "company",
            "matched": False,
            "created_at": datetime.now(timezone.utc)
        }
        
        await db.matches.insert_one(match_data)
        
        return {"message": "Like recorded", "matched": False}

@api_router.get("/matches/my-matches")
async def get_my_matches(
    authorization: Optional[str] = None,
    session_token: Optional[str] = Cookie(None)
):
    """Get user's matches"""
    user = await require_user(authorization, session_token)
    
    current_user = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    role = current_user["active_role"]
    
    # Find matched profiles
    if role == "seeker":
        matches = await db.matches.find({
            "seeker_id": user.user_id,
            "matched": True
        }, {"_id": 0}).to_list(100)
        
        result = []
        for match in matches:
            company_user = await db.users.find_one({"user_id": match["company_id"]}, {"_id": 0})
            company_profile = await db.company_profiles.find_one({"user_id": match["company_id"]}, {"_id": 0})
            
            if company_user and company_profile:
                result.append({
                    "match_id": match["match_id"],
                    "user_id": company_user["user_id"],
                    "name": company_user["name"],
                    "picture": company_user.get("picture"),
                    "company_name": company_profile["company_name"],
                    "description": company_profile["description"],
                    "portfolio": company_profile["portfolio"][:3]
                })
    
    else:  # company
        matches = await db.matches.find({
            "company_id": user.user_id,
            "matched": True
        }, {"_id": 0}).to_list(100)
        
        result = []
        for match in matches:
            seeker_user = await db.users.find_one({"user_id": match["seeker_id"]}, {"_id": 0})
            seeker_profile = await db.seeker_profiles.find_one({"user_id": match["seeker_id"]}, {"_id": 0})
            
            if seeker_user and seeker_profile:
                result.append({
                    "match_id": match["match_id"],
                    "user_id": seeker_user["user_id"],
                    "name": seeker_user["name"],
                    "picture": seeker_user.get("picture"),
                    "project_title": seeker_profile["project_title"],
                    "location": seeker_profile["location"],
                    "budget_min": seeker_profile["budget_min"],
                    "budget_max": seeker_profile["budget_max"]
                })
    
    return result

# ============= Appointment Routes =============

@api_router.post("/appointments")
async def create_appointment(
    req: AppointmentRequest,
    authorization: Optional[str] = None,
    session_token: Optional[str] = Cookie(None)
):
    """Create appointment request"""
    user = await require_user(authorization, session_token)
    
    current_user = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    role = current_user["active_role"]
    
    # Get match
    if role == "seeker":
        match = await db.matches.find_one({
            "seeker_id": user.user_id,
            "company_id": req.target_user_id,
            "matched": True
        }, {"_id": 0})
    else:
        match = await db.matches.find_one({
            "seeker_id": req.target_user_id,
            "company_id": user.user_id,
            "matched": True
        }, {"_id": 0})
    
    if not match:
        raise HTTPException(status_code=400, detail="Not matched with this user")
    
    # Create appointment
    appointment_data = {
        "appointment_id": f"appt_{uuid.uuid4().hex[:12]}",
        "match_id": match["match_id"],
        "seeker_id": match["seeker_id"],
        "company_id": match["company_id"],
        "requested_by": user.user_id,
        "date": datetime.fromisoformat(req.date.replace('Z', '+00:00')),
        "location": req.location,
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.appointments.insert_one(appointment_data)
    
    return {"message": "Appointment requested", "appointment_id": appointment_data["appointment_id"]}

@api_router.put("/appointments/{appointment_id}/approve")
async def approve_appointment(
    appointment_id: str,
    authorization: Optional[str] = None,
    session_token: Optional[str] = Cookie(None)
):
    """Approve appointment"""
    user = await require_user(authorization, session_token)
    
    appointment = await db.appointments.find_one({"appointment_id": appointment_id}, {"_id": 0})
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    # Check if user is part of appointment
    if user.user_id not in [appointment["seeker_id"], appointment["company_id"]]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Update status
    await db.appointments.update_one(
        {"appointment_id": appointment_id},
        {"$set": {"status": "approved", "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Appointment approved"}

@api_router.get("/appointments")
async def get_appointments(
    authorization: Optional[str] = None,
    session_token: Optional[str] = Cookie(None)
):
    """Get user's appointments"""
    user = await require_user(authorization, session_token)
    
    appointments = await db.appointments.find({
        "$or": [
            {"seeker_id": user.user_id},
            {"company_id": user.user_id}
        ]
    }, {"_id": 0}).to_list(100)
    
    result = []
    for appt in appointments:
        # Get other user info
        other_user_id = appt["company_id"] if appt["seeker_id"] == user.user_id else appt["seeker_id"]
        other_user = await db.users.find_one({"user_id": other_user_id}, {"_id": 0})
        
        # Get confirmation status
        confirmation = await db.meeting_confirmations.find_one(
            {"appointment_id": appt["appointment_id"]},
            {"_id": 0}
        )
        
        result.append({
            **appt,
            "other_user": {
                "user_id": other_user["user_id"],
                "name": other_user["name"],
                "picture": other_user.get("picture")
            } if other_user else None,
            "confirmation": confirmation
        })
    
    return result

@api_router.post("/appointments/confirm-meeting")
async def confirm_meeting(
    req: ConfirmMeetingRequest,
    authorization: Optional[str] = None,
    session_token: Optional[str] = Cookie(None)
):
    """Confirm meeting happened"""
    user = await require_user(authorization, session_token)
    
    appointment = await db.appointments.find_one(
        {"appointment_id": req.appointment_id},
        {"_id": 0}
    )
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    # Check if user is part of appointment
    if user.user_id not in [appointment["seeker_id"], appointment["company_id"]]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get or create confirmation
    confirmation = await db.meeting_confirmations.find_one(
        {"appointment_id": req.appointment_id},
        {"_id": 0}
    )
    
    now = datetime.now(timezone.utc)
    
    if not confirmation:
        confirmation = {
            "appointment_id": req.appointment_id,
            "seeker_confirmed": user.user_id == appointment["seeker_id"],
            "company_confirmed": user.user_id == appointment["company_id"],
            "seeker_confirmed_at": now if user.user_id == appointment["seeker_id"] else None,
            "company_confirmed_at": now if user.user_id == appointment["company_id"] else None,
            "transaction_completed": False,
            "admin_notified": False,
            "resolved": False
        }
        await db.meeting_confirmations.insert_one(confirmation)
    else:
        update_data = {}
        if user.user_id == appointment["seeker_id"]:
            update_data["seeker_confirmed"] = True
            update_data["seeker_confirmed_at"] = now
        else:
            update_data["company_confirmed"] = True
            update_data["company_confirmed_at"] = now
        
        await db.meeting_confirmations.update_one(
            {"appointment_id": req.appointment_id},
            {"$set": update_data}
        )
        
        # Reload confirmation
        confirmation = await db.meeting_confirmations.find_one(
            {"appointment_id": req.appointment_id},
            {"_id": 0}
        )
    
    # Check if both confirmed
    if confirmation["seeker_confirmed"] and confirmation["company_confirmed"] and not confirmation["transaction_completed"]:
        # Process ₹500 transaction
        transaction_id = f"txn_{uuid.uuid4().hex[:12]}"
        
        # Deduct from company
        await db.wallets.update_one(
            {"user_id": appointment["company_id"]},
            {"$inc": {"balance": -500}, "$set": {"updated_at": now}}
        )
        
        # Add to seeker
        await db.wallets.update_one(
            {"user_id": appointment["seeker_id"]},
            {"$inc": {"balance": 500}, "$set": {"updated_at": now}}
        )
        
        # Record transaction
        transaction = {
            "transaction_id": transaction_id,
            "from_user_id": appointment["company_id"],
            "to_user_id": appointment["seeker_id"],
            "amount": 500,
            "type": "meeting_reward",
            "status": "completed",
            "appointment_id": req.appointment_id,
            "created_at": now
        }
        await db.transactions.insert_one(transaction)
        
        # Mark transaction completed
        await db.meeting_confirmations.update_one(
            {"appointment_id": req.appointment_id},
            {"$set": {"transaction_completed": True, "resolved": True}}
        )
        
        return {"message": "Meeting confirmed, ₹500 transferred", "both_confirmed": True}
    
    return {"message": "Confirmation recorded", "both_confirmed": False}

# ============= Wallet & Payment Routes =============

@api_router.post("/wallet/topup")
async def create_topup(
    req: TopupRequest,
    authorization: Optional[str] = None,
    session_token: Optional[str] = Cookie(None)
):
    """Create Razorpay order for wallet topup"""
    user = await require_user(authorization, session_token)
    
    try:
        # Create Razorpay order
        order_data = {
            "amount": req.amount,
            "currency": "INR",
            "payment_capture": 1
        }
        order = razorpay_client.order.create(data=order_data)
        
        # Store pending transaction
        transaction = {
            "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
            "to_user_id": user.user_id,
            "amount": req.amount / 100,  # Convert paise to rupees
            "type": "topup",
            "status": "pending",
            "razorpay_order_id": order["id"],
            "created_at": datetime.now(timezone.utc)
        }
        await db.transactions.insert_one(transaction)
        
        return {
            "order_id": order["id"],
            "amount": order["amount"],
            "currency": order["currency"]
        }
    
    except Exception as e:
        logger.error(f"Razorpay order creation failed: {e}")
        raise HTTPException(status_code=500, detail="Payment initialization failed")

@api_router.post("/wallet/verify-payment")
async def verify_payment(
    req: VerifyPaymentRequest,
    authorization: Optional[str] = None,
    session_token: Optional[str] = Cookie(None)
):
    """Verify Razorpay payment and credit wallet"""
    user = await require_user(authorization, session_token)
    
    try:
        # Verify signature
        params_dict = {
            'razorpay_order_id': req.razorpay_order_id,
            'razorpay_payment_id': req.razorpay_payment_id,
            'razorpay_signature': req.razorpay_signature
        }
        razorpay_client.utility.verify_payment_signature(params_dict)
        
        # Find transaction
        transaction = await db.transactions.find_one(
            {"razorpay_order_id": req.razorpay_order_id},
            {"_id": 0}
        )
        
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        # Update transaction
        await db.transactions.update_one(
            {"razorpay_order_id": req.razorpay_order_id},
            {"$set": {
                "status": "completed",
                "razorpay_payment_id": req.razorpay_payment_id
            }}
        )
        
        # Credit wallet
        await db.wallets.update_one(
            {"user_id": user.user_id},
            {"$inc": {"balance": transaction["amount"]}, "$set": {"updated_at": datetime.now(timezone.utc)}}
        )
        
        return {"message": "Payment verified, wallet credited"}
    
    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as e:
        logger.error(f"Payment verification failed: {e}")
        raise HTTPException(status_code=500, detail="Payment verification failed")

@api_router.post("/wallet/withdraw")
async def request_withdrawal(
    req: WithdrawRequest,
    authorization: Optional[str] = None,
    session_token: Optional[str] = Cookie(None)
):
    """Request withdrawal (for seekers with advance payment proof)"""
    user = await require_user(authorization, session_token)
    
    # Check wallet balance
    wallet = await db.wallets.find_one({"user_id": user.user_id}, {"_id": 0})
    
    if not wallet or wallet["balance"] < req.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    # Create withdrawal request
    transaction = {
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "from_user_id": user.user_id,
        "to_user_id": user.user_id,
        "amount": req.amount,
        "type": "withdrawal",
        "status": "pending",
        "created_at": datetime.now(timezone.utc)
    }
    await db.transactions.insert_one(transaction)
    
    return {"message": "Withdrawal request submitted for review"}

@api_router.get("/wallet/transactions")
async def get_transactions(
    authorization: Optional[str] = None,
    session_token: Optional[str] = Cookie(None)
):
    """Get user's transaction history"""
    user = await require_user(authorization, session_token)
    
    transactions = await db.transactions.find({
        "$or": [
            {"from_user_id": user.user_id},
            {"to_user_id": user.user_id}
        ]
    }, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    return transactions

# ============= Rating Routes =============

@api_router.post("/ratings")
async def submit_rating(
    req: RatingRequest,
    authorization: Optional[str] = None,
    session_token: Optional[str] = Cookie(None)
):
    """Submit rating for a user after meeting"""
    user = await require_user(authorization, session_token)
    
    # Verify appointment and confirmation
    appointment = await db.appointments.find_one(
        {"appointment_id": req.appointment_id},
        {"_id": 0}
    )
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    confirmation = await db.meeting_confirmations.find_one(
        {"appointment_id": req.appointment_id},
        {"_id": 0}
    )
    
    if not confirmation or not confirmation.get("transaction_completed"):
        raise HTTPException(status_code=400, detail="Cannot rate before meeting confirmation")
    
    # Check if already rated
    existing = await db.ratings.find_one({
        "appointment_id": req.appointment_id,
        "from_user_id": user.user_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Already rated")
    
    # Create rating
    rating = {
        "rating_id": f"rating_{uuid.uuid4().hex[:12]}",
        "appointment_id": req.appointment_id,
        "from_user_id": user.user_id,
        "to_user_id": req.to_user_id,
        "stars": req.stars,
        "review": req.review,
        "created_at": datetime.now(timezone.utc)
    }
    await db.ratings.insert_one(rating)
    
    return {"message": "Rating submitted"}

@api_router.get("/ratings/{user_id}")
async def get_user_ratings(user_id: str):
    """Get ratings for a user"""
    ratings = await db.ratings.find(
        {"to_user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Get reviewer info
    result = []
    for rating in ratings:
        reviewer = await db.users.find_one(
            {"user_id": rating["from_user_id"]},
            {"_id": 0}
        )
        
        result.append({
            **rating,
            "reviewer": {
                "name": reviewer["name"],
                "picture": reviewer.get("picture")
            } if reviewer else None
        })
    
    # Calculate average
    avg_rating = sum(r["stars"] for r in ratings) / len(ratings) if ratings else 0
    
    return {
        "ratings": result,
        "average": round(avg_rating, 1),
        "count": len(ratings)
    }

# ============= Admin Routes (Simplified for now) =============

@api_router.get("/admin/disputes")
async def get_disputes():
    """Get all confirmation disputes"""
    # Find confirmations where only one party confirmed
    all_confirmations = await db.meeting_confirmations.find(
        {"resolved": False},
        {"_id": 0}
    ).to_list(1000)
    
    disputes = []
    for conf in all_confirmations:
        if conf["seeker_confirmed"] != conf["company_confirmed"]:
            appointment = await db.appointments.find_one(
                {"appointment_id": conf["appointment_id"]},
                {"_id": 0}
            )
            
            if appointment:
                disputes.append({
                    "appointment": appointment,
                    "confirmation": conf
                })
    
    return disputes

# Include router in main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
