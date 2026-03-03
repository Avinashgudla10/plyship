'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, MapPin, Briefcase, User, Users, Search, Calendar, Star } from 'lucide-react';

export default function MatchesView({ allUsers = [], onChatClick, onMeetClick, viewerRole }) {
    const [searchTerm, setSearchTerm] = useState('');

    const isSeeker = viewerRole === 'SEEKER';
    const title = isSeeker ? 'Interior Companies' : 'Interior Seekers';

    const filtered = allUsers.filter(u => {
        if (!searchTerm) return true;
        const s = searchTerm.toLowerCase();
        const name = (u.profile?.companyName || u.profile?.name || '').toLowerCase();
        const city = (u.profile?.city || u.city || '').toLowerCase();
        return name.includes(s) || city.includes(s);
    });

    if (allUsers.length === 0) {
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
                    <Users size={36} color="var(--primary)" />
                </motion.div>
                <h2 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 24,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginBottom: 8,
                }}>
                    No {isSeeker ? 'companies' : 'seekers'} yet
                </h2>
                <p style={{
                    fontSize: 15,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                }}>
                    {isSeeker ? 'Interior companies' : 'Interior seekers'} will appear here once they sign up.
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
            {/* Header */}
            <div style={{ marginBottom: 16 }}>
                <h2 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 22,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginBottom: 12,
                }}>
                    {title}
                </h2>

                {/* Search */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 14px',
                    background: 'white',
                    borderRadius: 12,
                    border: '1px solid var(--border-light)',
                }}>
                    <Search size={18} color="var(--text-muted)" />
                    <input
                        type="text"
                        placeholder={`Search ${isSeeker ? 'companies' : 'seekers'}...`}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{
                            border: 'none',
                            outline: 'none',
                            flex: 1,
                            fontSize: 14,
                            color: 'var(--text-primary)',
                            background: 'transparent',
                        }}
                    />
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                    {filtered.length} {isSeeker ? 'companies' : 'seekers'} found
                </p>
            </div>

            {/* User List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filtered.map((userItem, index) => {
                    const isCompany = userItem.role === 'COMPANY' || userItem.role === 'company';
                    const profile = userItem.profile || {};
                    const name = isCompany ? profile.companyName : profile.name;
                    const city = profile.city || userItem.city;
                    const image = profile.avatar || profile.portfolioImages?.[0];
                    const rating = profile.rating;
                    const reviewCount = profile.reviewCount;

                    return (
                        <motion.div
                            key={userItem.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                padding: 14,
                                borderRadius: 14,
                                background: 'white',
                                border: '1px solid var(--border-light)',
                            }}
                        >
                            {/* Avatar */}
                            <div style={{
                                width: 52,
                                height: 52,
                                borderRadius: isCompany ? 14 : '50%',
                                background: image ? `url(${image}) center/cover` : 'var(--pastel-green)',
                                border: '2px solid var(--pastel-mint)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}>
                                {!image && (isCompany
                                    ? <Briefcase size={22} color="var(--primary)" />
                                    : <User size={22} color="var(--primary)" />
                                )}
                            </div>

                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <h3 style={{
                                    fontSize: 15,
                                    fontWeight: 700,
                                    color: 'var(--text-primary)',
                                    marginBottom: 3,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}>
                                    {name || 'Unknown'}
                                </h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    {city && (
                                        <span style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 3,
                                            fontSize: 12,
                                            color: 'var(--text-secondary)',
                                        }}>
                                            <MapPin size={12} />
                                            {city}
                                        </span>
                                    )}
                                    {rating > 0 && (
                                        <span style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 3,
                                            fontSize: 12,
                                            color: '#F59E0B',
                                        }}>
                                            <Star size={12} fill="#F59E0B" />
                                            {rating.toFixed(1)} ({reviewCount || 0})
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                {/* Chat Button */}
                                <motion.button
                                    onClick={() => onChatClick?.({
                                        id: userItem.id,
                                        matchedUserId: userItem.id,
                                        matchedUserName: name,
                                        matchedUserRole: userItem.role,
                                        matchedUserProfile: profile,
                                    })}
                                    whileTap={{ scale: 0.9 }}
                                    style={{
                                        width: 38,
                                        height: 38,
                                        borderRadius: 10,
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-light)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <MessageCircle size={18} color="var(--text-secondary)" />
                                </motion.button>

                                {/* Meet Button */}
                                <motion.button
                                    onClick={() => onMeetClick?.(userItem)}
                                    whileTap={{ scale: 0.9 }}
                                    style={{
                                        height: 38,
                                        padding: '0 14px',
                                        borderRadius: 10,
                                        background: 'var(--gradient-primary)',
                                        border: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        cursor: 'pointer',
                                        color: 'white',
                                        fontSize: 13,
                                        fontWeight: 600,
                                    }}
                                >
                                    <Calendar size={15} />
                                    Meet
                                </motion.button>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}
