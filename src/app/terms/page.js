'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
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
                    <h1 style={{ fontSize: 36, fontWeight: 800, color: '#111', marginBottom: 8 }}>Terms of Service</h1>
                    <p style={{ fontSize: 14, color: '#888', marginBottom: 32 }}>Last updated: February 2026</p>

                    <div style={{ fontSize: 15, color: '#555', lineHeight: 1.8 }}>
                        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111', marginTop: 32, marginBottom: 12 }}>1. Acceptance of Terms</h2>
                        <p>By accessing or using Plyship, you agree to be bound by these Terms of Service. If you do not agree, please do not use our services.</p>

                        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111', marginTop: 32, marginBottom: 12 }}>2. Description of Service</h2>
                        <p>Plyship is a platform that connects interior design companies with interior designers. We facilitate:</p>
                        <ul style={{ marginLeft: 20, marginTop: 8 }}>
                            <li>Profile creation and matching</li>
                            <li>In-app messaging and communication</li>
                            <li>Meeting scheduling and coordination</li>
                            <li>Payment processing for meeting fees</li>
                        </ul>

                        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111', marginTop: 32, marginBottom: 12 }}>3. User Accounts</h2>
                        <p>You must provide accurate information when creating an account. You are responsible for maintaining the security of your account and all activities that occur under it.</p>

                        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111', marginTop: 32, marginBottom: 12 }}>4. Payment Terms</h2>
                        <ul style={{ marginLeft: 20, marginTop: 8 }}>
                            <li>Companies pay ₹500 per confirmed meeting with a designer</li>
                            <li>Designers receive ₹500 for each confirmed meeting</li>
                            <li>Payments are processed through Razorpay</li>
                            <li>Withdrawals are processed within 3-5 business days</li>
                        </ul>

                        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111', marginTop: 32, marginBottom: 12 }}>5. User Conduct</h2>
                        <p>You agree not to:</p>
                        <ul style={{ marginLeft: 20, marginTop: 8 }}>
                            <li>Provide false or misleading information</li>
                            <li>Harass, abuse, or harm other users</li>
                            <li>Use the platform for any illegal purpose</li>
                            <li>Attempt to circumvent the payment system</li>
                            <li>Share your account credentials with others</li>
                        </ul>

                        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111', marginTop: 32, marginBottom: 12 }}>6. Intellectual Property</h2>
                        <p>Users retain rights to their portfolio content. By uploading, you grant Plyship a license to display this content on the platform.</p>

                        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111', marginTop: 32, marginBottom: 12 }}>7. Limitation of Liability</h2>
                        <p>Plyship is a platform that facilitates connections. We are not responsible for the quality of work, disputes between users, or any agreements made outside the platform.</p>

                        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111', marginTop: 32, marginBottom: 12 }}>8. Account Termination</h2>
                        <p>We reserve the right to suspend or terminate accounts that violate these terms. You may delete your account at any time from the Settings page.</p>

                        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111', marginTop: 32, marginBottom: 12 }}>9. Changes to Terms</h2>
                        <p>We may update these terms from time to time. Continued use of the platform after changes constitutes acceptance of the new terms.</p>

                        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111', marginTop: 32, marginBottom: 12 }}>10. Contact</h2>
                        <p>For questions about these Terms, contact us:</p>
                        <ul style={{ marginLeft: 20, marginTop: 8 }}>
                            <li>Phone/WhatsApp: +91 8465834152</li>
                        </ul>
                    </div>
                </div>
            </section>
        </div>
    );
}
