'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Star, MapPin, Shield, Sparkles, Heart, Phone, CheckCircle, Briefcase, Calendar, Wallet, Home, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ProfileDetail({ profile, onClose, onLike, onPass, viewerRole }) {
    const { getCompanyReviews } = useAuth();
    const [reviews, setReviews] = useState([]);

    // Determine if we're viewing a company or seeker profile
    const isCompanyProfile = profile?.role === 'COMPANY';
    const profileData = profile?.profile || {};

    // Fetch reviews for company profiles
    useEffect(() => {
        if (isCompanyProfile && profile?.id) {
            const fetchReviews = async () => {
                const companyReviews = await getCompanyReviews(profile.id);
                setReviews(companyReviews);
            };
            fetchReviews();
        }
    }, [isCompanyProfile, profile?.id, getCompanyReviews]);

    // Calculate average rating
    const averageRating = reviews.length > 0
        ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
        : 0;

    // Get display data based on profile type
    const displayName = isCompanyProfile
        ? (profileData.companyName || profile.name)
        : (profileData.name || profile.name);

    const tagline = isCompanyProfile
        ? profileData.tagline
        : `Looking for ${profileData.propertyType || 'interior design'}`;

    const location = isCompanyProfile
        ? profileData.city
        : `${profileData.locality ? profileData.locality + ', ' : ''}${profileData.city || ''}`;

    // Get image - use avatar or portfolio first image
    const image = profileData.avatar || profileData.portfolioImages?.[0] ||
        'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&q=80&w=1000';

    // Build stats based on profile type
    const stats = isCompanyProfile
        ? [
            { label: 'Projects', value: profileData.projectsCompleted || '0', icon: Sparkles },
            { label: 'Budget Range', value: profileData.minBudget ? `₹${profileData.minBudget}` : 'Contact', icon: CheckCircle },
            { label: 'Experience', value: `${profileData.yearsInBusiness || '0'}+ yrs`, icon: Calendar },
        ]
        : [
            { label: 'Property', value: profileData.propertyType || 'N/A', icon: Home },
            { label: 'Budget', value: profileData.budget ? `₹${profileData.budget}L` : 'Flexible', icon: Wallet },
            { label: 'Timeline', value: profileData.timeline?.replace('-', ' ') || 'Flexible', icon: Calendar },
        ];

    // Get tags/specializations
    const tags = isCompanyProfile
        ? [...(profileData.services || []), ...(profileData.specializations || [])].slice(0, 6)
        : [...(profileData.styles || []), ...(profileData.rooms || [])].slice(0, 6);

    // About text
    const aboutText = isCompanyProfile
        ? (profileData.portfolioDescription || `${displayName} is a professional interior design company based in ${profileData.city || 'India'}. They specialize in ${profileData.services?.join(', ') || 'various interior design services'}.`)
        : `${displayName} is looking for interior design services in ${profileData.city || 'their area'}. ${profileData.propertyType ? `They have a ${profileData.propertyType} property` : ''} ${profileData.budget ? `with a budget of ₹${profileData.budget}L` : ''}.`;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'white',
                zIndex: 250,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}
        >
            {/* Hero Image */}
            <motion.div
                initial={{ scale: 1.1 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5 }}
                style={{
                    position: 'relative',
                    height: '45%',
                    minHeight: 280,
                    overflow: 'hidden',
                }}
            >
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

                {/* Gradient Overlay */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to top, white 0%, transparent 50%)',
                }} />

                {/* Close Button */}
                <motion.button
                    onClick={onClose}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    style={{
                        position: 'absolute',
                        top: 20,
                        right: 20,
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: 'white',
                        boxShadow: 'var(--shadow-md)',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        zIndex: 10,
                    }}
                >
                    <X size={22} color="var(--text-secondary)" />
                </motion.button>

                {/* Role Badge */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
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
                        boxShadow: 'var(--shadow-md)',
                    }}
                >
                    {isCompanyProfile ? (
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
            </motion.div>

            {/* Content */}
            <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                style={{
                    flex: 1,
                    padding: '0 24px 24px',
                    marginTop: -60,
                    position: 'relative',
                    zIndex: 10,
                    overflowY: 'auto',
                }}
            >
                {/* Header Info */}
                <div style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <h1 style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: 28,
                            fontWeight: 800,
                            color: 'var(--text-primary)',
                        }}>
                            {displayName}
                        </h1>
                        {isCompanyProfile && profileData.yearsInBusiness && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '6px 12px',
                                borderRadius: 20,
                                background: 'var(--warning-light)',
                                border: '1px solid #FDE68A',
                            }}>
                                <Star size={14} color="#FBBF24" fill="#FBBF24" />
                                <span style={{ fontSize: 14, fontWeight: 700, color: '#D97706' }}>
                                    {profileData.yearsInBusiness}+ yrs
                                </span>
                            </div>
                        )}
                    </div>
                    {tagline && (
                        <p style={{
                            fontSize: 16,
                            color: 'var(--text-secondary)',
                            marginBottom: 12,
                        }}>
                            {tagline}
                        </p>
                    )}
                    {location && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <MapPin size={16} color="var(--primary)" />
                            <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>
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
                    marginBottom: 24,
                }}>
                    {stats.map((stat, index) => (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 + index * 0.1 }}
                            style={{
                                padding: 16,
                                borderRadius: 16,
                                background: 'var(--pastel-green)',
                                border: '1px solid var(--pastel-mint)',
                                textAlign: 'center',
                            }}
                        >
                            <stat.icon size={20} color="var(--primary-hover)" style={{ marginBottom: 8 }} />
                            <div style={{
                                fontSize: 16,
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                marginBottom: 4,
                                textTransform: 'capitalize',
                            }}>
                                {stat.value}
                            </div>
                            <div style={{
                                fontSize: 12,
                                color: 'var(--text-muted)',
                            }}>
                                {stat.label}
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Tags Section */}
                {tags.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                        <h3 style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: 'var(--text-tertiary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: 12,
                        }}>
                            {isCompanyProfile ? 'Services & Specializations' : 'Preferences'}
                        </h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {tags.map((tag) => (
                                <span
                                    key={tag}
                                    style={{
                                        padding: '10px 18px',
                                        borderRadius: 24,
                                        background: 'var(--pastel-green)',
                                        border: '1px solid var(--pastel-mint)',
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: 'var(--text-primary)',
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
                {isCompanyProfile && profileData.portfolioImages?.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                        <h3 style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: 'var(--text-tertiary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: 12,
                        }}>
                            Portfolio
                        </h3>
                        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
                            {profileData.portfolioImages.map((img, idx) => (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    key={idx}
                                    src={img}
                                    alt={`Portfolio ${idx + 1}`}
                                    style={{
                                        width: 120,
                                        height: 120,
                                        borderRadius: 12,
                                        objectFit: 'cover',
                                        flexShrink: 0,
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Service Areas (for companies) */}
                {isCompanyProfile && profileData.serviceAreas?.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                        <h3 style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: 'var(--text-tertiary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: 12,
                        }}>
                            Service Areas
                        </h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {profileData.serviceAreas.map((area) => (
                                <span
                                    key={area}
                                    style={{
                                        padding: '8px 14px',
                                        borderRadius: 20,
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border)',
                                        fontSize: 13,
                                        color: 'var(--text-secondary)',
                                    }}
                                >
                                    {area}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Reviews Section (for companies) */}
                {isCompanyProfile && reviews.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                            <h3 style={{
                                fontSize: 14,
                                fontWeight: 600,
                                color: 'var(--text-tertiary)',
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
                            {reviews.slice(0, 3).map((review) => (
                                <div
                                    key={review.id}
                                    style={{
                                        padding: 14,
                                        borderRadius: 12,
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-light)',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                        <div style={{
                                            width: 28,
                                            height: 28,
                                            borderRadius: '50%',
                                            background: 'var(--pastel-green)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}>
                                            <User size={14} color="var(--primary)" />
                                        </div>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
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
                                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                            {review.comment}
                                        </p>
                                    )}
                                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                                        {review.type === 'MEETING' ? '📅 Meeting' : '🏠 Project'} • {new Date(review.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* About Section */}
                <div style={{ marginBottom: 100 }}>
                    <h3 style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--text-tertiary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        marginBottom: 12,
                    }}>
                        About
                    </h3>
                    <p style={{
                        fontSize: 15,
                        color: 'var(--text-secondary)',
                        lineHeight: 1.7,
                    }}>
                        {aboutText}
                    </p>

                    {/* Contact Info — only show company phone to seekers, never show seeker phone to companies */}
                    {profileData.phone && isCompanyProfile && (
                        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Phone size={16} color="var(--primary)" />
                            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                                {profileData.phone}
                            </span>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Fixed Bottom CTA */}
            <motion.div
                initial={{ y: 100 }}
                animate={{ y: 0 }}
                transition={{ delay: 0.4, type: 'spring', bounce: 0.2 }}
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '16px 24px 32px',
                    background: 'linear-gradient(to top, white 80%, transparent)',
                    display: 'flex',
                    gap: 12,
                    zIndex: 20,
                }}
            >
                <motion.button
                    onClick={() => { onPass?.(); onClose(); }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                        flex: 1,
                        padding: '18px',
                        borderRadius: 16,
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-secondary)',
                        fontSize: 16,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                    }}
                >
                    <X size={20} />
                    Pass
                </motion.button>
                <motion.button
                    onClick={() => { onLike?.(); onClose(); }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                        flex: 1,
                        padding: '18px',
                        borderRadius: 16,
                        background: 'var(--gradient-primary)',
                        border: 'none',
                        color: 'white',
                        fontSize: 16,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        boxShadow: 'var(--shadow-glow-soft)',
                        cursor: 'pointer',
                    }}
                >
                    <Heart size={20} fill="white" />
                    Like
                </motion.button>
            </motion.div>
        </motion.div>
    );
}
