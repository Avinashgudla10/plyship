'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';

export default function TermsPage() {
    useEffect(() => {
        document.body.classList.add('landing-page-active');
        return () => {
            document.body.classList.remove('landing-page-active');
        };
    }, []);

    const sectionStyle = { fontSize: 20, fontWeight: 700, color: '#111', marginTop: 32, marginBottom: 12 };

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
                <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#666', textDecoration: 'none' }}>
                        <ArrowLeft size={20} />
                        <span>Back</span>
                    </Link>
                    <Link href="/privacy" style={{ fontSize: 14, fontWeight: 600, color: '#16A34A', textDecoration: 'none' }}>
                        Privacy Policy →
                    </Link>
                </div>
            </header>

            {/* Content */}
            <section style={{ padding: '40px 24px 80px' }}>
                <div style={{ maxWidth: 800, margin: '0 auto', background: 'white', borderRadius: 16, padding: '32px 28px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <FileText size={28} color="#22C55E" />
                        <h1 style={{ fontSize: 32, fontWeight: 800, color: '#111' }}>Terms of Service</h1>
                    </div>
                    <p style={{ fontSize: 14, color: '#888', marginBottom: 8 }}>Last Updated: March 13, 2026</p>
                    <p style={{ fontSize: 15, color: '#555', lineHeight: 1.8, marginBottom: 24 }}>
                        Welcome to <strong>Plyship</strong>. These Terms of Service govern your use of the Plyship website and mobile application (collectively referred to as the <strong>"Platform"</strong>).
                        By accessing or using Plyship, you agree to be bound by these terms.
                    </p>

                    <div style={{ fontSize: 15, color: '#555', lineHeight: 1.8 }}>
                        <h2 style={sectionStyle}>1. Platform Description</h2>
                        <p>Plyship is an online marketplace connecting <strong>home interior seekers</strong> with <strong>interior design companies</strong>.</p>
                        <p>The platform allows users to:</p>
                        <ul style={{ marginLeft: 20, marginTop: 8 }}>
                            <li>Discover interior professionals</li>
                            <li>Connect with potential clients</li>
                            <li>Schedule consultations</li>
                            <li>Manage interior projects</li>
                        </ul>
                        <p>Plyship acts only as a <strong>facilitator between users</strong> and does not directly provide interior services.</p>

                        <h2 style={sectionStyle}>2. User Responsibilities</h2>
                        <p>By using Plyship, you agree to:</p>
                        <ul style={{ marginLeft: 20, marginTop: 8 }}>
                            <li>Provide accurate information</li>
                            <li>Use the platform lawfully</li>
                            <li>Respect other users</li>
                            <li>Not misuse the platform for fraud or spam</li>
                        </ul>
                        <p>Any misuse may result in <strong>account suspension or permanent ban</strong>.</p>

                        <h2 style={sectionStyle}>3. Payments and Wallet</h2>
                        <p>The platform provides wallet functionality for meeting payments.</p>
                        <ul style={{ marginLeft: 20, marginTop: 8 }}>
                            <li>Companies may pay fees for meetings or consultations.</li>
                            <li>Seekers may earn rewards for attending meetings.</li>
                        </ul>
                        <p>All payments are processed through <strong>third-party payment providers</strong>.</p>
                        <p>Plyship is not responsible for payment failures caused by payment providers.</p>

                        <h2 style={sectionStyle}>4. Meetings and Projects</h2>
                        <p>Plyship provides tools for scheduling meetings and managing projects between users.</p>
                        <p>However:</p>
                        <ul style={{ marginLeft: 20, marginTop: 8 }}>
                            <li>Plyship does not guarantee project completion.</li>
                            <li>Plyship is not responsible for disputes between users.</li>
                            <li>Users must independently verify companies before hiring.</li>
                        </ul>

                        <h2 style={sectionStyle}>5. Prohibited Activities</h2>
                        <p>Users must not:</p>
                        <ul style={{ marginLeft: 20, marginTop: 8 }}>
                            <li>Post misleading or fraudulent information</li>
                            <li>Harass or abuse other users</li>
                            <li>Upload illegal or copyrighted material without permission</li>
                            <li>Attempt to hack, disrupt, or manipulate the platform</li>
                        </ul>
                        <p>Violation may result in account termination.</p>

                        <h2 style={sectionStyle}>6. Limitation of Liability</h2>
                        <p>Plyship acts as a platform connecting users and does not provide interior services directly.</p>
                        <p>To the maximum extent permitted by law, Plyship is <strong>not liable for</strong>:</p>
                        <ul style={{ marginLeft: 20, marginTop: 8 }}>
                            <li>Service quality provided by interior companies</li>
                            <li>Disputes between users</li>
                            <li>Financial losses resulting from agreements between users</li>
                        </ul>
                        <p>Users agree to use the platform <strong>at their own risk</strong>.</p>

                        <h2 style={sectionStyle}>7. Termination</h2>
                        <p>We reserve the right to suspend or terminate accounts that violate these terms or misuse the platform.</p>

                        <h2 style={sectionStyle}>8. Governing Law</h2>
                        <p>These terms shall be governed by the laws of <strong>India</strong>.</p>

                        <h2 style={sectionStyle}>9. Contact Us</h2>
                        <p>If you have questions regarding these terms, please contact us:</p>
                        <ul style={{ marginLeft: 20, marginTop: 8 }}>
                            <li>Email: <a href="mailto:agxfactor@gmail.com" style={{ color: '#16A34A' }}>agxfactor@gmail.com</a></li>
                            <li>Phone: +91 8465834152</li>
                            <li>Website: <a href="https://plyship.com" style={{ color: '#16A34A' }}>plyship.com</a></li>
                        </ul>
                        <p>We will make reasonable efforts to respond to inquiries related to privacy and platform use.</p>
                    </div>
                </div>
            </section>
        </div>
    );
}
