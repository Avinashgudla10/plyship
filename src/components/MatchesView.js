'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, MapPin, Briefcase, User, Users, Search, Calendar, Star, Clock, CheckCircle, SlidersHorizontal, ChevronDown, Check } from 'lucide-react';

export default function MatchesView({ allUsers = [], meetings = [], onChatClick, onMeetClick, viewerRole }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState('all');
    const [filterOpen, setFilterOpen] = useState(false);

    const isSeeker = viewerRole === 'SEEKER';
    const isCompanyViewer = viewerRole === 'COMPANY';
    const title = isSeeker ? 'Interior Companies' : 'Interior Seekers';

    const FILTERS = [
        { key: 'all', label: 'All' },
        { key: 'no_meeting', label: 'No Meeting' },
        { key: 'PENDING_ACCEPTANCE', label: 'Pending' },
        { key: 'SCHEDULED', label: 'Scheduled' },
        { key: 'CONFIRMED', label: 'Completed' },
        { key: 'ended', label: 'Cancelled' },
    ];

    // Build a map of userId -> meeting status
    const meetingStatusMap = useMemo(() => {
        const map = {};
        meetings.forEach(m => {
            const partnerId = isSeeker ? m.companyId : m.seekerId;
            if (!partnerId) return;
            const priority = { PENDING_ACCEPTANCE: 3, SCHEDULED: 3, CONFIRMED: 2, CANCELLED: 1, DECLINED: 1 };
            const existing = map[partnerId];
            if (!existing || (priority[m.status] || 0) > (priority[existing.status] || 0)) {
                map[partnerId] = m;
            }
        });
        return map;
    }, [meetings, isSeeker]);

    const filtered = allUsers.filter(u => {
        // Search filter
        if (searchTerm) {
            const s = searchTerm.toLowerCase();
            const name = (u.profile?.companyName || u.profile?.name || '').toLowerCase();
            const city = (u.profile?.city || u.city || '').toLowerCase();
            if (!name.includes(s) && !city.includes(s)) return false;
        }
        // Meeting status filter
        if (filter !== 'all') {
            const meeting = meetingStatusMap[u.id];
            const status = meeting?.status || null;
            if (filter === 'no_meeting') return !status;
            if (filter === 'ended') return ['CANCELLED', 'DECLINED'].includes(status);
            return status === filter;
        }
        return true;
    }).sort((a, b) => {
        const priorityMap = { PENDING_ACCEPTANCE: 3, SCHEDULED: 2, CONFIRMED: 1 };
        const mA = meetingStatusMap[a.id];
        const mB = meetingStatusMap[b.id];
        const pA = mA ? (priorityMap[mA.status] || 0) : 0;
        const pB = mB ? (priorityMap[mB.status] || 0) : 0;
        return pB - pA;
    });

    const getMeetingBadge = (status) => {
        switch (status) {
            case 'PENDING_ACCEPTANCE':
                return { label: '⏳ Meeting Pending', color: '#3B82F6', bg: '#EFF6FF' };
            case 'SCHEDULED':
                return { label: '📅 Meeting Scheduled', color: '#F59E0B', bg: '#FFFBEB' };
            case 'CONFIRMED':
                return { label: '✅ Meeting Done', color: '#22C55E', bg: '#F0FDF4' };
            case 'CANCELLED':
                return { label: 'Cancelled', color: '#EF4444', bg: '#FEF2F2' };
            case 'DECLINED':
                return { label: 'Declined', color: '#EF4444', bg: '#FEF2F2' };
            default:
                return null;
        }
    };

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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <h2 style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 22,
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                    }}>
                        {title}
                    </h2>

                    {/* Filter Button (Companies only) */}
                    {isCompanyViewer && (
                        <div style={{ position: 'relative' }}>
                            <motion.button
                                onClick={() => setFilterOpen(!filterOpen)}
                                whileTap={{ scale: 0.93 }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '8px 14px',
                                    borderRadius: 10,
                                    background: filter !== 'all' ? 'var(--pastel-green)' : 'var(--bg-secondary)',
                                    border: filter !== 'all' ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                                    cursor: 'pointer',
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: filter !== 'all' ? 'var(--primary)' : 'var(--text-secondary)',
                                }}
                            >
                                <SlidersHorizontal size={14} />
                                Filter
                                <ChevronDown size={14} style={{ transform: filterOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                            </motion.button>

                            <AnimatePresence>
                                {filterOpen && (
                                    <>
                                        <div onClick={() => setFilterOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 98 }} />
                                        <motion.div
                                            initial={{ opacity: 0, y: -8, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -8, scale: 0.95 }}
                                            transition={{ duration: 0.15 }}
                                            style={{
                                                position: 'absolute',
                                                top: '100%',
                                                right: 0,
                                                marginTop: 6,
                                                background: 'white',
                                                borderRadius: 14,
                                                border: '1px solid var(--border-light)',
                                                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                                padding: 6,
                                                minWidth: 160,
                                                zIndex: 99,
                                            }}
                                        >
                                            {FILTERS.map(f => (
                                                <motion.button
                                                    key={f.key}
                                                    onClick={() => { setFilter(f.key); setFilterOpen(false); }}
                                                    whileTap={{ scale: 0.97 }}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 8,
                                                        width: '100%',
                                                        padding: '10px 12px',
                                                        borderRadius: 10,
                                                        background: filter === f.key ? 'var(--pastel-green)' : 'transparent',
                                                        color: filter === f.key ? 'var(--primary)' : 'var(--text-primary)',
                                                        fontSize: 14,
                                                        fontWeight: filter === f.key ? 700 : 500,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s',
                                                        textAlign: 'left',
                                                    }}
                                                >
                                                    {filter === f.key && <Check size={14} />}
                                                    {f.label}
                                                </motion.button>
                                            ))}
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                </div>

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
                    const meeting = meetingStatusMap[userItem.id];
                    const badge = meeting ? getMeetingBadge(meeting.status) : null;
                    const hasActiveMeeting = meeting && ['PENDING_ACCEPTANCE', 'SCHEDULED'].includes(meeting.status);

                    return (
                        <motion.div
                            key={userItem.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 8,
                                padding: 14,
                                borderRadius: 14,
                                background: 'white',
                                border: badge ? `1px solid ${badge.color}30` : '1px solid var(--border-light)',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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

                                    {/* Meet Button — only show if no active meeting */}
                                    {!hasActiveMeeting && (
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
                                    )}
                                </div>
                            </div>

                            {/* Meeting Status Badge */}
                            {badge && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '6px 10px',
                                    borderRadius: 8,
                                    background: badge.bg,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: badge.color,
                                }}>
                                    {badge.label}
                                </div>
                            )}
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}
