# PLYSHIP - Product Requirements Document

## App Overview
PLYSHIP is a mobile application connecting home interior seekers with interior design companies through a matching system, appointment scheduling, and incentivized meeting confirmations.

## Core Features

### 1. Authentication
- Emergent Google Social Login
- Single account with dual role toggle
- Seamless role switching between Seeker and Company

### 2. User Profiles

#### Seeker Profile
- Project title/description
- Location (city/area)
- Budget range
- Interior style preferences (modern, traditional, minimalist, industrial, contemporary)
- Project type (residential/commercial)
- Timeline preferences
- Project photos (base64)

#### Company Profile
- Company name
- Service areas (multiple locations)
- Specializations (residential, commercial, renovation, new construction)
- Budget range expertise
- Portfolio images (base64, max 10)
- Years of experience
- Company description
- Contact details

### 3. Matching System
- Algorithm matches based on:
  * Location overlap
  * Budget compatibility
  * Style preferences alignment
  * Specialization match
- Display match percentage
- Browse and like potential matches
- View matched profiles

### 4. Appointment System
- Either party can request appointment
- Mutual approval required
- Date, time, and location selection
- Status tracking: pending, approved, scheduled, completed, cancelled
- Notification system

### 5. Meeting Confirmation & Payment Flow
- After meeting occurs, both parties confirm
- Scenarios:
  * Both confirm → ₹500 transfers from Company to Seeker wallet
  * One confirms, other doesn't → Admin notification + escalation
  * Both decline → No transaction
- Transaction logging

### 6. Wallet System
- Internal wallet balance
- Razorpay integration for:
  * Companies: Add money to wallet
  * Seekers: Withdraw money (with conditions)
- Withdrawal conditions for Seekers:
  * Must confirm advance payment given to a company
  * Must provide proof/details
- Transaction history
- Real-time balance updates

### 7. Rating & Review System
- Available only after meeting confirmation
- Star rating (1-5)
- Review text
- Visible on profiles
- Cannot rate without confirmed meeting

### 8. Admin Web Panel
- Accessible via web interface
- Features:
  * View all users (Seekers and Companies)
  * Ban/remove users
  * View disputed confirmations
  * Transaction monitoring
  * User analytics
  * Manual intervention tools

## Technical Architecture

### Mobile App Stack
- **Framework**: Expo (React Native)
- **Navigation**: React Navigation with bottom tabs
- **State Management**: React Context API
- **UI Components**: React Native core components
- **Image Handling**: Base64 encoding
- **HTTP Client**: Fetch API

### Backend Stack
- **Framework**: FastAPI
- **Database**: MongoDB with Motor (async driver)
- **Authentication**: Emergent Auth API
- **Payments**: Razorpay SDK
- **API Structure**: RESTful with /api prefix

### Database Schema

#### Collections:

1. **users**
```json
{
  "user_id": "string",
  "email": "string",
  "name": "string",
  "picture": "string",
  "active_role": "seeker|company",
  "created_at": "datetime"
}
```

2. **seeker_profiles**
```json
{
  "user_id": "string",
  "project_title": "string",
  "location": "string",
  "budget_min": "number",
  "budget_max": "number",
  "styles": ["array"],
  "project_type": "string",
  "timeline": "string",
  "photos": ["base64 array"],
  "created_at": "datetime"
}
```

3. **company_profiles**
```json
{
  "user_id": "string",
  "company_name": "string",
  "service_areas": ["array"],
  "specializations": ["array"],
  "budget_min": "number",
  "budget_max": "number",
  "portfolio": ["base64 array"],
  "experience_years": "number",
  "description": "string",
  "contact": "string",
  "created_at": "datetime"
}
```

4. **matches**
```json
{
  "match_id": "string",
  "seeker_id": "string",
  "company_id": "string",
  "match_score": "number",
  "seeker_liked": "boolean",
  "company_liked": "boolean",
  "matched": "boolean",
  "created_at": "datetime"
}
```

5. **appointments**
```json
{
  "appointment_id": "string",
  "match_id": "string",
  "seeker_id": "string",
  "company_id": "string",
  "requested_by": "string",
  "date": "datetime",
  "location": "string",
  "status": "pending|approved|completed|cancelled",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

6. **meeting_confirmations**
```json
{
  "appointment_id": "string",
  "seeker_confirmed": "boolean",
  "company_confirmed": "boolean",
  "seeker_confirmed_at": "datetime",
  "company_confirmed_at": "datetime",
  "transaction_completed": "boolean",
  "admin_notified": "boolean",
  "resolved": "boolean"
}
```

7. **wallets**
```json
{
  "user_id": "string",
  "balance": "number",
  "currency": "INR",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

8. **transactions**
```json
{
  "transaction_id": "string",
  "from_user_id": "string",
  "to_user_id": "string",
  "amount": "number",
  "type": "meeting_reward|topup|withdrawal",
  "status": "pending|completed|failed",
  "razorpay_order_id": "string",
  "razorpay_payment_id": "string",
  "appointment_id": "string",
  "created_at": "datetime"
}
```

9. **ratings**
```json
{
  "rating_id": "string",
  "appointment_id": "string",
  "from_user_id": "string",
  "to_user_id": "string",
  "stars": "number",
  "review": "string",
  "created_at": "datetime"
}
```

10. **admin_users**
```json
{
  "admin_id": "string",
  "email": "string",
  "password_hash": "string",
  "created_at": "datetime"
}
```

## API Endpoints

### Authentication
- POST /api/auth/callback - Handle OAuth callback
- GET /api/auth/me - Get current user
- POST /api/auth/logout - Logout user

### User Management
- GET /api/users/profile - Get user profile
- PUT /api/users/role - Toggle active role
- GET /api/users/wallet - Get wallet balance

### Seeker Profile
- POST /api/seeker/profile - Create/Update seeker profile
- GET /api/seeker/profile - Get seeker profile

### Company Profile
- POST /api/company/profile - Create/Update company profile
- GET /api/company/profile - Get company profile
- GET /api/company/{id} - Get public company profile

### Matching
- GET /api/matches/potential - Get potential matches
- POST /api/matches/like - Like a profile
- GET /api/matches/my-matches - Get matched profiles

### Appointments
- POST /api/appointments - Create appointment request
- PUT /api/appointments/{id}/approve - Approve appointment
- GET /api/appointments - Get user appointments
- PUT /api/appointments/{id}/confirm-meeting - Confirm meeting happened

### Wallet & Payments
- POST /api/wallet/topup - Create Razorpay order for topup
- POST /api/wallet/verify-payment - Verify Razorpay payment
- POST /api/wallet/withdraw - Request withdrawal
- GET /api/wallet/transactions - Get transaction history

### Ratings
- POST /api/ratings - Submit rating
- GET /api/ratings/{user_id} - Get user ratings

### Admin (Web Only)
- POST /api/admin/login - Admin login
- GET /api/admin/users - Get all users
- PUT /api/admin/users/{id}/ban - Ban user
- DELETE /api/admin/users/{id} - Remove user
- GET /api/admin/disputes - Get confirmation disputes
- PUT /api/admin/disputes/{id}/resolve - Resolve dispute

## Mobile App Structure

```
/app
  ├── (auth)
  │   ├── login.tsx
  │   └── callback.tsx
  ├── (tabs)
  │   ├── _layout.tsx
  │   ├── index.tsx (Home/Matches)
  │   ├── appointments.tsx
  │   ├── wallet.tsx
  │   └── profile.tsx
  ├── profile
  │   ├── seeker-setup.tsx
  │   └── company-setup.tsx
  ├── match
  │   └── [id].tsx
  └── appointment
      └── [id].tsx
```

## Key User Flows

### 1. New User Onboarding
1. Open app → See login screen
2. Tap "Login with Google" → OAuth flow
3. Return to app → Choose role (Seeker/Company)
4. Fill profile based on role
5. Land on home screen (matches)

### 2. Matching Flow
1. Browse potential matches (swipe-like interface)
2. Tap like/pass
3. If mutual like → Appears in "Matches" tab
4. Can view full profile and request appointment

### 3. Appointment Flow
1. From matched profile → Request appointment
2. Other party gets notification
3. Approve/Decline
4. If approved → Schedule meeting
5. After meeting → Both confirm
6. Payment automatically processes

### 4. Wallet Operations
**For Companies:**
1. Go to Wallet tab
2. Tap "Add Money"
3. Enter amount → Razorpay checkout
4. Money added to wallet

**For Seekers:**
1. Accumulate money from meetings
2. Request withdrawal
3. Submit advance payment proof
4. Admin reviews (auto or manual)
5. Money transferred

## Development Phases

### Phase 1: Core Setup ✓
- Project structure
- Auth integration
- Basic navigation
- User profile creation

### Phase 2: Profile System
- Seeker profile form
- Company profile form
- Role toggle functionality
- Image handling

### Phase 3: Matching Engine
- Matching algorithm
- Browse interface
- Like/Pass actions
- Matched list

### Phase 4: Appointments
- Request system
- Approval flow
- Meeting confirmation
- Status tracking

### Phase 5: Wallet & Payments
- Razorpay integration
- Wallet balance
- Transaction processing
- Withdrawal system

### Phase 6: Ratings
- Rating submission
- Display on profiles
- Review text

### Phase 7: Admin Panel
- Web interface
- User management
- Dispute resolution
- Analytics

### Phase 8: Polish & Testing
- UI refinements
- Error handling
- Loading states
- Edge cases

## Business Rules

1. User must complete profile before seeing matches
2. Cannot request appointment with non-matched user
3. Appointment must be approved by both parties
4. Meeting confirmation window: 24 hours after scheduled meeting
5. ₹500 transaction only on mutual confirmation
6. Rating available immediately after confirmation
7. Withdrawal requires advance payment proof
8. Admin can intervene in any stage
9. Users can switch roles anytime but must maintain separate profiles
10. Wallet balance cannot go negative

## Success Metrics

- User registrations
- Profile completion rate
- Match rate
- Appointment conversion rate
- Meeting confirmation rate
- Transaction volume
- Average rating
- User retention

## Future Enhancements

- In-app messaging
- Push notifications
- Company verification badges
- Advanced search filters
- Video portfolio
- Contract templates
- Payment milestones
- Referral system
