'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, ArrowRight, ArrowLeft, Shield } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

const ADMIN_PHONES = ['+918465834152'];

export default function Login() {
    const router = useRouter();
    const { user, loading, sendOTP, loginVerifyOTP } = useAuth();

    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [step, setStep] = useState('phone'); // 'phone' or 'otp'
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [countdown, setCountdown] = useState(0);
    const otpRefs = useRef([]);

    // Redirect if already logged in
    useEffect(() => {
        if (!loading && user) {
            if (ADMIN_PHONES.includes(user.phone)) {
                router.replace('/admin');
                return;
            }
            if (user.profileComplete) {
                router.replace('/');
            }
        }
    }, [user, loading, router]);

    // Countdown timer for resend
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    const handleSendOTP = async (e) => {
        e.preventDefault();
        setError('');
        const cleanPhone = phone.replace(/\s/g, '');
        if (cleanPhone.length !== 10) {
            setError('Please enter a valid 10-digit mobile number');
            return;
        }

        setIsLoading(true);
        const result = await sendOTP(cleanPhone, 'recaptcha-container');
        setIsLoading(false);

        if (result.success) {
            setStep('otp');
            setCountdown(30);
            setTimeout(() => otpRefs.current[0]?.focus(), 100);
        } else {
            setError(result.error || 'Failed to send OTP. Please try again.');
        }
    };

    const handleOTPChange = (index, value) => {
        if (value.length > 1) value = value[value.length - 1];
        if (!/^\d*$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        // Auto-focus next input
        if (value && index < 5) {
            otpRefs.current[index + 1]?.focus();
        }

        // Auto-submit when all 6 digits entered
        if (value && index === 5 && newOtp.every(d => d !== '')) {
            handleVerifyOTP(newOtp.join(''));
        }
    };

    const handleOTPKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const handleVerifyOTP = async (otpCode) => {
        setError('');
        const code = otpCode || otp.join('');
        if (code.length !== 6) {
            setError('Please enter the 6-digit OTP');
            return;
        }

        setIsLoading(true);
        const result = await loginVerifyOTP(code);
        setIsLoading(false);

        if (result.success) {
            setTimeout(() => {
                const formattedPhone = `+91${phone.replace(/\s/g, '')}`;
                if (ADMIN_PHONES.includes(formattedPhone)) {
                    router.replace('/admin');
                } else {
                    router.replace('/');
                }
            }, 1000);
        } else {
            setError(result.error || 'Invalid OTP. Please try again.');
            setOtp(['', '', '', '', '', '']);
            otpRefs.current[0]?.focus();
        }
    };

    const handleResendOTP = async () => {
        if (countdown > 0) return;
        setError('');
        setOtp(['', '', '', '', '', '']);
        setIsLoading(true);
        const result = await sendOTP(phone.replace(/\s/g, ''), 'recaptcha-container');
        setIsLoading(false);
        if (result.success) {
            setCountdown(30);
            otpRefs.current[0]?.focus();
        } else {
            setError(result.error || 'Failed to resend OTP.');
        }
    };

    if (loading) return null;
    if (user && user.profileComplete) return null;

    return (
        <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, #ECFDF5 0%, #FFFFFF 100%)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        }}>
            {/* reCAPTCHA container */}
            <div id="recaptcha-container"></div>

            {/* Decorative */}
            <div style={{
                position: 'absolute', top: -100, right: -100, width: 300, height: 300,
                borderRadius: '50%', background: 'radial-gradient(circle, rgba(74, 222, 128, 0.15) 0%, transparent 70%)',
                pointerEvents: 'none'
            }} />
            <div style={{
                position: 'absolute', bottom: -50, left: -50, width: 200, height: 200,
                borderRadius: '50%', background: 'radial-gradient(circle, rgba(134, 239, 172, 0.1) 0%, transparent 70%)',
                pointerEvents: 'none'
            }} />

            {/* Floating */}
            <motion.div
                animate={{ y: [0, -12, 0], rotate: [0, 5, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                style={{
                    position: 'absolute', top: '18%', right: '12%',
                    width: 60, height: 60, borderRadius: 20,
                    background: 'rgba(74, 222, 128, 0.1)',
                    border: '1px solid rgba(74, 222, 128, 0.2)', zIndex: 1
                }}
            />

            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                style={{ flex: '0 0 auto', padding: '60px 32px 40px', position: 'relative', zIndex: 10 }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
                    <Image src="/logo.png" alt="PlyShip" width={140} height={36} style={{ objectFit: 'contain' }} />
                </div>

                <h1 style={{
                    fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 800,
                    lineHeight: 1.1, marginBottom: 12, color: 'var(--text-primary)'
                }}>
                    Welcome<br />
                    <span style={{ color: 'var(--primary-hover)' }}>back</span>
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1.5 }}>
                    {step === 'phone'
                        ? 'Enter your mobile number to sign in'
                        : `Enter the OTP sent to +91 ${phone}`}
                </p>
            </motion.div>

            {/* Form Card */}
            <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                style={{
                    flex: 1, background: 'white',
                    borderTop: '1px solid var(--border-light)',
                    borderTopLeftRadius: 32, borderTopRightRadius: 32,
                    padding: '40px 28px', display: 'flex', flexDirection: 'column',
                    position: 'relative', zIndex: 20,
                    boxShadow: '0 -8px 32px rgba(0,0,0,0.04)'
                }}
            >
                <AnimatePresence mode="wait">
                    {step === 'phone' ? (
                        <motion.form
                            key="phone"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            onSubmit={handleSendOTP}
                            style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
                        >
                            {/* Phone Input */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <label style={{
                                    fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)',
                                    textTransform: 'uppercase', letterSpacing: '0.5px', marginLeft: 4
                                }}>Mobile Number</label>
                                <div style={{ position: 'relative', display: 'flex', gap: 8 }}>
                                    <div style={{
                                        padding: '18px 14px', borderRadius: 16,
                                        border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                                        color: 'var(--text-primary)', fontSize: 16, fontWeight: 600,
                                        display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0
                                    }}>
                                        🇮🇳 +91
                                    </div>
                                    <div style={{ position: 'relative', flex: 1 }}>
                                        <Phone size={20} style={{
                                            position: 'absolute', left: 16, top: '50%',
                                            transform: 'translateY(-50%)', color: 'var(--primary)'
                                        }} />
                                        <input
                                            type="tel"
                                            placeholder="98765 43210"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, ''))}
                                            maxLength={12}
                                            style={{
                                                width: '100%', padding: '18px 20px 18px 52px',
                                                borderRadius: 16, border: '1px solid var(--border)',
                                                background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                                                fontSize: 16, fontWeight: 500, outline: 'none'
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {error && (
                                <div style={{
                                    padding: '12px 16px', borderRadius: 12,
                                    background: '#FEF2F2', border: '1px solid #FECACA',
                                    color: '#DC2626', fontSize: 14, fontWeight: 500
                                }}>{error}</div>
                            )}

                            <motion.button
                                type="submit"
                                disabled={isLoading}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                style={{
                                    marginTop: 8, background: 'var(--gradient-primary)',
                                    color: 'white', padding: '18px 24px', borderRadius: 16,
                                    fontSize: 16, fontWeight: 700, display: 'flex',
                                    justifyContent: 'center', alignItems: 'center', gap: 12,
                                    boxShadow: 'var(--shadow-glow-primary)', border: 'none',
                                    cursor: isLoading ? 'wait' : 'pointer',
                                    opacity: isLoading ? 0.8 : 1
                                }}
                            >
                                {isLoading ? (
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                        style={{
                                            width: 20, height: 20,
                                            border: '2px solid rgba(255,255,255,0.3)',
                                            borderTopColor: 'white', borderRadius: '50%'
                                        }}
                                    />
                                ) : (
                                    <>
                                        Send OTP
                                        <ArrowRight size={20} strokeWidth={2.5} />
                                    </>
                                )}
                            </motion.button>
                        </motion.form>
                    ) : (
                        <motion.div
                            key="otp"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
                        >
                            {/* Back button */}
                            <button
                                onClick={() => { setStep('phone'); setError(''); setOtp(['', '', '', '', '', '']); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500,
                                    background: 'none', border: 'none', cursor: 'pointer', padding: 0
                                }}
                            >
                                <ArrowLeft size={16} /> Change number
                            </button>

                            {/* OTP Input */}
                            <div>
                                <label style={{
                                    fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)',
                                    textTransform: 'uppercase', letterSpacing: '0.5px', marginLeft: 4,
                                    display: 'block', marginBottom: 12
                                }}>Enter 6-digit OTP</label>
                                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                                    {otp.map((digit, i) => (
                                        <input
                                            key={i}
                                            ref={el => otpRefs.current[i] = el}
                                            type="tel"
                                            inputMode="numeric"
                                            maxLength={1}
                                            value={digit}
                                            onChange={(e) => handleOTPChange(i, e.target.value)}
                                            onKeyDown={(e) => handleOTPKeyDown(i, e)}
                                            style={{
                                                width: 48, height: 56, textAlign: 'center',
                                                fontSize: 22, fontWeight: 700, borderRadius: 14,
                                                border: `2px solid ${digit ? 'var(--primary)' : 'var(--border)'}`,
                                                background: digit ? 'var(--pastel-green)' : 'var(--bg-secondary)',
                                                outline: 'none', color: 'var(--text-primary)',
                                                transition: 'all 0.2s'
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>

                            {error && (
                                <div style={{
                                    padding: '12px 16px', borderRadius: 12,
                                    background: '#FEF2F2', border: '1px solid #FECACA',
                                    color: '#DC2626', fontSize: 14, fontWeight: 500
                                }}>{error}</div>
                            )}

                            <motion.button
                                onClick={() => handleVerifyOTP()}
                                disabled={isLoading || otp.some(d => !d)}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                style={{
                                    background: 'var(--gradient-primary)', color: 'white',
                                    padding: '18px 24px', borderRadius: 16, fontSize: 16,
                                    fontWeight: 700, display: 'flex', justifyContent: 'center',
                                    alignItems: 'center', gap: 12,
                                    boxShadow: 'var(--shadow-glow-primary)', border: 'none',
                                    cursor: isLoading ? 'wait' : 'pointer',
                                    opacity: (isLoading || otp.some(d => !d)) ? 0.6 : 1
                                }}
                            >
                                {isLoading ? (
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                        style={{
                                            width: 20, height: 20,
                                            border: '2px solid rgba(255,255,255,0.3)',
                                            borderTopColor: 'white', borderRadius: '50%'
                                        }}
                                    />
                                ) : (
                                    <>
                                        Verify & Sign In
                                        <Shield size={20} strokeWidth={2.5} />
                                    </>
                                )}
                            </motion.button>

                            {/* Resend */}
                            <div style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)' }}>
                                {countdown > 0 ? (
                                    <span>Resend OTP in <strong>{countdown}s</strong></span>
                                ) : (
                                    <button
                                        onClick={handleResendOTP}
                                        style={{
                                            color: 'var(--primary-hover)', fontWeight: 700,
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            fontSize: 14
                                        }}
                                    >Resend OTP</button>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Footer */}
                <div style={{
                    marginTop: 'auto', paddingTop: 24, textAlign: 'center',
                    fontSize: 15, color: 'var(--text-secondary)'
                }}>
                    New to PLYSHIP?{' '}
                    <Link href="/signup" style={{ color: 'var(--primary-hover)', fontWeight: 700 }}>
                        Create Account
                    </Link>
                </div>
            </motion.div>
        </div>
    );
}
