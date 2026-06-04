'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AvatarUpload, PortfolioUpload } from './ImageUpload';
import {
    User, Users, Settings, LogOut, ChevronRight, Heart, MessageCircle,
    Bell, Shield, HelpCircle, Star, MapPin, Briefcase, Edit2, Camera,
    ArrowLeft, Check, X, Wallet, Calendar, Home, Loader2, CloudUpload,
    Share2, Copy, Link, ExternalLink, LocateFixed
} from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Main Profile View with navigation
// ============ SHARE PROFILE MODAL ============
function ShareProfileModal({ isOpen, onClose, userId, username }) {
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const getProfileUrl = () => {
        if (typeof window === 'undefined') return '';
        // Use short username link if available, otherwise fall back to ID
        if (username) return `${window.location.origin}/u/${username}`;
        return `${window.location.origin}/profile/${userId}`;
    };

    const handleCopy = async () => {
        const url = getProfileUrl();
        try {
            // Try navigator.clipboard first
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(url);
            } else {
                // Fallback for older browsers / Capacitor WebView
                const textarea = document.createElement('textarea');
                textarea.value = url;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleNativeShare = async () => {
        const url = getProfileUrl();
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Check out my PlyShip profile',
                    text: 'View my interior design profile on PlyShip',
                    url: url,
                });
            } catch (err) {
                // User cancelled share
            }
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 9999,
                        background: 'rgba(0, 0, 0, 0.45)',
                        backdropFilter: 'blur(6px)',
                        WebkitBackdropFilter: 'blur(6px)',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                    }}
                >
                    <motion.div
                        initial={{ y: 200, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 200, opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: '100%',
                            maxWidth: 420,
                            background: 'white',
                            borderRadius: '24px 24px 0 0',
                            padding: '24px 20px calc(env(safe-area-inset-bottom, 0px) + 24px)',
                            boxShadow: '0 -8px 40px rgba(0, 0, 0, 0.12)',
                        }}
                    >
                        {/* Drag Handle */}
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                            <div style={{
                                width: 40, height: 4, borderRadius: 2,
                                background: '#E5E7EB',
                            }} />
                        </div>

                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                            <div style={{
                                width: 44, height: 44, borderRadius: 12,
                                background: 'var(--pastel-green)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Share2 size={22} color="var(--primary)" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                                    Share Profile
                                </h3>
                                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                    Anyone with this link can view your profile
                                </p>
                            </div>
                        </div>

                        {/* URL Box */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '12px 14px',
                            borderRadius: 14,
                            background: 'var(--bg-secondary)',
                            border: '1.5px solid var(--border-light)',
                            marginBottom: 16,
                        }}>
                            <Link size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
                            <span style={{
                                flex: 1,
                                fontSize: 13,
                                color: 'var(--text-secondary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                fontFamily: 'monospace',
                            }}>
                                {getProfileUrl()}
                            </span>
                        </div>

                        {/* Copy Button */}
                        <motion.button
                            onClick={handleCopy}
                            whileTap={{ scale: 0.97 }}
                            style={{
                                width: '100%',
                                padding: '16px',
                                borderRadius: 14,
                                background: copied
                                    ? 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)'
                                    : 'var(--gradient-primary)',
                                border: 'none',
                                color: 'white',
                                fontSize: 15,
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                cursor: 'pointer',
                                boxShadow: copied
                                    ? '0 4px 14px rgba(22, 163, 74, 0.3)'
                                    : 'var(--shadow-glow-soft)',
                                transition: 'background 0.2s, box-shadow 0.2s',
                            }}
                        >
                            {copied ? (
                                <>
                                    <Check size={18} strokeWidth={3} />
                                    Link Copied!
                                </>
                            ) : (
                                <>
                                    <Copy size={18} />
                                    Copy Profile Link
                                </>
                            )}
                        </motion.button>

                        {/* Native Share (if supported) */}
                        {typeof navigator !== 'undefined' && navigator.share && (
                            <motion.button
                                onClick={handleNativeShare}
                                whileTap={{ scale: 0.97 }}
                                style={{
                                    width: '100%',
                                    marginTop: 10,
                                    padding: '14px',
                                    borderRadius: 14,
                                    background: 'var(--bg-secondary)',
                                    border: '1.5px solid var(--border-light)',
                                    color: 'var(--text-primary)',
                                    fontSize: 15,
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    cursor: 'pointer',
                                }}
                            >
                                <ExternalLink size={18} color="var(--primary)" />
                                More Share Options
                            </motion.button>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// Main Profile View with navigation
export default function ProfileView({ onNavigate }) {
    const { user, logout, getMatches, getChats } = useAuth();
    const isCompany = user?.role === 'COMPANY';
    const profile = user?.profile || {};
    const [connectionCount, setConnectionCount] = useState('-');
    const [messageCount, setMessageCount] = useState('-');
    const [showShareModal, setShowShareModal] = useState(false);

    useEffect(() => {
        const loadStats = async () => {
            try {
                const [matches, chats] = await Promise.all([getMatches(), getChats()]);
                setConnectionCount(matches?.length || 0);
                setMessageCount(chats?.length || 0);
            } catch (e) {
                console.error('Error loading profile stats:', e);
            }
        };
        if (user?.profileComplete) loadStats();
    }, [user, getMatches, getChats]);

    const name = isCompany ? profile.companyName : profile.name;
    const image = profile.avatar || profile.portfolioImages?.[0];
    const subtitle = isCompany
        ? profile.tagline
        : `${profile.propertyType || ''} • ${profile.city || ''}`;

    const menuItems = [
        { id: 'wallet', icon: Wallet, label: isCompany ? 'Company Wallet' : 'My Earnings', badge: null },
        { id: 'meetings', icon: Calendar, label: 'Meetings', badge: null },
        { id: 'projects', icon: Home, label: 'My Projects', badge: null },
        { id: 'edit', icon: Edit2, label: 'Edit Profile', badge: null },
        { id: 'notifications', icon: Bell, label: 'Notifications', badge: null },
        { id: 'privacy', icon: Shield, label: 'Privacy & Security', badge: null },
        { id: 'settings', icon: Settings, label: 'App Settings', badge: null },
        { id: 'help', icon: HelpCircle, label: 'Help & Support', badge: null },
    ];

    return (
        <div style={{
            height: '100%',
            overflow: 'auto',
            background: 'var(--bg-secondary)',
        }}>
            {/* Share Profile Modal */}
            <ShareProfileModal
                isOpen={showShareModal}
                onClose={() => setShowShareModal(false)}
                userId={user?.id}
                username={user?.username}
            />

            {/* Profile Header */}
            <div style={{
                background: 'white',
                padding: '24px 20px',
                borderBottom: '1px solid var(--border-light)',
            }}>
                {/* Share Button — top right */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                    <motion.button
                        onClick={() => setShowShareModal(true)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '8px 14px',
                            borderRadius: 10,
                            background: 'var(--pastel-green)',
                            border: '1.5px solid var(--pastel-mint)',
                            cursor: 'pointer',
                            fontSize: 13,
                            fontWeight: 600,
                            color: 'var(--primary-hover)',
                        }}
                    >
                        <Share2 size={15} />
                        Share Profile
                    </motion.button>
                </div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                }}>
                    {/* Avatar */}
                    <div style={{ position: 'relative' }}>
                        <div style={{
                            width: 80,
                            height: 80,
                            borderRadius: isCompany ? 20 : '50%',
                            background: image ? `url(${image}) center/cover` : 'var(--pastel-green)',
                            border: '3px solid var(--pastel-mint)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            {!image && (isCompany ? <Briefcase size={32} color="var(--primary)" /> : <User size={32} color="var(--primary)" />)}
                        </div>
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => onNavigate?.('edit')}
                            style={{
                                position: 'absolute',
                                bottom: -4,
                                right: -4,
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                background: 'var(--gradient-primary)',
                                border: '2px solid white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                            }}
                        >
                            <Camera size={12} color="white" />
                        </motion.button>
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <h2 style={{
                                fontFamily: 'var(--font-display)',
                                fontSize: 20,
                                fontWeight: 800,
                                color: 'var(--text-primary)',
                            }}>
                                {name || 'Set your name'}
                            </h2>
                            <span style={{
                                padding: '2px 8px',
                                borderRadius: 8,
                                background: 'var(--pastel-green)',
                                fontSize: 10,
                                fontWeight: 600,
                                color: 'var(--primary-hover)',
                            }}>
                                {isCompany ? 'COMPANY' : 'SEEKER'}
                            </span>
                        </div>
                        <p style={{
                            fontSize: 13,
                            color: 'var(--text-muted)',
                            marginBottom: 8,
                        }}>
                            {subtitle || 'Complete your profile'}
                        </p>
                        {profile.city && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <MapPin size={12} color="var(--primary)" />
                                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                    {profile.city}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Stats */}
                <div style={{
                    display: 'flex',
                    gap: 12,
                    marginTop: 20,
                }}>
                    {[
                        { label: 'Connections', value: connectionCount, icon: Users },
                        { label: 'Messages', value: messageCount, icon: MessageCircle },
                    ].map((stat) => (
                        <div key={stat.label} style={{
                            flex: 1,
                            padding: '14px 12px',
                            borderRadius: 14,
                            background: 'var(--pastel-green)',
                            border: '1px solid var(--pastel-mint)',
                            textAlign: 'center',
                        }}>
                            <div style={{
                                fontSize: 20,
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                marginBottom: 2,
                            }}>
                                {stat.value}
                            </div>
                            <div style={{
                                fontSize: 11,
                                color: 'var(--text-muted)',
                            }}>
                                {stat.label}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Menu Items */}
            <div style={{ padding: '16px' }}>
                <div style={{
                    background: 'white',
                    borderRadius: 16,
                    overflow: 'hidden',
                    border: '1px solid var(--border-light)',
                }}>
                    {menuItems.map((item, index) => (
                        <motion.button
                            key={item.id}
                            onClick={() => onNavigate?.(item.id)}
                            whileTap={{ scale: 0.98 }}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 14,
                                padding: '16px 18px',
                                background: 'transparent',
                                border: 'none',
                                borderBottom: index < menuItems.length - 1 ? '1px solid var(--border-light)' : 'none',
                                cursor: 'pointer',
                                textAlign: 'left',
                            }}
                        >
                            <div style={{
                                width: 38,
                                height: 38,
                                borderRadius: 10,
                                background: 'var(--pastel-green)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}>
                                <item.icon size={18} color="var(--primary)" />
                            </div>
                            <span style={{
                                flex: 1,
                                fontSize: 15,
                                fontWeight: 500,
                                color: 'var(--text-primary)',
                            }}>
                                {item.label}
                            </span>
                            {item.badge && (
                                <span style={{
                                    padding: '4px 10px',
                                    borderRadius: 12,
                                    background: 'var(--primary)',
                                    color: 'white',
                                    fontSize: 12,
                                    fontWeight: 600,
                                }}>
                                    {item.badge}
                                </span>
                            )}
                            <ChevronRight size={18} color="var(--text-muted)" />
                        </motion.button>
                    ))}
                </div>

                {/* Logout Button */}
                <motion.button
                    onClick={logout}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    style={{
                        width: '100%',
                        marginTop: 16,
                        padding: '16px',
                        borderRadius: 14,
                        background: 'white',
                        border: '1px solid var(--error)',
                        color: 'var(--error)',
                        fontSize: 15,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        cursor: 'pointer',
                    }}
                >
                    <LogOut size={18} />
                    Log Out
                </motion.button>

                <p style={{
                    textAlign: 'center',
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    marginTop: 20,
                }}>
                    PLYSHIP v1.0.0
                </p>
            </div>
        </div>
    );
}

// Edit Profile Page - Full Form
export function EditProfileView({ onBack }) {
    const { user, completeProfile, updateUsername } = useAuth();
    const { showToast } = useToast();
    const isCompany = user?.role === 'COMPANY';

    // Initialize profile with default arrays to avoid mutation
    const [profile, setProfile] = useState(() => {
        const initialProfile = user?.profile || {};
        return {
            ...initialProfile,
            styles: initialProfile.styles || [],
            rooms: initialProfile.rooms || [],
            services: initialProfile.services || [],
            specializations: initialProfile.specializations || [],
            serviceAreas: initialProfile.serviceAreas || [],
            portfolioImages: initialProfile.portfolioImages || [],
        };
    });
    const [isSaving, setIsSaving] = useState(false);
    const [saveStage, setSaveStage] = useState(''); // 'uploading', 'saving', 'done'

    // Username editing
    const [editingUsername, setEditingUsername] = useState(false);
    const [usernameInput, setUsernameInput] = useState(user?.username || '');
    const [usernameError, setUsernameError] = useState('');
    const [usernameSaving, setUsernameSaving] = useState(false);

    const handleSave = async () => {
        if (isSaving) return;
        setIsSaving(true);

        // Determine if we have images to upload
        const hasNewAvatar = profile.avatar && profile.avatar.startsWith('data:');
        const hasNewPortfolio = profile.portfolioImages?.some(img => img?.startsWith('data:'));

        if (hasNewAvatar || hasNewPortfolio) {
            setSaveStage('uploading');
        } else {
            setSaveStage('saving');
        }

        // Brief delay so animation renders
        await new Promise(r => setTimeout(r, 300));

        const result = await completeProfile(profile);

        if (result?.success) {
            setSaveStage('done');
            await new Promise(r => setTimeout(r, 1000));
            setIsSaving(false);
            setSaveStage('');
            onBack?.();
        } else {
            setIsSaving(false);
            setSaveStage('');
            showToast('Error saving profile: ' + (result?.error || 'Unknown error'), 'error');
        }
    };

    const toggleArrayItem = (field, value) => {
        const arr = profile[field] || [];
        const newArr = arr.includes(value)
            ? arr.filter(v => v !== value)
            : [...arr, value];
        setProfile({ ...profile, [field]: newArr });
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', position: 'relative' }}>
            {/* ====== SAVE OVERLAY ====== */}
            <AnimatePresence>
                {saveStage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'absolute',
                            inset: 0,
                            zIndex: 99999,
                            background: 'rgba(255,255,255,0.92)',
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 20,
                        }}
                    >
                        {saveStage === 'done' ? (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', damping: 12 }}
                                style={{
                                    width: 72,
                                    height: 72,
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #16A34A, #22C55E)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 8px 32px rgba(22, 163, 74, 0.3)',
                                }}
                            >
                                <Check size={36} color="white" strokeWidth={3} />
                            </motion.div>
                        ) : (
                            <motion.div
                                style={{
                                    width: 72,
                                    height: 72,
                                    borderRadius: '50%',
                                    background: 'var(--pastel-green)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    position: 'relative',
                                }}
                            >
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                                    style={{
                                        position: 'absolute',
                                        inset: -4,
                                        borderRadius: '50%',
                                        border: '3px solid transparent',
                                        borderTopColor: 'var(--primary)',
                                        borderRightColor: 'var(--primary)',
                                    }}
                                />
                                {saveStage === 'uploading' ? (
                                    <CloudUpload size={28} color="var(--primary)" />
                                ) : (
                                    <Loader2 size={28} color="var(--primary)" />
                                )}
                            </motion.div>
                        )}

                        <motion.div
                            key={saveStage}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            style={{ textAlign: 'center' }}
                        >
                            <p style={{
                                fontSize: 18,
                                fontWeight: 700,
                                color: saveStage === 'done' ? '#16A34A' : 'var(--text-primary)',
                                marginBottom: 4,
                            }}>
                                {saveStage === 'uploading' && 'Uploading photos...'}
                                {saveStage === 'saving' && 'Saving changes...'}
                                {saveStage === 'done' && 'Profile updated! \u2705'}
                            </p>
                            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                {saveStage === 'uploading' && 'This may take a moment'}
                                {saveStage === 'saving' && 'Almost there...'}
                                {saveStage === 'done' && ''}
                            </p>
                        </motion.div>

                        {saveStage !== 'done' && (
                            <div style={{ display: 'flex', gap: 6 }}>
                                {[0, 1, 2].map((i) => (
                                    <motion.div
                                        key={i}
                                        animate={{
                                            scale: [1, 1.4, 1],
                                            opacity: [0.3, 1, 0.3],
                                        }}
                                        transition={{
                                            duration: 1.2,
                                            repeat: Infinity,
                                            delay: i * 0.2,
                                        }}
                                        style={{
                                            width: 7,
                                            height: 7,
                                            borderRadius: '50%',
                                            background: 'var(--primary)',
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
                paddingBottom: '16px',
                paddingLeft: '20px',
                paddingRight: '20px',
                background: 'white',
                borderBottom: '1px solid var(--border-light)',
            }}>
                <motion.button onClick={onBack} whileTap={{ scale: 0.9 }} style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'var(--bg-secondary)', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}>
                    <ArrowLeft size={20} color="var(--text-secondary)" />
                </motion.button>
                <h2 style={{ flex: 1, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Edit Profile
                </h2>
                <motion.button onClick={handleSave} disabled={isSaving} whileTap={{ scale: 0.95 }} style={{
                    padding: '8px 16px', borderRadius: 10,
                    background: isSaving ? 'var(--primary-muted)' : 'var(--gradient-primary)', border: 'none',
                    color: 'white', fontSize: 14, fontWeight: 600, cursor: isSaving ? 'wait' : 'pointer',
                    opacity: isSaving ? 0.7 : 1,
                }}>
                    {isSaving ? 'Saving...' : 'Save'}
                </motion.button>
            </div>

            {/* Form */}
            <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
                {/* Avatar */}
                <div style={{ marginBottom: 24 }}>
                    <AvatarUpload
                        image={profile.avatar}
                        onImageChange={(img) => setProfile({ ...profile, avatar: img })}
                        isCompany={isCompany}
                    />
                    <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                        Tap to change {isCompany ? 'logo' : 'photo'}
                    </p>
                </div>

                {/* ============ USERNAME ============ */}
                <SectionTitle>Username</SectionTitle>
                <div style={{ marginBottom: 24, padding: 16, borderRadius: 14, background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
                    {!editingUsername ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                                    @{user?.username || 'not set'}
                                </p>
                                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                    plyship.com/u/{user?.username || '...'}
                                </p>
                            </div>
                            <motion.button onClick={() => { setEditingUsername(true); setUsernameInput(user?.username || ''); setUsernameError(''); }} whileTap={{ scale: 0.95 }} style={{
                                padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                                background: 'var(--primary-light)', color: 'var(--primary-hover)', border: 'none', cursor: 'pointer',
                            }}>
                                <Edit2 size={12} style={{ marginRight: 4 }} /> Edit
                            </motion.button>
                        </div>
                    ) : (
                        <div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>@</span>
                                <input
                                    value={usernameInput}
                                    onChange={(e) => {
                                        const v = e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 25);
                                        setUsernameInput(v);
                                        setUsernameError('');
                                    }}
                                    placeholder="your.username"
                                    style={{
                                        flex: 1, padding: '10px 14px', borderRadius: 10, fontSize: 14, fontWeight: 500,
                                        border: usernameError ? '1px solid var(--error)' : '1px solid var(--border)',
                                        background: 'white', outline: 'none', color: 'var(--text-primary)',
                                    }}
                                />
                            </div>
                            {usernameError && <p style={{ fontSize: 11, color: 'var(--error)', marginTop: 6 }}>{usernameError}</p>}
                            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>Only lowercase letters, numbers, dots & underscores. Min 3 chars.</p>
                            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                <motion.button
                                    disabled={usernameSaving}
                                    onClick={async () => {
                                        if (usernameInput.length < 3) { setUsernameError('Min 3 characters'); return; }
                                        setUsernameSaving(true);
                                        const result = await updateUsername(usernameInput);
                                        setUsernameSaving(false);
                                        if (result.success) {
                                            setEditingUsername(false);
                                            showToast('Username updated!', 'success');
                                        } else {
                                            setUsernameError(result.error || 'Failed to update');
                                        }
                                    }}
                                    whileTap={{ scale: 0.95 }}
                                    style={{
                                        padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                                        background: 'var(--gradient-primary)', color: 'white', border: 'none', cursor: 'pointer',
                                        opacity: usernameSaving ? 0.6 : 1,
                                    }}
                                >
                                    {usernameSaving ? 'Saving...' : 'Save'}
                                </motion.button>
                                <motion.button
                                    onClick={() => { setEditingUsername(false); setUsernameError(''); }}
                                    whileTap={{ scale: 0.95 }}
                                    style={{
                                        padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                                        background: 'var(--bg-muted)', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer',
                                    }}
                                >
                                    Cancel
                                </motion.button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ============ SEEKER FIELDS ============ */}
                {!isCompany && (
                    <>
                        <SectionTitle>Basic Info</SectionTitle>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
                            <InputField label="Full Name" value={profile.name} onChange={(v) => setProfile({ ...profile, name: v })} />
                            <InputField label="Phone" value={profile.phone} onChange={(v) => setProfile({ ...profile, phone: v })} />
                        </div>

                        <SectionTitle>Location</SectionTitle>
                        <LocationDetector
                            city={profile.city}
                            locality={profile.locality}
                            onUpdate={(city, locality, lat, lng) => setProfile(prev => ({
                                ...prev, city, locality,
                                ...(lat ? { lat } : {}),
                                ...(lng ? { lng } : {}),
                            }))}
                        />

                        <SectionTitle>Property Type</SectionTitle>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
                            {['1 BHK', '2 BHK', '3 BHK', '4+ BHK', 'Villa', 'Office'].map((type) => (
                                <ChipButton key={type} selected={profile.propertyType === type} onClick={() => setProfile({ ...profile, propertyType: type })}>
                                    {type}
                                </ChipButton>
                            ))}
                        </div>

                        <SectionTitle>Design Styles</SectionTitle>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 24 }}>
                            {[
                                { id: 'modern', label: 'Modern', emoji: '🏢' },
                                { id: 'minimalist', label: 'Minimalist', emoji: '⬜' },
                                { id: 'traditional', label: 'Traditional', emoji: '🏛️' },
                                { id: 'contemporary', label: 'Contemporary', emoji: '✨' },
                                { id: 'industrial', label: 'Industrial', emoji: '🏭' },
                                { id: 'scandinavian', label: 'Scandinavian', emoji: '🪵' },
                            ].map((style) => (
                                <EmojiChip key={style.id} item={style} selected={profile.styles?.includes(style.id)} onClick={() => toggleArrayItem('styles', style.id)} />
                            ))}
                        </div>

                        <SectionTitle>Rooms to Design</SectionTitle>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 24 }}>
                            {[
                                { id: 'living', label: 'Living Room', emoji: '🛋️' },
                                { id: 'bedroom', label: 'Bedroom', emoji: '🛏️' },
                                { id: 'kitchen', label: 'Kitchen', emoji: '🍳' },
                                { id: 'bathroom', label: 'Bathroom', emoji: '🚿' },
                                { id: 'office', label: 'Home Office', emoji: '💼' },
                                { id: 'full', label: 'Full Home', emoji: '🏠' },
                            ].map((room) => (
                                <EmojiChip key={room.id} item={room} selected={profile.rooms?.includes(room.id)} onClick={() => toggleArrayItem('rooms', room.id)} />
                            ))}
                        </div>

                        <SectionTitle>Budget</SectionTitle>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                            {[
                                { id: '3-5', label: '₹3L - ₹5L', desc: 'Budget Friendly' },
                                { id: '5-10', label: '₹5L - ₹10L', desc: 'Mid Range' },
                                { id: '10-20', label: '₹10L - ₹20L', desc: 'Premium' },
                                { id: '20+', label: '₹20L+', desc: 'Luxury' },
                            ].map((b) => (
                                <RadioOption key={b.id} item={b} selected={profile.budget === b.id} onClick={() => setProfile({ ...profile, budget: b.id })} />
                            ))}
                        </div>

                        <SectionTitle>Timeline</SectionTitle>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 24 }}>
                            {[
                                { id: 'immediate', label: 'Immediately' },
                                { id: '1-3months', label: '1-3 Months' },
                                { id: '3-6months', label: '3-6 Months' },
                                { id: 'exploring', label: 'Just Exploring' },
                            ].map((t) => (
                                <ChipButton key={t.id} selected={profile.timeline === t.id} onClick={() => setProfile({ ...profile, timeline: t.id })}>
                                    {t.label}
                                </ChipButton>
                            ))}
                        </div>
                    </>
                )}

                {/* ============ COMPANY FIELDS ============ */}
                {isCompany && (
                    <>
                        <SectionTitle>Company Info</SectionTitle>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
                            <InputField label="Company Name" value={profile.companyName} onChange={(v) => setProfile({ ...profile, companyName: v })} />
                            <InputField label="Tagline" value={profile.tagline} onChange={(v) => setProfile({ ...profile, tagline: v })} />
                            <InputField label="Phone" value={profile.phone} onChange={(v) => setProfile({ ...profile, phone: v })} />
                            <InputField label="Years in Business" value={profile.yearsInBusiness} onChange={(v) => setProfile({ ...profile, yearsInBusiness: v })} />
                        </div>

                        <SectionTitle>Location</SectionTitle>
                        <LocationDetector
                            city={profile.city}
                            locality={profile.locality}
                            onUpdate={(city, locality, lat, lng) => setProfile(prev => ({
                                ...prev, city, locality,
                                ...(lat ? { lat } : {}),
                                ...(lng ? { lng } : {}),
                            }))}
                        />

                        <SectionTitle>Service Areas</SectionTitle>
                        <ServiceAreasPicker profile={profile} toggleArrayItem={toggleArrayItem} setProfile={setProfile} />

                        <SectionTitle>Services</SectionTitle>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 24 }}>
                            {[
                                { id: 'residential', label: 'Residential', emoji: '🏠' },
                                { id: 'commercial', label: 'Commercial', emoji: '🏢' },
                                { id: 'modular', label: 'Modular Kitchen', emoji: '🍳' },
                                { id: 'renovation', label: 'Renovation', emoji: '🔨' },
                                { id: 'consultation', label: 'Consultation', emoji: '💬' },
                                { id: 'turnkey', label: 'Turnkey Projects', emoji: '🔑' },
                            ].map((s) => (
                                <EmojiChip key={s.id} item={s} selected={profile.services?.includes(s.id)} onClick={() => toggleArrayItem('services', s.id)} />
                            ))}
                        </div>

                        <SectionTitle>Specializations</SectionTitle>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
                            {['Modern Design', 'Traditional', 'Minimalist', 'Luxury', 'Budget Friendly', 'Smart Home', 'Eco Friendly', 'Vastu Compliant'].map((spec) => (
                                <PillChip key={spec} selected={profile.specializations?.includes(spec)} onClick={() => toggleArrayItem('specializations', spec)}>
                                    {spec}
                                </PillChip>
                            ))}
                        </div>

                        <SectionTitle>Portfolio</SectionTitle>
                        <div style={{ marginBottom: 24 }}>
                            <PortfolioUpload
                                images={profile.portfolioImages || []}
                                onImagesChange={(imgs) => setProfile({ ...profile, portfolioImages: imgs })}
                                maxImages={6}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
                            <div>
                                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>About Your Work</label>
                                <textarea
                                    value={profile.portfolioDescription || ''}
                                    onChange={(e) => setProfile({ ...profile, portfolioDescription: e.target.value })}
                                    placeholder="Describe your design philosophy..."
                                    style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid var(--border)', background: 'white', fontSize: 15, outline: 'none', minHeight: 100, resize: 'vertical', fontFamily: 'inherit' }}
                                />
                            </div>
                            <InputField label="Projects Completed" value={profile.projectsCompleted} onChange={(v) => setProfile({ ...profile, projectsCompleted: v })} />
                        </div>

                        <SectionTitle>Budget Range</SectionTitle>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                            {[
                                { id: '3-5', label: '₹3L - ₹5L', desc: 'Budget Projects' },
                                { id: '5-10', label: '₹5L - ₹10L', desc: 'Standard Projects' },
                                { id: '10-25', label: '₹10L - ₹25L', desc: 'Premium Projects' },
                                { id: '25+', label: '₹25L+', desc: 'Luxury Projects' },
                            ].map((b) => (
                                <RadioOption key={b.id} item={b} selected={profile.minBudget === b.id} onClick={() => setProfile({ ...profile, minBudget: b.id })} />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// ============ CITY SERVICE AREAS MAPPING ============
const CITY_SERVICE_AREAS = {
    'hyderabad': [
        'Gachibowli', 'HITEC City', 'Madhapur', 'Kondapur', 'Jubilee Hills',
        'Banjara Hills', 'Kukatpally', 'Manikonda', 'Miyapur', 'Begumpet',
        'Secunderabad', 'Ameerpet', 'Tolichowki', 'LB Nagar', 'Dilsukhnagar',
        'Uppal', 'Kompally', 'Shamshabad', 'Nallagandla', 'Narsingi'
    ],
    'bangalore': [
        'Indiranagar', 'Koramangala', 'HSR Layout', 'Whitefield', 'Jayanagar',
        'Electronic City', 'Marathahalli', 'Bannerghatta', 'JP Nagar', 'BTM Layout',
        'Sarjapur', 'Hennur', 'Yelahanka', 'Hebbal', 'Rajajinagar',
        'Malleshwaram', 'Basavanagudi', 'KR Puram', 'Bellandur', 'Banashankari'
    ],
    'bengaluru': [
        'Indiranagar', 'Koramangala', 'HSR Layout', 'Whitefield', 'Jayanagar',
        'Electronic City', 'Marathahalli', 'Bannerghatta', 'JP Nagar', 'BTM Layout',
        'Sarjapur', 'Hennur', 'Yelahanka', 'Hebbal', 'Rajajinagar',
        'Malleshwaram', 'Basavanagudi', 'KR Puram', 'Bellandur', 'Banashankari'
    ],
    'chennai': [
        'T. Nagar', 'Anna Nagar', 'Adyar', 'Velachery', 'Porur',
        'OMR', 'ECR', 'Thiruvanmiyur', 'Nungambakkam', 'Mylapore',
        'Sholinganallur', 'Perambur', 'Tambaram', 'Guindy', 'Chromepet',
        'Mogappair', 'Pallavaram', 'Medavakkam', 'Besant Nagar', 'Kodambakkam'
    ],
    'mumbai': [
        'Andheri', 'Bandra', 'Juhu', 'Powai', 'Goregaon',
        'Malad', 'Borivali', 'Dadar', 'Lower Parel', 'Worli',
        'Thane', 'Navi Mumbai', 'Mulund', 'Chembur', 'Vikhroli',
        'Kandivali', 'Jogeshwari', 'Santacruz', 'Khar', 'Vile Parle'
    ],
    'delhi': [
        'Dwarka', 'Rohini', 'Vasant Kunj', 'Saket', 'Greater Kailash',
        'Lajpat Nagar', 'Karol Bagh', 'Janakpuri', 'Pitampura', 'Hauz Khas',
        'Defence Colony', 'Rajouri Garden', 'Nehru Place', 'Mayur Vihar', 'Patel Nagar',
        'Green Park', 'Laxmi Nagar', 'Preet Vihar', 'Malviya Nagar', 'Chattarpur'
    ],
    'new delhi': [
        'Dwarka', 'Rohini', 'Vasant Kunj', 'Saket', 'Greater Kailash',
        'Lajpat Nagar', 'Karol Bagh', 'Janakpuri', 'Pitampura', 'Hauz Khas',
        'Defence Colony', 'Rajouri Garden', 'Nehru Place', 'Mayur Vihar', 'Patel Nagar',
        'Green Park', 'Laxmi Nagar', 'Preet Vihar', 'Malviya Nagar', 'Chattarpur'
    ],
    'pune': [
        'Koregaon Park', 'Hinjewadi', 'Baner', 'Wakad', 'Kharadi',
        'Viman Nagar', 'Aundh', 'Hadapsar', 'Magarpatta', 'Kalyani Nagar',
        'Pimple Saudagar', 'Kothrud', 'Bavdhan', 'Undri', 'NIBM Road',
        'Camp', 'Deccan', 'Shivajinagar', 'Warje', 'Kondhwa'
    ],
    'kolkata': [
        'Salt Lake', 'New Town', 'Park Street', 'Ballygunge', 'Alipore',
        'Behala', 'Garia', 'Jadavpur', 'Lake Town', 'Tollygunge',
        'Rajarhat', 'Dum Dum', 'Howrah', 'Barasat', 'South City',
        'EM Bypass', 'Kasba', 'Gariahat', 'Bhowanipore', 'Beliaghata'
    ],
    'ahmedabad': [
        'SG Highway', 'Prahlad Nagar', 'Satellite', 'Bodakdev', 'Thaltej',
        'Vastrapur', 'Navrangpura', 'C.G. Road', 'Maninagar', 'Bopal',
        'Gota', 'Chandkheda', 'Paldi', 'Ambawadi', 'Jodhpur',
        'Memnagar', 'Naranpura', 'Gurukul', 'Drive In Road', 'Shahibaug'
    ],
    'noida': [
        'Sector 18', 'Sector 62', 'Sector 137', 'Sector 150', 'Sector 44',
        'Sector 63', 'Sector 128', 'Sector 76', 'Greater Noida', 'Sector 50',
        'Sector 93', 'Sector 135', 'Sector 168', 'Noida Expressway', 'Sector 15'
    ],
    'gurgaon': [
        'Golf Course Road', 'MG Road', 'Sohna Road', 'DLF Phase 1-5', 'Sector 49',
        'Sector 56', 'Sector 57', 'South City', 'Palam Vihar', 'Sector 82',
        'Dwarka Expressway', 'New Gurgaon', 'Udyog Vihar', 'Manesar', 'Sector 43'
    ],
    'gurugram': [
        'Golf Course Road', 'MG Road', 'Sohna Road', 'DLF Phase 1-5', 'Sector 49',
        'Sector 56', 'Sector 57', 'South City', 'Palam Vihar', 'Sector 82',
        'Dwarka Expressway', 'New Gurgaon', 'Udyog Vihar', 'Manesar', 'Sector 43'
    ],
    'jaipur': [
        'Malviya Nagar', 'Vaishali Nagar', 'Mansarovar', 'C-Scheme', 'Tonk Road',
        'Jagatpura', 'Pratap Nagar', 'Ajmer Road', 'Sirsi Road', 'Sodala',
        'Raja Park', 'Bapu Nagar', 'Lalkothi', 'Bani Park', 'Sanganer'
    ],
    'kochi': [
        'Edappally', 'Kakkanad', 'Vyttila', 'Palarivattom', 'Marine Drive',
        'Panampilly Nagar', 'Kaloor', 'Aluva', 'Tripunithura', 'Fort Kochi',
        'Thevara', 'Kadavanthra', 'MG Road', 'Infopark', 'SmartCity'
    ],
    'visakhapatnam': [
        'Gajuwaka', 'MVP Colony', 'Madhurawada', 'Seethammadhara', 'Dwaraka Nagar',
        'Rushikonda', 'NAD Junction', 'Kommadi', 'Pendurthi', 'Beach Road',
        'Lawsons Bay', 'Siripuram', 'Waltair Uplands', 'Akkayyapalem', 'Jagadamba'
    ],
    'vizag': [
        'Gajuwaka', 'MVP Colony', 'Madhurawada', 'Seethammadhara', 'Dwaraka Nagar',
        'Rushikonda', 'NAD Junction', 'Kommadi', 'Pendurthi', 'Beach Road',
        'Lawsons Bay', 'Siripuram', 'Waltair Uplands', 'Akkayyapalem', 'Jagadamba'
    ],
};

function ServiceAreasPicker({ profile, toggleArrayItem, setProfile }) {
    const [customArea, setCustomArea] = useState('');
    const cityKey = (profile.city || '').trim().toLowerCase();
    const predefinedAreas = CITY_SERVICE_AREAS[cityKey] || [];

    // When city changes, clear service areas that don't belong to the new city
    useEffect(() => {
        if (predefinedAreas.length > 0 && profile.serviceAreas?.length > 0) {
            const validAreas = profile.serviceAreas.filter(a => predefinedAreas.includes(a));
            if (validAreas.length !== profile.serviceAreas.length) {
                setProfile(prev => ({ ...prev, serviceAreas: validAreas }));
            }
        }
    }, [cityKey]);

    const handleAddCustomArea = () => {
        const area = customArea.trim();
        if (area && !profile.serviceAreas?.includes(area)) {
            const newAreas = [...(profile.serviceAreas || []), area];
            setProfile(prev => ({ ...prev, serviceAreas: newAreas }));
            setCustomArea('');
        }
    };

    return (
        <div style={{ marginBottom: 24 }}>
            {predefinedAreas.length > 0 ? (
                <>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                        {predefinedAreas.map((area) => (
                            <PillChip key={area} selected={profile.serviceAreas?.includes(area)} onClick={() => toggleArrayItem('serviceAreas', area)}>
                                {area}
                            </PillChip>
                        ))}
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                        Or add a custom area:
                    </p>
                </>
            ) : (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                    {profile.city ? `No preset areas for "${profile.city}". Add your service areas manually:` : 'Enter your city first, then add service areas.'}
                </p>
            )}
            {/* Custom area input */}
            <div style={{ display: 'flex', gap: 8 }}>
                <input
                    type="text"
                    value={customArea}
                    onChange={(e) => setCustomArea(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomArea(); } }}
                    placeholder="Type area name..."
                    style={{
                        flex: 1, padding: '10px 14px', borderRadius: 12,
                        border: '1px solid var(--border)', background: 'white',
                        fontSize: 14, outline: 'none', fontFamily: 'inherit',
                    }}
                />
                <button
                    onClick={handleAddCustomArea}
                    disabled={!customArea.trim()}
                    style={{
                        padding: '10px 16px', borderRadius: 12,
                        background: customArea.trim() ? 'var(--gradient-primary)' : 'var(--bg-secondary)',
                        border: 'none', color: customArea.trim() ? 'white' : 'var(--text-muted)',
                        fontSize: 13, fontWeight: 600, cursor: customArea.trim() ? 'pointer' : 'default',
                    }}
                >
                    Add
                </button>
            </div>
            {/* Show custom (non-predefined) selected areas as removable chips */}
            {profile.serviceAreas?.filter(a => !predefinedAreas.includes(a)).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                    {profile.serviceAreas.filter(a => !predefinedAreas.includes(a)).map((area) => (
                        <button
                            key={area}
                            onClick={() => toggleArrayItem('serviceAreas', area)}
                            style={{
                                padding: '6px 12px', borderRadius: 20,
                                border: '2px solid var(--primary)',
                                background: 'var(--pastel-green)',
                                fontSize: 13, fontWeight: 500,
                                color: 'var(--primary-hover)',
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 6,
                            }}
                        >
                            {area}
                            <X size={14} color="var(--primary)" />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// Section Title
function SectionTitle({ children }) {
    return (
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
            {children}
        </p>
    );
}

// Chip Button
function ChipButton({ children, selected, onClick }) {
    return (
        <button onClick={onClick} style={{
            padding: '12px 14px', borderRadius: 12,
            border: selected ? '2px solid var(--primary)' : '1px solid var(--border)',
            background: selected ? 'var(--pastel-green)' : 'white',
            fontSize: 13, fontWeight: 600,
            color: selected ? 'var(--primary-hover)' : 'var(--text-secondary)',
            cursor: 'pointer',
        }}>
            {children}
        </button>
    );
}

// Pill Chip
function PillChip({ children, selected, onClick }) {
    return (
        <button onClick={onClick} style={{
            padding: '8px 14px', borderRadius: 20,
            border: selected ? '2px solid var(--primary)' : '1px solid var(--border)',
            background: selected ? 'var(--pastel-green)' : 'white',
            fontSize: 13, fontWeight: 500,
            color: selected ? 'var(--primary-hover)' : 'var(--text-secondary)',
            cursor: 'pointer',
        }}>
            {children}
        </button>
    );
}

// Emoji Chip
function EmojiChip({ item, selected, onClick }) {
    return (
        <button onClick={onClick} style={{
            padding: '12px', borderRadius: 12,
            border: selected ? '2px solid var(--primary)' : '1px solid var(--border)',
            background: selected ? 'var(--pastel-green)' : 'white',
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
        }}>
            <span style={{ fontSize: 18 }}>{item.emoji}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: selected ? 'var(--primary-hover)' : 'var(--text-secondary)' }}>
                {item.label}
            </span>
            {selected && <Check size={16} color="var(--primary)" style={{ marginLeft: 'auto' }} />}
        </button>
    );
}

// Radio Option
function RadioOption({ item, selected, onClick }) {
    return (
        <button onClick={onClick} style={{
            padding: '14px 16px', borderRadius: 12,
            border: selected ? '2px solid var(--primary)' : '1px solid var(--border)',
            background: selected ? 'var(--pastel-green)' : 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
        }}>
            <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: selected ? 'var(--primary-hover)' : 'var(--text-primary)' }}>{item.label}</div>
                {item.desc && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{item.desc}</div>}
            </div>
            {selected && <Check size={20} color="var(--primary)" />}
        </button>
    );
}


// Liked Profiles Page
export function LikedProfilesView({ onBack, likedProfiles = [] }) {
    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)' }}>
            <PageHeader title="Liked Profiles" onBack={onBack} />
            <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
                {likedProfiles.length === 0 ? (
                    <EmptyState icon={Heart} title="No liked profiles yet" subtitle="Profiles you like will appear here" />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {likedProfiles.map((p, i) => (
                            <ProfileListItem key={i} profile={p} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// Notifications Page
export function NotificationsView({ onBack }) {
    const { getNotifications, markNotificationsRead } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    React.useEffect(() => {
        const load = async () => {
            const notifs = await getNotifications();
            setNotifications(notifs);
            setLoading(false);
            // Mark all as read when viewing
            markNotificationsRead();
        };
        load();
    }, [getNotifications, markNotificationsRead]);

    const getIcon = (type) => {
        const icons = {
            like: '\u2764\ufe0f',
            match_accepted: '\ud83c\udf89',
            match_request: '\ud83d\udc8c',
            message: '\ud83d\udcac',
            meeting_scheduled: '\ud83d\udcc5',
            meeting_otp: '\ud83d\udd10',
            meeting_confirmed: '\u2705',
            wallet_credit: '\ud83d\udcb0',
            wallet_debit: '\ud83d\udcb3',
        };
        return icons[type] || '\ud83d\udd14';
    };

    const timeAgo = (dateStr) => {
        const now = new Date();
        const date = new Date(dateStr);
        const diff = Math.floor((now - date) / 1000);
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
        return date.toLocaleDateString();
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)' }}>
            <PageHeader title="Notifications" onBack={onBack} />
            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>Loading...</div>
                ) : notifications.length === 0 ? (
                    <EmptyState icon={Bell} title="No notifications" subtitle="You're all caught up!" />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {notifications.map((notif) => (
                            <motion.div
                                key={notif.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                style={{
                                    padding: 16,
                                    borderRadius: 14,
                                    background: notif.read ? 'var(--bg-secondary)' : 'white',
                                    border: `1px solid ${notif.read ? 'var(--border-light)' : 'var(--primary)'}`,
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 12,
                                }}
                            >
                                <span style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>{getIcon(notif.type)}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                        <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{notif.title}</h4>
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{timeAgo(notif.createdAt)}</span>
                                    </div>
                                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{notif.message}</p>
                                </div>
                                {!notif.read && (
                                    <div style={{
                                        width: 8, height: 8, borderRadius: '50%',
                                        background: 'var(--primary)', flexShrink: 0, marginTop: 6,
                                    }} />
                                )}
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// Privacy & Security Page
export function PrivacyView({ onBack }) {
    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)' }}>
            <PageHeader title="Privacy & Security" onBack={onBack} />
            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                    Your data is protected with industry-standard encryption. We never share your personal information with third parties without your consent.
                </p>

                <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-light)' }}>
                    <MenuItem label="View Privacy Policy" onClick={() => window.open('/privacy', '_blank')} />
                    <MenuItem label="View Terms of Service" onClick={() => window.open('/terms', '_blank')} isLast />
                </div>

                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 16, textAlign: 'center' }}>
                    For account security concerns, contact support via Help & Support.
                </p>
            </div>
        </div>
    );
}

// App Settings Page
export function SettingsView({ onBack }) {
    const { user, logout } = useAuth();
    const { showToast, showConfirm } = useToast();
    const [deleting, setDeleting] = useState(false);

    const handleDeleteAccount = async () => {
        const confirmed = await showConfirm(
            'This will submit a request to delete your account. Your account will be reviewed and deleted by our team within 3-5 business days.\n\nYou will be logged out after submitting the request.',
            'Request Account Deletion'
        );

        if (confirmed) {
            setDeleting(true);
            try {
                const profile = user?.profile || {};
                const name = profile.companyName || profile.name || 'Unknown';
                const phone = user?.phone || profile.phone || 'Unknown';

                await addDoc(collection(db, 'deleteRequests'), {
                    phone: phone,
                    name: name,
                    email: null,
                    reason: 'Requested from app settings',
                    status: 'PENDING',
                    requestedAt: new Date().toISOString(),
                    userId: user?.id || null,
                    role: user?.role || null,
                });

                showToast('Deletion request submitted. You will be logged out.', 'success');
                setTimeout(() => {
                    logout();
                }, 1500);
            } catch (error) {
                console.error('Error submitting delete request:', error);
                showToast('Failed to submit request. Please try again.', 'error');
                setDeleting(false);
            }
        }
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)' }}>
            <PageHeader title="App Settings" onBack={onBack} />
            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, marginLeft: 4 }}>APP INFO</p>
                <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-light)', marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--border-light)' }}>
                        <span style={{ fontSize: 15, color: 'var(--text-primary)' }}>Version</span>
                        <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>1.0.0</span>
                    </div>
                    <MenuItem label="Clear App Cache" onClick={() => {
                        if (typeof window !== 'undefined' && window.caches) {
                            caches.keys().then(names => names.forEach(name => caches.delete(name)));
                        }
                        showToast('Cache cleared successfully!', 'success');
                    }} isLast />
                </div>

                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, marginLeft: 4 }}>DANGER ZONE</p>
                <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-light)' }}>
                    <MenuItem
                        label={deleting ? "Deleting..." : "Delete Account"}
                        color="var(--error)"
                        isLast
                        onClick={!deleting ? handleDeleteAccount : undefined}
                    />
                </div>
            </div>
        </div>
    );
}


// Help & Support Page
export function HelpView({ onBack }) {
    const faqs = [
        { q: 'How do I get more connections?', a: 'Swipe right on profiles you like! Complete your profile fully to get more visibility.' },
        { q: 'How does the meeting payment work?', a: 'When a meeting is confirmed via OTP, ₹500 is deducted from the company\'s wallet. The seeker receives ₹250 as locked earnings.' },
        { q: 'How do I withdraw my earnings?', a: 'Go to your Wallet page and tap "Withdraw". Withdrawals are processed within 3-5 business days.' },
        { q: 'What is the OTP for meetings?', a: 'When a meeting is accepted, the seeker receives a 6-digit OTP. When you meet in person, the seeker shares this OTP with the company, and the company enters it to confirm the meeting happened.' },
        { q: 'Is my data secure?', a: 'Yes! We use industry-standard encryption to protect your data.' },
    ];

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)' }}>
            <PageHeader title="Help & Support" onBack={onBack} />
            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, marginLeft: 4 }}>FAQs</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                    {faqs.map((faq, i) => (
                        <div key={i} style={{ padding: 16, borderRadius: 14, background: 'white', border: '1px solid var(--border-light)' }}>
                            <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>{faq.q}</h4>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{faq.a}</p>
                        </div>
                    ))}
                </div>

                <motion.button
                    onClick={() => window.open('https://wa.me/918465834152?text=Hi%20Plyship%20Support%2C%20I%20need%20help%20with...', '_blank')}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                        width: '100%',
                        padding: 16,
                        borderRadius: 14,
                        background: 'var(--gradient-primary)',
                        border: 'none',
                        color: 'white',
                        fontSize: 15,
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: 'var(--shadow-glow-soft)',
                    }}
                >
                    💬 Contact Support via WhatsApp
                </motion.button>

                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12, textAlign: 'center' }}>
                    Or call us at +91 8465834152
                </p>
            </div>
        </div>
    );
}

// Reusable Components
function PageHeader({ title, onBack }) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
            paddingBottom: '16px',
            paddingLeft: '20px',
            paddingRight: '20px',
            background: 'white',
            borderBottom: '1px solid var(--border-light)',
        }}>
            <motion.button onClick={onBack} whileTap={{ scale: 0.9 }} style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'var(--bg-secondary)', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}>
                <ArrowLeft size={20} color="var(--text-secondary)" />
            </motion.button>
            <h2 style={{ flex: 1, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h2>
        </div>
    );
}

function EmptyState({ icon: Icon, title, subtitle }) {
    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 32 }}>
            <div style={{ width: 70, height: 70, borderRadius: 20, background: 'var(--pastel-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Icon size={32} color="var(--primary)" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{title}</h3>
            <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>{subtitle}</p>
        </div>
    );
}

function InputField({ label, value, onChange }) {
    return (
        <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>{label}</label>
            <input
                type="text"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'white', fontSize: 15, outline: 'none' }}
            />
        </div>
    );
}

function ToggleSetting({ label, value, onChange, isLast }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 18px',
            borderBottom: isLast ? 'none' : '1px solid var(--border-light)',
        }}>
            <span style={{ fontSize: 15, color: 'var(--text-primary)' }}>{label}</span>
            <motion.button
                onClick={() => onChange(!value)}
                style={{
                    width: 50, height: 28, borderRadius: 14,
                    background: value ? 'var(--primary)' : 'var(--border)',
                    border: 'none', cursor: 'pointer', position: 'relative',
                }}
            >
                <motion.div
                    animate={{ x: value ? 24 : 2 }}
                    style={{
                        width: 24, height: 24, borderRadius: '50%',
                        background: 'white', position: 'absolute', top: 2,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    }}
                />
            </motion.button>
        </div>
    );
}

function MenuItem({ label, color, isLast, onClick }) {
    return (
        <motion.button
            onClick={onClick}
            whileTap={{ scale: 0.98 }}
            style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 18px', background: 'transparent', border: 'none',
                borderBottom: isLast ? 'none' : '1px solid var(--border-light)', cursor: 'pointer',
            }}
        >
            <span style={{ fontSize: 15, color: color || 'var(--text-primary)' }}>{label}</span>
            <ChevronRight size={18} color="var(--text-muted)" />
        </motion.button>
    );
}

function ProfileListItem({ profile }) {
    const isCompany = profile?.role === 'COMPANY';
    const p = profile?.profile || {};
    const name = isCompany ? p.companyName : p.name;
    const image = p.avatar || p.portfolioImages?.[0];

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: 14,
            borderRadius: 14, background: 'white', border: '1px solid var(--border-light)',
        }}>
            <div style={{
                width: 50, height: 50, borderRadius: isCompany ? 14 : '50%',
                background: image ? `url(${image}) center/cover` : 'var(--pastel-green)',
                border: '2px solid var(--pastel-mint)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                {!image && (isCompany ? <Briefcase size={20} color="var(--primary)" /> : <User size={20} color="var(--primary)" />)}
            </div>
            <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{name || 'Unknown'}</h4>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.city || 'Location not set'}</span>
            </div>
            <Heart size={20} color="var(--primary)" fill="var(--primary)" />
        </div>
    );
}

// ============ GPS LOCATION DETECTOR (Profile Settings) ============
const GOOGLE_MAPS_API_KEY = 'AIzaSyCncjupkxXNL-AwNpyMSuEdfRSOHNZf-so';

function LocationDetector({ city, locality, onUpdate }) {
    const [locStatus, setLocStatus] = useState(city ? 'success' : 'idle'); // idle|detecting|refining|success|error|denied
    const [locMessage, setLocMessage] = useState(city ? `📍 ${locality ? locality + ', ' : ''}${city}` : '');
    const [accuracy, setAccuracy] = useState(null);
    const [showManual, setShowManual] = useState(!!city);
    const [cityInput, setCityInput] = useState(city || '');
    const [localityInput, setLocalityInput] = useState(locality || '');
    const mountedRef = useRef(true);
    const gpsWatchId = useRef(null);
    const gotCityRef = useRef(!!city);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (gpsWatchId.current !== null) {
                navigator.geolocation.clearWatch(gpsWatchId.current);
                gpsWatchId.current = null;
            }
        };
    }, []);

    // Keep local inputs in sync with props
    useEffect(() => { setCityInput(city || ''); }, [city]);
    useEffect(() => { setLocalityInput(locality || ''); }, [locality]);

    const reverseGeocode = useCallback(async (lat, lng) => {
        const res = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}&language=en`
        );
        const geo = await res.json();
        if (geo.status === 'OK' && geo.results?.length > 0) {
            let city = '', locality = '', localityFallback = '';
            for (const result of geo.results) {
                const components = result.address_components || [];
                for (const c of components) {
                    if (!locality && c.types.includes('sublocality_level_1')) {
                        locality = c.long_name;
                    }
                    if (!localityFallback && c.types.includes('sublocality_level_2')) {
                        localityFallback = c.long_name;
                    }
                    if (!city && c.types.includes('locality')) {
                        city = c.long_name;
                    }
                    if (!city && (c.types.includes('administrative_area_level_2') || c.types.includes('administrative_area_level_1'))) {
                        city = city || c.long_name;
                    }
                }
                if (city && locality) break;
            }
            return { city, locality: locality || localityFallback };
        }
        return { city: '', locality: '' };
    }, []);

    const applyLocation = useCallback(async (position, isFinal) => {
        if (!mountedRef.current) return;
        const { latitude, longitude, accuracy: acc } = position.coords;
        setAccuracy(Math.round(acc));
        try {
            const result = await reverseGeocode(latitude, longitude);
            if (!mountedRef.current) return;
            if (result.city) {
                gotCityRef.current = true;
                onUpdate(result.city, result.locality, parseFloat(latitude.toFixed(6)), parseFloat(longitude.toFixed(6)));
                setLocStatus(isFinal ? 'success' : 'refining');
                setLocMessage(`📍 ${result.locality ? result.locality + ', ' : ''}${result.city}`);
            } else if (isFinal) {
                setLocStatus('error');
                setLocMessage('Could not determine city');
                setShowManual(true);
            }
        } catch {
            if (!mountedRef.current) return;
            if (isFinal) { setLocStatus('error'); setLocMessage('Geocoding failed'); setShowManual(true); }
        }
    }, [reverseGeocode, onUpdate]);

    const detectLocation = useCallback(() => {
        if (!navigator.geolocation) {
            setLocStatus('error'); setLocMessage('Geolocation not supported'); setShowManual(true); return;
        }
        setLocStatus('detecting');
        setLocMessage('Detecting your location...');
        gotCityRef.current = false;

        navigator.geolocation.getCurrentPosition(
            (pos) => { if (mountedRef.current) { applyLocation(pos, false); startGPSRefinement(); } },
            () => { if (mountedRef.current) startGPSRefinement(); },
            { enableHighAccuracy: false, timeout: 3000, maximumAge: 300000 }
        );
    }, [applyLocation]);

    const startGPSRefinement = useCallback(() => {
        if (gpsWatchId.current !== null) navigator.geolocation.clearWatch(gpsWatchId.current);
        let bestAcc = Infinity, settled = false;

        const settle = () => {
            if (settled) return;
            settled = true;
            if (gpsWatchId.current !== null) { navigator.geolocation.clearWatch(gpsWatchId.current); gpsWatchId.current = null; }
            if (!mountedRef.current) return;
            if (gotCityRef.current) { setLocStatus('success'); }
            else { setLocStatus('error'); setLocMessage('Could not get precise location'); setShowManual(true); }
        };

        const settleTimer = setTimeout(settle, 6000);

        gpsWatchId.current = navigator.geolocation.watchPosition(
            (pos) => {
                if (!mountedRef.current || settled) return;
                const acc = pos.coords.accuracy;
                if (acc < bestAcc) { bestAcc = acc; applyLocation(pos, false); }
                if (acc <= 100) { clearTimeout(settleTimer); applyLocation(pos, true); settle(); }
            },
            (err) => {
                clearTimeout(settleTimer);
                if (!mountedRef.current) return;
                if (!settled) {
                    settled = true;
                    if (gpsWatchId.current !== null) { navigator.geolocation.clearWatch(gpsWatchId.current); gpsWatchId.current = null; }
                    if (gotCityRef.current) { setLocStatus('success'); }
                    else { setLocStatus(err.code === 1 ? 'denied' : 'error'); setLocMessage(err.code === 1 ? 'Location permission denied' : 'Location unavailable'); setShowManual(true); }
                }
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
    }, [applyLocation]);

    return (
        <div style={{ marginBottom: 24 }}>
            {/* Detection status card */}
            {locStatus !== 'idle' && (
                <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        padding: '14px 16px', borderRadius: 14, marginBottom: 12,
                        display: 'flex', alignItems: 'center', gap: 12,
                        background: (locStatus === 'detecting' || locStatus === 'refining') ? '#F0F9FF'
                            : locStatus === 'success' ? '#F0FDF4' : '#FEF2F2',
                        border: `1px solid ${(locStatus === 'detecting' || locStatus === 'refining') ? '#BAE6FD'
                            : locStatus === 'success' ? '#BBF7D0' : '#FECACA'}`,
                    }}
                >
                    {(locStatus === 'detecting' || locStatus === 'refining') ? (
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                            <Loader2 size={18} color="#0284C7" />
                        </motion.div>
                    ) : locStatus === 'success' ? (
                        <MapPin size={18} color="#16A34A" />
                    ) : (
                        <MapPin size={18} color="#DC2626" />
                    )}
                    <div style={{ flex: 1 }}>
                        <p style={{
                            fontSize: 14, fontWeight: 600, margin: 0,
                            color: (locStatus === 'detecting' || locStatus === 'refining') ? '#0284C7'
                                : locStatus === 'success' ? '#16A34A' : '#DC2626',
                        }}>
                            {locMessage}
                        </p>
                        {locStatus === 'refining' && (
                            <p style={{ fontSize: 11, color: '#0284C7', margin: '2px 0 0' }}>Refining with GPS...</p>
                        )}
                        {locStatus === 'success' && accuracy && (
                            <p style={{ fontSize: 11, color: '#888', margin: '2px 0 0' }}>Accuracy: ~{accuracy}m</p>
                        )}
                    </div>
                    {locStatus === 'success' && !showManual && (
                        <button onClick={() => setShowManual(true)} style={{
                            padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                            background: 'rgba(0,0,0,0.06)', color: '#555', border: 'none', cursor: 'pointer',
                        }}>Edit</button>
                    )}
                </motion.div>
            )}

            {/* Re-detect button */}
            <motion.button
                onClick={detectLocation}
                whileTap={{ scale: 0.97 }}
                disabled={locStatus === 'detecting' || locStatus === 'refining'}
                style={{
                    width: '100%', padding: '12px 16px', borderRadius: 12, marginBottom: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    background: 'white', border: '1.5px solid #22C55E',
                    color: '#16A34A', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    opacity: (locStatus === 'detecting' || locStatus === 'refining') ? 0.5 : 1,
                }}
            >
                <LocateFixed size={16} />
                {locStatus === 'detecting' || locStatus === 'refining' ? 'Detecting...' : 'Detect My Location'}
            </motion.button>

            {/* Manual editing */}
            {showManual && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
                >
                    <InputField
                        label="City"
                        value={cityInput}
                        onChange={(v) => { setCityInput(v); onUpdate(v, localityInput); }}
                        placeholder="e.g., Hyderabad"
                    />
                    <InputField
                        label="Locality / Area"
                        value={localityInput}
                        onChange={(v) => { setLocalityInput(v); onUpdate(cityInput, v); }}
                        placeholder="e.g., Gachibowli"
                    />
                </motion.div>
            )}
        </div>
    );
}

