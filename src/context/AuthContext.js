'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { db, auth, uploadImage, uploadImages, deleteUserStorage } from '../lib/firebase';
import {
    signOut,
    onAuthStateChanged,
    RecaptchaVerifier,
    signInWithPhoneNumber
} from 'firebase/auth';
import {
    doc,
    setDoc,
    getDoc,
    getDocs,
    collection,
    query,
    where,
    orderBy,
    addDoc,
    onSnapshot,
    serverTimestamp,
    runTransaction,
    updateDoc,
    deleteDoc
} from 'firebase/firestore';

// ── Username utilities ──
function slugifyName(name) {
    return (name || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 20) || 'user';
}

async function generateUniqueUsername(baseName, userId) {
    const base = slugifyName(baseName);
    // Try base username first
    let candidate = base;
    for (let attempt = 0; attempt < 10; attempt++) {
        if (attempt > 0) candidate = `${base}${Math.floor(Math.random() * 9000) + 1000}`;
        const snap = await getDoc(doc(db, 'usernames', candidate));
        if (!snap.exists()) {
            // Reserve it
            await setDoc(doc(db, 'usernames', candidate), { userId, createdAt: new Date().toISOString() });
            return candidate;
        }
        // If this username already belongs to this user, reuse it
        if (snap.data().userId === userId) return candidate;
    }
    // Fallback: userId-based
    const fallback = `user${userId.slice(0, 8).toLowerCase()}`;
    await setDoc(doc(db, 'usernames', fallback), { userId, createdAt: new Date().toISOString() });
    return fallback;
}

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    // Flag to prevent auth listener from overwriting state during onboarding
    const isOnboarding = useRef(false);
    const confirmationResultRef = useRef(null);
    const recaptchaVerifierRef = useRef(null);
    const [isImpersonating, setIsImpersonating] = useState(false);
    const adminUserRef = useRef(null);

    // Listen for auth state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            // Skip if we're in the middle of onboarding or impersonating
            if (isOnboarding.current) {
                // Restore role from localStorage if user state was lost during navigation
                const savedRole = localStorage.getItem('onboardingRole');
                if (savedRole && firebaseUser) {
                    setUser(prev => {
                        if (prev && !prev.role && savedRole) {
                            return { ...prev, role: savedRole };
                        }
                        return prev;
                    });
                }
                setLoading(false);
                return;
            }
            if (isImpersonating) {
                setLoading(false);
                return;
            }

            if (firebaseUser) {
                // User is signed in, fetch their profile from Firestore
                try {
                    // Check in seekers collection first
                    let userDoc = await getDoc(doc(db, 'seekers', firebaseUser.uid));

                    if (userDoc.exists()) {
                        const userData = { id: firebaseUser.uid, ...userDoc.data() };
                        setUser(userData);
                        localStorage.setItem('userEmail', userData.email);
                        // Track activity (fire-and-forget)
                        setDoc(doc(db, 'seekers', firebaseUser.uid), { lastActiveAt: new Date().toISOString() }, { merge: true }).catch(() => { });
                    } else {
                        // Check in companies collection
                        userDoc = await getDoc(doc(db, 'companies', firebaseUser.uid));

                        if (userDoc.exists()) {
                            const userData = { id: firebaseUser.uid, ...userDoc.data() };
                            setUser(userData);
                            localStorage.setItem('userEmail', userData.email);
                            // Track activity (fire-and-forget)
                            setDoc(doc(db, 'companies', firebaseUser.uid), { lastActiveAt: new Date().toISOString() }, { merge: true }).catch(() => { });
                        } else {
                            // New user, just signed up but no profile yet
                            setUser({
                                id: firebaseUser.uid,
                                email: firebaseUser.email || null,
                                phone: firebaseUser.phoneNumber || null,
                                role: null,
                                profileComplete: false,
                                profile: null
                            });
                            localStorage.setItem('userPhone', firebaseUser.phoneNumber || '');
                        }
                    }
                } catch (error) {
                    setUser({
                        id: firebaseUser.uid,
                        email: firebaseUser.email,
                        role: null,
                        profileComplete: false,
                        profile: null
                    });
                }
            } else {
                setUser(null);
                localStorage.removeItem('userEmail');
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Setup invisible reCAPTCHA
    const setupRecaptcha = (buttonId) => {
        // Clear any existing verifier
        if (recaptchaVerifierRef.current) {
            try {
                recaptchaVerifierRef.current.clear();
            } catch (e) {
                // Ignore errors during cleanup
            }
            recaptchaVerifierRef.current = null;
        }

        // Clear the DOM element to remove any leftover reCAPTCHA widget
        const container = document.getElementById(buttonId);
        if (container) {
            container.innerHTML = '';
        }

        // Also reset any global recaptcha widgets
        if (window.recaptchaWidgetId !== undefined) {
            try {
                window.grecaptcha?.reset(window.recaptchaWidgetId);
            } catch (e) { }
        }

        recaptchaVerifierRef.current = new RecaptchaVerifier(auth, buttonId, {
            size: 'invisible',
            callback: () => {
            },
        });
        return recaptchaVerifierRef.current;
    };

    // Send OTP to phone number
    const sendOTP = async (phoneNumber, buttonId = 'recaptcha-container') => {
        try {
            const appVerifier = setupRecaptcha(buttonId);
            const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
            console.log('[OTP] Sending to:', formattedPhone);
            const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
            confirmationResultRef.current = confirmationResult;
            console.log('[OTP] Successfully sent');
            return { success: true };
        } catch (error) {
            console.error('[OTP] Error code:', error.code, '| Message:', error.message);
            // Reset recaptcha on error
            if (recaptchaVerifierRef.current) {
                recaptchaVerifierRef.current.clear();
                recaptchaVerifierRef.current = null;
            }
            // Map Firebase error codes to user-friendly messages
            const errorMap = {
                'auth/captcha-check-failed': 'Security verification failed. Please try again.',
                'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
                'auth/quota-exceeded': 'SMS limit reached. Please try again later.',
                'auth/invalid-phone-number': 'Invalid phone number. Please check and try again.',
                'auth/network-request-failed': 'Network error. Please check your internet connection.',
                'auth/missing-phone-number': 'Please enter your phone number.',
                'auth/internal-error': 'Something went wrong. Please close the app and try again.',
            };
            const friendlyError = errorMap[error.code] || error.message;
            return { success: false, error: friendlyError };
        }
    };

    // Verify OTP code
    const verifyOTP = async (otpCode) => {
        try {
            if (!confirmationResultRef.current) {
                return { success: false, error: 'No OTP request found. Please send OTP again.' };
            }
            const result = await confirmationResultRef.current.confirm(otpCode);
            return { success: true, user: result.user };
        } catch (error) {
            return { success: false, error: 'Invalid OTP. Please try again.' };
        }
    };

    // Signup with phone — just sends OTP, no name/email needed at signup
    const signupWithPhone = async (phoneNumber, buttonId = 'recaptcha-container') => {
        try {
            isOnboarding.current = true;
            const result = await sendOTP(phoneNumber, buttonId);
            if (!result.success) {
                isOnboarding.current = false;
                return result;
            }
            return { success: true };
        } catch (error) {
            isOnboarding.current = false;
            return { success: false, error: error.message };
        }
    };

    // Complete signup after OTP verification
    const completeSignup = async (otpCode) => {
        try {
            const result = await verifyOTP(otpCode);
            if (!result.success) return result;

            setUser({
                id: result.user.uid,
                name: '',
                email: '',
                phone: result.user.phoneNumber || '',
                role: null,
                profileComplete: false,
                profile: null
            });

            setLoading(false);
            return { success: true };
        } catch (error) {
            isOnboarding.current = false;
            return { success: false, error: error.message };
        }
    };

    // Login with phone OTP verification
    const loginVerifyOTP = async (otpCode) => {
        try {
            const result = await verifyOTP(otpCode);
            if (!result.success) return result;

            // Check if user exists in Firestore (has completed signup)
            const firebaseUser = result.user;
            let userDoc = await getDoc(doc(db, 'seekers', firebaseUser.uid));
            if (!userDoc.exists()) {
                userDoc = await getDoc(doc(db, 'companies', firebaseUser.uid));
            }

            if (!userDoc.exists()) {
                // New user — no profile in Firestore, treat as signup
                isOnboarding.current = true;
                setUser({
                    id: firebaseUser.uid,
                    name: '',
                    email: '',
                    phone: firebaseUser.phoneNumber || '',
                    role: null,
                    profileComplete: false,
                    profile: null
                });
                setLoading(false);
                return { success: true, isNewUser: true };
            }

            return { success: true, isNewUser: false };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const selectRole = (role) => {
        if (!user) {
            return;
        }
        // Persist role to localStorage so it survives page transitions on iOS
        localStorage.setItem('onboardingRole', role);
        setUser(prev => ({ ...prev, role }));
    };

    const completeProfile = async (profileData) => {
        if (!user) {
            return { success: false, error: 'No user found' };
        }

        if (!user.id) {
            return { success: false, error: 'User has no ID' };
        }

        if (!user.role) {
            return { success: false, error: 'User has no role selected' };
        }

        // Upload images to Firebase Storage
        const cleanedProfile = { ...profileData };

        try {
            // Upload avatar if it's a base64 image
            if (cleanedProfile.avatar && cleanedProfile.avatar.startsWith('data:')) {
                const avatarUrl = await uploadImage(
                    cleanedProfile.avatar,
                    `users/${user.id}/avatar_${Date.now()}.jpg`
                );
                cleanedProfile.avatar = avatarUrl;
            }

            // Upload portfolio images if they exist
            if (cleanedProfile.portfolioImages && cleanedProfile.portfolioImages.length > 0) {
                const base64Images = cleanedProfile.portfolioImages.filter(img => img && img.startsWith('data:'));
                if (base64Images.length > 0) {
                    const imageUrls = await uploadImages(
                        base64Images,
                        `users/${user.id}/portfolio`
                    );
                    cleanedProfile.portfolioImages = imageUrls;
                }
            }
        } catch (uploadError) {
            // Continue without images if upload fails
            cleanedProfile.avatar = null;
            cleanedProfile.portfolioImages = [];
        }

        // Get phone from user state or Firebase Auth or localStorage
        const userPhone = user.phone || auth.currentUser?.phoneNumber || localStorage.getItem('userPhone') || '';

        // Inject phone into profile sub-object so admin dashboard can read it
        if (userPhone && !cleanedProfile.phone) {
            cleanedProfile.phone = userPhone;
        }

        // Generate username if not already set
        let username = user.username;
        if (!username) {
            const displayName = profileData.name || profileData.companyName || user.name || 'user';
            username = await generateUniqueUsername(displayName, user.id);
        }

        const updatedUser = {
            email: user.email,
            phone: userPhone,
            name: profileData.name || profileData.companyName || user.name,
            role: user.role,
            profileComplete: true,
            profile: cleanedProfile,
            username,
            createdAt: new Date().toISOString()
        };

        // Check size before saving
        const dataSize = JSON.stringify(updatedUser).length;
        try {
            // Save to appropriate collection based on role
            const collectionName = user.role === 'SEEKER' ? 'seekers' : 'companies';
            await setDoc(doc(db, collectionName, user.id), updatedUser);
            // Update local state
            setUser({ id: user.id, ...updatedUser });

            // Clear onboarding flag and localStorage role - profile is complete
            isOnboarding.current = false;
            localStorage.removeItem('onboardingRole');

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    // Update username
    const updateUsername = async (newUsername) => {
        if (!user || !user.id) return { success: false, error: 'Not logged in' };

        const clean = (newUsername || '').toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 25);
        if (clean.length < 3) return { success: false, error: 'Username must be at least 3 characters' };
        if (clean === user.username) return { success: true }; // No change

        // Check availability
        const existing = await getDoc(doc(db, 'usernames', clean));
        if (existing.exists() && existing.data().userId !== user.id) {
            return { success: false, error: 'Username is already taken' };
        }

        try {
            // Release old username
            if (user.username) {
                await deleteDoc(doc(db, 'usernames', user.username));
            }
            // Reserve new
            await setDoc(doc(db, 'usernames', clean), { userId: user.id, createdAt: new Date().toISOString() });
            // Update user doc
            const collectionName = user.role === 'SEEKER' ? 'seekers' : 'companies';
            await updateDoc(doc(db, collectionName, user.id), { username: clean });
            setUser(prev => ({ ...prev, username: clean }));
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    // Get profiles of the opposite role for swiping
    // Get ALL users of opposite role (for Connections directory)
    const getAllUsers = useCallback(async () => {
        if (!user || !user.role) return [];
        try {
            const collectionName = user.role === 'SEEKER' ? 'companies' : 'seekers';
            const q = query(
                collection(db, collectionName),
                where('profileComplete', '==', true)
            );
            const snapshot = await getDocs(q);
            const users = [];
            snapshot.forEach((doc) => {
                if (doc.id !== user.id) {
                    users.push({ id: doc.id, ...doc.data() });
                }
            });
            // Sort: same-city first, then by lastActiveAt descending
            const userCity = (user.profile?.city || '').trim().toLowerCase();
            users.sort((a, b) => {
                const aCity = (a.profile?.city || a.city || '').trim().toLowerCase();
                const bCity = (b.profile?.city || b.city || '').trim().toLowerCase();
                const aSame = userCity && aCity === userCity ? 1 : 0;
                const bSame = userCity && bCity === userCity ? 1 : 0;
                if (aSame !== bSame) return bSame - aSame;
                const aTime = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
                const bTime = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
                return bTime - aTime;
            });
            return users;
        } catch (error) {
            return [];
        }
    }, [user]);

    const getSwipeProfiles = useCallback(async () => {
        if (!user || !user.role) {
            return [];
        }

        try {
            // 7-day cooldown: profiles reappear after 7 days of being liked/passed
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const cooldownCutoff = sevenDaysAgo.toISOString();

            // Fetch liked, passed, meeting, and matched users in parallel
            const fetchPromises = [
                getDocs(collection(db, 'likes', user.id, 'outgoing')),
                getDocs(collection(db, 'passes', user.id, 'passed')),
                getDocs(query(
                    collection(db, 'meetings'),
                    where(user.role === 'COMPANY' ? 'companyId' : 'seekerId', '==', user.id)
                )),
                getDocs(collection(db, 'matches', user.id, 'matched')),
            ];

            // For COMPANY users: also fetch ALL active seeker meetings globally
            // so we can deprioritize seekers who already have appointment requests
            const isCompanyUser = user.role === 'COMPANY';
            if (isCompanyUser) {
                fetchPromises.push(
                    getDocs(query(
                        collection(db, 'meetings'),
                        where('status', 'in', ['PENDING_ACCEPTANCE', 'SCHEDULED'])
                    ))
                );
            }

            const results = await Promise.all(fetchPromises);
            const [likedUsersSnapshot, passedUsersSnapshot, meetingsSnapshot, matchesSnapshot] = results;
            const globalActiveMeetingsSnapshot = isCompanyUser ? results[4] : null;

            // Liked users — only exclude if liked within last 7 days
            const likedUserIds = new Set();
            likedUsersSnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.likedAt && data.likedAt > cooldownCutoff) {
                    likedUserIds.add(doc.id);
                }
            });

            // Passed users — only exclude if passed within last 7 days
            const passedUserIds = new Set();
            passedUsersSnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.passedAt && data.passedAt > cooldownCutoff) {
                    passedUserIds.add(doc.id);
                }
            });

            // Matched users — always excluded (real engagement)
            const matchedUserIds = new Set();
            matchesSnapshot.forEach((doc) => {
                matchedUserIds.add(doc.id);
            });

            // Collect partner IDs from active meetings — always excluded
            const meetingUserIds = new Set();
            meetingsSnapshot.forEach((d) => {
                const m = d.data();
                // Exclude partners from any non-terminal meeting
                if (!['CANCELLED', 'DECLINED'].includes(m.status)) {
                    const partnerId = user.role === 'COMPANY' ? m.seekerId : m.companyId;
                    if (partnerId) meetingUserIds.add(partnerId);
                }
            });

            // Build demand map: count active meetings per seeker (for company users)
            // Seekers with more active meetings get deprioritized
            const seekerDemandMap = new Map(); // seekerId → active meeting count
            if (isCompanyUser && globalActiveMeetingsSnapshot) {
                globalActiveMeetingsSnapshot.forEach((d) => {
                    const m = d.data();
                    const sid = m.seekerId;
                    if (sid) {
                        seekerDemandMap.set(sid, (seekerDemandMap.get(sid) || 0) + 1);
                    }
                });
            }

            // Seekers see Companies, Companies see Seekers
            const collectionName = user.role === 'SEEKER' ? 'companies' : 'seekers';

            const q = query(
                collection(db, collectionName),
                where('profileComplete', '==', true)
            );

            const querySnapshot = await getDocs(q);
            const profiles = [];

            querySnapshot.forEach((doc) => {
                // Exclude: self, recently liked/passed (7-day cooldown), matched, or active meeting users
                if (doc.id !== user.id && !likedUserIds.has(doc.id) && !passedUserIds.has(doc.id) && !matchedUserIds.has(doc.id) && !meetingUserIds.has(doc.id)) {
                    profiles.push({ id: doc.id, ...doc.data() });
                }
            });

            // City-based matching: same-city profiles appear first
            const userCity = (user.profile?.city || '').trim().toLowerCase();

            // Simple hash function to create per-user deterministic variation
            // so different companies see slightly different orderings
            const hashCode = (str) => {
                let hash = 0;
                for (let i = 0; i < str.length; i++) {
                    const char = str.charCodeAt(i);
                    hash = ((hash << 5) - hash) + char;
                    hash = hash & hash; // Convert to 32-bit integer
                }
                return Math.abs(hash);
            };
            const userSeed = hashCode(user.id || '');

            profiles.sort((a, b) => {
                const aCity = (a.profile?.city || a.city || '').trim().toLowerCase();
                const bCity = (b.profile?.city || b.city || '').trim().toLowerCase();
                const aSameCity = userCity && aCity === userCity ? 1 : 0;
                const bSameCity = userCity && bCity === userCity ? 1 : 0;

                // 1. Same-city profiles come first
                if (aSameCity !== bSameCity) return bSameCity - aSameCity;

                // 2. For COMPANY users: deprioritize seekers with more active meetings
                if (isCompanyUser) {
                    const aDemand = seekerDemandMap.get(a.id) || 0;
                    const bDemand = seekerDemandMap.get(b.id) || 0;
                    if (aDemand !== bDemand) return aDemand - bDemand; // fewer meetings = higher rank
                }

                // 3. Within same demand tier, sort by lastActiveAt descending
                const aTime = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
                const bTime = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;

                // 4. If activity times are within 1 hour of each other, use
                //    per-user hash to break the tie so different companies see
                //    different orderings among equally-active seekers
                if (Math.abs(aTime - bTime) < 3600000) { // 1 hour
                    const aHash = hashCode(a.id) ^ userSeed;
                    const bHash = hashCode(b.id) ^ userSeed;
                    return aHash - bHash;
                }

                return bTime - aTime;
            });

            return profiles;
        } catch (error) {
            return [];
        }
    }, [user]);

    // Like a profile and check for mutual match
    const likeProfile = useCallback(async (targetProfile) => {
        if (!user || !user.id) {
            return { success: false, isMatch: false };
        }

        try {
            // Store the like: current user liked target profile
            // Collection structure: likes/{likerUserId}/outgoing/{likedUserId}
            await setDoc(
                doc(db, 'likes', user.id, 'outgoing', targetProfile.id),
                {
                    likedAt: new Date().toISOString(),
                    likedUserId: targetProfile.id,
                    likedUserName: targetProfile.name || targetProfile.profile?.companyName || targetProfile.profile?.name,
                    likedUserRole: targetProfile.role,
                }
            );

            // Also store incoming like on the target user's side
            await setDoc(
                doc(db, 'likes', targetProfile.id, 'incoming', user.id),
                {
                    likedAt: new Date().toISOString(),
                    likerUserId: user.id,
                    likerUserName: user.name || user.profile?.companyName || user.profile?.name,
                    likerUserRole: user.role,
                }
            );

            // Check if the target profile has already liked us (mutual match)
            const theirLikeDoc = await getDoc(doc(db, 'likes', targetProfile.id, 'outgoing', user.id));

            if (theirLikeDoc.exists()) {
                // It's a match!
                // Store the match for both users
                const matchData = {
                    matchedAt: new Date().toISOString(),
                    users: [user.id, targetProfile.id],
                };

                // Match for current user
                await setDoc(
                    doc(db, 'matches', user.id, 'matched', targetProfile.id),
                    {
                        ...matchData,
                        matchedUserId: targetProfile.id,
                        matchedUserName: targetProfile.name || targetProfile.profile?.companyName || targetProfile.profile?.name,
                        matchedUserRole: targetProfile.role,
                        matchedUserProfile: targetProfile.profile || null,
                    }
                );

                // Match for target user
                await setDoc(
                    doc(db, 'matches', targetProfile.id, 'matched', user.id),
                    {
                        ...matchData,
                        matchedUserId: user.id,
                        matchedUserName: user.name || user.profile?.companyName || user.profile?.name,
                        matchedUserRole: user.role,
                        matchedUserProfile: user.profile || null,
                    }
                );

                return { success: true, isMatch: true };
            }

            // Notify target user about the like (fire-and-forget)
            const myName = user.name || user.profile?.companyName || user.profile?.name || 'Someone';
            createNotification(targetProfile.id, {
                type: 'like',
                title: '❤️ New Like!',
                message: `${myName} liked your profile`,
                data: { userId: user.id },
            });

            return { success: true, isMatch: false };
        } catch (error) {
            return { success: false, isMatch: false, error: error.message };
        }
    }, [user]);

    // Pass (left swipe) a profile - record to never show again
    const passProfile = useCallback(async (targetProfile) => {
        if (!user || !user.id) {
            return { success: false };
        }

        try {
            // Store the pass: current user passed target profile
            // Collection structure: passes/{userId}/passed/{passedUserId}
            await setDoc(
                doc(db, 'passes', user.id, 'passed', targetProfile.id),
                {
                    passedAt: new Date().toISOString(),
                    passedUserId: targetProfile.id,
                }
            );

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, [user]);

    // Get all matches for current user
    const getMatches = useCallback(async () => {
        if (!user || !user.id) {
            return [];
        }

        try {
            const matchesSnapshot = await getDocs(
                collection(db, 'matches', user.id, 'matched')
            );

            const matches = [];
            matchesSnapshot.forEach((doc) => {
                matches.push({ id: doc.id, ...doc.data() });
            });

            return matches;
        } catch (error) {
            return [];
        }
    }, [user]);

    // Get incoming likes (pending match requests to accept/refuse)
    const getIncomingLikes = useCallback(async () => {
        if (!user || !user.id) return [];

        try {
            const incomingSnapshot = await getDocs(
                collection(db, 'likes', user.id, 'incoming')
            );

            const incoming = [];
            incomingSnapshot.forEach((d) => {
                incoming.push({ id: d.id, ...d.data() });
            });

            // Filter out users we've already matched with
            const matchesSnapshot = await getDocs(
                collection(db, 'matches', user.id, 'matched')
            );
            const matchedIds = new Set();
            matchesSnapshot.forEach((d) => matchedIds.add(d.id));

            const pendingLikes = incoming.filter(like => !matchedIds.has(like.likerUserId || like.id));

            // Enrich each like with full profile data
            const enriched = await Promise.all(
                pendingLikes.map(async (like) => {
                    const likerId = like.likerUserId || like.id;
                    // Try seekers first, then companies
                    let profileDoc = await getDoc(doc(db, 'seekers', likerId));
                    if (!profileDoc.exists()) {
                        profileDoc = await getDoc(doc(db, 'companies', likerId));
                    }
                    if (profileDoc.exists()) {
                        const data = profileDoc.data();
                        return {
                            ...like,
                            id: likerId,
                            role: data.role,
                            profile: data.profile || {},
                            name: data.name || data.profile?.name || data.profile?.companyName,
                            email: data.email,
                        };
                    }
                    return { ...like, id: likerId };
                })
            );

            return enriched;
        } catch (error) {
            return [];
        }
    }, [user]);

    // Accept a match request (incoming like → mutual match)
    const acceptMatch = useCallback(async (likerUserId) => {
        if (!user || !user.id) return { success: false };

        try {
            // Fetch the liker's full profile
            let likerDoc = await getDoc(doc(db, 'seekers', likerUserId));
            if (!likerDoc.exists()) {
                likerDoc = await getDoc(doc(db, 'companies', likerUserId));
            }

            const likerData = likerDoc.exists() ? likerDoc.data() : {};
            const likerName = likerData.name || likerData.profile?.companyName || likerData.profile?.name || 'Unknown';
            const likerRole = likerData.role || 'SEEKER';
            const likerProfile = likerData.profile || {};

            const myName = user.name || user.profile?.companyName || user.profile?.name || 'Unknown';
            const matchedAt = new Date().toISOString();

            // Create match for current user
            await setDoc(
                doc(db, 'matches', user.id, 'matched', likerUserId),
                {
                    matchedAt,
                    users: [user.id, likerUserId],
                    matchedUserId: likerUserId,
                    matchedUserName: likerName,
                    matchedUserRole: likerRole,
                    matchedUserProfile: likerProfile,
                }
            );

            // Create match for liker
            await setDoc(
                doc(db, 'matches', likerUserId, 'matched', user.id),
                {
                    matchedAt,
                    users: [user.id, likerUserId],
                    matchedUserId: user.id,
                    matchedUserName: myName,
                    matchedUserRole: user.role,
                    matchedUserProfile: user.profile || {},
                }
            );

            // Clean up like docs (fire-and-forget)
            Promise.all([
                deleteDoc(doc(db, 'likes', user.id, 'incoming', likerUserId)).catch(() => { }),
                deleteDoc(doc(db, 'likes', likerUserId, 'outgoing', user.id)).catch(() => { }),
            ]);

            // Notify the liker that their match was accepted
            const myName2 = user.name || user.profile?.companyName || user.profile?.name || 'Someone';
            createNotification(likerUserId, {
                type: 'match_accepted',
                title: '🎉 Match Accepted!',
                message: `${myName2} accepted your match request. You can now chat!`,
                data: { userId: user.id },
            });

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, [user]);

    // Refuse a match request (delete incoming like + record pass)
    const refuseMatch = useCallback(async (likerUserId) => {
        if (!user || !user.id) return { success: false };

        try {
            // Delete the incoming like
            await deleteDoc(doc(db, 'likes', user.id, 'incoming', likerUserId));

            // Record a pass so they don't show up in explore again
            await setDoc(
                doc(db, 'passes', user.id, 'passed', likerUserId),
                {
                    passedAt: new Date().toISOString(),
                    passedUserId: likerUserId,
                }
            );

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, [user]);

    // Generate a consistent chat ID for two users
    const getChatId = useCallback((userId1, userId2) => {
        // Sort IDs to get consistent chat ID regardless of who initiates
        const sortedIds = [userId1, userId2].sort();
        return `${sortedIds[0]}_${sortedIds[1]}`;
    }, []);

    // Send a message in a chat
    const sendMessage = useCallback(async (otherUserId, messageText, attachment = null) => {
        if (!user || !user.id || (!messageText.trim() && !attachment)) {
            return { success: false };
        }

        const chatId = getChatId(user.id, otherUserId);
        try {
            // Build message document
            const msgDoc = {
                senderId: user.id,
                senderName: user.name || user.profile?.companyName || user.profile?.name,
                text: messageText.trim(),
                createdAt: serverTimestamp(),
            };

            // Add attachment fields if present
            if (attachment) {
                msgDoc.fileUrl = attachment.url;
                msgDoc.fileType = attachment.type; // 'voice', 'image', 'pdf', 'document'
                msgDoc.fileName = attachment.name || '';
                if (attachment.duration) msgDoc.fileDuration = attachment.duration;
            }

            await addDoc(collection(db, 'chats', chatId, 'messages'), msgDoc);

            // Update chat metadata
            const lastMsgPreview = attachment
                ? (attachment.type === 'voice' ? '🎙️ Voice note' : `📎 ${attachment.name || 'File'}`)
                : messageText.trim();

            await setDoc(doc(db, 'chats', chatId), {
                participants: [user.id, otherUserId],
                lastMessage: lastMsgPreview,
                lastMessageAt: serverTimestamp(),
                lastMessageSenderId: user.id,
            }, { merge: true });

            // Notify recipient about new message (fire-and-forget)
            const senderName = user.name || user.profile?.companyName || user.profile?.name || 'Someone';
            createNotification(otherUserId, {
                type: 'message',
                title: '💬 New Message',
                message: `${senderName}: ${lastMsgPreview.substring(0, 50)}${lastMsgPreview.length > 50 ? '...' : ''}`,
                data: { chatId, senderId: user.id },
            });

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, [user, getChatId]);

    // Get all chats for current user
    const getChats = useCallback(async () => {
        if (!user || !user.id) {
            return [];
        }

        try {
            // Query chats where current user is a participant
            const chatsSnapshot = await getDocs(
                query(collection(db, 'chats'), where('participants', 'array-contains', user.id))
            );

            const isCompany = user.role === 'COMPANY';

            // Fetch meetings for meeting status
            const meetingField = isCompany ? 'companyId' : 'seekerId';
            const meetingsSnapshot = await getDocs(
                query(collection(db, 'meetings'), where(meetingField, '==', user.id))
            );
            const allMeetings = [];
            meetingsSnapshot.forEach((d) => allMeetings.push({ id: d.id, ...d.data() }));

            // Process chats and enrich with partner info
            const chatDocs = [];
            chatsSnapshot.forEach(d => chatDocs.push({ id: d.id, ...d.data() }));

            // Collect partner IDs that need name lookups
            const partnerIds = new Map();
            chatDocs.forEach(chat => {
                if (chat.isBroadcast || chat.id?.startsWith('plyship-broadcast')) return;
                const otherUserId = chat.participants?.find(p => p !== user.id);
                if (otherUserId) {
                    const coll = isCompany ? 'seekers' : 'companies';
                    partnerIds.set(otherUserId, coll);
                }
            });

            // Batch fetch partner profiles
            const partnerProfiles = {};
            await Promise.all(
                Array.from(partnerIds.entries()).map(async ([id, coll]) => {
                    try {
                        const snap = await getDoc(doc(db, coll, id));
                        if (snap.exists()) {
                            partnerProfiles[id] = snap.data();
                        }
                    } catch (_) { }
                })
            );

            // Also try from old matches collection for legacy data
            try {
                const matchesSnapshot = await getDocs(
                    collection(db, 'matches', user.id, 'matched')
                );
                matchesSnapshot.forEach(matchDoc => {
                    const data = matchDoc.data();
                    if (!partnerProfiles[matchDoc.id]) {
                        partnerProfiles[matchDoc.id] = {
                            matchedUserName: data.matchedUserName,
                            matchedUserRole: data.matchedUserRole,
                            profile: data.matchedUserProfile,
                        };
                    }
                });
            } catch (_) { }

            const chats = chatDocs
                .filter(chat => !chat.isBroadcast && !chat.id?.startsWith('plyship-broadcast'))
                .map(chat => {
                    const otherUserId = chat.participants?.find(p => p !== user.id);
                    const partner = partnerProfiles[otherUserId] || {};
                    const partnerProfile = partner.profile || partner.matchedUserProfile || {};
                    const partnerName = partner.matchedUserName || partnerProfile.companyName || partnerProfile.name || partner.name || '';
                    const partnerRole = partner.matchedUserRole || partner.role || (isCompany ? 'SEEKER' : 'COMPANY');

                    // Get latest meeting status
                    const relevantMeetings = allMeetings
                        .filter(m => {
                            const matchesOther = (m.companyId === otherUserId || m.seekerId === otherUserId);
                            return matchesOther && !m.rescheduledTo;
                        })
                        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                    const latestMeeting = relevantMeetings[0] || null;

                    return {
                        id: chat.id,
                        matchedUserId: otherUserId,
                        matchedUserName: partnerName,
                        matchedUserRole: partnerRole,
                        matchedUserProfile: partnerProfile,
                        matchedUserPhone: partner.phone || partnerProfile.phone || null,
                        lastMessage: chat.lastMessage || null,
                        lastMessageAt: chat.lastMessageAt || null,
                        meetingStatus: chat.meetingStatus || latestMeeting?.status || null,
                        meetingScheduledAt: latestMeeting?.scheduledAt || null,
                    };
                });

            // Fetch broadcast chats from PlyShip Team
            try {
                const broadcastChatId = `plyship-broadcast_${user.id}`;
                const broadcastSnap = await getDoc(doc(db, 'chats', broadcastChatId));
                if (broadcastSnap.exists()) {
                    const bData = broadcastSnap.data();
                    chats.push({
                        id: broadcastChatId,
                        matchedUserId: 'plyship-admin',
                        matchedUserName: 'PlyShip Team',
                        matchedUserRole: 'ADMIN',
                        matchedUserProfile: { avatar: '/logo.png' },
                        lastMessage: bData.lastMessage || null,
                        lastMessageAt: bData.lastMessageAt || null,
                        meetingStatus: null,
                        meetingScheduledAt: null,
                        isBroadcast: true,
                    });
                }
            } catch (e) { }

            // Sort by last message time (most recent first)
            chats.sort((a, b) => {
                const timeA = a.lastMessageAt?.toDate?.() || new Date(a.lastMessageAt || 0);
                const timeB = b.lastMessageAt?.toDate?.() || new Date(b.lastMessageAt || 0);
                return timeB - timeA;
            });

            return chats;
        } catch (error) {
            return [];
        }
    }, [user, getChatId]);

    // Get count of unread messages across all chats
    const getUnreadCount = useCallback(async () => {
        if (!user || !user.id) {
            return 0;
        }

        try {
            // Get all matches
            const matchesSnapshot = await getDocs(
                collection(db, 'matches', user.id, 'matched')
            );

            // Batch-fetch all chat docs in parallel (was N+1 sequential)
            const chatPromises = matchesSnapshot.docs.map(matchDoc => {
                const chatId = getChatId(user.id, matchDoc.id);
                return getDoc(doc(db, 'chats', chatId));
            });
            const chatDocs = await Promise.all(chatPromises);

            let unreadCount = 0;
            chatDocs.forEach(chatDoc => {
                if (chatDoc.exists()) {
                    const chatData = chatDoc.data();
                    // Count as unread if last message wasn't sent by current user
                    if (chatData.lastMessageSenderId && chatData.lastMessageSenderId !== user.id) {
                        unreadCount++;
                    }
                }
            });

            return unreadCount;
        } catch (error) {
            return 0;
        }
    }, [user, getChatId]);

    // ============ WALLET FUNCTIONS ============

    // Initialize wallet for a user (call after signup/profile completion)
    const initializeWallet = useCallback(async (userId, role) => {
        try {
            const walletRef = doc(db, 'wallets', userId);
            const walletSnap = await getDoc(walletRef);

            if (!walletSnap.exists()) {
                const walletData = {
                    userId,
                    type: role,
                    balance: 0,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };

                // Seeker-specific fields
                if (role === 'SEEKER') {
                    walletData.lockedBalance = 0;
                    walletData.totalEarnings = 0;
                    walletData.bankDetails = null;
                }

                // Company-specific fields
                if (role === 'COMPANY') {
                    walletData.totalSpent = 0;
                }

                await setDoc(walletRef, walletData);
                return { success: true, wallet: walletData };
            }

            return { success: true, wallet: walletSnap.data() };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, []);

    // Get wallet data for current user
    const getWallet = useCallback(async () => {
        if (!user || !user.id) {
            return null;
        }

        try {
            const walletRef = doc(db, 'wallets', user.id);
            const walletSnap = await getDoc(walletRef);

            if (walletSnap.exists()) {
                return walletSnap.data();
            }

            // If wallet doesn't exist, create it
            const result = await initializeWallet(user.id, user.role);
            return result.wallet;
        } catch (error) {
            return null;
        }
    }, [user, initializeWallet]);

    // Get transaction history for current user
    const getTransactions = useCallback(async (limit = 20) => {
        if (!user || !user.id) {
            return [];
        }

        try {
            const q = query(
                collection(db, 'transactions'),
                where('userId', '==', user.id),
                orderBy('createdAt', 'desc')
            );

            const snapshot = await getDocs(q);
            const transactions = [];
            snapshot.forEach((doc) => {
                transactions.push({ id: doc.id, ...doc.data() });
            });

            return transactions.slice(0, limit);
        } catch (error) {
            return [];
        }
    }, [user]);

    // Add a transaction record
    const addTransaction = useCallback(async (transactionData) => {
        try {
            const docRef = await addDoc(collection(db, 'transactions'), {
                ...transactionData,
                createdAt: new Date().toISOString(),
                status: transactionData.status || 'COMPLETED',
            });
            return { success: true, transactionId: docRef.id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, []);

    // Top up wallet after successful Razorpay payment
    const topUpWallet = useCallback(async (amount, paymentId, orderId) => {
        if (!user || !user.id) {
            return { success: false, error: 'Not logged in' };
        }

        try {
            // ── Idempotency guard: prevent double-crediting ──
            // If both the Razorpay handler AND the iOS recovery fire for the
            // same payment, this check ensures only the first one credits.
            if (paymentId) {
                const existingTxnSnap = await getDocs(query(
                    collection(db, 'transactions'),
                    where('paymentId', '==', paymentId),
                    where('userId', '==', user.id)
                ));
                if (!existingTxnSnap.empty) {
                    // Already credited — return success without double-crediting
                    const walletSnap = await getDoc(doc(db, 'wallets', user.id));
                    const currentBalance = walletSnap.exists() ? (walletSnap.data().balance || 0) : 0;
                    return { success: true, newBalance: currentBalance, alreadyCredited: true };
                }
            }

            const walletRef = doc(db, 'wallets', user.id);
            const walletSnap = await getDoc(walletRef);

            let currentBalance = 0;
            if (walletSnap.exists()) {
                currentBalance = walletSnap.data().balance || 0;
            }

            const newBalance = currentBalance + amount;

            // Update wallet balance
            await setDoc(walletRef, {
                balance: newBalance,
                updatedAt: new Date().toISOString(),
                lastTopUp: {
                    amount,
                    paymentId,
                    orderId,
                    timestamp: new Date().toISOString(),
                },
            }, { merge: true });

            // Record transaction
            await addDoc(collection(db, 'transactions'), {
                userId: user.id,
                type: 'CREDIT',
                amount,
                reason: 'TOP_UP',
                paymentId,
                orderId,
                status: 'COMPLETED',
                createdAt: new Date().toISOString(),
            });

            // Notify user about successful top-up
            createNotification(user.id, {
                type: 'wallet_credit',
                title: '💰 Wallet Topped Up!',
                message: `₹${amount} added to your wallet. New balance: ₹${newBalance}`,
                data: { amount, newBalance },
            });

            return { success: true, newBalance };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, [user]);

    // ============ PAYMENT RECOVERY ============
    // Recover pending Razorpay payments that completed while the app was closed.
    // This runs on login, app resume, and wallet page open.
    const recoverPendingPayments = useCallback(async () => {
        if (!user || !user.id) return;

        try {
            const raw = localStorage.getItem(`plyship_pending_order_${user.id}`);
            if (!raw) return;

            const pending = JSON.parse(raw);
            if (!pending?.orderId) {
                localStorage.removeItem(`plyship_pending_order_${user.id}`);
                return;
            }

            // Check if already credited (idempotency)
            const existingTxnSnap = await getDocs(query(
                collection(db, 'transactions'),
                where('orderId', '==', pending.orderId),
                where('userId', '==', user.id)
            ));
            if (!existingTxnSnap.empty) {
                // Already credited — clean up localStorage
                localStorage.removeItem(`plyship_pending_order_${user.id}`);
                return;
            }

            // Verify with backend
            const res = await fetch('/api/razorpay/verify-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: pending.orderId, userId: user.id }),
            });
            const data = await res.json();

            if (data.success && data.paymentId) {
                // Payment was captured — credit the wallet
                await topUpWallet(data.amount, data.paymentId, data.orderId);
                localStorage.removeItem(`plyship_pending_order_${user.id}`);
                console.log('[PaymentRecovery] Recovered payment:', data.paymentId, '₹' + data.amount);
            } else if (data.orderStatus === 'created') {
                // Still pending — check if order is older than 30 min (expired)
                const orderAge = Date.now() - (pending.createdAt || 0);
                if (orderAge > 30 * 60 * 1000) {
                    localStorage.removeItem(`plyship_pending_order_${user.id}`);
                }
                // else: leave it for next check
            } else {
                // Order failed/expired — clean up
                localStorage.removeItem(`plyship_pending_order_${user.id}`);
            }
        } catch (err) {
            console.error('[PaymentRecovery] Error:', err);
        }
    }, [user, topUpWallet]);

    // Run payment recovery on app resume / visibility change
    useEffect(() => {
        if (!user?.id) return;

        // Run on initial load
        recoverPendingPayments();

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                setTimeout(() => recoverPendingPayments(), 1500);
            }
        };
        const handleFocus = () => {
            setTimeout(() => recoverPendingPayments(), 1500);
        };

        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('focus', handleFocus);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('focus', handleFocus);
        };
    }, [user?.id, recoverPendingPayments]);

    // ============ MEETING FUNCTIONS ============

    // Schedule a meeting with a match (creates a request that needs acceptance)
    const scheduleMeeting = useCallback(async (targetUserId, scheduledAt, notes = '', location = '') => {
        if (!user || !user.id) {
            return { success: false, error: 'Not logged in' };
        }

        try {
            const isCompany = user.role === 'COMPANY';
            const companyId = isCompany ? user.id : targetUserId;
            const seekerId = isCompany ? targetUserId : user.id;

            const MEETING_COST = 500;

            // 1. Get company's wallet balance
            const walletSnap = await getDoc(doc(db, 'wallets', companyId));
            const companyBalance = walletSnap.exists() ? (walletSnap.data().balance || 0) : 0;
            const maxMeetingSlots = Math.floor(companyBalance / MEETING_COST);

            if (maxMeetingSlots < 1) {
                if (!isCompany) {
                    try {
                        const seekerName = user.profile?.name || user.name || 'A seeker';
                        const meetingMessage = `Hey! I'd love to schedule an interior consultation meeting with you 📅`;
                        const chatId = getChatId(user.id, targetUserId);
                        await addDoc(collection(db, 'chats', chatId, 'messages'), {
                            senderId: user.id, senderName: seekerName,
                            text: meetingMessage, createdAt: serverTimestamp(),
                        });
                        await setDoc(doc(db, 'chats', chatId), {
                            participants: [user.id, targetUserId],
                            lastMessage: meetingMessage, lastMessageAt: serverTimestamp(),
                            lastMessageSenderId: user.id,
                        }, { merge: true });
                        createNotification(targetUserId, {
                            type: 'message', title: '💬 New Message',
                            message: `${seekerName}: ${meetingMessage}`,
                            data: { chatId, senderId: user.id },
                        });
                    } catch (msgErr) { console.error('Failed to send meeting interest message:', msgErr); }

                    return {
                        success: false,
                        error: 'We\'ve sent a message to this company on your behalf expressing your interest in a meeting. They\'ll get back to you soon!',
                        insufficientBalance: true, messageSent: true,
                        requiredAmount: MEETING_COST, currentBalance: companyBalance,
                    };
                }
                return {
                    success: false,
                    error: `You need at least ₹${MEETING_COST} in your wallet to request a meeting. Please top up your service deposit.`,
                    insufficientBalance: true, requiredAmount: MEETING_COST, currentBalance: companyBalance,
                };
            }

            // 2. Count active meetings
            const activeMeetingsSnap = await getDocs(query(collection(db, 'meetings'), where('companyId', '==', companyId)));
            const activeMeetingCount = activeMeetingsSnap.docs.filter(d => {
                const s = d.data().status;
                return s === 'REQUESTED' || s === 'PENDING_ACCEPTANCE' || s === 'SCHEDULED';
            }).length;

            if (activeMeetingCount >= maxMeetingSlots) {
                return {
                    success: false,
                    error: isCompany
                        ? `You have ${activeMeetingCount} active meeting${activeMeetingCount > 1 ? 's' : ''} and ₹${companyBalance} in your wallet. Each meeting requires ₹${MEETING_COST}. Please add more or cancel an existing meeting.`
                        : 'This company has reached their maximum meeting slots. Please try again later.',
                    meetingLimitReached: true, activeMeetings: activeMeetingCount,
                    maxSlots: maxMeetingSlots, currentBalance: companyBalance,
                };
            }

            // Fetch target name
            let targetName = '';
            try {
                const targetRole = isCompany ? 'seekers' : 'companies';
                const targetSnap = await getDoc(doc(db, targetRole, targetUserId));
                if (targetSnap.exists()) {
                    const td = targetSnap.data();
                    targetName = td.profile?.name || td.profile?.companyName || td.name || '';
                }
            } catch (e) { /* ignore */ }

            const myName = user.profile?.companyName || user.profile?.name || user.name || '';

            // COMPANY: status=REQUESTED, no date/time. SEEKER: legacy PENDING_ACCEPTANCE with date/time.
            const meetingData = {
                companyId, seekerId,
                companyName: isCompany ? myName : targetName,
                seekerName: isCompany ? targetName : myName,
                requestedBy: user.id, acceptedBy: null,
                scheduledAt: isCompany ? null : scheduledAt,
                location: isCompany ? '' : (location || ''),
                notes: isCompany ? '' : notes,
                status: isCompany ? 'REQUESTED' : 'PENDING_ACCEPTANCE',
                companyConfirmed: false, seekerConfirmed: false,
                companyDenied: false, seekerDenied: false,
                paymentStatus: 'PENDING',
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            };

            const meetingRef = await addDoc(collection(db, 'meetings'), meetingData);
            const chatId = getChatId(user.id, targetUserId);
            const locationDisplay = location ? location.split('||')[0] : '';
            const systemMsg = isCompany
                ? `📅 ${myName} wants to schedule a meeting with you. Please accept and set the date, time & location.`
                : `📅 Meeting requested for ${new Date(scheduledAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${locationDisplay ? ` at ${locationDisplay}` : ''}${notes ? ` — "${notes}"` : ''}. Awaiting approval.`;

            await setDoc(doc(db, 'chats', chatId), {
                participants: [user.id, targetUserId],
                lastMessage: systemMsg, lastMessageAt: serverTimestamp(),
                lastMessageSenderId: 'system',
                meetingStatus: isCompany ? 'REQUESTED' : 'PENDING_ACCEPTANCE',
                meetingId: meetingRef.id,
            }, { merge: true });

            await addDoc(collection(db, 'chats', chatId, 'messages'), {
                senderId: 'system', senderName: 'PlyShip',
                text: systemMsg, type: 'meeting_request',
                meetingId: meetingRef.id, createdAt: serverTimestamp(),
            });

            const otherUserId = user.id === companyId ? seekerId : companyId;
            createNotification(otherUserId, {
                type: 'meeting_scheduled', title: '📅 New Meeting Request',
                message: `${myName} wants to schedule a meeting with you`,
                data: { meetingId: meetingRef.id },
            });

            return { success: true, meetingId: meetingRef.id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, [user, getChatId]);

    // Accept a REQUESTED meeting and set date/time/location (Seeker only)
    const acceptAndScheduleMeeting = useCallback(async (meetingId, scheduledAt, location, notes = '') => {
        if (!user || !user.id) return { success: false, error: 'Not logged in' };

        try {
            const meetingRef = doc(db, 'meetings', meetingId);
            const meetingSnap = await getDoc(meetingRef);
            if (!meetingSnap.exists()) return { success: false, error: 'Meeting not found' };

            const meeting = meetingSnap.data();
            if (meeting.seekerId !== user.id) return { success: false, error: 'Only the seeker can accept and schedule' };
            if (meeting.status !== 'REQUESTED') return { success: false, error: 'This meeting has already been responded to' };

            // Check company wallet
            const MEETING_FEE = 500;
            const companyWalletSnap = await getDoc(doc(db, 'wallets', meeting.companyId));
            if (!companyWalletSnap.exists() || (companyWalletSnap.data().balance || 0) < MEETING_FEE) {
                return { success: false, error: 'Cannot accept — the company has insufficient funds.' };
            }

            const meetingOTP = String(Math.floor(100000 + Math.random() * 900000));

            await updateDoc(meetingRef, {
                status: 'SCHEDULED', acceptedBy: user.id,
                acceptedAt: new Date().toISOString(),
                scheduledAt, location: location || '', notes: notes || '',
                meetingOTP, updatedAt: new Date().toISOString(),
            });

            const chatId = getChatId(meeting.companyId, meeting.seekerId);
            await setDoc(doc(db, 'chats', chatId), { meetingStatus: 'SCHEDULED', meetingId }, { merge: true });

            const dateStr = new Date(scheduledAt).toLocaleDateString('en-IN', {
                weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
            });
            const locationStr = location ? ` at ${location}` : '';
            await addDoc(collection(db, 'chats', chatId, 'messages'), {
                senderId: 'system', senderName: 'PlyShip',
                text: `✅ Meeting accepted! Scheduled for ${dateStr}${locationStr}. OTP verification required upon meeting.`,
                type: 'meeting_update', createdAt: serverTimestamp(),
            });

            const seekerName = user.name || user.profile?.name || 'Seeker';
            createNotification(meeting.companyId, {
                type: 'meeting_accepted', title: '✅ Meeting Accepted!',
                message: `${seekerName} accepted — ${dateStr}${locationStr}`,
                data: { meetingId },
            });
            createNotification(meeting.seekerId, {
                type: 'meeting_otp', title: '🔐 Share OTP with Company',
                message: `Your meeting OTP is ${meetingOTP}. Share it after the meeting.`,
                data: { meetingId, otp: meetingOTP },
            });
            createNotification(meeting.companyId, {
                type: 'meeting_otp', title: '🔐 Collect OTP at Meeting',
                message: 'Ask the seeker for the 6-digit OTP when you meet.',
                data: { meetingId },
            });

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, [user, getChatId]);


    // Get all meetings for current user
    const getMeetings = useCallback(async () => {
        if (!user || !user.id) {
            return [];
        }

        try {
            const isCompany = user.role === 'COMPANY';
            const fieldToQuery = isCompany ? 'companyId' : 'seekerId';

            const q = query(
                collection(db, 'meetings'),
                where(fieldToQuery, '==', user.id)
            );

            const snapshot = await getDocs(q);
            const meetings = [];
            snapshot.forEach((d) => {
                meetings.push({ id: d.id, ...d.data() });
            });

            // Enrich meetings that are missing partner names
            const namesToFetch = new Map();
            meetings.forEach(m => {
                if (isCompany && !m.seekerName && m.seekerId) namesToFetch.set(m.seekerId, 'seekers');
                if (!isCompany && !m.companyName && m.companyId) namesToFetch.set(m.companyId, 'companies');
            });

            if (namesToFetch.size > 0) {
                const nameMap = {};
                await Promise.all(
                    Array.from(namesToFetch.entries()).map(async ([id, coll]) => {
                        try {
                            const snap = await getDoc(doc(db, coll, id));
                            if (snap.exists()) {
                                const d = snap.data();
                                nameMap[id] = d.profile?.companyName || d.profile?.name || d.name || '';
                            }
                        } catch (_) { }
                    })
                );
                meetings.forEach(m => {
                    if (isCompany && !m.seekerName && nameMap[m.seekerId]) m.seekerName = nameMap[m.seekerId];
                    if (!isCompany && !m.companyName && nameMap[m.companyId]) m.companyName = nameMap[m.companyId];
                });
            }

            // Sort by scheduledAt descending
            meetings.sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt));

            return meetings;
        } catch (error) {
            return [];
        }
    }, [user]);

    // Accept a meeting request (other party accepts)
    const acceptMeeting = useCallback(async (meetingId) => {
        if (!user || !user.id) {
            return { success: false, error: 'Not logged in' };
        }

        try {
            const meetingRef = doc(db, 'meetings', meetingId);
            const meetingSnap = await getDoc(meetingRef);

            if (!meetingSnap.exists()) {
                return { success: false, error: 'Meeting not found' };
            }

            const meeting = meetingSnap.data();

            // Check if user is part of this meeting
            if (meeting.companyId !== user.id && meeting.seekerId !== user.id) {
                return { success: false, error: 'Not authorized' };
            }

            // Check if meeting is pending acceptance
            if (meeting.status !== 'PENDING_ACCEPTANCE' && meeting.status !== 'REQUESTED') {
                return { success: false, error: 'Meeting already accepted or cancelled' };
            }

            // Check that the acceptor is not the requester
            if (meeting.requestedBy === user.id) {
                return { success: false, error: 'Cannot accept your own request' };
            }

            // Check if meeting time has already passed — can't accept expired meetings
            // Skip this check for REQUESTED meetings (no scheduledAt yet)
            if (meeting.scheduledAt) {
                const meetingTime = new Date(meeting.scheduledAt);
                if (meetingTime < new Date()) {
                    return { success: false, error: 'Meeting time has passed', expired: true };
                }
            }

            // Check if company has sufficient funds (₹500 required for meeting)
            const MEETING_FEE = 500;
            const companyId = meeting.companyId;
            const companyWalletRef = doc(db, 'wallets', companyId);
            const companyWalletSnap = await getDoc(companyWalletRef);

            if (companyWalletSnap.exists()) {
                const companyWallet = companyWalletSnap.data();
                if ((companyWallet.balance || 0) < MEETING_FEE) {
                    // If current user is the company, tell them to add funds
                    if (user.id === companyId) {
                        return {
                            success: false,
                            error: `Insufficient funds. You need ₹${MEETING_FEE} to accept this meeting. Please add funds to your wallet.`,
                            insufficientFunds: true,
                            required: MEETING_FEE,
                            current: companyWallet.balance || 0
                        };
                    }
                    // If seeker is trying to accept, the company doesn't have funds
                    return { success: false, error: 'Cannot accept meeting - waiting for company to add funds' };
                }
            } else {
                // Company has no wallet initialized
                if (user.id === companyId) {
                    return {
                        success: false,
                        error: `Please add ₹${MEETING_FEE} to your wallet before accepting meetings.`,
                        insufficientFunds: true,
                        required: MEETING_FEE,
                        current: 0
                    };
                }
                return { success: false, error: 'Cannot accept meeting - company wallet not initialized' };
            }

            // Generate a 6-digit OTP for meeting confirmation
            const meetingOTP = String(Math.floor(100000 + Math.random() * 900000));

            // Update meeting to SCHEDULED with OTP
            await updateDoc(meetingRef, {
                status: 'SCHEDULED',
                acceptedBy: user.id,
                acceptedAt: new Date().toISOString(),
                meetingOTP,
                updatedAt: new Date().toISOString(),
            });

            // Sync meeting status to chat doc
            const chatId = getChatId(meeting.companyId, meeting.seekerId);
            await setDoc(doc(db, 'chats', chatId), { meetingStatus: 'SCHEDULED', meetingId }, { merge: true });
            await addDoc(collection(db, 'chats', chatId, 'messages'), {
                senderId: 'system', senderName: 'PlyShip',
                text: '✅ Meeting accepted and scheduled! OTP verification required upon meeting.',
                type: 'meeting_update', createdAt: serverTimestamp(),
            });

            // Notify requester that meeting was accepted
            const otherPartyId = user.id === meeting.companyId ? meeting.seekerId : meeting.companyId;
            const myNameMeeting = user.name || user.profile?.companyName || user.profile?.name || 'Someone';
            createNotification(otherPartyId, {
                type: 'meeting_accepted',
                title: '✅ Meeting Accepted!',
                message: `${myNameMeeting} accepted your meeting request`,
                data: { meetingId },
            });

            // Notify seeker to share OTP with company
            createNotification(meeting.seekerId, {
                type: 'meeting_otp',
                title: '🔐 Share OTP with Company',
                message: `Your meeting OTP is ${meetingOTP}. Share it with the company when you meet.`,
                data: { meetingId, otp: meetingOTP },
            });

            // Notify company to collect OTP from seeker
            createNotification(meeting.companyId, {
                type: 'meeting_otp',
                title: '🔐 Collect OTP at Meeting',
                message: 'Ask the seeker for the 6-digit OTP when you meet, and enter it to confirm.',
                data: { meetingId },
            });

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, [user, getChatId]);

    // Request reschedule — company asks the seeker to pick a different date/time
    const requestRescheduleMeeting = useCallback(async (meetingId, reason = '') => {
        if (!user || !user.id) return { success: false, error: 'Not logged in' };

        try {
            const meetingRef = doc(db, 'meetings', meetingId);
            const meetingSnap = await getDoc(meetingRef);
            if (!meetingSnap.exists()) return { success: false, error: 'Meeting not found' };

            const meeting = meetingSnap.data();
            if (meeting.companyId !== user.id && meeting.seekerId !== user.id) {
                return { success: false, error: 'Not authorized' };
            }
            if (meeting.status !== 'PENDING_ACCEPTANCE') {
                return { success: false, error: 'Can only request reschedule for pending meetings' };
            }

            // Reset meeting back to REQUESTED so seeker can pick new date/time/location
            await updateDoc(meetingRef, {
                status: 'REQUESTED',
                scheduledAt: null,
                location: '',
                rescheduleReason: reason,
                rescheduleRequestedBy: user.id,
                rescheduleRequestedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

            // Update chat status
            const chatId = getChatId(meeting.companyId, meeting.seekerId);
            await setDoc(doc(db, 'chats', chatId), { meetingStatus: 'REQUESTED', meetingId }, { merge: true });

            // Send system message
            const myName = user.profile?.companyName || user.profile?.name || user.name || 'Company';
            const reasonText = reason ? ` — "${reason}"` : '';
            await addDoc(collection(db, 'chats', chatId, 'messages'), {
                senderId: 'system', senderName: 'PlyShip',
                text: `🔄 ${myName} requested a reschedule${reasonText}. Please pick a new date, time & location.`,
                type: 'meeting_update', createdAt: serverTimestamp(),
            });

            // Notify the seeker
            const otherPartyId = user.id === meeting.companyId ? meeting.seekerId : meeting.companyId;
            createNotification(otherPartyId, {
                type: 'meeting_reschedule_request',
                title: '🔄 Reschedule Requested',
                message: `${myName} requested a new date & time for the meeting${reasonText}`,
                data: { meetingId },
            });

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, [user, getChatId]);

    // Decline a meeting request
    const declineMeeting = useCallback(async (meetingId, reason = '') => {
        if (!user || !user.id) {
            return { success: false, error: 'Not logged in' };
        }

        try {
            const meetingRef = doc(db, 'meetings', meetingId);
            const meetingSnap = await getDoc(meetingRef);

            if (!meetingSnap.exists()) {
                return { success: false, error: 'Meeting not found' };
            }

            const meeting = meetingSnap.data();

            // Check if user is part of this meeting
            if (meeting.companyId !== user.id && meeting.seekerId !== user.id) {
                return { success: false, error: 'Not authorized' };
            }

            // Update meeting to DECLINED
            await updateDoc(meetingRef, {
                status: 'DECLINED',
                declinedBy: user.id,
                declineReason: reason,
                declinedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

            // Sync meeting status to chat doc
            const chatId = getChatId(meeting.companyId, meeting.seekerId);
            await setDoc(doc(db, 'chats', chatId), { meetingStatus: 'DECLINED', meetingId }, { merge: true });
            await addDoc(collection(db, 'chats', chatId, 'messages'), {
                senderId: 'system', senderName: 'PlyShip',
                text: `❌ Meeting declined${reason ? ': ' + reason : ''}.`,
                type: 'meeting_update', createdAt: serverTimestamp(),
            });

            // Notify the other party
            const otherPartyDecline = user.id === meeting.companyId ? meeting.seekerId : meeting.companyId;
            const myNameDecline = user.name || user.profile?.companyName || user.profile?.name || 'Someone';
            createNotification(otherPartyDecline, {
                type: 'meeting_declined',
                title: '❌ Meeting Declined',
                message: `${myNameDecline} declined the meeting request${reason ? ': ' + reason : ''}`,
                data: { meetingId },
            });

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, [user, getChatId]);

    // Cancel a scheduled meeting
    // options.silent = true skips chat notification (used during reschedule)
    const cancelMeeting = useCallback(async (meetingId, reason = '', options = {}) => {
        if (!user || !user.id) {
            return { success: false, error: 'Not logged in' };
        }

        try {
            const meetingRef = doc(db, 'meetings', meetingId);
            const meetingSnap = await getDoc(meetingRef);

            if (!meetingSnap.exists()) {
                return { success: false, error: 'Meeting not found' };
            }

            const meeting = meetingSnap.data();

            // Check if user is part of this meeting
            if (meeting.companyId !== user.id && meeting.seekerId !== user.id) {
                return { success: false, error: 'Not authorized' };
            }

            // Can cancel REQUESTED, PENDING_ACCEPTANCE or SCHEDULED meetings
            if (!['REQUESTED', 'PENDING_ACCEPTANCE', 'SCHEDULED'].includes(meeting.status)) {
                return { success: false, error: 'Cannot cancel this meeting' };
            }

            // DISPUTE DETECTION: If the other party already confirmed but this user
            // is cancelling/rescheduling, it means one says "we met" and the other says "we didn't"
            const isCompany = user.id === meeting.companyId;
            const otherConfirmed = isCompany ? meeting.seekerConfirmed : meeting.companyConfirmed;

            if (otherConfirmed) {
                // CONFLICT: Other party confirmed, this user is denying → DISPUTE
                await updateDoc(meetingRef, {
                    status: 'DISPUTE',
                    disputeReason: 'One party confirmed meeting, other party denied/rescheduled',
                    disputeConfirmedBy: isCompany ? meeting.seekerId : meeting.companyId,
                    disputeDeniedBy: user.id,
                    cancelReason: reason,
                    disputeAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });
                return { success: true, dispute: true };
            }

            await updateDoc(meetingRef, {
                status: 'CANCELLED',
                cancelledBy: user.id,
                cancelReason: reason,
                cancelledAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

            // Sync meeting status to chat doc (skip during silent reschedule)
            if (!options.silent) {
                const chatId = getChatId(meeting.companyId, meeting.seekerId);
                await setDoc(doc(db, 'chats', chatId), { meetingStatus: 'CANCELLED', meetingId }, { merge: true });
                await addDoc(collection(db, 'chats', chatId, 'messages'), {
                    senderId: 'system', senderName: 'PlyShip',
                    text: `🚫 Meeting cancelled${reason ? ': ' + reason : ''}.`,
                    type: 'meeting_update', createdAt: serverTimestamp(),
                });
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, [user, getChatId]);

    // Deny meeting (Not Met button) - only triggers DISPUTE if other party confirmed
    const denyMeeting = useCallback(async (meetingId) => {
        if (!user || !user.id) {
            return { success: false, error: 'Not logged in' };
        }

        try {
            const meetingRef = doc(db, 'meetings', meetingId);
            const meetingSnap = await getDoc(meetingRef);

            if (!meetingSnap.exists()) {
                return { success: false, error: 'Meeting not found' };
            }

            const meeting = meetingSnap.data();

            // Check if user is part of this meeting
            if (meeting.companyId !== user.id && meeting.seekerId !== user.id) {
                return { success: false, error: 'Not authorized' };
            }

            const isCompany = user.id === meeting.companyId;
            const denyField = isCompany ? 'companyDenied' : 'seekerDenied';
            const otherConfirmed = isCompany ? meeting.seekerConfirmed : meeting.companyConfirmed;
            const otherDenied = isCompany ? meeting.seekerDenied : meeting.companyDenied;

            if (otherConfirmed) {
                // CONTRADICTION: Other party said "We Met", this user says "Not Met" → DISPUTE
                await updateDoc(meetingRef, {
                    [denyField]: true,
                    status: 'DISPUTE',
                    disputeReason: 'One party confirmed meeting, other party denied',
                    disputeConfirmedBy: isCompany ? meeting.seekerId : meeting.companyId,
                    disputeDeniedBy: user.id,
                    disputeAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });
                return { success: true, dispute: true };
            }

            if (otherDenied) {
                // Both parties agree meeting didn't happen → CANCELLED
                await updateDoc(meetingRef, {
                    [denyField]: true,
                    status: 'CANCELLED',
                    cancelReason: 'Both parties confirmed meeting did not happen',
                    cancelledAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });
                return { success: true, bothDenied: true };
            }

            // Only this user denied so far — wait for other party
            await updateDoc(meetingRef, {
                [denyField]: true,
                updatedAt: new Date().toISOString(),
            });
            return { success: true, waitingForOther: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, [user]);

    // Reschedule a cancelled meeting
    const rescheduleMeeting = useCallback(async (meetingId, newScheduledAt, notes = '') => {
        if (!user || !user.id) {
            return { success: false, error: 'Not logged in' };
        }

        try {
            const meetingRef = doc(db, 'meetings', meetingId);
            const meetingSnap = await getDoc(meetingRef);

            if (!meetingSnap.exists()) {
                return { success: false, error: 'Meeting not found' };
            }

            const meeting = meetingSnap.data();

            // Check if user is part of this meeting
            if (meeting.companyId !== user.id && meeting.seekerId !== user.id) {
                return { success: false, error: 'Not authorized' };
            }

            // Can only reschedule cancelled, declined, or dispute meetings
            if (!['CANCELLED', 'DECLINED', 'DISPUTE'].includes(meeting.status)) {
                return { success: false, error: 'Can only reschedule cancelled or disputed meetings' };
            }

            // Create a new meeting request linked to the original — preserve location
            const meetingData = {
                companyId: meeting.companyId,
                seekerId: meeting.seekerId,
                requestedBy: user.id,
                acceptedBy: null,
                scheduledAt: newScheduledAt,
                location: meeting.location || '',  // Preserve original location
                notes: notes || meeting.notes,
                status: 'PENDING_ACCEPTANCE',
                companyConfirmed: false,
                seekerConfirmed: false,
                companyDenied: false,
                seekerDenied: false,
                paymentStatus: 'PENDING',
                rescheduledFrom: meetingId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            const newMeetingRef = await addDoc(collection(db, 'meetings'), meetingData);

            // Mark original as rescheduled
            await updateDoc(meetingRef, {
                rescheduledTo: newMeetingRef.id,
                updatedAt: new Date().toISOString(),
            });

            // Sync rescheduled status to chat doc
            const chatId = getChatId(meeting.companyId, meeting.seekerId);
            await setDoc(doc(db, 'chats', chatId), {
                meetingStatus: 'PENDING_ACCEPTANCE',
                meetingId: newMeetingRef.id,
                participants: [meeting.companyId, meeting.seekerId],
            }, { merge: true });

            // Send rescheduled system message
            const dateStr = new Date(newScheduledAt).toLocaleString('en-IN', {
                weekday: 'short', day: 'numeric', month: 'short',
                hour: '2-digit', minute: '2-digit',
            });
            await addDoc(collection(db, 'chats', chatId, 'messages'), {
                senderId: 'system', senderName: 'PlyShip',
                text: `🔄 Meeting rescheduled to ${dateStr}. Awaiting approval.`,
                type: 'meeting_update', createdAt: serverTimestamp(),
            });

            return { success: true, newMeetingId: newMeetingRef.id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, [user, getChatId]);

    // Process ₹500 payment from company — ₹250 to seeker, ₹250 to admin wallet (atomic transaction)
    const processMeetingPayment = useCallback(async (meetingId, companyId, seekerId) => {
        const MEETING_FEE = 500;
        const SEEKER_SHARE = 250;
        const ADMIN_SHARE = 250;
        const ADMIN_WALLET_ID = 'admin_wallet';

        try {
            const result = await runTransaction(db, async (transaction) => {
                // ===== ALL READS FIRST =====
                const companyWalletRef = doc(db, 'wallets', companyId);
                const seekerWalletRef = doc(db, 'wallets', seekerId);
                const adminWalletRef = doc(db, 'wallets', ADMIN_WALLET_ID);
                const meetingRef = doc(db, 'meetings', meetingId);

                const companyWalletSnap = await transaction.get(companyWalletRef);
                const seekerWalletSnap = await transaction.get(seekerWalletRef);
                const adminWalletSnap = await transaction.get(adminWalletRef);

                if (!companyWalletSnap.exists()) {
                    throw new Error('Company wallet not found. Please contact support.');
                }

                const companyWallet = companyWalletSnap.data();

                if (companyWallet.balance < MEETING_FEE) {
                    throw new Error('Insufficient balance');
                }

                const seekerWallet = seekerWalletSnap.exists()
                    ? seekerWalletSnap.data()
                    : { balance: 0, lockedBalance: 0, totalEarnings: 0 };

                const adminWallet = adminWalletSnap.exists()
                    ? adminWalletSnap.data()
                    : { balance: 0, totalEarnings: 0 };

                // ===== ALL WRITES AFTER =====

                // Create seeker wallet if it doesn't exist
                if (!seekerWalletSnap.exists()) {
                    transaction.set(seekerWalletRef, {
                        userId: seekerId,
                        type: 'SEEKER',
                        balance: 0,
                        lockedBalance: SEEKER_SHARE,
                        totalEarnings: SEEKER_SHARE,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    });
                } else {
                    // Credit seeker ₹250 (LOCKED)
                    transaction.update(seekerWalletRef, {
                        lockedBalance: (seekerWallet.lockedBalance || 0) + SEEKER_SHARE,
                        totalEarnings: (seekerWallet.totalEarnings || 0) + SEEKER_SHARE,
                        updatedAt: new Date().toISOString(),
                    });
                }

                // Create admin wallet if it doesn't exist
                if (!adminWalletSnap.exists()) {
                    transaction.set(adminWalletRef, {
                        userId: ADMIN_WALLET_ID,
                        type: 'ADMIN',
                        balance: ADMIN_SHARE,
                        totalEarnings: ADMIN_SHARE,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    });
                } else {
                    // Credit admin wallet ₹250
                    transaction.update(adminWalletRef, {
                        balance: (adminWallet.balance || 0) + ADMIN_SHARE,
                        totalEarnings: (adminWallet.totalEarnings || 0) + ADMIN_SHARE,
                        updatedAt: new Date().toISOString(),
                    });
                }

                // Debit company (full ₹500)
                transaction.update(companyWalletRef, {
                    balance: companyWallet.balance - MEETING_FEE,
                    totalSpent: (companyWallet.totalSpent || 0) + MEETING_FEE,
                    updatedAt: new Date().toISOString(),
                });

                // Update meeting status
                transaction.update(meetingRef, {
                    status: 'CONFIRMED',
                    paymentStatus: 'PROCESSED',
                    confirmedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });

                return { success: true };
            });

            // Log transactions in parallel (independent writes, no need to wait sequentially)
            const now = new Date().toISOString();
            await Promise.all([
                addDoc(collection(db, 'transactions'), {
                    userId: companyId,
                    type: 'DEBIT',
                    amount: MEETING_FEE,
                    reason: 'MEETING_FEE',
                    relatedMeetingId: meetingId,
                    relatedUserId: seekerId,
                    status: 'COMPLETED',
                    createdAt: now,
                }),
                addDoc(collection(db, 'transactions'), {
                    userId: seekerId,
                    type: 'LOCK',
                    amount: SEEKER_SHARE,
                    reason: 'MEETING_EARNINGS',
                    relatedMeetingId: meetingId,
                    relatedUserId: companyId,
                    status: 'COMPLETED',
                    createdAt: now,
                }),
                addDoc(collection(db, 'transactions'), {
                    userId: ADMIN_WALLET_ID,
                    type: 'CREDIT',
                    amount: ADMIN_SHARE,
                    reason: 'ADMIN_COMMISSION',
                    relatedMeetingId: meetingId,
                    relatedUserId: companyId,
                    status: 'COMPLETED',
                    createdAt: now,
                }),
            ]);

            // Sync CONFIRMED status to chat doc
            const chatId = getChatId(companyId, seekerId);
            await setDoc(doc(db, 'chats', chatId), { meetingStatus: 'CONFIRMED', meetingId }, { merge: true });
            await addDoc(collection(db, 'chats', chatId, 'messages'), {
                senderId: 'system', senderName: 'PlyShip',
                text: '✅ Meeting confirmed! Payment has been processed.',
                type: 'meeting_update', createdAt: serverTimestamp(),
            });

            // Notify both about payment
            createNotification(companyId, {
                type: 'wallet_debit',
                title: '💳 Meeting Payment',
                message: `₹${MEETING_FEE} debited for confirmed meeting`,
                data: { meetingId },
            });
            createNotification(seekerId, {
                type: 'wallet_credit',
                title: '💰 Earnings Received!',
                message: `₹${SEEKER_SHARE} added to your locked balance for the meeting`,
                data: { meetingId },
            });

            return { success: true, bothConfirmed: true, paymentProcessed: true };
        } catch (error) {
            // Mark payment as failed
            await updateDoc(doc(db, 'meetings', meetingId), {
                paymentStatus: 'FAILED',
                paymentError: error.message,
                updatedAt: new Date().toISOString(),
            });

            return {
                success: false,
                error: error.message,
                insufficientBalance: error.message === 'Insufficient balance'
            };
        }
    }, [getChatId]);

    // Confirm meeting happened (called by either party)
    const confirmMeeting = useCallback(async (meetingId) => {
        if (!user || !user.id) {
            return { success: false, error: 'Not logged in' };
        }

        try {
            const meetingRef = doc(db, 'meetings', meetingId);
            const meetingSnap = await getDoc(meetingRef);

            if (!meetingSnap.exists()) {
                return { success: false, error: 'Meeting not found' };
            }


            const meeting = meetingSnap.data();

            // Use ID comparison instead of role to avoid mismatches
            const isCompany = user.id === meeting.companyId;
            const confirmField = isCompany ? 'companyConfirmed' : 'seekerConfirmed';
            const otherDenied = isCompany ? meeting.seekerDenied : meeting.companyDenied;

            // Update confirmation
            await updateDoc(meetingRef, {
                [confirmField]: true,
                updatedAt: new Date().toISOString(),
            });

            // Check if other party DENIED → DISPUTE (contradiction)
            if (otherDenied) {
                await updateDoc(meetingRef, {
                    status: 'DISPUTE',
                    disputeReason: 'One party confirmed meeting, other party denied',
                    disputeConfirmedBy: user.id,
                    disputeDeniedBy: isCompany ? meeting.seekerId : meeting.companyId,
                    disputeAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });
                return { success: true, dispute: true };
            }

            // Check if both parties confirmed
            const otherConfirmField = isCompany ? 'seekerConfirmed' : 'companyConfirmed';
            const otherConfirmed = meeting[otherConfirmField];

            if (otherConfirmed) {
                // Both confirmed! Process payment
                const paymentResult = await processMeetingPayment(meetingId, meeting.companyId, meeting.seekerId);
                return paymentResult;
            }

            return { success: true, bothConfirmed: false };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, [user, processMeetingPayment]);

    // Verify OTP entered by company to confirm meeting happened
    const verifyMeetingOTP = useCallback(async (meetingId, enteredOTP) => {
        if (!user || !user.id) {
            return { success: false, error: 'Not logged in' };
        }

        try {
            const meetingRef = doc(db, 'meetings', meetingId);
            const meetingSnap = await getDoc(meetingRef);

            if (!meetingSnap.exists()) {
                return { success: false, error: 'Meeting not found' };
            }

            const meeting = meetingSnap.data();

            // Only the company should verify OTP
            if (meeting.companyId !== user.id) {
                return { success: false, error: 'Only the company can verify the meeting OTP' };
            }

            // Verify OTP
            if (String(enteredOTP).trim() !== String(meeting.meetingOTP)) {
                return { success: false, error: 'Incorrect OTP. Please check the code with the seeker.', wrongOTP: true };
            }

            // OTP matches! Process payment
            const paymentResult = await processMeetingPayment(meetingId, meeting.companyId, meeting.seekerId);
            return paymentResult;
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, [user, processMeetingPayment]);

    // ============ WITHDRAWAL FUNCTIONS ============

    // Request a withdrawal (creates a record for admin tracking)
    const requestWithdrawal = useCallback(async (amount) => {
        if (!user || !user.id) {
            return { success: false, error: 'Not logged in' };
        }

        try {
            const walletRef = doc(db, 'wallets', user.id);
            const walletSnap = await getDoc(walletRef);

            if (!walletSnap.exists()) {
                return { success: false, error: 'Wallet not found' };
            }

            const wallet = walletSnap.data();

            if ((wallet.balance || 0) < amount) {
                return { success: false, error: 'Insufficient balance' };
            }

            const isCompany = user.role === 'COMPANY';
            const minWithdrawal = isCompany ? 500 : 250;

            if (amount < minWithdrawal) {
                return { success: false, error: `Minimum withdrawal is ₹${minWithdrawal}` };
            }

            // Create withdrawal record (role-aware)
            const withdrawalData = {
                userId: user.id,
                userRole: user.role,
                ...(isCompany ? {
                    companyId: user.id,
                    companyName: user.profile?.companyName || user.email || 'Unknown',
                    companyEmail: user.email || '',
                    companyPhone: user.profile?.phone || '',
                } : {
                    seekerId: user.id,
                    seekerName: user.profile?.name || user.email || 'Unknown',
                    seekerEmail: user.email || '',
                    seekerPhone: user.profile?.phone || '',
                }),
                amount,
                walletBalance: wallet.balance || 0,
                status: 'PENDING',
                requestedAt: new Date().toISOString(),
                processedAt: null,
                adminNote: '',
            };

            await addDoc(collection(db, 'withdrawals'), withdrawalData);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, [user]);

    // Get withdrawal requests for the current user
    const getWithdrawals = useCallback(async () => {
        if (!user || !user.id) return [];
        try {
            const q = query(
                collection(db, 'withdrawals'),
                where('userId', '==', user.id)
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (error) {
            console.error('Error fetching withdrawals:', error);
            return [];
        }
    }, [user]);

    // ============ PROJECT FUNCTIONS ============

    // Create a project request (either seeker or company can request)
    const createProject = useCallback(async (targetUserId, projectDetails = {}) => {
        if (!user || !user.id) {
            return { success: false, error: 'Not logged in' };
        }

        try {
            // Determine seekerId and companyId based on who's requesting
            const isCompany = user.role === 'COMPANY';
            const companyId = isCompany ? user.id : targetUserId;
            const seekerId = isCompany ? targetUserId : user.id;

            const projectData = {
                seekerId,
                companyId,
                requestedBy: user.id,  // Track who initiated the request
                status: 'PENDING_ACCEPTANCE',
                description: projectDetails.description || '',
                budgetRange: projectDetails.budgetRange || '',
                advanceAmount: null,
                advanceDate: null,
                advanceProofUrl: null,
                seekerConfirmedAdvance: false,
                companyConfirmedAdvance: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            const projectRef = await addDoc(collection(db, 'projects'), projectData);
            return { success: true, projectId: projectRef.id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, [user]);

    // Get all projects for current user
    const getProjects = useCallback(async () => {
        if (!user || !user.id) {
            return [];
        }

        try {
            const isCompany = user.role === 'COMPANY';
            const fieldToQuery = isCompany ? 'companyId' : 'seekerId';

            // Query without orderBy to avoid needing composite index
            const q = query(
                collection(db, 'projects'),
                where(fieldToQuery, '==', user.id)
            );

            const snapshot = await getDocs(q);
            const projects = [];
            snapshot.forEach((docSnap) => {
                projects.push({ id: docSnap.id, ...docSnap.data() });
            });

            // Sort by createdAt descending in JavaScript
            projects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            return projects;
        } catch (error) {
            return [];
        }
    }, [user]);

    // Accept a project request (non-requester accepts)
    const acceptProject = useCallback(async (projectId) => {
        if (!user || !user.id) {
            return { success: false, error: 'Not logged in' };
        }

        try {
            const projectRef = doc(db, 'projects', projectId);
            const projectSnap = await getDoc(projectRef);

            if (!projectSnap.exists()) {
                return { success: false, error: 'Project not found' };
            }

            const project = projectSnap.data();

            // Check if user is part of this project
            if (project.companyId !== user.id && project.seekerId !== user.id) {
                return { success: false, error: 'You are not part of this project' };
            }

            // Can't accept your own request
            if (project.requestedBy === user.id) {
                return { success: false, error: 'Cannot accept your own request' };
            }

            if (project.status !== 'PENDING_ACCEPTANCE') {
                return { success: false, error: 'Project is not pending acceptance' };
            }

            // Update project status and unlock seeker wallet for withdrawals
            await updateDoc(projectRef, {
                status: 'ACCEPTED',
                acceptedBy: user.id,
                acceptedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

            // Unlock seeker's wallet for withdrawals - move lockedBalance to balance
            const seekerWalletRef = doc(db, 'wallets', project.seekerId);
            const seekerWalletSnap = await getDoc(seekerWalletRef);
            if (seekerWalletSnap.exists()) {
                const walletData = seekerWalletSnap.data();
                const lockedAmount = walletData.lockedBalance || 0;
                const currentBalance = walletData.balance || 0;

                await updateDoc(seekerWalletRef, {
                    isLocked: false,
                    balance: currentBalance + lockedAmount, // Move locked funds to available
                    lockedBalance: 0, // Clear locked balance
                    unlockedAt: new Date().toISOString(),
                    unlockedBy: projectId,
                });
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, [user]);

    // Decline a project request
    const declineProject = useCallback(async (projectId) => {
        if (!user || !user.id) {
            return { success: false, error: 'Not logged in' };
        }

        try {
            const projectRef = doc(db, 'projects', projectId);
            const projectSnap = await getDoc(projectRef);

            if (!projectSnap.exists()) {
                return { success: false, error: 'Project not found' };
            }

            const project = projectSnap.data();

            // Check if user is part of this project
            if (project.companyId !== user.id && project.seekerId !== user.id) {
                return { success: false, error: 'You are not part of this project' };
            }

            // Can't decline your own request
            if (project.requestedBy === user.id) {
                return { success: false, error: 'Cannot decline your own request' };
            }

            if (project.status !== 'PENDING_ACCEPTANCE') {
                return { success: false, error: 'Project is not pending acceptance' };
            }

            await updateDoc(projectRef, {
                status: 'DECLINED',
                declinedBy: user.id,
                declinedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, [user]);

    // Seeker records advance payment
    const recordAdvancePayment = useCallback(async (projectId, amount, paymentDate, proofUrl) => {
        if (!user || !user.id) {
            return { success: false, error: 'Not logged in' };
        }

        if (user.role !== 'SEEKER') {
            return { success: false, error: 'Only seekers can record advance payments' };
        }

        try {
            const projectRef = doc(db, 'projects', projectId);
            const projectSnap = await getDoc(projectRef);

            if (!projectSnap.exists()) {
                return { success: false, error: 'Project not found' };
            }

            const project = projectSnap.data();
            if (project.seekerId !== user.id) {
                return { success: false, error: 'This is not your project' };
            }

            if (project.status !== 'ACCEPTED') {
                return { success: false, error: 'Project must be accepted before recording payment' };
            }

            await updateDoc(projectRef, {
                status: 'ADVANCE_RECORDED',
                advanceAmount: amount,
                advanceDate: paymentDate,
                advanceProofUrl: proofUrl,
                seekerConfirmedAdvance: true,
                updatedAt: new Date().toISOString(),
            });

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, [user]);

    // Company confirms receiving advance payment (triggers unlock)
    const confirmAdvancePayment = useCallback(async (projectId) => {
        if (!user || !user.id) {
            return { success: false, error: 'Not logged in' };
        }

        if (user.role !== 'COMPANY') {
            return { success: false, error: 'Only companies can confirm advance payments' };
        }

        try {
            const projectRef = doc(db, 'projects', projectId);
            const projectSnap = await getDoc(projectRef);

            if (!projectSnap.exists()) {
                return { success: false, error: 'Project not found' };
            }

            const project = projectSnap.data();
            if (project.companyId !== user.id) {
                return { success: false, error: 'This project is not assigned to you' };
            }

            if (project.status !== 'ADVANCE_RECORDED') {
                return { success: false, error: 'Advance payment must be recorded first' };
            }

            // Use transaction to update project and unlock earnings atomically
            await runTransaction(db, async (transaction) => {
                // Update project status
                transaction.update(projectRef, {
                    status: 'CONFIRMED',
                    companyConfirmedAdvance: true,
                    confirmedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });

                // Unlock seeker's earnings
                const seekerId = project.seekerId;
                const seekerWalletRef = doc(db, 'wallets', seekerId);
                const seekerWalletSnap = await transaction.get(seekerWalletRef);

                if (seekerWalletSnap.exists()) {
                    const seekerWallet = seekerWalletSnap.data();
                    const lockedBalance = seekerWallet.lockedBalance || 0;

                    // Move all locked balance to available balance
                    transaction.update(seekerWalletRef, {
                        balance: (seekerWallet.balance || 0) + lockedBalance,
                        lockedBalance: 0,
                        updatedAt: new Date().toISOString(),
                    });

                }
            });

            // Log the unlock transaction with the actual unlocked amount
            const project2 = (await getDoc(projectRef)).data();
            const seekerWalletAfter = await getDoc(doc(db, 'wallets', project2.seekerId));
            const unlockedAmount = seekerWalletAfter.exists() ? (seekerWalletAfter.data().balance || 0) : 0;
            await addDoc(collection(db, 'transactions'), {
                userId: project2.seekerId,
                type: 'UNLOCK',
                amount: unlockedAmount,
                reason: 'PROJECT_CONFIRMED',
                relatedProjectId: projectId,
                relatedUserId: user.id,
                status: 'COMPLETED',
                createdAt: new Date().toISOString(),
            });

            return { success: true, earningsUnlocked: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, [user]);

    // ============ REVIEW FUNCTIONS ============

    // Submit a review for a company (called by seeker) — one review per seeker per company, overrides if exists
    const submitReview = useCallback(async (companyId, type, rating, comment, relatedId = null) => {
        if (!user || !user.id || user.role !== 'SEEKER') {
            return { success: false, error: 'Only seekers can submit reviews' };
        }

        try {
            // Use a deterministic ID so each seeker gets exactly ONE review per company
            const reviewId = `${user.id}_${companyId}`;
            const reviewRef = doc(db, 'reviews', reviewId);

            const reviewData = {
                companyId,
                seekerId: user.id,
                seekerName: user.profile?.name || user.name || 'Anonymous',
                type, // 'MEETING' or 'PROJECT'
                rating: Math.min(5, Math.max(1, rating)), // Ensure 1-5 range
                comment: comment || '',
                relatedId, // meetingId or projectId
                updatedAt: new Date().toISOString(),
            };

            // Check if review already exists (for createdAt preservation)
            const existingSnap = await getDoc(reviewRef);
            if (existingSnap.exists()) {
                // Update existing — preserve createdAt
                await updateDoc(reviewRef, reviewData);
                return { success: true, reviewId, updated: true };
            } else {
                // Create new
                reviewData.createdAt = new Date().toISOString();
                await setDoc(reviewRef, reviewData);
                return { success: true, reviewId, updated: false };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, [user]);

    // Get all reviews for a company
    const getCompanyReviews = useCallback(async (companyId) => {
        try {
            const q = query(
                collection(db, 'reviews'),
                where('companyId', '==', companyId)
            );

            const snapshot = await getDocs(q);
            const reviews = [];
            snapshot.forEach((docSnap) => {
                reviews.push({ id: docSnap.id, ...docSnap.data() });
            });

            // Sort by createdAt descending
            reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            return reviews;
        } catch (error) {
            return [];
        }
    }, []);

    // Check if seeker has already reviewed a specific meeting/project
    const hasReviewed = useCallback(async (companyId, type, relatedId) => {
        if (!user || !user.id) return false;

        try {
            const q = query(
                collection(db, 'reviews'),
                where('seekerId', '==', user.id),
                where('companyId', '==', companyId),
                where('type', '==', type)
            );

            const snapshot = await getDocs(q);
            // Check if any review matches the relatedId
            const existing = snapshot.docs.find(doc => doc.data().relatedId === relatedId);
            return !!existing;
        } catch (error) {
            return false;
        }
    }, [user]);

    // ============ ACCOUNT FUNCTIONS ============

    // Admin impersonation — view the app as another user
    const impersonateUser = async (targetUserId) => {
        try {
            // Save current admin user
            adminUserRef.current = { ...user };

            // Try seekers first
            let userDoc = await getDoc(doc(db, 'seekers', targetUserId));
            if (userDoc.exists()) {
                const userData = { id: targetUserId, ...userDoc.data() };
                setUser(userData);
                setIsImpersonating(true);
                return { success: true };
            }

            // Try companies
            userDoc = await getDoc(doc(db, 'companies', targetUserId));
            if (userDoc.exists()) {
                const userData = { id: targetUserId, ...userDoc.data() };
                setUser(userData);
                setIsImpersonating(true);
                return { success: true };
            }

            return { success: false, error: 'User not found in Firestore' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const exitImpersonation = () => {
        if (adminUserRef.current) {
            setUser(adminUserRef.current);
            adminUserRef.current = null;
            setIsImpersonating(false);
        }
    };

    // Delete account and all associated data (requires password for reauthentication)
    const deleteAccount = async (password) => {
        if (!user || !user.id) {
            return { success: false, error: 'Not logged in' };
        }

        try {
            const userId = user.id;

            // 1. Delete all chats and their messages
            // Chats use 'participants' array, not user1Id/user2Id
            const chatsQuery = query(collection(db, 'chats'), where('participants', 'array-contains', userId));
            const chatsSnap = await getDocs(chatsQuery);

            for (const chatDoc of chatsSnap.docs) {
                // Delete all messages in this chat
                const messagesSnap = await getDocs(collection(db, 'chats', chatDoc.id, 'messages'));
                for (const msgDoc of messagesSnap.docs) {
                    await deleteDoc(doc(db, 'chats', chatDoc.id, 'messages', msgDoc.id));
                }
                // Delete the chat
                await deleteDoc(doc(db, 'chats', chatDoc.id));
            }
            // 2. Delete all matches (subcollection pattern: matches/{userId}/matched)
            const matchedSnap = await getDocs(collection(db, 'matches', userId, 'matched'));
            for (const matchDoc of matchedSnap.docs) {
                // Also delete the reciprocal match from the other user's subcollection
                const otherUserId = matchDoc.id;
                await deleteDoc(doc(db, 'matches', otherUserId, 'matched', userId)).catch(() => {});
                await deleteDoc(doc(db, 'matches', userId, 'matched', otherUserId));
            }
            // 3. Delete all meetings
            const meetingsQuery1 = query(collection(db, 'meetings'), where('companyId', '==', userId));
            const meetingsQuery2 = query(collection(db, 'meetings'), where('seekerId', '==', userId));

            const meetings1 = await getDocs(meetingsQuery1);
            const meetings2 = await getDocs(meetingsQuery2);

            for (const meetingDoc of [...meetings1.docs, ...meetings2.docs]) {
                await deleteDoc(doc(db, 'meetings', meetingDoc.id));
            }
            // 4. Delete all projects
            const projectsQuery1 = query(collection(db, 'projects'), where('companyId', '==', userId));
            const projectsQuery2 = query(collection(db, 'projects'), where('seekerId', '==', userId));

            const projects1 = await getDocs(projectsQuery1);
            const projects2 = await getDocs(projectsQuery2);

            for (const projectDoc of [...projects1.docs, ...projects2.docs]) {
                await deleteDoc(doc(db, 'projects', projectDoc.id));
            }
            // 5. Delete transactions
            const transactionsQuery = query(collection(db, 'transactions'), where('userId', '==', userId));
            const transactions = await getDocs(transactionsQuery);
            for (const txDoc of transactions.docs) {
                await deleteDoc(doc(db, 'transactions', txDoc.id));
            }
            // 6. Delete wallet
            const walletRef = doc(db, 'wallets', userId);
            const walletSnap = await getDoc(walletRef);
            if (walletSnap.exists()) {
                await deleteDoc(walletRef);
            }
            // 7. Delete all likes (subcollection pattern: likes/{userId}/incoming & outgoing)
            const incomingLikes = await getDocs(collection(db, 'likes', userId, 'incoming'));
            for (const likeDoc of incomingLikes.docs) {
                // Also clean up the other user's outgoing like
                await deleteDoc(doc(db, 'likes', likeDoc.id, 'outgoing', userId)).catch(() => {});
                await deleteDoc(doc(db, 'likes', userId, 'incoming', likeDoc.id));
            }
            const outgoingLikes = await getDocs(collection(db, 'likes', userId, 'outgoing'));
            for (const likeDoc of outgoingLikes.docs) {
                // Also clean up the other user's incoming like
                await deleteDoc(doc(db, 'likes', likeDoc.id, 'incoming', userId)).catch(() => {});
                await deleteDoc(doc(db, 'likes', userId, 'outgoing', likeDoc.id));
            }
            // 8. Delete all passes (subcollection pattern: passes/{userId}/passed)
            const passedSnap = await getDocs(collection(db, 'likes', userId, 'passed'));
            for (const passDoc of passedSnap.docs) {
                await deleteDoc(doc(db, 'passes', userId, 'passed', passDoc.id));
            }
            // 9. Delete notifications (subcollection: notifications/{userId}/items)
            const notifSnap = await getDocs(collection(db, 'notifications', userId, 'items'));
            for (const notifDoc of notifSnap.docs) {
                await deleteDoc(doc(db, 'notifications', userId, 'items', notifDoc.id));
            }
            // 10. Delete withdrawal requests
            const withdrawalsQuery = query(collection(db, 'withdrawals'), where('userId', '==', userId));
            const withdrawals = await getDocs(withdrawalsQuery);
            for (const wDoc of withdrawals.docs) {
                await deleteDoc(doc(db, 'withdrawals', wDoc.id));
            }
            // 11. Delete reviews by this user
            const reviewsQuery = query(collection(db, 'reviews'), where('seekerId', '==', userId));
            const reviews = await getDocs(reviewsQuery);
            for (const rDoc of reviews.docs) {
                await deleteDoc(doc(db, 'reviews', rDoc.id));
            }
            // 12. Delete all storage files (profile images, portfolio, etc.)
            await deleteUserStorage(userId);

            // 13. Delete user profile document from correct collection (seekers or companies)
            const userRole = user.role;
            const profileCollection = userRole === 'COMPANY' ? 'companies' : 'seekers';
            const profileRef = doc(db, profileCollection, userId);
            const profileSnap = await getDoc(profileRef);
            if (profileSnap.exists()) {
                await deleteDoc(profileRef);
            }
            // 10. Delete Firebase Auth account
            const currentUser = auth.currentUser;
            if (currentUser) {
                await currentUser.delete();
            }

            // Clear local state
            setUser(null);
            router.push('/login');

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const logout = async () => {
        try {
            isOnboarding.current = false;
            localStorage.removeItem('onboardingRole');
            await signOut(auth);
            setUser(null);
            router.push('/login');
        } catch (error) {
        }
    };

    // ============ IN-APP NOTIFICATIONS ============

    // Create a notification for a user
    const createNotification = useCallback(async (targetUserId, { type, title, message, data = {} }) => {
        try {
            await addDoc(collection(db, 'notifications', targetUserId, 'items'), {
                type,
                title,
                message,
                data,
                read: false,
                createdAt: new Date().toISOString(),
            });
        } catch (error) {
        }
    }, []);

    // Get all notifications for current user
    const getNotifications = useCallback(async () => {
        if (!user || !user.id) return [];
        try {
            const snap = await getDocs(
                query(
                    collection(db, 'notifications', user.id, 'items'),
                    orderBy('createdAt', 'desc')
                )
            );
            const notifs = [];
            snap.forEach((d) => notifs.push({ id: d.id, ...d.data() }));
            return notifs;
        } catch (error) {
            return [];
        }
    }, [user]);

    // Mark all notifications as read
    const markNotificationsRead = useCallback(async () => {
        if (!user || !user.id) return;
        try {
            const snap = await getDocs(
                query(
                    collection(db, 'notifications', user.id, 'items'),
                    where('read', '==', false)
                )
            );
            const batch = [];
            snap.forEach((d) => {
                batch.push(updateDoc(doc(db, 'notifications', user.id, 'items', d.id), { read: true }));
            });
            await Promise.all(batch);
        } catch (error) {
        }
    }, [user]);

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            sendOTP,
            loginVerifyOTP,
            signupWithPhone,
            completeSignup,
            selectRole,
            completeProfile,
            getSwipeProfiles,
            getAllUsers,
            likeProfile,
            passProfile,
            getMatches,
            getIncomingLikes,
            acceptMatch,
            refuseMatch,
            getChatId,
            sendMessage,
            getChats,
            getUnreadCount,
            initializeWallet,
            getWallet,
            getTransactions,
            addTransaction,
            topUpWallet,
            requestWithdrawal,
            getWithdrawals,
            scheduleMeeting,
            acceptAndScheduleMeeting,
            getMeetings,
            acceptMeeting,
            declineMeeting,
            cancelMeeting,
            denyMeeting,
            rescheduleMeeting,
            requestRescheduleMeeting,
            recoverPendingPayments,
            confirmMeeting,
            verifyMeetingOTP,
            createProject,
            getProjects,
            acceptProject,
            declineProject,
            recordAdvancePayment,
            confirmAdvancePayment,
            submitReview,
            getCompanyReviews,
            hasReviewed,
            deleteAccount,
            createNotification,
            getNotifications,
            markNotificationsRead,
            impersonateUser,
            exitImpersonation,
            isImpersonating,
            updateUsername,
            logout
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
