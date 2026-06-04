'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import {
    MapPin, Star, Briefcase, Shield, Sparkles, Calendar, Home, Wallet,
    CheckCircle, User, Phone, ArrowLeft, ExternalLink, Loader2, CalendarPlus
} from 'lucide-react';
import BookMeetingFlow from '../../../components/BookMeetingFlow';

export default function PublicProfilePage({ params }) {
    const { id } = React.use(params);
    const [profileData, setProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [reviews, setReviews] = useState([]);
    const [showBooking, setShowBooking] = useState(false);

    // Enable scrolling on this page (override app shell overflow:hidden)
    useEffect(() => {
        document.body.classList.add('profile-page-active');
        return () => document.body.classList.remove('profile-page-active');
    }, []);

    useEffect(() => {
        const fetchProfile = async () => {
            if (!id) {
                setError('Invalid profile link');
                setLoading(false);
                return;
            }

            try {
                // Try seekers first
                let userDoc = await getDoc(doc(db, 'seekers', id));

                if (!userDoc.exists()) {
                    // Try companies
                    userDoc = await getDoc(doc(db, 'companies', id));
                }

                if (!userDoc.exists()) {
                    setError('Profile not found');
                    setLoading(false);
                    return;
                }

                const data = userDoc.data();
                if (!data.profileComplete) {
                    setError('This profile is not yet complete');
                    setLoading(false);
                    return;
                }

                setProfileData({ id: userDoc.id, ...data });

                // Fetch reviews for company profiles
                if (data.role === 'COMPANY') {
                    try {
                        const { collection, query, where, getDocs, orderBy } = await import('firebase/firestore');
                        const reviewsQuery = query(
                            collection(db, 'reviews'),
                            where('companyId', '==', id),
                            orderBy('createdAt', 'desc')
                        );
                        const reviewsSnapshot = await getDocs(reviewsQuery);
                        const reviewsList = [];
                        reviewsSnapshot.forEach((doc) => {
                            reviewsList.push({ id: doc.id, ...doc.data() });
                        });
                        setReviews(reviewsList);
                    } catch (e) {
                        // Reviews collection may not exist
                    }
                }
            } catch (err) {
                console.error('Error fetching profile:', err);
                setError('Unable to load profile');
            }

            setLoading(false);
        };

        fetchProfile();
    }, [id]);

    if (loading) {
        return (
            <div style={{
                position: 'fixed',
                inset: 0,
                background: 'linear-gradient(180deg, #0A0F0A 0%, #132A13 100%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 24,
            }}>
                <img
                    src="/loader-logo.png"
                    alt="PLYSHIP"
                    style={{
                        height: 48,
                        width: 'auto',
                        filter: 'brightness(1.1)',
                    }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                    {[0, 1, 2].map(i => (
                        <motion.div
                            key={i}
                            animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
                            transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                            style={{
                                width: 8, height: 8, borderRadius: '50%',
                                background: '#22C55E',
                            }}
                        />
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{
                position: 'fixed',
                inset: 0,
                background: 'linear-gradient(180deg, #F0FDF4 0%, #ECFDF5 50%, #F0FDF4 100%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 20,
                padding: 32,
                textAlign: 'center',
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            }}>
                <div style={{
                    width: 80, height: 80, borderRadius: 24,
                    background: '#FEE2E2',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <User size={36} color="#EF4444" />
                </div>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1F2937' }}>
                    {error}
                </h1>
                <p style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.5 }}>
                    This profile link may be invalid or the profile has been removed.
                </p>
                <motion.a
                    href="/"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '14px 28px',
                        borderRadius: 14,
                        background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                        color: 'white',
                        fontSize: 15,
                        fontWeight: 600,
                        textDecoration: 'none',
                        boxShadow: '0 4px 14px rgba(22, 163, 74, 0.3)',
                    }}
                >
                    <ArrowLeft size={18} />
                    Go to PlyShip
                </motion.a>
            </div>
        );
    }

    const profile = profileData.profile || {};
    const isCompany = profileData.role === 'COMPANY';
    const displayName = isCompany
        ? (profile.companyName || profileData.name)
        : (profile.name || profileData.name);
    const tagline = isCompany
        ? profile.tagline
        : `Looking for ${profile.propertyType || 'interior design'}`;
    const location = isCompany
        ? profile.city
        : `${profile.locality ? profile.locality + ', ' : ''}${profile.city || ''}`;
    const image = profile.avatar || profile.portfolioImages?.[0] || null;

    const stats = isCompany
        ? [
            { label: 'Projects', value: profile.projectsCompleted || '0', icon: Sparkles },
            { label: 'Budget Range', value: profile.minBudget ? `₹${profile.minBudget}` : 'Contact', icon: CheckCircle },
            { label: 'Experience', value: `${profile.yearsInBusiness || '0'}+ yrs`, icon: Calendar },
        ]
        : [
            { label: 'Property', value: profile.propertyType || 'N/A', icon: Home },
            { label: 'Budget', value: profile.budget ? `₹${profile.budget}L` : 'Flexible', icon: Wallet },
            { label: 'Timeline', value: profile.timeline?.replace('-', ' ') || 'Flexible', icon: Calendar },
        ];

    const tags = isCompany
        ? [...(profile.services || []), ...(profile.specializations || [])].slice(0, 6)
        : [...(profile.styles || []), ...(profile.rooms || [])].slice(0, 6);

    const aboutText = isCompany
        ? (profile.portfolioDescription || `${displayName} is a professional interior design company based in ${profile.city || 'India'}. They specialize in ${profile.services?.join(', ') || 'various interior design services'}.`)
        : `${displayName} is looking for interior design services in ${profile.city || 'their area'}. ${profile.propertyType ? `They have a ${profile.propertyType} property` : ''} ${profile.budget ? `with a budget of ₹${profile.budget}L` : ''}.`;

    const averageRating = reviews.length > 0
        ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
        : 0;

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(180deg, #F0FDF4 0%, #FFFFFF 30%)',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        }}>
            {/* Top Navigation Bar */}
            <div style={{
                position: 'sticky',
                top: 0,
                zIndex: 50,
                background: 'rgba(255, 255, 255, 0.85)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
                padding: '12px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}>
                <img
                    src="/logo.png"
                    alt="PlyShip"
                    style={{ height: 28, width: 'auto' }}
                />
                <motion.a
                    href="/"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 16px',
                        borderRadius: 10,
                        background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                        color: 'white',
                        fontSize: 13,
                        fontWeight: 600,
                        textDecoration: 'none',
                        boxShadow: '0 2px 8px rgba(22, 163, 74, 0.25)',
                    }}
                >
                    <ExternalLink size={14} />
                    Join PlyShip
                </motion.a>
            </div>

            {/* Hero Section */}
            <div style={{ position: 'relative', overflow: 'hidden' }}>
                {/* Background Hero Image */}
                {image ? (
                    <div style={{
                        width: '100%',
                        height: 320,
                        position: 'relative',
                        overflow: 'hidden',
                    }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={image}
                            alt={displayName}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                            }}
                        />
                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'linear-gradient(to top, white 0%, transparent 60%)',
                        }} />
                    </div>
                ) : (
                    <div style={{
                        width: '100%',
                        height: 200,
                        background: 'linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 50%, #86EFAC 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        {isCompany
                            ? <Briefcase size={64} color="#16A34A" style={{ opacity: 0.3 }} />
                            : <User size={64} color="#16A34A" style={{ opacity: 0.3 }} />
                        }
                    </div>
                )}

                {/* Role Badge */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    style={{
                        position: 'absolute',
                        top: 20,
                        left: 20,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '10px 16px',
                        borderRadius: 20,
                        background: 'white',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                    }}
                >
                    {isCompany ? (
                        <>
                            <Briefcase size={16} color="#22C55E" />
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#22C55E' }}>
                                Interior Company
                            </span>
                        </>
                    ) : (
                        <>
                            <Shield size={16} color="#22C55E" fill="#22C55E" />
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#22C55E' }}>
                                Interior Seeker
                            </span>
                        </>
                    )}
                </motion.div>
            </div>

            {/* Content */}
            <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.4 }}
                style={{
                    padding: '0 20px 40px',
                    marginTop: image ? -60 : -20,
                    position: 'relative',
                    maxWidth: 600,
                    margin: image ? '-60px auto 0' : '-20px auto 0',
                }}
            >
                {/* Name + Badge */}
                <div style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                        <h1 style={{
                            fontSize: 28,
                            fontWeight: 800,
                            color: '#111827',
                            lineHeight: 1.2,
                        }}>
                            {displayName}
                        </h1>
                        {isCompany && profile.yearsInBusiness && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '6px 12px',
                                borderRadius: 20,
                                background: '#FEF3C7',
                                border: '1px solid #FDE68A',
                            }}>
                                <Star size={14} color="#FBBF24" fill="#FBBF24" />
                                <span style={{ fontSize: 14, fontWeight: 700, color: '#D97706' }}>
                                    {profile.yearsInBusiness}+ yrs
                                </span>
                            </div>
                        )}
                    </div>
                    {tagline && (
                        <p style={{
                            fontSize: 16,
                            color: '#6B7280',
                            marginBottom: 12,
                        }}>
                            {tagline}
                        </p>
                    )}
                    {location && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <MapPin size={16} color="#22C55E" />
                            <span style={{ fontSize: 14, color: '#9CA3AF' }}>
                                {location}
                            </span>
                        </div>
                    )}
                </div>

                {/* Stats Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 12,
                    marginBottom: 28,
                }}>
                    {stats.map((stat, index) => (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.25 + index * 0.08 }}
                            style={{
                                padding: 16,
                                borderRadius: 16,
                                background: '#F0FDF4',
                                border: '1px solid #BBF7D0',
                                textAlign: 'center',
                            }}
                        >
                            <stat.icon size={20} color="#16A34A" style={{ marginBottom: 8 }} />
                            <div style={{
                                fontSize: 16,
                                fontWeight: 700,
                                color: '#111827',
                                marginBottom: 4,
                                textTransform: 'capitalize',
                            }}>
                                {stat.value}
                            </div>
                            <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                                {stat.label}
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Tags Section */}
                {tags.length > 0 && (
                    <div style={{ marginBottom: 28 }}>
                        <h3 style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: '#9CA3AF',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: 12,
                        }}>
                            {isCompany ? 'Services & Specializations' : 'Preferences'}
                        </h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {tags.map((tag) => (
                                <span
                                    key={tag}
                                    style={{
                                        padding: '10px 18px',
                                        borderRadius: 24,
                                        background: '#F0FDF4',
                                        border: '1px solid #BBF7D0',
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: '#111827',
                                        textTransform: 'capitalize',
                                    }}
                                >
                                    {tag.replace('-', ' ')}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Portfolio Images (for companies) */}
                {isCompany && profile.portfolioImages?.length > 0 && (
                    <div style={{ marginBottom: 28 }}>
                        <h3 style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: '#9CA3AF',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: 12,
                        }}>
                            Portfolio
                        </h3>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                            gap: 12,
                        }}>
                            {profile.portfolioImages.map((img, idx) => (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    key={idx}
                                    src={img}
                                    alt={`Portfolio ${idx + 1}`}
                                    style={{
                                        width: '100%',
                                        height: 140,
                                        borderRadius: 14,
                                        objectFit: 'cover',
                                        border: '1px solid #E5E7EB',
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Service Areas (for companies) */}
                {isCompany && profile.serviceAreas?.length > 0 && (
                    <div style={{ marginBottom: 28 }}>
                        <h3 style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: '#9CA3AF',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: 12,
                        }}>
                            Service Areas
                        </h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {profile.serviceAreas.map((area) => (
                                <span
                                    key={area}
                                    style={{
                                        padding: '8px 14px',
                                        borderRadius: 20,
                                        background: '#F3F4F6',
                                        border: '1px solid #E5E7EB',
                                        fontSize: 13,
                                        color: '#6B7280',
                                    }}
                                >
                                    {area}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Reviews Section (for companies) */}
                {isCompany && reviews.length > 0 && (
                    <div style={{ marginBottom: 28 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                            <h3 style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: '#9CA3AF',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                            }}>
                                Reviews
                            </h3>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '4px 10px',
                                borderRadius: 12,
                                background: '#FEF3C7',
                            }}>
                                <Star size={14} color="#FBBF24" fill="#FBBF24" />
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#D97706' }}>
                                    {averageRating}
                                </span>
                                <span style={{ fontSize: 11, color: '#B45309' }}>
                                    ({reviews.length})
                                </span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {reviews.slice(0, 5).map((review) => (
                                <div
                                    key={review.id}
                                    style={{
                                        padding: 14,
                                        borderRadius: 14,
                                        background: '#F9FAFB',
                                        border: '1px solid #E5E7EB',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                        <div style={{
                                            width: 28, height: 28, borderRadius: '50%',
                                            background: '#F0FDF4',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <User size={14} color="#22C55E" />
                                        </div>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                                            {review.seekerName || 'Seeker'}
                                        </span>
                                        <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <Star
                                                    key={star}
                                                    size={12}
                                                    color={star <= review.rating ? '#FBBF24' : '#E5E7EB'}
                                                    fill={star <= review.rating ? '#FBBF24' : 'transparent'}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    {review.comment && (
                                        <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>
                                            {review.comment}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* About Section */}
                <div style={{ marginBottom: 28 }}>
                    <h3 style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#9CA3AF',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        marginBottom: 12,
                    }}>
                        About
                    </h3>
                    <p style={{
                        fontSize: 15,
                        color: '#6B7280',
                        lineHeight: 1.7,
                    }}>
                        {aboutText}
                    </p>
                </div>

                {/* CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    style={{
                        padding: 24,
                        borderRadius: 20,
                        background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)',
                        border: '1px solid #BBF7D0',
                        textAlign: 'center',
                    }}
                >
                    {isCompany ? (
                        <>
                            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
                                Interested in their services?
                            </h3>
                            <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 16 }}>
                                Book a meeting directly with {displayName} — no app install needed.
                            </p>
                            <motion.button
                                onClick={() => setShowBooking(true)}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '14px 32px',
                                    borderRadius: 14,
                                    background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                                    color: 'white',
                                    fontSize: 16,
                                    fontWeight: 700,
                                    border: 'none',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 14px rgba(22, 163, 74, 0.3)',
                                }}
                            >
                                <CalendarPlus size={18} />
                                Book a Meeting
                            </motion.button>
                        </>
                    ) : (
                        <>
                            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
                                Want to connect?
                            </h3>
                            <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 16 }}>
                                Join PlyShip to connect with interior seekers and schedule meetings.
                            </p>
                            <motion.a
                                href="/signup"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '14px 32px',
                                    borderRadius: 14,
                                    background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                                    color: 'white',
                                    fontSize: 16,
                                    fontWeight: 700,
                                    textDecoration: 'none',
                                    boxShadow: '0 4px 14px rgba(22, 163, 74, 0.3)',
                                }}
                            >
                                Get Started &mdash; It&apos;s Free
                            </motion.a>
                        </>
                    )}
                </motion.div>

                {/* Footer */}
                <div style={{
                    marginTop: 32,
                    textAlign: 'center',
                    padding: '16px 0',
                    borderTop: '1px solid #E5E7EB',
                }}>
                    <img
                        src="/logo.png"
                        alt="PlyShip"
                        style={{ height: 20, width: 'auto', opacity: 0.5, marginBottom: 8 }}
                    />
                    <p style={{ fontSize: 11, color: '#9CA3AF' }}>
                        Connecting Interior Seekers with Interior Companies
                    </p>
                </div>
            </motion.div>

            {/* Book Meeting Modal */}
            <AnimatePresence>
                {showBooking && (
                    <BookMeetingFlow
                        company={profileData}
                        onClose={() => setShowBooking(false)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
