'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';

export default function MetaPrivacyPage() {
    useEffect(() => {
        document.body.classList.add('landing-page-active');
        return () => document.body.classList.remove('landing-page-active');
    }, []);

    const S = { fontSize: 20, fontWeight: 700, color: '#111', marginTop: 36, marginBottom: 14 };
    const SS = { fontSize: 17, fontWeight: 600, color: '#222', marginTop: 24, marginBottom: 8 };
    const ul = { marginLeft: 20, marginTop: 8 };

    return (
        <div style={{ minHeight: '100vh', background: '#FAFAFA' }}>
            <header style={{ padding: '16px 24px', background: 'white', borderBottom: '1px solid #E5E7EB', position: 'sticky', top: 0, zIndex: 50 }}>
                <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#666', textDecoration: 'none' }}><ArrowLeft size={20} /><span>Back</span></Link>
                    <Link href="/meta-app/terms" style={{ fontSize: 14, fontWeight: 600, color: '#16A34A', textDecoration: 'none' }}>Terms of Service →</Link>
                </div>
            </header>

            <section style={{ padding: '40px 24px 80px' }}>
                <div style={{ maxWidth: 800, margin: '0 auto', background: 'white', borderRadius: 16, padding: '32px 28px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <Shield size={28} color="#22C55E" />
                        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#111' }}>Privacy Policy — Meta & WhatsApp Integration</h1>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, background: '#EFF6FF', color: '#2563EB', padding: '4px 10px', borderRadius: 6 }}>Facebook Platform</span>
                        <span style={{ fontSize: 12, fontWeight: 600, background: '#F0FDF4', color: '#16A34A', padding: '4px 10px', borderRadius: 6 }}>WhatsApp Business API</span>
                    </div>
                    <p style={{ fontSize: 14, color: '#888', marginBottom: 8 }}>Last Updated: June 9, 2026</p>
                    <p style={{ fontSize: 15, color: '#555', lineHeight: 1.8, marginBottom: 24 }}>
                        This Privacy Policy describes how <strong>Plyship</strong> (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) collects, uses, stores, and protects information obtained through our integration with <strong>Meta (Facebook)</strong> and <strong>WhatsApp Business Platform</strong>. This supplements the main <Link href="/privacy" style={{ color: '#16A34A', fontWeight: 600 }}>Plyship Privacy Policy</Link>.
                    </p>

                    <div style={{ fontSize: 15, color: '#555', lineHeight: 1.8 }}>
                        <h2 style={S}>1. Information We Collect Through Meta & WhatsApp</h2>

                        <h3 style={SS}>Account Information</h3>
                        <ul style={ul}>
                            <li>Name and phone number used for WhatsApp</li>
                            <li>WhatsApp Business profile details (if applicable)</li>
                            <li>User ID and account identifiers from Meta platforms</li>
                        </ul>

                        <h3 style={SS}>Profile Data</h3>
                        <ul style={ul}>
                            <li>Profile name and display photo</li>
                            <li>User role (Interior Seeker or Interior Company)</li>
                            <li>Location and city information</li>
                            <li>Business details, specializations, and portfolio (for companies)</li>
                            <li>Project preferences and budget range (for seekers)</li>
                        </ul>

                        <h3 style={SS}>Business Information</h3>
                        <ul style={ul}>
                            <li>Company name, experience, and team size</li>
                            <li>Service areas and design specializations</li>
                            <li>Portfolio images shared through the platform</li>
                            <li>Meeting schedules and project-related communications</li>
                        </ul>

                        <h3 style={SS}>Messages & Notifications</h3>
                        <ul style={ul}>
                            <li>WhatsApp notification delivery status (sent, delivered, read)</li>
                            <li>Message content sent to and received from users via WhatsApp Business API</li>
                            <li>Notification preferences and opt-in/opt-out status</li>
                            <li>Push notification tokens for message delivery</li>
                        </ul>

                        <h3 style={SS}>Analytics & Technical Data</h3>
                        <ul style={ul}>
                            <li>Message delivery and read receipts</li>
                            <li>Notification interaction data</li>
                            <li>API usage metrics and error logs</li>
                            <li>Device and platform information for delivery optimization</li>
                        </ul>

                        <h2 style={S}>2. How We Use Your Data</h2>
                        <ul style={ul}>
                            <li><strong>Service Delivery:</strong> Connect interior seekers with interior companies and facilitate communications</li>
                            <li><strong>Notifications:</strong> Send activity digests including new message alerts, meeting updates via WhatsApp</li>
                            <li><strong>Account Management:</strong> Verify identity, manage preferences, process account requests</li>
                            <li><strong>Platform Improvement:</strong> Analyze delivery performance and optimize communication</li>
                            <li><strong>Customer Support:</strong> Respond to inquiries and resolve issues</li>
                            <li><strong>Compliance:</strong> Comply with legal obligations, Meta Platform Terms, and WhatsApp policies</li>
                        </ul>

                        <h2 style={S}>3. Data We Never Sell</h2>
                        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: '16px 18px', margin: '12px 0' }}>
                            <p style={{ margin: 0, fontWeight: 600, color: '#15803D' }}>
                                🔒 Plyship <strong>never sells, rents, or trades</strong> your personal information, WhatsApp data, or any data collected through Meta platform integrations to third parties.
                            </p>
                        </div>

                        <h2 style={S}>4. Data Sharing</h2>
                        <h3 style={SS}>With Other Plyship Users</h3>
                        <p>Certain profile information is shared with other users to facilitate connections, including name, profile photo, city, and business/project details.</p>

                        <h3 style={SS}>With Service Providers</h3>
                        <ul style={ul}>
                            <li><strong>Firebase (Google Cloud):</strong> Authentication, database, and cloud messaging</li>
                            <li><strong>Meta/WhatsApp:</strong> Message delivery through WhatsApp Business API</li>
                            <li><strong>Vercel:</strong> Application hosting and serverless functions</li>
                        </ul>

                        <h3 style={SS}>For Legal Compliance</h3>
                        <p>We may disclose information when required by law, to protect our rights, prevent fraud, or ensure user safety.</p>

                        <h2 style={S}>5. Data Retention</h2>
                        <ul style={ul}>
                            <li>Account data is retained while your account is active</li>
                            <li>WhatsApp notification logs are retained for <strong>90 days</strong></li>
                            <li>Message metadata (delivery status) is retained for <strong>30 days</strong></li>
                            <li>Upon account deletion, all personal data is removed within <strong>30 days</strong></li>
                        </ul>

                        <h2 style={S}>6. Security Measures</h2>
                        <ul style={ul}>
                            <li><strong>Encryption in Transit:</strong> All data uses TLS/HTTPS encryption</li>
                            <li><strong>Secure Storage:</strong> Data stored in Firebase with encryption at rest</li>
                            <li><strong>Access Control:</strong> API tokens stored as encrypted environment variables</li>
                            <li><strong>Rate Limiting:</strong> Max 3 WhatsApp messages per user per day</li>
                            <li><strong>Token Validation:</strong> Webhook endpoints use verify tokens for authentication</li>
                            <li><strong>Regular Monitoring:</strong> We monitor for unauthorized access</li>
                        </ul>

                        <h2 style={S}>7. Your Rights</h2>
                        <ul style={ul}>
                            <li><strong>Access:</strong> Request a copy of data we hold about you</li>
                            <li><strong>Correction:</strong> Update profile information through the app</li>
                            <li><strong>Deletion:</strong> Request complete account deletion (see <Link href="/meta-app/data-deletion" style={{ color: '#16A34A', fontWeight: 600 }}>Data Deletion Instructions</Link>)</li>
                            <li><strong>Opt-out:</strong> Opt out of WhatsApp notifications by contacting support</li>
                            <li><strong>Portability:</strong> Request your data in a portable format</li>
                        </ul>

                        <h2 style={S}>8. Meta Platform Compliance</h2>
                        <ul style={ul}>
                            <li>We comply with all applicable <strong>Meta Platform Terms and Developer Policies</strong></li>
                            <li>Our WhatsApp Business API usage adheres to <strong>WhatsApp Business Policy and Commerce Policy</strong></li>
                            <li>We do not use Meta platform data for undisclosed purposes</li>
                            <li>We obtain appropriate user consent before sending WhatsApp notifications</li>
                        </ul>

                        <h2 style={S}>9. Children&apos;s Privacy</h2>
                        <p>Plyship is intended only for individuals <strong>18 years or older</strong>. We do not knowingly collect data from children under 18.</p>

                        <h2 style={S}>10. Changes to This Policy</h2>
                        <p>We may update this policy periodically. Changes will be posted on this page with an updated &quot;Last Updated&quot; date.</p>

                        <h2 style={S}>11. Contact Us</h2>
                        <p>For questions about this policy or our Meta/WhatsApp data practices:</p>
                        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: '18px 20px', marginTop: 12 }}>
                            <ul style={{ marginLeft: 20, margin: 0 }}>
                                <li>Email: <a href="mailto:support@plyship.com" style={{ color: '#16A34A', fontWeight: 600 }}>support@plyship.com</a></li>
                                <li>Website: <a href="https://plyship.com" style={{ color: '#16A34A', fontWeight: 600 }}>https://plyship.com</a></li>
                                <li>Data Deletion: <Link href="/meta-app/data-deletion" style={{ color: '#16A34A', fontWeight: 600 }}>plyship.com/meta-app/data-deletion</Link></li>
                            </ul>
                        </div>

                        <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #E5E7EB', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                            <Link href="/meta-app/terms" style={{ padding: '10px 18px', borderRadius: 10, background: '#F0FDF4', color: '#16A34A', fontWeight: 600, fontSize: 14, textDecoration: 'none', border: '1px solid #BBF7D0' }}>Terms of Service →</Link>
                            <Link href="/meta-app/data-deletion" style={{ padding: '10px 18px', borderRadius: 10, background: '#FEF2F2', color: '#DC2626', fontWeight: 600, fontSize: 14, textDecoration: 'none', border: '1px solid #FECACA' }}>Data Deletion →</Link>
                            <Link href="/privacy" style={{ padding: '10px 18px', borderRadius: 10, background: '#F9FAFB', color: '#666', fontWeight: 600, fontSize: 14, textDecoration: 'none', border: '1px solid #E5E7EB' }}>Main Privacy Policy →</Link>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
