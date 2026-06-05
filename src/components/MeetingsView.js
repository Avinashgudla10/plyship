'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { TopUpModal } from './WalletView';
import { buildRazorpayOptions, openRazorpayCheckout } from '../utils/razorpayHelper';
import {
    Calendar, ArrowLeft, Clock, CheckCircle, XCircle, AlertCircle,
    User, Building2, MapPin, ChevronRight, Plus, X, IndianRupee,
    RefreshCw, Check, Ban, Wallet, CreditCard
} from 'lucide-react';

// Meetings View - Shows all meetings for current user
export default function MeetingsView({ onBack }) {
    const { user, getMeetings, confirmMeeting, acceptMeeting, declineMeeting, cancelMeeting, denyMeeting, topUpWallet, acceptAndScheduleMeeting, requestRescheduleMeeting } = useAuth();
    const { showToast, showConfirm } = useToast();
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionId, setActionId] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [rescheduleModal, setRescheduleModal] = useState(null);
    const [acceptScheduleModal, setAcceptScheduleModal] = useState(null);  // For seeker to accept + schedule

    const isCompany = user?.role === 'COMPANY';
    const MEETING_FEE = 500;

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

    // Pay & Accept: inline Razorpay payment then auto-accept
    const handlePayAndAccept = async (meetingId) => {
        setActionId(meetingId);
        try {
            const orderRes = await fetch('/api/razorpay/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: MEETING_FEE, userId: user.id }),
            });
            const orderData = await orderRes.json();
            if (!orderData.success) throw new Error(orderData.error || 'Failed to create order');

            // Persist for cross-restart recovery
            try {
                localStorage.setItem(`plyship_pending_order_${user.id}`, JSON.stringify({
                    orderId: orderData.orderId,
                    amount: MEETING_FEE,
                    createdAt: Date.now(),
                }));
            } catch (e) { /* localStorage may be unavailable */ }

            const options = buildRazorpayOptions({
                key: orderData.keyId,
                amount: orderData.amount,
                currency: orderData.currency,
                orderId: orderData.orderId,
                description: 'Meeting Fee — Consultation',
                prefill: {
                    name: user?.profile?.companyName || user?.profile?.name || '',
                    email: user?.email || '',
                },
                handler: async function (response) {
                    try {
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
                            setActionId(null);
                            return;
                        }

                        const topUpResult = await topUpWallet(MEETING_FEE, response.razorpay_payment_id, response.razorpay_order_id);
                        // Clear pending order from localStorage
                        try { localStorage.removeItem(`plyship_pending_order_${user.id}`); } catch (e) {}
                        if (!topUpResult.success) {
                            showToast('Payment succeeded but wallet update failed. Contact support.', 'error');
                            setActionId(null);
                            return;
                        }

                        const acceptResult = await acceptMeeting(meetingId);
                        if (acceptResult.success) {
                            showToast('Payment successful! Meeting accepted.', 'success');
                            refreshMeetings();
                        } else {
                            showToast(acceptResult.error || 'Could not accept meeting', 'error');
                        }
                    } catch (err) {
                        showToast(err.message || 'Something went wrong', 'error');
                    }
                    setActionId(null);
                },
                onDismiss: () => setActionId(null),
            });

            openRazorpayCheckout(options);
        } catch (err) {
            showToast(err.message || 'Payment failed', 'error');
            setActionId(null);
        }
    };

    // Accept a pending meeting request — with pay-per-meeting fallback
    const handleAccept = async (meetingId) => {
        setActionId(meetingId);
        const result = await acceptMeeting(meetingId);
        if (result.success) {
            showToast('Meeting accepted! It is now scheduled.', 'success');
            refreshMeetings();
        } else if (result.insufficientFunds) {
            // Offer inline payment
            const payNow = await showConfirm(
                `Insufficient wallet balance (₹${result.current}). Pay ₹${MEETING_FEE} now to accept this meeting?`,
                'Pay & Accept'
            );
            if (payNow) {
                await handlePayAndAccept(meetingId);
                return; // actionId is managed inside handlePayAndAccept
            }
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
                showToast('Meeting confirmed! Amount will be used only for this confirmed appointment.', 'success');
            } else {
                showToast('You confirmed the meeting. Waiting for the other party to respond.', 'success');
            }
            refreshMeetings();
        } else {
            if (result.notYetTime) {
                showToast('Meeting time hasn\'t passed yet. You can confirm after the scheduled time.', 'warning');
            } else if (result.insufficientBalance) {
                showToast('Company has insufficient service deposit to confirm meeting.', 'warning');
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

    // Request reschedule (company asks seeker to pick new date/time)
    const handleRequestReschedule = async (meetingId) => {
        const yes = await showConfirm('Ask the seeker to pick a different date, time or location?', 'Request Reschedule');
        if (!yes) return;
        setActionId(meetingId);
        const result = await requestRescheduleMeeting(meetingId);
        if (result.success) {
            showToast('Reschedule requested! The seeker will pick new details.', 'success');
            refreshMeetings();
        } else {
            showToast(result.error, 'error');
        }
        setActionId(null);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'REQUESTED': return '#8B5CF6';
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
            case 'REQUESTED':
                return iAmRequester ? 'Request sent' : 'Set details & accept';
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
    const pendingMeetings = meetings.filter(m => m.status === 'PENDING_ACCEPTANCE' || m.status === 'REQUESTED');
    const scheduledMeetings = meetings.filter(m => m.status === 'SCHEDULED');
    const pastMeetings = meetings.filter(m => ['CONFIRMED', 'CANCELLED', 'DECLINED'].includes(m.status));

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
                paddingBottom: '16px',
                paddingLeft: '20px',
                paddingRight: '20px',
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
                            ? '₹500 deposit is charged when both confirm the offline meeting happened'
                            : '₹250 is paid to you when both confirm the offline meeting happened'
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
                                            onAcceptAndSchedule={(m) => setAcceptScheduleModal(m)}
                                            onRequestReschedule={handleRequestReschedule}
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
                                            onAcceptAndSchedule={(m) => setAcceptScheduleModal(m)}
                                            onRequestReschedule={handleRequestReschedule}
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
                                            onAcceptAndSchedule={(m) => setAcceptScheduleModal(m)}
                                            onRequestReschedule={handleRequestReschedule}
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

            {/* Accept & Schedule Modal (Seeker sets date/time/location) */}
            <AnimatePresence>
                {acceptScheduleModal && (
                    <AcceptAndScheduleModal
                        meeting={acceptScheduleModal}
                        onClose={() => setAcceptScheduleModal(null)}
                        onScheduled={() => {
                            setAcceptScheduleModal(null);
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
    meeting, user, isCompany, actionId, onAccept, onDecline, onCancel, onConfirm, onDeny, onReschedule, onAcceptAndSchedule, onRequestReschedule,
    getStatusColor, getStatusText, formatDate, isPast
}) {
    const iAmRequester = meeting.requestedBy === user?.id;
    const isPastMeeting = meeting.scheduledAt ? isPast(meeting.scheduledAt) : false;
    const myConfirmed = isCompany ? meeting.companyConfirmed : meeting.seekerConfirmed;
    const myDenied = isCompany ? meeting.companyDenied : meeting.seekerDenied;
    const hasResponded = myConfirmed || myDenied;
    const isLoading = actionId === meeting.id;

    // Determine what actions are available
    const canAccept = meeting.status === 'PENDING_ACCEPTANCE' && !iAmRequester;
    const canAcceptAndSchedule = meeting.status === 'REQUESTED' && !iAmRequester;  // Seeker accepts company request
    const canCancel = (meeting.status === 'PENDING_ACCEPTANCE' || meeting.status === 'REQUESTED') && iAmRequester;
    const canCancelScheduled = meeting.status === 'SCHEDULED' && !isPastMeeting;
    const canConfirm = meeting.status === 'SCHEDULED' && !hasResponded;
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

            {/* Partner Name */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 8,
            }}>
                {isCompany
                    ? <User size={16} color="var(--primary)" />
                    : <Building2 size={16} color="var(--primary)" />
                }
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {isCompany
                        ? (meeting.seekerName || `Seeker`)
                        : (meeting.companyName || `Company`)
                    }
                </span>
            </div>

            {/* Date — only show if scheduledAt exists */}
            {meeting.scheduledAt ? (
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
            ) : (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
                }}>
                    <Clock size={16} color="var(--text-muted)" />
                    <span style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Awaiting date & time
                    </span>
                </div>
            )}

            {/* Location — clickable to open Google Maps */}
            {meeting.location && (() => {
                // Parse location format: "address||lat,lng" or just "address"
                const parts = meeting.location.split('||');
                const displayAddress = parts[0] || meeting.location;
                const coords = parts[1]; // "lat,lng" or undefined
                // Use geo: URI for native app support on Android/iOS
                const geoUri = coords
                    ? `geo:${coords}?q=${coords}`
                    : `geo:0,0?q=${encodeURIComponent(displayAddress)}`;
                // HTTPS fallback for PWA/desktop
                const httpsUrl = coords
                    ? `https://www.google.com/maps/search/?api=1&query=${coords}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(displayAddress)}`;

                return (
                    <a
                        href={geoUri}
                        onClick={(e) => {
                            // On desktop/PWA where geo: may not work, fallback to HTTPS
                            if (!('ontouchstart' in window) && !navigator.maxTouchPoints) {
                                e.preventDefault();
                                window.open(httpsUrl, '_blank');
                            }
                        }}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
                            textDecoration: 'none', cursor: 'pointer',
                            padding: '6px 10px', borderRadius: 8,
                            background: '#F0FDF4', border: '1px solid #BBF7D0',
                        }}
                    >
                        <MapPin size={16} color="#22C55E" />
                        <span style={{
                            fontSize: 13, color: '#166534', fontWeight: 500,
                            flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                            {displayAddress.length > 50 ? displayAddress.substring(0, 50) + '...' : displayAddress}
                        </span>
                        <span style={{ fontSize: 11, color: '#22C55E', fontWeight: 600, flexShrink: 0 }}>
                            Open ↗
                        </span>
                    </a>
                );
            })()}

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

            {/* OTP Info for SCHEDULED meetings */}
            {meeting.status === 'SCHEDULED' && (
                <div style={{
                    marginBottom: 12,
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: !isCompany ? '#ECFDF5' : '#FFF7ED',
                    border: `1px solid ${!isCompany ? '#22C55E' : '#F59E0B'}`,
                }}>
                    {!isCompany ? (
                        <>
                            <p style={{ fontSize: 11, fontWeight: 600, color: '#166534', marginBottom: 4 }}>
                                📋 Verification Code
                            </p>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 6 }}>
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
                            </div>
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: 3,
                                padding: '3px 8px', borderRadius: 5,
                                background: '#FEF2F2', border: '1px solid #FECACA',
                            }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: '#DC2626' }}>
                                    ⚠️ Share ONLY after the meeting
                                </span>
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
                {/* Accept & Set Details for REQUESTED meetings (seeker) */}
                {canAcceptAndSchedule && (
                    <>
                        <motion.button
                            onClick={() => onAcceptAndSchedule(meeting)}
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
                            <Calendar size={16} />
                            Accept & Set Details
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
                        {/* Request Reschedule (company only) */}
                        {isCompany && (
                            <motion.button
                                onClick={() => onRequestReschedule(meeting.id)}
                                disabled={isLoading}
                                whileTap={{ scale: 0.95 }}
                                style={{
                                    padding: 12,
                                    borderRadius: 10,
                                    background: '#EFF6FF',
                                    border: '1px solid #3B82F6',
                                    color: '#3B82F6',
                                    fontSize: 14,
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6,
                                    cursor: isLoading ? 'wait' : 'pointer',
                                }}
                            >
                                <RefreshCw size={16} />
                            </motion.button>
                        )}
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

                {/* OTP actions — seeker: show OTP in card above; company: go to chat */}
                {canConfirm && !isCompany && (
                    <div style={{
                        width: '100%',
                        padding: 12,
                        borderRadius: 10,
                        background: '#FEF2F2',
                        border: '1.5px solid #FECACA',
                        textAlign: 'center',
                    }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#DC2626', marginBottom: 2 }}>
                            ⚠️ Do NOT share before meeting
                        </p>
                        <p style={{ fontSize: 11, color: '#991B1B' }}>
                            Share the OTP with the company only after meeting in person
                        </p>
                    </div>
                )}

                {canConfirm && isCompany && (
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
                            Open the chat to enter the 6-digit code from the seeker
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
    const { scheduleMeeting, user, getWallet, getMeetings } = useAuth();
    const { showToast } = useToast();
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [location, setLocation] = useState(null); // { lat, lng, address }
    const [showLocationPicker, setShowLocationPicker] = useState(false);
    const [LocationPickerComponent, setLocationPickerComponent] = useState(null);
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [wallet, setWallet] = useState(null);
    const [activeMeetingCount, setActiveMeetingCount] = useState(0);
    const [showTopUp, setShowTopUp] = useState(false);
    const canCloseRef = useRef(false);

    // Prevent ghost clicks from closing modal on mobile
    useEffect(() => {
        canCloseRef.current = false;
        const timer = setTimeout(() => { canCloseRef.current = true; }, 400);
        return () => clearTimeout(timer);
    }, []);

    // Dynamically import LocationPicker to avoid SSR
    useEffect(() => {
        import('./LocationPicker').then(mod => {
            setLocationPickerComponent(() => mod.default);
        });
    }, []);

    const isCompany = user?.role === 'COMPANY';
    const MEETING_COST = 500;

    useEffect(() => {
        const fetchData = async () => {
            if (isCompany) {
                const [w, meetings] = await Promise.all([getWallet(), getMeetings()]);
                setWallet(w);
                // Count active meetings (PENDING_ACCEPTANCE or SCHEDULED)
                const activeCount = meetings.filter(m =>
                    m.status === 'PENDING_ACCEPTANCE' || m.status === 'SCHEDULED'
                ).length;
                setActiveMeetingCount(activeCount);
            }
        };
        fetchData();
    }, [isCompany, getWallet, getMeetings]);

    const handleSubmit = async () => {
        // Companies just send a request — no date/time needed
        if (!isCompany && (!date || !time)) {
            showToast('Please select date and time', 'warning');
            return;
        }
        // Seekers must provide a location
        if (!isCompany && !location) {
            showToast('Please select the meeting location on the map', 'warning');
            return;
        }

        const scheduledAt = isCompany ? null : new Date(`${date}T${time}`).toISOString();
        const locationStr = location ? `${location.address}||${location.lat},${location.lng}` : '';

        setSubmitting(true);
        const result = await scheduleMeeting(match.id, scheduledAt, notes, locationStr);
        setSubmitting(false);

        if (result.success) {
            showToast(isCompany ? 'Meeting request sent! The seeker will set the details.' : 'Meeting request sent!', 'success');
            onScheduled?.();
            onClose();
        } else if (result.messageSent) {
            showToast('Message sent to the company! They\'ll reach out to schedule a meeting.', 'success');
            onScheduled?.();
            onClose();
        } else if (result.insufficientBalance || result.meetingLimitReached) {
            showToast(result.error, 'warning');
        } else {
            showToast(result.error, 'error');
        }
    };

    const companyBalance = wallet?.balance || 0;
    const maxSlots = Math.floor(companyBalance / MEETING_COST);
    const remainingSlots = Math.max(0, maxSlots - activeMeetingCount);
    const hasEnoughBalance = companyBalance >= MEETING_COST;
    const hasAvailableSlot = remainingSlots > 0;

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

                {/* Balance & Slot Info for Companies */}
                {isCompany && (
                    <div style={{
                        padding: 12,
                        borderRadius: 10,
                        background: !hasEnoughBalance || !hasAvailableSlot ? '#FEF2F2' : '#ECFDF5',
                        border: `1px solid ${!hasEnoughBalance || !hasAvailableSlot ? '#FECACA' : '#BBF7D0'}`,
                        marginBottom: 16,
                    }}>
                        {/* Slot info */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: !hasAvailableSlot ? '#DC2626' : '#166534' }}>
                                {!hasEnoughBalance
                                    ? '⚠️ Insufficient Service Deposit'
                                    : !hasAvailableSlot
                                        ? '⚠️ No meeting slots available'
                                        : `✅ ${remainingSlots} meeting slot${remainingSlots > 1 ? 's' : ''} available`
                                }
                            </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: hasEnoughBalance && hasAvailableSlot ? 0 : 10 }}>
                            Wallet: ₹{companyBalance} • Active meetings: {activeMeetingCount} • ₹500/meeting
                        </div>
                        {(!hasEnoughBalance || !hasAvailableSlot) && (
                            <motion.button
                                onClick={() => setShowTopUp(true)}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                style={{
                                    width: '100%',
                                    padding: '10px 16px',
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
                                    cursor: 'pointer',
                                    boxShadow: 'var(--shadow-glow-soft)',
                                }}
                            >
                                <Wallet size={16} />
                                {!hasEnoughBalance ? 'Add Service Deposit' : `Add ₹500 for another slot`}
                            </motion.button>
                        )}
                    </div>
                )}

                {/* Date — only for seekers (companies just request) */}
                {!isCompany && (
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
                )}

                {/* Time — only for seekers */}
                {!isCompany && (
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
                )}

                {/* Location — only for seekers */}
                {!isCompany && (
                    <div style={{ marginBottom: 16 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
                            Meeting Location *
                        </span>
                        <motion.div
                            onClick={() => setShowLocationPicker(true)}
                            whileTap={{ scale: 0.98 }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: 12, borderRadius: 12,
                                border: location ? '1.5px solid #22C55E' : '1.5px dashed #D1D5DB',
                                background: location ? '#F0FDF4' : '#F9FAFB',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                        >
                            <div style={{
                                width: 40, height: 40, borderRadius: 10,
                                background: location ? '#DCFCE7' : '#E5E7EB',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                            }}>
                                <MapPin size={20} color={location ? '#22C55E' : '#9CA3AF'} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                {location ? (
                                    <>
                                        <p style={{ fontSize: 13, fontWeight: 600, color: '#166534', marginBottom: 2 }}>
                                            📍 Location selected
                                        </p>
                                        <p style={{
                                            fontSize: 12, color: '#6B7280', lineHeight: 1.3,
                                            overflow: 'hidden', textOverflow: 'ellipsis',
                                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                                        }}>
                                            {location.address}
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <p style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
                                            Select on Map
                                        </p>
                                        <p style={{ fontSize: 12, color: '#9CA3AF' }}>
                                            Tap to open the map and pin the meeting spot
                                        </p>
                                    </>
                                )}
                            </div>
                            <ChevronRight size={18} color="#9CA3AF" />
                        </motion.div>
                    </div>
                )}

                {/* Notes — only for seekers */}
                {!isCompany && (
                    <label style={{ display: 'block', marginBottom: 20 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
                            Notes (optional)
                        </span>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Any specific requirements..."
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
                )}

                {/* Company info — explain the new flow */}
                {isCompany && (
                    <div style={{
                        padding: 14,
                        borderRadius: 12,
                        background: '#F0F9FF',
                        border: '1px solid #BAE6FD',
                        marginBottom: 16,
                    }}>
                        <p style={{ fontSize: 13, color: '#0369A1', fontWeight: 500, lineHeight: 1.5 }}>
                            📋 You'll send a meeting request. The seeker will set the date, time, and meeting location when they accept.
                        </p>
                    </div>
                )}

                {/* Info */}
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textAlign: 'center' }}>
                    {isCompany
                        ? 'Payment is required only for confirmed interior consultation. ₹500 will be charged when both parties confirm the offline meeting.'
                        : 'You\'ll earn ₹250 when both parties confirm the offline interior consultation meeting.'
                    }
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16, textAlign: 'center' }}>
                    No charge until meeting is confirmed
                </p>

                {/* Submit */}
                <motion.button
                    onClick={handleSubmit}
                    disabled={submitting || (isCompany && (!hasEnoughBalance || !hasAvailableSlot))}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                        width: '100%',
                        padding: 14,
                        borderRadius: 12,
                        background: (submitting || (isCompany && (!hasEnoughBalance || !hasAvailableSlot)))
                            ? '#E5E7EB'
                            : 'var(--gradient-primary)',
                        border: 'none',
                        color: (submitting || (isCompany && (!hasEnoughBalance || !hasAvailableSlot))) ? '#9CA3AF' : 'white',
                        fontSize: 15,
                        fontWeight: 600,
                        cursor: (submitting || (isCompany && (!hasEnoughBalance || !hasAvailableSlot))) ? 'not-allowed' : 'pointer',
                    }}
                >
                    {submitting ? 'Sending...' : 'Request Meeting'}
                </motion.button>
            </motion.div>

            {/* Top Up Modal */}
            <AnimatePresence>
                {showTopUp && (
                    <TopUpModal
                        onClose={() => setShowTopUp(false)}
                        onSuccess={(amount) => {
                            showToast(`Service deposit of ₹${amount} added successfully!`, 'success');
                            getWallet().then(setWallet);
                            setShowTopUp(false);
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Full-screen Location Picker (seeker only) */}
            <AnimatePresence>
                {showLocationPicker && LocationPickerComponent && (
                    <LocationPickerComponent
                        onSelect={(loc) => {
                            setLocation(loc);
                            setShowLocationPicker(false);
                        }}
                        onClose={() => setShowLocationPicker(false)}
                    />
                )}
            </AnimatePresence>
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

// Accept & Schedule Modal — Seeker sets date/time/location when accepting a company's request
export function AcceptAndScheduleModal({ meeting, onClose, onScheduled }) {
    const { acceptAndScheduleMeeting } = useAuth();
    const { showToast } = useToast();
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [location, setLocation] = useState(null); // { lat, lng, address }
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showLocationPicker, setShowLocationPicker] = useState(false);
    const [LocationPickerComponent, setLocationPickerComponent] = useState(null);
    const canCloseRef = useRef(false);

    useEffect(() => {
        canCloseRef.current = false;
        const timer = setTimeout(() => { canCloseRef.current = true; }, 400);
        return () => clearTimeout(timer);
    }, []);

    // Dynamically import LocationPicker to avoid SSR
    useEffect(() => {
        import('./LocationPicker').then(mod => {
            setLocationPickerComponent(() => mod.default);
        });
    }, []);

    const handleSubmit = async () => {
        if (!date || !time) {
            showToast('Please select date and time', 'warning');
            return;
        }
        if (!location) {
            showToast('Please select the meeting location on the map', 'warning');
            return;
        }

        const scheduledAt = new Date(`${date}T${time}`).toISOString();

        // Build location string with coordinates for storage
        // Format: "address||lat,lng" so we can parse it later for Google Maps
        const locationStr = `${location.address}||${location.lat},${location.lng}`;

        setSubmitting(true);
        const result = await acceptAndScheduleMeeting(meeting.id, scheduledAt, locationStr, notes);
        setSubmitting(false);

        if (result.success) {
            showToast('Meeting accepted and scheduled! 🎉', 'success');
            onScheduled?.();
            onClose();
        } else {
            showToast(result.error || 'Failed to accept meeting', 'error');
        }
    };

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                    position: 'fixed', inset: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 20, zIndex: 100,
                }}
                onClick={(e) => { if (e.target === e.currentTarget && canCloseRef.current) onClose(); }}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    style={{
                        width: '100%', maxWidth: 400,
                        background: 'white', borderRadius: 20, padding: 24,
                        maxHeight: '90vh', overflow: 'auto',
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                            Accept & Set Details
                        </h2>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                            <X size={20} color="var(--text-muted)" />
                        </button>
                    </div>

                    {/* Company name info */}
                    <div style={{
                        padding: 12, borderRadius: 10,
                        background: '#F0FDF4', border: '1px solid #BBF7D0',
                        marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                        <Building2 size={16} color="#16A34A" />
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#166534' }}>
                            Meeting with {meeting.companyName || 'Company'}
                        </span>
                    </div>

                    {/* Date */}
                    <label style={{ display: 'block', marginBottom: 16 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
                            Date *
                        </span>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            style={{
                                width: '100%', padding: 12, borderRadius: 10,
                                border: '1px solid var(--border)', fontSize: 15,
                            }}
                        />
                    </label>

                    {/* Time */}
                    <label style={{ display: 'block', marginBottom: 16 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
                            Time *
                        </span>
                        <input
                            type="time"
                            value={time}
                            onChange={(e) => setTime(e.target.value)}
                            style={{
                                width: '100%', padding: 12, borderRadius: 10,
                                border: '1px solid var(--border)', fontSize: 15,
                            }}
                        />
                    </label>

                    {/* Location — tap to open map picker */}
                    <div style={{ marginBottom: 16 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
                            Meeting Location *
                        </span>
                        <motion.div
                            onClick={() => setShowLocationPicker(true)}
                            whileTap={{ scale: 0.98 }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: 12, borderRadius: 12,
                                border: location ? '1.5px solid #22C55E' : '1.5px dashed #D1D5DB',
                                background: location ? '#F0FDF4' : '#F9FAFB',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                        >
                            <div style={{
                                width: 40, height: 40, borderRadius: 10,
                                background: location ? '#DCFCE7' : '#E5E7EB',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                            }}>
                                <MapPin size={20} color={location ? '#22C55E' : '#9CA3AF'} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                {location ? (
                                    <>
                                        <p style={{ fontSize: 13, fontWeight: 600, color: '#166534', marginBottom: 2 }}>
                                            📍 Location selected
                                        </p>
                                        <p style={{
                                            fontSize: 12, color: '#6B7280', lineHeight: 1.3,
                                            overflow: 'hidden', textOverflow: 'ellipsis',
                                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                                        }}>
                                            {location.address}
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <p style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
                                            Select on Map
                                        </p>
                                        <p style={{ fontSize: 12, color: '#9CA3AF' }}>
                                            Tap to open the map and pin the meeting spot
                                        </p>
                                    </>
                                )}
                            </div>
                            <ChevronRight size={18} color="#9CA3AF" />
                        </motion.div>
                    </div>

                    {/* Notes */}
                    <label style={{ display: 'block', marginBottom: 20 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
                            Notes (optional)
                        </span>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Any additional info for the company..."
                            style={{
                                width: '100%', padding: 12, borderRadius: 10,
                                border: '1px solid var(--border)', fontSize: 14,
                                minHeight: 70, resize: 'vertical', fontFamily: 'inherit',
                            }}
                        />
                    </label>

                    {/* Info */}
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, textAlign: 'center' }}>
                        You'll earn ₹250 when both parties confirm the offline meeting happened.
                    </p>

                    {/* Submit */}
                    <motion.button
                        onClick={handleSubmit}
                        disabled={submitting}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        style={{
                            width: '100%', padding: 14, borderRadius: 12,
                            background: submitting ? '#E5E7EB' : 'var(--gradient-primary)',
                            border: 'none',
                            color: submitting ? '#9CA3AF' : 'white',
                            fontSize: 15, fontWeight: 600,
                            cursor: submitting ? 'wait' : 'pointer',
                        }}
                    >
                        {submitting ? 'Scheduling...' : 'Accept & Schedule Meeting'}
                    </motion.button>
                </motion.div>
            </motion.div>

            {/* Full-screen Location Picker */}
            <AnimatePresence>
                {showLocationPicker && LocationPickerComponent && (
                    <LocationPickerComponent
                        onSelect={(loc) => {
                            setLocation(loc);
                            setShowLocationPicker(false);
                        }}
                        onClose={() => setShowLocationPicker(false)}
                    />
                )}
            </AnimatePresence>
        </>
    );
}
