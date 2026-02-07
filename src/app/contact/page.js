'use client';

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, Phone, MessageCircle, Mail, MapPin, Clock } from 'lucide-react';

export default function ContactPage() {
    useEffect(() => {
        document.body.classList.add('landing-page-active');
        return () => {
            document.body.classList.remove('landing-page-active');
        };
    }, []);

    const handleWhatsApp = () => {
        window.open('https://wa.me/918465834152?text=Hi, I have a question about Plyship', '_blank');
    };

    const handleCall = () => {
        window.location.href = 'tel:+918465834152';
    };

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
                    style={{ maxWidth: 600, margin: '0 auto' }}
                >
                    <h1 style={{ fontSize: 42, fontWeight: 800, color: '#111', marginBottom: 16 }}>Contact Us</h1>
                    <p style={{ fontSize: 18, color: '#666', lineHeight: 1.7 }}>
                        Have questions? We'd love to hear from you. Reach out via WhatsApp or call us directly.
                    </p>
                </motion.div>
            </section>

            {/* Contact Options */}
            <section style={{ padding: '60px 24px' }}>
                <div style={{ maxWidth: 800, margin: '0 auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
                        {/* WhatsApp */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            onClick={handleWhatsApp}
                            style={{
                                padding: 32,
                                borderRadius: 20,
                                background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                                color: 'white',
                                textAlign: 'center',
                                cursor: 'pointer',
                            }}
                        >
                            <MessageCircle size={48} style={{ marginBottom: 16 }} />
                            <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>WhatsApp</h3>
                            <p style={{ fontSize: 15, opacity: 0.9, marginBottom: 16 }}>
                                Quick responses, chat with us anytime
                            </p>
                            <div style={{
                                padding: '12px 24px',
                                borderRadius: 10,
                                background: 'rgba(255,255,255,0.2)',
                                fontSize: 16,
                                fontWeight: 600,
                            }}>
                                +91 8465834152
                            </div>
                        </motion.div>

                        {/* Phone */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            onClick={handleCall}
                            style={{
                                padding: 32,
                                borderRadius: 20,
                                background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                                color: 'white',
                                textAlign: 'center',
                                cursor: 'pointer',
                            }}
                        >
                            <Phone size={48} style={{ marginBottom: 16 }} />
                            <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Call Us</h3>
                            <p style={{ fontSize: 15, opacity: 0.9, marginBottom: 16 }}>
                                Speak directly with our team
                            </p>
                            <div style={{
                                padding: '12px 24px',
                                borderRadius: 10,
                                background: 'rgba(255,255,255,0.2)',
                                fontSize: 16,
                                fontWeight: 600,
                            }}>
                                +91 8465834152
                            </div>
                        </motion.div>
                    </div>

                    {/* Business Hours */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        style={{
                            marginTop: 32,
                            padding: 24,
                            borderRadius: 16,
                            background: 'white',
                            border: '1px solid #E5E7EB',
                            textAlign: 'center',
                        }}
                    >
                        <Clock size={24} color="#22C55E" style={{ marginBottom: 12 }} />
                        <h3 style={{ fontSize: 18, fontWeight: 600, color: '#111', marginBottom: 8 }}>Business Hours</h3>
                        <p style={{ fontSize: 15, color: '#666' }}>
                            Monday - Saturday: 9:00 AM - 7:00 PM IST
                        </p>
                        <p style={{ fontSize: 14, color: '#888', marginTop: 8 }}>
                            We typically respond within 2 hours during business hours
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* FAQ Link */}
            <section style={{ padding: '40px 24px', textAlign: 'center' }}>
                <p style={{ fontSize: 15, color: '#666' }}>
                    Looking for quick answers?{' '}
                    <Link href="/how-it-works" style={{ color: '#22C55E', textDecoration: 'none', fontWeight: 600 }}>
                        Check How It Works →
                    </Link>
                </p>
            </section>
        </div>
    );
}
