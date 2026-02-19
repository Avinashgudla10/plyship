'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
    ArrowRight, Check, Star, Users, Briefcase, Shield,
    Phone, MessageCircle, Mail, MapPin, ChevronDown,
    Zap, Target, Award, Handshake, Building2, Palette
} from 'lucide-react';

// ============ LANDING PAGE ============
export default function LandingPage() {
    // Add class to body for full-screen scrollable layout
    useEffect(() => {
        document.body.classList.add('landing-page-active');
        return () => {
            document.body.classList.remove('landing-page-active');
        };
    }, []);

    return (
        <div style={{ minHeight: '100vh', background: '#FAFAFA' }}>
            <Navbar />
            <HeroSection />
            <HowItWorksSection />
            <ForCompaniesSection />
            <ForSeekersSection />
            <TestimonialsSection />
            <CTASection />
            <Footer />
        </div>
    );
}

// ============ NAVBAR ============
function Navbar() {
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <>
            <nav style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 100,
                background: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(10px)',
                borderBottom: '1px solid rgba(0,0,0,0.05)',
            }}>
                <div style={{
                    maxWidth: 1200,
                    margin: '0 auto',
                    padding: '16px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    {/* Logo */}
                    <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <span style={{ color: 'white', fontSize: 20, fontWeight: 800 }}>P</span>
                        </div>
                        <span style={{ fontSize: 22, fontWeight: 800, color: '#111' }}>Plyship</span>
                    </Link>

                    {/* Desktop Nav */}
                    <div className="desktop-nav" style={{ display: 'none', alignItems: 'center', gap: 32 }}>
                        <Link href="/about" style={{ color: '#666', textDecoration: 'none', fontSize: 15, fontWeight: 500 }}>About</Link>
                        <Link href="/how-it-works" style={{ color: '#666', textDecoration: 'none', fontSize: 15, fontWeight: 500 }}>How It Works</Link>
                        <Link href="/contact" style={{ color: '#666', textDecoration: 'none', fontSize: 15, fontWeight: 500 }}>Contact</Link>
                    </div>

                    {/* Desktop CTA Buttons */}
                    <div className="desktop-nav" style={{ display: 'none', alignItems: 'center', gap: 12 }}>
                        <Link href="/login" style={{
                            padding: '10px 20px',
                            borderRadius: 10,
                            color: '#111',
                            textDecoration: 'none',
                            fontSize: 14,
                            fontWeight: 600,
                        }}>
                            Login
                        </Link>
                        <Link href="/signup" style={{
                            padding: '10px 24px',
                            borderRadius: 10,
                            background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                            color: 'white',
                            textDecoration: 'none',
                            fontSize: 14,
                            fontWeight: 600,
                            boxShadow: '0 4px 14px rgba(34, 197, 94, 0.4)',
                        }}>
                            Get Started
                        </Link>
                    </div>

                    {/* Mobile Hamburger Button */}
                    <button
                        className="mobile-menu-btn"
                        onClick={() => setMenuOpen(!menuOpen)}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 5,
                            padding: 8,
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                        }}
                    >
                        <span style={{
                            width: 24,
                            height: 2,
                            background: '#333',
                            borderRadius: 2,
                            transition: 'all 0.3s',
                            transform: menuOpen ? 'rotate(45deg) translateY(7px)' : 'none',
                        }} />
                        <span style={{
                            width: 24,
                            height: 2,
                            background: '#333',
                            borderRadius: 2,
                            transition: 'all 0.3s',
                            opacity: menuOpen ? 0 : 1,
                        }} />
                        <span style={{
                            width: 24,
                            height: 2,
                            background: '#333',
                            borderRadius: 2,
                            transition: 'all 0.3s',
                            transform: menuOpen ? 'rotate(-45deg) translateY(-7px)' : 'none',
                        }} />
                    </button>
                </div>
            </nav>

            {/* Mobile Menu Overlay */}
            {menuOpen && (
                <div
                    style={{
                        position: 'fixed',
                        top: 72,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(255,255,255,0.98)',
                        backdropFilter: 'blur(10px)',
                        zIndex: 99,
                        padding: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 16,
                    }}
                    className="mobile-menu"
                >
                    <Link
                        href="/about"
                        onClick={() => setMenuOpen(false)}
                        style={{
                            padding: '16px 20px',
                            borderRadius: 12,
                            background: '#F9FAFB',
                            color: '#333',
                            textDecoration: 'none',
                            fontSize: 16,
                            fontWeight: 600,
                        }}
                    >
                        About
                    </Link>
                    <Link
                        href="/how-it-works"
                        onClick={() => setMenuOpen(false)}
                        style={{
                            padding: '16px 20px',
                            borderRadius: 12,
                            background: '#F9FAFB',
                            color: '#333',
                            textDecoration: 'none',
                            fontSize: 16,
                            fontWeight: 600,
                        }}
                    >
                        How It Works
                    </Link>
                    <Link
                        href="/contact"
                        onClick={() => setMenuOpen(false)}
                        style={{
                            padding: '16px 20px',
                            borderRadius: 12,
                            background: '#F9FAFB',
                            color: '#333',
                            textDecoration: 'none',
                            fontSize: 16,
                            fontWeight: 600,
                        }}
                    >
                        Contact
                    </Link>
                    <div style={{ borderTop: '1px solid #E5E7EB', margin: '8px 0' }} />
                    <Link
                        href="/login"
                        onClick={() => setMenuOpen(false)}
                        style={{
                            padding: '16px 20px',
                            borderRadius: 12,
                            background: 'white',
                            border: '1px solid #E5E7EB',
                            color: '#333',
                            textDecoration: 'none',
                            fontSize: 16,
                            fontWeight: 600,
                            textAlign: 'center',
                        }}
                    >
                        Login
                    </Link>
                    <Link
                        href="/signup"
                        onClick={() => setMenuOpen(false)}
                        style={{
                            padding: '16px 20px',
                            borderRadius: 12,
                            background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                            color: 'white',
                            textDecoration: 'none',
                            fontSize: 16,
                            fontWeight: 600,
                            textAlign: 'center',
                        }}
                    >
                        Get Started
                    </Link>
                </div>
            )}

            {/* CSS for responsive nav */}
            <style jsx global>{`
                .desktop-nav {
                    display: none !important;
                }
                .mobile-menu-btn {
                    display: flex !important;
                }
                @media (min-width: 768px) {
                    .desktop-nav {
                        display: flex !important;
                    }
                    .mobile-menu-btn {
                        display: none !important;
                    }
                    .mobile-menu {
                        display: none !important;
                    }
                }
            `}</style>
        </>
    );
}

// ============ HERO SECTION ============
function HeroSection() {
    return (
        <section style={{
            paddingTop: 140,
            paddingBottom: 80,
            background: 'linear-gradient(180deg, #F0FDF4 0%, #FAFAFA 100%)',
        }}>
            <div style={{
                maxWidth: 1200,
                margin: '0 auto',
                padding: '0 24px',
                textAlign: 'center',
            }}>
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    {/* Badge */}
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 16px',
                        borderRadius: 100,
                        background: 'rgba(34, 197, 94, 0.1)',
                        marginBottom: 24,
                    }}>
                        <Zap size={16} color="#22C55E" />
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#16A34A' }}>
                            India's #1 Interior Design Marketplace
                        </span>
                    </div>

                    {/* Headline */}
                    <h1 style={{
                        fontSize: 'clamp(36px, 6vw, 64px)',
                        fontWeight: 800,
                        lineHeight: 1.1,
                        color: '#111',
                        marginBottom: 20,
                    }}>
                        Connect Home Interior Companies
                        <br />
                        <span style={{
                            background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}>
                            with Interior Seekers
                        </span>
                    </h1>

                    {/* Subheadline */}
                    <p style={{
                        fontSize: 'clamp(16px, 2vw, 20px)',
                        color: '#666',
                        maxWidth: 600,
                        margin: '0 auto 32px',
                        lineHeight: 1.6,
                    }}>
                        Plyship bridges the gap between home interior companies seeking clients
                        and interior seekers looking for dream home designs. Swipe, match, and transform spaces together.
                    </p>

                    {/* CTA Buttons */}
                    <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <Link href="/signup" style={{
                            padding: '16px 32px',
                            borderRadius: 14,
                            background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                            color: 'white',
                            textDecoration: 'none',
                            fontSize: 16,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            boxShadow: '0 8px 24px rgba(34, 197, 94, 0.4)',
                        }}>
                            Start Free <ArrowRight size={18} />
                        </Link>
                        <Link href="/how-it-works" style={{
                            padding: '16px 32px',
                            borderRadius: 14,
                            background: 'white',
                            color: '#111',
                            textDecoration: 'none',
                            fontSize: 16,
                            fontWeight: 600,
                            border: '1px solid #E5E7EB',
                        }}>
                            Learn More
                        </Link>
                    </div>

                    {/* Stats */}
                    <div style={{
                        display: 'flex',
                        gap: 48,
                        justifyContent: 'center',
                        marginTop: 60,
                        flexWrap: 'wrap',
                    }}>
                        <StatItem value="500+" label="Interior Seekers" />
                        <StatItem value="200+" label="Interior Companies" />
                        <StatItem value="1000+" label="Successful Connections" />
                    </div>
                </motion.div>
            </div>
        </section>
    );
}

function StatItem({ value, label }) {
    return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#22C55E' }}>{value}</div>
            <div style={{ fontSize: 14, color: '#666' }}>{label}</div>
        </div>
    );
}

// ============ HOW IT WORKS ============
function HowItWorksSection() {
    const steps = [
        { icon: Users, title: 'Create Profile', desc: 'Sign up as a Company or Designer. Build your portfolio and showcase your expertise.' },
        { icon: Target, title: 'Swipe & Match', desc: 'Browse profiles and swipe right to connect. When both parties match, the magic begins.' },
        { icon: Handshake, title: 'Meet & Collaborate', desc: 'Schedule meetings, discuss projects, and start working together on amazing interiors.' },
    ];

    return (
        <section style={{ padding: '80px 24px', background: 'white' }}>
            <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    style={{ textAlign: 'center', marginBottom: 48 }}
                >
                    <h2 style={{ fontSize: 36, fontWeight: 800, color: '#111', marginBottom: 16 }}>
                        How Plyship Works
                    </h2>
                    <p style={{ fontSize: 18, color: '#666', maxWidth: 500, margin: '0 auto' }}>
                        Three simple steps to find your perfect match
                    </p>
                </motion.div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 32 }}>
                    {steps.map((step, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                            style={{
                                padding: 32,
                                borderRadius: 20,
                                background: '#F9FAFB',
                                textAlign: 'center',
                            }}
                        >
                            <div style={{
                                width: 64,
                                height: 64,
                                borderRadius: 16,
                                background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 20px',
                            }}>
                                <step.icon size={28} color="white" />
                            </div>
                            <div style={{
                                width: 28,
                                height: 28,
                                borderRadius: 100,
                                background: '#E5E7EB',
                                color: '#666',
                                fontSize: 14,
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 16px',
                            }}>
                                {i + 1}
                            </div>
                            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 10 }}>
                                {step.title}
                            </h3>
                            <p style={{ fontSize: 15, color: '#666', lineHeight: 1.6 }}>
                                {step.desc}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ============ FOR COMPANIES ============
function ForCompaniesSection() {
    const benefits = [
        'Connect with verified interior seekers',
        'Schedule consultations directly in-app',
        'Pay ₹500 per consultation to meet clients',
        'Grow your client base effortlessly',
    ];

    return (
        <section style={{ padding: '80px 24px', background: '#F0FDF4' }}>
            <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 48, alignItems: 'center' }}>
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                    >
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '8px 16px',
                            borderRadius: 100,
                            background: 'rgba(34, 197, 94, 0.2)',
                            marginBottom: 16,
                        }}>
                            <Building2 size={16} color="#16A34A" />
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#16A34A' }}>For Interior Companies</span>
                        </div>
                        <h2 style={{ fontSize: 36, fontWeight: 800, color: '#111', marginBottom: 16 }}>
                            Find Your Next Clients
                        </h2>
                        <p style={{ fontSize: 17, color: '#666', marginBottom: 24, lineHeight: 1.6 }}>
                            Stop waiting for clients to find you. Connect with interior seekers actively looking for home renovation services. Match, meet, and grow your business.
                        </p>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {benefits.map((b, i) => (
                                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                    <Check size={18} color="#22C55E" />
                                    <span style={{ fontSize: 15, color: '#444' }}>{b}</span>
                                </li>
                            ))}
                        </ul>
                        <Link href="/signup" style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            marginTop: 24,
                            padding: '14px 28px',
                            borderRadius: 12,
                            background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                            color: 'white',
                            textDecoration: 'none',
                            fontSize: 15,
                            fontWeight: 600,
                        }}>
                            Join as Company <ArrowRight size={18} />
                        </Link>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        style={{
                            padding: 32,
                            borderRadius: 24,
                            background: 'white',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.1)',
                        }}
                    >
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 48, fontWeight: 800, color: '#22C55E', marginBottom: 8 }}>₹500</div>
                            <div style={{ fontSize: 16, color: '#666', marginBottom: 24 }}>per consultation</div>
                            <div style={{ padding: 16, background: '#F9FAFB', borderRadius: 12, marginBottom: 16 }}>
                                <div style={{ fontSize: 14, color: '#666' }}>Pay only when you meet</div>
                            </div>
                            <div style={{ padding: 16, background: '#F9FAFB', borderRadius: 12, marginBottom: 16 }}>
                                <div style={{ fontSize: 14, color: '#666' }}>No subscription fees</div>
                            </div>
                            <div style={{ padding: 16, background: '#F9FAFB', borderRadius: 12 }}>
                                <div style={{ fontSize: 14, color: '#666' }}>Convert meetings into projects</div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

// ============ FOR INTERIOR SEEKERS ============
function ForSeekersSection() {
    const benefits = [
        'Find verified interior companies',
        'Get personalized design solutions',
        'Earn ₹250 for every consultation',
        'Transform your dream home into reality',
    ];

    return (
        <section style={{ padding: '80px 24px', background: 'white' }}>
            <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 48, alignItems: 'center' }}>
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                    >
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '8px 16px',
                            borderRadius: 100,
                            background: 'rgba(34, 197, 94, 0.1)',
                            marginBottom: 16,
                        }}>
                            <Palette size={16} color="#16A34A" />
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#16A34A' }}>For Interior Seekers</span>
                        </div>
                        <h2 style={{ fontSize: 36, fontWeight: 800, color: '#111', marginBottom: 16 }}>
                            Find Your Perfect Interior Partner
                        </h2>
                        <p style={{ fontSize: 17, color: '#666', marginBottom: 24, lineHeight: 1.6 }}>
                            Looking to renovate your home? Match with interior companies that understand your vision and budget.
                        </p>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {benefits.map((b, i) => (
                                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                    <Check size={18} color="#22C55E" />
                                    <span style={{ fontSize: 15, color: '#444' }}>{b}</span>
                                </li>
                            ))}
                        </ul>
                        <Link href="/signup" style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            marginTop: 24,
                            padding: '14px 28px',
                            borderRadius: 12,
                            background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                            color: 'white',
                            textDecoration: 'none',
                            fontSize: 15,
                            fontWeight: 600,
                        }}>
                            Join as Seeker <ArrowRight size={18} />
                        </Link>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        style={{
                            padding: 32,
                            borderRadius: 24,
                            background: 'white',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.1)',
                        }}
                    >
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 48, fontWeight: 800, color: '#22C55E', marginBottom: 8 }}>₹250</div>
                            <div style={{ fontSize: 16, color: '#666', marginBottom: 24 }}>earned per meeting</div>
                            <div style={{ padding: 16, background: '#F9FAFB', borderRadius: 12, marginBottom: 16 }}>
                                <div style={{ fontSize: 14, color: '#666' }}>Meeting interior companies</div>
                            </div>
                            <div style={{ padding: 16, background: '#F9FAFB', borderRadius: 12, marginBottom: 16 }}>
                                <div style={{ fontSize: 14, color: '#666' }}>No hidden charges</div>
                            </div>
                            <div style={{ padding: 16, background: '#F9FAFB', borderRadius: 12 }}>
                                <div style={{ fontSize: 14, color: '#666' }}>Earn while finding your dream home</div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

// ============ TESTIMONIALS ============
function TestimonialsSection() {
    const testimonials = [
        {
            name: 'Priya Sharma',
            role: 'Homeowner, Mumbai',
            quote: "Found my dream interior company through Plyship! The matching process was so simple and I loved being able to compare options easily.",
            avatar: '👩',
        },
        {
            name: 'Rajesh Kumar',
            role: 'CEO, DesignHouse Interiors',
            quote: 'Plyship has been a game-changer for our business. We now get connected with clients who are genuinely interested in our services.',
            avatar: '👨‍💼',
        },
        {
            name: 'Anita Patel',
            role: 'Interior Seeker, Bangalore',
            quote: 'I was nervous about renovating my home, but Plyship matched me with the perfect company. The whole experience was seamless!',
            avatar: '👩‍💻',
        },
    ];

    return (
        <section style={{ padding: '80px 24px', background: '#F9FAFB' }}>
            <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    style={{ textAlign: 'center', marginBottom: 48 }}
                >
                    <h2 style={{ fontSize: 36, fontWeight: 800, color: '#111', marginBottom: 16 }}>
                        Loved by Thousands
                    </h2>
                    <p style={{ fontSize: 18, color: '#666' }}>
                        See what our community says about Plyship
                    </p>
                </motion.div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
                    {testimonials.map((t, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                            style={{
                                padding: 28,
                                borderRadius: 20,
                                background: 'white',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                            }}
                        >
                            <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
                                {[1, 2, 3, 4, 5].map(s => <Star key={s} size={16} fill="#FBBF24" color="#FBBF24" />)}
                            </div>
                            <p style={{ fontSize: 15, color: '#444', lineHeight: 1.7, marginBottom: 20 }}>
                                "{t.quote}"
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ fontSize: 32 }}>{t.avatar}</div>
                                <div>
                                    <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>{t.name}</div>
                                    <div style={{ fontSize: 13, color: '#666' }}>{t.role}</div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ============ CTA SECTION ============
function CTASection() {
    return (
        <section style={{ padding: '80px 24px', background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)' }}>
            <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                >
                    <h2 style={{ fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 800, color: 'white', marginBottom: 16 }}>
                        Ready to Transform Your Business?
                    </h2>
                    <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.9)', marginBottom: 32 }}>
                        Join thousands of companies and designers already growing with Plyship.
                    </p>
                    <Link href="/signup" style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '18px 36px',
                        borderRadius: 14,
                        background: 'white',
                        color: '#16A34A',
                        textDecoration: 'none',
                        fontSize: 17,
                        fontWeight: 700,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    }}>
                        Get Started Free <ArrowRight size={20} />
                    </Link>
                </motion.div>
            </div>
        </section>
    );
}

// ============ FOOTER ============
function Footer() {
    return (
        <footer style={{ padding: '60px 24px 32px', background: '#111' }}>
            <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 40, marginBottom: 40 }}>
                    {/* Brand */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                            <div style={{
                                width: 36,
                                height: 36,
                                borderRadius: 10,
                                background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}>
                                <span style={{ color: 'white', fontSize: 18, fontWeight: 800 }}>P</span>
                            </div>
                            <span style={{ fontSize: 20, fontWeight: 800, color: 'white' }}>Plyship</span>
                        </div>
                        <p style={{ fontSize: 14, color: '#888', lineHeight: 1.6 }}>
                            Connecting interior companies with talented designers across India.
                        </p>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4 style={{ fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 16 }}>Quick Links</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <Link href="/about" style={{ fontSize: 14, color: '#888', textDecoration: 'none' }}>About Us</Link>
                            <Link href="/how-it-works" style={{ fontSize: 14, color: '#888', textDecoration: 'none' }}>How It Works</Link>
                            <Link href="/contact" style={{ fontSize: 14, color: '#888', textDecoration: 'none' }}>Contact</Link>
                        </div>
                    </div>

                    {/* Legal */}
                    <div>
                        <h4 style={{ fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 16 }}>Legal</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <Link href="/privacy" style={{ fontSize: 14, color: '#888', textDecoration: 'none' }}>Privacy Policy</Link>
                            <Link href="/terms" style={{ fontSize: 14, color: '#888', textDecoration: 'none' }}>Terms of Service</Link>
                        </div>
                    </div>

                    {/* Contact */}
                    <div>
                        <h4 style={{ fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 16 }}>Contact Us</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <a
                                href="tel:+918465834152"
                                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#888', textDecoration: 'none' }}
                            >
                                <Phone size={16} /> +91 8465834152
                            </a>
                            <a
                                href="https://wa.me/918465834152"
                                target="_blank"
                                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#888', textDecoration: 'none' }}
                            >
                                <MessageCircle size={16} /> WhatsApp
                            </a>
                        </div>
                    </div>
                </div>

                {/* Bottom */}
                <div style={{
                    paddingTop: 24,
                    borderTop: '1px solid #333',
                    textAlign: 'center',
                    color: '#666',
                    fontSize: 13,
                }}>
                    © {new Date().getFullYear()} Plyship. All rights reserved.
                </div>
            </div>
        </footer>
    );
}
