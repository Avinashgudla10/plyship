'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, ArrowLeft, Briefcase, User, Home, Calendar, Clock, Check, X, RefreshCw, AlertCircle, Wallet, Star, Lock, SlidersHorizontal, ChevronDown, Search, CreditCard, Mic, Plus, FileText, Image as ImageIcon, Square, Play, Pause, Loader2, Camera, Phone, MapPin, UserCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { subscribeToMessages, uploadFile } from '../lib/firebase';
import { StartProjectModal } from './ProjectsView';
import { ScheduleMeetingModal, AcceptAndScheduleModal, CounterProposeModal } from './MeetingsView';
import ReviewModal from './ReviewModal';
import ProfileDetail from './ProfileDetail';
import LocationPicker from './LocationPicker';
import { buildRazorpayOptions, openRazorpayCheckout } from '../utils/razorpayHelper';

// ── Detect native WebView (Android/iOS wrapper) ──
// In native WebView, Web Audio API's createMediaElementSource fails on
// cross-origin Firebase Storage URLs because CORS headers aren't served.
// We skip the AudioContext volume boost and use native HTML5 audio instead.
const _isNativeWebView = typeof window !== 'undefined' && (
    /wv\b/.test(navigator.userAgent) ||              // Android WebView marker
    /; wv\)/.test(navigator.userAgent) ||             // Android WebView (full)
    !!window.PlyshipContacts ||                       // Our native bridge exists
    !!window.PlyshipPush                              // Our native push bridge exists
);

// ── Shared AudioContext for voice-note volume boost (desktop/PWA only) ──
let _sharedAudioCtx = null;
function getAudioContext() {
    if (!_sharedAudioCtx || _sharedAudioCtx.state === 'closed') {
        _sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (_sharedAudioCtx.state === 'suspended') _sharedAudioCtx.resume();
    return _sharedAudioCtx;
}

// ── Global exclusive playback manager ──
// Ensures only one voice note plays at a time across all VoiceNotePlayer instances.
// When a new note starts, the currently playing note is stopped automatically.
const _audioManager = {
    _currentStopFn: null,
    _currentId: null,
    // Register a playing instance. Returns true if successfully registered.
    play(id, stopFn) {
        // Stop the currently playing note (if any & different)
        if (this._currentId && this._currentId !== id && this._currentStopFn) {
            try { this._currentStopFn(); } catch (_) {}
        }
        this._currentId = id;
        this._currentStopFn = stopFn;
    },
    // Unregister when playback stops naturally
    stop(id) {
        if (this._currentId === id) {
            this._currentId = null;
            this._currentStopFn = null;
        }
    },
};

// ── WhatsApp-style Voice-Note Player (with optional volume boost) ──
// Desktop browsers: uses AudioContext.decodeAudioData for 3× gain boost
// Native WebView / fallback: uses plain HTML5 <audio> at max volume
//
// Key design: we NEVER use createMediaElementSource because it permanently
// captures the <audio> element's output. If the GainNode pipeline fails
// (CORS, security policy), the audio is silenced with no recovery path.
// Instead, we keep the <audio> element as the primary playback mechanism
// and use a completely independent AudioContext buffer for the gain boost.

const WAVEFORM_BARS = (() => {
    const seed = [4,7,5,8,3,9,6,4,7,5,8,6,3,9,7,5,8,4,6,9,5,7,3,8,6,4,9,5,7,8,3,6,4,9,7,5,8,6,3,7];
    return seed.map(v => v / 9); // normalize to 0-1
})();

// Stable unique ID counter for each VoiceNotePlayer instance
let _vnpIdCounter = 0;

function VoiceNotePlayer({ src, duration, isMe, formatDuration, senderAvatar }) {
    const audioRef = useRef(null);
    const [playing, setPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [elapsed, setElapsed] = useState(0);
    const [loading, setLoading] = useState(false); // loading state for lazy decode

    // Stable unique ID for this player instance (for exclusive playback)
    const instanceIdRef = useRef(null);
    if (instanceIdRef.current === null) instanceIdRef.current = `vnp_${++_vnpIdCounter}`;

    // AudioContext-based playback state (desktop gain boost)
    const ctxSourceRef = useRef(null);   // AudioBufferSourceNode (currently playing)
    const audioBufferRef = useRef(null); // decoded AudioBuffer
    const ctxStartTimeRef = useRef(0);   // audioContext.currentTime when playback started
    const ctxOffsetRef = useRef(0);      // resume offset in seconds
    const ctxTimerRef = useRef(null);    // progress update interval
    const useCtxPlaybackRef = useRef(false); // whether AudioContext path is active
    const gainLoadedRef = useRef(false); // whether we've already attempted buffer decode

    // LAZY audio decoding — only fetches & decodes when the user actually taps play.
    // This avoids flooding the network with fetch requests for every voice note on screen.
    // Returns true if AudioContext buffer path is ready, false to fall back to HTML5.
    const ensureAudioBuffer = async () => {
        // Already decoded
        if (gainLoadedRef.current) return useCtxPlaybackRef.current;

        // Run the AudioContext gain-boost path on native WebViews (Android/iOS) too.
        // It uses fetch + decodeAudioData + a buffer source (NOT createMediaElementSource),
        // so it works cross-origin in the WebView and applies the same volume boost as
        // desktop. Skipping it on native made voice notes play un-boosted (barely audible)
        // on mobile. If decode fails on any platform, we fall back to HTML5 audio below.
        if (!src) {
            gainLoadedRef.current = true;
            useCtxPlaybackRef.current = false;
            return false;
        }

        setLoading(true);
        try {
            const resp = await fetch(src);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const arrayBuf = await resp.arrayBuffer();
            const ctx = getAudioContext();
            const decoded = await ctx.decodeAudioData(arrayBuf);
            audioBufferRef.current = decoded;
            useCtxPlaybackRef.current = true;
            gainLoadedRef.current = true;
            return true;
        } catch (e) {
            // Decode failed (CORS, unsupported codec, etc.) — fall back to HTML5 audio
            console.warn('⚠️ VoiceNote: AudioContext decode failed, using HTML5 audio:', e.message);
            useCtxPlaybackRef.current = false;
            gainLoadedRef.current = true;
            return false;
        } finally {
            setLoading(false);
        }
    };

    // Reset decode state when src changes
    useEffect(() => {
        gainLoadedRef.current = false;
        audioBufferRef.current = null;
        useCtxPlaybackRef.current = false;
    }, [src]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (ctxSourceRef.current) {
                try { ctxSourceRef.current.stop(); } catch (_) {}
            }
            if (ctxTimerRef.current) clearInterval(ctxTimerRef.current);
        };
    }, []);

    // --- AudioContext playback helpers (gain-boosted path) ---
    const ctxPlay = (offset = 0) => {
        const buffer = audioBufferRef.current;
        if (!buffer) return false;
        try {
            const ctx = getAudioContext();
            const source = ctx.createBufferSource();
            source.buffer = buffer;

            // Volume boost pipeline: Source → Gain (5×) → Compressor → Destination
            // The compressor prevents clipping/distortion at high gain levels
            const gain = ctx.createGain();
            gain.gain.value = 5.0; // 5× volume boost for clear, loud playback

            const compressor = ctx.createDynamicsCompressor();
            compressor.threshold.value = -20;  // Start compressing at -20dB
            compressor.knee.value = 10;         // Smooth compression transition
            compressor.ratio.value = 4;         // 4:1 compression ratio
            compressor.attack.value = 0.003;    // Fast attack for voice
            compressor.release.value = 0.15;    // Medium release

            source.connect(gain).connect(compressor).connect(ctx.destination);
            source.onended = () => {
                if (ctxSourceRef.current === source) {
                    setPlaying(false);
                    setProgress(0);
                    setElapsed(0);
                    ctxOffsetRef.current = 0;
                    if (ctxTimerRef.current) { clearInterval(ctxTimerRef.current); ctxTimerRef.current = null; }
                    _audioManager.stop(instanceIdRef.current);
                }
            };
            source.start(0, offset);
            ctxSourceRef.current = source;
            ctxStartTimeRef.current = ctx.currentTime;
            ctxOffsetRef.current = offset;
            setPlaying(true);

            // Register with global manager for exclusive playback
            _audioManager.play(instanceIdRef.current, () => {
                ctxPause();
            });

            // Progress updater
            if (ctxTimerRef.current) clearInterval(ctxTimerRef.current);
            ctxTimerRef.current = setInterval(() => {
                const ctx2 = getAudioContext();
                const cur = ctxOffsetRef.current + (ctx2.currentTime - ctxStartTimeRef.current);
                const dur = buffer.duration;
                if (dur > 0) {
                    setProgress(Math.min(1, cur / dur));
                    setElapsed(Math.floor(cur));
                }
            }, 100);
            return true;
        } catch (e) {
            console.warn('⚠️ VoiceNote: AudioContext play failed:', e.message);
            return false;
        }
    };

    const ctxPause = () => {
        if (ctxSourceRef.current) {
            const ctx = getAudioContext();
            ctxOffsetRef.current += ctx.currentTime - ctxStartTimeRef.current;
            try { ctxSourceRef.current.stop(); } catch (_) {}
            ctxSourceRef.current = null;
        }
        if (ctxTimerRef.current) { clearInterval(ctxTimerRef.current); ctxTimerRef.current = null; }
        setPlaying(false);
        _audioManager.stop(instanceIdRef.current);
    };

    // --- Toggle play/pause (now async for lazy decode) ---
    const toggle = async () => {
        // If already playing, just pause
        if (playing) {
            if (useCtxPlaybackRef.current && audioBufferRef.current) {
                ctxPause();
            } else {
                const audio = audioRef.current;
                if (audio) audio.pause();
            }
            return;
        }

        // Not playing — ensure audio is decoded/loaded first (lazy)
        const useCtx = await ensureAudioBuffer();

        // Path 1: AudioContext gain-boosted playback (desktop)
        if (useCtx && audioBufferRef.current) {
            ctxPlay(ctxOffsetRef.current);
            return;
        }

        // Path 2: Plain HTML5 <audio> (native WebView + fallback)
        const audio = audioRef.current;
        if (!audio) return;
        audio.volume = 1.0;
        // Register with global manager for exclusive playback
        _audioManager.play(instanceIdRef.current, () => {
            audio.pause();
            setPlaying(false);
            _audioManager.stop(instanceIdRef.current);
        });
        audio.play().catch((e) => {
            console.warn('⚠️ VoiceNote: HTML5 play failed:', e.message);
            _audioManager.stop(instanceIdRef.current);
        });
    };

    // HTML5 audio event listeners (for fallback path)
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const onPlay = () => { if (!useCtxPlaybackRef.current) setPlaying(true); };
        const onPause = () => { if (!useCtxPlaybackRef.current) setPlaying(false); };
        const onEnded = () => {
            if (!useCtxPlaybackRef.current) {
                setPlaying(false); setProgress(0); setElapsed(0);
                _audioManager.stop(instanceIdRef.current);
            }
        };
        const onTime = () => {
            if (!useCtxPlaybackRef.current && audio.duration && isFinite(audio.duration)) {
                setProgress(audio.currentTime / audio.duration);
                setElapsed(Math.floor(audio.currentTime));
            }
        };
        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('timeupdate', onTime);
        return () => {
            audio.removeEventListener('play', onPlay);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('timeupdate', onTime);
        };
    }, []);

    const seek = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

        if (useCtxPlaybackRef.current && audioBufferRef.current) {
            const newOffset = ratio * audioBufferRef.current.duration;
            if (playing) {
                ctxPause();
                ctxPlay(newOffset);
            } else {
                ctxOffsetRef.current = newOffset;
                setProgress(ratio);
                setElapsed(Math.floor(newOffset));
            }
            return;
        }

        const audio = audioRef.current;
        if (!audio || !audio.duration) return;
        audio.currentTime = ratio * audio.duration;
    };

    const displayTime = playing || elapsed > 0
        ? formatDuration(elapsed)
        : (duration ? formatDuration(duration) : '0:00');

    // Color scheme
    const accentColor = isMe ? '#fff' : '#4ADE80';
    const mutedColor = isMe ? 'rgba(255,255,255,0.4)' : 'rgba(74,222,128,0.35)';
    const playBtnBg = isMe ? 'rgba(255,255,255,0.2)' : 'rgba(74,222,128,0.12)';
    const avatarBorder = isMe ? 'rgba(255,255,255,0.3)' : '#4ADE80';

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 220, padding: '2px 0' }}>
            {/* Hidden audio element — NO crossOrigin so it always loads */}
            <audio ref={audioRef} src={src} preload="none" style={{ display: 'none' }} />

            {/* Avatar with mic badge — WhatsApp style */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                    width: 46, height: 46, borderRadius: '50%',
                    border: `2px solid ${avatarBorder}`,
                    background: senderAvatar
                        ? `url(${senderAvatar}) center/cover no-repeat`
                        : (isMe ? 'rgba(255,255,255,0.15)' : '#E8F5E9'),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden',
                }}>
                    {!senderAvatar && <Mic size={20} color={isMe ? '#fff' : '#4ADE80'} />}
                </div>
                {/* Mic badge */}
                <div style={{
                    position: 'absolute', bottom: -2, right: -2,
                    width: 18, height: 18, borderRadius: '50%',
                    background: isMe ? '#128C7E' : '#4ADE80',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `2px solid ${isMe ? '#22C55E' : '#fff'}`,
                }}>
                    <Mic size={9} color="#fff" />
                </div>
            </div>

            {/* Play / Pause button */}
            <motion.button
                onClick={toggle}
                whileTap={{ scale: 0.85 }}
                style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: playBtnBg,
                    border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', flexShrink: 0,
                }}
            >
                {loading
                    ? <Loader2 size={18} color={accentColor} style={{ animation: 'spin 1s linear infinite' }} />
                    : playing
                        ? <Pause size={18} color={accentColor} fill={accentColor} />
                        : <Play  size={18} color={accentColor} fill={accentColor} style={{ marginLeft: 2 }} />}
            </motion.button>

            {/* Waveform + Duration column */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                {/* Waveform bars (seekable) */}
                <div
                    onClick={seek}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 1.5,
                        height: 28, cursor: 'pointer', position: 'relative',
                    }}
                >
                    {WAVEFORM_BARS.map((h, i) => {
                        const barProgress = i / WAVEFORM_BARS.length;
                        const isActive = barProgress < progress;
                        const minH = 4;
                        const maxH = 22;
                        const barHeight = minH + h * (maxH - minH);
                        return (
                            <div
                                key={i}
                                style={{
                                    width: 3,
                                    height: barHeight,
                                    borderRadius: 1.5,
                                    background: isActive ? accentColor : mutedColor,
                                    transition: 'background 0.1s ease',
                                    flexShrink: 0,
                                }}
                            />
                        );
                    })}
                </div>

                {/* Duration */}
                <span style={{
                    fontSize: 11, opacity: 0.75, fontFamily: 'monospace',
                    color: isMe ? 'rgba(255,255,255,0.85)' : 'var(--text-secondary)',
                    letterSpacing: 0.3,
                }}>
                    {displayTime}
                </span>
            </div>
        </div>
    );
}

// ── Keyboard/Back-button handler for file preview overlay ──
// Listens for Escape key on desktop and popstate (back button) on mobile.
// Rendered inside AnimatePresence so it auto-mounts/unmounts with the overlay.
function FilePreviewKeyHandler({ onClose }) {
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };

        // Push a fake history state so the mobile back button closes the overlay
        // instead of navigating away from the chat.
        window.history.pushState({ filePreview: true }, '');

        const handlePopState = (e) => {
            // Back button pressed while overlay is open → close overlay
            onClose();
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('popstate', handlePopState);
        };
    }, [onClose]);

    return null;
}

// Chat list view
export function ChatListView({ chats = [], onChatSelect, user }) {
    const [filter, setFilter] = useState('all');
    const [filterOpen, setFilterOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const isCompany = user?.role === 'COMPANY';

    const MEETING_STATUS_CONFIG = {
        REQUESTED: { label: 'Requested', color: '#8B5CF6', bg: '#F5F3FF', icon: '📩' },
        PROPOSED: { label: 'Proposed', color: '#F59E0B', bg: '#FFFBEB', icon: '📋' },
        PENDING_ACCEPTANCE: { label: 'Pending', color: '#3B82F6', bg: '#EFF6FF', icon: '⏳' },
        SCHEDULED: { label: 'Scheduled', color: '#3B82F6', bg: '#EFF6FF', icon: '📅' },
        CONFIRMED: { label: 'Completed', color: '#22C55E', bg: '#F0FDF4', icon: '✓' },
        CANCELLED: { label: 'Cancelled', color: '#EF4444', bg: '#FEF2F2', icon: '✕' },
        DECLINED: { label: 'Declined', color: '#EF4444', bg: '#FEF2F2', icon: '✕' },
        DISPUTE: { label: 'Dispute', color: '#DC2626', bg: '#FEF2F2', icon: '⚠' },
    };

    const FILTERS = [
        { key: 'all', label: 'All' },
        { key: 'no_meeting', label: 'No Meeting' },
        { key: 'PENDING_ACCEPTANCE', label: 'Pending' },
        { key: 'SCHEDULED', label: 'Scheduled' },
        { key: 'CONFIRMED', label: 'Completed' },
        { key: 'ended', label: 'Cancelled' },
    ];

    // Meeting priority: PENDING first, then SCHEDULED, then rest
    const meetingPriority = { REQUESTED: 5, PROPOSED: 4, PENDING_ACCEPTANCE: 3, SCHEDULED: 2 };

    const filteredChats = chats
        .filter(chat => {
            // Search filter
            if (searchTerm) {
                const name = (chat.matchedUserName || '').toLowerCase();
                if (!name.includes(searchTerm.toLowerCase())) return false;
            }
            // Status filter
            if (filter === 'all') return true;
            if (filter === 'no_meeting') return !chat.meetingStatus;
            if (filter === 'ended') return ['CANCELLED', 'DECLINED'].includes(chat.meetingStatus);
            return chat.meetingStatus === filter;
        })
        .sort((a, b) => {
            // Priority: meeting requests on top
            const pa = meetingPriority[a.meetingStatus] || 0;
            const pb = meetingPriority[b.meetingStatus] || 0;
            if (pa !== pb) return pb - pa;
            // Then by last message time
            const timeA = a.lastMessageAt?.toDate?.() || new Date(a.lastMessageAt || 0);
            const timeB = b.lastMessageAt?.toDate?.() || new Date(b.lastMessageAt || 0);
            return timeB - timeA;
        });

    if (chats.length === 0) {
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
                    <MessageCircle size={36} color="var(--primary)" />
                </motion.div>
                <h2 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 24,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginBottom: 8,
                }}>
                    No conversations yet
                </h2>
                <p style={{
                    fontSize: 15,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                }}>
                    Connect with someone to start chatting!
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
            {/* Search bar */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                background: 'white',
                borderRadius: 12,
                border: '1px solid var(--border-light)',
                marginBottom: 14,
            }}>
                <Search size={18} color="var(--text-muted)" />
                <input
                    type="text"
                    placeholder="Search conversations..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{
                        border: 'none',
                        outline: 'none',
                        flex: 1,
                        fontSize: 14,
                        color: 'var(--text-primary)',
                        background: 'transparent',
                        padding: 0,
                    }}
                />
            </div>

            {/* Header with filter */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h2 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 22,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                }}>
                    Messages
                </h2>

                {/* Hamburger Filter Button (Companies only) */}
                {isCompany && (
                    <div style={{ position: 'relative' }}>
                        <motion.button
                            onClick={() => setFilterOpen(!filterOpen)}
                            whileTap={{ scale: 0.93 }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '7px 12px',
                                borderRadius: 10,
                                border: filter !== 'all' ? '1.5px solid var(--primary)' : '1px solid var(--border-light)',
                                background: filter !== 'all' ? 'var(--pastel-green)' : 'white',
                                color: filter !== 'all' ? 'var(--primary)' : 'var(--text-secondary)',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                        >
                            <SlidersHorizontal size={14} />
                            {filter !== 'all' ? FILTERS.find(f => f.key === filter)?.label : 'Filter'}
                            <ChevronDown size={12} style={{ transform: filterOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
                        </motion.button>

                        {/* Dropdown */}
                        <AnimatePresence>
                            {filterOpen && (
                                <>
                                    {/* Invisible overlay to close dropdown */}
                                    <div
                                        onClick={() => setFilterOpen(false)}
                                        style={{ position: 'fixed', inset: 0, zIndex: 49 }}
                                    />
                                    <motion.div
                                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                                        transition={{ duration: 0.15 }}
                                        style={{
                                            position: 'absolute',
                                            top: '110%',
                                            right: 0,
                                            background: 'white',
                                            borderRadius: 14,
                                            boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                                            border: '1px solid var(--border-light)',
                                            padding: 6,
                                            minWidth: 160,
                                            zIndex: 50,
                                            overflow: 'hidden',
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
                                                    padding: '10px 14px',
                                                    borderRadius: 10,
                                                    border: 'none',
                                                    background: filter === f.key ? 'var(--pastel-green)' : 'transparent',
                                                    color: filter === f.key ? 'var(--primary)' : 'var(--text-primary)',
                                                    fontSize: 13,
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredChats.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 14 }}>
                        No chats match this filter
                    </div>
                ) : filteredChats.map((chat, index) => {
                    const isBroadcast = chat?.isBroadcast || chat?.matchedUserId === 'plyship-admin';
                    const isChatCompany = !isBroadcast && (chat?.matchedUserRole === 'COMPANY' || chat?.role === 'COMPANY');
                    const profile = chat?.matchedUserProfile || chat?.profile || {};
                    const name = chat?.matchedUserName || (isChatCompany ? profile.companyName : profile.name);
                    const image = isBroadcast ? '/favicon.png' : (profile.avatar || profile.portfolioImages?.[0]);
                    const statusConfig = chat.meetingStatus ? MEETING_STATUS_CONFIG[chat.meetingStatus] : null;

                    // Format last message time
                    const formatTime = (timestamp) => {
                        if (!timestamp) return '';
                        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
                        const now = new Date();
                        const diff = now - date;
                        if (diff < 60000) return 'Just now';
                        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
                        if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                    };

                    return (
                        <motion.div
                            key={chat.id || index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            onClick={() => onChatSelect?.(chat)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                padding: 14,
                                borderRadius: 14,
                                background: 'white',
                                border: statusConfig && (chat.meetingStatus === 'PENDING_ACCEPTANCE' || chat.meetingStatus === 'REQUESTED' || chat.meetingStatus === 'PROPOSED')
                                    ? '1.5px solid #3B82F640'
                                    : '1px solid var(--border-light)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                        >
                            {/* Avatar */}
                            <div style={{
                                width: 52,
                                height: 52,
                                borderRadius: isChatCompany ? 14 : '50%',
                                background: image ? `url(${image}) center/cover` : 'var(--pastel-green)',
                                border: '2px solid var(--pastel-mint)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}>
                                {!image && (isChatCompany ? <Briefcase size={22} color="var(--primary)" /> : <User size={22} color="var(--primary)" />)}
                            </div>

                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                                    <h3 style={{
                                        fontSize: 15,
                                        fontWeight: 700,
                                        color: 'var(--text-primary)',
                                    }}>
                                        {name || 'Unknown'}
                                    </h3>
                                    {/* Blue Verified Tick for PlyShip Team */}
                                    {isBroadcast && (
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: 18,
                                            height: 18,
                                            borderRadius: '50%',
                                            background: '#1D9BF0',
                                            flexShrink: 0,
                                        }}>
                                            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                                                <path d="M2 6.5L4.5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        </span>
                                    )}
                                    {/* Meeting Status Badge */}
                                    {statusConfig && (
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 3,
                                            padding: '2px 8px',
                                            borderRadius: 10,
                                            background: statusConfig.bg,
                                            color: statusConfig.color,
                                            fontSize: 10,
                                            fontWeight: 700,
                                            letterSpacing: 0.3,
                                            flexShrink: 0,
                                        }}>
                                            {statusConfig.icon} {statusConfig.label}
                                        </span>
                                    )}
                                </div>
                                <p style={{
                                    fontSize: 13,
                                    color: chat.lastMessage ? 'var(--text-secondary)' : 'var(--text-muted)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    fontStyle: chat.lastMessage ? 'normal' : 'italic',
                                }}>
                                    {chat.lastMessage || 'Tap to start chatting...'}
                                </p>
                            </div>

                            {/* Time */}
                            <span style={{
                                fontSize: 11,
                                color: 'var(--text-muted)',
                                flexShrink: 0,
                            }}>
                                {chat.lastMessageAt ? formatTime(chat.lastMessageAt) : 'New'}
                            </span>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}

// Individual chat view
export function ChatView({ chat, onBack, onNavigate, showMeetingOnOpen, onMeetingModalShown }) {
    const {
        user, sendMessage, getChatId, getWallet, topUpWallet,
        getMeetings, subscribeMeetings, acceptMeeting, declineMeeting, confirmMeeting, cancelMeeting, denyMeeting, verifyMeetingOTP, acceptAndScheduleMeeting,
        counterProposeMeeting, acceptProposedMeeting,
        getProjects, subscribeProjects, acceptProject, declineProject, requestRescheduleMeeting,
        subscribeWallet
    } = useAuth();
    const { showToast, showConfirm } = useToast();
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [sending, setSending] = useState(false);
    const [showProjectModal, setShowProjectModal] = useState(false);
    const [showMeetingModal, setShowMeetingModal] = useState(false);
    const [showRescheduleModal, setShowRescheduleModal] = useState(false);
    const [meetings, setMeetings] = useState([]);
    const [meetingsLoaded, setMeetingsLoaded] = useState(false);
    const [projects, setProjects] = useState([]);
    const [actionLoading, setActionLoading] = useState(null);
    const [walletBalance, setWalletBalance] = useState(null);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [reviewData, setReviewData] = useState(null);
    const [showProfileDetail, setShowProfileDetail] = useState(false);
    const [showAcceptScheduleModal, setShowAcceptScheduleModal] = useState(false);
    const [showCounterProposeModal, setShowCounterProposeModal] = useState(false);
    const [otpInput, setOtpInput] = useState('');
    const messagesEndRef = useRef(null);

    // File preview overlay state (images, PDFs — fullscreen in-app viewer)
    const [filePreview, setFilePreview] = useState(null); // { url, type: 'image'|'pdf', name }

    // In-app map preview popup (PDF-popup style) — for viewing a location without leaving chat
    const [mapPreview, setMapPreview] = useState(null); // { coords: 'lat,lng'|null, address: string|null }
    const openMapPreview = (coords, address) => {
        if (!coords && !address) return;
        setMapPreview({ coords: coords || null, address: address || null });
    };
    // "+" menu location picker (choose current location or pin on map)
    const [showLocationPicker, setShowLocationPicker] = useState(false);

    // Voice recording state
    const [isRecording, setIsRecording] = useState(false);
    const [micConnecting, setMicConnecting] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [uploadingFiles, setUploadingFiles] = useState([]); // {id, name, type, localUrl, fileType}
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordingTimerRef = useRef(null);
    const cameraInputRef = useRef(null);
    const galleryInputRef = useRef(null);
    const docInputRef = useRef(null);

    // ── Prevent ALL forms of page refresh while inside the chat ──
    // Blocks: browser-native pull-to-refresh (overscroll-behavior CSS),
    // native WebView pull-to-refresh (global kill switch for injected JS),
    // AppShell custom pull-to-refresh (data-no-pull-refresh attribute),
    // and keyboard shortcuts (F5, Ctrl+R / Cmd+R).
    // NOTE: We do NOT use beforeunload — it shows a browser-like dialog
    // which looks out of place in a mobile app.
    useEffect(() => {
        // 1. Block browser-native pull-to-refresh (Chrome mobile, PWA, etc.)
        const html = document.documentElement;
        const body = document.body;
        const prevHtmlOverscroll = html.style.overscrollBehavior;
        const prevBodyOverscroll = body.style.overscrollBehavior;
        html.style.overscrollBehavior = 'none';
        body.style.overscrollBehavior = 'none';

        // 2. Set global kill switch for native Android/iOS injected pull-to-refresh scripts.
        //    Both PlyshipViewController.swift and MainActivity.java check this flag
        //    in their touchstart handlers before allowing pull-to-refresh.
        window.__plyPTR_disabled = true;

        // 3. Block F5, Ctrl+R (Windows/Linux), Cmd+R (Mac) keyboard refresh
        const blockRefreshKeys = (e) => {
            if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key === 'r')) {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        document.addEventListener('keydown', blockRefreshKeys, true);

        return () => {
            // Restore original overscroll behavior when leaving chat
            html.style.overscrollBehavior = prevHtmlOverscroll || '';
            body.style.overscrollBehavior = prevBodyOverscroll || '';
            // Re-enable native pull-to-refresh for other views
            window.__plyPTR_disabled = false;
            document.removeEventListener('keydown', blockRefreshKeys, true);
        };
    }, []);

    const MAX_VOICE_DURATION = 300; // 5 minutes in seconds
    const ALLOWED_FILE_TYPES = {
        'image/jpeg': 'image', 'image/png': 'image', 'image/gif': 'image', 'image/webp': 'image',
        'application/pdf': 'pdf',
        'application/msword': 'document', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
    };
    const ALLOWED_EXTENSIONS = '.jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx';

    // Cleanup recording on unmount
    useEffect(() => {
        return () => {
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
        };
    }, []);

    // Voice recording handlers
    const getSupportedMimeType = () => {
        const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg', ''];
        for (const t of types) {
            if (t === '' || MediaRecorder.isTypeSupported(t)) return t;
        }
        return '';
    };

    const startRecording = async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            showToast('Voice recording is not supported on this device.', 'error');
            return;
        }

        // Show recording UI INSTANTLY — before mic is ready
        setMicConnecting(true);
        setIsRecording(true);
        setRecordingDuration(0);

        // Kill any leftover recorder
        try {
            if (mediaRecorderRef.current) {
                if (mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
                mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop());
                mediaRecorderRef.current = null;
            }
        } catch (e) {}

        try {
            // Enhanced audio constraints for maximum recording quality & volume
            // AGC (Auto Gain Control) boosts quiet voices, noise suppression
            // cleans up background hiss, echo cancellation prevents feedback.
            // sampleRate / channelCount ensure high-fidelity capture.
            const audioConstraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: { ideal: 48000 },
                    sampleSize: { ideal: 16 },
                    channelCount: { ideal: 1 },
                },
            };
            const stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
            const mimeType = getSupportedMimeType();

            // Use higher bitrate for better audio quality when supported
            const recorderOptions = mimeType ? { mimeType } : {};
            if (mimeType && mimeType.includes('opus')) {
                recorderOptions.audioBitsPerSecond = 128000; // 128kbps for clear voice
            } else if (mimeType) {
                recorderOptions.audioBitsPerSecond = 96000; // 96kbps fallback
            }

            const mediaRecorder = new MediaRecorder(stream, recorderOptions);
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
            mediaRecorder.onstop = () => { stream.getTracks().forEach(t => t.stop()); };

            mediaRecorder.start(250);
            mediaRecorderRef.current = mediaRecorder;
            setMicConnecting(false);

            recordingTimerRef.current = setInterval(() => {
                setRecordingDuration(prev => {
                    if (prev >= MAX_VOICE_DURATION - 1) { stopRecordingAndSend(); return prev; }
                    return prev + 1;
                });
            }, 1000);
        } catch (err) {
            console.error('Mic error:', err.name, err.message);
            setIsRecording(false);
            setMicConnecting(false);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                showToast('Microphone permission denied. Please allow in your device settings.', 'error');
            } else {
                showToast('Could not access microphone. Please try again.', 'error');
            }
        }
    };

    const cancelRecording = () => {
        if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.onstop = () => { mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop()); };
            mediaRecorderRef.current.stop();
        }
        audioChunksRef.current = [];
        setIsRecording(false);
        setRecordingDuration(0);
    };

    const stopRecordingAndSend = async () => {
        if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
        const duration = recordingDuration;
        setIsRecording(false);
        setRecordingDuration(0);

        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

        return new Promise((resolve) => {
            mediaRecorderRef.current.onstop = async () => {
                mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop());
                const actualMime = mediaRecorderRef.current.mimeType || 'audio/webm';
                const blob = new Blob(audioChunksRef.current, { type: actualMime });
                audioChunksRef.current = [];
                if (blob.size < 1000) { resolve(); return; } // Too short

                const ext = actualMime.includes('mp4') ? 'mp4' : actualMime.includes('ogg') ? 'ogg' : 'webm';
                setUploadingFile(true);
                try {
                    const path = `chats/${chatId}/voice_${Date.now()}.${ext}`;
                    const url = await uploadFile(blob, path, actualMime);
                    await sendMessage(otherUserId, '', { url, type: 'voice', name: 'Voice note', duration });
                } catch (e) { showToast('Failed to send voice note', 'error'); }
                setUploadingFile(false);
                resolve();
            };
            mediaRecorderRef.current.stop();
        });
    };

    // File upload handler — supports multiple files
    const handleFileSelect = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        e.target.value = ''; // reset input

        setUploadingFile(true);
        setShowAttachMenu(false);

        for (const file of files) {
            // Check type
            const fileType = ALLOWED_FILE_TYPES[file.type];
            if (!fileType) {
                showToast(`"${file.name}" is not supported. Use images, PDFs, or Word docs.`, 'error');
                continue;
            }
            // Check size
            if (file.size > 25 * 1024 * 1024) {
                showToast(`"${file.name}" is too large. Max 25MB.`, 'error');
                continue;
            }

            // Create local preview and add to uploading list
            const uploadId = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            const localUrl = fileType === 'image' ? URL.createObjectURL(file) : null;
            const previewItem = { id: uploadId, name: file.name, fileType, localUrl };
            setUploadingFiles(prev => [...prev, previewItem]);

            try {
                const ext = file.name.split('.').pop() || 'jpg';
                const path = `chats/${chatId}/${fileType}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
                const url = await uploadFile(file, path, file.type);
                await sendMessage(otherUserId, '', { url, type: fileType, name: file.name });
            } catch (err) {
                showToast(`Failed to upload "${file.name}"`, 'error');
            }

            // Remove from uploading list and revoke blob URL
            setUploadingFiles(prev => prev.filter(f => f.id !== uploadId));
            if (localUrl) URL.revokeObjectURL(localUrl);
        }
        setUploadingFile(false);
    };

    const formatDuration = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

    // Auto-open meeting modal when coming from Meet button
    useEffect(() => {
        if (showMeetingOnOpen) {
            setShowMeetingModal(true);
            onMeetingModalShown?.();
        }
    }, [showMeetingOnOpen, onMeetingModalShown]);

    const isSeeker = user?.role === 'SEEKER';
    const isCompanyUser = user?.role === 'COMPANY';
    const MEETING_FEE = 500;

    const isBroadcast = chat?.isBroadcast || chat?.matchedUserId === 'plyship-admin';

    // Get chat partner info
    const isCompany = !isBroadcast && (chat?.matchedUserRole === 'COMPANY' || chat?.role === 'COMPANY');
    const profile = chat?.matchedUserProfile || chat?.profile || {};
    const name = chat?.matchedUserName || (isCompany ? profile.companyName : profile.name);
    const image = isBroadcast ? '/favicon.png' : (profile.avatar || profile.portfolioImages?.[0]);
    const otherUserId = chat?.matchedUserId || chat?.id;

    // Generate chat ID — broadcast chats use their own ID format
    const chatId = isBroadcast ? chat.id : (user && otherUserId ? getChatId(user.id, otherUserId) : null);

    // Subscribe to real-time meetings between these two users (replaces 5s polling)
    useEffect(() => {
        if (!user || !otherUserId) return;
        const unsubscribe = subscribeMeetings((allMeetings) => {
            const relevantMeetings = allMeetings.filter(m => {
                return (m.companyId === otherUserId || m.seekerId === otherUserId) && !m.rescheduledTo;
            });
            setMeetings(relevantMeetings);
            setMeetingsLoaded(true);
        });
        return () => unsubscribe();
    }, [user, otherUserId, subscribeMeetings]);

    // NOTE: Previously auto-opened meeting modal for brand-new chats with no meetings.
    // Removed so that clicking Message in Find Connections lets users chat directly.
    // Use the dedicated "Meet" button to book meetings instead.

    // Subscribe to real-time projects between these two users (replaces 3s polling)
    useEffect(() => {
        if (!user || !otherUserId) return;
        const unsubscribe = subscribeProjects((allProjects) => {
            const relevantProjects = allProjects.filter(p =>
                (p.companyId === otherUserId || p.seekerId === otherUserId)
            );
            setProjects(relevantProjects);
        });
        return () => unsubscribe();
    }, [user, otherUserId, subscribeProjects]);

    // Subscribe to real-time wallet balance for companies (replaces 10s polling)
    useEffect(() => {
        if (!user || !isCompanyUser) return;
        const unsubscribe = subscribeWallet((walletData) => {
            setWalletBalance(walletData?.balance || 0);
        });
        return () => unsubscribe();
    }, [user, isCompanyUser, subscribeWallet]);

    const activeMeeting = meetings.find(m =>
        ['REQUESTED', 'PROPOSED', 'PENDING_ACCEPTANCE', 'SCHEDULED', 'DISPUTE'].includes(m.status)
    );
    const hasConfirmedMeeting = meetings.some(m => m.status === 'CONFIRMED');
    const cancelledMeeting = meetings.find(m =>
        ['CANCELLED', 'DECLINED'].includes(m.status)
    );
    const hasMeetingRequest = meetings.length > 0; // Any meeting = phone visible
    const otherUserPhone = chat?.matchedUserPhone || profile?.phone || null;
    const activeProject = projects.find(p => p.status === 'PENDING_ACCEPTANCE');
    const hasAcceptedProject = projects.some(p => p.status === 'ACCEPTED');

    // Subscribe to real-time messages
    useEffect(() => {
        if (!chatId) return;
        const unsubscribe = subscribeToMessages(chatId, (newMessages) => {
            setMessages(newMessages);
        });
        return () => unsubscribe();
    }, [chatId]);

    // Auto-scroll to bottom when new messages arrive or files start uploading
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, uploadingFiles]);

    // Detect phone numbers and email addresses in text
    const containsContactInfo = (text) => {
        // Phone: 7+ consecutive digits (with optional spaces, dashes, dots, parens)
        const phonePattern = /(?:\+?\d[\d\s\-().]{6,}\d)/;
        // Email: standard email pattern
        const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
        return phonePattern.test(text) || emailPattern.test(text);
    };

    // Detect Google Maps / location URLs in text
    const containsLocationUrl = (text) => {
        const mapsPattern = /(?:maps\.google|google\.com\/maps|goo\.gl\/maps|maps\.app\.goo\.gl)/i;
        const coordPattern = /\d+\.\d+,\s*\d+\.\d+/; // lat,lng patterns
        return mapsPattern.test(text) || coordPattern.test(text);
    };

    const handleSend = async () => {
        if (!message.trim() || sending) return;

        // Contact info / location in typed messages unlocks once a meeting is
        // requested/proposed (same gate as the call + share buttons), so the parties
        // can coordinate before the meeting is formally scheduled.
        if (!hasMeetingRequest && containsContactInfo(message)) {
            showToast('\u26a0\ufe0f Sharing personal contact info (phone/email) unlocks once a meeting is requested. Request or propose a meeting first \ud83d\udcc5', 'error');
            return;
        }

        if (!hasMeetingRequest && containsLocationUrl(message)) {
            showToast('\u26a0\ufe0f Location sharing unlocks once a meeting is requested. Request or propose a meeting first \ud83d\udcc5', 'info');
            return;
        }

        setSending(true);
        const result = await sendMessage(otherUserId, message);
        if (result.success) {
            setMessage('');
        }
        setSending(false);
    };

    // Share current location as a Google Maps link
    const handleShareLocation = () => {
        setShowAttachMenu(false);
        // Location sharing unlocks as soon as a meeting is requested/proposed
        // (same gate as the call button) so both sides can coordinate before it's scheduled.
        if (!hasMeetingRequest) {
            showToast('⚠️ Location sharing unlocks once a meeting is requested. Request or propose a meeting first 📅', 'info');
            return;
        }
        // Open the map picker so the user can send their current location OR pin one
        // on the map (same picker used in the meeting flow).
        setShowLocationPicker(true);
    };

    // Called when a location is chosen/sent from the LocationPicker
    const handleLocationSelected = async (loc) => {
        setShowLocationPicker(false);
        if (!loc || loc.lat == null || loc.lng == null) return;
        const coords = `${loc.lat},${loc.lng}`;
        const mapUrl = `https://www.google.com/maps?q=${coords}`;
        const label = loc.address ? loc.address : 'My Location';
        await sendMessage(otherUserId, `📍 ${label}: ${mapUrl}`);
    };

    // Share a contact from device address book
    const [showContactModal, setShowContactModal] = useState(false);
    const [deviceContacts, setDeviceContacts] = useState([]);
    const [contactsLoading, setContactsLoading] = useState(false);
    const [contactSearch, setContactSearch] = useState('');
    const [contactsPermissionDenied, setContactsPermissionDenied] = useState(false);
    const [manualName, setManualName] = useState('');
    const [manualPhone, setManualPhone] = useState('');

    // Cross-platform contact fetching:
    // Android: window.PlyshipContacts.getContacts() — synchronous JS interface
    // iOS: window.webkit.messageHandlers.getContacts.postMessage('fetch') — async via callback
    // PWA: navigator.contacts.select() — Contact Picker API (limited, single-pick)
    const fetchDeviceContacts = async () => {
        setContactsLoading(true);
        setContactsPermissionDenied(false);

        // Detect Android WebView environment:
        // - Check for our injected bridge object (PlyshipContacts)
        // - Also check the User-Agent for the Android WebView marker 'wv'
        //   so we don't accidentally fall through to the PWA Contact Picker API
        //   which Chrome-based WebViews may also expose.
        const isAndroidWebView = !!window.PlyshipContacts
            || /; wv[);]/.test(navigator.userAgent)
            || (/Android/i.test(navigator.userAgent) && /Version\/[\d.]+/.test(navigator.userAgent));

        // Try Android native bridge first
        // NOTE: We do NOT use `typeof getContacts === 'function'` because
        // Java methods injected via addJavascriptInterface don't always
        // report as 'function' in typeof checks on all WebView versions.
        if (window.PlyshipContacts) {
            try {
                let result = window.PlyshipContacts.getContacts();
                // On the first call, if permission isn't granted yet the native side
                // shows the system permission dialog and returns PERMISSION_DENIED.
                // Poll until the user responds (granted → JSON) so contacts load
                // automatically without needing a manual Retry.
                if (result === 'PERMISSION_DENIED') {
                    for (let i = 0; i < 16; i++) {
                        await new Promise(r => setTimeout(r, 500));
                        result = window.PlyshipContacts.getContacts();
                        if (result !== 'PERMISSION_DENIED') break;
                    }
                }
                if (result === 'PERMISSION_DENIED') {
                    setContactsPermissionDenied(true);
                    setContactsLoading(false);
                    showToast('Please allow contacts access to share a contact.', 'error');
                    return [];
                }
                const contacts = JSON.parse(result);
                setDeviceContacts(contacts);
                setContactsLoading(false);
                return contacts;
            } catch (err) {
                console.log('Android contacts bridge error:', err);
                // Still on Android — don't fall through to iOS/PWA checks.
                setContactsLoading(false);
                return [];
            }
        }

        // If we detected Android WebView but the bridge object isn't available
        // (e.g. timing issue), don't fall through to PWA — return empty.
        if (isAndroidWebView) {
            console.log('Android WebView detected but PlyshipContacts bridge not found');
            setContactsLoading(false);
            return [];
        }

        // Try iOS native bridge (async via callback)
        if (window.webkit?.messageHandlers?.getContacts) {
            try {
                const contacts = await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        window.__plyship_contacts_callback = null;
                        reject(new Error('Timeout'));
                    }, 10000);

                    window.__plyship_contacts_callback = (result) => {
                        clearTimeout(timeout);
                        window.__plyship_contacts_callback = null;
                        if (result === 'PERMISSION_DENIED') {
                            reject(new Error('PERMISSION_DENIED'));
                            return;
                        }
                        try {
                            resolve(JSON.parse(result));
                        } catch (e) {
                            resolve([]);
                        }
                    };
                    window.webkit.messageHandlers.getContacts.postMessage('fetch');
                });
                setDeviceContacts(contacts);
                setContactsLoading(false);
                return contacts;
            } catch (err) {
                if (err.message === 'PERMISSION_DENIED') {
                    setContactsPermissionDenied(true);
                    setContactsLoading(false);
                    showToast('Please allow contacts access in your device settings.', 'error');
                    return [];
                }
                console.log('iOS contacts bridge error:', err);
                // Still on iOS — don't fall through to PWA.
                setContactsLoading(false);
                return [];
            }
        }

        // PWA fallback: Contact Picker API (limited: single or multi pick, but no list view)
        // Only runs on desktop/mobile browsers — NOT inside native WebViews
        if ('contacts' in navigator && 'ContactsManager' in window) {
            try {
                const rawContacts = await navigator.contacts.select(
                    ['name', 'tel'],
                    { multiple: true }
                );
                if (rawContacts && rawContacts.length > 0) {
                    const contacts = rawContacts.map(c => ({
                        name: c.name?.[0] || 'Unknown',
                        phone: c.tel?.[0] || '',
                    })).filter(c => c.name || c.phone);
                    setDeviceContacts(contacts);
                    setContactsLoading(false);
                    return contacts;
                }
            } catch (err) {
                if (err.name !== 'TypeError' && err.name !== 'InvalidStateError') {
                    console.log('Contact Picker API failed:', err.message);
                }
            }
        }

        // No native bridge available — show manual entry
        setContactsLoading(false);
        return null; // null = no native access, show manual entry
    };

    const handleShareContact = async () => {
        setShowAttachMenu(false);
        // Contact sharing unlocks as soon as a meeting is requested/proposed
        // (same gate as the call button) so both sides can coordinate before it's scheduled.
        if (!hasMeetingRequest) {
            showToast('⚠️ Contact sharing unlocks once a meeting is requested. Request or propose a meeting first 📅', 'info');
            return;
        }

        // Open the modal immediately with loading state, then fetch contacts
        setContactSearch('');
        setDeviceContacts([]);
        setContactsLoading(true);
        setShowContactModal(true);

        const contacts = await fetchDeviceContacts();

        if (contacts === null) {
            // No native access — modal already open, will show "not available" state
            setContactsLoading(false);
        } else if (contacts.length === 0 && !contactsPermissionDenied) {
            setContactsLoading(false);
        }
    };

    const handleSelectDeviceContact = async (contact) => {
        const contactMsg = `👤 ${contact.name}`;
        await sendMessage(otherUserId, contactMsg, {
            type: 'contact',
            name: contact.name || 'Contact',
            url: contact.phone || '',
        });
        showToast('Contact shared!', 'success');
        setShowContactModal(false);
    };

    // Filter contacts based on search
    const filteredContacts = deviceContacts.filter(c => {
        if (!contactSearch.trim()) return true;
        const term = contactSearch.toLowerCase();
        return (c.name || '').toLowerCase().includes(term)
            || (c.phone || '').includes(term);
    });

    // Cross-platform Maps URL opener — works on Android, iOS, and PWA
    const openMapsUrl = (coords, displayAddress) => {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isAndroid = /Android/i.test(navigator.userAgent);

        // Build platform-specific URL
        let mapUrl;
        if (isIOS) {
            // Apple Maps URL — iOS intercepts these natively and opens Apple Maps
            // (or Google Maps if user has set it as default maps app)
            mapUrl = coords
                ? `https://maps.apple.com/?q=${coords}`
                : `https://maps.apple.com/?q=${encodeURIComponent(displayAddress)}`;
        } else if (isAndroid) {
            // geo: URI — Android natively routes to Google Maps / installed maps app
            mapUrl = coords
                ? `geo:${coords}?q=${coords}`
                : `geo:0,0?q=${encodeURIComponent(displayAddress)}`;
        } else {
            // Desktop / PWA fallback — HTTPS Google Maps (opens in browser)
            mapUrl = coords
                ? `https://www.google.com/maps/search/?api=1&query=${coords}`
                : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(displayAddress)}`;
        }

        // Use an anchor click to trigger the navigation.
        // On Capacitor iOS, decidePolicyFor intercepts maps.apple.com and opens externally.
        // On Capacitor Android, shouldOverrideUrlLoading intercepts geo: and opens externally.
        const anchor = document.createElement('a');
        anchor.href = mapUrl;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.style.display = 'none';
        document.body.appendChild(anchor);

        try {
            anchor.click();
        } catch (e) {
            // Scheme not supported — fall back to HTTPS Google Maps
            const httpsUrl = coords
                ? `https://www.google.com/maps/search/?api=1&query=${coords}`
                : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(displayAddress)}`;
            window.open(httpsUrl, '_blank');
        }

        // Cleanup
        setTimeout(() => {
            try { document.body.removeChild(anchor); } catch (e) {}
        }, 300);
    };

    // Format message time
    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div data-no-pull-refresh data-no-ptr="true" style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-secondary)',
            overscrollBehavior: 'contain',
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
                paddingBottom: '12px',
                paddingLeft: '16px',
                paddingRight: '16px',
                background: 'white',
                borderBottom: '1px solid var(--border-light)',
            }}>
                <motion.button
                    onClick={onBack}
                    whileTap={{ scale: 0.9 }}
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: 'var(--bg-secondary)',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                    }}
                >
                    <ArrowLeft size={20} color="var(--text-secondary)" />
                </motion.button>

                <div
                    onClick={() => !isBroadcast && setShowProfileDetail(true)}
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: isCompany ? 12 : '50%',
                        background: image ? `url(${image}) center/cover` : 'var(--pastel-green)',
                        border: '2px solid var(--pastel-mint)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        cursor: isBroadcast ? 'default' : 'pointer',
                    }}>
                    {!image && (isCompany ? <Briefcase size={18} color="var(--primary)" /> : <User size={18} color="var(--primary)" />)}
                </div>

                <div style={{ flex: 1, cursor: isBroadcast ? 'default' : 'pointer' }} onClick={() => !isBroadcast && setShowProfileDetail(true)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                            {name || 'Unknown'}
                        </h3>
                        {isBroadcast && (
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 18,
                                height: 18,
                                borderRadius: '50%',
                                background: '#1D9BF0',
                                flexShrink: 0,
                            }}>
                                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                                    <path d="M2 6.5L4.5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </span>
                        )}
                    </div>
                    <span style={{ fontSize: 12, color: isBroadcast ? 'var(--text-muted)' : 'var(--success)' }}>{isBroadcast ? 'Official Broadcast' : 'Online'}</span>
                </div>

                {/* Phone button - always visible, but only functional after a meeting request */}
                {!isBroadcast && (
                    <motion.button
                        onClick={() => {
                            if (hasMeetingRequest && otherUserPhone) {
                                window.location.href = `tel:${otherUserPhone}`;
                            } else {
                                showToast('Schedule a meeting first to get their contact number 📅', 'info');
                            }
                        }}
                        whileTap={{ scale: 0.9 }}
                        style={{
                            width: 36, height: 36, borderRadius: '50%',
                            background: hasMeetingRequest && otherUserPhone ? '#F0FDF4' : 'var(--bg-secondary)',
                            border: hasMeetingRequest && otherUserPhone ? '1.5px solid #BBF7D0' : '1.5px solid var(--border-light)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', flexShrink: 0,
                        }}
                        title={hasMeetingRequest && otherUserPhone ? otherUserPhone : 'Schedule a meeting to call'}
                    >
                        <Phone size={15} color={hasMeetingRequest && otherUserPhone ? '#22C55E' : 'var(--text-muted)'} />
                    </motion.button>
                )}

                {/* Schedule Meeting Button - hide once meeting is confirmed and Start Project is visible */}
                {!isBroadcast && !hasConfirmedMeeting && (
                    <motion.button
                        onClick={() => setShowMeetingModal(true)}
                        whileTap={{ scale: 0.9 }}
                        style={{
                            padding: '8px 12px',
                            borderRadius: 10,
                            background: activeMeeting ? 'var(--bg-secondary)' : '#EFF6FF',
                            border: activeMeeting ? '1px solid var(--border)' : '1px solid #BFDBFE',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            cursor: activeMeeting ? 'default' : 'pointer',
                            opacity: activeMeeting ? 0.5 : 1,
                        }}
                        disabled={!!activeMeeting}
                    >
                        <Calendar size={14} color={activeMeeting ? 'var(--text-muted)' : '#3B82F6'} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: activeMeeting ? 'var(--text-muted)' : '#3B82F6' }}>
                            {activeMeeting ? 'Meeting Set' : 'Meet'}
                        </span>
                    </motion.button>
                )}

                {/* Start Project Button - only shows after meeting completion */}
                {hasConfirmedMeeting && (
                    <motion.button
                        onClick={() => setShowProjectModal(true)}
                        whileTap={{ scale: 0.9 }}
                        style={{
                            padding: '8px 12px',
                            borderRadius: 10,
                            background: 'var(--gradient-primary)',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            cursor: 'pointer',
                        }}
                    >
                        <Home size={14} color="white" />
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'white' }}>Start Project</span>
                    </motion.button>
                )}
            </div>

            {/* Meeting Banner - show if there's an active meeting but NOT if already confirmed */}
            {activeMeeting && !hasConfirmedMeeting && (() => {
                const meetingTime = activeMeeting.scheduledAt ? new Date(activeMeeting.scheduledAt) : null;
                const now = new Date();
                const isExpired = meetingTime ? meetingTime < now : false;
                const isCompanyUser = user?.role === 'COMPANY';
                const hasUserConfirmed = isCompanyUser ? activeMeeting.companyConfirmed : activeMeeting.seekerConfirmed;
                const hasUserDenied = isCompanyUser ? activeMeeting.companyDenied : activeMeeting.seekerDenied;
                const hasUserResponded = hasUserConfirmed || hasUserDenied;

                // Helper to refresh meetings
                const refreshMeetings = async () => {
                    const updated = await getMeetings();
                    setMeetings(updated.filter(m =>
                        (m.companyId === otherUserId || m.seekerId === otherUserId) && !m.rescheduledTo
                    ));
                };

                // DISPUTE = legacy dispute — show admin review banner
                if (activeMeeting.status === 'DISPUTE') {
                    return (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            style={{ padding: 12, background: '#FEF3C7', borderBottom: '2px solid #F59E0B' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <AlertCircle size={16} color="#B45309" />
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: 13, fontWeight: 600, color: '#92400E' }}>
                                        ⚠️ Dispute Raised
                                    </p>
                                    <p style={{ fontSize: 11, color: '#B45309' }}>
                                        Someone from our team will contact you shortly.
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    );
                }

                // REQUESTED status — Company sent request, seeker needs to accept & set details
                if (activeMeeting.status === 'REQUESTED') {
                    const isReceiver = activeMeeting.requestedBy !== user?.id;
                    return (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            style={{ padding: 12, background: '#F5F3FF', borderBottom: '1.5px solid #8B5CF6' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Calendar size={18} color="#7C3AED" style={{ flexShrink: 0 }} />
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: 13, fontWeight: 600, color: '#5B21B6' }}>
                                        {isReceiver ? 'Meeting request received' : 'Meeting request sent'}
                                    </p>
                                    <p style={{ fontSize: 11, color: '#7C3AED' }}>
                                        {isReceiver ? 'Set the date, time & location to accept' : 'Waiting for seeker to respond'}
                                    </p>
                                </div>
                                {isReceiver ? (
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <motion.button
                                            onClick={() => setShowAcceptScheduleModal(true)}
                                            whileTap={{ scale: 0.95 }}
                                            style={{
                                                padding: '6px 12px', borderRadius: 8, background: '#7C3AED',
                                                border: 'none', color: 'white', fontSize: 12, fontWeight: 600,
                                                display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                                            }}
                                        >
                                            <Calendar size={14} />
                                            Accept
                                        </motion.button>
                                        <motion.button
                                            onClick={async () => {
                                                setActionLoading('decline');
                                                await declineMeeting(activeMeeting.id);
                                                const updated = await getMeetings();
                                                setMeetings(updated.filter(m =>
                                                    (m.companyId === otherUserId || m.seekerId === otherUserId) && !m.rescheduledTo
                                                ));
                                                setActionLoading(null);
                                            }}
                                            disabled={actionLoading}
                                            whileTap={{ scale: 0.95 }}
                                            style={{
                                                padding: '6px 12px', borderRadius: 8, background: '#FEE2E2',
                                                border: 'none', color: '#EF4444', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                            }}
                                        >
                                            <X size={14} />
                                        </motion.button>
                                    </div>
                                ) : (
                                    <motion.button
                                        onClick={async () => {
                                            setActionLoading('cancel');
                                            await cancelMeeting(activeMeeting.id);
                                            const updated = await getMeetings();
                                            setMeetings(updated.filter(m =>
                                                (m.companyId === otherUserId || m.seekerId === otherUserId) && !m.rescheduledTo
                                            ));
                                            setActionLoading(null);
                                        }}
                                        disabled={actionLoading}
                                        whileTap={{ scale: 0.95 }}
                                        style={{
                                            padding: '6px 12px', borderRadius: 8, background: '#FEE2E2',
                                            border: 'none', color: '#EF4444', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                        }}
                                    >
                                        Cancel
                                    </motion.button>
                                )}
                            </div>
                        </motion.div>
                    );
                }
                // PENDING_ACCEPTANCE + EXPIRED = Show expired message with reschedule
                // But first handle PROPOSED status — negotiation in progress
                if (activeMeeting.status === 'PROPOSED') {
                    const iProposed = activeMeeting.proposedBy === user?.id;
                    const proposedDate = activeMeeting.scheduledAt
                        ? new Date(activeMeeting.scheduledAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                        : null;
                    const proposedLocation = activeMeeting.location ? activeMeeting.location.split('||')[0] : null;
                    const proposedCoords = activeMeeting.location && activeMeeting.location.includes('||')
                        ? activeMeeting.location.split('||')[1] : null;
                    const locationMapUrl = proposedCoords
                        ? `https://www.google.com/maps?q=${proposedCoords}`
                        : proposedLocation
                            ? `https://www.google.com/maps/search/${encodeURIComponent(proposedLocation)}`
                            : null;
                    const proposerName = iProposed ? 'You' : (isCompanyUser ? (activeMeeting.seekerName || 'Seeker') : (activeMeeting.companyName || 'Company'));

                    return (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            style={{ padding: 12, background: '#FFFBEB', borderBottom: '1.5px solid #F59E0B' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                <Calendar size={18} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: 13, fontWeight: 600, color: '#92400E' }}>
                                        {iProposed ? 'Proposal sent' : `${proposerName} proposed a meeting`}
                                    </p>
                                    {proposedDate && (
                                        <p style={{ fontSize: 12, color: '#B45309', marginTop: 2 }}>
                                            📅 {proposedDate}
                                        </p>
                                    )}
                                    {/* Clickable Location Button */}
                                    {locationMapUrl && (
                                        <button
                                            type="button"
                                            onClick={() => openMapPreview(proposedCoords, proposedLocation)}
                                            style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                                marginTop: 4, padding: '3px 10px', borderRadius: 20,
                                                background: '#DCFCE7', border: '1px solid #86EFAC',
                                                color: '#166534', fontSize: 12, fontWeight: 600,
                                                textDecoration: 'none', cursor: 'pointer',
                                                transition: 'all 0.15s',
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.background = '#BBF7D0'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = '#DCFCE7'; }}
                                        >
                                            <MapPin size={13} />
                                            LOCATION
                                        </button>
                                    )}
                                    <p style={{ fontSize: 11, color: '#D97706', marginTop: 4 }}>
                                        {iProposed
                                            ? 'Waiting for the other party to accept or suggest changes'
                                            : 'Accept or suggest different details'}
                                        {activeMeeting.proposalCount > 1 && ` (Round ${activeMeeting.proposalCount})`}
                                    </p>
                                </div>
                                {!iProposed ? (
                                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                        <motion.button
                                            onClick={async () => {
                                                setActionLoading('acceptProposal');
                                                const result = await acceptProposedMeeting(activeMeeting.id);
                                                if (result.success) {
                                                    showToast('Meeting confirmed! 🎉', 'success');
                                                } else {
                                                    showToast(result.error, 'error');
                                                }
                                                setActionLoading(null);
                                            }}
                                            disabled={actionLoading}
                                            whileTap={{ scale: 0.95 }}
                                            style={{
                                                padding: '6px 12px', borderRadius: 8, background: '#22C55E',
                                                border: 'none', color: 'white', fontSize: 12, fontWeight: 600,
                                                display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                                            }}
                                        >
                                            <Check size={14} />
                                            Accept
                                        </motion.button>
                                        <motion.button
                                            onClick={() => setShowCounterProposeModal(true)}
                                            whileTap={{ scale: 0.95 }}
                                            style={{
                                                padding: '6px 12px', borderRadius: 8, background: '#FFFBEB',
                                                border: '1px solid #F59E0B', color: '#B45309', fontSize: 12, fontWeight: 600,
                                                display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                                            }}
                                        >
                                            <RefreshCw size={14} />
                                        </motion.button>
                                        <motion.button
                                            onClick={async () => {
                                                setActionLoading('decline');
                                                await declineMeeting(activeMeeting.id);
                                                setActionLoading(null);
                                            }}
                                            disabled={actionLoading}
                                            whileTap={{ scale: 0.95 }}
                                            style={{
                                                padding: '6px 8px', borderRadius: 8, background: '#FEE2E2',
                                                border: 'none', color: '#EF4444', fontSize: 12, cursor: 'pointer',
                                            }}
                                        >
                                            <X size={14} />
                                        </motion.button>
                                    </div>
                                ) : (
                                    <motion.button
                                        onClick={async () => {
                                            setActionLoading('cancel');
                                            await cancelMeeting(activeMeeting.id);
                                            setActionLoading(null);
                                        }}
                                        disabled={actionLoading}
                                        whileTap={{ scale: 0.95 }}
                                        style={{
                                            padding: '6px 12px', borderRadius: 8, background: '#FEE2E2',
                                            border: 'none', color: '#EF4444', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                        }}
                                    >
                                        Cancel
                                    </motion.button>
                                )}
                            </div>
                        </motion.div>
                    );
                }

                // PENDING_ACCEPTANCE + EXPIRED = Show expired message with reschedule
                if (activeMeeting.status === 'PENDING_ACCEPTANCE' && isExpired) {
                    return (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            style={{ padding: 12, background: '#FEE2E2', borderBottom: '1px solid var(--border-light)' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <AlertCircle size={16} color="#DC2626" />
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: 13, fontWeight: 600, color: '#DC2626' }}>Meeting Request Expired</p>
                                    <p style={{ fontSize: 11, color: '#B91C1C' }}>
                                        The scheduled time has passed. Please reschedule.
                                    </p>
                                </div>
                                <motion.button
                                    onClick={() => setShowRescheduleModal(true)}
                                    whileTap={{ scale: 0.95 }}
                                    style={{
                                        padding: '6px 12px', borderRadius: 8, background: '#3B82F6',
                                        border: 'none', color: 'white', fontSize: 12, fontWeight: 600,
                                        display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                                    }}
                                >
                                    <RefreshCw size={14} />
                                    Reschedule
                                </motion.button>
                            </div>
                        </motion.div>
                    );
                }

                // PENDING_ACCEPTANCE + NOT EXPIRED = Show accept/decline (or low balance warning for companies)
                if (activeMeeting.status === 'PENDING_ACCEPTANCE' && !isExpired) {
                    const isReceiver = activeMeeting.requestedBy !== user?.id;
                    const hasLowBalance = isCompanyUser && walletBalance !== null && walletBalance < MEETING_FEE;

                    // Parse location for the 📍 button
                    const locParts = activeMeeting.location ? activeMeeting.location.split('||') : [];
                    const locDisplay = locParts[0] || null;
                    const locCoords = locParts[1] || null;
                    const hasLocation = !!(locDisplay || locCoords);

                    // Show low balance warning for company receiving a meeting request
                    if (isReceiver && hasLowBalance) {
                        // Inline pay-and-accept handler (like Uber pay-per-ride)
                        const handlePayAndAccept = async () => {
                            setActionLoading('payAccept');
                            try {
                                // 1. Create Razorpay order for meeting fee
                                const orderRes = await fetch('/api/razorpay/create-order', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ amount: MEETING_FEE, userId: user.id }),
                                });
                                const orderData = await orderRes.json();
                                if (!orderData.success) throw new Error(orderData.error || 'Failed to create order');

                                // Persist for cross-restart recovery
                                try {
                                    localStorage.setItem(`plyship_pending_order_${user.id}`, JSON.stringify({
                                        orderId: orderData.orderId,
                                        amount: MEETING_FEE,
                                        createdAt: Date.now(),
                                    }));
                                } catch (e) { /* localStorage may be unavailable */ }

                                // 2. Open Razorpay checkout (UPI-first, in-app)
                                const options = buildRazorpayOptions({
                                    key: orderData.keyId,
                                    amount: orderData.amount,
                                    currency: orderData.currency,
                                    orderId: orderData.orderId,
                                    description: `Meeting Fee — ${name || 'Consultation'}`,
                                    prefill: {
                                        name: user?.profile?.companyName || user?.profile?.name || '',
                                        email: user?.email || '',
                                    },
                                    handler: async function (response) {
                                        try {
                                            // 3. Verify payment
                                            const verifyRes = await fetch('/api/razorpay/verify-payment', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    razorpay_order_id: response.razorpay_order_id,
                                                    razorpay_payment_id: response.razorpay_payment_id,
                                                    razorpay_signature: response.razorpay_signature,
                                                    userId: user.id,
                                                    amount: MEETING_FEE,
                                                }),
                                            });
                                            const verifyData = await verifyRes.json();
                                            if (!verifyData.success) {
                                                showToast('Payment verification failed', 'error');
                                                setActionLoading(null);
                                                return;
                                            }

                                            // 4. Credit wallet
                                            const topUpResult = await topUpWallet(MEETING_FEE, response.razorpay_payment_id, response.razorpay_order_id);
                                            // Clear pending order from localStorage
                                            try { localStorage.removeItem(`plyship_pending_order_${user.id}`); } catch (e) {}
                                            if (!topUpResult.success) {
                                                showToast('Payment succeeded but wallet update failed. Contact support.', 'error');
                                                setActionLoading(null);
                                                return;
                                            }

                                            // 5. Update local wallet balance
                                            setWalletBalance(topUpResult.newBalance);

                                            // 6. Auto-accept the meeting
                                            const acceptResult = await acceptMeeting(activeMeeting.id);
                                            if (acceptResult.success) {
                                                showToast('Payment successful! Meeting accepted.', 'success');
                                                await refreshMeetings();
                                            } else {
                                                showToast(acceptResult.error || 'Meeting could not be accepted. Try again from the banner.', 'error');
                                            }
                                        } catch (err) {
                                            showToast(err.message || 'Something went wrong', 'error');
                                        }
                                        setActionLoading(null);
                                    },
                                    onDismiss: function () {
                                        setActionLoading(null);
                                    },
                                });

                                openRazorpayCheckout(options);
                            } catch (err) {
                                showToast(err.message || 'Payment failed', 'error');
                                setActionLoading(null);
                            }
                        };

                        return (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                style={{ padding: 12, background: '#FEF3C7', borderBottom: '1px solid var(--border-light)' }}
                            >
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                    <Calendar size={18} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontSize: 13, fontWeight: 600, color: '#92400E' }}>
                                            Meeting request received
                                        </p>
                                        <p style={{ fontSize: 11, color: '#D97706', marginBottom: 8 }}>
                                            {meetingTime.toLocaleDateString('en-IN', {
                                                weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </p>
                                        {/* 📍 Location Button */}
                                        {hasLocation && (
                                            <button
                                                type="button"
                                                onClick={() => openMapPreview(locCoords, locDisplay)}
                                                style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                                    marginTop: 4, marginBottom: 6, padding: '3px 10px', borderRadius: 20,
                                                    background: '#DCFCE7', border: '1px solid #86EFAC',
                                                    color: '#166534', fontSize: 12, fontWeight: 600,
                                                    textDecoration: 'none', cursor: 'pointer',
                                                    transition: 'all 0.15s',
                                                }}
                                                onMouseEnter={(e) => { e.currentTarget.style.background = '#BBF7D0'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.background = '#DCFCE7'; }}
                                            >
                                                <MapPin size={13} />
                                                LOCATION
                                            </button>
                                        )}

                                        {/* Pay & Accept — primary action */}
                                        <motion.button
                                            onClick={handlePayAndAccept}
                                            disabled={actionLoading}
                                            whileTap={{ scale: 0.95 }}
                                            style={{
                                                width: '100%',
                                                padding: '10px 14px',
                                                borderRadius: 10,
                                                background: actionLoading === 'payAccept' ? '#A7F3D0' : 'var(--gradient-primary)',
                                                border: 'none',
                                                color: 'white',
                                                fontSize: 13,
                                                fontWeight: 600,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 6,
                                                cursor: actionLoading ? 'wait' : 'pointer',
                                                boxShadow: 'var(--shadow-sm)',
                                                marginBottom: 6,
                                            }}
                                        >
                                            <CreditCard size={16} />
                                            {actionLoading === 'payAccept' ? 'Processing...' : `Pay ₹${MEETING_FEE} & Accept`}
                                        </motion.button>

                                        {/* Secondary row: Top Up Wallet + Decline */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <motion.button
                                                onClick={() => onNavigate?.('wallet')}
                                                whileTap={{ scale: 0.95 }}
                                                style={{
                                                    flex: 1,
                                                    padding: '8px 10px',
                                                    borderRadius: 8,
                                                    background: 'white',
                                                    border: '1px solid var(--border)',
                                                    color: 'var(--text-secondary)',
                                                    fontSize: 12,
                                                    fontWeight: 600,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: 4,
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                <Wallet size={14} />
                                                Top Up Wallet
                                            </motion.button>
                                            <motion.button
                                                onClick={async () => {
                                                    setActionLoading('decline');
                                                    await declineMeeting(activeMeeting.id);
                                                    await refreshMeetings();
                                                    setActionLoading(null);
                                                }}
                                                disabled={actionLoading}
                                                whileTap={{ scale: 0.95 }}
                                                style={{
                                                    padding: '8px 10px',
                                                    borderRadius: 8,
                                                    background: '#FEE2E2',
                                                    border: 'none',
                                                    color: '#EF4444',
                                                    fontSize: 12,
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                <X size={14} />
                                            </motion.button>
                                        </div>

                                        <p style={{ fontSize: 10, color: '#B45309', marginTop: 6, textAlign: 'center' }}>
                                            Pay for this meeting only, or top up wallet for multiple
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    }

                    // Normal accept/decline banner
                    return (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            style={{ padding: 12, background: '#EFF6FF', borderBottom: '1px solid var(--border-light)' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Clock size={16} color="#3B82F6" />
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: 13, fontWeight: 600, color: '#1E40AF' }}>
                                        {activeMeeting.requestedBy === user?.id ? 'Meeting request sent' : 'Meeting request received'}
                                    </p>
                                    <p style={{ fontSize: 11, color: '#3B82F6' }}>
                                        {meetingTime.toLocaleDateString('en-IN', {
                                            weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                        })}
                                    </p>
                                    {/* 📍 Location Button */}
                                    {hasLocation && (
                                        <button
                                            type="button"
                                            onClick={() => openMapPreview(locCoords, locDisplay)}
                                            style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                                marginTop: 4, padding: '3px 10px', borderRadius: 20,
                                                background: '#DBEAFE', border: '1px solid #93C5FD',
                                                color: '#1E40AF', fontSize: 12, fontWeight: 600,
                                                textDecoration: 'none', cursor: 'pointer',
                                                transition: 'all 0.15s',
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.background = '#BFDBFE'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = '#DBEAFE'; }}
                                        >
                                            <MapPin size={13} />
                                            LOCATION
                                        </button>
                                    )}
                                </div>
                                    {isReceiver && (
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <motion.button
                                            onClick={async () => {
                                                setActionLoading('accept');
                                                const result = await acceptMeeting(activeMeeting.id);
                                                if (result.success) {
                                                    await refreshMeetings();
                                                } else if (result.expired) {
                                                    showToast('This meeting has expired. Please reschedule.', 'warning');
                                                    await refreshMeetings();
                                                } else if (result.error) {
                                                    showToast(result.error, 'error');
                                                }
                                                setActionLoading(null);
                                            }}
                                            disabled={actionLoading}
                                            whileTap={{ scale: 0.95 }}
                                            style={{
                                                padding: '6px 12px', borderRadius: 8, background: '#22C55E',
                                                border: 'none', color: 'white', fontSize: 12, fontWeight: 600,
                                                display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                                            }}
                                        >
                                            <Check size={14} />
                                            Accept
                                        </motion.button>
                                        {isCompanyUser && (
                                            <motion.button
                                                onClick={async () => {
                                                    const reason = await showConfirm(
                                                        'Request the seeker to pick a different date, time or location?',
                                                        'Request Reschedule'
                                                    );
                                                    if (!reason) return;
                                                    setActionLoading('reschedule');
                                                    const result = await requestRescheduleMeeting(activeMeeting.id);
                                                    if (result.success) {
                                                        showToast('Reschedule requested! The seeker will pick new details.', 'success');
                                                        await refreshMeetings();
                                                    } else {
                                                        showToast(result.error || 'Could not request reschedule', 'error');
                                                    }
                                                    setActionLoading(null);
                                                }}
                                                disabled={actionLoading}
                                                whileTap={{ scale: 0.95 }}
                                                style={{
                                                    padding: '6px 12px', borderRadius: 8, background: '#EFF6FF',
                                                    border: '1px solid #3B82F6', color: '#3B82F6', fontSize: 12, fontWeight: 600,
                                                    display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                                                }}
                                            >
                                                <RefreshCw size={14} />
                                            </motion.button>
                                        )}
                                        <motion.button
                                            onClick={async () => {
                                                setActionLoading('decline');
                                                await declineMeeting(activeMeeting.id);
                                                await refreshMeetings();
                                                setActionLoading(null);
                                            }}
                                            disabled={actionLoading}
                                            whileTap={{ scale: 0.95 }}
                                            style={{
                                                padding: '6px 12px', borderRadius: 8, background: '#FEE2E2',
                                                border: 'none', color: '#EF4444', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                            }}
                                        >
                                            <X size={14} />
                                        </motion.button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    );
                }

                // SCHEDULED = OTP Confirmation (available anytime)
                if (activeMeeting.status === 'SCHEDULED') {
                    // SEEKER sees the OTP code (to share with company)
                    if (!isCompanyUser) {
                        return (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                style={{ padding: 16, background: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)', borderBottom: '2px solid #22C55E' }}
                            >
                                <div style={{ textAlign: 'center' }}>
                                    <p style={{ fontSize: 13, fontWeight: 600, color: '#166534', marginBottom: 4 }}>
                                        📋 Meeting Verification Code
                                    </p>
                                    <div style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                        padding: '4px 10px', borderRadius: 6,
                                        background: '#FEF2F2', border: '1px solid #FECACA',
                                        marginBottom: 10,
                                    }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: '#DC2626' }}>
                                            ⚠️ Share ONLY after the meeting is done
                                        </span>
                                    </div>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'center',
                                        gap: 6,
                                        marginBottom: 8,
                                    }}>
                                        {String(activeMeeting.meetingOTP || '------').split('').map((digit, i) => (
                                            <div key={i} style={{
                                                width: 38,
                                                height: 46,
                                                borderRadius: 10,
                                                background: 'white',
                                                border: '2px solid #22C55E',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: 22,
                                                fontWeight: 800,
                                                color: '#166534',
                                                fontFamily: 'monospace',
                                                boxShadow: '0 2px 8px rgba(34,197,94,0.15)',
                                            }}>
                                                {digit}
                                            </div>
                                        ))}
                                    </div>
                                    <p style={{ fontSize: 10, color: '#16A34A' }}>
                                        {meetingTime.toLocaleDateString('en-IN', {
                                            weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                        })}
                                    </p>
                                    {/* 📍 Meeting Location Button */}
                                    {activeMeeting.location && (() => {
                                        const parts = activeMeeting.location.split('||');
                                        const displayAddr = parts[0] || activeMeeting.location;
                                        const coords = parts[1];
                                        return (
                                            <motion.button
                                                onClick={() => openMapPreview(coords, displayAddr)}
                                                whileTap={{ scale: 0.95 }}
                                                style={{
                                                    marginTop: 8,
                                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                                    padding: '6px 14px', borderRadius: 8,
                                                    background: 'white', border: '1.5px solid #BBF7D0',
                                                    cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#16A34A',
                                                }}
                                            >
                                                <MapPin size={14} color="#22C55E" />
                                                📍 Open Meeting Location
                                            </motion.button>
                                        );
                                    })()}
                                </div>
                            </motion.div>
                        );
                    }

                    // COMPANY sees OTP input
                    return (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            style={{ padding: 16, background: '#FFF7ED', borderBottom: '2px solid #F59E0B' }}
                        >
                            <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: 13, fontWeight: 600, color: '#92400E', marginBottom: 4 }}>
                                    🔑 Enter Meeting Code
                                </p>
                                <p style={{ fontSize: 11, color: '#B45309', marginBottom: 12 }}>
                                    Ask the seeker for the 6-digit verification code
                                </p>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 12 }}>
                                    {[0, 1, 2, 3, 4, 5].map(i => (
                                        <input
                                            key={i}
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={1}
                                            value={otpInput[i] || ''}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/\D/g, '');
                                                if (val.length <= 1) {
                                                    const newOtp = otpInput.split('');
                                                    newOtp[i] = val;
                                                    setOtpInput(newOtp.join(''));
                                                    // Auto-focus next input
                                                    if (val && i < 5) {
                                                        const next = e.target.parentNode.children[i + 1];
                                                        if (next) next.focus();
                                                    }
                                                }
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Backspace' && !otpInput[i] && i > 0) {
                                                    const prev = e.target.parentNode.children[i - 1];
                                                    if (prev) prev.focus();
                                                }
                                            }}
                                            style={{
                                                width: 38,
                                                height: 46,
                                                borderRadius: 10,
                                                border: `2px solid ${otpInput[i] ? '#F59E0B' : '#E5E7EB'}`,
                                                background: 'white',
                                                textAlign: 'center',
                                                fontSize: 22,
                                                fontWeight: 800,
                                                color: '#92400E',
                                                fontFamily: 'monospace',
                                                outline: 'none',
                                                padding: 0,
                                                transition: 'border-color 0.2s',
                                            }}
                                            onFocus={(e) => e.target.style.borderColor = '#F59E0B'}
                                            onBlur={(e) => { if (!otpInput[i]) e.target.style.borderColor = '#E5E7EB'; }}
                                        />
                                    ))}
                                </div>
                                <motion.button
                                    onClick={async () => {
                                        if (otpInput.length !== 6) {
                                            showToast('Please enter all 6 digits', 'warning');
                                            return;
                                        }
                                        setActionLoading('otp');
                                        const result = await verifyMeetingOTP(activeMeeting.id, otpInput);
                                        setActionLoading(null);
                                        if (result.success && result.bothConfirmed) {
                                            setOtpInput('');
                                            showToast('Meeting confirmed! Payment transferred.', 'success');
                                        } else if (result.wrongOTP) {
                                            showToast('Incorrect code. Please check with the seeker.', 'error');
                                        } else if (result.insufficientBalance) {
                                            showToast('Insufficient service deposit balance.', 'warning');
                                        } else if (result.error) {
                                            showToast(result.error, 'error');
                                        }
                                        refreshMeetings();
                                    }}
                                    disabled={actionLoading || otpInput.length !== 6}
                                    whileTap={{ scale: 0.95 }}
                                    style={{
                                        width: '100%',
                                        padding: '10px 14px',
                                        borderRadius: 10,
                                        background: otpInput.length === 6 ? 'var(--gradient-primary)' : '#E5E7EB',
                                        border: 'none',
                                        color: otpInput.length === 6 ? 'white' : '#9CA3AF',
                                        fontSize: 13,
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 6,
                                        cursor: otpInput.length === 6 ? 'pointer' : 'not-allowed',
                                    }}
                                >
                                    <Check size={16} />
                                    {actionLoading === 'otp' ? 'Verifying...' : 'Verify Code'}
                                </motion.button>
                                <p style={{ fontSize: 10, color: '#D97706', marginTop: 6 }}>
                                    {meetingTime.toLocaleDateString('en-IN', {
                                        weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                    })}
                                </p>
                                {/* 📍 Meeting Location Button */}
                                {activeMeeting.location && (() => {
                                    const parts = activeMeeting.location.split('||');
                                    const displayAddr = parts[0] || activeMeeting.location;
                                    const coords = parts[1];
                                    return (
                                        <motion.button
                                            onClick={() => openMapPreview(coords, displayAddr)}
                                            whileTap={{ scale: 0.95 }}
                                            style={{
                                                marginTop: 8,
                                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                                padding: '6px 14px', borderRadius: 8,
                                                background: 'white', border: '1.5px solid #FDE68A',
                                                cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#92400E',
                                            }}
                                        >
                                            <MapPin size={14} color="#F59E0B" />
                                            📍 Open Meeting Location
                                        </motion.button>
                                    );
                                })()}
                            </div>
                        </motion.div>
                    );
                }


                return null;
            })()}

            {/* Cancelled Meeting Banner - show if no active meeting but there's a cancelled one */}
            {!activeMeeting && cancelledMeeting && !hasConfirmedMeeting && (() => {
                const meetingTime = new Date(cancelledMeeting.scheduledAt);
                const cancelledBy = cancelledMeeting.cancelledBy;
                const wasCancelledByMe = cancelledBy === user?.id;
                const statusText = cancelledMeeting.status === 'DECLINED' ? 'Declined' : 'Cancelled';

                return (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        style={{ padding: 12, background: '#FEE2E2', borderBottom: '1px solid var(--border-light)' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <X size={16} color="#DC2626" />
                            <div style={{ flex: 1 }}>
                                <p style={{ fontSize: 13, fontWeight: 600, color: '#DC2626' }}>
                                    Meeting {statusText}
                                </p>
                                <p style={{ fontSize: 11, color: '#B91C1C' }}>
                                    {wasCancelledByMe
                                        ? 'You cancelled • '
                                        : cancelledMeeting.status === 'DECLINED'
                                            ? 'Request declined • '
                                            : 'They cancelled • '
                                    }
                                    {meetingTime.toLocaleDateString('en-IN', {
                                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                    })}
                                </p>
                            </div>
                            <motion.button
                                onClick={() => setShowMeetingModal(true)}
                                whileTap={{ scale: 0.95 }}
                                style={{
                                    padding: '8px 14px', borderRadius: 10, background: 'var(--gradient-primary)',
                                    border: 'none', color: 'white', fontSize: 12, fontWeight: 600,
                                    display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                                    boxShadow: 'var(--shadow-sm)',
                                }}
                            >
                                <RefreshCw size={14} />
                                Reschedule
                            </motion.button>
                        </div>
                    </motion.div>
                );
            })()}

            {/* Project Request Banner - show if there's a pending project */}
            {activeProject && !hasAcceptedProject && (() => {
                const isRequester = activeProject.requestedBy === user?.id;

                // Helper to refresh projects
                const refreshProjects = async () => {
                    const updated = await getProjects();
                    setProjects(updated.filter(p =>
                        (p.companyId === otherUserId || p.seekerId === otherUserId)
                    ));
                };

                return (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        style={{ padding: 12, background: '#E0F2FE', borderBottom: '1px solid var(--border-light)' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Home size={16} color="#0284C7" />
                            <div style={{ flex: 1 }}>
                                <p style={{ fontSize: 13, fontWeight: 600, color: '#0369A1' }}>
                                    {isRequester ? 'Project request sent' : 'Project request received'}
                                </p>
                                <p style={{ fontSize: 11, color: '#0284C7' }}>
                                    {activeProject.budgetRange || 'Budget not specified'}
                                </p>
                            </div>
                            {!isRequester && (
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <motion.button
                                        onClick={async () => {
                                            setActionLoading('acceptProject');
                                            const result = await acceptProject(activeProject.id);
                                            if (result.success) {
                                                showToast('Project accepted! Wallet unlocked for withdrawals.', 'success');
                                                await refreshProjects();
                                            } else {
                                                showToast(result.error, 'error');
                                            }
                                            setActionLoading(null);
                                        }}
                                        disabled={actionLoading}
                                        whileTap={{ scale: 0.95 }}
                                        style={{
                                            padding: '6px 12px', borderRadius: 8, background: '#22C55E',
                                            border: 'none', color: 'white', fontSize: 12, fontWeight: 600,
                                            display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                                        }}
                                    >
                                        <Check size={14} />
                                        Accept
                                    </motion.button>
                                    <motion.button
                                        onClick={async () => {
                                            setActionLoading('declineProject');
                                            const result = await declineProject(activeProject.id);
                                            if (result.success) {
                                                await refreshProjects();
                                            } else {
                                                showToast(result.error, 'error');
                                            }
                                            setActionLoading(null);
                                        }}
                                        disabled={actionLoading}
                                        whileTap={{ scale: 0.95 }}
                                        style={{
                                            padding: '6px 12px', borderRadius: 8, background: '#FEE2E2',
                                            border: 'none', color: '#EF4444', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                        }}
                                    >
                                        <X size={14} />
                                    </motion.button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                );
            })()}

            {/* Messages */}
            <div style={{
                flex: 1,
                overflow: 'auto',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
            }}>
                {messages.length === 0 ? (
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                    }}>
                        <MessageCircle size={48} style={{ marginBottom: 12, opacity: 0.5 }} />
                        <p>No messages yet</p>
                        <p style={{ fontSize: 13 }}>Say hello to start the conversation!</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMe = msg.senderId === user?.id;
                        return (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                style={{
                                    alignSelf: isMe ? 'flex-end' : 'flex-start',
                                    maxWidth: '80%',
                                }}
                            >
                                <div style={{
                                    padding: msg.fileType === 'image' ? '4px' : '12px 16px',
                                    borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                    background: isMe ? 'var(--gradient-primary)' : 'white',
                                    color: isMe ? 'white' : 'var(--text-primary)',
                                    boxShadow: 'var(--shadow-sm)',
                                    overflow: 'hidden',
                                }}>
                                    {/* Voice note – WhatsApp-style amplified player */}
                                    {msg.fileType === 'voice' && msg.fileUrl && (
                                        <VoiceNotePlayer
                                            src={msg.fileUrl}
                                            duration={msg.fileDuration}
                                            isMe={isMe}
                                            formatDuration={formatDuration}
                                            senderAvatar={isMe ? (user?.avatar || user?.profileImage) : image}
                                        />
                                    )}
                                    {/* Image — opens in fullscreen preview overlay */}
                                    {msg.fileType === 'image' && msg.fileUrl && (
                                        <div
                                            onClick={() => setFilePreview({ url: msg.fileUrl, type: 'image', name: msg.fileName || 'Photo' })}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <img src={msg.fileUrl} alt="Shared image"
                                                style={{
                                                    maxWidth: '100%', maxHeight: 280,
                                                    borderRadius: 14, display: 'block',
                                                    objectFit: 'cover',
                                                }}
                                            />
                                        </div>
                                    )}
                                    {/* PDF / Document — opens in fullscreen preview overlay */}
                                    {(msg.fileType === 'pdf' || msg.fileType === 'document') && msg.fileUrl && (
                                        <div
                                            onClick={() => setFilePreview({ url: msg.fileUrl, type: msg.fileType, name: msg.fileName || (msg.fileType === 'pdf' ? 'PDF Document' : 'Document') })}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 10,
                                                textDecoration: 'none', color: 'inherit',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <div style={{
                                                width: 40, height: 40, borderRadius: 10,
                                                background: isMe ? 'rgba(255,255,255,0.2)' : '#F0FDF4',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                flexShrink: 0,
                                            }}>
                                                <FileText size={20} color={isMe ? 'white' : '#22C55E'} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{
                                                    fontSize: 13, fontWeight: 600,
                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                }}>
                                                    {msg.fileName || (msg.fileType === 'pdf' ? 'PDF Document' : 'Document')}
                                                </p>
                                                <p style={{ fontSize: 11, opacity: 0.7 }}>
                                                    {msg.fileType === 'pdf' ? 'PDF' : 'DOC'} • Tap to view
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                    {/* Contact Card — WhatsApp-style rich contact sharing */}
                                    {msg.fileType === 'contact' && (
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: 12,
                                            padding: msg.text ? 0 : undefined,
                                        }}>
                                            <div style={{
                                                width: 44, height: 44, borderRadius: '50%',
                                                background: isMe ? 'rgba(255,255,255,0.2)' : 'linear-gradient(135deg, #E8F5E9, #C8E6C9)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                flexShrink: 0,
                                            }}>
                                                <UserCircle size={24} color={isMe ? 'white' : '#22C55E'} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{
                                                    fontSize: 14, fontWeight: 700,
                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                }}>
                                                    {msg.fileName || 'Contact'}
                                                </p>
                                                {msg.fileUrl && (
                                                    <p style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
                                                        📞 {msg.fileUrl}
                                                    </p>
                                                )}
                                            </div>
                                            {msg.fileUrl && (
                                                <a href={`tel:${msg.fileUrl}`}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        window.location.href = `tel:${msg.fileUrl}`;
                                                    }}
                                                    style={{
                                                        width: 36, height: 36, borderRadius: '50%',
                                                        background: isMe ? 'rgba(255,255,255,0.2)' : '#E8F5E9',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        flexShrink: 0, textDecoration: 'none',
                                                    }}
                                                >
                                                    <Phone size={16} color={isMe ? 'white' : '#22C55E'} />
                                                </a>
                                            )}
                                        </div>
                                    )}
                                    {/* Text message — with clickable location card for Google Maps links */}
                                    {msg.text && !msg.fileType && (() => {
                                        // Detect any Google Maps URL in the text (direct shares + meeting proposals)
                                        const mapsUrlMatch = msg.text.match(/https?:\/\/(www\.)?google\.com\/(maps\?q=[-\d.,]+|maps\/search\/[^\s)]+)/);
                                        if (mapsUrlMatch) {
                                            const mapsUrl = mapsUrlMatch[0];
                                            // Extract the text surrounding the URL
                                            // Remove the URL (and optional parentheses around it) from the display text
                                            let label = msg.text
                                                .replace(`(${mapsUrl})`, '')   // "(https://...)" 
                                                .replace(mapsUrl, '')           // bare "https://..."
                                                .replace(/📍\s*/, '')
                                                .replace(/,\s*$/, '')           // trailing comma
                                                .replace(/^\s*,\s*/, '')        // leading comma
                                                .replace(/:\s*$/, '')
                                                .trim();
                                            
                                            // For meeting proposal messages, keep the context text
                                            const isMeetingMsg = msg.senderId === 'system' || msg.type === 'meeting_update';
                                            
                                            return (
                                                <div>
                                                    {/* Show the message text without the URL */}
                                                    {label && (
                                                        <p style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 8 }}>
                                                            {label}
                                                        </p>
                                                    )}
                                                    {/* Clickable Google Maps card */}
                                                    <a
                                                        href={mapsUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            // Use the cross-platform openMapsUrl if available
                                                            const coordMatch = mapsUrl.match(/q=([-\d.]+),([-\d.]+)/);
                                                            if (coordMatch) {
                                                                openMapPreview(`${coordMatch[1]},${coordMatch[2]}`, label);
                                                            } else {
                                                                // Search-based URL — extract search query
                                                                const searchMatch = mapsUrl.match(/search\/(.+?)$/);
                                                                const searchTerm = searchMatch ? decodeURIComponent(searchMatch[1]) : label;
                                                                openMapPreview(null, searchTerm || label);
                                                            }
                                                        }}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: 10,
                                                            textDecoration: 'none', color: 'inherit',
                                                            cursor: 'pointer',
                                                            padding: '8px 12px',
                                                            borderRadius: 12,
                                                            background: isMe ? 'rgba(255,255,255,0.12)' : '#F0FDF4',
                                                            border: isMe ? '1px solid rgba(255,255,255,0.2)' : '1px solid #BBF7D0',
                                                        }}
                                                    >
                                                        <div style={{
                                                            width: 40, height: 40, borderRadius: '50%',
                                                            background: isMe ? 'rgba(255,255,255,0.2)' : 'linear-gradient(135deg, #E8F5E9, #C8E6C9)',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            flexShrink: 0,
                                                        }}>
                                                            <MapPin size={20} color={isMe ? 'white' : '#22C55E'} />
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <p style={{
                                                                fontSize: 13, fontWeight: 600, lineHeight: 1.3,
                                                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                            }}>
                                                                📍 Open in Google Maps
                                                            </p>
                                                            <p style={{
                                                                fontSize: 11, marginTop: 2,
                                                                opacity: 0.7, fontWeight: 500,
                                                            }}>
                                                                Tap to view meeting location
                                                            </p>
                                                        </div>
                                                    </a>
                                                </div>
                                            );
                                        }
                                        return <p style={{ fontSize: 14, lineHeight: 1.4, marginTop: msg.fileUrl ? 8 : 0 }}>{msg.text}</p>;
                                    })()}
                                </div>
                                <span style={{
                                    fontSize: 10,
                                    color: 'var(--text-muted)',
                                    marginTop: 4,
                                    display: 'block',
                                    textAlign: isMe ? 'right' : 'left',
                                }}>
                                    {formatTime(msg.createdAt)}
                                </span>
                            </motion.div>
                        );
                    })
                )}

                {/* Uploading files — inline previews with spinner (WhatsApp style) */}
                {uploadingFiles.map(uf => (
                    <motion.div
                        key={uf.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{
                            alignSelf: 'flex-end',
                            maxWidth: '80%',
                        }}
                    >
                        <div style={{
                            padding: uf.fileType === 'image' ? '4px' : '12px 16px',
                            borderRadius: '18px 18px 4px 18px',
                            background: 'var(--gradient-primary)',
                            color: 'white',
                            boxShadow: 'var(--shadow-sm)',
                            overflow: 'hidden',
                            position: 'relative',
                        }}>
                            {/* Circular spinner overlay */}
                            <div style={{
                                position: 'absolute', inset: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: uf.fileType === 'image' ? 'rgba(0,0,0,0.35)' : 'transparent',
                                zIndex: 2, borderRadius: 'inherit',
                            }}>
                                <div style={{
                                    width: 44, height: 44, borderRadius: '50%',
                                    background: 'rgba(0,0,0,0.45)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    backdropFilter: 'blur(4px)',
                                }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                                        <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" fill="none" />
                                        <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                                    </svg>
                                </div>
                            </div>

                            {/* Image preview */}
                            {uf.fileType === 'image' && uf.localUrl && (
                                <img src={uf.localUrl} alt="Uploading"
                                    style={{
                                        maxWidth: '100%', maxHeight: 280,
                                        borderRadius: 14, display: 'block',
                                        objectFit: 'cover', opacity: 0.7,
                                    }}
                                />
                            )}

                            {/* Document preview */}
                            {(uf.fileType === 'pdf' || uf.fileType === 'document') && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative', zIndex: 1 }}>
                                    <div style={{
                                        width: 40, height: 40, borderRadius: 10,
                                        background: 'rgba(255,255,255,0.2)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        <FileText size={20} color="white" />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{
                                            fontSize: 13, fontWeight: 600,
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        }}>
                                            {uf.name}
                                        </p>
                                        <p style={{ fontSize: 11, opacity: 0.7 }}>Uploading...</p>
                                    </div>
                                </div>
                            )}
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, display: 'block', textAlign: 'right' }}>Sending...</span>
                    </motion.div>
                ))}

                <div ref={messagesEndRef} />
            </div>

            {/* Input or Chat Closed Banner */}
            {hasAcceptedProject ? (
                <div style={{
                    padding: '16px 20px 24px',
                    background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)',
                    borderTop: '1px solid #BBF7D0',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <Lock size={20} color="#16A34A" />
                        <div>
                            <p style={{ fontSize: 14, fontWeight: 600, color: '#166534' }}>
                                Project Started!
                            </p>
                            <p style={{ fontSize: 12, color: '#15803D' }}>
                                Chat is now closed. Continue your project offline.
                            </p>
                        </div>
                    </div>
                    {isSeeker && (
                        <motion.button
                            onClick={() => {
                                const acceptedProject = projects.find(p => p.status === 'ACCEPTED');
                                setReviewData({ type: 'PROJECT', relatedId: acceptedProject?.id });
                                setShowReviewModal(true);
                            }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            style={{
                                width: '100%',
                                padding: 12,
                                borderRadius: 10,
                                background: 'white',
                                border: '1px solid #BBF7D0',
                                color: '#166534',
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                            }}
                        >
                            <Star size={18} />
                            Rate Your Experience
                        </motion.button>
                    )}
                </div>
            ) : (
                <div style={{
                    padding: '10px 12px 24px',
                    background: 'white',
                    borderTop: '1px solid var(--border-light)',
                }}>
                    {/* Upload progress bar */}


                    {/* Recording UI */}
                    {isRecording ? (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 4px',
                        }}>
                            {/* Cancel button */}
                            <motion.button
                                onClick={cancelRecording}
                                whileTap={{ scale: 0.9 }}
                                style={{
                                    width: 40, height: 40, borderRadius: '50%',
                                    background: '#FEE2E2', border: 'none',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer',
                                }}
                            >
                                <X size={18} color="#EF4444" />
                            </motion.button>

                            {/* Recording indicator */}
                            <div style={{
                                flex: 1, display: 'flex', alignItems: 'center', gap: 10,
                                padding: '10px 16px', borderRadius: 24,
                                background: micConnecting ? '#FFF7ED' : '#FEF2F2',
                                border: micConnecting ? '1px solid #FED7AA' : '1px solid #FECACA',
                            }}>
                                {micConnecting ? (
                                    <>
                                        <Loader2 size={14} color="#F97316" style={{ animation: 'spin 1s linear infinite' }} />
                                        <span style={{ fontSize: 13, fontWeight: 500, color: '#EA580C' }}>Connecting mic...</span>
                                    </>
                                ) : (
                                    <>
                                        <div style={{
                                            width: 10, height: 10, borderRadius: '50%',
                                            background: '#EF4444',
                                            animation: 'pulse 1s ease-in-out infinite',
                                        }} />
                                        <span style={{ fontSize: 14, fontWeight: 600, color: '#DC2626', fontFamily: 'monospace' }}>
                                            {formatDuration(recordingDuration)}
                                        </span>
                                        <span style={{ fontSize: 12, color: '#F87171' }}>
                                            / {formatDuration(MAX_VOICE_DURATION)}
                                        </span>
                                    </>
                                )}
                            </div>

                            {/* Send button */}
                            <motion.button
                                onClick={stopRecordingAndSend}
                                whileTap={{ scale: 0.9 }}
                                disabled={micConnecting}
                                style={{
                                    width: 48, height: 48, borderRadius: '50%',
                                    background: 'var(--gradient-primary)',
                                    border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: micConnecting ? 'not-allowed' : 'pointer',
                                    boxShadow: 'var(--shadow-glow-soft)',
                                    opacity: micConnecting ? 0.5 : 1,
                                }}
                            >
                                <Send size={20} color="white" />
                            </motion.button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {/* + Attachment button */}
                            <div style={{ position: 'relative' }}>
                                <motion.button
                                    onClick={() => setShowAttachMenu(!showAttachMenu)}
                                    whileTap={{ scale: 0.9 }}
                                    style={{
                                        width: 38, height: 38, borderRadius: '50%',
                                        background: 'transparent',
                                        border: 'none',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer', flexShrink: 0,
                                        transform: showAttachMenu ? 'rotate(45deg)' : 'rotate(0deg)',
                                        transition: 'transform 0.2s ease',
                                    }}
                                >
                                    <Plus size={24} color="var(--text-secondary)" strokeWidth={1.8} />
                                </motion.button>

                                {/* Attachment grid popup */}
                                {showAttachMenu && (
                                    <>
                                        <div onClick={() => setShowAttachMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
                                        <motion.div
                                            initial={{ opacity: 0, y: 12, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            transition={{ duration: 0.15, ease: 'easeOut' }}
                                            style={{
                                                position: 'absolute', bottom: '120%', left: -8,
                                                background: '#F5F5F5', borderRadius: 18,
                                                boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
                                                border: '1px solid rgba(0,0,0,0.06)',
                                                padding: '16px 12px 12px', zIndex: 50,
                                                width: 280,
                                            }}
                                        >
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(3, 1fr)',
                                                gap: 8,
                                            }}>
                                                {/* Photos */}
                                                <button
                                                    onClick={() => { galleryInputRef.current?.click(); setShowAttachMenu(false); }}
                                                    style={{
                                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                                                        padding: '12px 4px', borderRadius: 14, border: 'none',
                                                        background: 'transparent', cursor: 'pointer',
                                                    }}
                                                >
                                                    <div style={{ width: 52, height: 52, borderRadius: 14, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                                                        <ImageIcon size={24} color="#3B82F6" strokeWidth={1.8} />
                                                    </div>
                                                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>Photos</span>
                                                </button>

                                                {/* Camera */}
                                                <button
                                                    onClick={() => { cameraInputRef.current?.click(); setShowAttachMenu(false); }}
                                                    style={{
                                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                                                        padding: '12px 4px', borderRadius: 14, border: 'none',
                                                        background: 'transparent', cursor: 'pointer',
                                                    }}
                                                >
                                                    <div style={{ width: 52, height: 52, borderRadius: 14, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                                                        <Camera size={24} color="#6B7280" strokeWidth={1.8} />
                                                    </div>
                                                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>Camera</span>
                                                </button>

                                                {/* Location */}
                                                <button
                                                    onClick={handleShareLocation}
                                                    style={{
                                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                                                        padding: '12px 4px', borderRadius: 14, border: 'none',
                                                        background: 'transparent', cursor: 'pointer',
                                                        opacity: hasMeetingRequest ? 1 : 0.5,
                                                    }}
                                                >
                                                    <div style={{ width: 52, height: 52, borderRadius: 14, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                                                        <MapPin size={24} color={hasMeetingRequest ? '#22C55E' : '#9CA3AF'} strokeWidth={1.8} />
                                                    </div>
                                                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>Location</span>
                                                </button>

                                                {/* Contact */}
                                                <button
                                                    onClick={handleShareContact}
                                                    style={{
                                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                                                        padding: '12px 4px', borderRadius: 14, border: 'none',
                                                        background: 'transparent', cursor: 'pointer',
                                                        opacity: hasMeetingRequest ? 1 : 0.5,
                                                    }}
                                                >
                                                    <div style={{ width: 52, height: 52, borderRadius: 14, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                                                        <UserCircle size={24} color={hasMeetingRequest ? '#8B5CF6' : '#9CA3AF'} strokeWidth={1.8} />
                                                    </div>
                                                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>Contact</span>
                                                </button>

                                                {/* Document */}
                                                <button
                                                    onClick={() => { docInputRef.current?.click(); setShowAttachMenu(false); }}
                                                    style={{
                                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                                                        padding: '12px 4px', borderRadius: 14, border: 'none',
                                                        background: 'transparent', cursor: 'pointer',
                                                    }}
                                                >
                                                    <div style={{ width: 52, height: 52, borderRadius: 14, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                                                        <FileText size={24} color="#3B82F6" strokeWidth={1.8} />
                                                    </div>
                                                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>Document</span>
                                                </button>

                                                {/* Meeting */}
                                                <button
                                                    onClick={() => {
                                                        setShowAttachMenu(false);
                                                        if (activeMeeting) {
                                                            showToast('⚠️ A meeting is already in progress. Check the banner above.', 'info');
                                                            return;
                                                        }
                                                        setShowMeetingModal(true);
                                                    }}
                                                    disabled={!!activeMeeting}
                                                    style={{
                                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                                                        padding: '12px 4px', borderRadius: 14, border: 'none',
                                                        background: 'transparent',
                                                        cursor: activeMeeting ? 'default' : 'pointer',
                                                        opacity: activeMeeting ? 0.4 : 1,
                                                    }}
                                                >
                                                    <div style={{ width: 52, height: 52, borderRadius: 14, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                                                        <Calendar size={24} color={activeMeeting ? 'var(--text-muted)' : '#EF4444'} strokeWidth={1.8} />
                                                    </div>
                                                    <span style={{ fontSize: 11, fontWeight: 500, color: activeMeeting ? 'var(--text-muted)' : 'var(--text-secondary)' }}>{activeMeeting ? 'Meeting Set' : 'Meeting'}</span>
                                                </button>
                                            </div>
                                        </motion.div>
                                    </>
                                )}
                            </div>

                            {/* Text input — pill shape */}
                            <div style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                borderRadius: 24,
                                border: '1px solid var(--border)',
                                background: 'var(--bg-secondary)',
                                paddingRight: 4,
                                minWidth: 0,
                            }}>
                                <input
                                    type="text"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                    placeholder="Type a message..."
                                    disabled={sending || uploadingFile}
                                    style={{
                                        flex: 1,
                                        padding: '11px 16px',
                                        border: 'none',
                                        background: 'transparent',
                                        fontSize: 15,
                                        outline: 'none',
                                        opacity: (sending || uploadingFile) ? 0.7 : 1,
                                        minWidth: 0,
                                    }}
                                />
                            </div>

                            {/* Right-side action buttons */}
                            {message.trim() ? (
                                /* Send button when typing */
                                <motion.button
                                    onClick={handleSend}
                                    whileTap={{ scale: 0.9 }}
                                    disabled={sending}
                                    style={{
                                        width: 42, height: 42, borderRadius: '50%',
                                        background: 'var(--gradient-primary)',
                                        border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: sending ? 'not-allowed' : 'pointer',
                                        boxShadow: 'var(--shadow-glow-soft)',
                                        opacity: sending ? 0.7 : 1, flexShrink: 0,
                                    }}
                                >
                                    <Send size={18} color="white" />
                                </motion.button>
                            ) : (
                                /* Camera + Mic buttons when not typing */
                                <>
                                    <motion.button
                                        onClick={() => cameraInputRef.current?.click()}
                                        whileTap={{ scale: 0.9 }}
                                        style={{
                                            width: 38, height: 38, borderRadius: '50%',
                                            background: 'transparent',
                                            border: 'none',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: 'pointer', flexShrink: 0,
                                        }}
                                    >
                                        <Camera size={22} color="var(--text-secondary)" strokeWidth={1.6} />
                                    </motion.button>
                                    <motion.button
                                        onClick={startRecording}
                                        whileTap={{ scale: 0.9 }}
                                        disabled={uploadingFile}
                                        style={{
                                            width: 38, height: 38, borderRadius: '50%',
                                            background: 'transparent',
                                            border: 'none',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: uploadingFile ? 'not-allowed' : 'pointer',
                                            flexShrink: 0,
                                        }}
                                    >
                                        <Mic size={22} color="var(--text-secondary)" strokeWidth={1.6} />
                                    </motion.button>
                                </>
                            )}
                        </div>
                    )}

                    {/* Hidden file inputs — separate for camera, gallery, documents */}
                    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileSelect} style={{ display: 'none' }} />
                    <input ref={galleryInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} style={{ display: 'none' }} />
                    <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleFileSelect} style={{ display: 'none' }} />
                </div>
            )}

            {/* Start Project Modal */}
            <AnimatePresence>
                {showProjectModal && (
                    <StartProjectModal
                        match={{ id: otherUserId }}
                        onClose={() => setShowProjectModal(false)}
                        onSuccess={() => setShowProjectModal(false)}
                    />
                )}
            </AnimatePresence>

            {/* Schedule Meeting Modal */}
            <AnimatePresence>
                {showMeetingModal && !showRescheduleModal && (
                    <ScheduleMeetingModal
                        match={{ id: otherUserId, name }}
                        onClose={() => setShowMeetingModal(false)}
                        onScheduled={async () => {
                            setShowMeetingModal(false);
                            // Refresh meetings to show the new request
                            const updated = await getMeetings();
                            setMeetings(updated.filter(m =>
                                (m.companyId === otherUserId || m.seekerId === otherUserId) && !m.rescheduledTo
                            ));
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Reschedule Meeting Modal - uses same component as schedule */}
            <AnimatePresence>
                {showRescheduleModal && !showMeetingModal && (
                    <ScheduleMeetingModal
                        match={{ id: otherUserId, name }}
                        onClose={() => setShowRescheduleModal(false)}
                        onScheduled={async () => {
                            setShowRescheduleModal(false);
                            // Silently cancel the old meeting (no cancelled notification in chat)
                            if (activeMeeting) {
                                await cancelMeeting(activeMeeting.id, '', { silent: true });
                            }
                            const updated = await getMeetings();
                            setMeetings(updated.filter(m =>
                                (m.companyId === otherUserId || m.seekerId === otherUserId) && !m.rescheduledTo
                            ));
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Review Modal */}
            <AnimatePresence>
                {showReviewModal && reviewData && (
                    <ReviewModal
                        companyId={otherUserId}
                        companyName={name}
                        type={reviewData.type}
                        relatedId={reviewData.relatedId}
                        onClose={() => {
                            setShowReviewModal(false);
                            setReviewData(null);
                        }}
                        onSuccess={() => {
                            setShowReviewModal(false);
                            setReviewData(null);
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Profile Detail Modal — opens when tapping avatar/name in header */}
            <AnimatePresence>
                {showProfileDetail && !isBroadcast && (
                    <ProfileDetail
                        profile={{
                            id: otherUserId,
                            role: chat?.matchedUserRole || (isCompany ? 'COMPANY' : 'SEEKER'),
                            profile: profile,
                        }}
                        onClose={() => setShowProfileDetail(false)}
                        onMeet={() => { setShowProfileDetail(false); setShowMeetingModal(true); }}
                        viewerRole={user?.role}
                    />
                )}
            </AnimatePresence>

            {/* Accept & Schedule Modal — for seeker to accept + set date/time/location */}
            <AnimatePresence>
                {showAcceptScheduleModal && activeMeeting && activeMeeting.status === 'REQUESTED' && (
                    <AcceptAndScheduleModal
                        meeting={activeMeeting}
                        onClose={() => setShowAcceptScheduleModal(false)}
                        onScheduled={async () => {
                            setShowAcceptScheduleModal(false);
                            const updated = await getMeetings();
                            setMeetings(updated.filter(m =>
                                (m.companyId === otherUserId || m.seekerId === otherUserId) && !m.rescheduledTo
                            ));
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Counter-Propose Modal — for suggesting different meeting details during negotiation */}
            <AnimatePresence>
                {showCounterProposeModal && activeMeeting && activeMeeting.status === 'PROPOSED' && (
                    <CounterProposeModal
                        meeting={activeMeeting}
                        onClose={() => setShowCounterProposeModal(false)}
                        onProposed={async () => {
                            setShowCounterProposeModal(false);
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Contact Picker Modal — WhatsApp-style device contacts browser */}
            <AnimatePresence>
                {showContactModal && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowContactModal(false)}
                            style={{
                                position: 'fixed', inset: 0,
                                background: 'rgba(0,0,0,0.5)',
                                zIndex: 99999,
                            }}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: '100%' }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: '100%' }}
                            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                            style={{
                                position: 'fixed',
                                inset: 0,
                                zIndex: 100000,
                                background: 'white',
                                display: 'flex',
                                flexDirection: 'column',
                            }}
                        >
                            {/* Header */}
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: '16px 16px',
                                paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
                                borderBottom: '1px solid var(--border-light)',
                                flexShrink: 0,
                            }}>
                                <motion.button
                                    onClick={() => setShowContactModal(false)}
                                    whileTap={{ scale: 0.9 }}
                                    style={{
                                        width: 36, height: 36, borderRadius: '50%',
                                        background: 'var(--bg-secondary)', border: 'none',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer', flexShrink: 0,
                                    }}
                                >
                                    <ArrowLeft size={20} color="var(--text-primary)" />
                                </motion.button>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                                        Share Contact
                                    </h3>
                                    {deviceContacts.length > 0 && (
                                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                            {deviceContacts.length} contacts on this device
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Loading state */}
                            {contactsLoading ? (
                                <div style={{
                                    flex: 1, display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center', gap: 12,
                                }}>
                                    <Loader2 size={36} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
                                    <p style={{ fontSize: 15, color: 'var(--text-muted)', fontWeight: 500 }}>Loading contacts...</p>
                                </div>
                            ) : deviceContacts.length > 0 ? (
                                <>
                                    {/* Search bar */}
                                    <div style={{
                                        padding: '12px 16px',
                                        borderBottom: '1px solid var(--border-light)',
                                        flexShrink: 0,
                                    }}>
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: 8,
                                            padding: '10px 14px',
                                            background: 'var(--bg-secondary)',
                                            borderRadius: 12,
                                            border: '1px solid var(--border-light)',
                                        }}>
                                            <Search size={18} color="var(--text-muted)" />
                                            <input
                                                type="text"
                                                placeholder="Search contacts..."
                                                value={contactSearch}
                                                onChange={(e) => setContactSearch(e.target.value)}
                                                autoFocus
                                                style={{
                                                    border: 'none', outline: 'none', flex: 1,
                                                    fontSize: 14, color: 'var(--text-primary)',
                                                    background: 'transparent', padding: 0,
                                                }}
                                            />
                                            {contactSearch && (
                                                <motion.button
                                                    onClick={() => setContactSearch('')}
                                                    whileTap={{ scale: 0.85 }}
                                                    style={{
                                                        width: 22, height: 22, borderRadius: '50%',
                                                        background: 'var(--text-muted)', border: 'none',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    <X size={12} color="white" />
                                                </motion.button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Contact list */}
                                    <div style={{
                                        flex: 1, overflow: 'auto',
                                        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
                                    }}>
                                        {filteredContacts.length === 0 ? (
                                            <div style={{
                                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                                                justifyContent: 'center', padding: 60, gap: 8,
                                            }}>
                                                <UserCircle size={48} color="var(--text-muted)" style={{ opacity: 0.4 }} />
                                                <p style={{ fontSize: 15, color: 'var(--text-muted)', fontWeight: 600 }}>No contacts found</p>
                                                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Try a different search</p>
                                            </div>
                                        ) : (
                                            filteredContacts.map((contact, idx) => {
                                                // Show letter divider
                                                const firstLetter = (contact.name || '#')[0].toUpperCase();
                                                const prevLetter = idx > 0 ? (filteredContacts[idx - 1]?.name || '#')[0].toUpperCase() : null;
                                                const showDivider = firstLetter !== prevLetter;

                                                return (
                                                    <React.Fragment key={`${contact.name}_${contact.phone}_${idx}`}>
                                                        {showDivider && (
                                                            <div style={{
                                                                padding: '8px 16px 4px',
                                                                fontSize: 12, fontWeight: 700,
                                                                color: 'var(--primary)',
                                                                background: 'var(--bg-secondary)',
                                                                letterSpacing: 0.5,
                                                                textTransform: 'uppercase',
                                                            }}>
                                                                {firstLetter}
                                                            </div>
                                                        )}
                                                        <motion.button
                                                            onClick={() => handleSelectDeviceContact(contact)}
                                                            whileTap={{ scale: 0.97, backgroundColor: 'var(--pastel-green)' }}
                                                            style={{
                                                                display: 'flex', alignItems: 'center', gap: 12,
                                                                width: '100%', padding: '12px 16px',
                                                                border: 'none', background: 'transparent',
                                                                cursor: 'pointer', textAlign: 'left',
                                                                transition: 'background 0.15s',
                                                            }}
                                                        >
                                                            {/* Avatar */}
                                                            <div style={{
                                                                width: 44, height: 44, borderRadius: '50%',
                                                                background: `hsl(${(contact.name || '').charCodeAt(0) * 37 % 360}, 60%, 92%)`,
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                flexShrink: 0,
                                                                fontSize: 18, fontWeight: 700,
                                                                color: `hsl(${(contact.name || '').charCodeAt(0) * 37 % 360}, 50%, 40%)`,
                                                            }}>
                                                                {(contact.name || '?')[0].toUpperCase()}
                                                            </div>
                                                            {/* Name + Phone */}
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <p style={{
                                                                    fontSize: 15, fontWeight: 600,
                                                                    color: 'var(--text-primary)',
                                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                                }}>
                                                                    {contact.name || 'Unknown'}
                                                                </p>
                                                                {contact.phone && (
                                                                    <p style={{
                                                                        fontSize: 13, color: 'var(--text-muted)',
                                                                        marginTop: 2,
                                                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                                    }}>
                                                                        {contact.phone}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            {/* Share indicator */}
                                                            <Send size={16} color="var(--primary)" style={{ opacity: 0.5, flexShrink: 0 }} />
                                                        </motion.button>
                                                    </React.Fragment>
                                                );
                                            })
                                        )}
                                    </div>
                                </>
                            ) : (
                                /* No contacts available — permission denied or unsupported */
                                (() => {
                                    // The device-contacts picker needs the NATIVE bridge (window.PlyshipContacts),
                                    // which only exists in the Android/iOS app build — not on web.
                                    const hasBridge = !!window.PlyshipContacts || !!window.webkit?.messageHandlers?.getContacts;
                                    const isNativeWebView = hasBridge || !!window.PlyshipPush || /; wv[);]/.test(navigator.userAgent);
                                    const _inNativeApp = isNativeWebView; // kept for the Retry button condition below
                                    // Determine title and message for the empty state.
                                    let emptyTitle = 'Contacts Not Available';
                                    let emptyMsg = 'Open Plyship in the app to pick from your device contacts — or add one manually below.';
                                    if (contactsPermissionDenied) {
                                        emptyTitle = 'Contacts Access Denied';
                                        emptyMsg = 'Allow contacts access in your device settings and tap Retry — or just add a contact manually below.';
                                    } else if (isNativeWebView && !hasBridge) {
                                        // In the app, but the native contacts bridge is missing → app is out of date.
                                        emptyTitle = 'Update your app';
                                        emptyMsg = 'This version of the app can’t read device contacts yet. Please update to the latest Plyship app to pick from your contacts. Meanwhile, you can add a contact manually below.';
                                    } else if (hasBridge) {
                                        emptyTitle = 'No contacts found';
                                        emptyMsg = 'No contacts with a phone number were found on this device. Tap Retry, or add a contact manually below.';
                                    }
                                    const sendManual = () => {
                                        const n = manualName.trim();
                                        const p = manualPhone.trim();
                                        if (!n && !p) { showToast('Enter a name or phone number', 'warning'); return; }
                                        handleSelectDeviceContact({ name: n || p, phone: p });
                                        setManualName(''); setManualPhone('');
                                    };
                                    return (
                                        <div style={{
                                            flex: 1, display: 'flex', flexDirection: 'column',
                                            alignItems: 'center', justifyContent: 'flex-start',
                                            padding: '32px 24px', gap: 14, textAlign: 'center',
                                            overflow: 'auto',
                                        }}>
                                            <div style={{
                                                width: 64, height: 64, borderRadius: '50%',
                                                background: 'var(--pastel-green)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                            }}>
                                                <UserCircle size={32} color="var(--primary)" />
                                            </div>
                                            <div>
                                                <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                                                    {emptyTitle}
                                                </p>
                                                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                                    {emptyMsg}
                                                </p>
                                            </div>
                                            {(_inNativeApp || contactsPermissionDenied) && (
                                                <motion.button
                                                    onClick={async () => {
                                                        setContactsLoading(true);
                                                        const contacts = await fetchDeviceContacts();
                                                        if (!contacts || contacts.length === 0) {
                                                            setContactsLoading(false);
                                                        }
                                                    }}
                                                    whileTap={{ scale: 0.95 }}
                                                    style={{
                                                        padding: '10px 28px', borderRadius: 12,
                                                        background: 'var(--bg-secondary)', border: '1px solid var(--border-light)',
                                                        color: 'var(--text-primary)', fontSize: 14, fontWeight: 600,
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    Retry
                                                </motion.button>
                                            )}

                                            {/* Manual entry — always works, regardless of the device picker */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', maxWidth: 340, marginTop: 8 }}>
                                                <div style={{ flex: 1, height: 1, background: 'var(--border-light)' }} />
                                                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>ADD MANUALLY</span>
                                                <div style={{ flex: 1, height: 1, background: 'var(--border-light)' }} />
                                            </div>
                                            <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                <input
                                                    type="text"
                                                    placeholder="Contact name"
                                                    value={manualName}
                                                    onChange={(e) => setManualName(e.target.value)}
                                                    style={{
                                                        width: '100%', padding: '12px 14px', borderRadius: 12,
                                                        border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                                                        fontSize: 15, color: 'var(--text-primary)', outline: 'none',
                                                    }}
                                                />
                                                <input
                                                    type="tel"
                                                    inputMode="tel"
                                                    placeholder="Phone number"
                                                    value={manualPhone}
                                                    onChange={(e) => setManualPhone(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') sendManual(); }}
                                                    style={{
                                                        width: '100%', padding: '12px 14px', borderRadius: 12,
                                                        border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                                                        fontSize: 15, color: 'var(--text-primary)', outline: 'none',
                                                    }}
                                                />
                                                <motion.button
                                                    onClick={sendManual}
                                                    whileTap={{ scale: 0.97 }}
                                                    style={{
                                                        width: '100%', padding: '12px 16px', borderRadius: 12,
                                                        background: 'var(--gradient-primary)', border: 'none',
                                                        color: 'white', fontSize: 15, fontWeight: 700,
                                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                                    }}
                                                >
                                                    <Send size={16} /> Send Contact
                                                </motion.button>
                                            </div>
                                        </div>
                                    );
                                })()
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ── Fullscreen File Preview Overlay ──
                Opens images/PDFs inline (90% of screen) instead of navigating away.
                Works on all devices: PWA, Android WebView, iOS WebView.
                Press X, tap backdrop, or hit Escape/Back to close.
            */}
            <AnimatePresence>
                {filePreview && (
                    <>
                        {/* Dark backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setFilePreview(null)}
                            style={{
                                position: 'fixed', inset: 0,
                                background: 'rgba(0,0,0,0.85)',
                                zIndex: 200000,
                            }}
                        />
                        {/* Preview container — 90% of viewport */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.92 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.92 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            style={{
                                position: 'fixed',
                                top: '5%', left: '5%',
                                width: '90%', height: '90%',
                                zIndex: 200001,
                                display: 'flex', flexDirection: 'column',
                                borderRadius: 16,
                                overflow: 'hidden',
                                background: '#111',
                                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header bar with file name and close (X) button */}
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '12px 16px',
                                paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
                                background: 'rgba(0,0,0,0.6)',
                                backdropFilter: 'blur(10px)',
                                WebkitBackdropFilter: 'blur(10px)',
                                flexShrink: 0,
                            }}>
                                <p style={{
                                    fontSize: 14, fontWeight: 600, color: 'white',
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    flex: 1, marginRight: 12,
                                }}>
                                    {filePreview.name || 'File'}
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {/* Download / open externally button */}
                                    <motion.a
                                        href={filePreview.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        whileTap={{ scale: 0.85 }}
                                        style={{
                                            width: 36, height: 36, borderRadius: '50%',
                                            background: 'rgba(255,255,255,0.15)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: 'pointer', textDecoration: 'none', border: 'none',
                                            flexShrink: 0,
                                        }}
                                        title="Open in new tab"
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                            <polyline points="15 3 21 3 21 9" />
                                            <line x1="10" y1="14" x2="21" y2="3" />
                                        </svg>
                                    </motion.a>
                                    {/* Close (X) button */}
                                    <motion.button
                                        onClick={() => setFilePreview(null)}
                                        whileTap={{ scale: 0.85 }}
                                        style={{
                                            width: 36, height: 36, borderRadius: '50%',
                                            background: 'rgba(255,255,255,0.2)',
                                            border: 'none',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: 'pointer', flexShrink: 0,
                                        }}
                                    >
                                        <X size={20} color="white" />
                                    </motion.button>
                                </div>
                            </div>

                            {/* Content area */}
                            <div style={{
                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                overflow: 'auto', padding: 8,
                                WebkitOverflowScrolling: 'touch',
                            }}>
                                {filePreview.type === 'image' ? (
                                    <img
                                        src={filePreview.url}
                                        alt={filePreview.name || 'Preview'}
                                        style={{
                                            maxWidth: '100%', maxHeight: '100%',
                                            objectFit: 'contain',
                                            borderRadius: 8,
                                            userSelect: 'none',
                                            WebkitUserSelect: 'none',
                                        }}
                                    />
                                ) : (
                                    /* PDF / Document — use iframe for both PWA and native WebViews.
                                       On native WebViews, the raw PDF URL won't render in an iframe,
                                       so we route through Google Docs Viewer which renders it as HTML. */
                                    (() => {
                                        const pdfUrl = _isNativeWebView
                                            ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(filePreview.url)}`
                                            : filePreview.url;
                                        // Google Docs Viewer requires no sandbox restrictions to render.
                                        // Only sandbox direct PDF URLs (PWA path).
                                        const sandboxProps = _isNativeWebView
                                            ? {}
                                            : { sandbox: 'allow-same-origin allow-scripts allow-popups' };
                                        return (
                                            <iframe
                                                src={pdfUrl}
                                                title={filePreview.name || 'Document Preview'}
                                                style={{
                                                    width: '100%', height: '100%',
                                                    border: 'none', borderRadius: 8,
                                                    background: 'white',
                                                }}
                                                {...sandboxProps}
                                            />
                                        );
                                    })()
                                )}
                            </div>
                        </motion.div>

                        {/* Keyboard handler — Escape to close, also handle back button on mobile */}
                        <FilePreviewKeyHandler onClose={() => setFilePreview(null)} />
                    </>
                )}
            </AnimatePresence>

            {/* ── In-app Map Preview popup (PDF-popup style, ~90% of screen) ──
                Opens the location on an interactive map inside the chat instead of
                launching the external Google Maps app. X / backdrop / Escape closes. */}
            <AnimatePresence>
                {mapPreview && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setMapPreview(null)}
                            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200000 }}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                position: 'fixed', top: '5%', left: '5%', width: '90%', height: '90%',
                                zIndex: 200001, display: 'flex', flexDirection: 'column',
                                borderRadius: 16, overflow: 'hidden', background: '#111',
                                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                            }}
                        >
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '12px 16px', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
                                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', flexShrink: 0,
                            }}>
                                <p style={{ fontSize: 14, fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <MapPin size={16} color="#22C55E" style={{ flexShrink: 0 }} /> {mapPreview.address || 'Location'}
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <motion.a
                                        href={mapPreview.coords ? `https://www.google.com/maps/search/?api=1&query=${mapPreview.coords}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapPreview.address || '')}`}
                                        target="_blank" rel="noopener noreferrer" whileTap={{ scale: 0.85 }}
                                        style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', textDecoration: 'none', flexShrink: 0 }}
                                        title="Open in Google Maps"
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                                    </motion.a>
                                    <motion.button onClick={() => setMapPreview(null)} whileTap={{ scale: 0.85 }}
                                        style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                                        <X size={20} color="white" />
                                    </motion.button>
                                </div>
                            </div>
                            <div style={{ flex: 1, background: 'white' }}>
                                <iframe
                                    title="Location map"
                                    src={mapPreview.coords
                                        ? `https://maps.google.com/maps?q=${mapPreview.coords}&z=16&output=embed`
                                        : `https://maps.google.com/maps?q=${encodeURIComponent(mapPreview.address || '')}&z=16&output=embed`}
                                    style={{ width: '100%', height: '100%', border: 'none' }}
                                    loading="lazy"
                                    referrerPolicy="no-referrer-when-downgrade"
                                />
                            </div>
                        </motion.div>
                        <FilePreviewKeyHandler onClose={() => setMapPreview(null)} />
                    </>
                )}
            </AnimatePresence>

            {/* ── Location Picker (opened from the "+" menu) — send current location or pin on the map ── */}
            <AnimatePresence>
                {showLocationPicker && (
                    <LocationPicker
                        title="Share Location"
                        onClose={() => setShowLocationPicker(false)}
                        onSelect={handleLocationSelected}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
