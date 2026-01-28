'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, MapPin, Star, Briefcase, User } from 'lucide-react';

export default function MatchesView({ matches = [], onChatClick, viewerRole }) {
    if (matches.length === 0) {
        return (
            <div style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: 32,
            }}>
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', bounce: 0.5 }}
                    style={{
                        width: 80,
                        height: 80,
                        borderRadius: 24,
                        background: 'var(--pastel-green)',
                        border: '1px solid var(--pastel-mint)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 20,
                    }}
                >
                    <Heart size={36} color="var(--primary)" />
                </motion.div>
                <h2 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 24,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginBottom: 8,
                }}>
                    No matches yet
                </h2>
                <p style={{
                    fontSize: 15,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                }}>
                    Keep swiping to find your perfect match!
                </p>
            </div>
        );
    }

    return (
        <div style={{
            height: '100%',
            overflow: 'auto',
            padding: '16px',
        }}>
            <h2 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 22,
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: 16,
            }}>
                Your Matches ({matches.length})
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {matches.map((match, index) => {
                    // Firebase match data uses matchedUserRole and matchedUserProfile
                    const isCompany = match?.matchedUserRole === 'COMPANY' || match?.role === 'COMPANY';
                    const profile = match?.matchedUserProfile || match?.profile || {};
                    const name = match?.matchedUserName || (isCompany ? profile.companyName : profile.name) || match?.name;
                    const image = profile.avatar || profile.portfolioImages?.[0];
                    const city = profile.city || profile.locality;

                    return (
                        <motion.div
                            key={match.id || index}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 14,
                                padding: 16,
                                borderRadius: 16,
                                background: 'white',
                                border: '1px solid var(--border-light)',
                                boxShadow: 'var(--shadow-sm)',
                            }}
                        >
                            {/* Avatar */}
                            <div style={{
                                width: 60,
                                height: 60,
                                borderRadius: isCompany ? 16 : '50%',
                                background: image ? `url(${image}) center/cover` : 'var(--pastel-green)',
                                border: '2px solid var(--pastel-mint)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}>
                                {!image && (isCompany ? <Briefcase size={24} color="var(--primary)" /> : <User size={24} color="var(--primary)" />)}
                            </div>

                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                    <h3 style={{
                                        fontSize: 16,
                                        fontWeight: 700,
                                        color: 'var(--text-primary)',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                    }}>
                                        {name || 'Unknown'}
                                    </h3>
                                    {isCompany && profile.yearsInBusiness && (
                                        <span style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 2,
                                            fontSize: 12,
                                            color: 'var(--warning)',
                                            fontWeight: 600,
                                        }}>
                                            <Star size={12} fill="var(--warning)" />
                                            {profile.yearsInBusiness}+ yrs
                                        </span>
                                    )}
                                </div>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: 13,
                                    color: 'var(--text-muted)',
                                }}>
                                    <MapPin size={12} />
                                    {city || 'Location not set'}
                                </div>
                            </div>

                            {/* Chat Button */}
                            <motion.button
                                onClick={() => onChatClick?.(match)}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 12,
                                    background: 'var(--gradient-primary)',
                                    border: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    boxShadow: 'var(--shadow-glow-soft)',
                                }}
                            >
                                <MessageCircle size={20} color="white" />
                            </motion.button>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}
