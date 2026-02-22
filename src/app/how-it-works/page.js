'use client';

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Users, Heart, Calendar, MessageCircle, Wallet, CheckCircle, Building2, Palette } from 'lucide-react';

export default function HowItWorksPage() {
    useEffect(() => {
        document.body.classList.add('landing-page-active');
        return () => {
            document.body.classList.remove('landing-page-active');
        };
    }, []);

    return (
        <div style={{ minHeight: '100vh', background: '#FAFAFA' }}>
            {/* Header */}
            <header style={{
                padding: '16px 24px',
                background: 'white',
                borderBottom: '1px solid #E5E7EB',
                position: 'sticky',
                top: 0,
                zIndex: 50,
            }}>
                <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16 }}>
                    <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#666', textDecoration: 'none' }}>
                        <ArrowLeft size={20} />
                        <span>Back</span>
                    </Link>
                </div>
            </header>

            {/* Hero */}
            <section style={{ padding: '60px 24px', background: 'linear-gradient(180deg, #F0FDF4, #FAFAFA)', textAlign: 'center' }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ maxWidth: 700, margin: '0 auto' }}
                >
                    <h1 style={{ fontSize: 42, fontWeight: 800, color: '#111', marginBottom: 16 }}>How Plyship Works</h1>
                    <p style={{ fontSize: 18, color: '#666', lineHeight: 1.7 }}>
                        A simple, transparent process to connect interior seekers with companies
                    </p>
                </motion.div>
            </section>

            {/* For Companies */}
            <section style={{ padding: '60px 24px', background: 'white' }}>
                <div style={{ maxWidth: 900, margin: '0 auto' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
                        <Building2 size={24} color="#22C55E" />
                        <h2 style={{ fontSize: 28, fontWeight: 700, color: '#111' }}>For Interior Companies</h2>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        {[
                            { step: 1, icon: Users, title: 'Create Your Company Profile', desc: "Sign up and tell us about your company, the services you offer, and the type of interior projects you handle." },
                            { step: 2, icon: Heart, title: 'Browse & Match with Seekers', desc: "Swipe through seeker profiles. When you like someone, swipe right. If they like you back, it's a match!" },
                            { step: 3, icon: MessageCircle, title: 'Chat & Schedule Meetings', desc: 'Start a conversation with your matches. Schedule meetings directly in the app to discuss projects.' },
                            { step: 4, icon: Wallet, title: 'Pay Per Meeting (₹500)', desc: 'Add funds to your wallet. ₹500 is automatically deducted when both parties confirm a meeting took place.' },
                            { step: 5, icon: CheckCircle, title: 'Start Your Project', desc: 'Found the right client? Start working together on their home interior project!' },
                        ].map((item, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                style={{
                                    display: 'flex',
                                    gap: 20,
                                    padding: 24,
                                    borderRadius: 16,
                                    background: '#F9FAFB',
                                    alignItems: 'flex-start',
                                }}
                            >
                                <div style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: 12,
                                    background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}>
                                    <item.icon size={24} color="white" />
                                </div>
                                <div>
                                    <div style={{ fontSize: 12, color: '#22C55E', fontWeight: 600, marginBottom: 4 }}>STEP {item.step}</div>
                                    <h3 style={{ fontSize: 18, fontWeight: 600, color: '#111', marginBottom: 8 }}>{item.title}</h3>
                                    <p style={{ fontSize: 15, color: '#666', lineHeight: 1.6 }}>{item.desc}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* For Seekers */}
            <section style={{ padding: '60px 24px', background: '#F9FAFB' }}>
                <div style={{ maxWidth: 900, margin: '0 auto' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
                        <Palette size={24} color="#22C55E" />
                        <h2 style={{ fontSize: 28, fontWeight: 700, color: '#111' }}>For Interior Seekers</h2>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        {[
                            { step: 1, icon: Users, title: 'Create Your Profile', desc: 'Sign up and tell us about your home interior needs, preferred styles, budget, and location.' },
                            { step: 2, icon: Heart, title: 'Get Discovered by Companies', desc: 'Companies browse seeker profiles. When you both like each other, you match and can start chatting.' },
                            { step: 3, icon: Calendar, title: 'Attend Meetings', desc: 'Schedule and attend meetings with companies. Discuss your project requirements and get proposals.' },
                            { step: 4, icon: Wallet, title: 'Earn ₹250 Per Meeting', desc: 'For every confirmed meeting, you earn ₹250. Money is added to your wallet automatically.' },
                            { step: 5, icon: CheckCircle, title: 'Withdraw Your Earnings', desc: 'Once you have ₹250+, withdraw to your bank account anytime via WhatsApp request.' },
                        ].map((item, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                style={{
                                    display: 'flex',
                                    gap: 20,
                                    padding: 24,
                                    borderRadius: 16,
                                    background: 'white',
                                    alignItems: 'flex-start',
                                }}
                            >
                                <div style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: 12,
                                    background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}>
                                    <item.icon size={24} color="white" />
                                </div>
                                <div>
                                    <div style={{ fontSize: 12, color: '#22C55E', fontWeight: 600, marginBottom: 4 }}>STEP {item.step}</div>
                                    <h3 style={{ fontSize: 18, fontWeight: 600, color: '#111', marginBottom: 8 }}>{item.title}</h3>
                                    <p style={{ fontSize: 15, color: '#666', lineHeight: 1.6 }}>{item.desc}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section style={{ padding: '60px 24px', background: 'linear-gradient(135deg, #22C55E, #16A34A)', textAlign: 'center' }}>
                <div style={{ maxWidth: 600, margin: '0 auto' }}>
                    <h2 style={{ fontSize: 32, fontWeight: 800, color: 'white', marginBottom: 16 }}>Ready to Get Started?</h2>
                    <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.9)', marginBottom: 24 }}>
                        Join thousands of companies and interior seekers already on Plyship
                    </p>
                    <Link href="/signup" style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '16px 32px',
                        borderRadius: 12,
                        background: 'white',
                        color: '#16A34A',
                        textDecoration: 'none',
                        fontSize: 16,
                        fontWeight: 700,
                    }}>
                        Create Free Account <ArrowRight size={18} />
                    </Link>
                </div>
            </section>
        </div>
    );
}
