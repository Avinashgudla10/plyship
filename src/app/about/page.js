'use client';

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, Users, Target, Award, Heart, Briefcase, MapPin } from 'lucide-react';

export default function AboutPage() {
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
                    style={{ maxWidth: 800, margin: '0 auto' }}
                >
                    <h1 style={{ fontSize: 42, fontWeight: 800, color: '#111', marginBottom: 16 }}>About Plyship</h1>
                    <p style={{ fontSize: 18, color: '#666', lineHeight: 1.7 }}>
                        We're building the future of home interior collaboration in India
                    </p>
                </motion.div>
            </section>

            {/* Story */}
            <section style={{ padding: '60px 24px', background: 'white' }}>
                <div style={{ maxWidth: 800, margin: '0 auto' }}>
                    <h2 style={{ fontSize: 28, fontWeight: 700, color: '#111', marginBottom: 20 }}>Our Story</h2>
                    <p style={{ fontSize: 16, color: '#555', lineHeight: 1.8, marginBottom: 16 }}>
                        Plyship was born from a simple observation: people looking for home interiors struggle to find reliable companies,
                        while interior companies struggle to find quality leads. Traditional discovery is slow, expensive, and often frustrating for both sides.
                    </p>
                    <p style={{ fontSize: 16, color: '#555', lineHeight: 1.8, marginBottom: 16 }}>
                        We created Plyship to solve this problem. Our platform uses a simple swipe-to-match system
                        (inspired by dating apps) to connect home interior seekers with companies instantly. When both parties like each other,
                        a match is made, and collaboration begins.
                    </p>
                    <p style={{ fontSize: 16, color: '#555', lineHeight: 1.8 }}>
                        Our unique ₹500-per-meeting model ensures seekers are compensated for their time,
                        while companies only pay when they actually meet with potential clients. It's a win-win.
                    </p>
                </div>
            </section>

            {/* Values */}
            <section style={{ padding: '60px 24px', background: '#F9FAFB' }}>
                <div style={{ maxWidth: 1000, margin: '0 auto' }}>
                    <h2 style={{ fontSize: 28, fontWeight: 700, color: '#111', marginBottom: 40, textAlign: 'center' }}>Our Values</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 24 }}>
                        {[
                            { icon: Users, title: 'Community First', desc: 'We build for our community of seekers and companies.' },
                            { icon: Target, title: 'Simplicity', desc: 'Complex problems deserve simple, elegant solutions.' },
                            { icon: Award, title: 'Quality', desc: 'We maintain high standards for everyone on our platform.' },
                            { icon: Heart, title: 'Fairness', desc: 'Everyone deserves fair compensation for their work.' },
                        ].map((v, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                style={{
                                    padding: 24,
                                    borderRadius: 16,
                                    background: 'white',
                                    border: '1px solid #E5E7EB',
                                }}
                            >
                                <v.icon size={28} color="#22C55E" style={{ marginBottom: 12 }} />
                                <h3 style={{ fontSize: 18, fontWeight: 600, color: '#111', marginBottom: 8 }}>{v.title}</h3>
                                <p style={{ fontSize: 14, color: '#666', lineHeight: 1.6 }}>{v.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section style={{ padding: '60px 24px', textAlign: 'center' }}>
                <Link href="/signup" style={{
                    display: 'inline-flex',
                    padding: '16px 32px',
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                    color: 'white',
                    textDecoration: 'none',
                    fontSize: 16,
                    fontWeight: 600,
                }}>
                    Join Plyship Today
                </Link>
            </section>
        </div>
    );
}
