'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
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

            {/* Content */}
            <section style={{ padding: '60px 24px' }}>
                <div style={{ maxWidth: 800, margin: '0 auto', background: 'white', borderRadius: 16, padding: 40, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                    <h1 style={{ fontSize: 36, fontWeight: 800, color: '#111', marginBottom: 8 }}>Privacy Policy</h1>
                    <p style={{ fontSize: 14, color: '#888', marginBottom: 32 }}>Last updated: February 2026</p>

                    <div style={{ fontSize: 15, color: '#555', lineHeight: 1.8 }}>
                        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111', marginTop: 32, marginBottom: 12 }}>1. Information We Collect</h2>
                        <p>We collect information you provide directly to us, such as:</p>
                        <ul style={{ marginLeft: 20, marginTop: 8 }}>
                            <li>Account information (name, email, phone number)</li>
                            <li>Profile information (portfolio images, bio, skills)</li>
                            <li>Transaction and payment information</li>
                            <li>Communications and messages within the platform</li>
                        </ul>

                        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111', marginTop: 32, marginBottom: 12 }}>2. How We Use Your Information</h2>
                        <p>We use the information we collect to:</p>
                        <ul style={{ marginLeft: 20, marginTop: 8 }}>
                            <li>Provide, maintain, and improve our services</li>
                            <li>Match companies with designers based on preferences</li>
                            <li>Process transactions and send related information</li>
                            <li>Send technical notices and support messages</li>
                            <li>Respond to your comments and questions</li>
                        </ul>

                        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111', marginTop: 32, marginBottom: 12 }}>3. Information Sharing</h2>
                        <p>We do not sell your personal information. We may share your information:</p>
                        <ul style={{ marginLeft: 20, marginTop: 8 }}>
                            <li>With other users as part of the matching process</li>
                            <li>With service providers who assist in our operations</li>
                            <li>When required by law or to protect our rights</li>
                        </ul>

                        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111', marginTop: 32, marginBottom: 12 }}>4. Data Security</h2>
                        <p>We implement appropriate security measures to protect your personal information. However, no method of transmission over the Internet is 100% secure.</p>

                        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111', marginTop: 32, marginBottom: 12 }}>5. Your Rights</h2>
                        <p>You have the right to:</p>
                        <ul style={{ marginLeft: 20, marginTop: 8 }}>
                            <li>Access and update your personal information</li>
                            <li>Delete your account and associated data</li>
                            <li>Opt out of marketing communications</li>
                        </ul>

                        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111', marginTop: 32, marginBottom: 12 }}>6. Contact Us</h2>
                        <p>If you have any questions about this Privacy Policy, please contact us:</p>
                        <ul style={{ marginLeft: 20, marginTop: 8 }}>
                            <li>Phone/WhatsApp: +91 8465834152</li>
                        </ul>
                    </div>
                </div>
            </section>
        </div>
    );
}
