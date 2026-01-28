'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Star, MapPin, Shield, Sparkles, Briefcase, Calendar, Wallet } from 'lucide-react';

export default function ProfileCard({ profile, viewerRole }) {
    // Determine if we're viewing a company or seeker profile
    const isCompanyProfile = profile?.role === 'COMPANY';
    const profileData = profile?.profile || {};

    // Get display data based on profile type
    const displayName = isCompanyProfile
        ? (profileData.companyName || profile.name)
        : (profileData.name || profile.name);

    const tagline = isCompanyProfile
        ? profileData.tagline
        : `${profileData.propertyType || ''} ${profileData.styles?.length ? '• ' + profileData.styles.slice(0, 2).join(', ') : ''}`;

    const location = isCompanyProfile
        ? profileData.city
        : `${profileData.locality ? profileData.locality + ', ' : ''}${profileData.city || ''}`;

    const tags = isCompanyProfile
        ? profileData.specializations?.slice(0, 3) || []
        : profileData.styles?.slice(0, 3) || [];

    const budget = isCompanyProfile
        ? profileData.minBudget
        : profileData.budget;

    const projectsOrTimeline = isCompanyProfile
        ? `${profileData.projectsCompleted || 0} projects`
        : profileData.timeline?.replace('-', ' ') || '';

    // Get image - use avatar or portfolio first image
    const image = profileData.avatar || profileData.portfolioImages?.[0] ||
        'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&q=80&w=1000';

    return (
        <motion.div
            style={{
                width: '100%',
                height: '100%',
                borderRadius: 24,
                overflow: 'hidden',
                position: 'relative',
                background: 'white',
                boxShadow: 'var(--shadow-lg)',
                border: '1px solid var(--border-light)'
            }}
        >
            {/* Background Image */}
            <div style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `url(${image})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            }} />

            {/* Gradient Overlay */}
            <div style={{
                position: 'absolute',
                inset: 0,
                background: `
                    linear-gradient(to top, 
                        rgba(0, 0, 0, 0.85) 0%,
                        rgba(0, 0, 0, 0.5) 35%,
                        rgba(0, 0, 0, 0.2) 55%,
                        transparent 100%
                    )
                `,
            }} />

            {/* Top Badge - Role */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                style={{
                    position: 'absolute',
                    top: 16,
                    left: 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 20,
                    background: 'rgba(255, 255, 255, 0.95)',
                    boxShadow: 'var(--shadow-sm)',
                }}
            >
                {isCompanyProfile ? (
                    <>
                        <Briefcase size={14} color="#22C55E" />
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#22C55E' }}>
                            Company
                        </span>
                    </>
                ) : (
                    <>
                        <Shield size={14} color="#22C55E" fill="#22C55E" />
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#22C55E' }}>
                            Seeker
                        </span>
                    </>
                )}
            </motion.div>

            {/* Rating Badge (for companies) or Budget (for seekers) */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                style={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '8px 12px',
                    borderRadius: 16,
                    background: 'rgba(255, 255, 255, 0.95)',
                    boxShadow: 'var(--shadow-sm)',
                }}
            >
                {isCompanyProfile ? (
                    <>
                        <Star size={14} color="#FBBF24" fill="#FBBF24" />
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                            {profileData.yearsInBusiness || '5'}+ yrs
                        </span>
                    </>
                ) : (
                    <>
                        <Wallet size={14} color="#22C55E" />
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                            {budget ? `₹${budget}L` : 'Flexible'}
                        </span>
                    </>
                )}
            </motion.div>

            {/* Content */}
            <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '24px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
            }}>
                {/* Name & Tagline */}
                <div>
                    <h2 style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 26,
                        fontWeight: 800,
                        color: 'white',
                        marginBottom: 6,
                        lineHeight: 1.2,
                    }}>
                        {displayName}
                    </h2>
                    {tagline && (
                        <p style={{
                            fontSize: 15,
                            color: 'rgba(255, 255, 255, 0.8)',
                            fontWeight: 500,
                        }}>
                            {tagline}
                        </p>
                    )}
                </div>

                {/* Stats Bar */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: '12px 16px',
                    borderRadius: 16,
                    background: 'rgba(255, 255, 255, 0.15)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                }}>
                    {location && (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <MapPin size={14} color="#4ADE80" />
                                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
                                    {location}
                                </span>
                            </div>
                            <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.3)' }} />
                        </>
                    )}
                    {projectsOrTimeline && (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {isCompanyProfile ? (
                                    <Sparkles size={14} color="#86EFAC" />
                                ) : (
                                    <Calendar size={14} color="#86EFAC" />
                                )}
                                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
                                    {projectsOrTimeline}
                                </span>
                            </div>
                        </>
                    )}
                </div>

                {/* Tags */}
                {tags.length > 0 && (
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 8,
                    }}>
                        {tags.map((tag, index) => (
                            <motion.span
                                key={tag}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.3 + index * 0.05 }}
                                style={{
                                    padding: '6px 14px',
                                    borderRadius: 20,
                                    background: 'rgba(74, 222, 128, 0.2)',
                                    border: '1px solid rgba(74, 222, 128, 0.4)',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: 'white',
                                    textTransform: 'capitalize',
                                }}
                            >
                                {tag.replace('-', ' ')}
                            </motion.span>
                        ))}
                    </div>
                )}
            </div>
        </motion.div>
    );
}
