'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AvatarUpload } from './ImageUpload';
import {
    User, Users, Settings, LogOut, ChevronRight, Heart, MessageCircle,
    Bell, Shield, HelpCircle, Star, MapPin, Briefcase, Edit2, Camera,
    ArrowLeft, Check, X, Wallet, Calendar, Home
} from 'lucide-react';

// Main Profile View with navigation
export default function ProfileView({ onNavigate }) {
    const { user, logout, getMatches, getChats } = useAuth();
    const isCompany = user?.role === 'COMPANY';
    const profile = user?.profile || {};
    const [connectionCount, setConnectionCount] = useState('-');
    const [messageCount, setMessageCount] = useState('-');

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
        { id: 'liked', icon: Heart, label: 'Liked Profiles', badge: null },
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
            {/* Profile Header */}
            <div style={{
                background: 'white',
                padding: '24px 20px',
                borderBottom: '1px solid var(--border-light)',
            }}>
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
    const { user, completeProfile } = useAuth();
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

    const handleSave = async () => {
        setIsSaving(true);
        const result = await completeProfile(profile);
        setIsSaving(false);
        if (result?.success) {
            onBack?.();
        } else {
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
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '16px 20px',
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
                <motion.button onClick={handleSave} whileTap={{ scale: 0.95 }} style={{
                    padding: '8px 16px', borderRadius: 10,
                    background: 'var(--gradient-primary)', border: 'none',
                    color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer',
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

                {/* ============ SEEKER FIELDS ============ */}
                {!isCompany && (
                    <>
                        <SectionTitle>Basic Info</SectionTitle>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
                            <InputField label="Full Name" value={profile.name} onChange={(v) => setProfile({ ...profile, name: v })} />
                            <InputField label="Phone" value={profile.phone} onChange={(v) => setProfile({ ...profile, phone: v })} />
                        </div>

                        <SectionTitle>Location</SectionTitle>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
                            <InputField label="City" value={profile.city} onChange={(v) => setProfile({ ...profile, city: v })} />
                            <InputField label="Locality / Area" value={profile.locality} onChange={(v) => setProfile({ ...profile, locality: v })} />
                        </div>

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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
                            <InputField label="City" value={profile.city} onChange={(v) => setProfile({ ...profile, city: v })} />
                        </div>

                        <SectionTitle>Service Areas</SectionTitle>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
                            {['Indiranagar', 'Koramangala', 'HSR Layout', 'Whitefield', 'Jayanagar', 'Electronic City', 'Marathahalli', 'Bannerghatta'].map((area) => (
                                <PillChip key={area} selected={profile.serviceAreas?.includes(area)} onClick={() => toggleArrayItem('serviceAreas', area)}>
                                    {area}
                                </PillChip>
                            ))}
                        </div>

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
                            <PortfolioUploadEdit
                                images={profile.portfolioImages || []}
                                onImagesChange={(imgs) => setProfile({ ...profile, portfolioImages: imgs })}
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

// Portfolio Upload for Edit
function PortfolioUploadEdit({ images, onImagesChange }) {
    const inputRef = React.useRef(null);

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files || []);
        files.forEach(file => {
            if (images.length >= 6) return;
            const reader = new FileReader();
            reader.onloadend = () => {
                onImagesChange([...images, reader.result]);
            };
            reader.readAsDataURL(file);
        });
        e.target.value = '';
    };

    const handleRemove = (index) => {
        onImagesChange(images.filter((_, i) => i !== index));
    };

    return (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {images.map((img, i) => (
                    <div key={i} style={{
                        aspectRatio: '1', borderRadius: 12,
                        background: `url(${img}) center/cover`,
                        position: 'relative', border: '2px solid var(--primary)',
                    }}>
                        <button onClick={() => handleRemove(i)} style={{
                            position: 'absolute', top: 4, right: 4,
                            width: 22, height: 22, borderRadius: '50%',
                            background: 'rgba(0,0,0,0.6)', border: 'none',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        }}>
                            <X size={12} color="white" />
                        </button>
                    </div>
                ))}
                {images.length < 6 && (
                    <button onClick={() => inputRef.current?.click()} style={{
                        aspectRatio: '1', borderRadius: 12,
                        background: 'var(--pastel-green)', border: '2px dashed var(--pastel-mint)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    }}>
                        <span style={{ fontSize: 24, color: 'var(--text-muted)' }}>+</span>
                    </button>
                )}
            </div>
            <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleFileChange} style={{ display: 'none' }} />
        </div>
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
    const { deleteAccount } = useAuth();
    const { showToast, showConfirm } = useToast();
    const [deleting, setDeleting] = useState(false);

    const handleDeleteAccount = async () => {
        const confirmed = await showConfirm(
            'This will PERMANENTLY delete your account and ALL your data including:\n\n• Profile & settings\n• All connections & chats\n• All meetings & projects\n• Wallet & transactions\n\nThis action CANNOT be undone!',
            'Delete Account'
        );

        if (confirmed) {
            setDeleting(true);
            const result = await deleteAccount();
            if (result.success) {
                showToast('Your account has been completely deleted.', 'success');
            } else {
                showToast(result.error, 'error');
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
        { q: 'What is the OTP for meetings?', a: 'When a meeting is accepted, the company receives a 6-digit OTP. When you meet in person, the seeker enters this OTP to confirm the meeting happened.' },
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
            padding: '16px 20px',
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
