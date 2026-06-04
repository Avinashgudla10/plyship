'use client';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth } from '../lib/firebase';
import { doc, setDoc, getDoc, addDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { Calendar, Clock, FileText, User, MapPin, Home, Wallet, ArrowRight, ArrowLeft, Check, Shield, X, Loader2 } from 'lucide-react';

const PROPERTY_TYPES = ['1 BHK', '2 BHK', '3 BHK', '4+ BHK', 'Villa', 'Office'];
const BUDGET_RANGES = [
    { id: '3-5', label: '₹3L - ₹5L' },
    { id: '5-10', label: '₹5L - ₹10L' },
    { id: '10-20', label: '₹10L - ₹20L' },
    { id: '20+', label: '₹20L+' },
];
const TIMELINES = [
    { id: 'immediate', label: 'Immediately' },
    { id: '1-3months', label: '1-3 Months' },
    { id: '3-6months', label: '3-6 Months' },
    { id: 'exploring', label: 'Just Exploring' },
];

const STEPS = [
    { id: 'meeting', title: 'Meeting Details', icon: Calendar },
    { id: 'profile', title: 'About You', icon: User },
    { id: 'verify', title: 'Verify Phone', icon: Shield },
];

const inputStyle = {
    width: '100%', padding: '14px 16px', borderRadius: 12,
    border: '1px solid #D1D5DB', background: 'white',
    fontSize: 15, fontWeight: 500, color: '#111827', outline: 'none',
};
const labelStyle = {
    fontSize: 12, fontWeight: 600, color: '#9CA3AF',
    textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, display: 'block',
};
const errStyle = { fontSize: 12, color: '#EF4444', marginTop: 4 };

export default function BookMeetingFlow({ company, onClose }) {
    const [step, setStep] = useState(0);
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [done, setDone] = useState(false);

    const [meetDate, setMeetDate] = useState('');
    const [meetTime, setMeetTime] = useState('');
    const [meetLocation, setMeetLocation] = useState('');
    const [meetNotes, setMeetNotes] = useState('');

    // Seeker profile
    const [name, setName] = useState('');
    const [city, setCity] = useState('');
    const [propertyType, setPropertyType] = useState('');
    const [budget, setBudget] = useState('');
    const [timeline, setTimeline] = useState('');

    // OTP
    const [phone, setPhone] = useState('');
    const [otpStep, setOtpStep] = useState('phone'); // 'phone' | 'otp'
    const [otp, setOtp] = useState(['','','','','','']);
    const [countdown, setCountdown] = useState(0);
    const [otpError, setOtpError] = useState('');
    const otpRefs = useRef([]);
    const confirmRef = useRef(null);
    const recaptchaRef = useRef(null);

    useEffect(() => {
        if (countdown > 0) {
            const t = setTimeout(() => setCountdown(c => c - 1), 1000);
            return () => clearTimeout(t);
        }
    }, [countdown]);

    const validate = () => {
        const e = {};
        if (step === 0) {
            if (!meetDate) {
                e.meetDate = 'Select a date';
            } else {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const selected = new Date(meetDate + 'T00:00:00');
                if (selected <= today) {
                    e.meetDate = 'Please select a future date';
                }
                const maxD = new Date(today);
                maxD.setDate(maxD.getDate() + 90);
                if (selected > maxD) {
                    e.meetDate = 'Date must be within the next 90 days';
                }
            }
            if (!meetTime) {
                e.meetTime = 'Select a time';
            } else {
                const [hours] = meetTime.split(':').map(Number);
                if (hours < 8 || hours >= 20) {
                    e.meetTime = 'Please select a time between 8 AM and 8 PM';
                }
            }
            // Validate location
            if (!meetLocation.trim()) {
                e.meetLocation = 'Meeting location is required';
            } else if (meetLocation.trim().length < 5) {
                e.meetLocation = 'Please enter a more specific location';
            }
            // Validate phone on step 0
            const cleanPhone = phone.replace(/\D/g, '');
            if (!cleanPhone) {
                e.phone = 'Mobile number is required';
            } else if (cleanPhone.length !== 10) {
                e.phone = 'Enter a valid 10-digit number';
            }
        } else if (step === 1) {
            if (!name.trim()) {
                e.name = 'Name is required';
            } else if (name.trim().length < 2) {
                e.name = 'Name must be at least 2 characters';
            } else if (name.trim().length > 50) {
                e.name = 'Name must be under 50 characters';
            }
            if (!city.trim()) {
                e.city = 'City is required';
            } else if (city.trim().length < 2) {
                e.city = 'Enter a valid city name';
            }
            if (!propertyType) e.propertyType = 'Select property type';
            if (!budget) e.budget = 'Select budget';
            if (!timeline) e.timeline = 'Select timeline';
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    // Track if phone belongs to an existing user
    const [isExistingUser, setIsExistingUser] = useState(false);

    const handleNext = async () => {
        if (!validate()) return;

        if (step === 0) {
            // Check if phone belongs to existing user
            setIsLoading(true);
            try {
                const fmt = `+91${phone.replace(/\D/g, '')}`;
                const [s1, s2] = await Promise.all([
                    getDocs(query(collection(db, 'seekers'), where('phone', '==', fmt))),
                    getDocs(query(collection(db, 'companies'), where('phone', '==', fmt))),
                ]);
                if (!s2.empty) {
                    setErrors({ phone: 'This number belongs to a company account. Only seekers can book meetings.' });
                    setIsLoading(false); return;
                }
                const existing = !s1.empty;
                setIsExistingUser(existing);
                // Existing user: skip profile step, go straight to OTP
                setStep(existing ? 2 : 1);
            } catch (err) {
                console.error('Phone check error:', err);
                setStep(1); // fallback: go to profile step
            }
            setIsLoading(false);
        } else {
            setStep(s => s + 1);
        }
    };
    const handleBack = () => {
        if (step === 2 && isExistingUser) {
            setStep(0);
        } else if (step > 0) {
            setStep(s => s - 1);
        }
    };

    const setupRecaptcha = () => {
        if (recaptchaRef.current) { recaptchaRef.current.clear(); recaptchaRef.current = null; }
        recaptchaRef.current = new RecaptchaVerifier(auth, 'book-recaptcha', { size: 'invisible' });
        return recaptchaRef.current;
    };

    const handleSendOTP = async () => {
        setOtpError('');
        const clean = phone.replace(/\D/g, '');
        if (clean.length !== 10) { setOtpError('Enter a valid 10-digit number'); return; }
        setIsLoading(true);
        try {
            // Check if phone already exists — but don't block, just track
            const fmt = `+91${clean}`;
            const [s1, s2] = await Promise.all([
                getDocs(query(collection(db, 'seekers'), where('phone', '==', fmt))),
                getDocs(query(collection(db, 'companies'), where('phone', '==', fmt))),
            ]);
            // If a company tries to book with another company, block it
            if (!s2.empty) {
                setOtpError('This number belongs to a company account. Only seekers can book meetings.');
                setIsLoading(false); return;
            }
            setIsExistingUser(!s1.empty);

            const verifier = setupRecaptcha();
            const result = await signInWithPhoneNumber(auth, fmt, verifier);
            confirmRef.current = result;
            setOtpStep('otp');
            setCountdown(30);
            setTimeout(() => otpRefs.current[0]?.focus(), 100);
        } catch (err) {
            console.error('OTP send error:', err);
            setOtpError('Failed to send OTP. Please try again.');
            if (recaptchaRef.current) { recaptchaRef.current.clear(); recaptchaRef.current = null; }
        }
        setIsLoading(false);
    };

    const handleVerifyOTP = async (code) => {
        const otpCode = code || otp.join('');
        if (otpCode.length !== 6) return;
        setIsLoading(true); setOtpError('');
        try {
            const result = await confirmRef.current.confirm(otpCode);
            const uid = result.user.uid;
            const phoneNum = result.user.phoneNumber;

            // Check if user already has a profile
            const existingDoc = await getDoc(doc(db, 'seekers', uid));

            if (!existingDoc.exists()) {
                // Generate username for new user
                const baseUsername = (name || 'user').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'user';
                let username = baseUsername;
                for (let i = 0; i < 5; i++) {
                    if (i > 0) username = `${baseUsername}${Math.floor(Math.random() * 9000) + 1000}`;
                    const usnap = await getDoc(doc(db, 'usernames', username));
                    if (!usnap.exists()) {
                        await setDoc(doc(db, 'usernames', username), { userId: uid, createdAt: new Date().toISOString() });
                        break;
                    }
                }

                // New user: create seeker profile
                const profileData = {
                    name, phone: phoneNum, role: 'SEEKER', profileComplete: true,
                    username,
                    createdAt: serverTimestamp(), lastActiveAt: serverTimestamp(),
                    profile: { name, city, propertyType, budget, timeline, styles: ['residential'], rooms: ['full'] },
                };
                await setDoc(doc(db, 'seekers', uid), profileData);
            }

            // Create meeting request in chat
            const companyId = company.id;
            const chatId = [uid, companyId].sort().join('_');
            await setDoc(doc(db, 'chats', chatId), {
                participants: [uid, companyId], createdAt: serverTimestamp(), lastMessage: `Meeting request for ${meetDate}`,
                lastMessageAt: serverTimestamp(), seekerId: uid, companyId,
            }, { merge: true });
            await addDoc(collection(db, 'chats', chatId, 'messages'), {
                senderId: uid, type: 'meeting_request',
                text: `📅 Meeting Request\nDate: ${meetDate}\nTime: ${meetTime}\nLocation: ${meetLocation}${meetNotes ? '\nNote: ' + meetNotes : ''}`,
                meetingData: { date: meetDate, time: meetTime, location: meetLocation, notes: meetNotes, status: 'pending' },
                createdAt: serverTimestamp(),
            });

            setDone(true);
        } catch (err) {
            console.error('Verify error:', err);
            setOtpError('Invalid OTP. Please try again.');
            setOtp(['','','','','','']);
            otpRefs.current[0]?.focus();
        }
        setIsLoading(false);
    };

    const handleOTPChange = (i, val) => {
        const d = val.replace(/\D/g, '');
        if (d.length > 1) {
            const arr = ['','','','','',''];
            for (let x = 0; x < Math.min(d.length, 6); x++) arr[x] = d[x];
            setOtp(arr);
            otpRefs.current[Math.min(d.length, 5)]?.focus();
            if (d.length >= 6) handleVerifyOTP(d.slice(0,6));
            return;
        }
        const arr = [...otp]; arr[i] = d; setOtp(arr);
        if (d && i < 5) otpRefs.current[i+1]?.focus();
        if (d && i === 5 && arr.every(x => x)) handleVerifyOTP(arr.join(''));
    };

    const handleOTPKey = (i, e) => { if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i-1]?.focus(); };

    const progress = ((step + 1) / STEPS.length) * 100;
    const companyName = company?.profile?.companyName || company?.name || 'this company';

    // Tomorrow as min date (local time, not UTC)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    // Max date: 90 days from now
    const maxDateObj = new Date();
    maxDateObj.setDate(maxDateObj.getDate() + 90);
    const maxDate = `${maxDateObj.getFullYear()}-${String(maxDateObj.getMonth() + 1).padStart(2, '0')}-${String(maxDateObj.getDate()).padStart(2, '0')}`;

    if (done) {
        return (
            <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
                <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} style={{ background:'white', borderRadius:24, padding:40, textAlign:'center', maxWidth:400, width:'100%' }}>
                    <motion.div initial={{scale:0}} animate={{scale:1}} transition={{type:'spring',damping:12}} style={{ width:72,height:72,borderRadius:'50%',background:'linear-gradient(135deg,#16A34A,#22C55E)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px' }}>
                        <Check size={36} color="white" strokeWidth={3}/>
                    </motion.div>
                    <h2 style={{fontSize:22,fontWeight:800,color:'#111827',marginBottom:8}}>Meeting Requested! 🎉</h2>
                    <p style={{fontSize:14,color:'#6B7280',lineHeight:1.6,marginBottom:24}}>
                        Your meeting request has been sent to <strong>{companyName}</strong> for {meetDate} at {meetTime}. They&apos;ll review and confirm soon.
                    </p>
                    <p style={{fontSize:13,color:'#9CA3AF',marginBottom:20}}>
                        Download the PlyShip app to track your meeting and chat with the company.
                    </p>
                    <motion.button onClick={onClose} whileTap={{scale:0.95}} style={{ padding:'14px 32px',borderRadius:14,background:'linear-gradient(135deg,#22C55E,#16A34A)',color:'white',fontSize:16,fontWeight:700,border:'none',cursor:'pointer' }}>
                        Done
                    </motion.button>
                </motion.div>
            </div>
        );
    }

    return (
        <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
            <div id="book-recaptcha"></div>
            <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} transition={{type:'spring',damping:25,stiffness:300}}
                style={{ background:'white', borderRadius:'24px 24px 0 0', width:'100%', maxWidth:500, maxHeight:'92vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>

                {/* Header */}
                <div style={{ padding:'20px 20px 16px', borderBottom:'1px solid #F3F4F6' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                        <h2 style={{ fontSize:18, fontWeight:800, color:'#111827' }}>Book a Meeting</h2>
                        <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', padding:4 }}><X size={20} color="#9CA3AF"/></button>
                    </div>
                    <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                        {STEPS.map((s, i) => (
                            <div key={s.id} style={{ flex:1, display:'flex', alignItems:'center', gap:6 }}>
                                <div style={{ width:24,height:24,borderRadius:'50%',fontSize:12,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',
                                    background: i <= step ? '#22C55E' : '#E5E7EB', color: i <= step ? 'white' : '#9CA3AF' }}>{i+1}</div>
                                <span style={{ fontSize:11, fontWeight:600, color: i <= step ? '#111827' : '#9CA3AF', display: i === step ? 'block' : 'none' }}>{s.title}</span>
                                {i < STEPS.length-1 && <div style={{ flex:1, height:2, background: i < step ? '#22C55E' : '#E5E7EB', borderRadius:1 }}/>}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Body */}
                <div style={{ flex:1, overflow:'auto', padding:20 }}>
                    <AnimatePresence mode="wait">
                        {step === 0 && (
                            <motion.div key="meet" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}}>
                                <p style={{ fontSize:14, color:'#6B7280', marginBottom:20 }}>Schedule a meeting with <strong>{companyName}</strong></p>
                                <div style={{ marginBottom:16 }}>
                                    <label style={labelStyle}>Preferred Date</label>
                                    <input type="date" value={meetDate} min={minDate} max={maxDate} onChange={e=>{setMeetDate(e.target.value);setErrors(prev=>({...prev,meetDate:undefined}));}} style={{...inputStyle, border: errors.meetDate ? '1px solid #EF4444' : inputStyle.border}} />
                                    {errors.meetDate && <p style={errStyle}>{errors.meetDate}</p>}
                                </div>
                                <div style={{ marginBottom:16 }}>
                                    <label style={labelStyle}>Preferred Time</label>
                                    <input type="time" value={meetTime} min="08:00" max="20:00" onChange={e=>{setMeetTime(e.target.value);setErrors(prev=>({...prev,meetTime:undefined}));}} style={{...inputStyle, border: errors.meetTime ? '1px solid #EF4444' : inputStyle.border}} />
                                    {errors.meetTime && <p style={errStyle}>{errors.meetTime}</p>}
                                </div>
                                <div style={{ marginBottom:16 }}>
                                    <label style={labelStyle}>Meeting Location</label>
                                    <input value={meetLocation} onChange={e=>{setMeetLocation(e.target.value);setErrors(prev=>({...prev,meetLocation:undefined}));}} placeholder="e.g., Coffee shop near Hitech City" 
                                        style={{...inputStyle, border: errors.meetLocation ? '1px solid #EF4444' : inputStyle.border}} />
                                    {errors.meetLocation && <p style={errStyle}>{errors.meetLocation}</p>}
                                </div>
                                <div style={{ marginBottom:16 }}>
                                    <label style={labelStyle}>Notes (optional)</label>
                                    <textarea value={meetNotes} onChange={e=>setMeetNotes(e.target.value)} placeholder="Any specific requirements..." rows={3}
                                        style={{...inputStyle, resize:'vertical', fontFamily:'inherit'}} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Your Mobile Number</label>
                                    <div style={{ display:'flex', gap:8 }}>
                                        <div style={{ padding:'14px 12px', borderRadius:12, border:'1px solid #D1D5DB', background:'#F9FAFB', fontSize:15, fontWeight:600, color:'#374151' }}>+91</div>
                                        <input type="tel" inputMode="numeric" value={phone} onChange={e=>{setPhone(e.target.value.replace(/\D/g,'').slice(0,10));setErrors(prev=>({...prev,phone:undefined}));}}
                                            placeholder="98765 43210" maxLength={10} style={{...inputStyle, flex:1, border: errors.phone ? '1px solid #EF4444' : inputStyle.border}} />
                                    </div>
                                    {errors.phone && <p style={errStyle}>{errors.phone}</p>}
                                    <p style={{ fontSize:11, color:'#9CA3AF', marginTop:6 }}>We'll send an OTP to verify this number</p>
                                </div>
                            </motion.div>
                        )}

                        {step === 1 && (
                            <motion.div key="prof" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}}>
                                <p style={{ fontSize:14, color:'#6B7280', marginBottom:20 }}>Tell us about yourself so the company can prepare</p>
                                <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                                    <div>
                                        <label style={labelStyle}>Full Name</label>
                                        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" style={{...inputStyle, border: errors.name ? '1px solid #EF4444' : inputStyle.border}} />
                                        {errors.name && <p style={errStyle}>{errors.name}</p>}
                                    </div>
                                    <div>
                                        <label style={labelStyle}>City</label>
                                        <input value={city} onChange={e=>setCity(e.target.value)} placeholder="e.g., Hyderabad" style={{...inputStyle, border: errors.city ? '1px solid #EF4444' : inputStyle.border}} />
                                        {errors.city && <p style={errStyle}>{errors.city}</p>}
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Property Type</label>
                                        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                                            {PROPERTY_TYPES.map(t => (
                                                <button key={t} onClick={()=>setPropertyType(t)} style={{
                                                    padding:'10px 8px', borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer',
                                                    border: propertyType===t ? '2px solid #22C55E' : '1px solid #D1D5DB',
                                                    background: propertyType===t ? '#F0FDF4' : 'white',
                                                    color: propertyType===t ? '#16A34A' : '#6B7280',
                                                }}>{t}</button>
                                            ))}
                                        </div>
                                        {errors.propertyType && <p style={errStyle}>{errors.propertyType}</p>}
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Budget</label>
                                        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8 }}>
                                            {BUDGET_RANGES.map(b => (
                                                <button key={b.id} onClick={()=>setBudget(b.id)} style={{
                                                    padding:'12px', borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer',
                                                    border: budget===b.id ? '2px solid #22C55E' : '1px solid #D1D5DB',
                                                    background: budget===b.id ? '#F0FDF4' : 'white',
                                                    color: budget===b.id ? '#16A34A' : '#6B7280',
                                                }}>{b.label}</button>
                                            ))}
                                        </div>
                                        {errors.budget && <p style={errStyle}>{errors.budget}</p>}
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Timeline</label>
                                        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8 }}>
                                            {TIMELINES.map(t => (
                                                <button key={t.id} onClick={()=>setTimeline(t.id)} style={{
                                                    padding:'12px', borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer',
                                                    border: timeline===t.id ? '2px solid #22C55E' : '1px solid #D1D5DB',
                                                    background: timeline===t.id ? '#F0FDF4' : 'white',
                                                    color: timeline===t.id ? '#16A34A' : '#6B7280',
                                                }}>{t.label}</button>
                                            ))}
                                        </div>
                                        {errors.timeline && <p style={errStyle}>{errors.timeline}</p>}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div key="otp" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}}>
                                {otpStep === 'phone' ? (
                                    <div>
                                        {isExistingUser && (
                                            <div style={{ padding:'12px 16px', borderRadius:12, background:'#F0FDF4', border:'1px solid #BBF7D0', marginBottom:16 }}>
                                                <p style={{ fontSize:13, color:'#16A34A', fontWeight:600 }}>👋 Welcome back!</p>
                                                <p style={{ fontSize:12, color:'#6B7280', marginTop:4 }}>We found your account. Verify your number to book this meeting.</p>
                                            </div>
                                        )}
                                        <p style={{ fontSize:14, color:'#6B7280', marginBottom:16 }}>
                                            We&apos;ll send a verification code to <strong>+91 {phone}</strong>
                                        </p>
                                        {otpError && <p style={{ ...errStyle, padding:'10px 14px', background:'#FEF2F2', borderRadius:10, border:'1px solid #FECACA', marginBottom:12 }}>{otpError}</p>}
                                        <motion.button onClick={handleSendOTP} disabled={isLoading} whileTap={{scale:0.98}}
                                            style={{ width:'100%', padding:'16px', borderRadius:14, background:'linear-gradient(135deg,#22C55E,#16A34A)',
                                                color:'white', fontSize:16, fontWeight:700, border:'none', cursor: isLoading ? 'wait' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                                            {isLoading ? <Loader2 size={20} style={{animation:'spin 1s linear infinite'}}/> : <><ArrowRight size={18}/> Send OTP</>}
                                        </motion.button>
                                        <button onClick={()=>handleBack()} style={{ display:'flex', alignItems:'center', gap:4, color:'#6B7280', fontSize:13, background:'none', border:'none', cursor:'pointer', marginTop:16, padding:0 }}>
                                            <ArrowLeft size={14}/> Change number
                                        </button>
                                    </div>
                                ) : (
                                    <div>
                                        <p style={{ fontSize:14, color:'#6B7280', marginBottom:16 }}>Enter the OTP sent to +91 {phone}</p>
                                        <div style={{ display:'flex', gap:8, justifyContent:'center', marginBottom:16 }}>
                                            {otp.map((d,i) => (
                                                <input key={i} ref={el=>otpRefs.current[i]=el} type="tel" inputMode="numeric"
                                                    autoComplete={i===0?'one-time-code':'off'} maxLength={i===0?6:1} value={d}
                                                    onChange={e=>handleOTPChange(i,e.target.value)} onKeyDown={e=>handleOTPKey(i,e)}
                                                    style={{ width:44,height:52,textAlign:'center',fontSize:20,fontWeight:700,borderRadius:12,
                                                        border: d ? '2px solid #22C55E' : '1px solid #D1D5DB', background: d ? '#F0FDF4' : '#F9FAFB', outline:'none', color:'#111827' }} />
                                            ))}
                                        </div>
                                        {otpError && <p style={{ ...errStyle, padding:'10px 14px', background:'#FEF2F2', borderRadius:10, border:'1px solid #FECACA', marginBottom:12 }}>{otpError}</p>}
                                        <motion.button onClick={()=>handleVerifyOTP()} disabled={isLoading||otp.some(x=>!x)} whileTap={{scale:0.98}}
                                            style={{ width:'100%', padding:'16px', borderRadius:14, background: otp.every(x=>x) ? 'linear-gradient(135deg,#22C55E,#16A34A)' : '#D1D5DB',
                                                color:'white', fontSize:16, fontWeight:700, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                                            {isLoading ? <Loader2 size={20} style={{animation:'spin 1s linear infinite'}}/> : <><Shield size={18}/> Verify & Book</>}
                                        </motion.button>
                                        <div style={{ textAlign:'center', marginTop:12, fontSize:13, color:'#9CA3AF' }}>
                                            {countdown > 0 ? <span>Resend in {countdown}s</span> : (
                                                <button onClick={handleSendOTP} style={{ color:'#16A34A', fontWeight:700, background:'none', border:'none', cursor:'pointer', fontSize:13 }}>Resend OTP</button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer */}
                {step < 2 && (
                    <div style={{ padding:'16px 20px 28px', borderTop:'1px solid #F3F4F6', display:'flex', gap:10 }}>
                        {step > 0 && (
                            <motion.button onClick={handleBack} whileTap={{scale:0.95}} style={{ flex:0.4, padding:'16px', borderRadius:14, background:'#F3F4F6', border:'none', color:'#374151', fontSize:15, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                                <ArrowLeft size={18}/> Back
                            </motion.button>
                        )}
                        <motion.button onClick={handleNext} whileTap={{scale:0.95}} style={{ flex:1, padding:'16px', borderRadius:14, background:'linear-gradient(135deg,#22C55E,#16A34A)', border:'none', color:'white', fontSize:16, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:'0 4px 14px rgba(22,163,74,0.3)' }}>
                            Continue <ArrowRight size={18}/>
                        </motion.button>
                    </div>
                )}
            </motion.div>
            <style jsx global>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
