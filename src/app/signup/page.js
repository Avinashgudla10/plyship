'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, Leaf, CheckCircle } from 'lucide-react';
import RoleSelectionModal from '../../components/RoleSelectionModal';
import Link from 'next/link';
import Image from 'next/image';

export default function Signup() {
    const router = useRouter();
    const { user, loading, signup, selectRole } = useAuth();

    const ADMIN_EMAILS = ['avinashgudla10@gmail.com'];

    const [formData, setFormData] = useState({ name: '', email: '', password: '' });
    const [showRoleSelection, setShowRoleSelection] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Redirect if already logged in with complete profile or admin
    useEffect(() => {
        if (!loading && user) {
            if (ADMIN_EMAILS.includes(user.email)) {
                router.replace('/admin');
                return;
            }
            if (user.profileComplete) {
                router.replace('/');
            }
        }
    }, [user, loading, router]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (formData.name && formData.email && formData.password) {
            if (formData.password.length < 6) {
                setError('Password must be at least 6 characters');
                return;
            }
            setIsLoading(true);
            const result = await signup(formData.name, formData.email, formData.password);
            setIsLoading(false);

            if (result.success) {
                setShowRoleSelection(true);
            } else {
                setError(result.error || 'Signup failed. Please try again.');
            }
        }
    };

    const handleRoleSelect = (role) => {
        selectRole(role);
        setShowRoleSelection(false);
        // Small delay to ensure React state update completes before navigation
        // Use replace so back button doesn't go through signup flow
        setTimeout(() => {
            router.replace('/profile-setup');
        }, 100);
    };

    const passwordStrength = formData.password.length >= 8 ? 'strong' : formData.password.length >= 4 ? 'medium' : 'weak';

    // Show nothing while checking auth or if already logged in
    if (loading) return null;
    if (user && user.profileComplete) return null;

    return (
        <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, #D1FAE5 0%, #FFFFFF 100%)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        }}>
            {/* Decorative Elements */}
            <div style={{
                position: 'absolute',
                top: -80,
                left: -80,
                width: 250,
                height: 250,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(134, 239, 172, 0.2) 0%, transparent 70%)',
                pointerEvents: 'none'
            }} />
            <div style={{
                position: 'absolute',
                bottom: '20%',
                right: -60,
                width: 180,
                height: 180,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(74, 222, 128, 0.1) 0%, transparent 70%)',
                pointerEvents: 'none'
            }} />

            {/* Floating Elements */}
            <motion.div
                animate={{ y: [0, -10, 0], rotate: [0, -4, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                style={{
                    position: 'absolute',
                    top: '14%',
                    left: '10%',
                    width: 50,
                    height: 50,
                    borderRadius: 16,
                    background: 'rgba(167, 243, 208, 0.2)',
                    border: '1px solid rgba(167, 243, 208, 0.4)',
                    zIndex: 1
                }}
            />
            <motion.div
                animate={{ y: [0, 8, 0], rotate: [0, 5, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                style={{
                    position: 'absolute',
                    top: '22%',
                    right: '15%',
                    width: 35,
                    height: 35,
                    borderRadius: 12,
                    background: 'rgba(74, 222, 128, 0.15)',
                    border: '1px solid rgba(74, 222, 128, 0.25)',
                    zIndex: 1
                }}
            />

            {/* Header Section */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                style={{
                    flex: '0 0 auto',
                    padding: '50px 32px 28px',
                    position: 'relative',
                    zIndex: 10
                }}
            >
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 28
                }}>
                    <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: 13,
                        overflow: 'hidden',
                    }}>
                        <Image src="/favicon.png" alt="PlyShip" width={44} height={44} />
                    </div>
                    <Image src="/logo.png" alt="PlyShip" width={110} height={28} style={{ objectFit: 'contain' }} />
                </div>

                <h1 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 32,
                    fontWeight: 800,
                    lineHeight: 1.1,
                    marginBottom: 10,
                    color: 'var(--text-primary)'
                }}>
                    Create your<br />
                    <span style={{ color: 'var(--primary-hover)' }}>dream space</span>
                </h1>
                <p style={{
                    color: 'var(--text-secondary)',
                    fontSize: 15,
                    lineHeight: 1.5
                }}>
                    Join thousands finding their perfect interior match
                </p>
            </motion.div>

            {/* Form Card */}
            <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                style={{
                    flex: 1,
                    background: 'white',
                    borderTop: '1px solid var(--border-light)',
                    borderTopLeftRadius: 32,
                    borderTopRightRadius: 32,
                    padding: '32px 28px',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    zIndex: 20,
                    overflowY: 'auto',
                    boxShadow: '0 -8px 32px rgba(0,0,0,0.04)'
                }}
            >
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {/* Name Input */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <label style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--text-tertiary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginLeft: 4
                        }}>
                            Full Name
                        </label>
                        <div style={{ position: 'relative' }}>
                            <User size={20} style={{
                                position: 'absolute',
                                left: 16,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--primary)'
                            }} />
                            <input
                                type="text"
                                placeholder="John Doe"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '16px 20px 16px 52px',
                                    borderRadius: 14,
                                    border: '1px solid var(--border)',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                    fontSize: 16,
                                    fontWeight: 500,
                                    outline: 'none',
                                    transition: 'all 0.2s'
                                }}
                            />
                        </div>
                    </div>

                    {/* Email Input */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <label style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--text-tertiary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginLeft: 4
                        }}>
                            Email
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={20} style={{
                                position: 'absolute',
                                left: 16,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--primary)'
                            }} />
                            <input
                                type="email"
                                placeholder="hello@example.com"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '16px 20px 16px 52px',
                                    borderRadius: 14,
                                    border: '1px solid var(--border)',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                    fontSize: 16,
                                    fontWeight: 500,
                                    outline: 'none',
                                    transition: 'all 0.2s'
                                }}
                            />
                        </div>
                    </div>

                    {/* Password Input */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <label style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--text-tertiary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginLeft: 4
                        }}>
                            Password
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={20} style={{
                                position: 'absolute',
                                left: 16,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--primary)'
                            }} />
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="Create a strong password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '16px 52px 16px 52px',
                                    borderRadius: 14,
                                    border: '1px solid var(--border)',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                    fontSize: 16,
                                    fontWeight: 500,
                                    outline: 'none',
                                    transition: 'all 0.2s'
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: 16,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    padding: 4,
                                    color: 'var(--text-muted)'
                                }}
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                        {formData.password && (
                            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                                {[1, 2, 3].map((i) => (
                                    <div key={i} style={{
                                        flex: 1,
                                        height: 3,
                                        borderRadius: 2,
                                        background: i <= (passwordStrength === 'strong' ? 3 : passwordStrength === 'medium' ? 2 : 1)
                                            ? passwordStrength === 'strong' ? 'var(--success)' : passwordStrength === 'medium' ? 'var(--warning)' : 'var(--error)'
                                            : 'var(--border)'
                                    }} />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div style={{
                            padding: '12px 16px',
                            borderRadius: 12,
                            background: '#FEF2F2',
                            border: '1px solid #FECACA',
                            color: '#DC2626',
                            fontSize: 14,
                            fontWeight: 500
                        }}>
                            {error}
                        </div>
                    )}

                    {/* Submit Button */}
                    <motion.button
                        type="submit"
                        disabled={isLoading}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        style={{
                            marginTop: 8,
                            background: 'var(--gradient-primary)',
                            color: 'white',
                            padding: '18px 24px',
                            borderRadius: 16,
                            fontSize: 16,
                            fontWeight: 700,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: 12,
                            boxShadow: 'var(--shadow-glow-primary)',
                            border: 'none',
                            cursor: isLoading ? 'wait' : 'pointer',
                            opacity: isLoading ? 0.8 : 1
                        }}
                    >
                        {isLoading ? (
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                style={{
                                    width: 20,
                                    height: 20,
                                    border: '2px solid rgba(255,255,255,0.3)',
                                    borderTopColor: 'white',
                                    borderRadius: '50%'
                                }}
                            />
                        ) : (
                            <>
                                Get Started
                                <ArrowRight size={20} strokeWidth={2.5} />
                            </>
                        )}
                    </motion.button>
                </form>

                {/* Features Pills */}
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    gap: 10,
                    margin: '24px 0'
                }}>
                    {['Free to use', 'Verified companies', 'Secure'].map((feature) => (
                        <div key={feature} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '8px 14px',
                            borderRadius: 20,
                            background: 'var(--pastel-green)',
                            border: '1px solid var(--pastel-mint)',
                            fontSize: 12,
                            fontWeight: 500,
                            color: 'var(--text-secondary)'
                        }}>
                            <CheckCircle size={14} color="var(--success)" />
                            {feature}
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div style={{
                    marginTop: 'auto',
                    paddingTop: 16,
                    textAlign: 'center',
                    fontSize: 15,
                    color: 'var(--text-secondary)'
                }}>
                    Already have an account?{' '}
                    <Link href="/login" style={{
                        color: 'var(--primary-hover)',
                        fontWeight: 700
                    }}>
                        Sign In
                    </Link>
                </div>
            </motion.div>

            <AnimatePresence>
                {showRoleSelection && (
                    <RoleSelectionModal onSelect={handleRoleSelect} />
                )}
            </AnimatePresence>
        </div>
    );
}
