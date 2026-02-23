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
                console.log('⏳ Skipping auth listener - onboarding in progress');
                setLoading(false);
                return;
            }
            if (isImpersonating) {
                console.log('👤 Skipping auth listener - impersonating user');
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
                        console.log('✅ Loaded SEEKER from Firestore:', userData.email);
                        // Track activity (fire-and-forget)
                        setDoc(doc(db, 'seekers', firebaseUser.uid), { lastActiveAt: new Date().toISOString() }, { merge: true }).catch(() => { });
                    } else {
                        // Check in companies collection
                        userDoc = await getDoc(doc(db, 'companies', firebaseUser.uid));

                        if (userDoc.exists()) {
                            const userData = { id: firebaseUser.uid, ...userDoc.data() };
                            setUser(userData);
                            localStorage.setItem('userEmail', userData.email);
                            console.log('✅ Loaded COMPANY from Firestore:', userData.email);
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
                            console.log('🆕 New user, no profile yet:', firebaseUser.phoneNumber || firebaseUser.email);
                        }
                    }
                } catch (error) {
                    console.error('Error loading user profile:', error);
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
        if (recaptchaVerifierRef.current) {
            recaptchaVerifierRef.current.clear();
        }
        recaptchaVerifierRef.current = new RecaptchaVerifier(auth, buttonId, {
            size: 'invisible',
            callback: () => {
                console.log('✅ reCAPTCHA solved');
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
            console.log('✅ OTP sent to:', formattedPhone);
            return { success: true };
        } catch (error) {
            console.error('OTP send error:', error.message);
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
            console.log('✅ OTP verified, user:', result.user.uid);
            return { success: true, user: result.user };
        } catch (error) {
            console.error('OTP verify error:', error.message);
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
            console.error('Signup error:', error.message);
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
            console.error('Complete signup error:', error.message);
            isOnboarding.current = false;
            return { success: false, error: error.message };
        }
    };

    // Login with phone OTP verification
    const loginVerifyOTP = async (otpCode) => {
        try {
            const result = await verifyOTP(otpCode);
            if (!result.success) return result;
            console.log('✅ Logged in via OTP:', result.user.phoneNumber);
            return { success: true };
        } catch (error) {
            console.error('Login OTP error:', error.message);
            return { success: false, error: error.message };
        }
    };

    const selectRole = (role) => {
        if (!user) {
            console.error('❌ selectRole: No user!');
            return;
        }
        console.log('👤 Role selected:', role, 'for user:', user.id);
        setUser(prev => ({ ...prev, role }));
    };

    const completeProfile = async (profileData) => {
        console.log('=== COMPLETE PROFILE CALLED ===');
        console.log('User object:', JSON.stringify(user, null, 2));
        console.log('Profile data:', JSON.stringify(profileData, null, 2));

        if (!user) {
            console.error('❌ No user to save profile for!');
            return { success: false, error: 'No user found' };
        }

        if (!user.id) {
            console.error('❌ User has no ID!');
            return { success: false, error: 'User has no ID' };
        }

        if (!user.role) {
            console.error('❌ User has no role!');
            return { success: false, error: 'User has no role selected' };
        }

        console.log('📝 Saving profile to Firestore with role:', user.role, 'ID:', user.id);

        // Upload images to Firebase Storage
        const cleanedProfile = { ...profileData };

        try {
            // Upload avatar if it's a base64 image
            if (cleanedProfile.avatar && cleanedProfile.avatar.startsWith('data:')) {
                console.log('📸 Uploading avatar to Firebase Storage...');
                const avatarUrl = await uploadImage(
                    cleanedProfile.avatar,
                    `users/${user.id}/avatar_${Date.now()}.jpg`
                );
                cleanedProfile.avatar = avatarUrl;
                console.log('✅ Avatar uploaded:', avatarUrl.substring(0, 50) + '...');
            }

            // Upload portfolio images if they exist
            if (cleanedProfile.portfolioImages && cleanedProfile.portfolioImages.length > 0) {
                const base64Images = cleanedProfile.portfolioImages.filter(img => img && img.startsWith('data:'));
                if (base64Images.length > 0) {
                    console.log('📸 Uploading', base64Images.length, 'portfolio images to Firebase Storage...');
                    const imageUrls = await uploadImages(
                        base64Images,
                        `users/${user.id}/portfolio`
                    );
                    cleanedProfile.portfolioImages = imageUrls;
                    console.log('✅ Portfolio images uploaded');
                }
            }
        } catch (uploadError) {
            console.error('❌ Error uploading images:', uploadError);
            // Continue without images if upload fails
            cleanedProfile.avatar = null;
            cleanedProfile.portfolioImages = [];
        }

        const updatedUser = {
            email: user.email,
            name: profileData.name || profileData.companyName || user.name,
            role: user.role,
            profileComplete: true,
            profile: cleanedProfile,
            createdAt: new Date().toISOString()
        };

        // Check size before saving
        const dataSize = JSON.stringify(updatedUser).length;
        console.log('📦 Data size:', (dataSize / 1024).toFixed(2), 'KB');

        try {
            // Save to appropriate collection based on role
            const collectionName = user.role === 'SEEKER' ? 'seekers' : 'companies';
            console.log('🗄️ Saving to collection:', collectionName, 'with ID:', user.id);

            await setDoc(doc(db, collectionName, user.id), updatedUser);
            console.log('✅ Firestore write successful!');

            // Update local state
            setUser({ id: user.id, ...updatedUser });

            // Clear onboarding flag - profile is complete
            isOnboarding.current = false;

            console.log(`✅ Saved ${user.role} profile to Firestore:`, updatedUser.name);
            return { success: true };
        } catch (error) {
            console.error('❌ Firestore error:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            return { success: false, error: error.message };
        }
    };

    // Get profiles of the opposite role for swiping
    const getSwipeProfiles = useCallback(async () => {
        if (!user || !user.role) {
            console.log('⚠️ getSwipeProfiles: No user or role');
            return [];
        }

        console.log('=== GETTING SWIPE PROFILES FROM FIRESTORE ===');
        console.log('👤 Current user:', user.email, 'Role:', user.role);

        try {
            // Fetch liked and passed users in parallel (was sequential)
            const [likedUsersSnapshot, passedUsersSnapshot] = await Promise.all([
                getDocs(collection(db, 'likes', user.id, 'outgoing')),
                getDocs(collection(db, 'passes', user.id, 'passed')),
            ]);
            const likedUserIds = new Set();
            likedUsersSnapshot.forEach((doc) => {
                likedUserIds.add(doc.id);
            });
            console.log(`🚫 Already liked ${likedUserIds.size} users`);

            const passedUserIds = new Set();
            passedUsersSnapshot.forEach((doc) => {
                passedUserIds.add(doc.id);
            });
            console.log(`👎 Already passed ${passedUserIds.size} users`);

            // Seekers see Companies, Companies see Seekers
            const collectionName = user.role === 'SEEKER' ? 'companies' : 'seekers';

            const q = query(
                collection(db, collectionName),
                where('profileComplete', '==', true)
            );

            const querySnapshot = await getDocs(q);
            const profiles = [];

            querySnapshot.forEach((doc) => {
                // Don't include self, already liked users, or passed users
                if (doc.id !== user.id && !likedUserIds.has(doc.id) && !passedUserIds.has(doc.id)) {
                    profiles.push({ id: doc.id, ...doc.data() });
                }
            });

            console.log(`📊 Found ${profiles.length} ${collectionName} profiles (after filtering)`);

            // Sort by lastActiveAt descending — most recently active users appear first
            profiles.sort((a, b) => {
                const aTime = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
                const bTime = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
                return bTime - aTime;
            });

            return profiles;
        } catch (error) {
            console.error('❌ Error fetching profiles:', error);
            return [];
        }
    }, [user]);

    // Like a profile and check for mutual match
    const likeProfile = useCallback(async (targetProfile) => {
        if (!user || !user.id) {
            console.log('⚠️ likeProfile: No user');
            return { success: false, isMatch: false };
        }

        console.log('❤️ Liking profile:', targetProfile.id);

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

            console.log('✅ Like stored in Firebase');

            // Check if the target profile has already liked us (mutual match)
            const theirLikeDoc = await getDoc(doc(db, 'likes', targetProfile.id, 'outgoing', user.id));

            if (theirLikeDoc.exists()) {
                // It's a match!
                console.log('🎉 MUTUAL MATCH DETECTED!');

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
            console.error('❌ Error liking profile:', error);
            return { success: false, isMatch: false, error: error.message };
        }
    }, [user]);

    // Pass (left swipe) a profile - record to never show again
    const passProfile = useCallback(async (targetProfile) => {
        if (!user || !user.id) {
            console.log('⚠️ passProfile: No user');
            return { success: false };
        }

        console.log('👎 Passing profile:', targetProfile.id);

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

            console.log('✅ Pass recorded in Firebase');
            return { success: true };
        } catch (error) {
            console.error('❌ Error passing profile:', error);
            return { success: false, error: error.message };
        }
    }, [user]);

    // Get all matches for current user
    const getMatches = useCallback(async () => {
        if (!user || !user.id) {
            console.log('⚠️ getMatches: No user');
            return [];
        }

        console.log('📋 Getting matches for user:', user.id);

        try {
            const matchesSnapshot = await getDocs(
                collection(db, 'matches', user.id, 'matched')
            );

            const matches = [];
            matchesSnapshot.forEach((doc) => {
                matches.push({ id: doc.id, ...doc.data() });
            });

            console.log(`💕 Found ${matches.length} matches`);
            return matches;
        } catch (error) {
            console.error('❌ Error fetching matches:', error);
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

            console.log(`📩 Found ${enriched.length} incoming like requests`);
            return enriched;
        } catch (error) {
            console.error('❌ Error fetching incoming likes:', error);
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

            console.log('✅ Match accepted:', likerUserId);
            return { success: true };
        } catch (error) {
            console.error('❌ Error accepting match:', error);
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

            console.log('❌ Match refused:', likerUserId);
            return { success: true };
        } catch (error) {
            console.error('❌ Error refusing match:', error);
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
        console.log('💬 Sending message to chat:', chatId);

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

            console.log('✅ Message sent');

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
            console.error('❌ Error sending message:', error);
            return { success: false, error: error.message };
        }
    }, [user, getChatId]);

    // Get all chats for current user
    const getChats = useCallback(async () => {
        if (!user || !user.id) {
            return [];
        }

        console.log('📋 Getting chats for user:', user.id);

        try {
            // Get all matches and their chat data
            const matchesSnapshot = await getDocs(
                collection(db, 'matches', user.id, 'matched')
            );

            // Fetch all meetings for this user at once (avoid N+1 queries)
            const isCompany = user.role === 'COMPANY';
            const meetingField = isCompany ? 'companyId' : 'seekerId';
            const meetingsSnapshot = await getDocs(
                query(collection(db, 'meetings'), where(meetingField, '==', user.id))
            );
            const allMeetings = [];
            meetingsSnapshot.forEach((d) => allMeetings.push({ id: d.id, ...d.data() }));

            // Batch-fetch all chat docs in parallel (was N+1 sequential)
            const chatPromises = matchesSnapshot.docs.map(matchDoc => {
                const chatId = getChatId(user.id, matchDoc.id);
                return getDoc(doc(db, 'chats', chatId))
                    .then(snap => ({ matchDoc, chatId, chatData: snap.exists() ? snap.data() : {} }));
            });
            const chatResults = await Promise.all(chatPromises);

            const chats = chatResults.map(({ matchDoc, chatId, chatData }) => {
                const matchData = matchDoc.data();
                const otherUserId = matchDoc.id;
                const relevantMeetings = allMeetings
                    .filter(m => {
                        const matchesOther = (m.companyId === otherUserId || m.seekerId === otherUserId);
                        return matchesOther && !m.rescheduledTo;
                    })
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

                const latestMeeting = relevantMeetings[0] || null;

                return {
                    id: chatId,
                    matchedUserId: matchDoc.id,
                    matchedUserName: matchData.matchedUserName,
                    matchedUserRole: matchData.matchedUserRole,
                    matchedUserProfile: matchData.matchedUserProfile,
                    lastMessage: chatData.lastMessage || null,
                    lastMessageAt: chatData.lastMessageAt || matchData.matchedAt,
                    meetingStatus: latestMeeting?.status || null,
                    meetingScheduledAt: latestMeeting?.scheduledAt || null,
                };
            });

            // Sort by last message time (most recent first)
            chats.sort((a, b) => {
                const timeA = a.lastMessageAt?.toDate?.() || new Date(a.lastMessageAt);
                const timeB = b.lastMessageAt?.toDate?.() || new Date(b.lastMessageAt);
                return timeB - timeA;
            });

            console.log(`💬 Found ${chats.length} chats`);
            return chats;
        } catch (error) {
            console.error('❌ Error fetching chats:', error);
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
            console.error('❌ Error getting unread count:', error);
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
                console.log('💰 Wallet initialized for:', userId);
                return { success: true, wallet: walletData };
            }

            return { success: true, wallet: walletSnap.data() };
        } catch (error) {
            console.error('❌ Error initializing wallet:', error);
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
            console.error('❌ Error getting wallet:', error);
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
            console.error('❌ Error getting transactions:', error);
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
            console.log('📝 Transaction recorded:', docRef.id);
            return { success: true, transactionId: docRef.id };
        } catch (error) {
            console.error('❌ Error adding transaction:', error);
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

            console.log('💰 Wallet topped up:', amount, 'New balance:', newBalance);

            // Notify user about successful top-up
            createNotification(user.id, {
                type: 'wallet_credit',
                title: '💰 Wallet Topped Up!',
                message: `₹${amount} added to your wallet. New balance: ₹${newBalance}`,
                data: { amount, newBalance },
            });

            return { success: true, newBalance };
        } catch (error) {
            console.error('❌ Error topping up wallet:', error);
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

            console.log('📅 Scheduling meeting:');
            console.log('  - Current user:', user.id, '(role:', user.role, ')');
            console.log('  - Target user:', targetUserId);
            console.log('  - companyId:', companyId);
            console.log('  - seekerId:', seekerId);

            // Create meeting document with PENDING_ACCEPTANCE status
            const meetingData = {
                companyId,
                seekerId,
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
            console.log('✅ Meeting created:', meetingRef.id, meetingData);

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
            console.error('❌ Error scheduling meeting:', error);
            return { success: false, error: error.message };
        }
    }, [user]);


    // Get all meetings for current user
    const getMeetings = useCallback(async () => {
        if (!user || !user.id) {
            return [];
        }

        try {
            const isCompany = user.role === 'COMPANY';
            const fieldToQuery = isCompany ? 'companyId' : 'seekerId';

            console.log(`📋 getMeetings: Querying ${fieldToQuery} == ${user.id} (role: ${user.role})`);

            // Query without orderBy to avoid needing composite index
            const q = query(
                collection(db, 'meetings'),
                where(fieldToQuery, '==', user.id)
            );

            const snapshot = await getDocs(q);
            const meetings = [];
            snapshot.forEach((doc) => {
                meetings.push({ id: doc.id, ...doc.data() });
            });

            // Sort by scheduledAt descending in JavaScript
            meetings.sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt));

            console.log(`📋 Found ${meetings.length} meetings for ${user.id} (${user.role}):`, meetings.map(m => ({ id: m.id, status: m.status, companyId: m.companyId, seekerId: m.seekerId })));
            return meetings;
        } catch (error) {
            console.error('❌ Error getting meetings:', error);
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

            console.log('✅ Meeting accepted:', meetingId);

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
            console.error('❌ Error accepting meeting:', error);
            return { success: false, error: error.message };
        }
    }, [user]);

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

            console.log('❌ Meeting declined:', meetingId);

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
            console.error('❌ Error declining meeting:', error);
            return { success: false, error: error.message };
        }
    }, [user]);

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
                console.log('⚠️ Meeting DISPUTE detected:', meetingId);
                return { success: true, dispute: true };
            }

            await updateDoc(meetingRef, {
                status: 'CANCELLED',
                cancelledBy: user.id,
                cancelReason: reason,
                cancelledAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

            console.log('🚫 Meeting cancelled:', meetingId);
            return { success: true };
        } catch (error) {
            console.error('❌ Error cancelling meeting:', error);
            return { success: false, error: error.message };
        }
    }, [user]);

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
                console.log('⚠️ DISPUTE: Contradiction detected for meeting:', meetingId);
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
                console.log('🚫 Both denied — meeting cancelled:', meetingId);
                return { success: true, bothDenied: true };
            }

            // Only this user denied so far — wait for other party
            await updateDoc(meetingRef, {
                [denyField]: true,
                updatedAt: new Date().toISOString(),
            });
            console.log(`❌ ${isCompany ? 'Company' : 'Seeker'} denied meeting, waiting for other party`);
            return { success: true, waitingForOther: true };
        } catch (error) {
            console.error('❌ Error denying meeting:', error);
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

            console.log('🔄 Meeting rescheduled:', meetingId, '->', newMeetingRef.id);
            return { success: true, newMeetingId: newMeetingRef.id };
        } catch (error) {
            console.error('❌ Error rescheduling meeting:', error);
            return { success: false, error: error.message };
        }
    }, [user]);

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

            console.log('💰 Payment processed: ₹500 split — ₹250 to seeker, ₹250 to admin');

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
            console.error('❌ Error processing payment:', error);

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
    }, []);

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
                console.log('⚠️ DISPUTE: This user confirmed but other denied for meeting:', meetingId);
                return { success: true, dispute: true };
            }

            // Check if both parties confirmed
            const otherConfirmField = isCompany ? 'seekerConfirmed' : 'companyConfirmed';
            const otherConfirmed = meeting[otherConfirmField];

            if (otherConfirmed) {
                // Both confirmed! Process payment
                console.log('🎉 Both parties confirmed! Processing payment...');
                const paymentResult = await processMeetingPayment(meetingId, meeting.companyId, meeting.seekerId);
                return paymentResult;
            }

            console.log(`✅ ${isCompany ? 'Company' : 'Seeker'} confirmed meeting`);
            return { success: true, bothConfirmed: false };
        } catch (error) {
            console.error('❌ Error confirming meeting:', error);
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
            console.log('✅ OTP verified! Processing payment for meeting:', meetingId);
            const paymentResult = await processMeetingPayment(meetingId, meeting.companyId, meeting.seekerId);
            return paymentResult;
        } catch (error) {
            console.error('❌ Error verifying meeting OTP:', error);
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
            console.log('💸 Withdrawal request created:', amount);
            return { success: true };
        } catch (error) {
            console.error('❌ Error requesting withdrawal:', error);
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
            console.log('🏠 Project request created:', projectRef.id);

            return { success: true, projectId: projectRef.id };
        } catch (error) {
            console.error('❌ Error creating project:', error);
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

            console.log(`📋 Found ${projects.length} projects`);
            return projects;
        } catch (error) {
            console.error('❌ Error getting projects:', error);
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
                console.log(`🔓 Seeker wallet unlocked. Moved ₹${lockedAmount} from locked to available for project:`, projectId);
            }

            console.log('✅ Project accepted:', projectId);
            return { success: true };
        } catch (error) {
            console.error('❌ Error accepting project:', error);
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

            console.log('❌ Project declined:', projectId);
            return { success: true };
        } catch (error) {
            console.error('❌ Error declining project:', error);
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

            console.log('💰 Advance payment recorded:', projectId);
            return { success: true };
        } catch (error) {
            console.error('❌ Error recording advance payment:', error);
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

                    console.log(`🔓 Unlocked ₹${lockedBalance} for seeker:`, seekerId);
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

            console.log('✅ Advance confirmed, earnings unlocked:', projectId);
            return { success: true, earningsUnlocked: true };
        } catch (error) {
            console.error('❌ Error confirming advance payment:', error);
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
                console.log('⭐ Review updated:', reviewId);
                return { success: true, reviewId, updated: true };
            } else {
                // Create new
                reviewData.createdAt = new Date().toISOString();
                await setDoc(reviewRef, reviewData);
                console.log('⭐ Review submitted:', reviewId);
                return { success: true, reviewId, updated: false };
            }
        } catch (error) {
            console.error('❌ Error submitting review:', error);
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

            console.log(`⭐ Found ${reviews.length} reviews for company ${companyId}`);
            return reviews;
        } catch (error) {
            console.error('❌ Error getting reviews:', error);
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
            console.error('❌ Error checking review:', error);
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
                console.log('👤 Impersonating user:', userData.name || userData.email || targetUserId);
                return { success: true };
            }

            // Try companies
            userDoc = await getDoc(doc(db, 'companies', targetUserId));
            if (userDoc.exists()) {
                const userData = { id: targetUserId, ...userDoc.data() };
                setUser(userData);
                setIsImpersonating(true);
                console.log('👤 Impersonating company:', userData.profile?.companyName || targetUserId);
                return { success: true };
            }

            return { success: false, error: 'User not found in Firestore' };
        } catch (error) {
            console.error('Impersonation error:', error);
            return { success: false, error: error.message };
        }
    };

    const exitImpersonation = () => {
        if (adminUserRef.current) {
            setUser(adminUserRef.current);
            adminUserRef.current = null;
            setIsImpersonating(false);
            console.log('👤 Exited impersonation, restored admin');
        }
    };

    // Delete account and all associated data (requires password for reauthentication)
    const deleteAccount = async (password) => {
        if (!user || !user.id) {
            return { success: false, error: 'Not logged in' };
        }

        try {
            console.log('🗑️ Starting account deletion for:', user.id);
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
            console.log('✅ Deleted chats and messages');

            // 2. Delete all matches
            const matchesQuery1 = query(collection(db, 'matches'), where('user1Id', '==', userId));
            const matchesQuery2 = query(collection(db, 'matches'), where('user2Id', '==', userId));

            const matches1 = await getDocs(matchesQuery1);
            const matches2 = await getDocs(matchesQuery2);

            for (const matchDoc of [...matches1.docs, ...matches2.docs]) {
                await deleteDoc(doc(db, 'matches', matchDoc.id));
            }
            console.log('✅ Deleted matches');

            // 3. Delete all meetings
            const meetingsQuery1 = query(collection(db, 'meetings'), where('companyId', '==', userId));
            const meetingsQuery2 = query(collection(db, 'meetings'), where('seekerId', '==', userId));

            const meetings1 = await getDocs(meetingsQuery1);
            const meetings2 = await getDocs(meetingsQuery2);

            for (const meetingDoc of [...meetings1.docs, ...meetings2.docs]) {
                await deleteDoc(doc(db, 'meetings', meetingDoc.id));
            }
            console.log('✅ Deleted meetings');

            // 4. Delete all projects
            const projectsQuery1 = query(collection(db, 'projects'), where('companyId', '==', userId));
            const projectsQuery2 = query(collection(db, 'projects'), where('seekerId', '==', userId));

            const projects1 = await getDocs(projectsQuery1);
            const projects2 = await getDocs(projectsQuery2);

            for (const projectDoc of [...projects1.docs, ...projects2.docs]) {
                await deleteDoc(doc(db, 'projects', projectDoc.id));
            }
            console.log('✅ Deleted projects');

            // 5. Delete transactions
            const transactionsQuery = query(collection(db, 'transactions'), where('userId', '==', userId));
            const transactions = await getDocs(transactionsQuery);
            for (const txDoc of transactions.docs) {
                await deleteDoc(doc(db, 'transactions', txDoc.id));
            }
            console.log('✅ Deleted transactions');

            // 6. Delete wallet
            const walletRef = doc(db, 'wallets', userId);
            const walletSnap = await getDoc(walletRef);
            if (walletSnap.exists()) {
                await deleteDoc(walletRef);
            }
            console.log('✅ Deleted wallet');

            // 7. Delete all likes involving this user
            const likesQuery1 = query(collection(db, 'likes'), where('likerId', '==', userId));
            const likesQuery2 = query(collection(db, 'likes'), where('likedId', '==', userId));

            const likes1 = await getDocs(likesQuery1);
            const likes2 = await getDocs(likesQuery2);

            for (const likeDoc of [...likes1.docs, ...likes2.docs]) {
                await deleteDoc(doc(db, 'likes', likeDoc.id));
            }
            console.log('✅ Deleted likes');

            // 8. Delete all passes involving this user
            const passesQuery1 = query(collection(db, 'passes'), where('passerId', '==', userId));
            const passesQuery2 = query(collection(db, 'passes'), where('passedId', '==', userId));

            const passes1 = await getDocs(passesQuery1);
            const passes2 = await getDocs(passesQuery2);

            for (const passDoc of [...passes1.docs, ...passes2.docs]) {
                await deleteDoc(doc(db, 'passes', passDoc.id));
            }
            console.log('✅ Deleted passes');

            // 9. Delete all storage files (profile images, portfolio, etc.)
            await deleteUserStorage(userId);

            // 10. Delete user document
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                await deleteDoc(userRef);
            }
            console.log('✅ Deleted user document');

            // 10. Delete Firebase Auth account
            const currentUser = auth.currentUser;
            if (currentUser) {
                await currentUser.delete();
                console.log('✅ Deleted Firebase Auth account');
            }

            // Clear local state
            setUser(null);
            router.push('/login');

            console.log('🎉 Account completely deleted');
            return { success: true };
        } catch (error) {
            console.error('❌ Error deleting account:', error);
            return { success: false, error: error.message };
        }
    };

    const logout = async () => {
        try {
            isOnboarding.current = false;
            await signOut(auth);
            setUser(null);
            console.log('👋 Logged out');
            router.push('/login');
        } catch (error) {
            console.error('Logout error:', error);
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
            console.error('❌ Error creating notification:', error);
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
            console.error('❌ Error fetching notifications:', error);
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
            console.error('❌ Error marking notifications read:', error);
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
