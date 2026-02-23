'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
    Calendar, ArrowLeft, Clock, CheckCircle, XCircle, AlertCircle,
    User, Building2, MapPin, ChevronRight, Plus, X, IndianRupee,
    RefreshCw, Check, Ban
} from 'lucide-react';

// Meetings View - Shows all meetings for current user
export default function MeetingsView({ onBack }) {
    const { user, getMeetings, confirmMeeting, acceptMeeting, declineMeeting, cancelMeeting, denyMeeting } = useAuth();
    const { showToast, showConfirm } = useToast();
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionId, setActionId] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [rescheduleModal, setRescheduleModal] = useState(null);

    const isCompany = user?.role === 'COMPANY';

    useEffect(() => {
        let isMounted = true;

        const fetchMeetings = async () => {
            setLoading(true);
            const data = await getMeetings();
            if (isMounted) {
                // Filter out rescheduled meetings that have a new version
                const activeMeetings = data.filter(m => !m.rescheduledTo);
                setMeetings(activeMeetings);
                setLoading(false);
            }
        };

        fetchMeetings();

        return () => {
            isMounted = false;
        };
    }, [getMeetings, refreshKey]);

    const refreshMeetings = () => {
        setRefreshKey(prev => prev + 1);
    };

    // Accept a pending meeting request
    const handleAccept = async (meetingId) => {
        setActionId(meetingId);
        const result = await acceptMeeting(meetingId);
        if (result.success) {
            showToast('Meeting accepted! It is now scheduled.', 'success');
            refreshMeetings();
        } else {
            showToast(result.error, 'error');
        }
        setActionId(null);
    };

    // Decline a pending meeting request
    const handleDecline = async (meetingId) => {
        setActionId(meetingId);
        const result = await declineMeeting(meetingId);
        if (result.success) {
            showToast('Meeting declined.', 'info');
            refreshMeetings();
        } else {
            showToast(result.error, 'error');
        }
        setActionId(null);
    };

    // Cancel a scheduled meeting
    const handleCancel = async (meetingId) => {
        const yes = await showConfirm('Are you sure you want to cancel this meeting?', 'Cancel Meeting');
        if (!yes) return;
        setActionId(meetingId);
        const result = await cancelMeeting(meetingId);
        if (result.success) {
            showToast('Meeting cancelled. You can reschedule if needed.', 'info');
            refreshMeetings();
        } else {
            showToast(result.error, 'error');
        }
        setActionId(null);
    };

    // Confirm meeting happened (after meeting time)
    const handleConfirm = async (meetingId) => {
        setActionId(meetingId);
        const result = await confirmMeeting(meetingId);

        if (result.success) {
            if (result.dispute) {
                showToast('Dispute raised — the other party said they did not meet. Admin will review.', 'warning');
            } else if (result.bothConfirmed) {
                showToast('Meeting confirmed! ₹250 has been credited to your wallet.', 'success');
            } else {
                showToast('You confirmed the meeting. Waiting for the other party to respond.', 'success');
            }
            refreshMeetings();
        } else {
            if (result.notYetTime) {
                showToast('Meeting time hasn\'t passed yet. You can confirm after the scheduled time.', 'warning');
            } else if (result.insufficientBalance) {
                showToast('Company has insufficient wallet balance to confirm meeting.', 'warning');
            } else {
                showToast(result.error, 'error');
            }
        }
        setActionId(null);
    };

    // Deny meeting (Not Met button)
    const handleDeny = async (meetingId) => {
        const yes = await showConfirm('Are you sure the meeting did not happen?', 'Confirm');
        if (!yes) return;
        setActionId(meetingId);
        const result = await denyMeeting(meetingId);
        if (result.success) {
            if (result.dispute) {
                showToast('Dispute raised — the other party said they met. Admin will review.', 'warning');
            } else if (result.bothDenied) {
                showToast('Meeting cancelled — both parties confirmed it did not happen.', 'info');
            } else {
                showToast('Recorded. Waiting for other party to respond.', 'success');
            }
            refreshMeetings();
        } else {
            showToast(result.error, 'error');
        }
        setActionId(null);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'PENDING_ACCEPTANCE': return '#3B82F6';
            case 'SCHEDULED': return '#F59E0B';
            case 'CONFIRMED': return '#22C55E';
            case 'CANCELLED': return '#EF4444';
            case 'DECLINED': return '#EF4444';
            default: return '#6B7280';
        }
    };

    const getStatusText = (meeting) => {
        const iAmRequester = meeting.requestedBy === user?.id;

        switch (meeting.status) {
            case 'PENDING_ACCEPTANCE':
                return iAmRequester ? 'Waiting for response' : 'Accept?';
            case 'SCHEDULED':
                // Check if meeting time passed
                const isPast = new Date(meeting.scheduledAt) < new Date();
                if (isPast) {
                    const myConfirmed = isCompany ? meeting.companyConfirmed : meeting.seekerConfirmed;
                    if (myConfirmed) return 'Awaiting other';
                    return 'Confirm meeting?';
                }
                return 'Scheduled';
            case 'CONFIRMED':
                return 'Completed ✓';
            case 'CANCELLED':
                return 'Cancelled';
            case 'DECLINED':
                return 'Declined';
            default:
                return 'Unknown';
        }
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-IN', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const isPastMeeting = (scheduledAt) => {
        return new Date(scheduledAt) < new Date();
    };

    if (loading) {
        return (
            <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-secondary)',
            }}>
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                    <Calendar size={32} color="var(--primary)" />
                </motion.div>
            </div>
        );
    }

    // Group meetings by status
    const pendingMeetings = meetings.filter(m => m.status === 'PENDING_ACCEPTANCE');
    const scheduledMeetings = meetings.filter(m => m.status === 'SCHEDULED');
    const pastMeetings = meetings.filter(m => ['CONFIRMED', 'CANCELLED', 'DECLINED'].includes(m.status));

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '16px 20px',
                background: 'white',
                borderBottom: '1px solid var(--border-light)',
            }}>
                <motion.button
                    onClick={onBack}
                    whileTap={{ scale: 0.9 }}
                    style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: 'var(--bg-secondary)', border: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                    }}
                >
                    <ArrowLeft size={20} color="var(--text-secondary)" />
                </motion.button>
                <h2 style={{ flex: 1, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Meetings
                </h2>
                <motion.button
                    onClick={refreshMeetings}
                    whileTap={{ scale: 0.9 }}
                    style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: 'var(--bg-secondary)', border: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                    }}
                >
                    <RefreshCw size={18} color="var(--text-secondary)" />
                </motion.button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                {/* Info Card */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 14,
                    borderRadius: 12,
                    background: 'var(--pastel-green)',
                    border: '1px solid var(--pastel-mint)',
                    marginBottom: 20,
                }}>
                    <IndianRupee size={20} color="var(--primary)" />
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {isCompany
                            ? '₹500 is charged when both confirm the meeting happened'
                            : '₹250 is credited when both confirm the meeting happened'
                        }
                    </span>
                </div>

                {meetings.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40 }}>
                        <Calendar size={48} color="var(--text-muted)" style={{ marginBottom: 12 }} />
                        <p style={{ color: 'var(--text-muted)', marginBottom: 8 }}>No meetings yet</p>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                            Schedule meetings from the chat screen
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* Pending Requests Section */}
                        {pendingMeetings.length > 0 && (
                            <div>
                                <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>
                                    PENDING REQUESTS
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {pendingMeetings.map((meeting) => (
                                        <MeetingCard
                                            key={meeting.id}
                                            meeting={meeting}
                                            user={user}
                                            isCompany={isCompany}
                                            actionId={actionId}
                                            onAccept={handleAccept}
                                            onDecline={handleDecline}
                                            onCancel={handleCancel}
                                            onConfirm={handleConfirm}
                                            onDeny={handleDeny}
                                            onReschedule={(m) => setRescheduleModal(m)}
                                            getStatusColor={getStatusColor}
                                            getStatusText={getStatusText}
                                            formatDate={formatDate}
                                            isPast={isPastMeeting}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Scheduled Section */}
                        {scheduledMeetings.length > 0 && (
                            <div>
                                <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>
                                    UPCOMING & ACTIVE
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {scheduledMeetings.map((meeting) => (
                                        <MeetingCard
                                            key={meeting.id}
                                            meeting={meeting}
                                            user={user}
                                            isCompany={isCompany}
                                            actionId={actionId}
                                            onAccept={handleAccept}
                                            onDecline={handleDecline}
                                            onCancel={handleCancel}
                                            onConfirm={handleConfirm}
                                            onDeny={handleDeny}
                                            onReschedule={(m) => setRescheduleModal(m)}
                                            getStatusColor={getStatusColor}
                                            getStatusText={getStatusText}
                                            formatDate={formatDate}
                                            isPast={isPastMeeting}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Past Section */}
                        {pastMeetings.length > 0 && (
                            <div>
                                <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>
                                    HISTORY
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {pastMeetings.map((meeting) => (
                                        <MeetingCard
                                            key={meeting.id}
                                            meeting={meeting}
                                            user={user}
                                            isCompany={isCompany}
                                            actionId={actionId}
                                            onAccept={handleAccept}
                                            onDecline={handleDecline}
                                            onCancel={handleCancel}
                                            onConfirm={handleConfirm}
                                            onDeny={handleDeny}
                                            onReschedule={(m) => setRescheduleModal(m)}
                                            getStatusColor={getStatusColor}
                                            getStatusText={getStatusText}
                                            formatDate={formatDate}
                                            isPast={isPastMeeting}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Reschedule Modal */}
            <AnimatePresence>
                {rescheduleModal && (
                    <RescheduleMeetingModal
                        meeting={rescheduleModal}
                        onClose={() => setRescheduleModal(null)}
                        onScheduled={() => {
                            setRescheduleModal(null);
                            refreshMeetings();
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// Meeting Card Component
function MeetingCard({
    meeting, user, isCompany, actionId, onAccept, onDecline, onCancel, onConfirm, onDeny, onReschedule,
    getStatusColor, getStatusText, formatDate, isPast
}) {
    const iAmRequester = meeting.requestedBy === user?.id;
    const isPastMeeting = isPast(meeting.scheduledAt);
    const myConfirmed = isCompany ? meeting.companyConfirmed : meeting.seekerConfirmed;
    const myDenied = isCompany ? meeting.companyDenied : meeting.seekerDenied;
    const hasResponded = myConfirmed || myDenied;
    const isLoading = actionId === meeting.id;

    // Determine what actions are available
    const canAccept = meeting.status === 'PENDING_ACCEPTANCE' && !iAmRequester;
    const canCancel = meeting.status === 'PENDING_ACCEPTANCE' && iAmRequester;
    const canCancelScheduled = meeting.status === 'SCHEDULED' && !isPastMeeting;
    const canConfirm = meeting.status === 'SCHEDULED' && isPastMeeting && !hasResponded;
    const canReschedule = ['CANCELLED', 'DECLINED'].includes(meeting.status);
    const isDispute = meeting.status === 'DISPUTE';

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
                padding: 16,
                borderRadius: 14,
                background: 'white',
                border: canAccept ? '2px solid #3B82F6' : '1px solid var(--border-light)',
            }}
        >
            {/* Status Badge */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
            }}>
                <span style={{
                    padding: '4px 10px',
                    borderRadius: 8,
                    background: `${getStatusColor(meeting.status)}20`,
                    color: getStatusColor(meeting.status),
                    fontSize: 12,
                    fontWeight: 600,
                }}>
                    {getStatusText(meeting)}
                </span>
                {meeting.paymentStatus === 'PROCESSED' && (
                    <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        color: '#22C55E',
                        fontSize: 12,
                        fontWeight: 600,
                    }}>
                        <CheckCircle size={14} />
                        ₹{isCompany ? '500' : '250'} {isCompany ? 'paid' : 'earned'}
                    </span>
                )}
            </div>

            {/* Date */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 8,
            }}>
                <Clock size={16} color="var(--text-muted)" />
                <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>
                    {formatDate(meeting.scheduledAt)}
                </span>
                {isPastMeeting && meeting.status === 'SCHEDULED' && (
                    <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 500 }}>• Past</span>
                )}
            </div>

            {/* Notes */}
            {meeting.notes && (
                <p style={{
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    marginBottom: 12,
                }}>
                    {meeting.notes}
                </p>
            )}

            {/* OTP Info for SCHEDULED meetings that are past */}
            {meeting.status === 'SCHEDULED' && isPastMeeting && (
                <div style={{
                    marginBottom: 12,
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: isCompany ? '#ECFDF5' : '#FFF7ED',
                    border: `1px solid ${isCompany ? '#22C55E' : '#F59E0B'}`,
                }}>
                    {isCompany ? (
                        <>
                            <p style={{ fontSize: 11, fontWeight: 600, color: '#166534', marginBottom: 4 }}>
                                📋 Verification Code
                            </p>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                {String(meeting.meetingOTP || '------').split('').map((digit, i) => (
                                    <span key={i} style={{
                                        display: 'inline-flex',
                                        width: 26,
                                        height: 30,
                                        borderRadius: 6,
                                        background: 'white',
                                        border: '1.5px solid #22C55E',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: 16,
                                        fontWeight: 800,
                                        color: '#166534',
                                        fontFamily: 'monospace',
                                    }}>{digit}</span>
                                ))}
                                <span style={{ fontSize: 10, color: '#16A34A', marginLeft: 6 }}>Share with seeker</span>
                            </div>
                        </>
                    ) : (
                        <p style={{ fontSize: 12, color: '#92400E', fontWeight: 500 }}>
                            🔑 Enter the verification code in chat to confirm this meeting
                        </p>
                    )}
                </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
                {/* Accept/Decline for pending */}
                {canAccept && (
                    <>
                        <motion.button
                            onClick={() => onAccept(meeting.id)}
                            disabled={isLoading}
                            whileTap={{ scale: 0.95 }}
                            style={{
                                flex: 1,
                                padding: 12,
                                borderRadius: 10,
                                background: 'var(--gradient-primary)',
                                border: 'none',
                                color: 'white',
                                fontSize: 14,
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                cursor: isLoading ? 'wait' : 'pointer',
                                opacity: isLoading ? 0.7 : 1,
                            }}
                        >
                            <Check size={16} />
                            Accept
                        </motion.button>
                        <motion.button
                            onClick={() => onDecline(meeting.id)}
                            disabled={isLoading}
                            whileTap={{ scale: 0.95 }}
                            style={{
                                padding: 12,
                                borderRadius: 10,
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border)',
                                color: 'var(--text-secondary)',
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: isLoading ? 'wait' : 'pointer',
                            }}
                        >
                            <X size={16} />
                        </motion.button>
                    </>
                )}

                {/* Cancel for pending requests I sent */}
                {canCancel && (
                    <motion.button
                        onClick={() => onCancel(meeting.id)}
                        disabled={isLoading}
                        whileTap={{ scale: 0.95 }}
                        style={{
                            width: '100%',
                            padding: 12,
                            borderRadius: 10,
                            background: '#FEE2E2',
                            border: 'none',
                            color: '#EF4444',
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: isLoading ? 'wait' : 'pointer',
                        }}
                    >
                        Cancel Request
                    </motion.button>
                )}

                {/* Cancel scheduled meeting */}
                {canCancelScheduled && (
                    <motion.button
                        onClick={() => onCancel(meeting.id)}
                        disabled={isLoading}
                        whileTap={{ scale: 0.95 }}
                        style={{
                            width: '100%',
                            padding: 12,
                            borderRadius: 10,
                            background: '#FEE2E2',
                            border: 'none',
                            color: '#EF4444',
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: isLoading ? 'wait' : 'pointer',
                        }}
                    >
                        Cancel Meeting
                    </motion.button>
                )}

                {/* OTP actions — company: show OTP in card above; seeker: go to chat */}
                {canConfirm && isCompany && (
                    <div style={{
                        width: '100%',
                        padding: 12,
                        borderRadius: 10,
                        background: '#ECFDF5',
                        border: '1px solid #22C55E',
                        textAlign: 'center',
                    }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#166534', marginBottom: 2 }}>
                            ✅ Share the code above
                        </p>
                        <p style={{ fontSize: 11, color: '#16A34A' }}>
                            The seeker will enter it in chat to confirm
                        </p>
                    </div>
                )}

                {canConfirm && !isCompany && (
                    <div style={{
                        width: '100%',
                        padding: 12,
                        borderRadius: 10,
                        background: '#FFF7ED',
                        border: '1px solid #F59E0B',
                        textAlign: 'center',
                    }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#92400E', marginBottom: 2 }}>
                            🔑 Verify in Chat
                        </p>
                        <p style={{ fontSize: 11, color: '#B45309' }}>
                            Open the chat to enter the 6-digit code from the company
                        </p>
                    </div>
                )}

                {/* Waiting state — legacy backward compat */}
                {hasResponded && meeting.status === 'SCHEDULED' && isPastMeeting && !canConfirm && (
                    <div style={{
                        width: '100%',
                        padding: 12,
                        borderRadius: 10,
                        background: '#FEF3C7',
                        border: '1px solid #FCD34D',
                        textAlign: 'center',
                    }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#92400E', marginBottom: 2 }}>
                            ⏳ Waiting for other party
                        </p>
                        <p style={{ fontSize: 11, color: '#B45309' }}>
                            {myConfirmed ? 'You confirmed the meeting' : 'You reported the meeting did not happen'}
                        </p>
                    </div>
                )}
                {/* Dispute state - no actions available */}
                {isDispute && (
                    <div style={{
                        width: '100%',
                        padding: 12,
                        borderRadius: 10,
                        background: '#FEF3C7',
                        border: '1px solid #F59E0B',
                        textAlign: 'center',
                    }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#92400E', marginBottom: 2 }}>
                            ⚠️ Under Admin Review
                        </p>
                        <p style={{ fontSize: 11, color: '#B45309' }}>
                            Dispute raised. Admin will review and contact both parties.
                        </p>
                    </div>
                )}

                {/* Reschedule cancelled meetings */}
                {canReschedule && (
                    <motion.button
                        onClick={() => onReschedule(meeting)}
                        whileTap={{ scale: 0.95 }}
                        style={{
                            width: '100%',
                            padding: 12,
                            borderRadius: 10,
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                            fontSize: 14,
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            cursor: 'pointer',
                        }}
                    >
                        <RefreshCw size={16} />
                        Reschedule
                    </motion.button>
                )}
            </div>
        </motion.div>
    );
}

// Small badge showing confirmation status
function ConfirmBadge({ label, confirmed }) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            borderRadius: 6,
            background: confirmed ? '#DCFCE7' : '#F3F4F6',
            fontSize: 11,
            fontWeight: 500,
            color: confirmed ? '#16A34A' : '#6B7280',
        }}>
            {confirmed ? <CheckCircle size={12} /> : <Clock size={12} />}
            {label}
        </div>
    );
}

// Schedule Meeting Modal
export function ScheduleMeetingModal({ match, onClose, onScheduled }) {
    const { scheduleMeeting, user, getWallet } = useAuth();
    const { showToast } = useToast();
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [wallet, setWallet] = useState(null);
    const canCloseRef = useRef(false);

    // Prevent ghost clicks from closing modal on mobile
    useEffect(() => {
        canCloseRef.current = false;
        const timer = setTimeout(() => { canCloseRef.current = true; }, 400);
        return () => clearTimeout(timer);
    }, []);

    const isCompany = user?.role === 'COMPANY';

    useEffect(() => {
        if (isCompany) {
            getWallet().then(setWallet);
        }
    }, [isCompany, getWallet]);

    const handleSubmit = async () => {
        if (!date || !time) {
            showToast('Please select date and time', 'warning');
            return;
        }

        const scheduledAt = new Date(`${date}T${time}`).toISOString();

        setSubmitting(true);
        const result = await scheduleMeeting(match.id, scheduledAt, notes);
        setSubmitting(false);

        if (result.success) {
            onScheduled?.();
            onClose();
        } else {
            showToast(result.error, 'error');
        }
    };

    const companyBalance = wallet?.balance || 0;
    const hasEnoughBalance = companyBalance >= 500;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 20,
                zIndex: 100,
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { if (e.target === e.currentTarget && canCloseRef.current) onClose(); }}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                style={{
                    width: '100%',
                    maxWidth: 400,
                    background: 'white',
                    borderRadius: 20,
                    padding: 24,
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                        Schedule Meeting
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <X size={20} color="var(--text-muted)" />
                    </button>
                </div>

                {/* Balance Warning for Companies */}
                {isCompany && !hasEnoughBalance && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: 12,
                        borderRadius: 10,
                        background: '#FEF3C7',
                        marginBottom: 16,
                    }}>
                        <AlertCircle size={18} color="#D97706" />
                        <span style={{ fontSize: 12, color: '#92400E' }}>
                            You need at least ₹500 in wallet. Current: ₹{companyBalance}
                        </span>
                    </div>
                )}

                {/* Date */}
                <label style={{ display: 'block', marginBottom: 16 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
                        Date
                    </span>
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        style={{
                            width: '100%',
                            padding: 12,
                            borderRadius: 10,
                            border: '1px solid var(--border)',
                            fontSize: 15,
                        }}
                    />
                </label>

                {/* Time */}
                <label style={{ display: 'block', marginBottom: 16 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
                        Time
                    </span>
                    <input
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        style={{
                            width: '100%',
                            padding: 12,
                            borderRadius: 10,
                            border: '1px solid var(--border)',
                            fontSize: 15,
                        }}
                    />
                </label>

                {/* Notes */}
                <label style={{ display: 'block', marginBottom: 20 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
                        Notes (optional)
                    </span>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Meeting location, agenda, etc."
                        style={{
                            width: '100%',
                            padding: 12,
                            borderRadius: 10,
                            border: '1px solid var(--border)',
                            fontSize: 14,
                            minHeight: 80,
                            resize: 'vertical',
                            fontFamily: 'inherit',
                        }}
                    />
                </label>

                {/* Info */}
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, textAlign: 'center' }}>
                    {isCompany
                        ? '₹500 will be charged when both parties confirm the meeting'
                        : 'You\'ll earn ₹250 when both parties confirm the meeting'
                    }
                </p>

                {/* Submit */}
                <motion.button
                    onClick={handleSubmit}
                    disabled={submitting || (isCompany && !hasEnoughBalance)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                        width: '100%',
                        padding: 14,
                        borderRadius: 12,
                        background: (submitting || (isCompany && !hasEnoughBalance))
                            ? '#E5E7EB'
                            : 'var(--gradient-primary)',
                        border: 'none',
                        color: (submitting || (isCompany && !hasEnoughBalance)) ? '#9CA3AF' : 'white',
                        fontSize: 15,
                        fontWeight: 600,
                        cursor: (submitting || (isCompany && !hasEnoughBalance)) ? 'not-allowed' : 'pointer',
                    }}
                >
                    {submitting ? 'Scheduling...' : 'Request Meeting'}
                </motion.button>
            </motion.div>
        </motion.div>
    );
}

// Reschedule Meeting Modal
function RescheduleMeetingModal({ meeting, onClose, onScheduled }) {
    const { rescheduleMeeting } = useAuth();
    const { showToast } = useToast();
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [notes, setNotes] = useState(meeting.notes || '');
    const [submitting, setSubmitting] = useState(false);
    const canCloseRef = useRef(false);

    // Prevent ghost clicks from closing modal on mobile
    useEffect(() => {
        canCloseRef.current = false;
        const timer = setTimeout(() => { canCloseRef.current = true; }, 400);
        return () => clearTimeout(timer);
    }, []);

    const handleSubmit = async () => {
        if (!date || !time) {
            showToast('Please select date and time', 'warning');
            return;
        }

        const scheduledAt = new Date(`${date}T${time}`).toISOString();

        setSubmitting(true);
        const result = await rescheduleMeeting(meeting.id, scheduledAt, notes);
        setSubmitting(false);

        if (result.success) {
            showToast('Meeting rescheduled! Waiting for the other party to accept.', 'success');
            onScheduled?.();
            onClose();
        } else {
            showToast(result.error, 'error');
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 20,
                zIndex: 100,
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { if (e.target === e.currentTarget && canCloseRef.current) onClose(); }}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                style={{
                    width: '100%',
                    maxWidth: 400,
                    background: 'white',
                    borderRadius: 20,
                    padding: 24,
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                        Reschedule Meeting
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <X size={20} color="var(--text-muted)" />
                    </button>
                </div>

                {/* Info */}
                <div style={{
                    padding: 12,
                    borderRadius: 10,
                    background: '#FEF3C7',
                    marginBottom: 20,
                }}>
                    <p style={{ fontSize: 12, color: '#92400E' }}>
                        <RefreshCw size={14} style={{ display: 'inline', marginRight: 6 }} />
                        This will create a new meeting request. The other party will need to accept.
                    </p>
                </div>

                {/* Date */}
                <label style={{ display: 'block', marginBottom: 14 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
                        New Date
                    </span>
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        style={{
                            width: '100%',
                            padding: 12,
                            borderRadius: 10,
                            border: '1px solid var(--border)',
                            fontSize: 15,
                        }}
                    />
                </label>

                {/* Time */}
                <label style={{ display: 'block', marginBottom: 14 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
                        New Time
                    </span>
                    <input
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        style={{
                            width: '100%',
                            padding: 12,
                            borderRadius: 10,
                            border: '1px solid var(--border)',
                            fontSize: 15,
                        }}
                    />
                </label>

                {/* Notes */}
                <label style={{ display: 'block', marginBottom: 16 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
                        Notes (optional)
                    </span>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Any details about the meeting..."
                        style={{
                            width: '100%',
                            padding: 12,
                            borderRadius: 10,
                            border: '1px solid var(--border)',
                            fontSize: 14,
                            minHeight: 60,
                            resize: 'vertical',
                            fontFamily: 'inherit',
                        }}
                    />
                </label>

                {/* Submit */}
                <motion.button
                    onClick={handleSubmit}
                    disabled={submitting}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                        width: '100%',
                        padding: 14,
                        borderRadius: 12,
                        background: submitting ? '#E5E7EB' : 'var(--gradient-primary)',
                        border: 'none',
                        color: submitting ? '#9CA3AF' : 'white',
                        fontSize: 15,
                        fontWeight: 600,
                        cursor: submitting ? 'wait' : 'pointer',
                    }}
                >
                    {submitting ? 'Rescheduling...' : 'Request New Time'}
                </motion.button>
            </motion.div>
        </motion.div>
    );
}
