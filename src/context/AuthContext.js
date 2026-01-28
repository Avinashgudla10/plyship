'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { db, auth, uploadImage, uploadImages } from '../lib/firebase';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
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
    updateDoc
} from 'firebase/firestore';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    // Flag to prevent auth listener from overwriting state during onboarding
    const isOnboarding = useRef(false);

    // Listen for auth state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            // Skip if we're in the middle of onboarding
            if (isOnboarding.current) {
                console.log('⏳ Skipping auth listener - onboarding in progress');
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
                        console.log('✅ Loaded SEEKER from Firestore:', userData.email);
                    } else {
                        // Check in companies collection
                        userDoc = await getDoc(doc(db, 'companies', firebaseUser.uid));

                        if (userDoc.exists()) {
                            const userData = { id: firebaseUser.uid, ...userDoc.data() };
                            setUser(userData);
                            console.log('✅ Loaded COMPANY from Firestore:', userData.email);
                        } else {
                            // New user, just signed up but no profile yet
                            setUser({
                                id: firebaseUser.uid,
                                email: firebaseUser.email,
                                role: null,
                                profileComplete: false,
                                profile: null
                            });
                            console.log('🆕 New user, no profile yet:', firebaseUser.email);
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
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const login = async (email, password) => {
        try {
            await signInWithEmailAndPassword(auth, email, password);
            console.log('✅ Logged in:', email);
            return { success: true };
        } catch (error) {
            console.error('Login error:', error.message);
            return { success: false, error: error.message };
        }
    };

    const signup = async (name, email, password) => {
        try {
            // Set onboarding flag to prevent auth listener from interfering
            isOnboarding.current = true;

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            console.log('✅ Signed up:', email, 'UID:', userCredential.user.uid);

            // Set initial user state (profile will be created after role selection)
            setUser({
                id: userCredential.user.uid,
                name: name,
                email: email,
                role: null,
                profileComplete: false,
                profile: null
            });

            setLoading(false);
            return { success: true };
        } catch (error) {
            console.error('Signup error:', error.message);
            isOnboarding.current = false;
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
            // First, get the list of users we've already liked
            const likedUsersSnapshot = await getDocs(
                collection(db, 'likes', user.id, 'outgoing')
            );
            const likedUserIds = new Set();
            likedUsersSnapshot.forEach((doc) => {
                likedUserIds.add(doc.id);
            });
            console.log(`🚫 Already liked ${likedUserIds.size} users`);

            // Also get users we've passed (left swiped)
            const passedUsersSnapshot = await getDocs(
                collection(db, 'passes', user.id, 'passed')
            );
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

            const chats = [];
            for (const matchDoc of matchesSnapshot.docs) {
                const matchData = matchDoc.data();
                const chatId = getChatId(user.id, matchDoc.id);

                // Get chat metadata if it exists
                const chatDoc = await getDoc(doc(db, 'chats', chatId));
                const chatData = chatDoc.exists() ? chatDoc.data() : {};

                chats.push({
                    id: chatId,
                    matchedUserId: matchDoc.id,
                    matchedUserName: matchData.matchedUserName,
                    matchedUserRole: matchData.matchedUserRole,
                    matchedUserProfile: matchData.matchedUserProfile,
                    lastMessage: chatData.lastMessage || null,
                    lastMessageAt: chatData.lastMessageAt || matchData.matchedAt,
                });
            }

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

            let unreadCount = 0;

            // For each match, check if there are unread messages
            for (const matchDoc of matchesSnapshot.docs) {
                const chatId = getChatId(user.id, matchDoc.id);
                const chatDoc = await getDoc(doc(db, 'chats', chatId));

                if (chatDoc.exists()) {
                    const chatData = chatDoc.data();
                    // Count as unread if last message wasn't sent by current user
                    if (chatData.lastMessageSenderId && chatData.lastMessageSenderId !== user.id) {
                        // Check if we have a "lastSeenAt" record for this user
                        // For simplicity, count any chat with a message from other user as having 1 unread
                        unreadCount++;
                    }
                }
            }

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

    // ============ MEETING FUNCTIONS ============

    // Schedule a meeting with a match
    const scheduleMeeting = useCallback(async (targetUserId, scheduledAt, notes = '') => {
        if (!user || !user.id) {
            return { success: false, error: 'Not logged in' };
        }

        try {
            // Determine who is company and who is seeker
            const isCompany = user.role === 'COMPANY';
            const companyId = isCompany ? user.id : targetUserId;
            const seekerId = isCompany ? targetUserId : user.id;

            // Create meeting document
            const meetingData = {
                companyId,
                seekerId,
                requestedBy: user.id,
                scheduledAt,
                notes,
                status: 'SCHEDULED',
                companyConfirmed: false,
                seekerConfirmed: false,
                paymentStatus: 'PENDING',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            const meetingRef = await addDoc(collection(db, 'meetings'), meetingData);
            console.log('📅 Meeting scheduled:', meetingRef.id);

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

            const q = query(
                collection(db, 'meetings'),
                where(fieldToQuery, '==', user.id),
                orderBy('scheduledAt', 'desc')
            );

            const snapshot = await getDocs(q);
            const meetings = [];
            snapshot.forEach((doc) => {
                meetings.push({ id: doc.id, ...doc.data() });
            });

            console.log(`📋 Found ${meetings.length} meetings`);
            return meetings;
        } catch (error) {
            console.error('❌ Error getting meetings:', error);
            return [];
        }
    }, [user]);

    // Process ₹500 payment from company to seeker (atomic transaction)
    const processMeetingPayment = useCallback(async (meetingId, companyId, seekerId) => {
        const MEETING_FEE = 500;

        try {
            const result = await runTransaction(db, async (transaction) => {
                // Get company wallet
                const companyWalletRef = doc(db, 'wallets', companyId);
                const companyWalletSnap = await transaction.get(companyWalletRef);

                if (!companyWalletSnap.exists()) {
                    throw new Error('Company wallet not found');
                }

                const companyWallet = companyWalletSnap.data();

                // Check balance
                if (companyWallet.balance < MEETING_FEE) {
                    throw new Error('Insufficient balance');
                }

                // Get/create seeker wallet
                const seekerWalletRef = doc(db, 'wallets', seekerId);
                let seekerWalletSnap = await transaction.get(seekerWalletRef);

                if (!seekerWalletSnap.exists()) {
                    // Initialize seeker wallet
                    transaction.set(seekerWalletRef, {
                        userId: seekerId,
                        type: 'SEEKER',
                        balance: 0,
                        lockedBalance: 0,
                        totalEarnings: 0,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    });
                    seekerWalletSnap = { data: () => ({ balance: 0, lockedBalance: 0, totalEarnings: 0 }) };
                }

                const seekerWallet = seekerWalletSnap.data();

                // Debit company
                transaction.update(companyWalletRef, {
                    balance: companyWallet.balance - MEETING_FEE,
                    totalSpent: (companyWallet.totalSpent || 0) + MEETING_FEE,
                    updatedAt: new Date().toISOString(),
                });

                // Credit seeker (LOCKED)
                transaction.update(seekerWalletRef, {
                    lockedBalance: (seekerWallet.lockedBalance || 0) + MEETING_FEE,
                    totalEarnings: (seekerWallet.totalEarnings || 0) + MEETING_FEE,
                    updatedAt: new Date().toISOString(),
                });

                // Update meeting status
                const meetingRef = doc(db, 'meetings', meetingId);
                transaction.update(meetingRef, {
                    status: 'CONFIRMED',
                    paymentStatus: 'PROCESSED',
                    confirmedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });

                return { success: true };
            });

            // Log transactions (outside atomic transaction for simplicity)
            await addDoc(collection(db, 'transactions'), {
                userId: companyId,
                type: 'DEBIT',
                amount: MEETING_FEE,
                reason: 'MEETING_FEE',
                relatedMeetingId: meetingId,
                relatedUserId: seekerId,
                status: 'COMPLETED',
                createdAt: new Date().toISOString(),
            });

            await addDoc(collection(db, 'transactions'), {
                userId: seekerId,
                type: 'LOCK',
                amount: MEETING_FEE,
                reason: 'MEETING_EARNINGS',
                relatedMeetingId: meetingId,
                relatedUserId: companyId,
                status: 'COMPLETED',
                createdAt: new Date().toISOString(),
            });

            console.log('💰 Payment processed: ₹500 transferred');
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

            // Update confirmation
            await updateDoc(meetingRef, {
                [confirmField]: true,
                updatedAt: new Date().toISOString(),
            });

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

    // ============ PROJECT FUNCTIONS ============

    // Create a project (seeker selects company for their interior project)
    const createProject = useCallback(async (companyId, projectDetails = {}) => {
        if (!user || !user.id) {
            return { success: false, error: 'Not logged in' };
        }

        if (user.role !== 'SEEKER') {
            return { success: false, error: 'Only seekers can create projects' };
        }

        try {
            const projectData = {
                seekerId: user.id,
                companyId,
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
            console.log('🏠 Project created:', projectRef.id);

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

            const q = query(
                collection(db, 'projects'),
                where(fieldToQuery, '==', user.id),
                orderBy('createdAt', 'desc')
            );

            const snapshot = await getDocs(q);
            const projects = [];
            snapshot.forEach((docSnap) => {
                projects.push({ id: docSnap.id, ...docSnap.data() });
            });

            console.log(`📋 Found ${projects.length} projects`);
            return projects;
        } catch (error) {
            console.error('❌ Error getting projects:', error);
            return [];
        }
    }, [user]);

    // Company accepts a project request
    const acceptProject = useCallback(async (projectId) => {
        if (!user || !user.id) {
            return { success: false, error: 'Not logged in' };
        }

        if (user.role !== 'COMPANY') {
            return { success: false, error: 'Only companies can accept projects' };
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

            if (project.status !== 'PENDING_ACCEPTANCE') {
                return { success: false, error: 'Project is not pending acceptance' };
            }

            await updateDoc(projectRef, {
                status: 'ACCEPTED',
                acceptedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

            console.log('✅ Project accepted:', projectId);
            return { success: true };
        } catch (error) {
            console.error('❌ Error accepting project:', error);
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

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            login,
            signup,
            selectRole,
            completeProfile,
            getSwipeProfiles,
            likeProfile,
            passProfile,
            getMatches,
            getChatId,
            sendMessage,
            getChats,
            getUnreadCount,
            initializeWallet,
            getWallet,
            getTransactions,
            addTransaction,
            scheduleMeeting,
            getMeetings,
            confirmMeeting,
            createProject,
            getProjects,
            acceptProject,
            recordAdvancePayment,
            confirmAdvancePayment,
            logout
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
