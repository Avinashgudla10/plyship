'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';

export default function PrivacyPage() {
    useEffect(() => {
        document.body.classList.add('landing-page-active');
        return () => {
            document.body.classList.remove('landing-page-active');
        };
    }, []);

    const sectionStyle = { fontSize: 20, fontWeight: 700, color: '#111', marginTop: 32, marginBottom: 12 };
    const subSectionStyle = { fontSize: 17, fontWeight: 600, color: '#222', marginTop: 24, marginBottom: 8 };

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
                    <Link href="/terms" style={{ fontSize: 14, fontWeight: 600, color: '#16A34A', textDecoration: 'none' }}>
                        Terms of Service →
                    </Link>
                </div>
            </header>

            {/* Content */}
            <section style={{ padding: '40px 24px 80px' }}>
                <div style={{ maxWidth: 800, margin: '0 auto', background: 'white', borderRadius: 16, padding: '32px 28px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <Shield size={28} color="#22C55E" />
                        <h1 style={{ fontSize: 32, fontWeight: 800, color: '#111' }}>Privacy Policy</h1>
                    </div>
                    <p style={{ fontSize: 14, color: '#888', marginBottom: 8 }}>Last Updated: March 13, 2026</p>
                    <p style={{ fontSize: 15, color: '#555', lineHeight: 1.8, marginBottom: 24 }}>
                        Welcome to <strong>Plyship</strong>. This Privacy Policy governs your use of the Plyship website and mobile application (collectively referred to as the <strong>"Platform"</strong>).
                        By accessing or using Plyship, you agree to be bound by this policy.
                    </p>

                    <div style={{ fontSize: 15, color: '#555', lineHeight: 1.8 }}>
                        <h2 style={sectionStyle}>1. Information We Collect</h2>
                        <p>We may collect different types of information when you use our platform.</p>

                        <h3 style={subSectionStyle}>Personal Information</h3>
                        <p>When you create an account or use Plyship, we may collect:</p>
                        <ul style={{ marginLeft: 20, marginTop: 8 }}>
                            <li>Name</li>
                            <li>Phone number</li>
                            <li>Email address (optional)</li>
                            <li>Profile photo</li>
                            <li>City or location</li>
                            <li>Company details (for interior companies)</li>
                            <li>Project preferences and requirements</li>
                        </ul>

                        <h3 style={subSectionStyle}>Profile Information</h3>
                        <p>Users may voluntarily provide:</p>
                        <ul style={{ marginLeft: 20, marginTop: 8 }}>
                            <li>Property type</li>
                            <li>Budget range</li>
                            <li>Design style preferences</li>
                            <li>Portfolio images or project images</li>
                            <li>Company information such as experience, team size, and specializations</li>
                        </ul>

                        <h3 style={subSectionStyle}>Communication Data</h3>
                        <p>When using the platform messaging system we may collect:</p>
                        <ul style={{ marginLeft: 20, marginTop: 8 }}>
                            <li>Messages exchanged between users</li>
                            <li>Meeting requests and schedules</li>
                            <li>Project discussion details</li>
                        </ul>

                        <h3 style={subSectionStyle}>Payment Information</h3>
                        <p>Payments are processed through <strong>third-party payment providers such as Razorpay</strong>.</p>
                        <ul style={{ marginLeft: 20, marginTop: 8 }}>
                            <li>Plyship does <strong>not store credit card or banking details</strong>.</li>
                            <li>Payment processors may collect payment data required to process transactions.</li>
                        </ul>

                        <h3 style={subSectionStyle}>Device & Usage Data</h3>
                        <p>We may automatically collect:</p>
                        <ul style={{ marginLeft: 20, marginTop: 8 }}>
                            <li>Device information</li>
                            <li>Browser type</li>
                            <li>IP address</li>
                            <li>App usage statistics</li>
                            <li>Log data</li>
                        </ul>
                        <p>This data helps us improve the platform and prevent misuse.</p>

                        <h2 style={sectionStyle}>2. How We Use Your Information</h2>
                        <p>Your information may be used to:</p>
                        <ul style={{ marginLeft: 20, marginTop: 8 }}>
                            <li>Create and manage your account</li>
                            <li>Connect homeowners with interior companies</li>
                            <li>Enable chat and communication between users</li>
                            <li>Schedule meetings between users</li>
                            <li>Process wallet payments and transactions</li>
                            <li>Provide customer support</li>
                            <li>Improve our services and platform performance</li>
                            <li>Prevent fraud or misuse of the platform</li>
                            <li>Comply with legal obligations</li>
                        </ul>

                        <h2 style={sectionStyle}>3. Data Storage & Security</h2>
                        <p>We store and manage data using trusted third-party infrastructure including:</p>
                        <ul style={{ marginLeft: 20, marginTop: 8 }}>
                            <li><strong>Firebase (Google)</strong> — authentication and database</li>
                            <li><strong>Firebase Storage</strong> — image uploads</li>
                            <li><strong>Razorpay</strong> — payment processing</li>
                        </ul>
                        <p>We take reasonable security measures to protect user data. However, no online system can guarantee absolute security.</p>

                        <h2 style={sectionStyle}>4. Sharing of Information</h2>
                        <p>We <strong>do not sell user data</strong>.</p>
                        <p>We may share information in the following cases.</p>

                        <h3 style={subSectionStyle}>With Other Users</h3>
                        <p>Certain profile information is visible to other users to enable connections, including:</p>
                        <ul style={{ marginLeft: 20, marginTop: 8 }}>
                            <li>Name</li>
                            <li>Profile image</li>
                            <li>City</li>
                            <li>Company details or project preferences</li>
                        </ul>

                        <h3 style={subSectionStyle}>With Service Providers</h3>
                        <p>We may share data with trusted providers that help operate the platform such as:</p>
                        <ul style={{ marginLeft: 20, marginTop: 8 }}>
                            <li>Payment processors</li>
                            <li>Cloud infrastructure providers</li>
                            <li>Analytics services</li>
                        </ul>

                        <h3 style={subSectionStyle}>Legal Compliance</h3>
                        <p>We may disclose information if required to:</p>
                        <ul style={{ marginLeft: 20, marginTop: 8 }}>
                            <li>Comply with laws or regulations</li>
                            <li>Protect our rights</li>
                            <li>Prevent fraud or misuse</li>
                            <li>Ensure user safety</li>
                        </ul>

                        <h2 style={sectionStyle}>5. User Content</h2>
                        <p>Users may upload photos, portfolio images, messages, and other materials.</p>
                        <p>You are responsible for the content you upload and must ensure that it:</p>
                        <ul style={{ marginLeft: 20, marginTop: 8 }}>
                            <li>Does not violate laws</li>
                            <li>Does not infringe intellectual property</li>
                            <li>Does not contain harmful or illegal material</li>
                        </ul>
                        <p>Plyship reserves the right to remove inappropriate content.</p>

                        <h2 style={sectionStyle}>6. Account Security</h2>
                        <p>Users are responsible for maintaining control of their registered phone number used for login.</p>
                        <p>If you suspect unauthorized access to your account, please contact us immediately.</p>

                        <h2 style={sectionStyle}>7. User Rights</h2>
                        <p>Users may:</p>
                        <ul style={{ marginLeft: 20, marginTop: 8 }}>
                            <li>Update their profile information</li>
                            <li>Delete their account</li>
                            <li>Request information regarding stored personal data</li>
                        </ul>
                        <p>Account deletion can be requested through the platform or by contacting support.</p>

                        <h2 style={sectionStyle}>8. Children's Privacy</h2>
                        <p>Plyship is intended only for individuals <strong>18 years or older</strong>.</p>
                        <p>We do not knowingly collect data from children under 18.</p>

                        <h2 style={sectionStyle}>9. Third-Party Services</h2>
                        <p>Plyship uses third-party services including but not limited to:</p>
                        <ul style={{ marginLeft: 20, marginTop: 8 }}>
                            <li>Firebase (Google)</li>
                            <li>Razorpay</li>
                            <li>Hosting providers</li>
                            <li>Analytics tools</li>
                        </ul>
                        <p>These services operate under their own privacy policies.</p>

                        <h2 style={sectionStyle}>10. Policy Updates</h2>
                        <p>We may update this Privacy Policy periodically.</p>
                        <p>Updated policies will be posted on this page with the revised date.</p>

                        <h2 style={sectionStyle}>11. Contact Us</h2>
                        <p>If you have questions regarding this policy, please contact us:</p>
                        <ul style={{ marginLeft: 20, marginTop: 8 }}>
                            <li>Email: <a href="mailto:agxfactor@gmail.com" style={{ color: '#16A34A' }}>agxfactor@gmail.com</a></li>
                            <li>Phone: +91 8465834152</li>
                            <li>Website: <a href="https://plyship.com" style={{ color: '#16A34A' }}>plyship.com</a></li>
                        </ul>
                    </div>
                </div>
            </section>
        </div>
    );
}
