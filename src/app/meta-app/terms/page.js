'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';

export default function MetaTermsPage() {
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
                    <Link href="/meta-app/privacy" style={{ fontSize: 14, fontWeight: 600, color: '#16A34A', textDecoration: 'none' }}>Privacy Policy →</Link>
                </div>
            </header>

            <section style={{ padding: '40px 24px 80px' }}>
                <div style={{ maxWidth: 800, margin: '0 auto', background: 'white', borderRadius: 16, padding: '32px 28px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <FileText size={28} color="#22C55E" />
                        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#111' }}>Terms of Service — Meta & WhatsApp Integration</h1>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, background: '#EFF6FF', color: '#2563EB', padding: '4px 10px', borderRadius: 6 }}>Facebook Platform</span>
                        <span style={{ fontSize: 12, fontWeight: 600, background: '#F0FDF4', color: '#16A34A', padding: '4px 10px', borderRadius: 6 }}>WhatsApp Business API</span>
                    </div>
                    <p style={{ fontSize: 14, color: '#888', marginBottom: 8 }}>Last Updated: June 9, 2026</p>
                    <p style={{ fontSize: 15, color: '#555', lineHeight: 1.8, marginBottom: 24 }}>
                        These Terms of Service (&quot;Terms&quot;) govern your use of <strong>Plyship&apos;s</strong> integration with <strong>Meta (Facebook)</strong> and <strong>WhatsApp Business Platform</strong>. By using Plyship&apos;s WhatsApp or Meta-connected features, you agree to these Terms in addition to the main <Link href="/terms" style={{ color: '#16A34A', fontWeight: 600 }}>Plyship Terms of Service</Link>.
                    </p>

                    <div style={{ fontSize: 15, color: '#555', lineHeight: 1.8 }}>
                        <h2 style={S}>1. Acceptance of Terms</h2>
                        <p>By using Plyship&apos;s WhatsApp notifications, Meta-connected features, or any functionality powered by the WhatsApp Business API or Meta Platform, you acknowledge and agree to:</p>
                        <ul style={ul}>
                            <li>These Terms of Service</li>
                            <li><a href="https://www.whatsapp.com/legal/business-policy" target="_blank" rel="noopener noreferrer" style={{ color: '#16A34A' }}>WhatsApp Business Platform Policy</a></li>
                            <li><a href="https://developers.facebook.com/terms/" target="_blank" rel="noopener noreferrer" style={{ color: '#16A34A' }}>Meta Platform Terms</a></li>
                            <li><a href="https://developers.facebook.com/devpolicy/" target="_blank" rel="noopener noreferrer" style={{ color: '#16A34A' }}>Meta Developer Policies</a></li>
                            <li>Plyship&apos;s <Link href="/meta-app/privacy" style={{ color: '#16A34A' }}>Meta Privacy Policy</Link></li>
                        </ul>

                        <h2 style={S}>2. Service Description</h2>
                        <p>Plyship is an online marketplace connecting <strong>home interior seekers</strong> with <strong>interior design companies</strong>. Our Meta and WhatsApp integration enables:</p>
                        <ul style={ul}>
                            <li><strong>Activity Notifications:</strong> Receiving WhatsApp messages about new messages, meeting updates, and platform activity</li>
                            <li><strong>Communication:</strong> Facilitating connections between seekers and companies</li>
                            <li><strong>Account Alerts:</strong> Important account and security notifications</li>
                        </ul>
                        <p>Plyship acts solely as a <strong>facilitator between users</strong> and does not directly provide interior design services.</p>

                        <h2 style={S}>3. Acceptable Use</h2>
                        <p>When using Plyship&apos;s Meta and WhatsApp features, you agree to:</p>
                        <ul style={ul}>
                            <li>Provide accurate and truthful information in your profile</li>
                            <li>Use messaging features only for legitimate business inquiries related to interior design</li>
                            <li>Respect other users and maintain professional communication</li>
                            <li>Comply with all applicable laws and regulations</li>
                            <li>Not share your account credentials with others</li>
                            <li>Keep your contact information up to date</li>
                        </ul>

                        <h2 style={S}>4. Prohibited Activities</h2>
                        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '16px 18px', margin: '12px 0' }}>
                            <p style={{ margin: '0 0 8px', fontWeight: 600, color: '#DC2626' }}>⚠️ The following activities are strictly prohibited:</p>
                        </div>
                        <ul style={ul}>
                            <li><strong>Spam:</strong> Sending unsolicited, bulk, or repetitive messages to other users through any channel</li>
                            <li><strong>Harassment:</strong> Threatening, abusive, discriminatory, or offensive communication towards any user</li>
                            <li><strong>Fake Leads:</strong> Creating fake profiles, submitting false project requirements, or misrepresenting your identity or intentions</li>
                            <li><strong>Fraudulent Activity:</strong> Engaging in financial fraud, scams, phishing, or deceptive business practices</li>
                            <li><strong>Misuse of Messaging:</strong> Using WhatsApp or platform messaging for purposes unrelated to interior design services, including advertising unrelated products or services</li>
                            <li><strong>Data Scraping:</strong> Automated collection of user data, profiles, or contact information from the platform</li>
                            <li><strong>Impersonation:</strong> Pretending to be another person, company, or Plyship representative</li>
                            <li><strong>Malware Distribution:</strong> Sharing malicious links, files, or software through any messaging channel</li>
                        </ul>

                        <h2 style={S}>5. Account Suspension & Termination</h2>
                        <p>Plyship reserves the right to suspend or terminate your account at our sole discretion if you:</p>
                        <ul style={ul}>
                            <li>Violate these Terms or any applicable Meta/WhatsApp policies</li>
                            <li>Engage in any prohibited activities listed above</li>
                            <li>Receive multiple complaints from other users</li>
                            <li>Provide false or misleading information</li>
                            <li>Fail to respond to compliance-related inquiries</li>
                        </ul>
                        <h3 style={SS}>Suspension Process</h3>
                        <ul style={ul}>
                            <li><strong>Warning:</strong> For minor violations, we may issue a warning before taking action</li>
                            <li><strong>Temporary Suspension:</strong> Your account may be temporarily suspended pending investigation</li>
                            <li><strong>Permanent Termination:</strong> Severe or repeated violations will result in permanent account removal</li>
                            <li><strong>Appeal:</strong> You may appeal a suspension by contacting <a href="mailto:support@plyship.com" style={{ color: '#16A34A' }}>support@plyship.com</a></li>
                        </ul>

                        <h2 style={S}>6. WhatsApp Notifications</h2>
                        <ul style={ul}>
                            <li>WhatsApp notifications are limited to a <strong>maximum of 3 per user per day</strong></li>
                            <li>Notifications include activity digests such as new messages, meeting updates, and important alerts</li>
                            <li>You can opt out of WhatsApp notifications at any time by contacting support</li>
                            <li>Notification delivery depends on WhatsApp availability and your device settings</li>
                        </ul>

                        <h2 style={S}>7. Intellectual Property</h2>
                        <p>All content, trademarks, logos, and intellectual property displayed on Plyship are the property of Plyship or their respective owners. You may not copy, modify, distribute, or use any Plyship branding without written permission.</p>

                        <h2 style={S}>8. Limitation of Liability</h2>
                        <p>To the maximum extent permitted by applicable law:</p>
                        <ul style={ul}>
                            <li>Plyship is provided <strong>&quot;as is&quot;</strong> without warranties of any kind</li>
                            <li>We are <strong>not liable</strong> for the quality of interior design services provided by companies on the platform</li>
                            <li>We are <strong>not liable</strong> for disputes between users</li>
                            <li>We are <strong>not liable</strong> for financial losses resulting from agreements between users</li>
                            <li>We are <strong>not liable</strong> for WhatsApp message delivery failures caused by Meta platform issues</li>
                            <li>Our total liability shall not exceed the amount you have paid to Plyship in the preceding 12 months</li>
                        </ul>

                        <h2 style={S}>9. Indemnification</h2>
                        <p>You agree to indemnify and hold Plyship harmless from any claims, damages, or expenses arising from your use of the platform, violation of these Terms, or infringement of any third-party rights.</p>

                        <h2 style={S}>10. Governing Law & Jurisdiction</h2>
                        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: '16px 18px', margin: '12px 0' }}>
                            <p style={{ margin: 0, color: '#15803D' }}>
                                These Terms shall be governed by and construed in accordance with the laws of <strong>India</strong>. Any disputes shall be subject to the exclusive jurisdiction of the courts located in <strong>Hyderabad, Telangana, India</strong>.
                            </p>
                        </div>

                        <h2 style={S}>11. Changes to These Terms</h2>
                        <p>We may update these Terms from time to time. Changes will be posted on this page with an updated &quot;Last Updated&quot; date. Continued use of the platform constitutes acceptance of the updated Terms.</p>

                        <h2 style={S}>12. Contact Us</h2>
                        <p>For questions about these Terms:</p>
                        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: '18px 20px', marginTop: 12 }}>
                            <ul style={{ marginLeft: 20, margin: 0 }}>
                                <li>Email: <a href="mailto:support@plyship.com" style={{ color: '#16A34A', fontWeight: 600 }}>support@plyship.com</a></li>
                                <li>Website: <a href="https://plyship.com" style={{ color: '#16A34A', fontWeight: 600 }}>https://plyship.com</a></li>
                            </ul>
                        </div>

                        <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #E5E7EB', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                            <Link href="/meta-app/privacy" style={{ padding: '10px 18px', borderRadius: 10, background: '#F0FDF4', color: '#16A34A', fontWeight: 600, fontSize: 14, textDecoration: 'none', border: '1px solid #BBF7D0' }}>Privacy Policy →</Link>
                            <Link href="/meta-app/data-deletion" style={{ padding: '10px 18px', borderRadius: 10, background: '#FEF2F2', color: '#DC2626', fontWeight: 600, fontSize: 14, textDecoration: 'none', border: '1px solid #FECACA' }}>Data Deletion →</Link>
                            <Link href="/terms" style={{ padding: '10px 18px', borderRadius: 10, background: '#F9FAFB', color: '#666', fontWeight: 600, fontSize: 14, textDecoration: 'none', border: '1px solid #E5E7EB' }}>Main Terms →</Link>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
