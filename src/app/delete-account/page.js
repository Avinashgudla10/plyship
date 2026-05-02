'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function DeleteAccountPage() {
    const [phone, setPhone] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const cleanPhone = phone.replace(/\s/g, '');
        if (cleanPhone.length !== 10) {
            setError('Please enter a valid 10-digit mobile number');
            return;
        }
        if (!name.trim()) {
            setError('Please enter your name');
            return;
        }

        setIsSubmitting(true);
        try {
            await addDoc(collection(db, 'deleteRequests'), {
                phone: `+91${cleanPhone}`,
                name: name.trim(),
                email: email.trim() || null,
                reason: reason.trim() || 'No reason provided',
                status: 'PENDING',
                requestedAt: new Date().toISOString(),
            });
            setSubmitted(true);
        } catch (err) {
            console.error('Error submitting delete request:', err);
            setError('Failed to submit request. Please try again or contact support.');
        }
        setIsSubmitting(false);
    };

    const inputStyle = {
        width: '100%', padding: '16px 18px', borderRadius: 14,
        border: '1px solid #E5E7EB', background: '#FAFAFA',
        color: '#111', fontSize: 15, fontWeight: 500,
        outline: 'none', boxSizing: 'border-box',
        transition: 'border-color 0.2s',
    };

    if (submitted) {
        return (
            <div style={{
                minHeight: '100vh', background: 'linear-gradient(180deg, #ECFDF5 0%, #FFFFFF 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
            }}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{
                        background: 'white', borderRadius: 20, padding: 40,
                        maxWidth: 440, width: '100%', textAlign: 'center',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
                    }}
                >
                    <div style={{
                        width: 64, height: 64, borderRadius: '50%',
                        background: '#D1FAE5', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 20px',
                    }}>
                        <CheckCircle size={32} color="#16A34A" />
                    </div>
                    <h2 style={{ fontSize: 24, fontWeight: 700, color: '#111', marginBottom: 12 }}>
                        Request Submitted
                    </h2>
                    <p style={{ fontSize: 15, color: '#666', lineHeight: 1.6, marginBottom: 28 }}>
                        Your account deletion request has been received. Our team will review and process it within <strong>3-5 business days</strong>. You will be contacted on your registered phone number once the deletion is complete.
                    </p>
                    <Link href="/" style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '14px 28px', borderRadius: 14,
                        background: '#22C55E', color: 'white',
                        fontWeight: 600, fontSize: 15, textDecoration: 'none',
                    }}>
                        Back to Home
                    </Link>
                </motion.div>
            </div>
        );
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(180deg, #FEF2F2 0%, #FFFFFF 100%)',
            display: 'flex', flexDirection: 'column',
        }}>
            {/* Header */}
            <header style={{
                padding: '16px 24px', background: 'white',
                borderBottom: '1px solid #E5E7EB', position: 'sticky',
                top: 0, zIndex: 50,
            }}>
                <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16 }}>
                    <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#666', textDecoration: 'none' }}>
                        <ArrowLeft size={20} />
                        <span>Back</span>
                    </Link>
                </div>
            </header>

            {/* Form */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        background: 'white', borderRadius: 20, padding: '32px 28px',
                        maxWidth: 520, width: '100%',
                        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
                        <div style={{
                            width: 48, height: 48, borderRadius: 14,
                            background: '#FEE2E2', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Trash2 size={24} color="#DC2626" />
                        </div>
                        <div>
                            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111' }}>Delete Account</h1>
                            <p style={{ fontSize: 13, color: '#888' }}>Request permanent account deletion</p>
                        </div>
                    </div>

                    {/* Warning */}
                    <div style={{
                        background: '#FEF3C7', border: '1px solid #FDE68A',
                        borderRadius: 12, padding: '14px 16px',
                        display: 'flex', gap: 10, alignItems: 'flex-start',
                        margin: '20px 0 24px',
                    }}>
                        <AlertTriangle size={18} color="#D97706" style={{ marginTop: 2, flexShrink: 0 }} />
                        <p style={{ fontSize: 13, color: '#92400E', lineHeight: 1.6, margin: 0 }}>
                            Account deletion is <strong>permanent and irreversible</strong>. All your profile data, chat history, meetings, and wallet balance will be permanently removed.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        {/* Phone */}
                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Registered Mobile Number *
                            </label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <div style={{
                                    padding: '16px 12px', borderRadius: 14,
                                    border: '1px solid #E5E7EB', background: '#FAFAFA',
                                    fontSize: 15, fontWeight: 600, color: '#111',
                                    display: 'flex', alignItems: 'center', flexShrink: 0,
                                }}>🇮🇳 +91</div>
                                <input
                                    type="tel"
                                    placeholder="98765 43210"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, ''))}
                                    maxLength={12}
                                    required
                                    style={inputStyle}
                                />
                            </div>
                        </div>

                        {/* Name */}
                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Name / Company Name *
                            </label>
                            <input
                                type="text"
                                placeholder="Enter your name as in profile"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                style={inputStyle}
                            />
                        </div>

                        {/* Email */}
                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Email (optional)
                            </label>
                            <input
                                type="email"
                                placeholder="your@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                style={inputStyle}
                            />
                        </div>

                        {/* Reason */}
                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Reason for Deletion
                            </label>
                            <select
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto' }}
                            >
                                <option value="">Select a reason (optional)</option>
                                <option value="Not finding it useful">Not finding it useful</option>
                                <option value="Privacy concerns">Privacy concerns</option>
                                <option value="Found an alternative">Found an alternative</option>
                                <option value="Too many notifications">Too many notifications</option>
                                <option value="Bad experience">Bad experience</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        {/* Error */}
                        {error && (
                            <div style={{
                                padding: '12px 16px', borderRadius: 12,
                                background: '#FEF2F2', border: '1px solid #FECACA',
                                color: '#DC2626', fontSize: 14, fontWeight: 500,
                            }}>{error}</div>
                        )}

                        {/* Submit */}
                        <motion.button
                            type="submit"
                            disabled={isSubmitting}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            style={{
                                marginTop: 4, background: '#DC2626',
                                color: 'white', padding: '16px 24px', borderRadius: 14,
                                fontSize: 16, fontWeight: 700, border: 'none',
                                cursor: isSubmitting ? 'wait' : 'pointer',
                                opacity: isSubmitting ? 0.7 : 1,
                                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10,
                            }}
                        >
                            {isSubmitting ? 'Submitting...' : 'Submit Deletion Request'}
                            {!isSubmitting && <Trash2 size={18} />}
                        </motion.button>

                        <p style={{ fontSize: 12, color: '#999', textAlign: 'center', lineHeight: 1.5 }}>
                            Your request will be processed within 3-5 business days.
                            {' '}Contact us at{' '}
                            <a href="mailto:agxfactor@gmail.com" style={{ color: '#16A34A' }}>agxfactor@gmail.com</a>
                            {' '}for any questions.
                        </p>
                    </form>
                </motion.div>
            </div>
        </div>
    );
}
