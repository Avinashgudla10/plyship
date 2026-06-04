'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, ArrowLeft, Briefcase, User, Home, Calendar, Clock, Check, X, RefreshCw, AlertCircle, Wallet, Star, Lock, SlidersHorizontal, ChevronDown, Search, CreditCard, Mic, Plus, FileText, Image as ImageIcon, Square, Play, Pause, Loader2, Camera, Phone, MapPin, UserCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { subscribeToMessages, uploadFile } from '../lib/firebase';
import { StartProjectModal } from './ProjectsView';
import { ScheduleMeetingModal, AcceptAndScheduleModal } from './MeetingsView';
import ReviewModal from './ReviewModal';
import ProfileDetail from './ProfileDetail';
import { buildRazorpayOptions, openRazorpayCheckout } from '../utils/razorpayHelper';

// Chat list view
export function ChatListView({ chats = [], onChatSelect, user }) {
    const [filter, setFilter] = useState('all');
    const [filterOpen, setFilterOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const isCompany = user?.role === 'COMPANY';

    const MEETING_STATUS_CONFIG = {
        REQUESTED: { label: 'Requested', color: '#8B5CF6', bg: '#F5F3FF', icon: '📩' },
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
        { key: 'REQUESTED', label: 'Requested' },
        { key: 'PENDING_ACCEPTANCE', label: 'Pending' },
        { key: 'SCHEDULED', label: 'Scheduled' },
        { key: 'CONFIRMED', label: 'Completed' },
        { key: 'ended', label: 'Cancelled' },
    ];

    // Meeting priority: PENDING first, then SCHEDULED, then rest
    const meetingPriority = { REQUESTED: 4, PENDING_ACCEPTANCE: 3, SCHEDULED: 2 };

    const filteredChats = chats
        .filter(chat => {
            // Search filter
            if (searchTerm) {
                const name = (chat.matchedUserName || '').toLowerCase();
                if (!name.includes(searchTerm.toLowerCase())) return false;
            }
            // Status filter
            if (filter === 'all') return true;
            if (filter === 'no_meeting') return !chat.meetingStatus;
            if (filter === 'ended') return ['CANCELLED', 'DECLINED'].includes(chat.meetingStatus);
            return chat.meetingStatus === filter;
        })
        .sort((a, b) => {
            // Priority: meeting requests on top
            const pa = meetingPriority[a.meetingStatus] || 0;
            const pb = meetingPriority[b.meetingStatus] || 0;
            if (pa !== pb) return pb - pa;
            // Then by last message time
            const timeA = a.lastMessageAt?.toDate?.() || new Date(a.lastMessageAt || 0);
            const timeB = b.lastMessageAt?.toDate?.() || new Date(b.lastMessageAt || 0);
            return timeB - timeA;
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
            {/* Search bar */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                background: 'white',
                borderRadius: 12,
                border: '1px solid var(--border-light)',
                marginBottom: 14,
            }}>
                <Search size={18} color="var(--text-muted)" />
                <input
                    type="text"
                    placeholder="Search conversations..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{
                        border: 'none',
                        outline: 'none',
                        flex: 1,
                        fontSize: 14,
                        color: 'var(--text-primary)',
                        background: 'transparent',
                        padding: 0,
                    }}
                />
            </div>

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
                                border: statusConfig && (chat.meetingStatus === 'PENDING_ACCEPTANCE' || chat.meetingStatus === 'REQUESTED')
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
                                    {/* Blue Verified Tick for PlyShip Team */}
                                    {isBroadcast && (
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: 18,
                                            height: 18,
                                            borderRadius: '50%',
                                            background: '#1D9BF0',
                                            flexShrink: 0,
                                        }}>
                                            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                                                <path d="M2 6.5L4.5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
export function ChatView({ chat, onBack, onNavigate, showMeetingOnOpen, onMeetingModalShown }) {
    const {
        user, sendMessage, getChatId, getWallet, topUpWallet,
        getMeetings, acceptMeeting, declineMeeting, confirmMeeting, cancelMeeting, denyMeeting, verifyMeetingOTP, acceptAndScheduleMeeting,
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
    const [reviewData, setReviewData] = useState(null);
    const [showProfileDetail, setShowProfileDetail] = useState(false);
    const [showAcceptScheduleModal, setShowAcceptScheduleModal] = useState(false);
    const [otpInput, setOtpInput] = useState('');
    const messagesEndRef = useRef(null);

    // Voice recording state
    const [isRecording, setIsRecording] = useState(false);
    const [micConnecting, setMicConnecting] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [uploadingFiles, setUploadingFiles] = useState([]); // {id, name, type, localUrl, fileType}
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordingTimerRef = useRef(null);
    const cameraInputRef = useRef(null);
    const galleryInputRef = useRef(null);
    const docInputRef = useRef(null);

    const MAX_VOICE_DURATION = 300; // 5 minutes in seconds
    const ALLOWED_FILE_TYPES = {
        'image/jpeg': 'image', 'image/png': 'image', 'image/gif': 'image', 'image/webp': 'image',
        'application/pdf': 'pdf',
        'application/msword': 'document', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
    };
    const ALLOWED_EXTENSIONS = '.jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx';

    // Cleanup recording on unmount
    useEffect(() => {
        return () => {
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
        };
    }, []);

    // Voice recording handlers
    const getSupportedMimeType = () => {
        const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg', ''];
        for (const t of types) {
            if (t === '' || MediaRecorder.isTypeSupported(t)) return t;
        }
        return '';
    };

    const startRecording = async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            showToast('Voice recording is not supported on this device.', 'error');
            return;
        }

        // Show recording UI INSTANTLY — before mic is ready
        setMicConnecting(true);
        setIsRecording(true);
        setRecordingDuration(0);

        // Kill any leftover recorder
        try {
            if (mediaRecorderRef.current) {
                if (mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
                mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop());
                mediaRecorderRef.current = null;
            }
        } catch (e) {}

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = getSupportedMimeType();
            const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
            mediaRecorder.onstop = () => { stream.getTracks().forEach(t => t.stop()); };

            mediaRecorder.start(250);
            mediaRecorderRef.current = mediaRecorder;
            setMicConnecting(false);

            recordingTimerRef.current = setInterval(() => {
                setRecordingDuration(prev => {
                    if (prev >= MAX_VOICE_DURATION - 1) { stopRecordingAndSend(); return prev; }
                    return prev + 1;
                });
            }, 1000);
        } catch (err) {
            console.error('Mic error:', err.name, err.message);
            setIsRecording(false);
            setMicConnecting(false);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                showToast('Microphone permission denied. Please allow in your device settings.', 'error');
            } else {
                showToast('Could not access microphone. Please try again.', 'error');
            }
        }
    };

    const cancelRecording = () => {
        if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.onstop = () => { mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop()); };
            mediaRecorderRef.current.stop();
        }
        audioChunksRef.current = [];
        setIsRecording(false);
        setRecordingDuration(0);
    };

    const stopRecordingAndSend = async () => {
        if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
        const duration = recordingDuration;
        setIsRecording(false);
        setRecordingDuration(0);

        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

        return new Promise((resolve) => {
            mediaRecorderRef.current.onstop = async () => {
                mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop());
                const actualMime = mediaRecorderRef.current.mimeType || 'audio/webm';
                const blob = new Blob(audioChunksRef.current, { type: actualMime });
                audioChunksRef.current = [];
                if (blob.size < 1000) { resolve(); return; } // Too short

                const ext = actualMime.includes('mp4') ? 'mp4' : actualMime.includes('ogg') ? 'ogg' : 'webm';
                setUploadingFile(true);
                try {
                    const path = `chats/${chatId}/voice_${Date.now()}.${ext}`;
                    const url = await uploadFile(blob, path, actualMime);
                    await sendMessage(otherUserId, '', { url, type: 'voice', name: 'Voice note', duration });
                } catch (e) { showToast('Failed to send voice note', 'error'); }
                setUploadingFile(false);
                resolve();
            };
            mediaRecorderRef.current.stop();
        });
    };

    // File upload handler — supports multiple files
    const handleFileSelect = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        e.target.value = ''; // reset input

        setUploadingFile(true);
        setShowAttachMenu(false);

        for (const file of files) {
            // Check type
            const fileType = ALLOWED_FILE_TYPES[file.type];
            if (!fileType) {
                showToast(`"${file.name}" is not supported. Use images, PDFs, or Word docs.`, 'error');
                continue;
            }
            // Check size
            if (file.size > 25 * 1024 * 1024) {
                showToast(`"${file.name}" is too large. Max 25MB.`, 'error');
                continue;
            }

            // Create local preview and add to uploading list
            const uploadId = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            const localUrl = fileType === 'image' ? URL.createObjectURL(file) : null;
            const previewItem = { id: uploadId, name: file.name, fileType, localUrl };
            setUploadingFiles(prev => [...prev, previewItem]);

            try {
                const ext = file.name.split('.').pop() || 'jpg';
                const path = `chats/${chatId}/${fileType}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
                const url = await uploadFile(file, path, file.type);
                await sendMessage(otherUserId, '', { url, type: fileType, name: file.name });
            } catch (err) {
                showToast(`Failed to upload "${file.name}"`, 'error');
            }

            // Remove from uploading list and revoke blob URL
            setUploadingFiles(prev => prev.filter(f => f.id !== uploadId));
            if (localUrl) URL.revokeObjectURL(localUrl);
        }
        setUploadingFile(false);
    };

    const formatDuration = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

    // Auto-open meeting modal when coming from Meet button
    useEffect(() => {
        if (showMeetingOnOpen) {
            setShowMeetingModal(true);
            onMeetingModalShown?.();
        }
    }, [showMeetingOnOpen, onMeetingModalShown]);

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

    // Fetch meetings between these two users (with polling for real-time updates)
    useEffect(() => {
        const fetchMeetings = async () => {
            if (!user || !otherUserId) return;
            const allMeetings = await getMeetings();
            const relevantMeetings = allMeetings.filter(m => {
                return (m.companyId === otherUserId || m.seekerId === otherUserId) && !m.rescheduledTo;
            });
            setMeetings(relevantMeetings);
            setMeetingsLoaded(true);
        };
        fetchMeetings();
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

    // Fetch projects between these two users
    useEffect(() => {
        const fetchProjects = async () => {
            if (!user || !otherUserId) return;
            const allProjects = await getProjects();
            const relevantProjects = allProjects.filter(p =>
                (p.companyId === otherUserId || p.seekerId === otherUserId)
            );
            setProjects(relevantProjects);
        };
        fetchProjects();
        const interval = setInterval(fetchProjects, 3000);
        return () => clearInterval(interval);
    }, [user, otherUserId, getProjects]);

    // Fetch wallet balance for companies
    useEffect(() => {
        const fetchWallet = async () => {
            if (!user || !isCompanyUser) return;
            const wallet = await getWallet();
            setWalletBalance(wallet?.balance || 0);
        };
        fetchWallet();
        const interval = setInterval(fetchWallet, 10000);
        return () => clearInterval(interval);
    }, [user, isCompanyUser, getWallet]);

    const activeMeeting = meetings.find(m =>
        ['REQUESTED', 'PENDING_ACCEPTANCE', 'SCHEDULED', 'DISPUTE'].includes(m.status)
    );
    const hasConfirmedMeeting = meetings.some(m => m.status === 'CONFIRMED');
    const cancelledMeeting = meetings.find(m =>
        ['CANCELLED', 'DECLINED'].includes(m.status)
    );
    const hasMeetingRequest = meetings.length > 0; // Any meeting = phone visible
    const otherUserPhone = chat?.matchedUserPhone || profile?.phone || null;
    const activeProject = projects.find(p => p.status === 'PENDING_ACCEPTANCE');
    const hasAcceptedProject = projects.some(p => p.status === 'ACCEPTED');

    // Subscribe to real-time messages
    useEffect(() => {
        if (!chatId) return;
        const unsubscribe = subscribeToMessages(chatId, (newMessages) => {
            setMessages(newMessages);
        });
        return () => unsubscribe();
    }, [chatId]);

    // Auto-scroll to bottom when new messages arrive or files start uploading
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, uploadingFiles]);

    // Detect phone numbers and email addresses in text
    const containsContactInfo = (text) => {
        // Phone: 7+ consecutive digits (with optional spaces, dashes, dots, parens)
        const phonePattern = /(?:\+?\d[\d\s\-().]{6,}\d)/;
        // Email: standard email pattern
        const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
        return phonePattern.test(text) || emailPattern.test(text);
    };

    // Detect Google Maps / location URLs in text
    const containsLocationUrl = (text) => {
        const mapsPattern = /(?:maps\.google|google\.com\/maps|goo\.gl\/maps|maps\.app\.goo\.gl)/i;
        const coordPattern = /\d+\.\d+,\s*\d+\.\d+/; // lat,lng patterns
        return mapsPattern.test(text) || coordPattern.test(text);
    };

    const handleSend = async () => {
        if (!message.trim() || sending) return;

        const hasMeetingScheduled = activeMeeting?.status === 'SCHEDULED';

        // Block messages containing phone numbers or emails before meeting is scheduled
        if (!hasMeetingScheduled && containsContactInfo(message)) {
            showToast('\u26a0\ufe0f Sharing personal contact info (phone/email) is not allowed before a meeting is scheduled. Schedule a meeting first \ud83d\udcc5', 'error');
            return;
        }

        // Block raw location URLs before meeting is scheduled
        if (!hasMeetingScheduled && containsLocationUrl(message)) {
            showToast('\u26a0\ufe0f Location sharing is only available after a meeting is scheduled. Use the meeting location feature instead \ud83d\udcc5', 'info');
            return;
        }

        setSending(true);
        const result = await sendMessage(otherUserId, message);
        if (result.success) {
            setMessage('');
        }
        setSending(false);
    };

    // Share current location as a Google Maps link
    const handleShareLocation = () => {
        setShowAttachMenu(false);
        // Block location sharing before a meeting is scheduled
        if (!activeMeeting || activeMeeting.status !== 'SCHEDULED') {
            showToast('⚠️ Location sharing is only available after a meeting is scheduled. Schedule a meeting first 📅', 'info');
            return;
        }
        if (!navigator.geolocation) {
            showToast('Location is not supported on this device.', 'error');
            return;
        }
        showToast('Getting your location...', 'info');
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude, longitude } = pos.coords;
                const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
                await sendMessage(otherUserId, `📍 My Location: ${mapUrl}`);
            },
            () => showToast('Could not get your location. Please allow location access.', 'error'),
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    // Share a contact from device address book
    const handleShareContact = async () => {
        setShowAttachMenu(false);
        // Block contact sharing before a meeting is scheduled
        if (!activeMeeting || activeMeeting.status !== 'SCHEDULED') {
            showToast('⚠️ Contact sharing is only available after a meeting is scheduled. Schedule a meeting first 📅', 'info');
            return;
        }

        // Contact Picker API (supported on Android Chrome, some mobile browsers)
        if ('contacts' in navigator && 'ContactsManager' in window) {
            try {
                const contacts = await navigator.contacts.select(
                    ['name', 'tel'],
                    { multiple: false }
                );
                if (contacts && contacts.length > 0) {
                    const contact = contacts[0];
                    const name = contact.name?.[0] || 'Unknown';
                    const phone = contact.tel?.[0] || '';
                    const contactMsg = phone
                        ? `👤 ${name}\n📞 ${phone}`
                        : `👤 ${name}`;
                    await sendMessage(otherUserId, contactMsg);
                    showToast('Contact shared!', 'success');
                }
            } catch (err) {
                if (err.name !== 'TypeError') {
                    showToast('Could not access contacts.', 'error');
                }
            }
        } else {
            showToast('Contact sharing is not supported on this browser. Try from your phone.', 'info');
        }
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
                paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
                paddingBottom: '12px',
                paddingLeft: '16px',
                paddingRight: '16px',
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

                <div
                    onClick={() => !isBroadcast && setShowProfileDetail(true)}
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: isCompany ? 12 : '50%',
                        background: image ? `url(${image}) center/cover` : 'var(--pastel-green)',
                        border: '2px solid var(--pastel-mint)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        cursor: isBroadcast ? 'default' : 'pointer',
                    }}>
                    {!image && (isCompany ? <Briefcase size={18} color="var(--primary)" /> : <User size={18} color="var(--primary)" />)}
                </div>

                <div style={{ flex: 1, cursor: isBroadcast ? 'default' : 'pointer' }} onClick={() => !isBroadcast && setShowProfileDetail(true)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                            {name || 'Unknown'}
                        </h3>
                        {isBroadcast && (
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 18,
                                height: 18,
                                borderRadius: '50%',
                                background: '#1D9BF0',
                                flexShrink: 0,
                            }}>
                                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                                    <path d="M2 6.5L4.5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </span>
                        )}
                    </div>
                    <span style={{ fontSize: 12, color: isBroadcast ? 'var(--text-muted)' : 'var(--success)' }}>{isBroadcast ? 'Official Broadcast' : 'Online'}</span>
                </div>

                {/* Phone button - always visible, but only functional after a meeting request */}
                {!isBroadcast && (
                    <motion.button
                        onClick={() => {
                            if (hasMeetingRequest && otherUserPhone) {
                                window.open(`tel:${otherUserPhone}`, '_self');
                            } else {
                                showToast('Schedule a meeting first to get their contact number 📅', 'info');
                            }
                        }}
                        whileTap={{ scale: 0.9 }}
                        style={{
                            width: 36, height: 36, borderRadius: '50%',
                            background: hasMeetingRequest && otherUserPhone ? '#F0FDF4' : 'var(--bg-secondary)',
                            border: hasMeetingRequest && otherUserPhone ? '1.5px solid #BBF7D0' : '1.5px solid var(--border-light)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', flexShrink: 0,
                        }}
                        title={hasMeetingRequest && otherUserPhone ? otherUserPhone : 'Schedule a meeting to call'}
                    >
                        <Phone size={15} color={hasMeetingRequest && otherUserPhone ? '#22C55E' : 'var(--text-muted)'} />
                    </motion.button>
                )}

                {/* 📍 Meeting Location Button — OTP-bar-style, visible only when meeting is SCHEDULED */}
                {!isBroadcast && activeMeeting?.status === 'SCHEDULED' && activeMeeting?.location && (() => {
                    const parts = activeMeeting.location.split('||');
                    const displayAddress = parts[0] || activeMeeting.location;
                    const coords = parts[1]; // "lat,lng" or undefined
                    const mapsUrl = coords
                        ? `https://www.google.com/maps/search/?api=1&query=${coords}`
                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(displayAddress)}`;

                    return (
                        <motion.button
                            onClick={() => window.open(mapsUrl, '_blank')}
                            whileTap={{ scale: 0.9 }}
                            style={{
                                padding: '8px 12px',
                                borderRadius: 10,
                                background: '#F0FDF4',
                                border: '1.5px solid #BBF7D0',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                                cursor: 'pointer',
                                flexShrink: 0,
                            }}
                            title={displayAddress}
                        >
                            <MapPin size={14} color="#22C55E" />
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#16A34A', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                Location
                            </span>
                        </motion.button>
                    );
                })()}

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
                const meetingTime = activeMeeting.scheduledAt ? new Date(activeMeeting.scheduledAt) : null;
                const now = new Date();
                const isExpired = meetingTime ? meetingTime < now : false;
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

                // REQUESTED status — Company sent request, seeker needs to accept & set details
                if (activeMeeting.status === 'REQUESTED') {
                    const isReceiver = activeMeeting.requestedBy !== user?.id;
                    return (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            style={{ padding: 12, background: '#F5F3FF', borderBottom: '1.5px solid #8B5CF6' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Calendar size={18} color="#7C3AED" style={{ flexShrink: 0 }} />
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: 13, fontWeight: 600, color: '#5B21B6' }}>
                                        {isReceiver ? 'Meeting request received' : 'Meeting request sent'}
                                    </p>
                                    <p style={{ fontSize: 11, color: '#7C3AED' }}>
                                        {isReceiver ? 'Set the date, time & location to accept' : 'Waiting for seeker to respond'}
                                    </p>
                                </div>
                                {isReceiver ? (
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <motion.button
                                            onClick={() => setShowAcceptScheduleModal(true)}
                                            whileTap={{ scale: 0.95 }}
                                            style={{
                                                padding: '6px 12px', borderRadius: 8, background: '#7C3AED',
                                                border: 'none', color: 'white', fontSize: 12, fontWeight: 600,
                                                display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                                            }}
                                        >
                                            <Calendar size={14} />
                                            Accept
                                        </motion.button>
                                        <motion.button
                                            onClick={async () => {
                                                setActionLoading('decline');
                                                await declineMeeting(activeMeeting.id);
                                                const updated = await getMeetings();
                                                setMeetings(updated.filter(m =>
                                                    (m.companyId === otherUserId || m.seekerId === otherUserId) && !m.rescheduledTo
                                                ));
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
                                ) : (
                                    <motion.button
                                        onClick={async () => {
                                            setActionLoading('cancel');
                                            await cancelMeeting(activeMeeting.id);
                                            const updated = await getMeetings();
                                            setMeetings(updated.filter(m =>
                                                (m.companyId === otherUserId || m.seekerId === otherUserId) && !m.rescheduledTo
                                            ));
                                            setActionLoading(null);
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
                                )}
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
                        // Inline pay-and-accept handler (like Uber pay-per-ride)
                        const handlePayAndAccept = async () => {
                            setActionLoading('payAccept');
                            try {
                                // 1. Create Razorpay order for meeting fee
                                const orderRes = await fetch('/api/razorpay/create-order', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ amount: MEETING_FEE, userId: user.id }),
                                });
                                const orderData = await orderRes.json();
                                if (!orderData.success) throw new Error(orderData.error || 'Failed to create order');

                                // 2. Open Razorpay checkout (UPI-first, in-app)
                                const options = buildRazorpayOptions({
                                    key: orderData.keyId,
                                    amount: orderData.amount,
                                    currency: orderData.currency,
                                    orderId: orderData.orderId,
                                    description: `Meeting Fee — ${name || 'Consultation'}`,
                                    prefill: {
                                        name: user?.profile?.companyName || user?.profile?.name || '',
                                        email: user?.email || '',
                                    },
                                    handler: async function (response) {
                                        try {
                                            // 3. Verify payment
                                            const verifyRes = await fetch('/api/razorpay/verify-payment', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    razorpay_order_id: response.razorpay_order_id,
                                                    razorpay_payment_id: response.razorpay_payment_id,
                                                    razorpay_signature: response.razorpay_signature,
                                                    userId: user.id,
                                                    amount: MEETING_FEE,
                                                }),
                                            });
                                            const verifyData = await verifyRes.json();
                                            if (!verifyData.success) {
                                                showToast('Payment verification failed', 'error');
                                                setActionLoading(null);
                                                return;
                                            }

                                            // 4. Credit wallet
                                            const topUpResult = await topUpWallet(MEETING_FEE, response.razorpay_payment_id, response.razorpay_order_id);
                                            if (!topUpResult.success) {
                                                showToast('Payment succeeded but wallet update failed. Contact support.', 'error');
                                                setActionLoading(null);
                                                return;
                                            }

                                            // 5. Update local wallet balance
                                            setWalletBalance(topUpResult.newBalance);

                                            // 6. Auto-accept the meeting
                                            const acceptResult = await acceptMeeting(activeMeeting.id);
                                            if (acceptResult.success) {
                                                showToast('Payment successful! Meeting accepted.', 'success');
                                                await refreshMeetings();
                                            } else {
                                                showToast(acceptResult.error || 'Meeting could not be accepted. Try again from the banner.', 'error');
                                            }
                                        } catch (err) {
                                            showToast(err.message || 'Something went wrong', 'error');
                                        }
                                        setActionLoading(null);
                                    },
                                    onDismiss: function () {
                                        setActionLoading(null);
                                    },
                                });

                                openRazorpayCheckout(options);
                            } catch (err) {
                                showToast(err.message || 'Payment failed', 'error');
                                setActionLoading(null);
                            }
                        };

                        return (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                style={{ padding: 12, background: '#FEF3C7', borderBottom: '1px solid var(--border-light)' }}
                            >
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                    <Calendar size={18} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontSize: 13, fontWeight: 600, color: '#92400E' }}>
                                            Meeting request received
                                        </p>
                                        <p style={{ fontSize: 11, color: '#D97706', marginBottom: 8 }}>
                                            {meetingTime.toLocaleDateString('en-IN', {
                                                weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </p>

                                        {/* Pay & Accept — primary action */}
                                        <motion.button
                                            onClick={handlePayAndAccept}
                                            disabled={actionLoading}
                                            whileTap={{ scale: 0.95 }}
                                            style={{
                                                width: '100%',
                                                padding: '10px 14px',
                                                borderRadius: 10,
                                                background: actionLoading === 'payAccept' ? '#A7F3D0' : 'var(--gradient-primary)',
                                                border: 'none',
                                                color: 'white',
                                                fontSize: 13,
                                                fontWeight: 600,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 6,
                                                cursor: actionLoading ? 'wait' : 'pointer',
                                                boxShadow: 'var(--shadow-sm)',
                                                marginBottom: 6,
                                            }}
                                        >
                                            <CreditCard size={16} />
                                            {actionLoading === 'payAccept' ? 'Processing...' : `Pay ₹${MEETING_FEE} & Accept`}
                                        </motion.button>

                                        {/* Secondary row: Top Up Wallet + Decline */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <motion.button
                                                onClick={() => onNavigate?.('wallet')}
                                                whileTap={{ scale: 0.95 }}
                                                style={{
                                                    flex: 1,
                                                    padding: '8px 10px',
                                                    borderRadius: 8,
                                                    background: 'white',
                                                    border: '1px solid var(--border)',
                                                    color: 'var(--text-secondary)',
                                                    fontSize: 12,
                                                    fontWeight: 600,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: 4,
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                <Wallet size={14} />
                                                Top Up Wallet
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
                                                    padding: '8px 10px',
                                                    borderRadius: 8,
                                                    background: '#FEE2E2',
                                                    border: 'none',
                                                    color: '#EF4444',
                                                    fontSize: 12,
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                <X size={14} />
                                            </motion.button>
                                        </div>

                                        <p style={{ fontSize: 10, color: '#B45309', marginTop: 6, textAlign: 'center' }}>
                                            Pay for this meeting only, or top up wallet for multiple
                                        </p>
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

                // SCHEDULED = OTP Confirmation (available anytime)
                if (activeMeeting.status === 'SCHEDULED') {
                    // SEEKER sees the OTP code (to share with company)
                    if (!isCompanyUser) {
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
                                    <div style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                        padding: '4px 10px', borderRadius: 6,
                                        background: '#FEF2F2', border: '1px solid #FECACA',
                                        marginBottom: 10,
                                    }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: '#DC2626' }}>
                                            ⚠️ Share ONLY after the meeting is done
                                        </span>
                                    </div>
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
                                    {/* 📍 Meeting Location Button */}
                                    {activeMeeting.location && (() => {
                                        const parts = activeMeeting.location.split('||');
                                        const displayAddr = parts[0] || activeMeeting.location;
                                        const coords = parts[1];
                                        const mapUrl = coords
                                            ? `https://www.google.com/maps/search/?api=1&query=${coords}`
                                            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(displayAddr)}`;
                                        return (
                                            <motion.button
                                                onClick={() => window.open(mapUrl, '_blank')}
                                                whileTap={{ scale: 0.95 }}
                                                style={{
                                                    marginTop: 8,
                                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                                    padding: '6px 14px', borderRadius: 8,
                                                    background: 'white', border: '1.5px solid #BBF7D0',
                                                    cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#16A34A',
                                                }}
                                            >
                                                <MapPin size={14} color="#22C55E" />
                                                📍 Open Meeting Location
                                            </motion.button>
                                        );
                                    })()}
                                </div>
                            </motion.div>
                        );
                    }

                    // COMPANY sees OTP input
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
                                    Ask the seeker for the 6-digit verification code
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
                                            showToast('Incorrect code. Please check with the seeker.', 'error');
                                        } else if (result.insufficientBalance) {
                                            showToast('Insufficient service deposit balance.', 'warning');
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
                                {/* 📍 Meeting Location Button */}
                                {activeMeeting.location && (() => {
                                    const parts = activeMeeting.location.split('||');
                                    const displayAddr = parts[0] || activeMeeting.location;
                                    const coords = parts[1];
                                    const mapUrl = coords
                                        ? `https://www.google.com/maps/search/?api=1&query=${coords}`
                                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(displayAddr)}`;
                                    return (
                                        <motion.button
                                            onClick={() => window.open(mapUrl, '_blank')}
                                            whileTap={{ scale: 0.95 }}
                                            style={{
                                                marginTop: 8,
                                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                                padding: '6px 14px', borderRadius: 8,
                                                background: 'white', border: '1.5px solid #FDE68A',
                                                cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#92400E',
                                            }}
                                        >
                                            <MapPin size={14} color="#F59E0B" />
                                            📍 Open Meeting Location
                                        </motion.button>
                                    );
                                })()}
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
                                    maxWidth: '80%',
                                }}
                            >
                                <div style={{
                                    padding: msg.fileType === 'image' ? '4px' : '12px 16px',
                                    borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                    background: isMe ? 'var(--gradient-primary)' : 'white',
                                    color: isMe ? 'white' : 'var(--text-primary)',
                                    boxShadow: 'var(--shadow-sm)',
                                    overflow: 'hidden',
                                }}>
                                    {/* Voice note */}
                                    {msg.fileType === 'voice' && msg.fileUrl && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 200 }}>
                                            <Mic size={16} style={{ flexShrink: 0 }} />
                                            <audio controls preload="none" style={{
                                                height: 32, flex: 1, maxWidth: '100%',
                                                filter: isMe ? 'brightness(10)' : 'none',
                                            }}>
                                                <source src={msg.fileUrl} />
                                            </audio>
                                            {msg.fileDuration && (
                                                <span style={{ fontSize: 11, opacity: 0.7, flexShrink: 0 }}>
                                                    {formatDuration(msg.fileDuration)}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {/* Image */}
                                    {msg.fileType === 'image' && msg.fileUrl && (
                                        <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer">
                                            <img src={msg.fileUrl} alt="Shared image"
                                                style={{
                                                    maxWidth: '100%', maxHeight: 280,
                                                    borderRadius: 14, display: 'block',
                                                    objectFit: 'cover',
                                                }}
                                            />
                                        </a>
                                    )}
                                    {/* PDF / Document */}
                                    {(msg.fileType === 'pdf' || msg.fileType === 'document') && msg.fileUrl && (
                                        <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer"
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 10,
                                                textDecoration: 'none', color: 'inherit',
                                            }}
                                        >
                                            <div style={{
                                                width: 40, height: 40, borderRadius: 10,
                                                background: isMe ? 'rgba(255,255,255,0.2)' : '#F0FDF4',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                flexShrink: 0,
                                            }}>
                                                <FileText size={20} color={isMe ? 'white' : '#22C55E'} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{
                                                    fontSize: 13, fontWeight: 600,
                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                }}>
                                                    {msg.fileName || (msg.fileType === 'pdf' ? 'PDF Document' : 'Document')}
                                                </p>
                                                <p style={{ fontSize: 11, opacity: 0.7 }}>
                                                    {msg.fileType === 'pdf' ? 'PDF' : 'DOC'} • Tap to open
                                                </p>
                                            </div>
                                        </a>
                                    )}
                                    {/* Text message */}
                                    {msg.text && <p style={{ fontSize: 14, lineHeight: 1.4, marginTop: msg.fileUrl ? 8 : 0 }}>{msg.text}</p>}
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

                {/* Uploading files — inline previews with spinner (WhatsApp style) */}
                {uploadingFiles.map(uf => (
                    <motion.div
                        key={uf.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{
                            alignSelf: 'flex-end',
                            maxWidth: '80%',
                        }}
                    >
                        <div style={{
                            padding: uf.fileType === 'image' ? '4px' : '12px 16px',
                            borderRadius: '18px 18px 4px 18px',
                            background: 'var(--gradient-primary)',
                            color: 'white',
                            boxShadow: 'var(--shadow-sm)',
                            overflow: 'hidden',
                            position: 'relative',
                        }}>
                            {/* Circular spinner overlay */}
                            <div style={{
                                position: 'absolute', inset: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: uf.fileType === 'image' ? 'rgba(0,0,0,0.35)' : 'transparent',
                                zIndex: 2, borderRadius: 'inherit',
                            }}>
                                <div style={{
                                    width: 44, height: 44, borderRadius: '50%',
                                    background: 'rgba(0,0,0,0.45)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    backdropFilter: 'blur(4px)',
                                }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                                        <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" fill="none" />
                                        <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                                    </svg>
                                </div>
                            </div>

                            {/* Image preview */}
                            {uf.fileType === 'image' && uf.localUrl && (
                                <img src={uf.localUrl} alt="Uploading"
                                    style={{
                                        maxWidth: '100%', maxHeight: 280,
                                        borderRadius: 14, display: 'block',
                                        objectFit: 'cover', opacity: 0.7,
                                    }}
                                />
                            )}

                            {/* Document preview */}
                            {(uf.fileType === 'pdf' || uf.fileType === 'document') && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative', zIndex: 1 }}>
                                    <div style={{
                                        width: 40, height: 40, borderRadius: 10,
                                        background: 'rgba(255,255,255,0.2)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        <FileText size={20} color="white" />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{
                                            fontSize: 13, fontWeight: 600,
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        }}>
                                            {uf.name}
                                        </p>
                                        <p style={{ fontSize: 11, opacity: 0.7 }}>Uploading...</p>
                                    </div>
                                </div>
                            )}
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, display: 'block', textAlign: 'right' }}>Sending...</span>
                    </motion.div>
                ))}

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
                    padding: '10px 12px 24px',
                    background: 'white',
                    borderTop: '1px solid var(--border-light)',
                }}>
                    {/* Upload progress bar */}


                    {/* Recording UI */}
                    {isRecording ? (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 4px',
                        }}>
                            {/* Cancel button */}
                            <motion.button
                                onClick={cancelRecording}
                                whileTap={{ scale: 0.9 }}
                                style={{
                                    width: 40, height: 40, borderRadius: '50%',
                                    background: '#FEE2E2', border: 'none',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer',
                                }}
                            >
                                <X size={18} color="#EF4444" />
                            </motion.button>

                            {/* Recording indicator */}
                            <div style={{
                                flex: 1, display: 'flex', alignItems: 'center', gap: 10,
                                padding: '10px 16px', borderRadius: 24,
                                background: micConnecting ? '#FFF7ED' : '#FEF2F2',
                                border: micConnecting ? '1px solid #FED7AA' : '1px solid #FECACA',
                            }}>
                                {micConnecting ? (
                                    <>
                                        <Loader2 size={14} color="#F97316" style={{ animation: 'spin 1s linear infinite' }} />
                                        <span style={{ fontSize: 13, fontWeight: 500, color: '#EA580C' }}>Connecting mic...</span>
                                    </>
                                ) : (
                                    <>
                                        <div style={{
                                            width: 10, height: 10, borderRadius: '50%',
                                            background: '#EF4444',
                                            animation: 'pulse 1s ease-in-out infinite',
                                        }} />
                                        <span style={{ fontSize: 14, fontWeight: 600, color: '#DC2626', fontFamily: 'monospace' }}>
                                            {formatDuration(recordingDuration)}
                                        </span>
                                        <span style={{ fontSize: 12, color: '#F87171' }}>
                                            / {formatDuration(MAX_VOICE_DURATION)}
                                        </span>
                                    </>
                                )}
                            </div>

                            {/* Send button */}
                            <motion.button
                                onClick={stopRecordingAndSend}
                                whileTap={{ scale: 0.9 }}
                                disabled={micConnecting}
                                style={{
                                    width: 48, height: 48, borderRadius: '50%',
                                    background: 'var(--gradient-primary)',
                                    border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: micConnecting ? 'not-allowed' : 'pointer',
                                    boxShadow: 'var(--shadow-glow-soft)',
                                    opacity: micConnecting ? 0.5 : 1,
                                }}
                            >
                                <Send size={20} color="white" />
                            </motion.button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {/* + Attachment button */}
                            <div style={{ position: 'relative' }}>
                                <motion.button
                                    onClick={() => setShowAttachMenu(!showAttachMenu)}
                                    whileTap={{ scale: 0.9 }}
                                    style={{
                                        width: 38, height: 38, borderRadius: '50%',
                                        background: 'transparent',
                                        border: 'none',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer', flexShrink: 0,
                                        transform: showAttachMenu ? 'rotate(45deg)' : 'rotate(0deg)',
                                        transition: 'transform 0.2s ease',
                                    }}
                                >
                                    <Plus size={24} color="var(--text-secondary)" strokeWidth={1.8} />
                                </motion.button>

                                {/* Attachment grid popup */}
                                {showAttachMenu && (
                                    <>
                                        <div onClick={() => setShowAttachMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
                                        <motion.div
                                            initial={{ opacity: 0, y: 12, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            transition={{ duration: 0.15, ease: 'easeOut' }}
                                            style={{
                                                position: 'absolute', bottom: '120%', left: -8,
                                                background: '#F5F5F5', borderRadius: 18,
                                                boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
                                                border: '1px solid rgba(0,0,0,0.06)',
                                                padding: '16px 12px 12px', zIndex: 50,
                                                width: 280,
                                            }}
                                        >
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(3, 1fr)',
                                                gap: 8,
                                            }}>
                                                {/* Photos */}
                                                <button
                                                    onClick={() => { galleryInputRef.current?.click(); setShowAttachMenu(false); }}
                                                    style={{
                                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                                                        padding: '12px 4px', borderRadius: 14, border: 'none',
                                                        background: 'transparent', cursor: 'pointer',
                                                    }}
                                                >
                                                    <div style={{ width: 52, height: 52, borderRadius: 14, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                                                        <ImageIcon size={24} color="#3B82F6" strokeWidth={1.8} />
                                                    </div>
                                                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>Photos</span>
                                                </button>

                                                {/* Camera */}
                                                <button
                                                    onClick={() => { cameraInputRef.current?.click(); setShowAttachMenu(false); }}
                                                    style={{
                                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                                                        padding: '12px 4px', borderRadius: 14, border: 'none',
                                                        background: 'transparent', cursor: 'pointer',
                                                    }}
                                                >
                                                    <div style={{ width: 52, height: 52, borderRadius: 14, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                                                        <Camera size={24} color="#6B7280" strokeWidth={1.8} />
                                                    </div>
                                                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>Camera</span>
                                                </button>

                                                {/* Location */}
                                                <button
                                                    onClick={handleShareLocation}
                                                    style={{
                                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                                                        padding: '12px 4px', borderRadius: 14, border: 'none',
                                                        background: 'transparent', cursor: 'pointer',
                                                    }}
                                                >
                                                    <div style={{ width: 52, height: 52, borderRadius: 14, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                                                        <MapPin size={24} color="#22C55E" strokeWidth={1.8} />
                                                    </div>
                                                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>Location</span>
                                                </button>

                                                {/* Contact */}
                                                <button
                                                    onClick={handleShareContact}
                                                    style={{
                                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                                                        padding: '12px 4px', borderRadius: 14, border: 'none',
                                                        background: 'transparent', cursor: 'pointer',
                                                    }}
                                                >
                                                    <div style={{ width: 52, height: 52, borderRadius: 14, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                                                        <UserCircle size={24} color="#6B7280" strokeWidth={1.8} />
                                                    </div>
                                                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>Contact</span>
                                                </button>

                                                {/* Document */}
                                                <button
                                                    onClick={() => { docInputRef.current?.click(); setShowAttachMenu(false); }}
                                                    style={{
                                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                                                        padding: '12px 4px', borderRadius: 14, border: 'none',
                                                        background: 'transparent', cursor: 'pointer',
                                                    }}
                                                >
                                                    <div style={{ width: 52, height: 52, borderRadius: 14, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                                                        <FileText size={24} color="#3B82F6" strokeWidth={1.8} />
                                                    </div>
                                                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>Document</span>
                                                </button>

                                                {/* Meeting */}
                                                <button
                                                    onClick={() => { setShowAttachMenu(false); setShowMeetingModal(true); }}
                                                    style={{
                                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                                                        padding: '12px 4px', borderRadius: 14, border: 'none',
                                                        background: 'transparent', cursor: 'pointer',
                                                    }}
                                                >
                                                    <div style={{ width: 52, height: 52, borderRadius: 14, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                                                        <Calendar size={24} color="#EF4444" strokeWidth={1.8} />
                                                    </div>
                                                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>Meeting</span>
                                                </button>
                                            </div>
                                        </motion.div>
                                    </>
                                )}
                            </div>

                            {/* Text input — pill shape */}
                            <div style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                borderRadius: 24,
                                border: '1px solid var(--border)',
                                background: 'var(--bg-secondary)',
                                paddingRight: 4,
                                minWidth: 0,
                            }}>
                                <input
                                    type="text"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                    placeholder="Type a message..."
                                    disabled={sending || uploadingFile}
                                    style={{
                                        flex: 1,
                                        padding: '11px 16px',
                                        border: 'none',
                                        background: 'transparent',
                                        fontSize: 15,
                                        outline: 'none',
                                        opacity: (sending || uploadingFile) ? 0.7 : 1,
                                        minWidth: 0,
                                    }}
                                />
                            </div>

                            {/* Right-side action buttons */}
                            {message.trim() ? (
                                /* Send button when typing */
                                <motion.button
                                    onClick={handleSend}
                                    whileTap={{ scale: 0.9 }}
                                    disabled={sending}
                                    style={{
                                        width: 42, height: 42, borderRadius: '50%',
                                        background: 'var(--gradient-primary)',
                                        border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: sending ? 'not-allowed' : 'pointer',
                                        boxShadow: 'var(--shadow-glow-soft)',
                                        opacity: sending ? 0.7 : 1, flexShrink: 0,
                                    }}
                                >
                                    <Send size={18} color="white" />
                                </motion.button>
                            ) : (
                                /* Camera + Mic buttons when not typing */
                                <>
                                    <motion.button
                                        onClick={() => cameraInputRef.current?.click()}
                                        whileTap={{ scale: 0.9 }}
                                        style={{
                                            width: 38, height: 38, borderRadius: '50%',
                                            background: 'transparent',
                                            border: 'none',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: 'pointer', flexShrink: 0,
                                        }}
                                    >
                                        <Camera size={22} color="var(--text-secondary)" strokeWidth={1.6} />
                                    </motion.button>
                                    <motion.button
                                        onClick={startRecording}
                                        whileTap={{ scale: 0.9 }}
                                        disabled={uploadingFile}
                                        style={{
                                            width: 38, height: 38, borderRadius: '50%',
                                            background: 'transparent',
                                            border: 'none',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: uploadingFile ? 'not-allowed' : 'pointer',
                                            flexShrink: 0,
                                        }}
                                    >
                                        <Mic size={22} color="var(--text-secondary)" strokeWidth={1.6} />
                                    </motion.button>
                                </>
                            )}
                        </div>
                    )}

                    {/* Hidden file inputs — separate for camera, gallery, documents */}
                    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileSelect} style={{ display: 'none' }} />
                    <input ref={galleryInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} style={{ display: 'none' }} />
                    <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleFileSelect} style={{ display: 'none' }} />
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
                            // Silently cancel the old meeting (no cancelled notification in chat)
                            if (activeMeeting) {
                                await cancelMeeting(activeMeeting.id, '', { silent: true });
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

            {/* Profile Detail Modal — opens when tapping avatar/name in header */}
            <AnimatePresence>
                {showProfileDetail && !isBroadcast && (
                    <ProfileDetail
                        profile={{
                            id: otherUserId,
                            role: chat?.matchedUserRole || (isCompany ? 'COMPANY' : 'SEEKER'),
                            profile: profile,
                        }}
                        onClose={() => setShowProfileDetail(false)}
                        onMeet={() => { setShowProfileDetail(false); setShowMeetingModal(true); }}
                        viewerRole={user?.role}
                    />
                )}
            </AnimatePresence>

            {/* Accept & Schedule Modal — for seeker to accept + set date/time/location */}
            <AnimatePresence>
                {showAcceptScheduleModal && activeMeeting && activeMeeting.status === 'REQUESTED' && (
                    <AcceptAndScheduleModal
                        meeting={activeMeeting}
                        onClose={() => setShowAcceptScheduleModal(false)}
                        onScheduled={async () => {
                            setShowAcceptScheduleModal(false);
                            const updated = await getMeetings();
                            setMeetings(updated.filter(m =>
                                (m.companyId === otherUserId || m.seekerId === otherUserId) && !m.rescheduledTo
                            ));
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
