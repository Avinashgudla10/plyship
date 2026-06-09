'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Trash2, Mail, Smartphone, Clock, CheckCircle } from 'lucide-react';

export default function MetaDataDeletionPage() {
    useEffect(() => {
        document.body.classList.add('landing-page-active');
        return () => document.body.classList.remove('landing-page-active');
    }, []);

    const S = { fontSize: 20, fontWeight: 700, color: '#111', marginTop: 36, marginBottom: 14 };
    const ul = { marginLeft: 20, marginTop: 8 };
    const stepStyle = {
        display: 'flex', gap: 14, alignItems: 'flex-start', padding: '16px 0',
        borderBottom: '1px solid #F3F4F6',
    };
    const stepNumStyle = {
        width: 32, height: 32, borderRadius: '50%', background: '#22C55E', color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 700, flexShrink: 0,
    };

    return (
        <div style={{ minHeight: '100vh', background: '#FAFAFA' }}>
            <header style={{ padding: '16px 24px', background: 'white', borderBottom: '1px solid #E5E7EB', position: 'sticky', top: 0, zIndex: 50 }}>
                <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#666', textDecoration: 'none' }}><ArrowLeft size={20} /><span>Back</span></Link>
                    <Link href="/meta-app/privacy" style={{ fontSize: 14, fontWeight: 600, color: '#16A34A', textDecoration: 'none' }}>Privacy Policy →</Link>
                </div>
            </header>

            <section style={{ padding: '40px 24px 80px' }}>
                <div style={{ maxWidth: 800, margin: '0 auto', background: 'white', borderRadius: 16, padding: '32px 28px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <Trash2 size={28} color="#DC2626" />
                        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#111' }}>Data Deletion Instructions</h1>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, background: '#EFF6FF', color: '#2563EB', padding: '4px 10px', borderRadius: 6 }}>Facebook Platform</span>
                        <span style={{ fontSize: 12, fontWeight: 600, background: '#F0FDF4', color: '#16A34A', padding: '4px 10px', borderRadius: 6 }}>WhatsApp Business API</span>
                    </div>
                    <p style={{ fontSize: 14, color: '#888', marginBottom: 8 }}>Last Updated: June 9, 2026</p>
                    <p style={{ fontSize: 15, color: '#555', lineHeight: 1.8, marginBottom: 24 }}>
                        At <strong>Plyship</strong>, we respect your right to control your personal data. This page explains how you can request the deletion of your account and all associated data collected through our Meta (Facebook) and WhatsApp Business integrations.
                    </p>

                    <div style={{ fontSize: 15, color: '#555', lineHeight: 1.8 }}>

                        <h2 style={S}>1. How to Request Account Deletion</h2>
                        <p>You can request deletion of your Plyship account and all associated data through any of the following methods:</p>

                        {/* Method 1: In-App */}
                        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 14, padding: '20px 22px', margin: '16px 0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                                <Smartphone size={20} color="#16A34A" />
                                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111', margin: 0 }}>Method 1: Delete from Inside Plyship</h3>
                            </div>
                            <p style={{ margin: '0 0 12px', color: '#555' }}>You can delete your account directly within the Plyship application:</p>
                            <div style={stepStyle}>
                                <div style={stepNumStyle}>1</div>
                                <div><strong>Open Plyship</strong> on your device and log into your account</div>
                            </div>
                            <div style={stepStyle}>
                                <div style={stepNumStyle}>2</div>
                                <div>Go to <strong>Profile</strong> → tap the <strong>Settings</strong> icon</div>
                            </div>
                            <div style={stepStyle}>
                                <div style={stepNumStyle}>3</div>
                                <div>Scroll down and tap <strong>&quot;Delete Account&quot;</strong></div>
                            </div>
                            <div style={stepStyle}>
                                <div style={stepNumStyle}>4</div>
                                <div>Fill in your <strong>registered phone number</strong> and <strong>name</strong></div>
                            </div>
                            <div style={{ ...stepStyle, borderBottom: 'none' }}>
                                <div style={stepNumStyle}>5</div>
                                <div>Tap <strong>&quot;Submit Deletion Request&quot;</strong> to confirm</div>
                            </div>
                        </div>

                        {/* Method 2: Email */}
                        <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 14, padding: '20px 22px', margin: '16px 0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                                <Mail size={20} color="#2563EB" />
                                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111', margin: 0 }}>Method 2: Email Support</h3>
                            </div>
                            <p style={{ margin: '0 0 12px', color: '#555' }}>Send a deletion request email to our support team:</p>
                            <div style={stepStyle}>
                                <div style={{ ...stepNumStyle, background: '#2563EB' }}>1</div>
                                <div>Send an email to <a href="mailto:support@plyship.com" style={{ color: '#2563EB', fontWeight: 600 }}>support@plyship.com</a></div>
                            </div>
                            <div style={stepStyle}>
                                <div style={{ ...stepNumStyle, background: '#2563EB' }}>2</div>
                                <div>Use the subject line: <strong>&quot;Account Deletion Request&quot;</strong></div>
                            </div>
                            <div style={stepStyle}>
                                <div style={{ ...stepNumStyle, background: '#2563EB' }}>3</div>
                                <div>Include your <strong>registered phone number</strong> and <strong>name</strong> in the email body</div>
                            </div>
                            <div style={{ ...stepStyle, borderBottom: 'none' }}>
                                <div style={{ ...stepNumStyle, background: '#2563EB' }}>4</div>
                                <div>Our team will verify your identity and process the request</div>
                            </div>
                        </div>

                        {/* Method 3: Web Form */}
                        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 14, padding: '20px 22px', margin: '16px 0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                                <Trash2 size={20} color="#666" />
                                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111', margin: 0 }}>Method 3: Online Deletion Form</h3>
                            </div>
                            <p style={{ margin: '0 0 12px', color: '#555' }}>
                                Visit our online deletion request page at{' '}
                                <Link href="/delete-account" style={{ color: '#16A34A', fontWeight: 600 }}>plyship.com/delete-account</Link>
                                {' '}and fill out the deletion form with your details.
                            </p>
                        </div>

                        {/* Processing Timeline */}
                        <h2 style={S}>2. Processing Timeline</h2>
                        <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 12, padding: '16px 18px', margin: '12px 0', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <Clock size={20} color="#D97706" style={{ marginTop: 2, flexShrink: 0 }} />
                            <p style={{ margin: 0, color: '#92400E' }}>
                                All deletion requests are processed within <strong>30 days</strong> of receipt. You will receive a confirmation via your registered phone number or email once the deletion is complete.
                            </p>
                        </div>

                        {/* What Gets Deleted */}
                        <h2 style={S}>3. What Data Is Deleted</h2>
                        <p>Upon processing your deletion request, the following data will be <strong>permanently removed</strong>:</p>
                        <ul style={ul}>
                            <li><CheckCircle size={14} color="#22C55E" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />Your Plyship account and login credentials</li>
                            <li><CheckCircle size={14} color="#22C55E" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />Profile information (name, photo, city, preferences)</li>
                            <li><CheckCircle size={14} color="#22C55E" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />Company or project details</li>
                            <li><CheckCircle size={14} color="#22C55E" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />Chat messages and communication history</li>
                            <li><CheckCircle size={14} color="#22C55E" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />Meeting history and schedules</li>
                            <li><CheckCircle size={14} color="#22C55E" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />Uploaded images and portfolio files</li>
                            <li><CheckCircle size={14} color="#22C55E" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />WhatsApp notification logs and delivery data</li>
                            <li><CheckCircle size={14} color="#22C55E" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />Push notification tokens (FCM tokens)</li>
                            <li><CheckCircle size={14} color="#22C55E" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />Wallet transaction history</li>
                        </ul>

                        {/* What May Be Retained */}
                        <h2 style={S}>4. Data That May Be Retained</h2>
                        <p>Certain data may be retained for a limited period after account deletion for <strong>legal, compliance, or legitimate business reasons</strong>:</p>
                        <ul style={ul}>
                            <li><strong>Financial Records:</strong> Payment transaction records may be retained for up to 7 years as required by Indian tax and accounting regulations</li>
                            <li><strong>Legal Compliance:</strong> Data required to comply with legal obligations, resolve disputes, or enforce agreements</li>
                            <li><strong>Fraud Prevention:</strong> Limited identifiers may be retained to prevent re-registration by suspended or banned accounts</li>
                            <li><strong>Aggregated Analytics:</strong> Anonymized and aggregated data that cannot identify you may be retained for platform improvement</li>
                        </ul>
                        <p>All retained data is stored securely and is not used for any purpose other than the specific legal or compliance reason for which it was retained.</p>

                        {/* Meta-Specific Data */}
                        <h2 style={S}>5. Meta & WhatsApp Specific Data</h2>
                        <p>In addition to the above, the following Meta/WhatsApp-specific data is handled upon deletion:</p>
                        <ul style={ul}>
                            <li>All WhatsApp message delivery logs associated with your account are deleted</li>
                            <li>Your phone number is removed from our WhatsApp notification list</li>
                            <li>Any Meta platform user identifiers linked to your account are removed</li>
                            <li>WhatsApp Business API webhook data related to your messages is purged</li>
                        </ul>

                        {/* Contact */}
                        <h2 style={S}>6. Contact Information</h2>
                        <p>If you have questions about the deletion process or need assistance:</p>
                        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: '18px 20px', marginTop: 12 }}>
                            <ul style={{ marginLeft: 20, margin: 0 }}>
                                <li>Email: <a href="mailto:support@plyship.com" style={{ color: '#16A34A', fontWeight: 600 }}>support@plyship.com</a></li>
                                <li>Website: <a href="https://plyship.com" style={{ color: '#16A34A', fontWeight: 600 }}>https://plyship.com</a></li>
                                <li>Deletion Form: <Link href="/delete-account" style={{ color: '#16A34A', fontWeight: 600 }}>plyship.com/delete-account</Link></li>
                            </ul>
                        </div>

                        <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #E5E7EB', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                            <Link href="/meta-app/privacy" style={{ padding: '10px 18px', borderRadius: 10, background: '#F0FDF4', color: '#16A34A', fontWeight: 600, fontSize: 14, textDecoration: 'none', border: '1px solid #BBF7D0' }}>Privacy Policy →</Link>
                            <Link href="/meta-app/terms" style={{ padding: '10px 18px', borderRadius: 10, background: '#EFF6FF', color: '#2563EB', fontWeight: 600, fontSize: 14, textDecoration: 'none', border: '1px solid #BFDBFE' }}>Terms of Service →</Link>
                            <Link href="/delete-account" style={{ padding: '10px 18px', borderRadius: 10, background: '#FEF2F2', color: '#DC2626', fontWeight: 600, fontSize: 14, textDecoration: 'none', border: '1px solid #FECACA' }}>Delete Account →</Link>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
