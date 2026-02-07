'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
    Users, Building2, Palette, Calendar, Wallet, ArrowLeft,
    TrendingUp, DollarSign, MessageCircle, CheckCircle, XCircle,
    Clock, Search, RefreshCw, Eye, Filter, Download, Zap
} from 'lucide-react';
import {
    collection, getDocs, query, orderBy, limit, where,
    doc, getDoc, Timestamp, onSnapshot, collectionGroup
} from 'firebase/firestore';
import { db } from '../../lib/firebase';

// Admin emails that have access
const ADMIN_EMAILS = ['avinashgudla10@gmail.com'];

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
    const [searchTerm, setSearchTerm] = useState('');
    const [isLive, setIsLive] = useState(true);

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
        const userEmail = localStorage.getItem('userEmail');
        if (!userEmail || !ADMIN_EMAILS.includes(userEmail)) {
            setIsAdmin(false);
            setLoading(false);
            return;
        }

        setIsAdmin(true);
        const unsubscribers = [];

        // Real-time seekers listener
        const unsubSeekers = onSnapshot(
            collection(db, 'seekers'),
            (snapshot) => {
                const seekersData = snapshot.docs.map(d => ({
                    id: d.id,
                    ...d.data(),
                    role: 'seeker' // Ensure role is set
                }));
                console.log('📊 Seekers loaded:', seekersData.length);
                setSeekers(seekersData);
            },
            (error) => {
                console.error('Seekers listener error:', error);
            }
        );
        unsubscribers.push(unsubSeekers);

        // Real-time companies listener
        const unsubCompanies = onSnapshot(
            collection(db, 'companies'),
            (snapshot) => {
                const companiesData = snapshot.docs.map(d => ({
                    id: d.id,
                    ...d.data(),
                    role: 'company' // Ensure role is set
                }));
                console.log('📊 Companies loaded:', companiesData.length);
                setCompanies(companiesData);
            },
            (error) => {
                console.error('Companies listener error:', error);
            }
        );
        unsubscribers.push(unsubCompanies);

        // Real-time meetings listener
        const unsubMeetings = onSnapshot(
            query(collection(db, 'meetings'), orderBy('createdAt', 'desc'), limit(100)),
            (snapshot) => {
                const meetingsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                console.log('📊 Meetings loaded:', meetingsData.length);
                setMeetings(meetingsData);
            },
            (error) => {
                console.error('Meetings listener error:', error);
            }
        );
        unsubscribers.push(unsubMeetings);

        // Real-time transactions listener
        const unsubTransactions = onSnapshot(
            query(collection(db, 'transactions'), orderBy('createdAt', 'desc'), limit(100)),
            (snapshot) => {
                const transactionsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                console.log('📊 Transactions loaded:', transactionsData.length);
                setTransactions(transactionsData);
            },
            (error) => {
                console.error('Transactions listener error:', error);
            }
        );
        unsubscribers.push(unsubTransactions);

        // Real-time matches listener - using collectionGroup for nested subcollections
        // Matches are stored as: matches/{userId}/matched/{matchId}
        const unsubMatches = onSnapshot(
            collectionGroup(db, 'matched'),
            (snapshot) => {
                const matchesData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                console.log('📊 Matches loaded:', matchesData.length);
                setMatches(matchesData);
            },
            (error) => {
                console.error('Matches listener error:', error);
            }
        );
        unsubscribers.push(unsubMatches);

        setLoading(false);

        // Cleanup all listeners on unmount
        return () => {
            unsubscribers.forEach(unsub => unsub());
        };
    }, []);

    // Add class to body for full-screen admin layout
    useEffect(() => {
        document.body.classList.add('admin-page-active');
        return () => {
            document.body.classList.remove('admin-page-active');
        };
    }, []);

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
    ];

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
                {activeTab === 'overview' && <OverviewTab stats={stats} />}
                {activeTab === 'users' && <UsersTab users={users} searchTerm={searchTerm} setSearchTerm={setSearchTerm} />}
                {activeTab === 'meetings' && <MeetingsTab meetings={meetings} users={users} />}
                {activeTab === 'transactions' && <TransactionsTab transactions={transactions} users={users} />}
                {activeTab === 'matches' && <MatchesTab matches={matches} users={users} />}
            </div>

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

// ============ OVERVIEW TAB ============
function OverviewTab({ stats }) {
    if (!stats) return null;

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

    return (
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
    );
}

// ============ USERS TAB ============
function UsersTab({ users, searchTerm, setSearchTerm }) {
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
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#F9FAFB' }}>
                            <th style={thStyle}>Name</th>
                            <th style={thStyle}>Email</th>
                            <th style={thStyle}>Role</th>
                            <th style={thStyle}>Profile</th>
                            <th style={thStyle}>Joined</th>
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
                                    {user.profileComplete ? (
                                        <CheckCircle size={16} color="#22C55E" />
                                    ) : (
                                        <XCircle size={16} color="#EF4444" />
                                    )}
                                </td>
                                <td style={tdStyle}>
                                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
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
function MeetingsTab({ meetings, users }) {
    const getUser = (id) => users.find(u => u.id === id);

    const statusColors = {
        'PENDING_ACCEPTANCE': { bg: '#FEF3C7', color: '#D97706' },
        'SCHEDULED': { bg: '#DBEAFE', color: '#2563EB' },
        'CONFIRMED': { bg: '#D1FAE5', color: '#059669' },
        'CANCELLED': { bg: '#FEE2E2', color: '#DC2626' },
        'DECLINED': { bg: '#FEE2E2', color: '#DC2626' },
    };

    return (
        <div style={{
            background: 'white',
            borderRadius: 12,
            overflow: 'hidden',
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
                    </tr>
                </thead>
                <tbody>
                    {meetings.map(meeting => {
                        const company = getUser(meeting.companyId);
                        const designer = getUser(meeting.seekerId);
                        const sc = statusColors[meeting.status] || { bg: '#F3F4F6', color: '#666' };

                        return (
                            <tr key={meeting.id} style={{ borderTop: '1px solid #E5E7EB' }}>
                                <td style={tdStyle}>
                                    {company?.profile?.companyName || company?.email || 'Unknown'}
                                </td>
                                <td style={tdStyle}>
                                    {designer?.profile?.name || designer?.email || 'Unknown'}
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
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            <p style={{ padding: 12, fontSize: 13, color: '#888' }}>
                Showing {meetings.length} meetings
            </p>
        </div>
    );
}

// ============ TRANSACTIONS TAB ============
function TransactionsTab({ transactions, users }) {
    const getUser = (id) => users.find(u => u.id === id);

    return (
        <div style={{
            background: 'white',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ background: '#F9FAFB' }}>
                        <th style={thStyle}>User</th>
                        <th style={thStyle}>Type</th>
                        <th style={thStyle}>Amount</th>
                        <th style={thStyle}>Status</th>
                        <th style={thStyle}>Date</th>
                    </tr>
                </thead>
                <tbody>
                    {transactions.map(tx => {
                        const user = getUser(tx.userId);
                        const isCredit = ['WALLET_TOP_UP', 'MEETING_EARNING'].includes(tx.type);

                        return (
                            <tr key={tx.id} style={{ borderTop: '1px solid #E5E7EB' }}>
                                <td style={tdStyle}>
                                    {user?.profile?.name || user?.profile?.companyName || user?.email || 'Unknown'}
                                </td>
                                <td style={tdStyle}>
                                    <span style={{ fontSize: 13 }}>
                                        {tx.type?.replace(/_/g, ' ')}
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
                                        background: tx.status === 'COMPLETED' ? '#D1FAE5' : '#FEF3C7',
                                        color: tx.status === 'COMPLETED' ? '#059669' : '#D97706',
                                    }}>
                                        {tx.status}
                                    </span>
                                </td>
                                <td style={tdStyle}>
                                    {tx.createdAt ? new Date(tx.createdAt).toLocaleString() : 'N/A'}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            <p style={{ padding: 12, fontSize: 13, color: '#888' }}>
                Showing {transactions.length} transactions
            </p>
        </div>
    );
}

// ============ MATCHES TAB ============
function MatchesTab({ matches, users }) {
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

    return (
        <div style={{
            background: 'white',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ background: '#F9FAFB' }}>
                        <th style={thStyle}>User 1</th>
                        <th style={thStyle}>User 2</th>
                        <th style={thStyle}>Matched At</th>
                    </tr>
                </thead>
                <tbody>
                    {uniqueMatches.map((match, idx) => {
                        // Get both users from the match
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
                                </td>
                                <td style={tdStyle}>
                                    {match.matchedAt ? new Date(match.matchedAt).toLocaleString() : 'N/A'}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            <p style={{ padding: 12, fontSize: 13, color: '#888' }}>
                Showing {uniqueMatches.length} unique matches
            </p>
        </div>
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
