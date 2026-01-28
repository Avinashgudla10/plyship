'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import {
    Calendar, ArrowLeft, Clock, CheckCircle, XCircle, AlertCircle,
    User, Building2, MapPin, ChevronRight, Plus, X, IndianRupee
} from 'lucide-react';

// Meetings View - Shows all meetings for current user
export default function MeetingsView({ onBack }) {
    const { user, getMeetings, confirmMeeting } = useAuth();
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [confirmingId, setConfirmingId] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const isCompany = user?.role === 'COMPANY';

    useEffect(() => {
        let isMounted = true;

        const fetchMeetings = async () => {
            setLoading(true);
            const data = await getMeetings();
            if (isMounted) {
                setMeetings(data);
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

    const handleConfirm = async (meetingId) => {
        setConfirmingId(meetingId);
        const result = await confirmMeeting(meetingId);

        if (result.success) {
            if (result.bothConfirmed) {
                alert('🎉 Meeting confirmed! ₹500 has been transferred.');
            } else {
                alert('✅ You confirmed the meeting. Waiting for the other party.');
            }
            refreshMeetings(); // Refresh
        } else {
            if (result.notYetTime) {
                alert('⏰ Meeting time hasn\'t passed yet. You can confirm after the scheduled time.');
            } else if (result.insufficientBalance) {
                alert('⚠️ Company has insufficient wallet balance to confirm meeting.');
            } else {
                alert('Error: ' + result.error);
            }
        }
        setConfirmingId(null);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'SCHEDULED': return '#F59E0B';
            case 'CONFIRMED': return '#22C55E';
            case 'CANCELLED': return '#EF4444';
            default: return '#6B7280';
        }
    };

    const getStatusText = (meeting) => {
        if (meeting.status === 'CONFIRMED') return 'Completed';
        if (meeting.status === 'CANCELLED') return 'Cancelled';

        const myConfirmed = isCompany ? meeting.companyConfirmed : meeting.seekerConfirmed;
        const otherConfirmed = isCompany ? meeting.seekerConfirmed : meeting.companyConfirmed;

        if (myConfirmed && !otherConfirmed) return 'Awaiting other';
        if (!myConfirmed && otherConfirmed) return 'Confirm now';
        return 'Pending';
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
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
                            ? '₹500 will be deducted when both parties confirm'
                            : '₹500 will be credited (locked) when both parties confirm'
                        }
                    </span>
                </div>

                {meetings.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40 }}>
                        <Calendar size={48} color="var(--text-muted)" style={{ marginBottom: 12 }} />
                        <p style={{ color: 'var(--text-muted)', marginBottom: 8 }}>No meetings yet</p>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                            Schedule meetings with your matches to earn rewards
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {meetings.map((meeting) => {
                            const myConfirmed = isCompany ? meeting.companyConfirmed : meeting.seekerConfirmed;
                            const canConfirm = meeting.status === 'SCHEDULED' && !myConfirmed;

                            return (
                                <motion.div
                                    key={meeting.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    style={{
                                        padding: 16,
                                        borderRadius: 14,
                                        background: 'white',
                                        border: '1px solid var(--border-light)',
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
                                                ₹500 {isCompany ? 'paid' : 'earned'}
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

                                    {/* Confirmation Status */}
                                    <div style={{
                                        display: 'flex',
                                        gap: 8,
                                        marginBottom: canConfirm ? 12 : 0,
                                    }}>
                                        <ConfirmBadge
                                            label={isCompany ? 'You' : 'Company'}
                                            confirmed={meeting.companyConfirmed}
                                        />
                                        <ConfirmBadge
                                            label={isCompany ? 'Seeker' : 'You'}
                                            confirmed={meeting.seekerConfirmed}
                                        />
                                    </div>

                                    {/* Confirm Button */}
                                    {canConfirm && (
                                        <motion.button
                                            onClick={() => handleConfirm(meeting.id)}
                                            disabled={confirmingId === meeting.id}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            style={{
                                                width: '100%',
                                                padding: 12,
                                                borderRadius: 10,
                                                background: 'var(--gradient-primary)',
                                                border: 'none',
                                                color: 'white',
                                                fontSize: 14,
                                                fontWeight: 600,
                                                cursor: confirmingId === meeting.id ? 'wait' : 'pointer',
                                                opacity: confirmingId === meeting.id ? 0.7 : 1,
                                            }}
                                        >
                                            {confirmingId === meeting.id ? 'Confirming...' : 'Confirm Meeting Happened'}
                                        </motion.button>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
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
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [wallet, setWallet] = useState(null);

    const isCompany = user?.role === 'COMPANY';

    useEffect(() => {
        if (isCompany) {
            getWallet().then(setWallet);
        }
    }, [isCompany, getWallet]);

    const handleSubmit = async () => {
        if (!date || !time) {
            alert('Please select date and time');
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
            alert('Error: ' + result.error);
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
            onClick={onClose}
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
                        : 'You\'ll earn ₹500 when both parties confirm the meeting'
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
                    {submitting ? 'Scheduling...' : 'Schedule Meeting'}
                </motion.button>
            </motion.div>
        </motion.div>
    );
}
