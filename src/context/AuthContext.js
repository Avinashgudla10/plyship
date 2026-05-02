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
            const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
            confirmationResultRef.current = confirmationResult;
            return { success: true };
        } catch (error) {
            // Reset recaptcha on error
            if (recaptchaVerifierRef.current) {
                recaptchaVerifierRef.current.clear();
                recaptchaVerifierRef.current = null;
            }
            return { success: false, error: error.message };
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
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const selectRole = (role) => {
        if (!user) {
            return;
        }
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

        const updatedUser = {
            email: user.email,
            phone: userPhone,
            name: profileData.name || profileData.companyName || user.name,
            role: user.role,
            profileComplete: true,
            profile: cleanedProfile,
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

            // Clear onboarding flag - profile is complete
            isOnboarding.current = false;

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
            // Fetch liked, passed, and meeting users in parallel
            const [likedUsersSnapshot, passedUsersSnapshot, meetingsSnapshot] = await Promise.all([
                getDocs(collection(db, 'likes', user.id, 'outgoing')),
                getDocs(collection(db, 'passes', user.id, 'passed')),
                getDocs(query(
                    collection(db, 'meetings'),
                    where(user.role === 'COMPANY' ? 'companyId' : 'seekerId', '==', user.id)
                )),
            ]);
            const likedUserIds = new Set();
            likedUsersSnapshot.forEach((doc) => {
                likedUserIds.add(doc.id);
            });

            const passedUserIds = new Set();
            passedUsersSnapshot.forEach((doc) => {
                passedUserIds.add(doc.id);
            });

            // Collect partner IDs from active meetings
            const meetingUserIds = new Set();
            meetingsSnapshot.forEach((d) => {
                const m = d.data();
                // Exclude partners from any non-terminal meeting
                if (!['CANCELLED', 'DECLINED'].includes(m.status)) {
                    const partnerId = user.role === 'COMPANY' ? m.seekerId : m.companyId;
                    if (partnerId) meetingUserIds.add(partnerId);
                }
            });

            // Seekers see Companies, Companies see Seekers
            const collectionName = user.role === 'SEEKER' ? 'companies' : 'seekers';

            const q = query(
                collection(db, collectionName),
                where('profileComplete', '==', true)
            );

            const querySnapshot = await getDocs(q);
            const profiles = [];

            querySnapshot.forEach((doc) => {
                // Don't include self, already liked, passed, or meeting users
                if (doc.id !== user.id && !likedUserIds.has(doc.id) && !passedUserIds.has(doc.id) && !meetingUserIds.has(doc.id)) {
                    profiles.push({ id: doc.id, ...doc.data() });
                }
            });

            // City-based matching: same-city profiles appear first
            const userCity = (user.profile?.city || '').trim().toLowerCase();

            profiles.sort((a, b) => {
                const aCity = (a.profile?.city || a.city || '').trim().toLowerCase();
                const bCity = (b.profile?.city || b.city || '').trim().toLowerCase();
                const aSameCity = userCity && aCity === userCity ? 1 : 0;
                const bSameCity = userCity && bCity === userCity ? 1 : 0;

                // Same-city profiles come first
                if (aSameCity !== bSameCity) return bSameCity - aSameCity;

                // Within same group, sort by lastActiveAt descending
                const aTime = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
                const bTime = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
                return bTime - aTime;
            });

            const sameCityCount = profiles.filter(p => {
                const pCity = (p.profile?.city || p.city || '').trim().toLowerCase();
                return userCity && pCity === userCity;
            }).length;
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
    const sendMessage = useCallback(async (otherUserId, messageText) => {
        if (!user || !user.id || !messageText.trim()) {
            return { success: false };
        }

        const chatId = getChatId(user.id, otherUserId);
        try {
            // Add message to the messages subcollection
            await addDoc(collection(db, 'chats', chatId, 'messages'), {
                senderId: user.id,
                senderName: user.name || user.profile?.companyName || user.profile?.name,
                text: messageText.trim(),
                createdAt: serverTimestamp(),
            });

            // Update chat metadata
            await setDoc(doc(db, 'chats', chatId), {
                participants: [user.id, otherUserId],
                lastMessage: messageText.trim(),
                lastMessageAt: serverTimestamp(),
                lastMessageSenderId: user.id,
            }, { merge: true });

            // Notify recipient about new message (fire-and-forget)
            const senderName = user.name || user.profile?.companyName || user.profile?.name || 'Someone';
            createNotification(otherUserId, {
                type: 'message',
                title: '💬 New Message',
                message: `${senderName}: ${messageText.trim().substring(0, 50)}${messageText.trim().length > 50 ? '...' : ''}`,
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

    // ============ MEETING FUNCTIONS ============

    // Schedule a meeting with a match (creates a request that needs acceptance)
    const scheduleMeeting = useCallback(async (targetUserId, scheduledAt, notes = '') => {
        if (!user || !user.id) {
            return { success: false, error: 'Not logged in' };
        }

        try {
            // Determine who is company and who is seeker
            const isCompany = user.role === 'COMPANY';
            const companyId = isCompany ? user.id : targetUserId;
            const seekerId = isCompany ? targetUserId : user.id;

            // Fetch target user's name for display
            let targetName = '';
            try {
                const targetRole = isCompany ? 'seekers' : 'companies';
                const { getDoc: gd, doc: d } = await import('firebase/firestore');
                const targetSnap = await gd(d(db, targetRole, targetUserId));
                if (targetSnap.exists()) {
                    const td = targetSnap.data();
                    targetName = td.profile?.name || td.profile?.companyName || td.name || '';
                }
            } catch (e) { /* ignore lookup errors */ }

            const myName = user.profile?.companyName || user.profile?.name || user.name || '';

            // Create meeting document with PENDING_ACCEPTANCE status
            const meetingData = {
                companyId,
                seekerId,
                companyName: isCompany ? myName : targetName,
                seekerName: isCompany ? targetName : myName,
                requestedBy: user.id,
                acceptedBy: null,
                scheduledAt,
                notes,
                status: 'PENDING_ACCEPTANCE',  // Needs other party to accept
                companyConfirmed: false,
                seekerConfirmed: false,
                companyDenied: false,
                seekerDenied: false,
                paymentStatus: 'PENDING',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            const meetingRef = await addDoc(collection(db, 'meetings'), meetingData);
            // Auto-create chat with meeting request system message
            const chatId = getChatId(user.id, targetUserId);
            const meetingDateStr = new Date(scheduledAt).toLocaleDateString('en-IN', {
                weekday: 'short', day: 'numeric', month: 'short',
                hour: '2-digit', minute: '2-digit',
            });
            const systemMsg = `📅 Meeting requested for ${meetingDateStr}${notes ? ` — "${notes}"` : ''}. Awaiting approval.`;

            // Create/update chat doc
            await setDoc(doc(db, 'chats', chatId), {
                participants: [user.id, targetUserId],
                lastMessage: systemMsg,
                lastMessageAt: serverTimestamp(),
                lastMessageSenderId: 'system',
                meetingStatus: 'PENDING_ACCEPTANCE',
                meetingId: meetingRef.id,
            }, { merge: true });

            // Add system message to chat
            await addDoc(collection(db, 'chats', chatId, 'messages'), {
                senderId: 'system',
                senderName: 'PlyShip',
                text: systemMsg,
                type: 'meeting_request',
                meetingId: meetingRef.id,
                createdAt: serverTimestamp(),
            });

            // Notify the other party about the meeting request
            const otherUserId = user.id === companyId ? seekerId : companyId;
            const myName3 = user.name || user.profile?.companyName || user.profile?.name || 'Someone';
            createNotification(otherUserId, {
                type: 'meeting_scheduled',
                title: '📅 New Meeting Request',
                message: `${myName3} wants to schedule a meeting with you`,
                data: { meetingId: meetingRef.id },
            });

            return { success: true, meetingId: meetingRef.id };
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
            if (meeting.status !== 'PENDING_ACCEPTANCE') {
                return { success: false, error: 'Meeting already accepted or cancelled' };
            }

            // Check that the acceptor is not the requester
            if (meeting.requestedBy === user.id) {
                return { success: false, error: 'Cannot accept your own request' };
            }

            // Check if meeting time has already passed - can't accept expired meetings
            const meetingTime = new Date(meeting.scheduledAt);
            if (meetingTime < new Date()) {
                return { success: false, error: 'Meeting time has passed', expired: true };
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

            // Notify company to share OTP with seeker
            createNotification(meeting.companyId, {
                type: 'meeting_otp',
                title: '🔐 Share OTP with Seeker',
                message: `Your meeting OTP is ${meetingOTP}. Share it with the seeker when you meet.`,
                data: { meetingId, otp: meetingOTP },
            });

            // Notify seeker to collect OTP from company
            createNotification(meeting.seekerId, {
                type: 'meeting_otp',
                title: '🔐 Collect OTP at Meeting',
                message: 'Ask the company for the 6-digit OTP when you meet, and enter it to confirm.',
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
    const cancelMeeting = useCallback(async (meetingId, reason = '') => {
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

            // Can cancel PENDING_ACCEPTANCE or SCHEDULED meetings
            if (!['PENDING_ACCEPTANCE', 'SCHEDULED'].includes(meeting.status)) {
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

            // Sync meeting status to chat doc
            const chatId = getChatId(meeting.companyId, meeting.seekerId);
            await setDoc(doc(db, 'chats', chatId), { meetingStatus: 'CANCELLED', meetingId }, { merge: true });
            await addDoc(collection(db, 'chats', chatId, 'messages'), {
                senderId: 'system', senderName: 'PlyShip',
                text: `🚫 Meeting cancelled${reason ? ': ' + reason : ''}.`,
                type: 'meeting_update', createdAt: serverTimestamp(),
            });

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

            // Create a new meeting request linked to the original
            const meetingData = {
                companyId: meeting.companyId,
                seekerId: meeting.seekerId,
                requestedBy: user.id,
                acceptedBy: null,
                scheduledAt: newScheduledAt,
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

            // Check if meeting time has passed
            const scheduledTime = new Date(meeting.scheduledAt);
            const now = new Date();
            if (now < scheduledTime) {
                return {
                    success: false,
                    error: 'Meeting time has not yet passed. You can confirm after the scheduled time.',
                    notYetTime: true
                };
            }

            const isCompany = user.role === 'COMPANY';
            const confirmField = isCompany ? 'companyConfirmed' : 'seekerConfirmed';
            const otherDenied = isCompany ? meeting.seekerDenied : meeting.companyDenied;

            // Update confirmation
            await updateDoc(meetingRef, {
                [confirmField]: true,
                updatedAt: new Date().toISOString(),
            });

            // Check if other party DENIED → DISPUTE (contradiction)
            if (otherDenied) {
                const meetingRef2 = doc(db, 'meetings', meetingId);
                await updateDoc(meetingRef2, {
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

    // Verify OTP entered by seeker to confirm meeting happened
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

            // Only the seeker should verify OTP
            if (meeting.seekerId !== user.id) {
                return { success: false, error: 'Only the seeker can verify the meeting OTP' };
            }

            // Check if meeting time has passed
            const scheduledTime = new Date(meeting.scheduledAt);
            if (new Date() < scheduledTime) {
                return { success: false, error: 'Meeting time has not yet passed', notYetTime: true };
            }

            // Verify OTP
            if (String(enteredOTP).trim() !== String(meeting.meetingOTP)) {
                return { success: false, error: 'Incorrect OTP. Please check the code with the company.', wrongOTP: true };
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

            if (amount < 250) {
                return { success: false, error: 'Minimum withdrawal is ₹250' };
            }

            // Create withdrawal record
            const withdrawalData = {
                seekerId: user.id,
                seekerName: user.profile?.name || user.email || 'Unknown',
                seekerEmail: user.email || '',
                seekerPhone: user.profile?.phone || '',
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

            // Log the unlock transaction
            const project2 = (await getDoc(projectRef)).data();
            await addDoc(collection(db, 'transactions'), {
                userId: project2.seekerId,
                type: 'UNLOCK',
                amount: 0, // Will be updated with actual amount
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
            const chatsQuery1 = query(collection(db, 'chats'), where('user1Id', '==', userId));
            const chatsQuery2 = query(collection(db, 'chats'), where('user2Id', '==', userId));

            const chats1 = await getDocs(chatsQuery1);
            const chats2 = await getDocs(chatsQuery2);

            for (const chatDoc of [...chats1.docs, ...chats2.docs]) {
                // Delete all messages in this chat
                const messagesQuery = query(collection(db, 'chats', chatDoc.id, 'messages'));
                const messages = await getDocs(messagesQuery);
                for (const msgDoc of messages.docs) {
                    await deleteDoc(doc(db, 'chats', chatDoc.id, 'messages', msgDoc.id));
                }
                // Delete the chat
                await deleteDoc(doc(db, 'chats', chatDoc.id));
            }
            // 2. Delete all matches
            const matchesQuery1 = query(collection(db, 'matches'), where('user1Id', '==', userId));
            const matchesQuery2 = query(collection(db, 'matches'), where('user2Id', '==', userId));

            const matches1 = await getDocs(matchesQuery1);
            const matches2 = await getDocs(matchesQuery2);

            for (const matchDoc of [...matches1.docs, ...matches2.docs]) {
                await deleteDoc(doc(db, 'matches', matchDoc.id));
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
            // 7. Delete all likes involving this user
            const likesQuery1 = query(collection(db, 'likes'), where('likerId', '==', userId));
            const likesQuery2 = query(collection(db, 'likes'), where('likedId', '==', userId));

            const likes1 = await getDocs(likesQuery1);
            const likes2 = await getDocs(likesQuery2);

            for (const likeDoc of [...likes1.docs, ...likes2.docs]) {
                await deleteDoc(doc(db, 'likes', likeDoc.id));
            }
            // 8. Delete all passes involving this user
            const passesQuery1 = query(collection(db, 'passes'), where('passerId', '==', userId));
            const passesQuery2 = query(collection(db, 'passes'), where('passedId', '==', userId));

            const passes1 = await getDocs(passesQuery1);
            const passes2 = await getDocs(passesQuery2);

            for (const passDoc of [...passes1.docs, ...passes2.docs]) {
                await deleteDoc(doc(db, 'passes', passDoc.id));
            }
            // 9. Delete all storage files (profile images, portfolio, etc.)
            await deleteUserStorage(userId);

            // 10. Delete user document
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                await deleteDoc(userRef);
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
            scheduleMeeting,
            getMeetings,
            acceptMeeting,
            declineMeeting,
            cancelMeeting,
            denyMeeting,
            rescheduleMeeting,
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
            logout
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
