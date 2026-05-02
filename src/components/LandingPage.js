'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Users, Briefcase, Sparkles } from 'lucide-react';

// ============ SIMPLE MOBILE-FRIENDLY LANDING PAGE ============
export default function LandingPage() {
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(180deg, #0A0A0F 0%, #111827 50%, #0A0A0F 100%)',
            padding: '40px 24px',
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Background glow effects */}
            <div style={{
                position: 'absolute',
                top: '15%',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 300,
                height: 300,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(34,197,94,0.15) 0%, transparent 70%)',
                filter: 'blur(60px)',
                pointerEvents: 'none',
            }} />

            {/* Logo */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                style={{ marginBottom: 32 }}
            >
                <Image
                    src="/logo.png"
                    alt="PlyShip"
                    width={160}
                    height={42}
                    style={{ objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
                />
            </motion.div>

            {/* Tagline */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.15 }}
                style={{ textAlign: 'center', marginBottom: 40 }}
            >
                <h1 style={{
                    fontSize: 28,
                    fontWeight: 800,
                    color: 'white',
                    lineHeight: 1.2,
                    marginBottom: 12,
                }}>
                    Connect. Design.{' '}
                    <span style={{
                        background: 'linear-gradient(135deg, #22C55E 0%, #4ADE80 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}>
                        Transform.
                    </span>
                </h1>
                <p style={{
                    fontSize: 15,
                    color: 'rgba(255,255,255,0.6)',
                    lineHeight: 1.6,
                    maxWidth: 320,
                    margin: '0 auto',
                }}>
                    India's #1 platform connecting home interior seekers with interior companies
                </p>
            </motion.div>

            {/* Quick features */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                style={{
                    display: 'flex',
                    gap: 16,
                    marginBottom: 48,
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                }}
            >
                {[
                    { icon: Users, text: 'Verified Profiles' },
                    { icon: Briefcase, text: 'Easy Meetings' },
                    { icon: Sparkles, text: 'Earn Rewards' },
                ].map((item, i) => (
                    <div key={i} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 14px',
                        borderRadius: 100,
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.1)',
                    }}>
                        <item.icon size={14} color="#4ADE80" />
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                            {item.text}
                        </span>
                    </div>
                ))}
            </motion.div>

            {/* CTA Buttons */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.45 }}
                style={{
                    width: '100%',
                    maxWidth: 340,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                }}
            >
                <Link href="/signup" style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '16px 24px',
                    borderRadius: 14,
                    background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                    color: 'white',
                    textDecoration: 'none',
                    fontSize: 16,
                    fontWeight: 700,
                    boxShadow: '0 8px 30px rgba(34, 197, 94, 0.4)',
                }}>
                    Get Started <ArrowRight size={18} />
                </Link>

                <Link href="/login" style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px 24px',
                    borderRadius: 14,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: 'white',
                    textDecoration: 'none',
                    fontSize: 16,
                    fontWeight: 600,
                }}>
                    Sign In
                </Link>
            </motion.div>

            {/* Footer text */}
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                style={{
                    position: 'absolute',
                    bottom: 24,
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.3)',
                    textAlign: 'center',
                    lineHeight: 1.5,
                }}
            >
                By continuing, you agree to our{' '}
                <Link href="/terms" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'underline' }}>Terms of Service</Link>
                {' '}&{' '}
                <Link href="/privacy" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'underline' }}>Privacy Policy</Link>
            </motion.p>
        </div>
    );
}
