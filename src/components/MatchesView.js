'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle, MapPin, Star, Briefcase, User, Users, Check, X, Clock, Loader2 } from 'lucide-react';

export default function MatchesView({ matches = [], pendingRequests = [], onChatClick, onAccept, onRefuse, viewerRole }) {
    const [actionLoading, setActionLoading] = useState(null);

    const handleAccept = async (request) => {
        setActionLoading(`accept-${request.id}`);
        await onAccept?.(request);
        setActionLoading(null);
    };

    const handleRefuse = async (request) => {
        setActionLoading(`refuse-${request.id}`);
        await onRefuse?.(request);
        setActionLoading(null);
    };

    const hasContent = matches.length > 0 || pendingRequests.length > 0;

    if (!hasContent) {
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
                    No connections yet
                </h2>
                <p style={{
                    fontSize: 15,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                }}>
                    Keep swiping to find your perfect connection!
                </p>
            </div>
        );
    }

    const renderAvatar = (profile, isCompany, image) => (
        <div style={{
            width: 56,
            height: 56,
            borderRadius: isCompany ? 14 : '50%',
            background: image ? `url(${image}) center/cover` : 'var(--pastel-green)',
            border: '2px solid var(--pastel-mint)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
        }}>
            {!image && (isCompany ? <Briefcase size={22} color="var(--primary)" /> : <User size={22} color="var(--primary)" />)}
        </div>
    );

    return (
        <div style={{
            height: '100%',
            overflow: 'auto',
            padding: '16px',
        }}>
            {/* Pending Connection Requests */}
            {pendingRequests.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 14,
                    }}>
                        <Clock size={18} color="#F59E0B" />
                        <h2 style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: 18,
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                        }}>
                            Connection Requests ({pendingRequests.length})
                        </h2>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <AnimatePresence>
                            {pendingRequests.map((request, index) => {
                                const isCompany = request?.role === 'COMPANY';
                                const profile = request?.profile || {};
                                const name = request?.name || (isCompany ? profile.companyName : profile.name) || 'Unknown';
                                const image = profile.avatar || profile.portfolioImages?.[0];
                                const city = profile.city || profile.locality;
                                const isAccepting = actionLoading === `accept-${request.id}`;
                                const isRefusing = actionLoading === `refuse-${request.id}`;
                                const isDisabled = !!actionLoading;

                                return (
                                    <motion.div
                                        key={request.id || index}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, x: -100, height: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        style={{
                                            padding: 14,
                                            borderRadius: 16,
                                            background: '#FFFBEB',
                                            border: '1px solid #FDE68A',
                                            boxShadow: '0 2px 8px rgba(245, 158, 11, 0.08)',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            {renderAvatar(profile, isCompany, image)}

                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <h3 style={{
                                                    fontSize: 15,
                                                    fontWeight: 700,
                                                    color: 'var(--text-primary)',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    marginBottom: 2,
                                                }}>
                                                    {name}
                                                </h3>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 4,
                                                    fontSize: 12,
                                                    color: 'var(--text-muted)',
                                                }}>
                                                    {city && <><MapPin size={11} /> {city}</>}
                                                    {!city && <span>{isCompany ? 'Interior Company' : 'Interior Seeker'}</span>}
                                                </div>
                                            </div>

                                            {/* Accept / Refuse Buttons */}
                                            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                                <motion.button
                                                    onClick={() => handleRefuse(request)}
                                                    disabled={isDisabled}
                                                    whileTap={{ scale: 0.9 }}
                                                    style={{
                                                        width: 40,
                                                        height: 40,
                                                        borderRadius: 12,
                                                        background: 'white',
                                                        border: '1.5px solid #FCA5A5',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        cursor: isDisabled ? 'wait' : 'pointer',
                                                        opacity: isDisabled && !isRefusing ? 0.5 : 1,
                                                    }}
                                                >
                                                    {isRefusing ? <Loader2 size={16} color="#EF4444" className="spin" /> : <X size={18} color="#EF4444" />}
                                                </motion.button>

                                                <motion.button
                                                    onClick={() => handleAccept(request)}
                                                    disabled={isDisabled}
                                                    whileTap={{ scale: 0.9 }}
                                                    style={{
                                                        width: 40,
                                                        height: 40,
                                                        borderRadius: 12,
                                                        background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                                                        border: 'none',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        cursor: isDisabled ? 'wait' : 'pointer',
                                                        opacity: isDisabled && !isAccepting ? 0.5 : 1,
                                                        boxShadow: '0 2px 8px rgba(34, 197, 94, 0.25)',
                                                    }}
                                                >
                                                    {isAccepting ? <Loader2 size={16} color="white" className="spin" /> : <Check size={18} color="white" />}
                                                </motion.button>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                </div>
            )}

            {/* Confirmed Connections */}
            {matches.length > 0 && (
                <div>
                    <h2 style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 18,
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        marginBottom: 14,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                    }}>
                        <Users size={18} color="var(--primary)" />
                        Your Connections ({matches.length})
                    </h2>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {matches.map((match, index) => {
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
                                    transition={{ delay: index * 0.05 }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 14,
                                        padding: 14,
                                        borderRadius: 16,
                                        background: 'white',
                                        border: '1px solid var(--border-light)',
                                        boxShadow: 'var(--shadow-sm)',
                                    }}
                                >
                                    {renderAvatar(profile, isCompany, image)}

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                            <h3 style={{
                                                fontSize: 15,
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
                                                    fontSize: 11,
                                                    color: 'var(--warning)',
                                                    fontWeight: 600,
                                                }}>
                                                    <Star size={11} fill="var(--warning)" />
                                                    {profile.yearsInBusiness}+ yrs
                                                </span>
                                            )}
                                        </div>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 4,
                                            fontSize: 12,
                                            color: 'var(--text-muted)',
                                        }}>
                                            <MapPin size={11} />
                                            {city || 'Location not set'}
                                        </div>
                                    </div>

                                    {/* Chat Button */}
                                    <motion.button
                                        onClick={() => onChatClick?.(match)}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        style={{
                                            width: 42,
                                            height: 42,
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
                                        <MessageCircle size={18} color="white" />
                                    </motion.button>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
