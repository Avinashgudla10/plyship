'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { motion, AnimatePresence } from 'framer-motion';
import { AvatarUpload, PortfolioUpload } from '../../components/ImageUpload';
import {
    User, MapPin, Wallet, Palette, Building2, Briefcase,
    ArrowRight, ArrowLeft, Check, Leaf, Camera, Image as ImageIcon, Star
} from 'lucide-react';
import Image from 'next/image';

// ============ SEEKER FORM DATA ============
const SEEKER_STEPS = [
    { id: 'basic', title: 'About You', icon: User },
    { id: 'preferences', title: 'Preferences & Budget', icon: Palette },
];

const STYLES = [
    { id: 'residential', label: 'Residential Space', emoji: '🏠' },
    { id: 'commercial', label: 'Commercial Space', emoji: '🏢' },
];

const ROOM_TYPES = [
    { id: 'full', label: 'Full Home', emoji: '🏠' },
    { id: 'living', label: 'Living Room', emoji: '🛋️' },
    { id: 'bedroom', label: 'Bedroom', emoji: '🛏️' },
    { id: 'kitchen', label: 'Kitchen', emoji: '🍳' },
    { id: 'bathroom', label: 'Bathroom', emoji: '🚿' },
    { id: 'office', label: 'Home Office', emoji: '💼' },
];

const BUDGET_RANGES = [
    { id: '3-5', label: '₹3L - ₹5L', description: 'Budget Friendly' },
    { id: '5-10', label: '₹5L - ₹10L', description: 'Mid Range' },
    { id: '10-20', label: '₹10L - ₹20L', description: 'Premium' },
    { id: '20+', label: '₹20L+', description: 'Luxury' },
];

const TIMELINES = [
    { id: 'immediate', label: 'Immediately', description: 'Ready to start' },
    { id: '1-3months', label: '1-3 Months', description: 'Soon' },
    { id: '3-6months', label: '3-6 Months', description: 'Planning ahead' },
    { id: 'exploring', label: 'Just Exploring', description: 'No rush' },
];

// ============ COMPANY FORM DATA ============
const COMPANY_STEPS = [
    { id: 'company', title: 'Company Info', icon: Building2 },
    { id: 'services', title: 'Services', icon: Briefcase },
    { id: 'portfolio', title: 'Portfolio & Pricing', icon: ImageIcon },
];

const SERVICES = [
    { id: 'residential', label: 'Residential', emoji: '🏠' },
    { id: 'commercial', label: 'Commercial', emoji: '🏢' },
    { id: 'modular', label: 'Modular Kitchen', emoji: '🍳' },
    { id: 'renovation', label: 'Renovation', emoji: '🔨' },
    { id: 'consultation', label: 'Consultation', emoji: '💬' },
    { id: 'turnkey', label: 'Turnkey Projects', emoji: '🔑' },
];

const SPECIALIZATIONS = [
    { id: 'modern', label: 'Modern Design' },
    { id: 'traditional', label: 'Traditional' },
    { id: 'minimalist', label: 'Minimalist' },
    { id: 'luxury', label: 'Luxury' },
    { id: 'budget', label: 'Budget Friendly' },
    { id: 'smart-home', label: 'Smart Home' },
    { id: 'eco-friendly', label: 'Eco Friendly' },
    { id: 'vastu', label: 'Vastu Compliant' },
];

const COMPANY_BUDGET_RANGES = [
    { id: '3-5', label: '₹3L - ₹5L', description: 'Budget Projects' },
    { id: '5-10', label: '₹5L - ₹10L', description: 'Standard Projects' },
    { id: '10-25', label: '₹10L - ₹25L', description: 'Premium Projects' },
    { id: '25+', label: '₹25L+', description: 'Luxury Projects' },
];

export default function ProfileSetup() {
    const router = useRouter();
    const { user, loading, completeProfile } = useAuth();
    const { showToast } = useToast();
    const [currentStep, setCurrentStep] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState({});

    const isCompany = user?.role === 'COMPANY';
    const STEPS = isCompany ? COMPANY_STEPS : SEEKER_STEPS;

    // Seeker form data
    const [seekerData, setSeekerData] = useState({
        name: user?.name || '',
        avatar: null,
        city: '',
        propertyType: '',
        styles: [],
        rooms: [],
        budget: '',
        timeline: '',
    });

    // Company form data
    const [companyData, setCompanyData] = useState({
        companyName: '',
        tagline: '',
        avatar: null,
        yearsInBusiness: '',
        city: '',
        services: [],
        specializations: [],
        portfolioImages: [],
        portfolioDescription: '',
        projectsCompleted: '',
        minBudget: '',
    });

    const ADMIN_PHONES = ['+918465834152'];

    useEffect(() => {
        if (!loading && user) {
            // Admin users go straight to dashboard
            if (ADMIN_PHONES.includes(user.phone)) {
                router.replace('/admin');
                return;
            }
        }
        // Only redirect after loading is complete and we know the user state
        if (!loading && (!user || !user.role)) {
            console.log('⚠️ Profile setup: No user or role, redirecting to login');
            router.push('/login');
        }
    }, [user, loading, router]);

    // Validate current step before advancing
    const validateStep = () => {
        const newErrors = {};

        if (!isCompany) {
            // Seeker validation
            if (currentStep === 0) {
                if (!seekerData.name || seekerData.name.trim().length < 2) {
                    newErrors.name = 'Name must be at least 2 characters';
                }
                if (!seekerData.city || seekerData.city.trim().length < 2) {
                    newErrors.city = 'City is required';
                }
                if (!seekerData.propertyType) {
                    newErrors.propertyType = 'Please select a property type';
                }
            } else if (currentStep === 1) {
                if (!seekerData.styles || seekerData.styles.length === 0) {
                    newErrors.styles = 'Select at least one style';
                }
                if (!seekerData.rooms || seekerData.rooms.length === 0) {
                    newErrors.rooms = 'Select at least one room';
                }
                if (!seekerData.budget) {
                    newErrors.budget = 'Please select a budget range';
                }
                if (!seekerData.timeline) {
                    newErrors.timeline = 'Please select a timeline';
                }
            }
        } else {
            // Company validation
            if (currentStep === 0) {
                if (!companyData.companyName || companyData.companyName.trim().length < 2) {
                    newErrors.companyName = 'Company name must be at least 2 characters';
                }
            } else if (currentStep === 1) {
                if (!companyData.services || companyData.services.length === 0) {
                    newErrors.services = 'Select at least one service';
                }
                if (!companyData.specializations || companyData.specializations.length === 0) {
                    newErrors.specializations = 'Select at least one specialization';
                }
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNext = async () => {
        if (!validateStep()) return;

        if (currentStep < STEPS.length - 1) {
            setErrors({});
            setCurrentStep(prev => prev + 1);
        } else {
            // Complete profile and save to Firestore
            if (isSubmitting) return; // Prevent double submission

            setIsSubmitting(true);
            const profileData = isCompany ? companyData : seekerData;
            console.log('📝 Saving profile to Firebase:', profileData);
            console.log('👤 User ID:', user?.id, 'Role:', user?.role);

            try {
                const result = await completeProfile(profileData);

                if (result && result.success) {
                    console.log('✅ Profile saved to Firebase, navigating to home');
                    // Use replace so back button doesn't go through onboarding flow
                    router.replace('/');
                } else {
                    console.error('❌ Failed to save profile:', result?.error);
                    showToast('Failed to save profile: ' + (result?.error || 'Unknown error'), 'error');
                    setIsSubmitting(false);
                }
            } catch (error) {
                console.error('❌ Exception saving profile:', error);
                showToast('Error saving profile: ' + error.message, 'error');
                setIsSubmitting(false);
            }
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const toggleSelection = (field, value, isCompanyField = false) => {
        const setter = isCompanyField ? setCompanyData : setSeekerData;
        setter(prev => ({
            ...prev,
            [field]: prev[field].includes(value)
                ? prev[field].filter(v => v !== value)
                : [...prev[field], value]
        }));
    };

    const progress = ((currentStep + 1) / STEPS.length) * 100;

    // Show nothing while loading or if user/role is missing
    if (loading || !user || !user.role) return null;

    return (
        <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, #ECFDF5 0%, #FFFFFF 100%)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
        }}>
            {/* Header */}
            <div style={{
                padding: '20px 24px',
                background: 'white',
                borderBottom: '1px solid var(--border-light)',
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div>
                            <Image src="/logo.png" alt="PlyShip" width={100} height={26} style={{ objectFit: 'contain' }} />
                            <span style={{
                                fontSize: 12,
                                color: 'var(--text-muted)',
                                marginLeft: 8,
                                padding: '2px 8px',
                                background: 'var(--pastel-green)',
                                borderRadius: 8,
                            }}>
                                {isCompany ? 'Company' : 'Seeker'}
                            </span>
                        </div>
                    </div>
                    <span style={{
                        fontSize: 14,
                        color: 'var(--text-muted)',
                        fontWeight: 500,
                    }}>
                        Step {currentStep + 1} of {STEPS.length}
                    </span>
                </div>

                {/* Progress Bar */}
                <div style={{
                    height: 4,
                    background: 'var(--border)',
                    borderRadius: 2,
                    overflow: 'hidden',
                }}>
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.3 }}
                        style={{
                            height: '100%',
                            background: 'var(--gradient-primary)',
                            borderRadius: 2,
                        }}
                    />
                </div>
            </div>

            {/* Content */}
            <div style={{
                flex: 1,
                overflow: 'auto',
                padding: '24px',
            }}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={`${isCompany ? 'company' : 'seeker'}-${currentStep}`}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        {/* ============ SEEKER STEPS ============ */}
                        {!isCompany && currentStep === 0 && (
                            <SeekerBasicInfo data={seekerData} setData={setSeekerData} errors={errors} />
                        )}
                        {!isCompany && currentStep === 1 && (
                            <SeekerPreferences data={seekerData} setData={setSeekerData} toggleSelection={(f, v) => toggleSelection(f, v, false)} errors={errors} />
                        )}

                        {/* ============ COMPANY STEPS ============ */}
                        {isCompany && currentStep === 0 && (
                            <CompanyBasicInfo data={companyData} setData={setCompanyData} errors={errors} />
                        )}
                        {isCompany && currentStep === 1 && (
                            <CompanyServices data={companyData} toggleSelection={(f, v) => toggleSelection(f, v, true)} errors={errors} />
                        )}
                        {isCompany && currentStep === 2 && (
                            <CompanyPortfolio data={companyData} setData={setCompanyData} />
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Footer Navigation */}
            <div style={{
                padding: '16px 24px 32px',
                background: 'white',
                borderTop: '1px solid var(--border-light)',
                display: 'flex',
                gap: 12,
            }}>
                {currentStep > 0 && (
                    <motion.button
                        onClick={handleBack}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        style={{
                            flex: 0.4,
                            padding: '18px',
                            borderRadius: 16,
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-secondary)',
                            fontSize: 16,
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            cursor: 'pointer',
                        }}
                    >
                        <ArrowLeft size={20} />
                        Back
                    </motion.button>
                )}
                <motion.button
                    type="button"
                    onClick={() => {
                        console.log('🔘 Button clicked! Step:', currentStep, 'Total steps:', STEPS.length);
                        handleNext();
                    }}
                    disabled={isSubmitting}
                    whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
                    whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
                    style={{
                        flex: 1,
                        padding: '18px',
                        borderRadius: 16,
                        background: isSubmitting ? 'var(--primary-muted)' : 'var(--gradient-primary)',
                        border: 'none',
                        color: 'white',
                        fontSize: 16,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 10,
                        boxShadow: 'var(--shadow-glow-soft)',
                        cursor: isSubmitting ? 'wait' : 'pointer',
                        opacity: isSubmitting ? 0.7 : 1,
                    }}
                >
                    {isSubmitting ? 'Saving...' : (currentStep === STEPS.length - 1 ? 'Complete Setup' : 'Continue')}
                    {!isSubmitting && (currentStep === STEPS.length - 1 ? <Check size={20} /> : <ArrowRight size={20} />)}
                </motion.button>
            </div>
        </div>
    );
}

// ============ SEEKER FORM COMPONENTS ============

function SeekerBasicInfo({ data, setData, errors }) {
    return (
        <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>
                Let&apos;s get to know you
            </h2>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 32 }}>
                Tell us about yourself and your property
            </p>

            <div style={{ marginBottom: 32 }}>
                <AvatarUpload
                    image={data.avatar}
                    onImageChange={(img) => setData({ ...data, avatar: img })}
                    isCompany={false}
                />
                <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                    Tap to upload your photo
                </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <InputField label="Full Name" value={data.name} onChange={(v) => setData({ ...data, name: v })} placeholder="Your name" error={errors?.name} />
                <InputField label="City" value={data.city} onChange={(v) => setData({ ...data, city: v })} placeholder="e.g., Hyderabad" error={errors?.city} />

                <div>
                    <label style={labelStyle}>Property Type</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                        {['1 BHK', '2 BHK', '3 BHK', '4+ BHK', 'Villa', 'Office'].map((type) => (
                            <SelectButton key={type} selected={data.propertyType === type} onClick={() => setData({ ...data, propertyType: type })}>
                                {type}
                            </SelectButton>
                        ))}
                    </div>
                    {errors?.propertyType && <p style={errorTextStyle}>{errors.propertyType}</p>}
                </div>
            </div>
        </div>
    );
}

function SeekerPreferences({ data, setData, toggleSelection, errors }) {
    return (
        <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>
                Your preferences
            </h2>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 32 }}>
                Help us match you with the right companies
            </p>

            <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Space Type</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                    {STYLES.map((style) => (
                        <EmojiButton key={style.id} item={style} selected={data.styles.includes(style.id)} onClick={() => toggleSelection('styles', style.id)} />
                    ))}
                </div>
                {errors?.styles && <p style={errorTextStyle}>{errors.styles}</p>}
            </div>

            <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Rooms to Design</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                    {ROOM_TYPES.map((room) => (
                        <EmojiButton key={room.id} item={room} selected={data.rooms.includes(room.id)} onClick={() => toggleSelection('rooms', room.id)} />
                    ))}
                </div>
                {errors?.rooms && <p style={errorTextStyle}>{errors.rooms}</p>}
            </div>

            <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Your Budget</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {BUDGET_RANGES.map((budget) => (
                        <RadioCard key={budget.id} item={budget} selected={data.budget === budget.id} onClick={() => setData({ ...data, budget: budget.id })} />
                    ))}
                </div>
                {errors?.budget && <p style={errorTextStyle}>{errors.budget}</p>}
            </div>

            <div>
                <label style={labelStyle}>When do you want to start?</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                    {TIMELINES.map((tl) => (
                        <SelectCard key={tl.id} item={tl} selected={data.timeline === tl.id} onClick={() => setData({ ...data, timeline: tl.id })} />
                    ))}
                </div>
                {errors?.timeline && <p style={errorTextStyle}>{errors.timeline}</p>}
            </div>
        </div>
    );
}

// ============ COMPANY FORM COMPONENTS ============

function CompanyBasicInfo({ data, setData, errors }) {
    return (
        <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>
                Tell us about your company
            </h2>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 32 }}>
                This information will be shown to potential clients
            </p>

            <div style={{ marginBottom: 32 }}>
                <AvatarUpload
                    image={data.avatar}
                    onImageChange={(img) => setData({ ...data, avatar: img })}
                    isCompany={true}
                />
                <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                    Tap to upload company logo
                </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <InputField label="Company Name" value={data.companyName} onChange={(v) => setData({ ...data, companyName: v })} placeholder="Your company name" error={errors?.companyName} />
                <InputField label="Tagline" value={data.tagline} onChange={(v) => setData({ ...data, tagline: v })} placeholder="e.g., Modern designs for modern living" />
                <InputField label="City" value={data.city} onChange={(v) => setData({ ...data, city: v })} placeholder="e.g., Hyderabad" />
                <InputField label="Years in Business" value={data.yearsInBusiness} onChange={(v) => setData({ ...data, yearsInBusiness: v })} placeholder="e.g., 5" type="number" />
            </div>
        </div>
    );
}

function CompanyServices({ data, toggleSelection, errors }) {
    return (
        <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>
                What services do you offer?
            </h2>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 32 }}>
                Select all that apply
            </p>

            <div style={{ marginBottom: 32 }}>
                <label style={labelStyle}>Services</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                    {SERVICES.map((service) => (
                        <EmojiButton key={service.id} item={service} selected={data.services.includes(service.id)} onClick={() => toggleSelection('services', service.id)} />
                    ))}
                </div>
                {errors?.services && <p style={errorTextStyle}>{errors.services}</p>}
            </div>

            <div>
                <label style={labelStyle}>Specializations</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {SPECIALIZATIONS.map((spec) => (
                        <PillButton key={spec.id} selected={data.specializations.includes(spec.id)} onClick={() => toggleSelection('specializations', spec.id)}>
                            {spec.label}
                        </PillButton>
                    ))}
                </div>
                {errors?.specializations && <p style={errorTextStyle}>{errors.specializations}</p>}
            </div>
        </div>
    );
}

function CompanyPortfolio({ data, setData }) {
    return (
        <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>
                Showcase your work
            </h2>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 32 }}>
                Add portfolio images and set your pricing
            </p>

            {/* Portfolio Image Upload */}
            <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Portfolio Images (up to 6)</label>
                <PortfolioUpload
                    images={data.portfolioImages || []}
                    onImagesChange={(imgs) => setData({ ...data, portfolioImages: imgs })}
                    maxImages={6}
                />
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                    Upload photos of your completed projects
                </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                    <label style={labelStyle}>About Your Work</label>
                    <textarea
                        value={data.portfolioDescription}
                        onChange={(e) => setData({ ...data, portfolioDescription: e.target.value })}
                        placeholder="Describe your design philosophy and notable projects..."
                        style={{
                            width: '100%', padding: '16px 20px', borderRadius: 14,
                            border: '1px solid var(--border)', background: 'white',
                            fontSize: 16, fontWeight: 500, color: 'var(--text-primary)',
                            outline: 'none', minHeight: 120, resize: 'vertical', fontFamily: 'inherit'
                        }}
                    />
                </div>
                <InputField label="Projects Completed" value={data.projectsCompleted} onChange={(v) => setData({ ...data, projectsCompleted: v })} placeholder="e.g., 150" type="number" />
            </div>

            <div style={{ marginTop: 24 }}>
                <label style={labelStyle}>Budget Range You Work With</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {COMPANY_BUDGET_RANGES.map((budget) => (
                        <RadioCard key={budget.id} item={budget} selected={data.minBudget === budget.id} onClick={() => setData({ ...data, minBudget: budget.id })} />
                    ))}
                </div>
            </div>
        </div>
    );
}

// ============ REUSABLE UI COMPONENTS ============

const labelStyle = {
    fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)',
    textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12, display: 'block',
};

const errorTextStyle = {
    fontSize: 12, color: '#EF4444', fontWeight: 500, marginTop: 6, marginBottom: 0,
};

function InputField({ label, value, onChange, placeholder, type = 'text', error }) {
    return (
        <div>
            <label style={labelStyle}>{label}</label>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                style={{
                    width: '100%', padding: '16px 20px', borderRadius: 14,
                    border: `1px solid ${error ? '#EF4444' : 'var(--border)'}`,
                    background: error ? '#FEF2F2' : 'white',
                    fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', outline: 'none',
                    transition: 'border-color 0.2s, background 0.2s',
                }}
            />
            {error && <p style={errorTextStyle}>{error}</p>}
        </div>
    );
}

function PhoneField({ label, value, onChange, error }) {
    const handlePhoneChange = (rawValue) => {
        // Strip all non-digit characters
        const digits = rawValue.replace(/\D/g, '');
        // Limit to 10 digits
        onChange(digits.substring(0, 10));
    };

    return (
        <div>
            <label style={labelStyle}>{label}</label>
            <div style={{
                display: 'flex', alignItems: 'center', borderRadius: 14,
                border: `1px solid ${error ? '#EF4444' : 'var(--border)'}`,
                background: error ? '#FEF2F2' : 'white', overflow: 'hidden',
                transition: 'border-color 0.2s, background 0.2s',
            }}>
                <span style={{
                    padding: '16px 12px 16px 20px', fontSize: 16, fontWeight: 600,
                    color: 'var(--text-secondary)', background: '#F9FAFB',
                    borderRight: '1px solid var(--border)', userSelect: 'none',
                    whiteSpace: 'nowrap',
                }}>+91</span>
                <input
                    type="tel"
                    inputMode="numeric"
                    value={value}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="98765 43210"
                    maxLength={10}
                    style={{
                        flex: 1, padding: '16px 20px', border: 'none', outline: 'none',
                        fontSize: 16, fontWeight: 500, color: 'var(--text-primary)',
                        background: 'transparent', letterSpacing: '0.5px',
                    }}
                />
                <span style={{
                    padding: '0 16px', fontSize: 12, color: value.length === 10 ? '#16A34A' : '#888',
                    fontWeight: 500, whiteSpace: 'nowrap',
                }}>
                    {value.replace(/\D/g, '').length}/10
                </span>
            </div>
            {error && <p style={errorTextStyle}>{error}</p>}
        </div>
    );
}

function SelectButton({ children, selected, onClick }) {
    return (
        <button onClick={onClick} style={{
            padding: '14px 16px', borderRadius: 12,
            border: selected ? '2px solid var(--primary)' : '1px solid var(--border)',
            background: selected ? 'var(--pastel-green)' : 'white',
            fontSize: 14, fontWeight: 600,
            color: selected ? 'var(--primary-hover)' : 'var(--text-secondary)',
            cursor: 'pointer', transition: 'all 0.2s',
        }}>
            {children}
        </button>
    );
}

function PillButton({ children, selected, onClick }) {
    return (
        <button onClick={onClick} style={{
            padding: '10px 18px', borderRadius: 20,
            border: selected ? '2px solid var(--primary)' : '1px solid var(--border)',
            background: selected ? 'var(--pastel-green)' : 'white',
            fontSize: 14, fontWeight: 500,
            color: selected ? 'var(--primary-hover)' : 'var(--text-secondary)',
            cursor: 'pointer',
        }}>
            {children}
        </button>
    );
}

function EmojiButton({ item, selected, onClick }) {
    return (
        <button onClick={onClick} style={{
            padding: '16px', borderRadius: 16,
            border: selected ? '2px solid var(--primary)' : '1px solid var(--border)',
            background: selected ? 'var(--pastel-green)' : 'white',
            display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'all 0.2s',
        }}>
            <span style={{ fontSize: 24 }}>{item.emoji}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: selected ? 'var(--primary-hover)' : 'var(--text-secondary)' }}>
                {item.label}
            </span>
            {selected && <Check size={18} color="var(--primary)" style={{ marginLeft: 'auto' }} />}
        </button>
    );
}

function RadioCard({ item, selected, onClick }) {
    return (
        <button onClick={onClick} style={{
            padding: '18px 20px', borderRadius: 16,
            border: selected ? '2px solid var(--primary)' : '1px solid var(--border)',
            background: selected ? 'var(--pastel-green)' : 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.2s',
        }}>
            <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: selected ? 'var(--primary-hover)' : 'var(--text-primary)' }}>
                    {item.label}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                    {item.description}
                </div>
            </div>
            {selected && <Check size={22} color="var(--primary)" />}
        </button>
    );
}

function SelectCard({ item, selected, onClick }) {
    return (
        <button onClick={onClick} style={{
            padding: '16px', borderRadius: 16,
            border: selected ? '2px solid var(--primary)' : '1px solid var(--border)',
            background: selected ? 'var(--pastel-green)' : 'white',
            textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s',
        }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: selected ? 'var(--primary-hover)' : 'var(--text-primary)', marginBottom: 4 }}>
                {item.label}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {item.description}
            </div>
        </button>
    );
}
