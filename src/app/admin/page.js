'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
    Users, Building2, Palette, Calendar, Wallet, ArrowLeft,
    TrendingUp, DollarSign, MessageCircle, CheckCircle, XCircle,
    Clock, Search, RefreshCw, Eye, Filter, Download, Zap,
    Pencil, Trash2, X, Save, AlertTriangle, LogOut, Banknote
} from 'lucide-react';
import {
    collection, getDocs, query, orderBy, limit, where,
    doc, getDoc, Timestamp, onSnapshot, collectionGroup,
    updateDoc, deleteDoc, addDoc, setDoc, runTransaction
} from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { db, auth } from '../../lib/firebase';

// Admin emails that have access
const ADMIN_EMAILS = ['avinashgudla10@gmail.com'];

// ============ TOAST COMPONENT ============
function Toast({ message, type = 'success', onClose }) {
    useEffect(() => {
        const timer = setTimeout(onClose, 3500);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            style={{
                position: 'fixed',
                bottom: 24,
                right: 24,
                zIndex: 9999,
                padding: '14px 24px',
                borderRadius: 12,
                background: type === 'success' ? '#059669' : '#DC2626',
                color: 'white',
                fontWeight: 600,
                fontSize: 14,
                boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                maxWidth: 400,
            }}
        >
            {type === 'success' ? <CheckCircle size={18} /> : <XCircle size={18} />}
            {message}
            <button
                onClick={onClose}
                style={{
                    background: 'none', border: 'none', color: 'white',
                    cursor: 'pointer', marginLeft: 8, padding: 2, display: 'flex',
                }}
            >
                <X size={14} />
            </button>
        </motion.div>
    );
}

// ============ CONFIRM DELETE MODAL ============
function ConfirmModal({ title, message, onConfirm, onCancel, loading }) {
    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                    background: 'white', borderRadius: 16, padding: 32,
                    maxWidth: 420, width: '90%',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{
                        width: 44, height: 44, borderRadius: 12,
                        background: '#FEE2E2', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                    }}>
                        <AlertTriangle size={22} color="#DC2626" />
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111' }}>{title}</h3>
                </div>
                <p style={{ fontSize: 14, color: '#666', marginBottom: 28, lineHeight: 1.6 }}>
                    {message}
                </p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                    <button
                        onClick={onCancel}
                        disabled={loading}
                        style={{
                            padding: '10px 20px', borderRadius: 10, border: '1px solid #E5E7EB',
                            background: 'white', cursor: 'pointer', fontWeight: 600,
                            fontSize: 14, color: '#666',
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        style={{
                            padding: '10px 20px', borderRadius: 10, border: 'none',
                            background: '#DC2626', color: 'white', cursor: 'pointer',
                            fontWeight: 600, fontSize: 14,
                            opacity: loading ? 0.7 : 1,
                            display: 'flex', alignItems: 'center', gap: 8,
                        }}
                    >
                        {loading ? <RefreshCw size={14} className="spin" /> : <Trash2 size={14} />}
                        {loading ? 'Deleting...' : 'Delete'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

// ============ EDIT MODAL WRAPPER ============
function EditModal({ title, onClose, onSave, loading, children }) {
    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                    background: 'white', borderRadius: 16, padding: 0,
                    maxWidth: 520, width: '90%',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                    maxHeight: '85vh', overflow: 'hidden',
                    display: 'flex', flexDirection: 'column',
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '20px 24px', borderBottom: '1px solid #E5E7EB',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: 10,
                            background: '#EEF2FF', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Pencil size={16} color="#4F46E5" />
                        </div>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>{title}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: '#F3F4F6', border: 'none', cursor: 'pointer',
                            width: 32, height: 32, borderRadius: 8,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                    >
                        <X size={16} color="#666" />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
                    {children}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 24px', borderTop: '1px solid #E5E7EB',
                    display: 'flex', gap: 12, justifyContent: 'flex-end',
                }}>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        style={{
                            padding: '10px 20px', borderRadius: 10, border: '1px solid #E5E7EB',
                            background: 'white', cursor: 'pointer', fontWeight: 600,
                            fontSize: 14, color: '#666',
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onSave}
                        disabled={loading}
                        style={{
                            padding: '10px 20px', borderRadius: 10, border: 'none',
                            background: '#22C55E', color: 'white', cursor: 'pointer',
                            fontWeight: 600, fontSize: 14,
                            opacity: loading ? 0.7 : 1,
                            display: 'flex', alignItems: 'center', gap: 8,
                        }}
                    >
                        {loading ? <RefreshCw size={14} className="spin" /> : <Save size={14} />}
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

// ============ FORM FIELD ============
function FormField({ label, children }) {
    return (
        <div style={{ marginBottom: 18 }}>
            <label style={{
                display: 'block', fontSize: 12, fontWeight: 600,
                color: '#666', marginBottom: 6, textTransform: 'uppercase',
                letterSpacing: '0.05em',
            }}>
                {label}
            </label>
            {children}
        </div>
    );
}

const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: 10,
    border: '1px solid #E5E7EB', fontSize: 14, color: '#111',
    outline: 'none', background: '#FAFAFA', boxSizing: 'border-box',
    transition: 'border-color 0.2s',
};

const selectStyle = {
    ...inputStyle, cursor: 'pointer', appearance: 'auto',
};

// ============ ACTION BUTTONS ============
function ActionButtons({ onEdit, onDelete }) {
    return (
        <div style={{ display: 'flex', gap: 6 }}>
            {onEdit && (
                <button
                    onClick={onEdit}
                    title="Edit"
                    style={{
                        width: 32, height: 32, borderRadius: 8,
                        border: '1px solid #E5E7EB', background: 'white',
                        cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = '#EEF2FF';
                        e.currentTarget.style.borderColor = '#4F46E5';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = 'white';
                        e.currentTarget.style.borderColor = '#E5E7EB';
                    }}
                >
                    <Pencil size={14} color="#4F46E5" />
                </button>
            )}
            {onDelete && (
                <button
                    onClick={onDelete}
                    title="Delete"
                    style={{
                        width: 32, height: 32, borderRadius: 8,
                        border: '1px solid #E5E7EB', background: 'white',
                        cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = '#FEE2E2';
                        e.currentTarget.style.borderColor = '#DC2626';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = 'white';
                        e.currentTarget.style.borderColor = '#E5E7EB';
                    }}
                >
                    <Trash2 size={14} color="#DC2626" />
                </button>
            )}
        </div>
    );
}

// ============ MAIN ADMIN DASHBOARD ============
export default function AdminDashboard() {
    const router = useRouter();
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const [seekers, setSeekers] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [meetings, setMeetings] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [matches, setMatches] = useState([]);
    const [chats, setChats] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLive, setIsLive] = useState(true);
    const [adminWallet, setAdminWallet] = useState({ balance: 0, totalEarnings: 0 });
    const [allWallets, setAllWallets] = useState([]);
    const [withdrawals, setWithdrawals] = useState([]);
    const [viewingUser, setViewingUser] = useState(null);
    const [viewingChat, setViewingChat] = useState(null);
    const [viewingEarnings, setViewingEarnings] = useState(null);
    const [chatMessages, setChatMessages] = useState([]);

    // CRUD state
    const [toast, setToast] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [editingItem, setEditingItem] = useState(null);
    const [saving, setSaving] = useState(false);

    const showToast = (message, type = 'success') => setToast({ message, type });

    // Combine users from both collections
    const users = useMemo(() => {
        return [...seekers, ...companies];
    }, [seekers, companies]);

    // Calculate stats from data
    const stats = useMemo(() => {
        const confirmedMeetings = meetings.filter(m => m.status === 'CONFIRMED');
        const totalRevenue = transactions
            .filter(t => t.type === 'WALLET_TOP_UP' && t.status === 'COMPLETED')
            .reduce((sum, t) => sum + (t.amount || 0), 0);

        return {
            totalUsers: users.length,
            companies: companies.length,
            designers: seekers.length,
            totalMatches: matches.length,
            totalMeetings: meetings.length,
            confirmedMeetings: confirmedMeetings.length,
            totalRevenue,
            pendingMeetings: meetings.filter(m => m.status === 'PENDING_ACCEPTANCE').length,
        };
    }, [users, seekers, companies, meetings, transactions, matches]);

    // Check admin access and setup real-time listeners
    useEffect(() => {
        let firestoreUnsubs = [];

        const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
            // Clean up any previous Firestore listeners
            firestoreUnsubs.forEach(unsub => unsub());
            firestoreUnsubs = [];

            const userEmail = firebaseUser?.email || localStorage.getItem('userEmail');
            if (!userEmail || !ADMIN_EMAILS.includes(userEmail)) {
                setIsAdmin(false);
                setLoading(false);
                return;
            }

            setIsAdmin(true);
            localStorage.setItem('userEmail', userEmail);

            // Real-time seekers listener
            firestoreUnsubs.push(onSnapshot(
                collection(db, 'seekers'),
                (snapshot) => {
                    const seekersData = snapshot.docs.map(d => ({
                        id: d.id, ...d.data(), role: 'seeker'
                    }));
                    setSeekers(seekersData);
                },
                (error) => console.error('Seekers listener error:', error)
            ));

            // Real-time companies listener
            firestoreUnsubs.push(onSnapshot(
                collection(db, 'companies'),
                (snapshot) => {
                    const companiesData = snapshot.docs.map(d => ({
                        id: d.id, ...d.data(), role: 'company'
                    }));
                    setCompanies(companiesData);
                },
                (error) => console.error('Companies listener error:', error)
            ));

            // Real-time meetings listener
            firestoreUnsubs.push(onSnapshot(
                query(collection(db, 'meetings'), orderBy('createdAt', 'desc'), limit(100)),
                (snapshot) => {
                    setMeetings(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
                },
                (error) => console.error('Meetings listener error:', error)
            ));

            // Real-time transactions listener
            firestoreUnsubs.push(onSnapshot(
                query(collection(db, 'transactions'), orderBy('createdAt', 'desc'), limit(100)),
                (snapshot) => {
                    setTransactions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
                },
                (error) => console.error('Transactions listener error:', error)
            ));

            // Real-time matches listener
            firestoreUnsubs.push(onSnapshot(
                collectionGroup(db, 'matched'),
                (snapshot) => {
                    const matchesData = snapshot.docs.map(d => ({
                        id: d.id, ...d.data(),
                        _path: d.ref.path,
                        _parentId: d.ref.parent.parent?.id,
                    }));
                    setMatches(matchesData);
                },
                (error) => console.error('Matches listener error:', error)
            ));

            // Real-time chats listener
            firestoreUnsubs.push(onSnapshot(
                query(collection(db, 'chats'), limit(100)),
                (snapshot) => {
                    setChats(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
                },
                (error) => console.error('Chats listener error:', error)
            ));

            // Real-time admin wallet listener
            firestoreUnsubs.push(onSnapshot(
                doc(db, 'wallets', 'admin_wallet'),
                (docSnap) => {
                    if (docSnap.exists()) {
                        setAdminWallet(docSnap.data());
                    }
                },
                (error) => console.error('Admin wallet listener error:', error)
            ));

            // Real-time ALL wallets listener
            firestoreUnsubs.push(onSnapshot(
                collection(db, 'wallets'),
                (snapshot) => {
                    setAllWallets(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
                },
                (error) => console.error('All wallets listener error:', error)
            ));

            // Real-time withdrawals listener
            firestoreUnsubs.push(onSnapshot(
                query(collection(db, 'withdrawals'), orderBy('requestedAt', 'desc')),
                (snapshot) => {
                    setWithdrawals(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
                },
                (error) => console.error('Withdrawals listener error:', error)
            ));

            setLoading(false);
        });

        return () => {
            unsubAuth();
            firestoreUnsubs.forEach(unsub => unsub());
        };
    }, []);

    // Add class to body for full-screen admin layout
    useEffect(() => {
        document.body.classList.add('admin-page-active');
        return () => {
            document.body.classList.remove('admin-page-active');
        };
    }, []);

    // ============ CRUD HANDLERS ============

    // -- Users --
    const handleEditUser = async (userId, data) => {
        setSaving(true);
        try {
            const user = users.find(u => u.id === userId);
            const collectionName = user.role === 'company' ? 'companies' : 'seekers';
            const userRef = doc(db, collectionName, userId);

            const updateData = {};
            if (data.email !== undefined) updateData.email = data.email;
            if (data.profileComplete !== undefined) updateData.profileComplete = data.profileComplete;
            if (data.profile) updateData.profile = data.profile;

            await updateDoc(userRef, updateData);
            showToast('User updated successfully');
            setEditingItem(null);
        } catch (error) {
            console.error('Error updating user:', error);
            showToast('Failed to update user: ' + error.message, 'error');
        }
        setSaving(false);
    };

    // -- Chats --
    const loadChatMessages = async (chatId) => {
        try {
            const messagesRef = collection(db, 'chats', chatId, 'messages');
            const q = query(messagesRef, orderBy('createdAt', 'asc'), limit(200));
            const snapshot = await getDocs(q);
            setChatMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (error) {
            console.error('Error loading messages:', error);
            showToast('Failed to load messages: ' + error.message, 'error');
        }
    };

    const handleDeleteChat = async (chatId) => {
        setSaving(true);
        try {
            // Delete messages subcollection first
            const msgsSnap = await getDocs(collection(db, 'chats', chatId, 'messages'));
            for (const msgDoc of msgsSnap.docs) {
                await deleteDoc(msgDoc.ref);
            }
            await deleteDoc(doc(db, 'chats', chatId));
            showToast('Chat deleted successfully');
            setConfirmDelete(null);
            if (viewingChat?.id === chatId) {
                setViewingChat(null);
                setChatMessages([]);
            }
        } catch (error) {
            console.error('Error deleting chat:', error);
            showToast('Failed to delete chat: ' + error.message, 'error');
        }
        setSaving(false);
    };

    const handleDeleteUser = async (userId) => {
        setSaving(true);
        try {
            const user = users.find(u => u.id === userId);
            const collectionName = user.role === 'company' ? 'companies' : 'seekers';
            await deleteDoc(doc(db, collectionName, userId));
            showToast('User deleted successfully');
            setConfirmDelete(null);
        } catch (error) {
            console.error('Error deleting user:', error);
            showToast('Failed to delete user: ' + error.message, 'error');
        }
        setSaving(false);
    };

    // -- Meetings --
    // Admin status updates are STATUS-ONLY. No wallet/payment transactions.
    // Admin handles wallet changes manually in Firestore.
    const handleEditMeeting = async (meetingId, data) => {
        setSaving(true);
        try {
            const meetingRef = doc(db, 'meetings', meetingId);
            const updateData = {
                updatedAt: new Date().toISOString(),
            };
            if (data.status) updateData.status = data.status;
            if (data.scheduledAt) updateData.scheduledAt = data.scheduledAt;
            if (data.notes !== undefined) updateData.notes = data.notes;

            await updateDoc(meetingRef, updateData);
            showToast('Meeting status updated (no wallet changes)');
            setEditingItem(null);
        } catch (error) {
            console.error('Error updating meeting:', error);
            showToast('Failed to update meeting: ' + error.message, 'error');
        }
        setSaving(false);
    };

    const handleDeleteMeeting = async (meetingId) => {
        setSaving(true);
        try {
            await deleteDoc(doc(db, 'meetings', meetingId));
            showToast('Meeting deleted successfully');
            setConfirmDelete(null);
        } catch (error) {
            console.error('Error deleting meeting:', error);
            showToast('Failed to delete meeting: ' + error.message, 'error');
        }
        setSaving(false);
    };

    // -- Transactions --
    // Admin status updates are STATUS-ONLY. No wallet refund logic.
    // Admin handles wallet changes manually in Firestore.
    const handleEditTransaction = async (txId, data) => {
        setSaving(true);
        try {
            const txRef = doc(db, 'transactions', txId);
            const updateData = {};
            if (data.status) updateData.status = data.status;
            if (data.amount !== undefined) updateData.amount = Number(data.amount);
            updateData.updatedAt = new Date().toISOString();

            await updateDoc(txRef, updateData);
            showToast('Transaction status updated (no wallet changes)');
            setEditingItem(null);
        } catch (error) {
            console.error('Error updating transaction:', error);
            showToast('Failed to update transaction: ' + error.message, 'error');
        }
        setSaving(false);
    };

    const handleDeleteTransaction = async (txId) => {
        setSaving(true);
        try {
            await deleteDoc(doc(db, 'transactions', txId));
            showToast('Transaction deleted successfully');
            setConfirmDelete(null);
        } catch (error) {
            console.error('Error deleting transaction:', error);
            showToast('Failed to delete transaction: ' + error.message, 'error');
        }
        setSaving(false);
    };

    // -- Matches --
    const handleDeleteMatch = async (match) => {
        setSaving(true);
        try {
            // Matches are stored for both users, so delete both sides
            if (match.users && match.users.length === 2) {
                const [userId1, userId2] = match.users;
                // Delete match doc for user1
                try {
                    await deleteDoc(doc(db, 'matches', userId1, 'matched', userId2));
                } catch (e) { /* may not exist */ }
                // Delete match doc for user2
                try {
                    await deleteDoc(doc(db, 'matches', userId2, 'matched', userId1));
                } catch (e) { /* may not exist */ }
            } else if (match._path) {
                // Fallback: delete using stored path
                await deleteDoc(doc(db, match._path));
            }
            showToast('Match deleted successfully');
            setConfirmDelete(null);
        } catch (error) {
            console.error('Error deleting match:', error);
            showToast('Failed to delete match: ' + error.message, 'error');
        }
        setSaving(false);
    };

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#F3F4F6'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <RefreshCw size={32} color="#22C55E" className="spin" />
                    <p style={{ marginTop: 12, color: '#666' }}>Loading admin dashboard...</p>
                </div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#F3F4F6'
            }}>
                <div style={{
                    textAlign: 'center',
                    padding: 40,
                    background: 'white',
                    borderRadius: 16,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                }}>
                    <XCircle size={48} color="#EF4444" style={{ marginBottom: 16 }} />
                    <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Access Denied</h2>
                    <p style={{ color: '#666', marginBottom: 24 }}>You don't have admin privileges.</p>
                    <button
                        onClick={() => router.push('/')}
                        style={{
                            padding: '12px 24px',
                            borderRadius: 10,
                            background: '#22C55E',
                            color: 'white',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 600,
                        }}
                    >
                        Go Home
                    </button>
                </div>
            </div>
        );
    }

    const tabs = [
        { id: 'overview', label: 'Overview', icon: TrendingUp },
        { id: 'users', label: 'Users', icon: Users },
        { id: 'meetings', label: 'Meetings', icon: Calendar },
        { id: 'transactions', label: 'Transactions', icon: Wallet },
        { id: 'matches', label: 'Matches', icon: MessageCircle },
        { id: 'chats', label: 'Chats', icon: MessageCircle },
        { id: 'wallets', label: 'Wallets', icon: Wallet },
        { id: 'withdrawals', label: 'Withdrawals', icon: Banknote },
    ];

    // -- Withdrawals --
    const handleUpdateWithdrawalStatus = async (withdrawalId, newStatus, adminNote = '') => {
        setSaving(true);
        try {
            const withdrawalRef = doc(db, 'withdrawals', withdrawalId);
            const updateData = {
                status: newStatus,
                updatedAt: new Date().toISOString(),
            };
            if (newStatus === 'COMPLETED' || newStatus === 'REJECTED') {
                updateData.processedAt = new Date().toISOString();
            }
            if (adminNote) {
                updateData.adminNote = adminNote;
            }
            await updateDoc(withdrawalRef, updateData);
            showToast(`Withdrawal ${newStatus.toLowerCase()} successfully`);
        } catch (error) {
            console.error('Error updating withdrawal:', error);
            showToast('Failed to update: ' + error.message, 'error');
        }
        setSaving(false);
    };

    // -- Wallets --
    const handleEditWallet = async (walletId, data) => {
        setSaving(true);
        try {
            const walletRef = doc(db, 'wallets', walletId);
            const updateData = { updatedAt: new Date().toISOString() };
            if (data.balance !== undefined) updateData.balance = Number(data.balance);
            if (data.lockedBalance !== undefined) updateData.lockedBalance = Number(data.lockedBalance);
            if (data.totalEarnings !== undefined) updateData.totalEarnings = Number(data.totalEarnings);
            if (data.totalSpent !== undefined) updateData.totalSpent = Number(data.totalSpent);
            await updateDoc(walletRef, updateData);
            showToast('Wallet updated successfully');
            setEditingItem(null);
        } catch (error) {
            console.error('Error updating wallet:', error);
            showToast('Failed to update wallet: ' + error.message, 'error');
        }
        setSaving(false);
    };

    return (
        <div className="admin-page" style={{
            minHeight: '100vh',
            width: '100%',
            background: '#F3F4F6',
            position: 'fixed',
            inset: 0,
            overflow: 'auto',
        }}>
            {/* Header */}
            <header style={{
                background: 'white',
                borderBottom: '1px solid #E5E7EB',
                padding: '12px 20px',
                position: 'sticky',
                top: 0,
                zIndex: 50,
                width: '100%',
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button
                            onClick={() => router.push('/')}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                padding: 8,
                                color: '#666',
                            }}
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#111' }}>
                            Admin Dashboard
                        </h1>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 12px',
                            borderRadius: 20,
                            background: '#D1FAE5',
                        }}>
                            <div style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: '#22C55E',
                                animation: 'pulse 2s infinite',
                            }} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#059669' }}>
                                LIVE
                            </span>
                        </div>
                        <button
                            onClick={async () => {
                                await signOut(auth);
                                localStorage.removeItem('userEmail');
                                router.push('/login');
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '8px 16px',
                                borderRadius: 10,
                                background: '#FEE2E2',
                                border: '1px solid #FECACA',
                                color: '#DC2626',
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                        >
                            <LogOut size={16} />
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Tabs */}
            <div style={{
                background: 'white',
                borderBottom: '1px solid #E5E7EB',
                padding: '0 12px',
                width: '100%',
            }}>
                <div style={{
                    display: 'flex',
                    gap: 0,
                    overflowX: 'auto',
                    width: '100%',
                }}>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                padding: '12px 16px',
                                border: 'none',
                                background: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                color: activeTab === tab.id ? '#22C55E' : '#666',
                                fontWeight: activeTab === tab.id ? 600 : 500,
                                borderBottom: activeTab === tab.id ? '2px solid #22C55E' : '2px solid transparent',
                                whiteSpace: 'nowrap',
                                fontSize: 14,
                            }}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div style={{
                padding: 16,
                width: '100%',
                boxSizing: 'border-box',
            }}>
                {activeTab === 'overview' && <OverviewTab stats={stats} adminWallet={adminWallet} allWallets={allWallets} users={users} transactions={transactions} />}
                {activeTab === 'users' && (
                    <UsersTab
                        users={users}
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        onEdit={(user) => setEditingItem({ type: 'user', data: user })}
                        onDelete={(user) => setConfirmDelete({ type: 'user', data: user })}
                        onView={(user) => setViewingUser(user)}
                    />
                )}
                {activeTab === 'meetings' && (
                    <MeetingsTab
                        meetings={meetings}
                        users={users}
                        onEdit={(meeting) => setEditingItem({ type: 'meeting', data: meeting })}
                        onDelete={(meeting) => setConfirmDelete({ type: 'meeting', data: meeting })}
                    />
                )}
                {activeTab === 'transactions' && (
                    <TransactionsTab
                        transactions={transactions}
                        users={users}
                        onEdit={(tx) => setEditingItem({ type: 'transaction', data: tx })}
                        onDelete={(tx) => setConfirmDelete({ type: 'transaction', data: tx })}
                    />
                )}
                {activeTab === 'matches' && (
                    <MatchesTab
                        matches={matches}
                        users={users}
                        onDelete={(match) => setConfirmDelete({ type: 'match', data: match })}
                    />
                )}
                {activeTab === 'chats' && (
                    <ChatsTab
                        chats={chats}
                        users={users}
                        onView={(chat) => { setViewingChat(chat); loadChatMessages(chat.id); }}
                        onDelete={(chat) => setConfirmDelete({ type: 'chat', data: chat })}
                    />
                )}
                {activeTab === 'wallets' && (
                    <WalletsTab
                        wallets={allWallets}
                        users={users}
                        transactions={transactions}
                        onEdit={(wallet) => setEditingItem({ type: 'wallet', data: wallet })}
                    />
                )}
                {activeTab === 'withdrawals' && (
                    <WithdrawalsTab
                        withdrawals={withdrawals}
                        users={users}
                        transactions={transactions}
                        onUpdateStatus={handleUpdateWithdrawalStatus}
                        onViewEarnings={(seeker) => setViewingEarnings(seeker)}
                        saving={saving}
                    />
                )}
            </div>

            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <Toast
                        message={toast.message}
                        type={toast.type}
                        onClose={() => setToast(null)}
                    />
                )}
            </AnimatePresence>

            {/* Confirm Delete Modal */}
            {confirmDelete && (
                <ConfirmModal
                    title={`Delete ${confirmDelete.type === 'user' ? 'User' : confirmDelete.type === 'meeting' ? 'Meeting' : confirmDelete.type === 'transaction' ? 'Transaction' : confirmDelete.type === 'chat' ? 'Chat' : 'Match'}?`}
                    message={
                        confirmDelete.type === 'user'
                            ? `Are you sure you want to delete "${confirmDelete.data.profile?.name || confirmDelete.data.profile?.companyName || confirmDelete.data.email}"? This action is permanent and cannot be undone.`
                            : confirmDelete.type === 'meeting'
                                ? `Are you sure you want to delete this meeting (${confirmDelete.data.status?.replace('_', ' ')})? This action is permanent.`
                                : confirmDelete.type === 'transaction'
                                    ? `Are you sure you want to delete this ₹${confirmDelete.data.amount} ${confirmDelete.data.type?.replace(/_/g, ' ')} transaction? This action is permanent.`
                                    : confirmDelete.type === 'chat'
                                        ? `Are you sure you want to delete this chat and all its messages? This action is permanent.`
                                        : `Are you sure you want to delete this match? Both users will lose the match. This action is permanent.`
                    }
                    loading={saving}
                    onCancel={() => setConfirmDelete(null)}
                    onConfirm={() => {
                        if (confirmDelete.type === 'user') handleDeleteUser(confirmDelete.data.id);
                        else if (confirmDelete.type === 'meeting') handleDeleteMeeting(confirmDelete.data.id);
                        else if (confirmDelete.type === 'transaction') handleDeleteTransaction(confirmDelete.data.id);
                        else if (confirmDelete.type === 'match') handleDeleteMatch(confirmDelete.data);
                        else if (confirmDelete.type === 'chat') handleDeleteChat(confirmDelete.data.id);
                    }}
                />
            )}

            {/* Edit Modals */}
            {editingItem?.type === 'user' && (
                <EditUserModal
                    user={editingItem.data}
                    loading={saving}
                    onClose={() => setEditingItem(null)}
                    onSave={handleEditUser}
                />
            )}
            {editingItem?.type === 'meeting' && (
                <EditMeetingModal
                    meeting={editingItem.data}
                    loading={saving}
                    onClose={() => setEditingItem(null)}
                    onSave={handleEditMeeting}
                />
            )}
            {editingItem?.type === 'transaction' && (
                <EditTransactionModal
                    transaction={editingItem.data}
                    loading={saving}
                    onClose={() => setEditingItem(null)}
                    onSave={handleEditTransaction}
                />
            )}
            {editingItem?.type === 'wallet' && (
                <EditWalletModal
                    wallet={editingItem.data}
                    users={users}
                    loading={saving}
                    onClose={() => setEditingItem(null)}
                    onSave={handleEditWallet}
                />
            )}

            {/* View Profile Modal */}
            {viewingUser && (
                <ViewProfileModal
                    user={viewingUser}
                    onClose={() => setViewingUser(null)}
                />
            )}

            {/* View Chat Messages Modal */}
            {viewingChat && (
                <ViewChatModal
                    chat={viewingChat}
                    messages={chatMessages}
                    users={users}
                    onClose={() => { setViewingChat(null); setChatMessages([]); }}
                />
            )}

            {/* View Earning History Modal */}
            {viewingEarnings && (
                <EarningHistoryModal
                    seeker={viewingEarnings}
                    transactions={transactions}
                    users={users}
                    onClose={() => setViewingEarnings(null)}
                />
            )}

            <style jsx global>{`
                .spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.2); }
                }
                /* Responsive table styles */
                .admin-page table {
                    width: 100%;
                    min-width: 600px;
                }
                .admin-page td, .admin-page th {
                    padding: 10px 12px !important;
                    font-size: 13px !important;
                }
                @media (max-width: 768px) {
                    .admin-page td, .admin-page th {
                        padding: 8px 10px !important;
                        font-size: 12px !important;
                    }
                }
            `}</style>
        </div >
    );
}

// ============ EDIT USER MODAL ============
function EditUserModal({ user, loading, onClose, onSave }) {
    const isCompany = user.role === 'company';
    const [email, setEmail] = useState(user.email || '');
    const [profileComplete, setProfileComplete] = useState(user.profileComplete || false);
    const [profile, setProfile] = useState({ ...user.profile } || {});

    const updateProfile = (key, value) => setProfile(prev => ({ ...prev, [key]: value }));

    const handleSave = () => {
        onSave(user.id, { email, profileComplete, profile });
    };

    return (
        <EditModal title={`Edit ${isCompany ? 'Company' : 'Seeker'}`} onClose={onClose} onSave={handleSave} loading={loading}>
            <div style={{ maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Common Fields */}
                <div style={{ padding: 8, background: '#F0FDF4', borderRadius: 8, fontSize: 11, color: '#059669', fontWeight: 600, textTransform: 'uppercase' }}>
                    Account Info
                </div>
                <FormField label="Email">
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
                </FormField>
                <FormField label="Profile Complete">
                    <select value={profileComplete ? 'true' : 'false'} onChange={e => setProfileComplete(e.target.value === 'true')} style={selectStyle}>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                    </select>
                </FormField>

                {isCompany ? (
                    <>
                        {/* Company Fields */}
                        <div style={{ padding: 8, background: '#EEF2FF', borderRadius: 8, fontSize: 11, color: '#4F46E5', fontWeight: 600, textTransform: 'uppercase', marginTop: 8 }}>
                            Company Profile
                        </div>
                        <FormField label="Company Name">
                            <input type="text" value={profile.companyName || ''} onChange={e => updateProfile('companyName', e.target.value)} style={inputStyle} />
                        </FormField>
                        <FormField label="Tagline">
                            <input type="text" value={profile.tagline || ''} onChange={e => updateProfile('tagline', e.target.value)} style={inputStyle} />
                        </FormField>
                        <FormField label="Phone">
                            <input type="tel" value={profile.phone || ''} onChange={e => updateProfile('phone', e.target.value)} style={inputStyle} />
                        </FormField>
                        <FormField label="Email (Profile)">
                            <input type="email" value={profile.email || ''} onChange={e => updateProfile('email', e.target.value)} style={inputStyle} />
                        </FormField>
                        <FormField label="Years in Business">
                            <input type="text" value={profile.yearsInBusiness || ''} onChange={e => updateProfile('yearsInBusiness', e.target.value)} style={inputStyle} />
                        </FormField>
                        <FormField label="City">
                            <input type="text" value={profile.city || ''} onChange={e => updateProfile('city', e.target.value)} style={inputStyle} />
                        </FormField>
                        <FormField label="Service Areas (comma-separated)">
                            <input type="text" value={(profile.serviceAreas || []).join(', ')} onChange={e => updateProfile('serviceAreas', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} style={inputStyle} />
                        </FormField>
                        <FormField label="Services (comma-separated)">
                            <input type="text" value={(profile.services || []).join(', ')} onChange={e => updateProfile('services', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} style={inputStyle} />
                        </FormField>
                        <FormField label="Specializations (comma-separated)">
                            <input type="text" value={(profile.specializations || []).join(', ')} onChange={e => updateProfile('specializations', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} style={inputStyle} />
                        </FormField>
                        <FormField label="Portfolio Description">
                            <textarea value={profile.portfolioDescription || ''} onChange={e => updateProfile('portfolioDescription', e.target.value)} style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} />
                        </FormField>
                        <FormField label="Projects Completed">
                            <input type="text" value={profile.projectsCompleted || ''} onChange={e => updateProfile('projectsCompleted', e.target.value)} style={inputStyle} />
                        </FormField>
                        <FormField label="Min Budget (₹)">
                            <input type="text" value={profile.minBudget || ''} onChange={e => updateProfile('minBudget', e.target.value)} style={inputStyle} />
                        </FormField>
                        <FormField label="Max Budget (₹)">
                            <input type="text" value={profile.maxBudget || ''} onChange={e => updateProfile('maxBudget', e.target.value)} style={inputStyle} />
                        </FormField>
                        {/* Portfolio Images (read-only count) */}
                        <div style={{ padding: 12, borderRadius: 10, background: '#F9FAFB', border: '1px solid #E5E7EB', fontSize: 12, color: '#888' }}>
                            <strong>Portfolio Images:</strong> {(profile.portfolioImages || []).length} images uploaded
                        </div>
                    </>
                ) : (
                    <>
                        {/* Seeker Fields */}
                        <div style={{ padding: 8, background: '#F0FDF4', borderRadius: 8, fontSize: 11, color: '#16A34A', fontWeight: 600, textTransform: 'uppercase', marginTop: 8 }}>
                            Seeker Profile
                        </div>
                        <FormField label="Name">
                            <input type="text" value={profile.name || ''} onChange={e => updateProfile('name', e.target.value)} style={inputStyle} />
                        </FormField>
                        <FormField label="Phone">
                            <input type="tel" value={profile.phone || ''} onChange={e => updateProfile('phone', e.target.value)} style={inputStyle} />
                        </FormField>
                        <FormField label="City">
                            <input type="text" value={profile.city || ''} onChange={e => updateProfile('city', e.target.value)} style={inputStyle} />
                        </FormField>
                        <FormField label="Locality">
                            <input type="text" value={profile.locality || ''} onChange={e => updateProfile('locality', e.target.value)} style={inputStyle} />
                        </FormField>
                        <FormField label="Property Type">
                            <input type="text" value={profile.propertyType || ''} onChange={e => updateProfile('propertyType', e.target.value)} style={inputStyle} />
                        </FormField>
                        <FormField label="Styles (comma-separated)">
                            <input type="text" value={(profile.styles || []).join(', ')} onChange={e => updateProfile('styles', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} style={inputStyle} />
                        </FormField>
                        <FormField label="Rooms (comma-separated)">
                            <input type="text" value={(profile.rooms || []).join(', ')} onChange={e => updateProfile('rooms', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} style={inputStyle} />
                        </FormField>
                        <FormField label="Budget">
                            <input type="text" value={profile.budget || ''} onChange={e => updateProfile('budget', e.target.value)} style={inputStyle} />
                        </FormField>
                        <FormField label="Timeline">
                            <input type="text" value={profile.timeline || ''} onChange={e => updateProfile('timeline', e.target.value)} style={inputStyle} />
                        </FormField>
                    </>
                )}

                <div style={{ padding: 12, borderRadius: 10, background: '#F9FAFB', border: '1px solid #E5E7EB', fontSize: 12, color: '#888' }}>
                    <strong>User ID:</strong> {user.id}<br />
                    <strong>Role:</strong> {isCompany ? 'Company' : 'Seeker'}
                </div>
            </div>
        </EditModal>
    );
}

// ============ EDIT MEETING MODAL ============
function EditMeetingModal({ meeting, loading, onClose, onSave }) {
    const [status, setStatus] = useState(meeting.status || '');
    const [scheduledAt, setScheduledAt] = useState(() => {
        if (!meeting.scheduledAt) return '';
        // Convert UTC ISO string to local datetime-local format (YYYY-MM-DDTHH:MM)
        const d = new Date(meeting.scheduledAt);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    });
    const [notes, setNotes] = useState(meeting.notes || '');

    const handleSave = () => {
        onSave(meeting.id, {
            status,
            scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : meeting.scheduledAt,
            notes,
        });
    };

    return (
        <EditModal title="Edit Meeting" onClose={onClose} onSave={handleSave} loading={loading}>
            <FormField label="Status">
                <select value={status} onChange={e => setStatus(e.target.value)} style={selectStyle}>
                    <option value="PENDING_ACCEPTANCE">Pending Acceptance</option>
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="CONFIRMED">Confirmed</option>
                    <option value="CANCELLED">Cancelled</option>
                    <option value="DECLINED">Declined</option>
                    <option value="DISPUTE">Dispute</option>
                </select>
            </FormField>
            <FormField label="Scheduled At">
                <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={e => setScheduledAt(e.target.value)}
                    style={inputStyle}
                />
            </FormField>
            <FormField label="Notes">
                <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                    placeholder="Meeting notes..."
                />
            </FormField>
            <div style={{
                padding: 12, borderRadius: 10, background: '#F9FAFB',
                border: '1px solid #E5E7EB', fontSize: 12, color: '#888',
            }}>
                <strong>Meeting ID:</strong> {meeting.id}<br />
                <strong>Company ID:</strong> {meeting.companyId}<br />
                <strong>Seeker ID:</strong> {meeting.seekerId}
            </div>
        </EditModal>
    );
}

// ============ EDIT TRANSACTION MODAL ============
function EditTransactionModal({ transaction, loading, onClose, onSave }) {
    const [status, setStatus] = useState(transaction.status || '');
    const [amount, setAmount] = useState(transaction.amount || 0);

    const handleSave = () => {
        onSave(transaction.id, { status, amount: Number(amount) });
    };

    return (
        <EditModal title="Edit Transaction" onClose={onClose} onSave={handleSave} loading={loading}>
            <FormField label="Status">
                <select value={status} onChange={e => setStatus(e.target.value)} style={selectStyle}>
                    <option value="COMPLETED">Completed</option>
                    <option value="PENDING">Pending</option>
                    <option value="FAILED">Failed</option>
                    <option value="REFUNDED">Refunded</option>
                </select>
            </FormField>
            <FormField label="Amount (₹)">
                <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    style={inputStyle}
                    min="0"
                />
            </FormField>
            <FormField label="Type">
                <div style={{
                    padding: '10px 14px', borderRadius: 10,
                    border: '1px solid #E5E7EB', background: '#F3F4F6',
                    fontSize: 14, color: '#888',
                }}>
                    {transaction.type?.replace(/_/g, ' ')} (read-only)
                </div>
            </FormField>
            <div style={{
                padding: 12, borderRadius: 10, background: '#F9FAFB',
                border: '1px solid #E5E7EB', fontSize: 12, color: '#888',
            }}>
                <strong>Transaction ID:</strong> {transaction.id}<br />
                <strong>User ID:</strong> {transaction.userId}<br />
                <strong>Created:</strong> {transaction.createdAt ? new Date(transaction.createdAt).toLocaleString() : 'N/A'}
            </div>
        </EditModal>
    );
}

// ============ OVERVIEW TAB ============
function OverviewTab({ stats, adminWallet, allWallets, users, transactions }) {
    if (!stats) return null;

    const walletBalance = adminWallet?.balance || 0;
    const walletEarnings = adminWallet?.totalEarnings || 0;
    const meetingsEarned = Math.floor(walletEarnings / 250);

    // Calculate wallet totals
    const adminWallets = allWallets.filter(w => w.type === 'ADMIN');
    const companyWallets = allWallets.filter(w => w.type === 'COMPANY');
    const seekerWallets = allWallets.filter(w => w.type === 'SEEKER');

    const adminTotal = adminWallets.reduce((sum, w) => sum + (w.balance || 0), 0);
    const companyTotal = companyWallets.reduce((sum, w) => sum + (w.balance || 0), 0);
    const seekerAvailable = seekerWallets.reduce((sum, w) => sum + (w.balance || 0), 0);
    const seekerLocked = seekerWallets.reduce((sum, w) => sum + (w.lockedBalance || 0), 0);
    const seekerTotal = seekerAvailable + seekerLocked;
    const grandTotal = adminTotal + companyTotal + seekerTotal;

    // Razorpay top-ups total
    const razorpayTopUps = (transactions || []).filter(t =>
        (t.type === 'WALLET_TOP_UP' || t.type === 'TOP_UP') && t.status === 'COMPLETED'
    ).reduce((sum, t) => sum + (t.amount || 0), 0);

    const statCards = [
        { label: 'Total Users', value: stats.totalUsers, icon: Users, color: '#3B82F6' },
        { label: 'Companies', value: stats.companies, icon: Building2, color: '#8B5CF6' },
        { label: 'Seekers', value: stats.designers, icon: Palette, color: '#EC4899' },
        { label: 'Total Matches', value: stats.totalMatches, icon: MessageCircle, color: '#F59E0B' },
        { label: 'Total Meetings', value: stats.totalMeetings, icon: Calendar, color: '#22C55E' },
        { label: 'Confirmed Meetings', value: stats.confirmedMeetings, icon: CheckCircle, color: '#10B981' },
        { label: 'Pending Meetings', value: stats.pendingMeetings, icon: Clock, color: '#F97316' },
        { label: 'Total Revenue', value: `₹${stats.totalRevenue.toLocaleString()}`, icon: DollarSign, color: '#22C55E' },
    ];

    const walletRows = [
        { label: 'Plyship (Admin)', amount: adminTotal, color: '#059669', count: adminWallets.length },
        { label: 'Companies', amount: companyTotal, color: '#3B82F6', count: companyWallets.length },
        { label: 'Seekers (Available)', amount: seekerAvailable, color: '#8B5CF6', count: seekerWallets.length },
        { label: 'Seekers (Locked)', amount: seekerLocked, color: '#F59E0B', count: seekerWallets.length },
    ];

    return (
        <div>
            {/* Admin Wallet Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                    padding: 24,
                    borderRadius: 16,
                    background: 'linear-gradient(135deg, #059669 0%, #10B981 50%, #34D399 100%)',
                    marginBottom: 20,
                    color: 'white',
                    boxShadow: '0 4px 20px rgba(5, 150, 105, 0.3)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                    <div>
                        <p style={{ fontSize: 13, opacity: 0.85, marginBottom: 4 }}>💰 Admin Wallet Balance</p>
                        <p style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1 }}>₹{walletBalance.toLocaleString()}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 24 }}>
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: 11, opacity: 0.75 }}>Total Earned</p>
                            <p style={{ fontSize: 20, fontWeight: 700 }}>₹{walletEarnings.toLocaleString()}</p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: 11, opacity: 0.75 }}>From Meetings</p>
                            <p style={{ fontSize: 20, fontWeight: 700 }}>{meetingsEarned}</p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: 11, opacity: 0.75 }}>Per Meeting</p>
                            <p style={{ fontSize: 20, fontWeight: 700 }}>₹250</p>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* All Wallets Breakdown */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                style={{
                    padding: 20,
                    borderRadius: 16,
                    background: 'white',
                    marginBottom: 20,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                }}
            >
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#111' }}>📊 All Wallets Breakdown</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #E5E7EB' }}>
                            <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: '#666', fontWeight: 600 }}>WALLET</th>
                            <th style={{ textAlign: 'center', padding: '8px 12px', fontSize: 12, color: '#666', fontWeight: 600 }}>COUNT</th>
                            <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 12, color: '#666', fontWeight: 600 }}>BALANCE</th>
                        </tr>
                    </thead>
                    <tbody>
                        {walletRows.map((row, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                                <td style={{ padding: '10px 12px', fontSize: 14, fontWeight: 500 }}>
                                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: row.color, marginRight: 8 }} />
                                    {row.label}
                                </td>
                                <td style={{ padding: '10px 12px', fontSize: 13, color: '#888', textAlign: 'center' }}>{row.count}</td>
                                <td style={{ padding: '10px 12px', fontSize: 15, fontWeight: 600, textAlign: 'right', color: row.color }}>₹{row.amount.toLocaleString()}</td>
                            </tr>
                        ))}
                        <tr style={{ borderTop: '2px solid #111' }}>
                            <td style={{ padding: '12px 12px', fontSize: 15, fontWeight: 700 }}>Grand Total (All Wallets)</td>
                            <td></td>
                            <td style={{ padding: '12px 12px', fontSize: 18, fontWeight: 800, textAlign: 'right', color: '#111' }}>₹{grandTotal.toLocaleString()}</td>
                        </tr>
                    </tbody>
                </table>

                {/* Razorpay cross-check */}
                <div style={{ marginTop: 16, padding: 12, background: '#F0FDF4', borderRadius: 10, border: '1px solid #BBF7D0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <div>
                            <p style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>💳 Razorpay Cross-Check</p>
                            <p style={{ fontSize: 11, color: '#666', marginTop: 2 }}>Total top-ups received via Razorpay should match: Grand Total + Total Spent by companies</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: 11, color: '#888' }}>Total Top-Ups</p>
                            <p style={{ fontSize: 20, fontWeight: 700, color: '#059669' }}>₹{razorpayTopUps.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Stat Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                {statCards.map((card, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        style={{
                            padding: 20,
                            borderRadius: 12,
                            background: 'white',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                                width: 40,
                                height: 40,
                                borderRadius: 10,
                                background: `${card.color}15`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}>
                                <card.icon size={20} color={card.color} />
                            </div>
                            <div>
                                <p style={{ fontSize: 12, color: '#888' }}>{card.label}</p>
                                <p style={{ fontSize: 22, fontWeight: 700, color: '#111' }}>{card.value}</p>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

// ============ USERS TAB ============
function UsersTab({ users, searchTerm, setSearchTerm, onEdit, onDelete, onView }) {
    const filtered = users.filter(u =>
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.profile?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.profile?.companyName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div>
            {/* Search */}
            <div style={{ marginBottom: 20 }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 16px',
                    background: 'white',
                    borderRadius: 10,
                    border: '1px solid #E5E7EB',
                    maxWidth: 400,
                }}>
                    <Search size={18} color="#888" />
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{
                            border: 'none',
                            outline: 'none',
                            flex: 1,
                            fontSize: 14,
                        }}
                    />
                </div>
            </div>

            {/* Table */}
            <div style={{
                background: 'white',
                borderRadius: 12,
                overflow: 'auto',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#F9FAFB' }}>
                            <th style={thStyle}>Name</th>
                            <th style={thStyle}>Email</th>
                            <th style={thStyle}>Phone</th>
                            <th style={thStyle}>Role</th>
                            <th style={thStyle}>City</th>
                            <th style={thStyle}>Profile</th>
                            <th style={thStyle}>Joined</th>
                            <th style={thStyle}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(user => (
                            <tr key={user.id} style={{ borderTop: '1px solid #E5E7EB' }}>
                                <td style={tdStyle}>
                                    {user.profile?.name || user.profile?.companyName || 'N/A'}
                                </td>
                                <td style={tdStyle}>{user.email}</td>
                                <td style={tdStyle}>
                                    <span style={{ fontSize: 13, color: '#555' }}>
                                        {user.profile?.phone || '—'}
                                    </span>
                                </td>
                                <td style={tdStyle}>
                                    <span style={{
                                        padding: '4px 10px',
                                        borderRadius: 20,
                                        fontSize: 12,
                                        fontWeight: 500,
                                        background: user.role === 'company' ? '#EEF2FF' : '#F0FDF4',
                                        color: user.role === 'company' ? '#4F46E5' : '#16A34A',
                                    }}>
                                        {user.role === 'company' ? 'Company' : 'Seeker'}
                                    </span>
                                </td>
                                <td style={tdStyle}>
                                    <span style={{ fontSize: 13, color: '#555' }}>
                                        {user.profile?.city || '—'}
                                    </span>
                                </td>
                                <td style={tdStyle}>
                                    {user.profileComplete ? (
                                        <CheckCircle size={16} color="#22C55E" />
                                    ) : (
                                        <XCircle size={16} color="#EF4444" />
                                    )}
                                </td>
                                <td style={tdStyle}>
                                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                                </td>
                                <td style={tdStyle}>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button onClick={() => onView(user)} style={{
                                            padding: '6px 8px', borderRadius: 8, border: '1px solid #E5E7EB',
                                            background: '#F0F9FF', cursor: 'pointer', display: 'flex', alignItems: 'center',
                                        }} title="View Profile">
                                            <Eye size={15} color="#3B82F6" />
                                        </button>
                                        <button onClick={() => onEdit(user)} style={{
                                            padding: '6px 8px', borderRadius: 8, border: '1px solid #E5E7EB',
                                            background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center',
                                        }} title="Edit">
                                            <Pencil size={15} color="#F59E0B" />
                                        </button>
                                        <button onClick={() => onDelete(user)} style={{
                                            padding: '6px 8px', borderRadius: 8, border: '1px solid #FEE2E2',
                                            background: '#FEF2F2', cursor: 'pointer', display: 'flex', alignItems: 'center',
                                        }} title="Delete">
                                            <Trash2 size={15} color="#EF4444" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p style={{ marginTop: 12, fontSize: 13, color: '#888' }}>
                Showing {filtered.length} of {users.length} users
            </p>
        </div>
    );
}

// ============ MEETINGS TAB ============
function MeetingsTab({ meetings, users, onEdit, onDelete }) {
    const [searchTerm, setSearchTerm] = useState('');
    const getUser = (id) => users.find(u => u.id === id);

    const statusColors = {
        'PENDING_ACCEPTANCE': { bg: '#FEF3C7', color: '#D97706' },
        'SCHEDULED': { bg: '#DBEAFE', color: '#2563EB' },
        'CONFIRMED': { bg: '#D1FAE5', color: '#059669' },
        'CANCELLED': { bg: '#FEE2E2', color: '#DC2626' },
        'DECLINED': { bg: '#FEE2E2', color: '#DC2626' },
        'DISPUTE': { bg: '#FDE68A', color: '#B45309' },
    };

    const s = searchTerm.toLowerCase();
    const filtered = meetings.filter(meeting => {
        const company = getUser(meeting.companyId);
        const seeker = getUser(meeting.seekerId);
        return !s ||
            company?.profile?.companyName?.toLowerCase().includes(s) ||
            company?.email?.toLowerCase().includes(s) ||
            company?.profile?.phone?.toLowerCase().includes(s) ||
            seeker?.profile?.name?.toLowerCase().includes(s) ||
            seeker?.email?.toLowerCase().includes(s) ||
            seeker?.profile?.phone?.toLowerCase().includes(s) ||
            meeting.status?.toLowerCase().includes(s);
    });

    return (
        <div>
            <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', maxWidth: 400 }}>
                    <Search size={18} color="#888" />
                    <input type="text" placeholder="Search meetings..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ border: 'none', outline: 'none', flex: 1, fontSize: 14 }} />
                </div>
            </div>
            <div style={{
                background: 'white',
                borderRadius: 12,
                overflow: 'auto',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#F9FAFB' }}>
                            <th style={thStyle}>Company</th>
                            <th style={thStyle}>Seeker</th>
                            <th style={thStyle}>Status</th>
                            <th style={thStyle}>Scheduled</th>
                            <th style={thStyle}>Created</th>
                            <th style={thStyle}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(meeting => {
                            const company = getUser(meeting.companyId);
                            const designer = getUser(meeting.seekerId);
                            const sc = statusColors[meeting.status] || { bg: '#F3F4F6', color: '#666' };

                            return (
                                <tr key={meeting.id} style={{ borderTop: '1px solid #E5E7EB' }}>
                                    <td style={tdStyle}>
                                        <div>{company?.profile?.companyName || company?.email || 'Unknown'}</div>
                                        {company?.email && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{company.email}</div>}
                                        {company?.profile?.phone && <div style={{ fontSize: 11, color: '#888' }}>{company.profile.phone}</div>}
                                    </td>
                                    <td style={tdStyle}>
                                        <div>{designer?.profile?.name || designer?.email || 'Unknown'}</div>
                                        {designer?.email && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{designer.email}</div>}
                                        {designer?.profile?.phone && <div style={{ fontSize: 11, color: '#888' }}>{designer.profile.phone}</div>}
                                    </td>
                                    <td style={tdStyle}>
                                        <span style={{
                                            padding: '4px 10px',
                                            borderRadius: 20,
                                            fontSize: 12,
                                            fontWeight: 500,
                                            background: sc.bg,
                                            color: sc.color,
                                        }}>
                                            {meeting.status?.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td style={tdStyle}>
                                        {meeting.scheduledAt ? new Date(meeting.scheduledAt).toLocaleString() : 'N/A'}
                                    </td>
                                    <td style={tdStyle}>
                                        {meeting.createdAt ? new Date(meeting.createdAt).toLocaleDateString() : 'N/A'}
                                    </td>
                                    <td style={tdStyle}>
                                        <ActionButtons
                                            onEdit={() => onEdit(meeting)}
                                            onDelete={() => onDelete(meeting)}
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <p style={{ padding: 12, fontSize: 13, color: '#888' }}>
                    Showing {filtered.length} of {meetings.length} meetings
                </p>
            </div>
        </div>
    );
}

// ============ TRANSACTIONS TAB ============
function TransactionsTab({ transactions, users, onEdit, onDelete }) {
    const [searchTerm, setSearchTerm] = useState('');
    const getUserInfo = (id) => {
        if (id === 'admin_wallet') return { name: 'Plyship (Admin)', email: 'admin', phone: null };
        const u = users.find(u => u.id === id);
        if (!u) return { name: 'Unknown', email: null, phone: null };
        return {
            name: u.profile?.name || u.profile?.companyName || u.email || 'Unknown',
            email: u.email || null,
            phone: u.profile?.phone || null,
        };
    };

    const s = searchTerm.toLowerCase();
    const filtered = transactions.filter(tx => {
        const userInfo = getUserInfo(tx.userId);
        const relatedInfo = tx.relatedUserId ? getUserInfo(tx.relatedUserId) : null;
        return !s ||
            userInfo.name?.toLowerCase().includes(s) ||
            userInfo.email?.toLowerCase().includes(s) ||
            userInfo.phone?.toLowerCase().includes(s) ||
            relatedInfo?.name?.toLowerCase().includes(s) ||
            relatedInfo?.email?.toLowerCase().includes(s) ||
            tx.type?.toLowerCase().includes(s) ||
            tx.status?.toLowerCase().includes(s) ||
            tx.reason?.toLowerCase().includes(s);
    });

    return (
        <div>
            <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', maxWidth: 400 }}>
                    <Search size={18} color="#888" />
                    <input type="text" placeholder="Search transactions..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ border: 'none', outline: 'none', flex: 1, fontSize: 14 }} />
                </div>
            </div>
            <div style={{
                background: 'white',
                borderRadius: 12,
                overflow: 'auto',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#F9FAFB' }}>
                            <th style={thStyle}>User</th>
                            <th style={thStyle}>Related To</th>
                            <th style={thStyle}>Type</th>
                            <th style={thStyle}>Reason</th>
                            <th style={thStyle}>Amount</th>
                            <th style={thStyle}>Status</th>
                            <th style={thStyle}>Date</th>
                            <th style={thStyle}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(tx => {
                            const userInfo = getUserInfo(tx.userId);
                            const relatedInfo = tx.relatedUserId ? getUserInfo(tx.relatedUserId) : null;
                            const isCredit = ['WALLET_TOP_UP', 'MEETING_EARNING', 'CREDIT', 'TOP_UP', 'LOCK'].includes(tx.type);

                            return (
                                <tr key={tx.id} style={{ borderTop: '1px solid #E5E7EB' }}>
                                    <td style={tdStyle}>
                                        <div style={{ fontWeight: 500 }}>{userInfo.name}</div>
                                        {userInfo.email && userInfo.email !== 'admin' && (
                                            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{userInfo.email}</div>
                                        )}
                                        {userInfo.phone && (
                                            <div style={{ fontSize: 11, color: '#888' }}>{userInfo.phone}</div>
                                        )}
                                    </td>
                                    <td style={tdStyle}>
                                        {relatedInfo ? (
                                            <>
                                                <div style={{ fontWeight: 500 }}>{relatedInfo.name}</div>
                                                {relatedInfo.email && relatedInfo.email !== 'admin' && (
                                                    <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{relatedInfo.email}</div>
                                                )}
                                                {relatedInfo.phone && (
                                                    <div style={{ fontSize: 11, color: '#888' }}>{relatedInfo.phone}</div>
                                                )}
                                            </>
                                        ) : (
                                            <span style={{ color: '#ccc' }}>—</span>
                                        )}
                                    </td>
                                    <td style={tdStyle}>
                                        <span style={{ fontSize: 13 }}>
                                            {tx.type?.replace(/_/g, ' ')}
                                        </span>
                                    </td>
                                    <td style={tdStyle}>
                                        <span style={{ fontSize: 12, color: '#666' }}>
                                            {tx.reason?.replace(/_/g, ' ') || '—'}
                                        </span>
                                    </td>
                                    <td style={tdStyle}>
                                        <span style={{
                                            color: isCredit ? '#22C55E' : '#EF4444',
                                            fontWeight: 600,
                                        }}>
                                            {isCredit ? '+' : '-'}₹{tx.amount}
                                        </span>
                                    </td>
                                    <td style={tdStyle}>
                                        <span style={{
                                            padding: '4px 10px',
                                            borderRadius: 20,
                                            fontSize: 12,
                                            fontWeight: 500,
                                            background: tx.status === 'COMPLETED' ? '#D1FAE5'
                                                : tx.status === 'REFUNDED' ? '#FEE2E2'
                                                    : '#FEF3C7',
                                            color: tx.status === 'COMPLETED' ? '#059669'
                                                : tx.status === 'REFUNDED' ? '#DC2626'
                                                    : '#D97706',
                                        }}>
                                            {tx.status}
                                        </span>
                                    </td>
                                    <td style={tdStyle}>
                                        {tx.createdAt ? new Date(tx.createdAt).toLocaleString() : 'N/A'}
                                    </td>
                                    <td style={tdStyle}>
                                        <ActionButtons
                                            onEdit={() => onEdit(tx)}
                                            onDelete={() => onDelete(tx)}
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <p style={{ padding: 12, fontSize: 13, color: '#888' }}>
                    Showing {filtered.length} of {transactions.length} transactions
                </p>
            </div>
        </div>
    );
}

// ============ MATCHES TAB ============
function MatchesTab({ matches, users, onDelete }) {
    const [searchTerm, setSearchTerm] = useState('');
    const getUser = (id) => users.find(u => u.id === id);

    // Deduplicate matches (each match is stored twice - once for each user)
    const uniqueMatches = [];
    const seenPairs = new Set();

    matches.forEach(match => {
        if (!match.users || match.users.length < 2) return;

        const pairKey = match.users.sort().join('-');
        if (!seenPairs.has(pairKey)) {
            seenPairs.add(pairKey);
            uniqueMatches.push(match);
        }
    });

    const s = searchTerm.toLowerCase();
    const filtered = uniqueMatches.filter(match => {
        const user1 = match.users?.[0] ? getUser(match.users[0]) : null;
        const user2 = match.users?.[1] ? getUser(match.users[1]) : null;
        return !s ||
            user1?.profile?.companyName?.toLowerCase().includes(s) ||
            user1?.profile?.name?.toLowerCase().includes(s) ||
            user1?.email?.toLowerCase().includes(s) ||
            user1?.profile?.phone?.toLowerCase().includes(s) ||
            user2?.profile?.companyName?.toLowerCase().includes(s) ||
            user2?.profile?.name?.toLowerCase().includes(s) ||
            user2?.email?.toLowerCase().includes(s) ||
            user2?.profile?.phone?.toLowerCase().includes(s);
    });

    return (
        <div>
            <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', maxWidth: 400 }}>
                    <Search size={18} color="#888" />
                    <input type="text" placeholder="Search matches..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ border: 'none', outline: 'none', flex: 1, fontSize: 14 }} />
                </div>
            </div>
            <div style={{
                background: 'white',
                borderRadius: 12,
                overflow: 'auto',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#F9FAFB' }}>
                            <th style={thStyle}>User 1</th>
                            <th style={thStyle}>User 2</th>
                            <th style={thStyle}>Matched At</th>
                            <th style={thStyle}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((match, idx) => {
                            const user1 = match.users?.[0] ? getUser(match.users[0]) : null;
                            const user2 = match.users?.[1] ? getUser(match.users[1]) : null;

                            const user1Name = user1?.profile?.companyName || user1?.profile?.name || user1?.email || match.users?.[0] || 'Unknown';
                            const user2Name = user2?.profile?.companyName || user2?.profile?.name || user2?.email || match.users?.[1] || 'Unknown';

                            const user1Role = user1?.role;
                            const user2Role = user2?.role;

                            return (
                                <tr key={match.id + '-' + idx} style={{ borderTop: '1px solid #E5E7EB' }}>
                                    <td style={tdStyle}>
                                        <div>
                                            <span style={{ fontWeight: 500 }}>{user1Name}</span>
                                            {user1Role && (
                                                <span style={{
                                                    marginLeft: 8,
                                                    fontSize: 10,
                                                    padding: '2px 6px',
                                                    borderRadius: 4,
                                                    background: user1Role === 'company' ? '#EEF2FF' : '#F0FDF4',
                                                    color: user1Role === 'company' ? '#4F46E5' : '#16A34A',
                                                }}>
                                                    {user1Role === 'company' ? 'Co' : 'Sk'}
                                                </span>
                                            )}
                                        </div>
                                        {user1?.email && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{user1.email}</div>}
                                        {user1?.profile?.phone && <div style={{ fontSize: 11, color: '#888' }}>{user1.profile.phone}</div>}
                                    </td>
                                    <td style={tdStyle}>
                                        <div>
                                            <span style={{ fontWeight: 500 }}>{user2Name}</span>
                                            {user2Role && (
                                                <span style={{
                                                    marginLeft: 8,
                                                    fontSize: 10,
                                                    padding: '2px 6px',
                                                    borderRadius: 4,
                                                    background: user2Role === 'company' ? '#EEF2FF' : '#F0FDF4',
                                                    color: user2Role === 'company' ? '#4F46E5' : '#16A34A',
                                                }}>
                                                    {user2Role === 'company' ? 'Co' : 'Sk'}
                                                </span>
                                            )}
                                        </div>
                                        {user2?.email && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{user2.email}</div>}
                                        {user2?.profile?.phone && <div style={{ fontSize: 11, color: '#888' }}>{user2.profile.phone}</div>}
                                    </td>
                                    <td style={tdStyle}>
                                        {match.matchedAt ? new Date(match.matchedAt).toLocaleString() : 'N/A'}
                                    </td>
                                    <td style={tdStyle}>
                                        <ActionButtons
                                            onDelete={() => onDelete(match)}
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <p style={{ padding: 12, fontSize: 13, color: '#888' }}>
                    Showing {filtered.length} of {uniqueMatches.length} unique matches
                </p>
            </div>
        </div>
    );
}


// ============ CHATS TAB ============
function ChatsTab({ chats, users, onView, onDelete }) {
    const [searchTerm, setSearchTerm] = useState('');
    const getUser = (id) => users.find(u => u.id === id);

    const s = searchTerm.toLowerCase();
    const filtered = chats.filter(chat => {
        const ids = chat.participants || chat.users || [];
        return !s || ids.some(id => {
            const u = getUser(id);
            return u?.profile?.name?.toLowerCase().includes(s) ||
                u?.profile?.companyName?.toLowerCase().includes(s) ||
                u?.email?.toLowerCase().includes(s) ||
                u?.profile?.phone?.toLowerCase().includes(s);
        }) || (chat.lastMessage || chat.lastMessageText || '').toLowerCase().includes(s);
    });

    return (
        <div>
            <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', maxWidth: 400 }}>
                    <Search size={18} color="#888" />
                    <input type="text" placeholder="Search chats..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ border: 'none', outline: 'none', flex: 1, fontSize: 14 }} />
                </div>
            </div>
            <div style={{
                background: 'white',
                borderRadius: 12,
                overflow: 'auto',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#F9FAFB' }}>
                            <th style={thStyle}>Participants</th>
                            <th style={thStyle}>Last Message</th>
                            <th style={thStyle}>Messages</th>
                            <th style={thStyle}>Updated</th>
                            <th style={thStyle}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: '#888', padding: 40 }}>
                                    No chats found
                                </td>
                            </tr>
                        ) : (
                            filtered.map(chat => {
                                const participantIds = chat.participants || chat.users || [];
                                const participantUsers = participantIds.map(id => {
                                    const u = getUser(id);
                                    return {
                                        name: u?.profile?.name || u?.profile?.companyName || u?.email || id?.substring(0, 8) + '...',
                                        email: u?.email || null,
                                        phone: u?.profile?.phone || null,
                                        role: u?.role || null,
                                    };
                                });

                                return (
                                    <tr key={chat.id} style={{ borderTop: '1px solid #E5E7EB' }}>
                                        <td style={tdStyle}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                {participantUsers.map((p, i) => (
                                                    <div key={i}>
                                                        <div>
                                                            <span style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</span>
                                                            {p.role && (
                                                                <span style={{
                                                                    marginLeft: 8,
                                                                    fontSize: 10,
                                                                    padding: '2px 6px',
                                                                    borderRadius: 4,
                                                                    background: p.role === 'company' ? '#EEF2FF' : '#F0FDF4',
                                                                    color: p.role === 'company' ? '#4F46E5' : '#16A34A',
                                                                }}>
                                                                    {p.role === 'company' ? 'Co' : 'Sk'}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {p.email && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{p.email}</div>}
                                                        {p.phone && <div style={{ fontSize: 11, color: '#888' }}>{p.phone}</div>}
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{ fontSize: 13, color: '#555', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                                                {chat.lastMessage || chat.lastMessageText || '—'}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{
                                                padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                                                background: '#EEF2FF', color: '#4F46E5',
                                            }}>
                                                {chat.messageCount || '—'}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>
                                            {chat.lastMessageAt ? new Date(chat.lastMessageAt.seconds ? chat.lastMessageAt.seconds * 1000 : chat.lastMessageAt).toLocaleString() : 'N/A'}
                                        </td>
                                        <td style={tdStyle}>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button onClick={() => onView(chat)} style={{
                                                    padding: '6px 8px', borderRadius: 8, border: '1px solid #E5E7EB',
                                                    background: '#F0F9FF', cursor: 'pointer', display: 'flex', alignItems: 'center',
                                                }} title="View Messages">
                                                    <Eye size={15} color="#3B82F6" />
                                                </button>
                                                <button onClick={() => onDelete(chat)} style={{
                                                    padding: '6px 8px', borderRadius: 8, border: '1px solid #FEE2E2',
                                                    background: '#FEF2F2', cursor: 'pointer', display: 'flex', alignItems: 'center',
                                                }} title="Delete Chat">
                                                    <Trash2 size={15} color="#EF4444" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
                <p style={{ padding: 12, fontSize: 13, color: '#888' }}>
                    Showing {filtered.length} of {chats.length} chats
                </p>
            </div>
        </div>
    );
}

// ============ WALLETS TAB ============
function WalletsTab({ wallets, users, transactions, onEdit }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [viewingTransactions, setViewingTransactions] = useState(null); // wallet object
    const getUserInfo = (walletId) => {
        if (walletId === 'admin_wallet') return { name: 'Plyship (Admin)', email: 'admin', phone: null, role: 'admin' };
        const u = users.find(u => u.id === walletId);
        if (!u) return { name: 'Unknown', email: walletId, phone: null, role: '—' };
        return {
            name: u.profile?.name || u.profile?.companyName || u.email || 'Unknown',
            email: u.email || null,
            phone: u.profile?.phone || null,
            role: u.role || '—',
        };
    };

    const sorted = [...wallets].sort((a, b) => {
        const order = { ADMIN: 0, COMPANY: 1, SEEKER: 2 };
        return (order[a.type] ?? 3) - (order[b.type] ?? 3);
    });

    const s = searchTerm.toLowerCase();
    const filtered = sorted.filter(wallet => {
        const info = getUserInfo(wallet.id);
        return !s ||
            info.name?.toLowerCase().includes(s) ||
            info.email?.toLowerCase().includes(s) ||
            info.phone?.toLowerCase().includes(s) ||
            wallet.type?.toLowerCase().includes(s);
    });

    return (
        <>
            <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', maxWidth: 400 }}>
                    <Search size={18} color="#888" />
                    <input type="text" placeholder="Search wallets..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ border: 'none', outline: 'none', flex: 1, fontSize: 14 }} />
                </div>
            </div>
            <div style={{
                background: 'white',
                borderRadius: 12,
                overflow: 'auto',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#F9FAFB' }}>
                            <th style={thStyle}>User</th>
                            <th style={thStyle}>Type</th>
                            <th style={thStyle}>Balance</th>
                            <th style={thStyle}>Locked</th>
                            <th style={thStyle}>Total Earned</th>
                            <th style={thStyle}>Total Spent</th>
                            <th style={thStyle}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: '#888', padding: 40 }}>
                                    No wallets found
                                </td>
                            </tr>
                        ) : (
                            filtered.map(wallet => {
                                const info = getUserInfo(wallet.id);
                                const typeColor = wallet.type === 'ADMIN' ? { bg: '#F0FDF4', color: '#059669' }
                                    : wallet.type === 'COMPANY' ? { bg: '#EEF2FF', color: '#4F46E5' }
                                        : { bg: '#FDF4FF', color: '#A855F7' };

                                return (
                                    <tr key={wallet.id} style={{ borderTop: '1px solid #E5E7EB' }}>
                                        <td style={tdStyle}>
                                            <div style={{ fontWeight: 500 }}>{info.name}</div>
                                            {info.email && info.email !== 'admin' && (
                                                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{info.email}</div>
                                            )}
                                            {info.phone && (
                                                <div style={{ fontSize: 11, color: '#888' }}>{info.phone}</div>
                                            )}
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{
                                                padding: '4px 10px',
                                                borderRadius: 20,
                                                fontSize: 11,
                                                fontWeight: 600,
                                                background: typeColor.bg,
                                                color: typeColor.color,
                                            }}>
                                                {wallet.type || '—'}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{ fontWeight: 600, color: '#059669', fontSize: 15 }}>
                                                ₹{(wallet.balance || 0).toLocaleString()}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{ fontWeight: 600, color: '#F59E0B', fontSize: 14 }}>
                                                ₹{(wallet.lockedBalance || 0).toLocaleString()}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{ fontSize: 13, color: '#555' }}>
                                                ₹{(wallet.totalEarnings || 0).toLocaleString()}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{ fontSize: 13, color: '#555' }}>
                                                ₹{(wallet.totalSpent || 0).toLocaleString()}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button onClick={() => setViewingTransactions(wallet)} style={{
                                                    padding: '6px 8px', borderRadius: 8, border: '1px solid #E5E7EB',
                                                    background: '#F0FDF4', cursor: 'pointer', display: 'flex', alignItems: 'center',
                                                }} title="View Transactions">
                                                    <Eye size={15} color="#22C55E" />
                                                </button>
                                                <button onClick={() => onEdit(wallet)} style={{
                                                    padding: '6px 8px', borderRadius: 8, border: '1px solid #E5E7EB',
                                                    background: '#F0F9FF', cursor: 'pointer', display: 'flex', alignItems: 'center',
                                                }} title="Edit Wallet">
                                                    <Pencil size={15} color="#3B82F6" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
                <p style={{ padding: 12, fontSize: 13, color: '#888' }}>
                    Showing {filtered.length} of {wallets.length} wallets
                </p>
            </div>

            {
                viewingTransactions && (
                    <TransactionHistoryModal
                        wallet={viewingTransactions}
                        users={users}
                        transactions={transactions}
                        onClose={() => setViewingTransactions(null)}
                    />
                )
            }
        </>
    );
}

// ============ TRANSACTION HISTORY MODAL ============
function TransactionHistoryModal({ wallet, users, transactions, onClose }) {
    const getUserName = (userId) => {
        if (userId === 'admin_wallet') return 'Plyship (Admin)';
        const u = users.find(u => u.id === userId);
        return u?.profile?.name || u?.profile?.companyName || u?.email || userId?.substring(0, 8) + '...';
    };

    const ownerName = getUserName(wallet.id);

    // Filter transactions for this wallet user
    const userTransactions = transactions
        .filter(t => t.userId === wallet.id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const getReasonLabel = (reason) => {
        const labels = {
            TOP_UP: 'Wallet Top-up',
            MEETING_FEE: 'Meeting Fee',
            MEETING_EARNINGS: 'Meeting Earnings',
            ADMIN_COMMISSION: 'Commission',
            WITHDRAWAL: 'Withdrawal',
            PROJECT_PAYMENT: 'Project Payment',
            REFUND: 'Refund',
        };
        return labels[reason] || reason || 'Other';
    };

    const getTypeStyle = (type) => {
        if (type === 'CREDIT') return { bg: '#DCFCE7', color: '#16A34A', label: 'Credit' };
        if (type === 'DEBIT') return { bg: '#FEE2E2', color: '#EF4444', label: 'Debit' };
        if (type === 'LOCK') return { bg: '#FEF3C7', color: '#D97706', label: 'Locked' };
        return { bg: '#F3F4F6', color: '#6B7280', label: type || '—' };
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    };

    // Calculate summary
    const totalCredits = userTransactions.filter(t => t.type === 'CREDIT').reduce((s, t) => s + (t.amount || 0), 0);
    const totalDebits = userTransactions.filter(t => t.type === 'DEBIT').reduce((s, t) => s + (t.amount || 0), 0);
    const totalLocked = userTransactions.filter(t => t.type === 'LOCK').reduce((s, t) => s + (t.amount || 0), 0);

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={onClose}>
            <div style={{
                background: 'white', borderRadius: 16, padding: 0,
                width: '100%', maxWidth: 600, maxHeight: '85vh', display: 'flex', flexDirection: 'column',
                boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
            }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px', borderBottom: '1px solid #E5E7EB',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{ownerName}</h3>
                        <p style={{ margin: 0, fontSize: 13, color: '#888', marginTop: 2 }}>Transaction History</p>
                    </div>
                    <button onClick={onClose} style={{
                        padding: 6, borderRadius: 8, border: 'none', background: '#F3F4F6', cursor: 'pointer',
                    }}>
                        <X size={18} color="#666" />
                    </button>
                </div>

                {/* Summary Cards */}
                <div style={{ display: 'flex', gap: 10, padding: '12px 24px', borderBottom: '1px solid #F3F4F6' }}>
                    <div style={{ flex: 1, padding: '8px 12px', borderRadius: 10, background: '#DCFCE7', textAlign: 'center' }}>
                        <p style={{ fontSize: 11, color: '#16A34A', fontWeight: 600, margin: 0 }}>Credits</p>
                        <p style={{ fontSize: 16, fontWeight: 700, color: '#166534', margin: 0 }}>₹{totalCredits.toLocaleString()}</p>
                    </div>
                    <div style={{ flex: 1, padding: '8px 12px', borderRadius: 10, background: '#FEE2E2', textAlign: 'center' }}>
                        <p style={{ fontSize: 11, color: '#EF4444', fontWeight: 600, margin: 0 }}>Debits</p>
                        <p style={{ fontSize: 16, fontWeight: 700, color: '#991B1B', margin: 0 }}>₹{totalDebits.toLocaleString()}</p>
                    </div>
                    <div style={{ flex: 1, padding: '8px 12px', borderRadius: 10, background: '#FEF3C7', textAlign: 'center' }}>
                        <p style={{ fontSize: 11, color: '#D97706', fontWeight: 600, margin: 0 }}>Locked</p>
                        <p style={{ fontSize: 16, fontWeight: 700, color: '#92400E', margin: 0 }}>₹{totalLocked.toLocaleString()}</p>
                    </div>
                </div>

                {/* Transaction List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
                    {userTransactions.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
                            <Wallet size={32} color="#D1D5DB" style={{ marginBottom: 8 }} />
                            <p style={{ fontSize: 13 }}>No transactions found</p>
                        </div>
                    ) : (
                        userTransactions.map((txn, i) => {
                            const typeStyle = getTypeStyle(txn.type);
                            return (
                                <div key={txn.id || i} style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '12px 0',
                                    borderBottom: i < userTransactions.length - 1 ? '1px solid #F3F4F6' : 'none',
                                }}>
                                    {/* Type Badge */}
                                    <div style={{
                                        width: 40, height: 40, borderRadius: 10,
                                        background: typeStyle.bg,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        {txn.type === 'CREDIT' ? (
                                            <TrendingUp size={18} color={typeStyle.color} />
                                        ) : txn.type === 'DEBIT' ? (
                                            <DollarSign size={18} color={typeStyle.color} />
                                        ) : (
                                            <Clock size={18} color={typeStyle.color} />
                                        )}
                                    </div>

                                    {/* Details */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>
                                                {getReasonLabel(txn.reason)}
                                            </span>
                                            <span style={{
                                                padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                                                background: typeStyle.bg, color: typeStyle.color,
                                            }}>{typeStyle.label}</span>
                                        </div>
                                        {txn.relatedUserId && (
                                            <p style={{ fontSize: 11, color: '#888', margin: '2px 0 0' }}>
                                                {txn.type === 'DEBIT' ? 'Paid to: ' : txn.type === 'CREDIT' && txn.reason === 'TOP_UP' ? 'Razorpay' : 'From: '}
                                                {txn.reason !== 'TOP_UP' ? getUserName(txn.relatedUserId) : ''}
                                            </p>
                                        )}
                                        {txn.paymentId && (
                                            <p style={{ fontSize: 10, color: '#AAA', margin: '1px 0 0', fontFamily: 'monospace' }}>
                                                ID: {txn.paymentId}
                                            </p>
                                        )}
                                        <p style={{ fontSize: 10, color: '#AAA', margin: '2px 0 0' }}>
                                            {formatDate(txn.createdAt)}
                                        </p>
                                    </div>

                                    {/* Amount */}
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <span style={{
                                            fontSize: 15, fontWeight: 700,
                                            color: txn.type === 'CREDIT' ? '#16A34A' : txn.type === 'DEBIT' ? '#EF4444' : '#D97706',
                                        }}>
                                            {txn.type === 'CREDIT' ? '+' : txn.type === 'DEBIT' ? '-' : '🔒'}
                                            ₹{(txn.amount || 0).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '12px 24px', borderTop: '1px solid #E5E7EB', textAlign: 'center' }}>
                    <p style={{ fontSize: 12, color: '#888', margin: 0 }}>
                        {userTransactions.length} transaction{userTransactions.length !== 1 ? 's' : ''}
                    </p>
                </div>
            </div>
        </div>
    );
}

// ============ EDIT WALLET MODAL ============
function EditWalletModal({ wallet, users, loading, onClose, onSave }) {
    const [balance, setBalance] = useState(wallet.balance || 0);
    const [lockedBalance, setLockedBalance] = useState(wallet.lockedBalance || 0);
    const [totalEarnings, setTotalEarnings] = useState(wallet.totalEarnings || 0);
    const [totalSpent, setTotalSpent] = useState(wallet.totalSpent || 0);

    const getUserName = () => {
        if (wallet.id === 'admin_wallet') return 'Plyship (Admin)';
        const u = users.find(u => u.id === wallet.id);
        return u?.profile?.name || u?.profile?.companyName || u?.email || wallet.id;
    };

    const inputStyle = {
        width: '100%', padding: '10px 12px', borderRadius: 8,
        border: '1px solid #D1D5DB', fontSize: 14, boxSizing: 'border-box',
    };
    const labelStyle = { fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 4, display: 'block' };

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={onClose}>
            <div style={{
                background: 'white', borderRadius: 16, padding: 24,
                width: '100%', maxWidth: 420, boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
            }} onClick={e => e.stopPropagation()}>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Edit Wallet</h3>
                <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>{getUserName()} — {wallet.type}</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                        <label style={labelStyle}>Balance (₹)</label>
                        <input type="number" value={balance} onChange={e => setBalance(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>Locked Balance (₹)</label>
                        <input type="number" value={lockedBalance} onChange={e => setLockedBalance(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>Total Earnings (₹)</label>
                        <input type="number" value={totalEarnings} onChange={e => setTotalEarnings(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>Total Spent (₹)</label>
                        <input type="number" value={totalSpent} onChange={e => setTotalSpent(e.target.value)} style={inputStyle} />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{
                        padding: '10px 20px', borderRadius: 10, border: '1px solid #D1D5DB',
                        background: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 500,
                    }}>Cancel</button>
                    <button
                        disabled={loading}
                        onClick={() => onSave(wallet.id, {
                            balance: Number(balance),
                            lockedBalance: Number(lockedBalance),
                            totalEarnings: Number(totalEarnings),
                            totalSpent: Number(totalSpent),
                        })}
                        style={{
                            padding: '10px 20px', borderRadius: 10, border: 'none',
                            background: '#059669', color: 'white', cursor: 'pointer',
                            fontSize: 14, fontWeight: 600, opacity: loading ? 0.6 : 1,
                        }}
                    >
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ============ VIEW PROFILE MODAL ============
function ViewProfileModal({ user, onClose }) {
    const isCompany = user.role === 'company';
    const p = user.profile || {};

    const Row = ({ label, value }) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
            <span style={{ fontSize: 13, color: '#888', fontWeight: 500 }}>{label}</span>
            <span style={{ fontSize: 13, color: '#111', fontWeight: 500, textAlign: 'right', maxWidth: '60%', wordBreak: 'break-word' }}>
                {value || '—'}
            </span>
        </div>
    );

    const ArrayRow = ({ label, items }) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F3F4F6', flexWrap: 'wrap', gap: 4 }}>
            <span style={{ fontSize: 13, color: '#888', fontWeight: 500 }}>{label}</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end', maxWidth: '65%' }}>
                {(items || []).length > 0 ? items.map((item, i) => (
                    <span key={i} style={{
                        padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 500,
                        background: '#F3F4F6', color: '#555',
                    }}>{item}</span>
                )) : <span style={{ fontSize: 13, color: '#CCC' }}>—</span>}
            </div>
        </div>
    );

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }} onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={e => e.stopPropagation()}
                style={{
                    background: 'white', borderRadius: 16, maxWidth: 520, width: '100%',
                    maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                }}
            >
                {/* Header */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '16px 20px', borderBottom: '1px solid #E5E7EB',
                    background: isCompany ? '#EEF2FF' : '#F0FDF4',
                }}>
                    <div>
                        <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                            {p.name || p.companyName || 'Unknown'}
                        </h3>
                        <span style={{
                            padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                            background: isCompany ? '#4F46E5' : '#16A34A', color: 'white',
                        }}>
                            {isCompany ? 'Company' : 'Seeker'}
                        </span>
                    </div>
                    <button onClick={onClose} style={{
                        border: 'none', background: 'transparent', cursor: 'pointer', padding: 4,
                    }}>
                        <X size={20} color="#666" />
                    </button>
                </div>

                {/* Content */}
                <div style={{ overflowY: 'auto', padding: '12px 20px 20px' }}>
                    {/* Account */}
                    <div style={{ padding: 6, background: '#F9FAFB', borderRadius: 8, fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>
                        Account
                    </div>
                    <Row label="Email" value={user.email} />
                    <Row label="User ID" value={user.id} />
                    <Row label="Profile Complete" value={user.profileComplete ? '✅ Yes' : '❌ No'} />
                    <Row label="Created" value={user.createdAt ? new Date(user.createdAt).toLocaleString() : 'N/A'} />

                    {isCompany ? (
                        <>
                            <div style={{ padding: 6, background: '#EEF2FF', borderRadius: 8, fontSize: 11, color: '#4F46E5', fontWeight: 600, textTransform: 'uppercase', margin: '16px 0 8px' }}>
                                Company Details
                            </div>
                            <Row label="Company Name" value={p.companyName} />
                            <Row label="Tagline" value={p.tagline} />
                            <Row label="Phone" value={p.phone} />
                            <Row label="Email" value={p.email} />
                            <Row label="Years in Business" value={p.yearsInBusiness} />
                            <Row label="City" value={p.city} />
                            <Row label="Projects Completed" value={p.projectsCompleted} />
                            <Row label="Min Budget" value={p.minBudget ? `₹${p.minBudget}` : null} />
                            <Row label="Max Budget" value={p.maxBudget ? `₹${p.maxBudget}` : null} />
                            <Row label="Portfolio Description" value={p.portfolioDescription} />
                            <ArrayRow label="Service Areas" items={p.serviceAreas} />
                            <ArrayRow label="Services" items={p.services} />
                            <ArrayRow label="Specializations" items={p.specializations} />
                            <Row label="Portfolio Images" value={`${(p.portfolioImages || []).length} images`} />
                            {(p.portfolioImages || []).length > 0 && (
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0' }}>
                                    {p.portfolioImages.slice(0, 6).map((img, i) => (
                                        <img key={i} src={img} alt={`Portfolio ${i + 1}`} style={{
                                            width: 60, height: 60, borderRadius: 8, objectFit: 'cover',
                                            border: '1px solid #E5E7EB',
                                        }} />
                                    ))}
                                    {p.portfolioImages.length > 6 && (
                                        <div style={{
                                            width: 60, height: 60, borderRadius: 8, background: '#F3F4F6',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 12, color: '#888', fontWeight: 600,
                                        }}>
                                            +{p.portfolioImages.length - 6}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <div style={{ padding: 6, background: '#F0FDF4', borderRadius: 8, fontSize: 11, color: '#16A34A', fontWeight: 600, textTransform: 'uppercase', margin: '16px 0 8px' }}>
                                Seeker Details
                            </div>
                            <Row label="Name" value={p.name} />
                            <Row label="Phone" value={p.phone} />
                            <Row label="City" value={p.city} />
                            <Row label="Locality" value={p.locality} />
                            <Row label="Property Type" value={p.propertyType} />
                            <Row label="Budget" value={p.budget} />
                            <Row label="Timeline" value={p.timeline} />
                            <ArrayRow label="Styles" items={p.styles} />
                            <ArrayRow label="Rooms" items={p.rooms} />
                        </>
                    )}

                    {/* Avatar */}
                    {p.avatar && (
                        <div style={{ marginTop: 12 }}>
                            <span style={{ fontSize: 12, color: '#888' }}>Avatar:</span>
                            <img src={p.avatar} alt="Avatar" style={{
                                display: 'block', width: 80, height: 80, borderRadius: 12,
                                objectFit: 'cover', marginTop: 4, border: '1px solid #E5E7EB',
                            }} />
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}

// ============ VIEW CHAT MODAL ============
function ViewChatModal({ chat, messages, users, onClose }) {
    const getUser = (id) => users.find(u => u.id === id);
    const participants = (chat.participants || chat.users || []).map(id => {
        const u = getUser(id);
        return { id, name: u?.profile?.name || u?.profile?.companyName || u?.email || id?.substring(0, 8) + '...' };
    });

    const getSenderName = (senderId) => {
        const p = participants.find(p => p.id === senderId);
        return p?.name || senderId?.substring(0, 8) + '...';
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }} onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={e => e.stopPropagation()}
                style={{
                    background: 'white', borderRadius: 16, maxWidth: 560, width: '100%',
                    maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                }}
            >
                {/* Header */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '16px 20px', borderBottom: '1px solid #E5E7EB', background: '#F9FAFB',
                }}>
                    <div>
                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Chat Messages</h3>
                        <p style={{ fontSize: 12, color: '#888', margin: 0 }}>
                            {participants.map(p => p.name).join(' ↔ ')}
                        </p>
                    </div>
                    <button onClick={onClose} style={{
                        border: 'none', background: 'transparent', cursor: 'pointer', padding: 4,
                    }}>
                        <X size={20} color="#666" />
                    </button>
                </div>

                {/* Messages */}
                <div style={{ overflowY: 'auto', padding: '12px 20px', flex: 1 }}>
                    {messages.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
                            <MessageCircle size={32} color="#CCC" style={{ marginBottom: 8 }} />
                            <p>No messages found or loading...</p>
                        </div>
                    ) : (
                        messages.map((msg, i) => {
                            const isFirstUser = msg.senderId === (chat.participants || chat.users || [])[0];
                            const timestamp = msg.createdAt?.seconds
                                ? new Date(msg.createdAt.seconds * 1000)
                                : msg.createdAt ? new Date(msg.createdAt) : null;

                            return (
                                <div key={msg.id || i} style={{
                                    marginBottom: 12,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: isFirstUser ? 'flex-start' : 'flex-end',
                                }}>
                                    <span style={{ fontSize: 11, color: '#888', marginBottom: 2, fontWeight: 600 }}>
                                        {getSenderName(msg.senderId)}
                                    </span>
                                    <div style={{
                                        padding: '10px 14px',
                                        borderRadius: 12,
                                        maxWidth: '75%',
                                        background: isFirstUser ? '#F3F4F6' : '#EEF2FF',
                                        color: '#111',
                                        fontSize: 14,
                                        lineHeight: 1.5,
                                        wordBreak: 'break-word',
                                    }}>
                                        {msg.text || msg.message || msg.content || '(empty)'}
                                    </div>
                                    {timestamp && (
                                        <span style={{ fontSize: 10, color: '#AAA', marginTop: 2 }}>
                                            {timestamp.toLocaleString()}
                                        </span>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '12px 20px', borderTop: '1px solid #E5E7EB', background: '#F9FAFB',
                    fontSize: 12, color: '#888',
                }}>
                    Chat ID: {chat.id} · {messages.length} messages
                </div>
            </motion.div>
        </div>
    );
}

// ============ WITHDRAWALS TAB ============
function WithdrawalsTab({ withdrawals, users, transactions, onUpdateStatus, onViewEarnings, saving }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [editingNote, setEditingNote] = useState(null);
    const [noteText, setNoteText] = useState('');

    const getUserInfo = (seekerId) => {
        const u = users.find(u => u.id === seekerId);
        if (!u) return { name: 'Unknown', email: seekerId, phone: null };
        return {
            name: u.profile?.name || u.email || 'Unknown',
            email: u.email || null,
            phone: u.profile?.phone || null,
        };
    };

    const s = searchTerm.toLowerCase();
    const filtered = withdrawals.filter(w => {
        const info = getUserInfo(w.seekerId);
        const matchesSearch = !s ||
            info.name?.toLowerCase().includes(s) ||
            info.email?.toLowerCase().includes(s) ||
            info.phone?.toLowerCase().includes(s) ||
            w.seekerName?.toLowerCase().includes(s);
        const matchesStatus = statusFilter === 'ALL' || w.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const getStatusColor = (status) => {
        switch (status) {
            case 'PENDING': return { bg: '#FEF3C7', color: '#92400E' };
            case 'PROCESSING': return { bg: '#DBEAFE', color: '#1E40AF' };
            case 'COMPLETED': return { bg: '#D1FAE5', color: '#065F46' };
            case 'REJECTED': return { bg: '#FEE2E2', color: '#991B1B' };
            default: return { bg: '#F3F4F6', color: '#374151' };
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const pendingCount = withdrawals.filter(w => w.status === 'PENDING').length;
    const processingCount = withdrawals.filter(w => w.status === 'PROCESSING').length;

    return (
        <div>
            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
                {[
                    { label: 'Pending', count: pendingCount, color: '#F59E0B', bg: '#FEF3C7' },
                    { label: 'Processing', count: processingCount, color: '#3B82F6', bg: '#DBEAFE' },
                    { label: 'Total Requests', count: withdrawals.length, color: '#6B7280', bg: '#F3F4F6' },
                ].map(card => (
                    <div key={card.label} style={{
                        padding: 16,
                        borderRadius: 12,
                        background: 'white',
                        border: `1px solid ${card.color}22`,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    }}>
                        <div style={{ fontSize: 28, fontWeight: 800, color: card.color }}>{card.count}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginTop: 2 }}>{card.label}</div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', flex: '1 1 250px', maxWidth: 400 }}>
                    <Search size={18} color="#888" />
                    <input type="text" placeholder="Search seekers..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ border: 'none', outline: 'none', flex: 1, fontSize: 14 }} />
                </div>
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    style={{
                        padding: '10px 16px',
                        borderRadius: 10,
                        border: '1px solid #E5E7EB',
                        background: 'white',
                        fontSize: 14,
                        cursor: 'pointer',
                    }}
                >
                    <option value="ALL">All Status</option>
                    <option value="PENDING">Pending</option>
                    <option value="PROCESSING">Processing</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="REJECTED">Rejected</option>
                </select>
            </div>

            {/* Table */}
            <div style={{
                background: 'white',
                borderRadius: 12,
                overflow: 'auto',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                    <thead>
                        <tr style={{ background: '#F9FAFB' }}>
                            <th style={thStyle}>Seeker</th>
                            <th style={thStyle}>Amount</th>
                            <th style={thStyle}>Wallet Balance</th>
                            <th style={thStyle}>Status</th>
                            <th style={thStyle}>Requested</th>
                            <th style={thStyle}>Note</th>
                            <th style={thStyle}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: '#888', padding: 40 }}>
                                    No withdrawal requests found
                                </td>
                            </tr>
                        ) : (
                            filtered.map(withdrawal => {
                                const info = getUserInfo(withdrawal.seekerId);
                                const statusColor = getStatusColor(withdrawal.status);

                                return (
                                    <tr key={withdrawal.id} style={{ borderTop: '1px solid #E5E7EB' }}>
                                        <td style={tdStyle}>
                                            <div style={{ fontWeight: 500 }}>{withdrawal.seekerName || info.name}</div>
                                            {(withdrawal.seekerEmail || info.email) && (
                                                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                                                    {withdrawal.seekerEmail || info.email}
                                                </div>
                                            )}
                                            {(withdrawal.seekerPhone || info.phone) && (
                                                <div style={{ fontSize: 11, color: '#888' }}>
                                                    {withdrawal.seekerPhone || info.phone}
                                                </div>
                                            )}
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{ fontWeight: 700, color: '#059669', fontSize: 16 }}>
                                                ₹{(withdrawal.amount || 0).toLocaleString()}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{ fontSize: 13, color: '#555' }}>
                                                ₹{(withdrawal.walletBalance || 0).toLocaleString()}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{
                                                padding: '4px 10px',
                                                borderRadius: 20,
                                                fontSize: 11,
                                                fontWeight: 600,
                                                background: statusColor.bg,
                                                color: statusColor.color,
                                            }}>
                                                {withdrawal.status}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>
                                            <div style={{ fontSize: 13 }}>{formatDate(withdrawal.requestedAt)}</div>
                                            {withdrawal.processedAt && (
                                                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                                                    Done: {formatDate(withdrawal.processedAt)}
                                                </div>
                                            )}
                                        </td>
                                        <td style={tdStyle}>
                                            {editingNote === withdrawal.id ? (
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    <input
                                                        type="text"
                                                        value={noteText}
                                                        onChange={e => setNoteText(e.target.value)}
                                                        placeholder="Add note..."
                                                        style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 12, width: 120 }}
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            onUpdateStatus(withdrawal.id, withdrawal.status, noteText);
                                                            setEditingNote(null);
                                                        }}
                                                        style={{ padding: '4px 6px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#F0FDF4', cursor: 'pointer' }}
                                                    >
                                                        <Save size={12} color="#059669" />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingNote(null)}
                                                        style={{ padding: '4px 6px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#FEF2F2', cursor: 'pointer' }}
                                                    >
                                                        <X size={12} color="#EF4444" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div
                                                    onClick={() => { setEditingNote(withdrawal.id); setNoteText(withdrawal.adminNote || ''); }}
                                                    style={{ fontSize: 12, color: withdrawal.adminNote ? '#333' : '#CCC', cursor: 'pointer', minWidth: 60 }}
                                                    title="Click to edit note"
                                                >
                                                    {withdrawal.adminNote || 'Add note...'}
                                                </div>
                                            )}
                                        </td>
                                        <td style={tdStyle}>
                                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                {/* Status Update Dropdown */}
                                                <select
                                                    value={withdrawal.status}
                                                    disabled={saving}
                                                    onChange={e => onUpdateStatus(withdrawal.id, e.target.value)}
                                                    style={{
                                                        padding: '5px 8px',
                                                        borderRadius: 8,
                                                        border: '1px solid #E5E7EB',
                                                        fontSize: 12,
                                                        cursor: saving ? 'wait' : 'pointer',
                                                        background: '#FAFAFA',
                                                    }}
                                                >
                                                    <option value="PENDING">Pending</option>
                                                    <option value="PROCESSING">Processing</option>
                                                    <option value="COMPLETED">Completed</option>
                                                    <option value="REJECTED">Rejected</option>
                                                </select>

                                                {/* Eye Icon - View Earning History */}
                                                <button
                                                    onClick={() => onViewEarnings({
                                                        id: withdrawal.seekerId,
                                                        name: withdrawal.seekerName || info.name,
                                                        email: withdrawal.seekerEmail || info.email,
                                                    })}
                                                    style={{
                                                        padding: '6px 8px',
                                                        borderRadius: 8,
                                                        border: '1px solid #E5E7EB',
                                                        background: '#EEF2FF',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                    }}
                                                    title="View Earning History"
                                                >
                                                    <Eye size={15} color="#4F46E5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
                <p style={{ padding: 12, fontSize: 13, color: '#888' }}>
                    Showing {filtered.length} of {withdrawals.length} withdrawals
                </p>
            </div>
        </div>
    );
}

// ============ EARNING HISTORY MODAL ============
function EarningHistoryModal({ seeker, transactions, users, onClose }) {
    // Filter transactions for this seeker — LOCK type means earnings from meetings
    const seekerEarnings = transactions.filter(t =>
        t.userId === seeker.id && t.type === 'LOCK' && t.reason === 'MEETING_EARNINGS'
    );

    const getCompanyInfo = (companyId) => {
        const u = users.find(u => u.id === companyId);
        if (!u) return { name: 'Unknown Company', email: '' };
        return {
            name: u.profile?.companyName || u.profile?.name || u.email || 'Unknown',
            email: u.email || '',
        };
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const totalEarned = seekerEarnings.reduce((sum, t) => sum + (t.amount || 0), 0);

    // Group by company
    const companyMap = {};
    seekerEarnings.forEach(t => {
        const cId = t.relatedUserId || 'unknown';
        if (!companyMap[cId]) {
            companyMap[cId] = { total: 0, meetings: 0, info: getCompanyInfo(cId) };
        }
        companyMap[cId].total += (t.amount || 0);
        companyMap[cId].meetings += 1;
    });

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 20, zIndex: 1000,
            }}
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                style={{
                    width: '100%', maxWidth: 680, maxHeight: '80vh', overflow: 'auto',
                    background: 'white', borderRadius: 16, padding: 0,
                    boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid #E5E7EB',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    position: 'sticky', top: 0, background: 'white', zIndex: 1,
                }}>
                    <div>
                        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111' }}>
                            💰 Earning History
                        </h3>
                        <p style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
                            {seeker.name} • {seeker.email || ''}
                        </p>
                    </div>
                    <button onClick={onClose} style={{
                        background: '#F3F4F6', border: 'none', borderRadius: 8,
                        padding: '6px 8px', cursor: 'pointer',
                    }}>
                        <X size={18} color="#666" />
                    </button>
                </div>

                <div style={{ padding: 24 }}>
                    {/* Total Summary */}
                    <div style={{
                        background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                        borderRadius: 14, padding: 20, color: 'white', marginBottom: 24,
                    }}>
                        <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 4 }}>Total Earnings</div>
                        <div style={{ fontSize: 32, fontWeight: 800 }}>₹{totalEarned.toLocaleString()}</div>
                        <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
                            From {seekerEarnings.length} meetings with {Object.keys(companyMap).length} companies
                        </div>
                    </div>

                    {/* Per-Company Breakdown */}
                    {Object.keys(companyMap).length > 0 && (
                        <>
                            <h4 style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 12 }}>
                                Earnings by Company
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                                {Object.entries(companyMap).map(([cId, data]) => (
                                    <div key={cId} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '12px 16px', borderRadius: 10, background: '#F9FAFB',
                                        border: '1px solid #E5E7EB',
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>
                                                🏢 {data.info.name}
                                            </div>
                                            {data.info.email && (
                                                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                                                    {data.info.email}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: 700, fontSize: 16, color: '#059669' }}>
                                                ₹{data.total.toLocaleString()}
                                            </div>
                                            <div style={{ fontSize: 11, color: '#888' }}>
                                                {data.meetings} meeting{data.meetings > 1 ? 's' : ''}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* Individual Transactions */}
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 12 }}>
                        All Earning Transactions
                    </h4>
                    {seekerEarnings.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 32, color: '#888' }}>
                            <p>No earnings yet</p>
                        </div>
                    ) : (
                        <div style={{
                            background: 'white', borderRadius: 10, overflow: 'auto',
                            border: '1px solid #E5E7EB',
                        }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#F9FAFB' }}>
                                        <th style={{ ...thStyle, fontSize: 11 }}>Company</th>
                                        <th style={{ ...thStyle, fontSize: 11 }}>Amount</th>
                                        <th style={{ ...thStyle, fontSize: 11 }}>Meeting ID</th>
                                        <th style={{ ...thStyle, fontSize: 11 }}>Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {seekerEarnings.map(txn => {
                                        const company = getCompanyInfo(txn.relatedUserId);
                                        return (
                                            <tr key={txn.id} style={{ borderTop: '1px solid #E5E7EB' }}>
                                                <td style={{ ...tdStyle, fontSize: 13 }}>
                                                    <div style={{ fontWeight: 500 }}>{company.name}</div>
                                                </td>
                                                <td style={{ ...tdStyle, fontSize: 13 }}>
                                                    <span style={{ fontWeight: 600, color: '#059669' }}>
                                                        ₹{(txn.amount || 0).toLocaleString()}
                                                    </span>
                                                </td>
                                                <td style={{ ...tdStyle, fontSize: 11, color: '#888' }}>
                                                    {txn.relatedMeetingId ? txn.relatedMeetingId.slice(0, 8) + '...' : '—'}
                                                </td>
                                                <td style={{ ...tdStyle, fontSize: 13 }}>
                                                    {formatDate(txn.createdAt)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}

// Styles
const thStyle = {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: 12,
    fontWeight: 600,
    color: '#666',
    textTransform: 'uppercase',
};

const tdStyle = {
    padding: '12px 16px',
    fontSize: 14,
    color: '#111',
};
