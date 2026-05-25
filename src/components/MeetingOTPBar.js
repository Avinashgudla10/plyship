'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ChevronUp, Shield, X, Check, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

/**
 * MeetingOTPBar — Urban-Company-style drop-up for BOTH roles:
 *
 *   SEEKER  → sees OTP digits to share with the company
 *   COMPANY → sees OTP input to enter the code received from the seeker
 *
 * Positioned just above the bottom navigation bar.
 *
 * ===== OTP VISIBILITY RULES =====
 *
 * SHOW when ALL of these are true:
 *   1. Meeting status is 'SCHEDULED'
 *   2. Meeting has a meetingOTP field
 *   3. Meeting is NOT rescheduled (no rescheduledTo field)
 *   4. For SEEKER: seekerConfirmed !== true
 *   5. For COMPANY: companyConfirmed !== true
 */

function shouldShowOTP(meeting, userRole) {
    if (meeting.status !== 'SCHEDULED') return false;
    if (!meeting.meetingOTP) return false;
    if (meeting.rescheduledTo) return false;

    // Role-specific: hide if this user already confirmed
    if (userRole === 'SEEKER' && meeting.seekerConfirmed) return false;
    if (userRole === 'COMPANY' && meeting.companyConfirmed) return false;

    return true;
}

export default function MeetingOTPBar() {
    const { user, getMeetings, verifyMeetingOTP } = useAuth();
    const { showToast } = useToast();
    const [meetings, setMeetings] = useState([]);
    const [isExpanded, setIsExpanded] = useState(false);
    const [loading, setLoading] = useState(true);

    const userRole = user?.role;
    const isSeeker = userRole === 'SEEKER';
    const isCompany = userRole === 'COMPANY';

    const fetchMeetings = useCallback(async () => {
        if (!user) return;

        try {
            const allMeetings = await getMeetings();
            const otpMeetings = allMeetings.filter(m => shouldShowOTP(m, userRole));

            // Sort: past meetings first (need action), then soonest upcoming
            otpMeetings.sort((a, b) => {
                const now = Date.now();
                const aTime = new Date(a.scheduledAt).getTime();
                const bTime = new Date(b.scheduledAt).getTime();
                const aIsPast = aTime < now;
                const bIsPast = bTime < now;

                if (aIsPast && !bIsPast) return -1;
                if (!aIsPast && bIsPast) return 1;
                return aTime - bTime;
            });

            setMeetings(otpMeetings);
        } catch (err) {
            console.error('Failed to fetch meetings for OTP bar:', err);
        }
        setLoading(false);
    }, [user, userRole, getMeetings]);

    useEffect(() => {
        fetchMeetings();
        const interval = setInterval(fetchMeetings, 30000);
        return () => clearInterval(interval);
    }, [fetchMeetings]);

    if (loading || meetings.length === 0) return null;

    const firstMeeting = meetings[0];
    const hasMultiple = meetings.length > 1;

    const formatMeetingTime = (scheduledAt) => {
        const date = new Date(scheduledAt);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const isTomorrow = date.toDateString() === tomorrow.toDateString();

        const timeStr = date.toLocaleTimeString('en-IN', {
            hour: '2-digit', minute: '2-digit', hour12: true,
        });

        if (isToday) return `Today, ${timeStr}`;
        if (isTomorrow) return `Tomorrow, ${timeStr}`;
        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + `, ${timeStr}`;
    };

    const isPastMeeting = (scheduledAt) => new Date(scheduledAt) < new Date();
    const partnerName = (m) => isSeeker ? (m.companyName || 'Company') : (m.seekerName || 'Seeker');

    return (
        <>
            {/* Backdrop when expanded */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => setIsExpanded(false)}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.3)',
                            zIndex: 49,
                        }}
                    />
                )}
            </AnimatePresence>

            <div style={{ position: 'relative', zIndex: 50, flexShrink: 0 }}>
                {/* Expanded drop-up list */}
                <AnimatePresence>
                    {isExpanded && hasMultiple && (
                        <motion.div
                            initial={{ opacity: 0, y: 20, scaleY: 0.8 }}
                            animate={{ opacity: 1, y: 0, scaleY: 1 }}
                            exit={{ opacity: 0, y: 20, scaleY: 0.8 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            style={{
                                position: 'absolute',
                                bottom: '100%',
                                left: 0, right: 0,
                                background: 'white',
                                borderTop: '1px solid var(--border-light, #E5E7EB)',
                                boxShadow: '0 -8px 32px rgba(0,0,0,0.12)',
                                borderRadius: '16px 16px 0 0',
                                overflow: 'hidden',
                                transformOrigin: 'bottom',
                                maxHeight: '50vh',
                                overflowY: 'auto',
                            }}
                        >
                            {/* Header */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '12px 16px 8px',
                                borderBottom: '1px solid #F3F4F6',
                                position: 'sticky', top: 0,
                                background: 'white', zIndex: 1,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {isSeeker ? <Shield size={14} color="#22C55E" /> : <KeyRound size={14} color="#F59E0B" />}
                                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #1E1E1E)' }}>
                                        {isSeeker ? 'Meeting OTPs' : 'Verify Meetings'}
                                    </span>
                                    <span style={{
                                        fontSize: 11, fontWeight: 600, color: 'white',
                                        background: isSeeker ? '#22C55E' : '#F59E0B',
                                        borderRadius: 10, padding: '1px 7px', lineHeight: '18px',
                                    }}>
                                        {meetings.length}
                                    </span>
                                </div>
                                <motion.button
                                    onClick={() => setIsExpanded(false)}
                                    whileTap={{ scale: 0.9 }}
                                    style={{
                                        background: '#F3F4F6', border: 'none', borderRadius: 8,
                                        width: 28, height: 28,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <X size={14} color="#6B7280" />
                                </motion.button>
                            </div>

                            {/* Meeting List (skip first since it's shown in the bar) */}
                            {meetings.slice(1).map((meeting) => (
                                isSeeker ? (
                                    <SeekerOTPRow key={meeting.id} meeting={meeting} formatTime={formatMeetingTime} isPast={isPastMeeting(meeting.scheduledAt)} partnerName={partnerName(meeting)} />
                                ) : (
                                    <CompanyOTPRow key={meeting.id} meeting={meeting} formatTime={formatMeetingTime} isPast={isPastMeeting(meeting.scheduledAt)} partnerName={partnerName(meeting)} verifyMeetingOTP={verifyMeetingOTP} showToast={showToast} onVerified={fetchMeetings} />
                                )
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Main OTP Bar */}
                {isSeeker ? (
                    <SeekerBar
                        meeting={firstMeeting}
                        isPast={isPastMeeting(firstMeeting.scheduledAt)}
                        partnerName={partnerName(firstMeeting)}
                        formatTime={formatMeetingTime}
                        hasMultiple={hasMultiple}
                        isExpanded={isExpanded}
                        onToggle={() => hasMultiple && setIsExpanded(!isExpanded)}
                    />
                ) : (
                    <CompanyBar
                        meeting={firstMeeting}
                        isPast={isPastMeeting(firstMeeting.scheduledAt)}
                        partnerName={partnerName(firstMeeting)}
                        formatTime={formatMeetingTime}
                        hasMultiple={hasMultiple}
                        isExpanded={isExpanded}
                        onToggle={() => hasMultiple && setIsExpanded(!isExpanded)}
                        verifyMeetingOTP={verifyMeetingOTP}
                        showToast={showToast}
                        onVerified={fetchMeetings}
                    />
                )}
            </div>

            <style>{`
                @keyframes otpPulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.3); }
                }
            `}</style>
        </>
    );
}

// ============================================================
// SEEKER BAR — Shows OTP digits for sharing with company
// ============================================================

function SeekerBar({ meeting, isPast, partnerName, formatTime, hasMultiple, isExpanded, onToggle }) {
    return (
        <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200, delay: 0.3 }}
            onClick={onToggle}
            style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 16px', background: 'white',
                borderTop: '1px solid var(--border-light, #E5E7EB)',
                cursor: hasMultiple ? 'pointer' : 'default', userSelect: 'none',
            }}
        >
            <MeetingIcon isPast={isPast} color="green" />
            <MeetingInfo name={partnerName} time={formatTime(meeting.scheduledAt)} isPast={isPast} pastLabel="Share OTP" warningLabel="⚠️ After meeting only" />
            <OTPDigits otp={meeting.meetingOTP} />
            {hasMultiple && <ExpandChevron isExpanded={isExpanded} />}
        </motion.div>
    );
}

function SeekerOTPRow({ meeting, formatTime, isPast, partnerName }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 16px', borderBottom: '1px solid #F9FAFB',
        }}>
            <MeetingIcon isPast={isPast} color="green" small />
            <MeetingInfo name={partnerName} time={formatTime(meeting.scheduledAt)} isPast={isPast} pastLabel="Share OTP" warningLabel="⚠️ After meeting only" />
            <OTPDigits otp={meeting.meetingOTP} small />
        </div>
    );
}

// ============================================================
// COMPANY BAR — Shows OTP input for entering code from seeker
// ============================================================

function CompanyBar({ meeting, isPast, partnerName, formatTime, hasMultiple, isExpanded, onToggle, verifyMeetingOTP, showToast, onVerified }) {
    const [otpInput, setOtpInput] = useState('');
    const [verifying, setVerifying] = useState(false);
    const inputRefs = useRef([]);

    const handleVerify = async () => {
        if (otpInput.length !== 6) return;
        setVerifying(true);
        const result = await verifyMeetingOTP(meeting.id, otpInput);
        setVerifying(false);
        if (result.success && result.bothConfirmed) {
            setOtpInput('');
            showToast('Meeting confirmed! Payment transferred.', 'success');
            onVerified();
        } else if (result.wrongOTP) {
            showToast('Incorrect code. Please check with the seeker.', 'error');
        } else if (result.notYetTime) {
            showToast('Meeting time has not passed yet.', 'warning');
        } else if (result.error) {
            showToast(result.error, 'error');
        }
    };

    return (
        <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200, delay: 0.3 }}
            style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', background: 'white',
                borderTop: '1px solid var(--border-light, #E5E7EB)',
                userSelect: 'none',
            }}
        >
            <MeetingIcon isPast={true} color="amber" />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontSize: 12, fontWeight: 600,
                    color: 'var(--text-primary, #1E1E1E)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    {partnerName}
                </div>
                <div style={{ fontSize: 10, color: '#D97706', fontWeight: 500 }}>
                    Enter OTP from seeker
                </div>
            </div>

            {/* Inline OTP input */}
            <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                {[0, 1, 2, 3, 4, 5].map(i => (
                    <input
                        key={i}
                        ref={el => inputRefs.current[i] = el}
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
                                if (val && i < 5 && inputRefs.current[i + 1]) {
                                    inputRefs.current[i + 1].focus();
                                }
                            }
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Backspace' && !otpInput[i] && i > 0 && inputRefs.current[i - 1]) {
                                inputRefs.current[i - 1].focus();
                            }
                        }}
                        style={{
                            width: 26, height: 30, borderRadius: 6,
                            border: `1.5px solid ${otpInput[i] ? '#F59E0B' : '#E5E7EB'}`,
                            background: '#FFFBEB', textAlign: 'center',
                            fontSize: 15, fontWeight: 800, color: '#92400E',
                            fontFamily: 'monospace', outline: 'none', padding: 0,
                            transition: 'border-color 0.2s',
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#F59E0B'}
                        onBlur={(e) => { if (!otpInput[i]) e.target.style.borderColor = '#E5E7EB'; }}
                    />
                ))}
            </div>

            {/* Verify button */}
            <motion.button
                onClick={handleVerify}
                disabled={verifying || otpInput.length !== 6}
                whileTap={{ scale: 0.9 }}
                style={{
                    width: 32, height: 30, borderRadius: 8, flexShrink: 0,
                    background: otpInput.length === 6 ? 'var(--gradient-primary, linear-gradient(135deg, #22C55E, #16A34A))' : '#E5E7EB',
                    border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: otpInput.length === 6 ? 'pointer' : 'not-allowed',
                }}
            >
                <Check size={16} color={otpInput.length === 6 ? 'white' : '#9CA3AF'} />
            </motion.button>

            {hasMultiple && (
                <motion.div
                    onClick={onToggle}
                    style={{ cursor: 'pointer', flexShrink: 0 }}
                >
                    <ExpandChevron isExpanded={isExpanded} />
                </motion.div>
            )}
        </motion.div>
    );
}

function CompanyOTPRow({ meeting, formatTime, isPast, partnerName, verifyMeetingOTP, showToast, onVerified }) {
    const [otpInput, setOtpInput] = useState('');
    const [verifying, setVerifying] = useState(false);
    const inputRefs = useRef([]);

    const handleVerify = async () => {
        if (otpInput.length !== 6) return;
        setVerifying(true);
        const result = await verifyMeetingOTP(meeting.id, otpInput);
        setVerifying(false);
        if (result.success && result.bothConfirmed) {
            setOtpInput('');
            showToast('Meeting confirmed! Payment transferred.', 'success');
            onVerified();
        } else if (result.wrongOTP) {
            showToast('Incorrect code. Please check with the seeker.', 'error');
        } else if (result.error) {
            showToast(result.error, 'error');
        }
    };

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 12px', borderBottom: '1px solid #F9FAFB',
        }}>
            <MeetingIcon isPast={true} color="amber" small />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontSize: 12, fontWeight: 600,
                    color: 'var(--text-primary, #1E1E1E)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    {partnerName}
                </div>
                <div style={{ fontSize: 10, color: '#D97706', fontWeight: 500 }}>
                    Enter OTP
                </div>
            </div>

            <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                {[0, 1, 2, 3, 4, 5].map(i => (
                    <input
                        key={i}
                        ref={el => inputRefs.current[i] = el}
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
                                if (val && i < 5 && inputRefs.current[i + 1]) {
                                    inputRefs.current[i + 1].focus();
                                }
                            }
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Backspace' && !otpInput[i] && i > 0 && inputRefs.current[i - 1]) {
                                inputRefs.current[i - 1].focus();
                            }
                        }}
                        style={{
                            width: 24, height: 28, borderRadius: 5,
                            border: `1.5px solid ${otpInput[i] ? '#F59E0B' : '#E5E7EB'}`,
                            background: '#FFFBEB', textAlign: 'center',
                            fontSize: 14, fontWeight: 800, color: '#92400E',
                            fontFamily: 'monospace', outline: 'none', padding: 0,
                        }}
                    />
                ))}
            </div>

            <motion.button
                onClick={handleVerify}
                disabled={verifying || otpInput.length !== 6}
                whileTap={{ scale: 0.9 }}
                style={{
                    width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                    background: otpInput.length === 6 ? 'var(--gradient-primary, linear-gradient(135deg, #22C55E, #16A34A))' : '#E5E7EB',
                    border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: otpInput.length === 6 ? 'pointer' : 'not-allowed',
                }}
            >
                <Check size={14} color={otpInput.length === 6 ? 'white' : '#9CA3AF'} />
            </motion.button>
        </div>
    );
}

// ============================================================
// SHARED PRIMITIVES
// ============================================================

function MeetingIcon({ isPast, color = 'green', small = false }) {
    const size = small ? 28 : 32;
    const iconSize = small ? 13 : 16;
    const radius = small ? 8 : 10;

    const colors = {
        green: {
            bg: isPast
                ? 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)'
                : 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)',
            icon: isPast ? '#D97706' : '#22C55E',
        },
        amber: {
            bg: isPast
                ? 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)'
                : 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)',
            icon: isPast ? '#D97706' : '#F59E0B',
        },
    };

    const c = colors[color];

    return (
        <div style={{
            width: size, height: size, borderRadius: radius,
            background: c.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, position: 'relative',
        }}>
            <Clock size={iconSize} color={c.icon} />
            {isPast && (
                <div style={{
                    position: 'absolute', top: -2, right: -2,
                    width: 8, height: 8, borderRadius: '50%',
                    background: '#F59E0B', border: '1.5px solid white',
                    animation: 'otpPulse 2s ease-in-out infinite',
                }} />
            )}
        </div>
    );
}

function MeetingInfo({ name, time, isPast, pastLabel, warningLabel }) {
    return (
        <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
                fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #1E1E1E)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
                {name}
            </div>
            <div style={{
                fontSize: 11,
                color: isPast ? '#D97706' : 'var(--text-muted, #9CA3AF)',
                fontWeight: 500,
            }}>
                {time}
                {isPast && pastLabel && ` • ${pastLabel}`}
            </div>
            {warningLabel && (
                <div style={{
                    fontSize: 9, fontWeight: 700, color: '#DC2626',
                    marginTop: 1,
                }}>
                    {warningLabel}
                </div>
            )}
        </div>
    );
}

function OTPDigits({ otp, small = false }) {
    const w = small ? 24 : 26;
    const h = small ? 28 : 30;
    const r = small ? 5 : 6;
    const fs = small ? 14 : 15;

    return (
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
            {String(otp).split('').map((digit, i) => (
                <div key={i} style={{
                    width: w, height: h, borderRadius: r,
                    background: '#F9FAFB', border: '1.5px solid #E5E7EB',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: fs, fontWeight: 800,
                    color: 'var(--text-primary, #1E1E1E)', fontFamily: 'monospace',
                }}>
                    {digit}
                </div>
            ))}
        </div>
    );
}

function ExpandChevron({ isExpanded }) {
    return (
        <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            style={{
                width: 24, height: 24, borderRadius: 6,
                background: '#F3F4F6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
            }}
        >
            <ChevronUp size={14} color="#6B7280" />
        </motion.div>
    );
}
