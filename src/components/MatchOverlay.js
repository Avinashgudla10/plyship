'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, Leaf, X } from 'lucide-react';

const Particle = ({ delay, x, offsetX, rotate, borderRadius, colorIndex }) => {
    const colors = ['#4ADE80', '#86EFAC', '#A7F3D0', '#FBBF24', '#60A5FA'];
    return (
        <motion.div
            initial={{ y: 0, x, opacity: 1, scale: 1 }}
            animate={{
                y: -400,
                x: x + offsetX,
                opacity: 0,
                scale: 0.5,
                rotate: rotate,
            }}
            transition={{ duration: 2, delay, ease: 'easeOut' }}
            style={{
                position: 'absolute',
                bottom: '30%',
                left: '50%',
                width: 10,
                height: 10,
                borderRadius: borderRadius,
                background: colors[colorIndex],
            }}
        />
    );
};

// Generate random particle data once (outside component to avoid re-generation)
const generateParticleData = () => {
    return Array.from({ length: 30 }, (_, i) => ({
        id: i,
        delay: Math.random() * 0.5,
        x: (Math.random() - 0.5) * 200,
        offsetX: (Math.random() - 0.5) * 100,
        rotate: Math.random() * 720 - 360,
        borderRadius: Math.random() > 0.5 ? '50%' : 2,
        colorIndex: Math.floor(Math.random() * 5),
    }));
};

export default function MatchOverlay({ matchedProfile, onClose, onChat }) {
    // Use useMemo to generate particles only once per mount
    const particles = useMemo(() => generateParticleData(), []);

    // Extract display data from the profile
    const profileData = matchedProfile?.profile || {};
    const displayName = matchedProfile?.name || profileData.companyName || profileData.name || 'Someone';
    const displayImage = profileData.avatar || profileData.portfolioImages?.[0] ||
        'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&q=80&w=1000';

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                zIndex: 300,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 32,
                overflow: 'hidden',
            }}
        >
            {/* Confetti */}
            {particles.map((p) => (
                <Particle
                    key={p.id}
                    delay={p.delay}
                    x={p.x}
                    offsetX={p.offsetX}
                    rotate={p.rotate}
                    borderRadius={p.borderRadius}
                    colorIndex={p.colorIndex}
                />
            ))}

            {/* Glow Effect */}
            <div style={{
                position: 'absolute',
                top: '30%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 300,
                height: 300,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(74, 222, 128, 0.2) 0%, transparent 70%)',
                filter: 'blur(40px)',
                pointerEvents: 'none',
            }} />

            {/* Close Button */}
            <motion.button
                onClick={onClose}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                style={{
                    position: 'absolute',
                    top: 24,
                    right: 24,
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                }}
            >
                <X size={22} color="var(--text-secondary)" />
            </motion.button>

            {/* Content */}
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: 'spring', bounce: 0.4 }}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 24,
                    position: 'relative',
                    zIndex: 10,
                }}
            >
                {/* Match Icon */}
                <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    style={{
                        width: 80,
                        height: 80,
                        borderRadius: 24,
                        background: 'var(--gradient-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: 'var(--shadow-glow-primary)',
                    }}
                >
                    <Leaf size={40} color="white" />
                </motion.div>

                {/* Title */}
                <div style={{ textAlign: 'center' }}>
                    <motion.h1
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: 36,
                            fontWeight: 900,
                            color: 'var(--primary-hover)',
                            marginBottom: 8,
                        }}
                    >
                        It&apos;s a Match!
                    </motion.h1>
                    <motion.p
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        style={{
                            fontSize: 16,
                            color: 'var(--text-secondary)',
                            lineHeight: 1.5,
                        }}
                    >
                        You and {displayName} both liked each other
                    </motion.p>
                </div>

                {/* Profile Image */}
                <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.5, type: 'spring', bounce: 0.3 }}
                    style={{
                        width: 160,
                        height: 160,
                        borderRadius: 32,
                        overflow: 'hidden',
                        border: '4px solid var(--primary)',
                        boxShadow: 'var(--shadow-glow-soft)',
                    }}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={displayImage}
                        alt={displayName}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                        }}
                    />
                </motion.div>

                {/* Action Buttons */}
                <motion.div
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                        width: '100%',
                        maxWidth: 280,
                        marginTop: 16,
                    }}
                >
                    <motion.button
                        onClick={onChat}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        style={{
                            padding: '18px 24px',
                            borderRadius: 16,
                            background: 'var(--gradient-primary)',
                            border: 'none',
                            color: 'white',
                            fontSize: 16,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 10,
                            boxShadow: 'var(--shadow-glow-primary)',
                            cursor: 'pointer',
                        }}
                    >
                        <MessageCircle size={20} />
                        Send a Message
                    </motion.button>

                    <motion.button
                        onClick={onClose}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        style={{
                            padding: '18px 24px',
                            borderRadius: 16,
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-secondary)',
                            fontSize: 16,
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        Keep Swiping
                    </motion.button>
                </motion.div>
            </motion.div>
        </motion.div>
    );
}
