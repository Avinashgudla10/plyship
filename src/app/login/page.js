'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Leaf } from 'lucide-react';
import RoleSelectionModal from '../../components/RoleSelectionModal';
import Link from 'next/link';

const ADMIN_EMAILS = ['avinashgudla10@gmail.com'];

export default function Login() {
    const router = useRouter();
    const { user, loading, login, selectRole } = useAuth();

    const [formData, setFormData] = useState({ email: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showRoleSelection, setShowRoleSelection] = useState(false);
    const [error, setError] = useState('');

    // Redirect if already logged in
    useEffect(() => {
        if (!loading && user) {
            // Admin users go straight to dashboard
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
        if (formData.email && formData.password) {
            setIsLoading(true);
            const result = await login(formData.email, formData.password);

            if (result.success) {
                // Wait a moment for auth state listener to update user profile
                setTimeout(() => {
                    setIsLoading(false);
                    // Admin users go straight to dashboard
                    if (ADMIN_EMAILS.includes(formData.email)) {
                        router.replace('/admin');
                    } else {
                        router.replace('/');
                    }
                }, 1000);
            } else {
                setIsLoading(false);
                setError(result.error || 'Login failed. Please try again.');
            }
        }
    };

    const handleRoleSelect = (role) => {
        selectRole(role);
        setShowRoleSelection(false);
        router.replace('/profile-setup');
    };

    // Show nothing while checking auth
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
            {/* Decorative Elements */}
            <div style={{
                position: 'absolute',
                top: -100,
                right: -100,
                width: 300,
                height: 300,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(74, 222, 128, 0.15) 0%, transparent 70%)',
                pointerEvents: 'none'
            }} />
            <div style={{
                position: 'absolute',
                bottom: -50,
                left: -50,
                width: 200,
                height: 200,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(134, 239, 172, 0.1) 0%, transparent 70%)',
                pointerEvents: 'none'
            }} />

            {/* Floating Elements */}
            <motion.div
                animate={{ y: [0, -12, 0], rotate: [0, 5, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                style={{
                    position: 'absolute',
                    top: '18%',
                    right: '12%',
                    width: 60,
                    height: 60,
                    borderRadius: 20,
                    background: 'rgba(74, 222, 128, 0.1)',
                    border: '1px solid rgba(74, 222, 128, 0.2)',
                    zIndex: 1
                }}
            />
            <motion.div
                animate={{ y: [0, 8, 0], rotate: [0, -4, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                style={{
                    position: 'absolute',
                    top: '28%',
                    left: '8%',
                    width: 40,
                    height: 40,
                    borderRadius: 14,
                    background: 'rgba(167, 243, 208, 0.15)',
                    border: '1px solid rgba(167, 243, 208, 0.3)',
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
                    padding: '60px 32px 40px',
                    position: 'relative',
                    zIndex: 10
                }}
            >
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 32
                }}>
                    <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: 14,
                        background: 'var(--gradient-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: 'var(--shadow-glow-soft)'
                    }}>
                        <Leaf size={24} color="white" />
                    </div>
                    <span style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 24,
                        fontWeight: 800,
                        letterSpacing: '-0.5px',
                        color: 'var(--primary-hover)'
                    }}>
                        PLYSHIP
                    </span>
                </div>

                <h1 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 36,
                    fontWeight: 800,
                    lineHeight: 1.1,
                    marginBottom: 12,
                    color: 'var(--text-primary)'
                }}>
                    Welcome<br />
                    <span style={{ color: 'var(--primary-hover)' }}>back</span>
                </h1>
                <p style={{
                    color: 'var(--text-secondary)',
                    fontSize: 16,
                    lineHeight: 1.5
                }}>
                    Sign in to discover your perfect interior match
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
                    padding: '40px 28px',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    zIndex: 20,
                    boxShadow: '0 -8px 32px rgba(0,0,0,0.04)'
                }}
            >
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
                                    padding: '18px 20px 18px 52px',
                                    borderRadius: 16,
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
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '18px 52px 18px 52px',
                                    borderRadius: 16,
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
                    </div>

                    <div style={{ textAlign: 'right' }}>
                        <a href="#" style={{
                            fontSize: 14,
                            color: 'var(--primary-hover)',
                            fontWeight: 600
                        }}>
                            Forgot Password?
                        </a>
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
                                Sign In
                                <ArrowRight size={20} strokeWidth={2.5} />
                            </>
                        )}
                    </motion.button>
                </form>

                {/* Divider */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    margin: '28px 0'
                }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>or continue with</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>

                {/* Social Login */}
                <div style={{ display: 'flex', gap: 12 }}>
                    {['Google', 'Apple'].map((provider) => (
                        <motion.button
                            key={provider}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            style={{
                                flex: 1,
                                padding: '16px',
                                borderRadius: 14,
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border)',
                                color: 'var(--text-primary)',
                                fontSize: 14,
                                fontWeight: 600,
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: 8
                            }}
                        >
                            {provider}
                        </motion.button>
                    ))}
                </div>

                {/* Footer */}
                <div style={{
                    marginTop: 'auto',
                    paddingTop: 24,
                    textAlign: 'center',
                    fontSize: 15,
                    color: 'var(--text-secondary)'
                }}>
                    New to PLYSHIP?{' '}
                    <Link href="/signup" style={{
                        color: 'var(--primary-hover)',
                        fontWeight: 700
                    }}>
                        Create Account
                    </Link>
                </div>
            </motion.div>
        </div>
    );
}
