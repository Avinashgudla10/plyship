'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, ArrowLeft, Briefcase, User, Home, Calendar, Clock, Check, X, RefreshCw, AlertCircle, Wallet, Star, Lock, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { subscribeToMessages } from '../lib/firebase';
import { StartProjectModal } from './ProjectsView';
import { ScheduleMeetingModal } from './MeetingsView';
import ReviewModal from './ReviewModal';

// Chat list view
export function ChatListView({ chats = [], onChatSelect, user }) {
    const [filter, setFilter] = useState('all');
    const [filterOpen, setFilterOpen] = useState(false);
    const isCompany = user?.role === 'COMPANY';

    const MEETING_STATUS_CONFIG = {
        PENDING_ACCEPTANCE: { label: 'Pending', color: '#3B82F6', bg: '#EFF6FF', icon: '⏳' },
        SCHEDULED: { label: 'Scheduled', color: '#F59E0B', bg: '#FFFBEB', icon: '📅' },
        CONFIRMED: { label: 'Completed', color: '#22C55E', bg: '#F0FDF4', icon: '✓' },
        CANCELLED: { label: 'Cancelled', color: '#EF4444', bg: '#FEF2F2', icon: '✕' },
        DECLINED: { label: 'Declined', color: '#EF4444', bg: '#FEF2F2', icon: '✕' },
        DISPUTE: { label: 'Dispute', color: '#DC2626', bg: '#FEF2F2', icon: '⚠' },
    };

    const FILTERS = [
        { key: 'all', label: 'All' },
        { key: 'no_meeting', label: 'No Meeting' },
        { key: 'PENDING_ACCEPTANCE', label: 'Pending' },
        { key: 'SCHEDULED', label: 'Scheduled' },
        { key: 'CONFIRMED', label: 'Completed' },
        { key: 'ended', label: 'Cancelled' },
    ];

    const filteredChats = chats.filter(chat => {
        if (filter === 'all') return true;
        if (filter === 'no_meeting') return !chat.meetingStatus;
        if (filter === 'ended') return ['CANCELLED', 'DECLINED'].includes(chat.meetingStatus);
        return chat.meetingStatus === filter;
    });

    if (chats.length === 0) {
        return (
            <div style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: 32,
            }}>
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', bounce: 0.5 }}
                    style={{
                        width: 80,
                        height: 80,
                        borderRadius: 24,
                        background: 'var(--pastel-green)',
                        border: '1px solid var(--pastel-mint)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 20,
                    }}
                >
                    <MessageCircle size={36} color="var(--primary)" />
                </motion.div>
                <h2 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 24,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginBottom: 8,
                }}>
                    No conversations yet
                </h2>
                <p style={{
                    fontSize: 15,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                }}>
                    Connect with someone to start chatting!
                </p>
            </div>
        );
    }

    return (
        <div style={{
            height: '100%',
            overflow: 'auto',
            padding: '16px',
        }}>
            {/* Header with filter */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h2 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 22,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                }}>
                    Messages
                </h2>

                {/* Hamburger Filter Button (Companies only) */}
                {isCompany && (
                    <div style={{ position: 'relative' }}>
                        <motion.button
                            onClick={() => setFilterOpen(!filterOpen)}
                            whileTap={{ scale: 0.93 }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '7px 12px',
                                borderRadius: 10,
                                border: filter !== 'all' ? '1.5px solid var(--primary)' : '1px solid var(--border-light)',
                                background: filter !== 'all' ? 'var(--pastel-green)' : 'white',
                                color: filter !== 'all' ? 'var(--primary)' : 'var(--text-secondary)',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                        >
                            <SlidersHorizontal size={14} />
                            {filter !== 'all' ? FILTERS.find(f => f.key === filter)?.label : 'Filter'}
                            <ChevronDown size={12} style={{ transform: filterOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
                        </motion.button>

                        {/* Dropdown */}
                        <AnimatePresence>
                            {filterOpen && (
                                <>
                                    {/* Invisible overlay to close dropdown */}
                                    <div
                                        onClick={() => setFilterOpen(false)}
                                        style={{ position: 'fixed', inset: 0, zIndex: 49 }}
                                    />
                                    <motion.div
                                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                                        transition={{ duration: 0.15 }}
                                        style={{
                                            position: 'absolute',
                                            top: '110%',
                                            right: 0,
                                            background: 'white',
                                            borderRadius: 14,
                                            boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                                            border: '1px solid var(--border-light)',
                                            padding: 6,
                                            minWidth: 160,
                                            zIndex: 50,
                                            overflow: 'hidden',
                                        }}
                                    >
                                        {FILTERS.map(f => (
                                            <motion.button
                                                key={f.key}
                                                onClick={() => { setFilter(f.key); setFilterOpen(false); }}
                                                whileTap={{ scale: 0.97 }}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                    width: '100%',
                                                    padding: '10px 14px',
                                                    borderRadius: 10,
                                                    border: 'none',
                                                    background: filter === f.key ? 'var(--pastel-green)' : 'transparent',
                                                    color: filter === f.key ? 'var(--primary)' : 'var(--text-primary)',
                                                    fontSize: 13,
                                                    fontWeight: filter === f.key ? 700 : 500,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s',
                                                    textAlign: 'left',
                                                }}
                                            >
                                                {filter === f.key && <Check size={14} />}
                                                {f.label}
                                            </motion.button>
                                        ))}
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredChats.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 14 }}>
                        No chats match this filter
                    </div>
                ) : filteredChats.map((chat, index) => {
                    const isBroadcast = chat?.isBroadcast || chat?.matchedUserId === 'plyship-admin';
                    const isChatCompany = !isBroadcast && (chat?.matchedUserRole === 'COMPANY' || chat?.role === 'COMPANY');
                    const profile = chat?.matchedUserProfile || chat?.profile || {};
                    const name = chat?.matchedUserName || (isChatCompany ? profile.companyName : profile.name);
                    const image = isBroadcast ? '/favicon.png' : (profile.avatar || profile.portfolioImages?.[0]);
                    const statusConfig = chat.meetingStatus ? MEETING_STATUS_CONFIG[chat.meetingStatus] : null;

                    // Format last message time
                    const formatTime = (timestamp) => {
                        if (!timestamp) return '';
                        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
                        const now = new Date();
                        const diff = now - date;
                        if (diff < 60000) return 'Just now';
                        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
                        if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                    };

                    return (
                        <motion.div
                            key={chat.id || index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            onClick={() => onChatSelect?.(chat)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                padding: 14,
                                borderRadius: 14,
                                background: 'white',
                                border: statusConfig && chat.meetingStatus === 'PENDING_ACCEPTANCE'
                                    ? '1.5px solid #3B82F640'
                                    : '1px solid var(--border-light)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                        >
                            {/* Avatar */}
                            <div style={{
                                width: 52,
                                height: 52,
                                borderRadius: isChatCompany ? 14 : '50%',
                                background: image ? `url(${image}) center/cover` : 'var(--pastel-green)',
                                border: '2px solid var(--pastel-mint)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}>
                                {!image && (isChatCompany ? <Briefcase size={22} color="var(--primary)" /> : <User size={22} color="var(--primary)" />)}
                            </div>

                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                                    <h3 style={{
                                        fontSize: 15,
                                        fontWeight: 700,
                                        color: 'var(--text-primary)',
                                    }}>
                                        {name || 'Unknown'}
                                    </h3>
                                    {/* Instagram-style Verified Badge for PlyShip Team */}
                                    {isBroadcast && (
                                        <span style={{ display: 'inline-flex', flexShrink: 0 }}>
                                            <svg width="18" height="18" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M19.998 3.094L16.793 0l-4.463 2.08-4.878-.636L5.718 5.72l-3.64 1.735-.637 4.878L0 16.795l2.094 3.203L0 23.2l1.442 4.463-2.08 4.878.636 4.878L3.64 39.15l1.735 3.64 4.878.637L14.795 40l3.203-2.094L21.2 40l4.463-1.442 4.878 2.08 4.878-.636L37.15 36.36l3.64-1.735.637-4.878L40 25.205l-2.094-3.203L40 18.8l-1.442-4.463 2.08-4.878-.636-4.878L36.36 2.85l-1.735-3.64-4.878-.637L25.205 0l-3.203 2.094z" transform="scale(0.5)" fill="#1D9BF0" />
                                                <path d="M17.204 10.165l-5.88 5.88-2.528-2.528a1.2 1.2 0 10-1.697 1.697l3.376 3.376a1.2 1.2 0 001.697 0l6.728-6.728a1.2 1.2 0 00-1.697-1.697z" fill="white" />
                                            </svg>
                                        </span>
                                    )}
                                    {/* Meeting Status Badge */}
                                    {statusConfig && (
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 3,
                                            padding: '2px 8px',
                                            borderRadius: 10,
                                            background: statusConfig.bg,
                                            color: statusConfig.color,
                                            fontSize: 10,
                                            fontWeight: 700,
                                            letterSpacing: 0.3,
                                            flexShrink: 0,
                                        }}>
                                            {statusConfig.icon} {statusConfig.label}
                                        </span>
                                    )}
                                </div>
                                <p style={{
                                    fontSize: 13,
                                    color: chat.lastMessage ? 'var(--text-secondary)' : 'var(--text-muted)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    fontStyle: chat.lastMessage ? 'normal' : 'italic',
                                }}>
                                    {chat.lastMessage || 'Tap to start chatting...'}
                                </p>
                            </div>

                            {/* Time */}
                            <span style={{
                                fontSize: 11,
                                color: 'var(--text-muted)',
                                flexShrink: 0,
                            }}>
                                {chat.lastMessageAt ? formatTime(chat.lastMessageAt) : 'New'}
                            </span>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}

// Individual chat view
export function ChatView({ chat, onBack, onNavigate }) {
    const {
        user, sendMessage, getChatId, getWallet,
        getMeetings, acceptMeeting, declineMeeting, confirmMeeting, cancelMeeting, denyMeeting, verifyMeetingOTP,
        getProjects, acceptProject, declineProject
    } = useAuth();
    const { showToast, showConfirm } = useToast();
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [sending, setSending] = useState(false);
    const [showProjectModal, setShowProjectModal] = useState(false);
    const [showMeetingModal, setShowMeetingModal] = useState(false);
    const [showRescheduleModal, setShowRescheduleModal] = useState(false);
    const [meetings, setMeetings] = useState([]);
    const [meetingsLoaded, setMeetingsLoaded] = useState(false);
    const [projects, setProjects] = useState([]);
    const [actionLoading, setActionLoading] = useState(null);
    const [walletBalance, setWalletBalance] = useState(null);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [reviewData, setReviewData] = useState(null); // { type: 'MEETING' | 'PROJECT', relatedId: string }
    const [otpInput, setOtpInput] = useState('');
    const messagesEndRef = useRef(null);

    const isSeeker = user?.role === 'SEEKER';
    const isCompanyUser = user?.role === 'COMPANY';
    const MEETING_FEE = 500;

    const isBroadcast = chat?.isBroadcast || chat?.matchedUserId === 'plyship-admin';

    // Get chat partner info
    const isCompany = !isBroadcast && (chat?.matchedUserRole === 'COMPANY' || chat?.role === 'COMPANY');
    const profile = chat?.matchedUserProfile || chat?.profile || {};
    const name = chat?.matchedUserName || (isCompany ? profile.companyName : profile.name);
    const image = isBroadcast ? '/favicon.png' : (profile.avatar || profile.portfolioImages?.[0]);
    const otherUserId = chat?.matchedUserId || chat?.id;

    // Generate chat ID — broadcast chats use their own ID format
    const chatId = isBroadcast ? chat.id : (user && otherUserId ? getChatId(user.id, otherUserId) : null);
    console.log(`🔍 ChatView: user=${user?.id} (${user?.role}), otherUserId=${otherUserId}, chatId=${chatId}`);

    // Fetch meetings between these two users (with polling for real-time updates)
    useEffect(() => {
        const fetchMeetings = async () => {
            if (!user || !otherUserId) return;
            const allMeetings = await getMeetings();
            console.log('📋 All meetings for user:', allMeetings);
            console.log('🎯 Looking for otherUserId:', otherUserId);
            // Filter to only meetings with this match
            const relevantMeetings = allMeetings.filter(m => {
                const matchesCompany = m.companyId === otherUserId;
                const matchesSeeker = m.seekerId === otherUserId;
                console.log(`Meeting ${m.id}: companyId=${m.companyId}, seekerId=${m.seekerId}, matches=${matchesCompany || matchesSeeker}`);
                return (matchesCompany || matchesSeeker) && !m.rescheduledTo;
            });
            console.log('✅ Relevant meetings:', relevantMeetings);
            setMeetings(relevantMeetings);
            setMeetingsLoaded(true);
        };

        // Fetch immediately
        fetchMeetings();

        // Poll every 5 seconds to catch new meeting requests
        const interval = setInterval(fetchMeetings, 5000);

        return () => clearInterval(interval);
    }, [user, otherUserId, getMeetings]);

    // Auto-open meeting modal ONCE for brand new matches with no meetings at all
    const autoPopupHandled = useRef(false);
    useEffect(() => {
        if (meetingsLoaded && !autoPopupHandled.current) {
            autoPopupHandled.current = true;
            if (meetings.length === 0 && !chat?.lastMessage) {
                setShowMeetingModal(true);
            }
        }
    }, [meetingsLoaded]);

    // Fetch projects between these two users (with polling for real-time updates)
    useEffect(() => {
        const fetchProjects = async () => {
            if (!user || !otherUserId) return;
            const allProjects = await getProjects();
            console.log('📁 Fetched all projects:', allProjects.map(p => ({ id: p.id, status: p.status, companyId: p.companyId, seekerId: p.seekerId })));
            console.log('🎯 Filtering for otherUserId:', otherUserId);
            // Filter to only projects with this match
            const relevantProjects = allProjects.filter(p =>
                (p.companyId === otherUserId || p.seekerId === otherUserId)
            );
            console.log('✅ Relevant projects:', relevantProjects.map(p => ({ id: p.id, status: p.status })));
            setProjects(relevantProjects);
        };

        fetchProjects();
        // Poll every 3 seconds for faster updates
        const interval = setInterval(fetchProjects, 3000);
        return () => clearInterval(interval);
    }, [user, otherUserId, getProjects]);

    // Fetch wallet balance for companies (to check if they can accept meetings)
    useEffect(() => {
        const fetchWallet = async () => {
            if (!user || !isCompanyUser) return;
            const wallet = await getWallet();
            setWalletBalance(wallet?.balance || 0);
        };

        fetchWallet();
        // Poll wallet every 10 seconds
        const interval = setInterval(fetchWallet, 10000);
        return () => clearInterval(interval);
    }, [user, isCompanyUser, getWallet]);


    // Get the most relevant meeting (pending or upcoming)
    const activeMeeting = meetings.find(m =>
        ['PENDING_ACCEPTANCE', 'SCHEDULED', 'DISPUTE'].includes(m.status)
    );

    // Check if there's a confirmed meeting with this user (payment transferred)
    const hasConfirmedMeeting = meetings.some(m => m.status === 'CONFIRMED');

    // Get the most recent cancelled/declined meeting (for reschedule prompt)
    const cancelledMeeting = meetings.find(m =>
        ['CANCELLED', 'DECLINED'].includes(m.status)
    );

    // Get the most relevant project (pending acceptance)
    const activeProject = projects.find(p => p.status === 'PENDING_ACCEPTANCE');

    // Check if there's an accepted project with this user
    const hasAcceptedProject = projects.some(p => p.status === 'ACCEPTED');

    // Debug: log button visibility states and project info
    console.log('🔘 Button visibility:', {
        hasConfirmedMeeting,
        activeMeeting: activeMeeting?.id,
        activeMeetingStatus: activeMeeting?.status,
        showMeetButton: !hasConfirmedMeeting,
        showStartProjectButton: hasConfirmedMeeting,
        meetingsCount: meetings.length,
        allMeetingStatuses: meetings.map(m => ({ id: m.id, status: m.status }))
    });

    // Debug: log project visibility states
    console.log('🏠 Project visibility:', {
        projectsCount: projects.length,
        activeProject: activeProject?.id,
        activeProjectStatus: activeProject?.status,
        activeProjectRequestedBy: activeProject?.requestedBy,
        hasAcceptedProject,
        showProjectBanner: !!activeProject && !hasAcceptedProject,
        allProjects: projects.map(p => ({
            id: p.id,
            status: p.status,
            companyId: p.companyId,
            seekerId: p.seekerId,
            requestedBy: p.requestedBy
        }))
    });

    // Subscribe to real-time messages
    useEffect(() => {
        if (!chatId) return;

        console.log('📡 Subscribing to messages for chat:', chatId);
        const unsubscribe = subscribeToMessages(chatId, (newMessages) => {
            console.log('📨 Received', newMessages.length, 'messages');
            setMessages(newMessages);
        });

        return () => {
            console.log('🔌 Unsubscribing from chat:', chatId);
            unsubscribe();
        };
    }, [chatId]);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!message.trim() || sending) return;

        setSending(true);
        const result = await sendMessage(otherUserId, message);
        if (result.success) {
            setMessage('');
        }
        setSending(false);
    };

    // Format message time
    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-secondary)',
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                background: 'white',
                borderBottom: '1px solid var(--border-light)',
            }}>
                <motion.button
                    onClick={onBack}
                    whileTap={{ scale: 0.9 }}
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: 'var(--bg-secondary)',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                    }}
                >
                    <ArrowLeft size={20} color="var(--text-secondary)" />
                </motion.button>

                <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: isCompany ? 12 : '50%',
                    background: image ? `url(${image}) center/cover` : 'var(--pastel-green)',
                    border: '2px solid var(--pastel-mint)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                }}>
                    {!image && (isCompany ? <Briefcase size={18} color="var(--primary)" /> : <User size={18} color="var(--primary)" />)}
                </div>

                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                            {name || 'Unknown'}
                        </h3>
                        {isBroadcast && (
                            <span style={{ display: 'inline-flex', flexShrink: 0 }}>
                                <svg width="18" height="18" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M19.998 3.094L16.793 0l-4.463 2.08-4.878-.636L5.718 5.72l-3.64 1.735-.637 4.878L0 16.795l2.094 3.203L0 23.2l1.442 4.463-2.08 4.878.636 4.878L3.64 39.15l1.735 3.64 4.878.637L14.795 40l3.203-2.094L21.2 40l4.463-1.442 4.878 2.08 4.878-.636L37.15 36.36l3.64-1.735.637-4.878L40 25.205l-2.094-3.203L40 18.8l-1.442-4.463 2.08-4.878-.636-4.878L36.36 2.85l-1.735-3.64-4.878-.637L25.205 0l-3.203 2.094z" transform="scale(0.5)" fill="#1D9BF0" />
                                    <path d="M17.204 10.165l-5.88 5.88-2.528-2.528a1.2 1.2 0 10-1.697 1.697l3.376 3.376a1.2 1.2 0 001.697 0l6.728-6.728a1.2 1.2 0 00-1.697-1.697z" fill="white" />
                                </svg>
                            </span>
                        )}
                    </div>
                    <span style={{ fontSize: 12, color: isBroadcast ? 'var(--text-muted)' : 'var(--success)' }}>{isBroadcast ? 'Official Broadcast' : 'Online'}</span>
                </div>

                {/* Schedule Meeting Button - hide once meeting is confirmed and Start Project is visible */}
                {!isBroadcast && !hasConfirmedMeeting && (
                    <motion.button
                        onClick={() => setShowMeetingModal(true)}
                        whileTap={{ scale: 0.9 }}
                        style={{
                            padding: '8px 12px',
                            borderRadius: 10,
                            background: activeMeeting ? 'var(--bg-secondary)' : '#EFF6FF',
                            border: activeMeeting ? '1px solid var(--border)' : '1px solid #BFDBFE',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            cursor: activeMeeting ? 'default' : 'pointer',
                            opacity: activeMeeting ? 0.5 : 1,
                        }}
                        disabled={!!activeMeeting}
                    >
                        <Calendar size={14} color={activeMeeting ? 'var(--text-muted)' : '#3B82F6'} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: activeMeeting ? 'var(--text-muted)' : '#3B82F6' }}>
                            {activeMeeting ? 'Meeting Set' : 'Meet'}
                        </span>
                    </motion.button>
                )}

                {/* Start Project Button - only shows after meeting completion */}
                {hasConfirmedMeeting && (
                    <motion.button
                        onClick={() => setShowProjectModal(true)}
                        whileTap={{ scale: 0.9 }}
                        style={{
                            padding: '8px 12px',
                            borderRadius: 10,
                            background: 'var(--gradient-primary)',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            cursor: 'pointer',
                        }}
                    >
                        <Home size={14} color="white" />
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'white' }}>Start Project</span>
                    </motion.button>
                )}
            </div>

            {/* Meeting Banner - show if there's an active meeting but NOT if already confirmed */}
            {activeMeeting && !hasConfirmedMeeting && (() => {
                const meetingTime = new Date(activeMeeting.scheduledAt);
                const now = new Date();
                const isExpired = meetingTime < now;
                const isCompanyUser = user?.role === 'COMPANY';
                const hasUserConfirmed = isCompanyUser ? activeMeeting.companyConfirmed : activeMeeting.seekerConfirmed;
                const hasUserDenied = isCompanyUser ? activeMeeting.companyDenied : activeMeeting.seekerDenied;
                const hasUserResponded = hasUserConfirmed || hasUserDenied;

                // Helper to refresh meetings
                const refreshMeetings = async () => {
                    const updated = await getMeetings();
                    setMeetings(updated.filter(m =>
                        (m.companyId === otherUserId || m.seekerId === otherUserId) && !m.rescheduledTo
                    ));
                };

                // DISPUTE = legacy dispute — show admin review banner
                if (activeMeeting.status === 'DISPUTE') {
                    return (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            style={{ padding: 12, background: '#FEF3C7', borderBottom: '2px solid #F59E0B' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <AlertCircle size={16} color="#B45309" />
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: 13, fontWeight: 600, color: '#92400E' }}>
                                        ⚠️ Dispute Raised
                                    </p>
                                    <p style={{ fontSize: 11, color: '#B45309' }}>
                                        Someone from our team will contact you shortly.
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    );
                }

                // PENDING_ACCEPTANCE + EXPIRED = Show expired message with reschedule
                if (activeMeeting.status === 'PENDING_ACCEPTANCE' && isExpired) {
                    return (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            style={{ padding: 12, background: '#FEE2E2', borderBottom: '1px solid var(--border-light)' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <AlertCircle size={16} color="#DC2626" />
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: 13, fontWeight: 600, color: '#DC2626' }}>Meeting Request Expired</p>
                                    <p style={{ fontSize: 11, color: '#B91C1C' }}>
                                        The scheduled time has passed. Please reschedule.
                                    </p>
                                </div>
                                <motion.button
                                    onClick={() => setShowRescheduleModal(true)}
                                    whileTap={{ scale: 0.95 }}
                                    style={{
                                        padding: '6px 12px', borderRadius: 8, background: '#3B82F6',
                                        border: 'none', color: 'white', fontSize: 12, fontWeight: 600,
                                        display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                                    }}
                                >
                                    <RefreshCw size={14} />
                                    Reschedule
                                </motion.button>
                            </div>
                        </motion.div>
                    );
                }

                // PENDING_ACCEPTANCE + NOT EXPIRED = Show accept/decline (or low balance warning for companies)
                if (activeMeeting.status === 'PENDING_ACCEPTANCE' && !isExpired) {
                    const isReceiver = activeMeeting.requestedBy !== user?.id;
                    const hasLowBalance = isCompanyUser && walletBalance !== null && walletBalance < MEETING_FEE;

                    // Show low balance warning for company receiving a meeting request
                    if (isReceiver && hasLowBalance) {
                        return (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                style={{ padding: 12, background: '#FEF3C7', borderBottom: '1px solid var(--border-light)' }}
                            >
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                    <AlertCircle size={18} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontSize: 13, fontWeight: 600, color: '#92400E' }}>
                                            Meeting request received
                                        </p>
                                        <p style={{ fontSize: 11, color: '#D97706', marginBottom: 6 }}>
                                            {meetingTime.toLocaleDateString('en-IN', {
                                                weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </p>
                                        <div style={{
                                            padding: '8px 10px',
                                            borderRadius: 8,
                                            background: '#FDE68A',
                                            marginBottom: 8,
                                        }}>
                                            <p style={{ fontSize: 12, color: '#92400E', fontWeight: 500 }}>
                                                ⚠️ Your wallet balance is low (₹{walletBalance})
                                            </p>
                                            <p style={{ fontSize: 11, color: '#B45309', marginTop: 2 }}>
                                                You need ₹{MEETING_FEE} to accept this meeting
                                            </p>
                                        </div>
                                        <motion.button
                                            onClick={() => onNavigate?.('wallet')}
                                            whileTap={{ scale: 0.95 }}
                                            style={{
                                                width: '100%',
                                                padding: '10px 14px',
                                                borderRadius: 10,
                                                background: 'var(--gradient-primary)',
                                                border: 'none',
                                                color: 'white',
                                                fontSize: 13,
                                                fontWeight: 600,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 6,
                                                cursor: 'pointer',
                                                boxShadow: 'var(--shadow-sm)',
                                            }}
                                        >
                                            <Wallet size={16} />
                                            Add Funds to Wallet
                                        </motion.button>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    }

                    // Normal accept/decline banner
                    return (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            style={{ padding: 12, background: '#EFF6FF', borderBottom: '1px solid var(--border-light)' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Clock size={16} color="#3B82F6" />
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: 13, fontWeight: 600, color: '#1E40AF' }}>
                                        {activeMeeting.requestedBy === user?.id ? 'Meeting request sent' : 'Meeting request received'}
                                    </p>
                                    <p style={{ fontSize: 11, color: '#3B82F6' }}>
                                        {meetingTime.toLocaleDateString('en-IN', {
                                            weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                        })}
                                    </p>
                                </div>
                                {isReceiver && (
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <motion.button
                                            onClick={async () => {
                                                setActionLoading('accept');
                                                const result = await acceptMeeting(activeMeeting.id);
                                                if (result.success) {
                                                    await refreshMeetings();
                                                } else if (result.expired) {
                                                    showToast('This meeting has expired. Please reschedule.', 'warning');
                                                    await refreshMeetings();
                                                } else if (result.error) {
                                                    showToast(result.error, 'error');
                                                }
                                                setActionLoading(null);
                                            }}
                                            disabled={actionLoading}
                                            whileTap={{ scale: 0.95 }}
                                            style={{
                                                padding: '6px 12px', borderRadius: 8, background: '#22C55E',
                                                border: 'none', color: 'white', fontSize: 12, fontWeight: 600,
                                                display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                                            }}
                                        >
                                            <Check size={14} />
                                            Accept
                                        </motion.button>
                                        <motion.button
                                            onClick={async () => {
                                                setActionLoading('decline');
                                                await declineMeeting(activeMeeting.id);
                                                await refreshMeetings();
                                                setActionLoading(null);
                                            }}
                                            disabled={actionLoading}
                                            whileTap={{ scale: 0.95 }}
                                            style={{
                                                padding: '6px 12px', borderRadius: 8, background: '#FEE2E2',
                                                border: 'none', color: '#EF4444', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                            }}
                                        >
                                            <X size={14} />
                                        </motion.button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    );
                }

                // SCHEDULED + EXPIRED = OTP Confirmation
                if (activeMeeting.status === 'SCHEDULED' && isExpired) {
                    // COMPANY sees the OTP code
                    if (isCompanyUser) {
                        return (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                style={{ padding: 16, background: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)', borderBottom: '2px solid #22C55E' }}
                            >
                                <div style={{ textAlign: 'center' }}>
                                    <p style={{ fontSize: 13, fontWeight: 600, color: '#166534', marginBottom: 4 }}>
                                        📋 Meeting Verification Code
                                    </p>
                                    <p style={{ fontSize: 11, color: '#15803D', marginBottom: 12 }}>
                                        Share this code with the seeker to confirm the meeting
                                    </p>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'center',
                                        gap: 6,
                                        marginBottom: 8,
                                    }}>
                                        {String(activeMeeting.meetingOTP || '------').split('').map((digit, i) => (
                                            <div key={i} style={{
                                                width: 38,
                                                height: 46,
                                                borderRadius: 10,
                                                background: 'white',
                                                border: '2px solid #22C55E',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: 22,
                                                fontWeight: 800,
                                                color: '#166534',
                                                fontFamily: 'monospace',
                                                boxShadow: '0 2px 8px rgba(34,197,94,0.15)',
                                            }}>
                                                {digit}
                                            </div>
                                        ))}
                                    </div>
                                    <p style={{ fontSize: 10, color: '#16A34A' }}>
                                        {meetingTime.toLocaleDateString('en-IN', {
                                            weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                        })}
                                    </p>
                                </div>
                            </motion.div>
                        );
                    }

                    // SEEKER sees OTP input
                    return (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            style={{ padding: 16, background: '#FFF7ED', borderBottom: '2px solid #F59E0B' }}
                        >
                            <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: 13, fontWeight: 600, color: '#92400E', marginBottom: 4 }}>
                                    🔑 Enter Meeting Code
                                </p>
                                <p style={{ fontSize: 11, color: '#B45309', marginBottom: 12 }}>
                                    Ask the company for the 6-digit verification code
                                </p>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 12 }}>
                                    {[0, 1, 2, 3, 4, 5].map(i => (
                                        <input
                                            key={i}
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={1}
                                            value={otpInput[i] || ''}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/\D/g, '');
                                                if (val.length <= 1) {
                                                    const newOtp = otpInput.split('');
                                                    newOtp[i] = val;
                                                    setOtpInput(newOtp.join(''));
                                                    // Auto-focus next input
                                                    if (val && i < 5) {
                                                        const next = e.target.parentNode.children[i + 1];
                                                        if (next) next.focus();
                                                    }
                                                }
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Backspace' && !otpInput[i] && i > 0) {
                                                    const prev = e.target.parentNode.children[i - 1];
                                                    if (prev) prev.focus();
                                                }
                                            }}
                                            style={{
                                                width: 38,
                                                height: 46,
                                                borderRadius: 10,
                                                border: `2px solid ${otpInput[i] ? '#F59E0B' : '#E5E7EB'}`,
                                                background: 'white',
                                                textAlign: 'center',
                                                fontSize: 22,
                                                fontWeight: 800,
                                                color: '#92400E',
                                                fontFamily: 'monospace',
                                                outline: 'none',
                                                padding: 0,
                                                transition: 'border-color 0.2s',
                                            }}
                                            onFocus={(e) => e.target.style.borderColor = '#F59E0B'}
                                            onBlur={(e) => { if (!otpInput[i]) e.target.style.borderColor = '#E5E7EB'; }}
                                        />
                                    ))}
                                </div>
                                <motion.button
                                    onClick={async () => {
                                        if (otpInput.length !== 6) {
                                            showToast('Please enter all 6 digits', 'warning');
                                            return;
                                        }
                                        setActionLoading('otp');
                                        const result = await verifyMeetingOTP(activeMeeting.id, otpInput);
                                        setActionLoading(null);
                                        if (result.success && result.bothConfirmed) {
                                            setOtpInput('');
                                            showToast('Meeting confirmed! Payment transferred.', 'success');
                                        } else if (result.wrongOTP) {
                                            showToast('Incorrect code. Please check with the company.', 'error');
                                        } else if (result.insufficientBalance) {
                                            showToast('Company has insufficient wallet balance.', 'warning');
                                        } else if (result.error) {
                                            showToast(result.error, 'error');
                                        }
                                        refreshMeetings();
                                    }}
                                    disabled={actionLoading || otpInput.length !== 6}
                                    whileTap={{ scale: 0.95 }}
                                    style={{
                                        width: '100%',
                                        padding: '10px 14px',
                                        borderRadius: 10,
                                        background: otpInput.length === 6 ? 'var(--gradient-primary)' : '#E5E7EB',
                                        border: 'none',
                                        color: otpInput.length === 6 ? 'white' : '#9CA3AF',
                                        fontSize: 13,
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 6,
                                        cursor: otpInput.length === 6 ? 'pointer' : 'not-allowed',
                                    }}
                                >
                                    <Check size={16} />
                                    {actionLoading === 'otp' ? 'Verifying...' : 'Verify Code'}
                                </motion.button>
                                <p style={{ fontSize: 10, color: '#D97706', marginTop: 6 }}>
                                    {meetingTime.toLocaleDateString('en-IN', {
                                        weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                    })}
                                </p>
                            </div>
                        </motion.div>
                    );
                }

                // SCHEDULED + NOT EXPIRED = Show upcoming meeting
                if (activeMeeting.status === 'SCHEDULED' && !isExpired) {
                    return (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            style={{ padding: 12, background: '#DCFCE7', borderBottom: '1px solid var(--border-light)' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Calendar size={16} color="#16A34A" />
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: 13, fontWeight: 600, color: '#166534' }}>Meeting Confirmed!</p>
                                    <p style={{ fontSize: 11, color: '#16A34A' }}>
                                        {meetingTime.toLocaleDateString('en-IN', {
                                            weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                        })}
                                    </p>
                                </div>
                                <motion.button
                                    onClick={async () => {
                                        const yes = await showConfirm('Are you sure you want to cancel this meeting?', 'Cancel Meeting');
                                        if (yes) {
                                            setActionLoading('cancel');
                                            await cancelMeeting(activeMeeting.id);
                                            await refreshMeetings();
                                            setActionLoading(null);
                                        }
                                    }}
                                    disabled={actionLoading}
                                    whileTap={{ scale: 0.95 }}
                                    style={{
                                        padding: '6px 12px', borderRadius: 8, background: '#FEE2E2',
                                        border: 'none', color: '#EF4444', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                    }}
                                >
                                    Cancel
                                </motion.button>
                            </div>
                        </motion.div>
                    );
                }

                return null;
            })()}

            {/* Cancelled Meeting Banner - show if no active meeting but there's a cancelled one */}
            {!activeMeeting && cancelledMeeting && !hasConfirmedMeeting && (() => {
                const meetingTime = new Date(cancelledMeeting.scheduledAt);
                const cancelledBy = cancelledMeeting.cancelledBy;
                const wasCancelledByMe = cancelledBy === user?.id;
                const statusText = cancelledMeeting.status === 'DECLINED' ? 'Declined' : 'Cancelled';

                return (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        style={{ padding: 12, background: '#FEE2E2', borderBottom: '1px solid var(--border-light)' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <X size={16} color="#DC2626" />
                            <div style={{ flex: 1 }}>
                                <p style={{ fontSize: 13, fontWeight: 600, color: '#DC2626' }}>
                                    Meeting {statusText}
                                </p>
                                <p style={{ fontSize: 11, color: '#B91C1C' }}>
                                    {wasCancelledByMe
                                        ? 'You cancelled • '
                                        : cancelledMeeting.status === 'DECLINED'
                                            ? 'Request declined • '
                                            : 'They cancelled • '
                                    }
                                    {meetingTime.toLocaleDateString('en-IN', {
                                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                    })}
                                </p>
                            </div>
                            <motion.button
                                onClick={() => setShowMeetingModal(true)}
                                whileTap={{ scale: 0.95 }}
                                style={{
                                    padding: '8px 14px', borderRadius: 10, background: 'var(--gradient-primary)',
                                    border: 'none', color: 'white', fontSize: 12, fontWeight: 600,
                                    display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                                    boxShadow: 'var(--shadow-sm)',
                                }}
                            >
                                <RefreshCw size={14} />
                                Reschedule
                            </motion.button>
                        </div>
                    </motion.div>
                );
            })()}

            {/* Project Request Banner - show if there's a pending project */}
            {activeProject && !hasAcceptedProject && (() => {
                const isRequester = activeProject.requestedBy === user?.id;

                // Helper to refresh projects
                const refreshProjects = async () => {
                    const updated = await getProjects();
                    setProjects(updated.filter(p =>
                        (p.companyId === otherUserId || p.seekerId === otherUserId)
                    ));
                };

                return (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        style={{ padding: 12, background: '#E0F2FE', borderBottom: '1px solid var(--border-light)' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Home size={16} color="#0284C7" />
                            <div style={{ flex: 1 }}>
                                <p style={{ fontSize: 13, fontWeight: 600, color: '#0369A1' }}>
                                    {isRequester ? 'Project request sent' : 'Project request received'}
                                </p>
                                <p style={{ fontSize: 11, color: '#0284C7' }}>
                                    {activeProject.budgetRange || 'Budget not specified'}
                                </p>
                            </div>
                            {!isRequester && (
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <motion.button
                                        onClick={async () => {
                                            setActionLoading('acceptProject');
                                            const result = await acceptProject(activeProject.id);
                                            if (result.success) {
                                                showToast('Project accepted! Wallet unlocked for withdrawals.', 'success');
                                                await refreshProjects();
                                            } else {
                                                showToast(result.error, 'error');
                                            }
                                            setActionLoading(null);
                                        }}
                                        disabled={actionLoading}
                                        whileTap={{ scale: 0.95 }}
                                        style={{
                                            padding: '6px 12px', borderRadius: 8, background: '#22C55E',
                                            border: 'none', color: 'white', fontSize: 12, fontWeight: 600,
                                            display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                                        }}
                                    >
                                        <Check size={14} />
                                        Accept
                                    </motion.button>
                                    <motion.button
                                        onClick={async () => {
                                            setActionLoading('declineProject');
                                            const result = await declineProject(activeProject.id);
                                            if (result.success) {
                                                await refreshProjects();
                                            } else {
                                                showToast(result.error, 'error');
                                            }
                                            setActionLoading(null);
                                        }}
                                        disabled={actionLoading}
                                        whileTap={{ scale: 0.95 }}
                                        style={{
                                            padding: '6px 12px', borderRadius: 8, background: '#FEE2E2',
                                            border: 'none', color: '#EF4444', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                        }}
                                    >
                                        <X size={14} />
                                    </motion.button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                );
            })()}

            {/* Messages */}
            <div style={{
                flex: 1,
                overflow: 'auto',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
            }}>
                {messages.length === 0 ? (
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                    }}>
                        <MessageCircle size={48} style={{ marginBottom: 12, opacity: 0.5 }} />
                        <p>No messages yet</p>
                        <p style={{ fontSize: 13 }}>Say hello to start the conversation!</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMe = msg.senderId === user?.id;
                        return (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                style={{
                                    alignSelf: isMe ? 'flex-end' : 'flex-start',
                                    maxWidth: '75%',
                                }}
                            >
                                <div style={{
                                    padding: '12px 16px',
                                    borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                    background: isMe ? 'var(--gradient-primary)' : 'white',
                                    color: isMe ? 'white' : 'var(--text-primary)',
                                    boxShadow: 'var(--shadow-sm)',
                                }}>
                                    <p style={{ fontSize: 14, lineHeight: 1.4 }}>{msg.text}</p>
                                </div>
                                <span style={{
                                    fontSize: 10,
                                    color: 'var(--text-muted)',
                                    marginTop: 4,
                                    display: 'block',
                                    textAlign: isMe ? 'right' : 'left',
                                }}>
                                    {formatTime(msg.createdAt)}
                                </span>
                            </motion.div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input or Chat Closed Banner */}
            {hasAcceptedProject ? (
                <div style={{
                    padding: '16px 20px 24px',
                    background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)',
                    borderTop: '1px solid #BBF7D0',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <Lock size={20} color="#16A34A" />
                        <div>
                            <p style={{ fontSize: 14, fontWeight: 600, color: '#166534' }}>
                                Project Started!
                            </p>
                            <p style={{ fontSize: 12, color: '#15803D' }}>
                                Chat is now closed. Continue your project offline.
                            </p>
                        </div>
                    </div>
                    {isSeeker && (
                        <motion.button
                            onClick={() => {
                                const acceptedProject = projects.find(p => p.status === 'ACCEPTED');
                                setReviewData({ type: 'PROJECT', relatedId: acceptedProject?.id });
                                setShowReviewModal(true);
                            }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            style={{
                                width: '100%',
                                padding: 12,
                                borderRadius: 10,
                                background: 'white',
                                border: '1px solid #BBF7D0',
                                color: '#166534',
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                            }}
                        >
                            <Star size={18} />
                            Rate Your Experience
                        </motion.button>
                    )}
                </div>
            ) : (
                <div style={{
                    padding: '12px 16px 24px',
                    background: 'white',
                    borderTop: '1px solid var(--border-light)',
                    display: 'flex',
                    gap: 10,
                }}>
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Type a message..."
                        disabled={sending}
                        style={{
                            flex: 1,
                            padding: '14px 18px',
                            borderRadius: 24,
                            border: '1px solid var(--border)',
                            background: 'var(--bg-secondary)',
                            fontSize: 15,
                            outline: 'none',
                            opacity: sending ? 0.7 : 1,
                        }}
                    />
                    <motion.button
                        onClick={handleSend}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        disabled={sending || !message.trim()}
                        style={{
                            width: 48,
                            height: 48,
                            borderRadius: '50%',
                            background: 'var(--gradient-primary)',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: sending || !message.trim() ? 'not-allowed' : 'pointer',
                            boxShadow: 'var(--shadow-glow-soft)',
                            opacity: sending || !message.trim() ? 0.7 : 1,
                        }}
                    >
                        <Send size={20} color="white" />
                    </motion.button>
                </div>
            )}

            {/* Start Project Modal */}
            <AnimatePresence>
                {showProjectModal && (
                    <StartProjectModal
                        match={{ id: otherUserId }}
                        onClose={() => setShowProjectModal(false)}
                        onSuccess={() => setShowProjectModal(false)}
                    />
                )}
            </AnimatePresence>

            {/* Schedule Meeting Modal */}
            <AnimatePresence>
                {showMeetingModal && !showRescheduleModal && (
                    <ScheduleMeetingModal
                        match={{ id: otherUserId, name }}
                        onClose={() => setShowMeetingModal(false)}
                        onScheduled={async () => {
                            setShowMeetingModal(false);
                            // Refresh meetings to show the new request
                            const updated = await getMeetings();
                            setMeetings(updated.filter(m =>
                                (m.companyId === otherUserId || m.seekerId === otherUserId) && !m.rescheduledTo
                            ));
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Reschedule Meeting Modal - uses same component as schedule */}
            <AnimatePresence>
                {showRescheduleModal && !showMeetingModal && (
                    <ScheduleMeetingModal
                        match={{ id: otherUserId, name }}
                        onClose={() => setShowRescheduleModal(false)}
                        onScheduled={async () => {
                            setShowRescheduleModal(false);
                            // Cancel the old meeting and refresh
                            if (activeMeeting) {
                                await cancelMeeting(activeMeeting.id);
                            }
                            const updated = await getMeetings();
                            setMeetings(updated.filter(m =>
                                (m.companyId === otherUserId || m.seekerId === otherUserId) && !m.rescheduledTo
                            ));
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Review Modal */}
            <AnimatePresence>
                {showReviewModal && reviewData && (
                    <ReviewModal
                        companyId={otherUserId}
                        companyName={name}
                        type={reviewData.type}
                        relatedId={reviewData.relatedId}
                        onClose={() => {
                            setShowReviewModal(false);
                            setReviewData(null);
                        }}
                        onSuccess={() => {
                            setShowReviewModal(false);
                            setReviewData(null);
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
