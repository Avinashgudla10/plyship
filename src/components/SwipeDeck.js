'use client';

import React, { useState } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import ProfileCard from './ProfileCard';
import { X, Calendar, RotateCcw } from 'lucide-react';

const Card = ({ profile, onSwipe, isTop }) => {
    const x = useMotionValue(0);
    const rotate = useTransform(x, [-200, 200], [-12, 12]);
    const nopeOpacity = useTransform(x, [0, -100], [0, 1]);

    const handleDragEnd = (event, info) => {
        const threshold = 120;
        const velocityThreshold = 500;

        // Only allow left swipe (reject)
        if (info.offset.x < -threshold || info.velocity.x < -velocityThreshold) {
            onSwipe('left');
        }
    };

    const handleTap = () => {
        onSwipe('tap');
    };

    return (
        <motion.div
            style={{
                width: '100%',
                height: '100%',
                position: 'absolute',
                x,
                rotate,
                cursor: 'grab',
                zIndex: isTop ? 2 : 1,
            }}
            whileTap={{ cursor: 'grabbing' }}
            drag={isTop ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.9}
            onDragEnd={handleDragEnd}
            onTap={handleTap}
            initial={{ scale: isTop ? 1 : 0.95, opacity: isTop ? 1 : 0.6 }}
            animate={{ scale: isTop ? 1 : 0.95, opacity: isTop ? 1 : 0.6 }}
            exit={{
                x: -300,
                opacity: 0,
                transition: { duration: 0.3 }
            }}
        >
            <ProfileCard profile={profile} />

            {/* NOPE Indicator */}
            <motion.div
                style={{
                    opacity: nopeOpacity,
                    position: 'absolute',
                    top: 32,
                    right: 24,
                    padding: '12px 24px',
                    borderRadius: 12,
                    border: '4px solid #F87171',
                    background: 'rgba(248, 113, 113, 0.1)',
                    backdropFilter: 'blur(10px)',
                    transform: 'rotate(15deg)',
                    zIndex: 10,
                }}
            >
                <span style={{
                    fontSize: 28,
                    fontWeight: 900,
                    color: '#F87171',
                    fontFamily: 'var(--font-display)',
                    letterSpacing: 2,
                }}>
                    NOPE
                </span>
            </motion.div>
        </motion.div>
    );
};

export default function SwipeDeck({ profiles, onMatch, userRole }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [exitDirection, setExitDirection] = useState(null);

    const currentProfile = profiles[currentIndex];
    const nextProfile = profiles[currentIndex + 1];

    const handleSwipe = (direction) => {
        if (direction === 'tap') {
            onMatch && onMatch(currentProfile, 'tap');
            return;
        }

        if (direction === 'meet') {
            // Pass profile with 'meet' direction — page.js will handle opening chat + meeting modal
            onMatch && onMatch(currentProfile, 'meet');
            // Advance to next card
            setExitDirection('left');
            setTimeout(() => {
                setCurrentIndex(prev => prev + 1);
                setExitDirection(null);
            }, 200);
            return;
        }

        setExitDirection(direction);

        // Left = reject/pass
        if (direction === 'left') {
            onMatch && onMatch(currentProfile, 'left');
        }

        setTimeout(() => {
            setCurrentIndex(prev => prev + 1);
            setExitDirection(null);
        }, 200);
    };

    const resetDeck = () => {
        setCurrentIndex(0);
    };

    if (!currentProfile) {
        return (
            <div style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 20,
                padding: 32,
                textAlign: 'center',
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
                    }}
                >
                    <RotateCcw size={32} color="var(--primary)" />
                </motion.div>
                <div>
                    <h2 style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 24,
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        marginBottom: 8,
                    }}>
                        You&apos;ve seen everyone!
                    </h2>
                    <p style={{
                        fontSize: 15,
                        color: 'var(--text-secondary)',
                        lineHeight: 1.5,
                        marginBottom: 20,
                    }}>
                        Want to browse profiles again?
                    </p>
                    <motion.button
                        onClick={resetDeck}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        style={{
                            padding: '14px 32px',
                            borderRadius: 14,
                            background: 'var(--gradient-primary)',
                            border: 'none',
                            color: 'white',
                            fontSize: 15,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            margin: '0 auto',
                            boxShadow: 'var(--shadow-glow-soft)',
                        }}
                    >
                        <RotateCcw size={18} />
                        View All Again
                    </motion.button>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
        }}>
            {/* Card Stack */}
            <div style={{
                flex: 1,
                position: 'relative',
                margin: '0 auto',
                width: '100%',
                maxWidth: 380,
            }}>
                <AnimatePresence>
                    {nextProfile && (
                        <Card
                            key={nextProfile.id}
                            profile={nextProfile}
                            onSwipe={() => { }}
                            isTop={false}
                        />
                    )}
                    {currentProfile && (
                        <Card
                            key={currentProfile.id}
                            profile={currentProfile}
                            onSwipe={handleSwipe}
                            isTop={true}
                        />
                    )}
                </AnimatePresence>
            </div>

            {/* Control Buttons — Reject & Meet only */}
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 32,
                paddingBottom: 16,
                paddingTop: 16,
            }}>
                {/* Reject Button */}
                <motion.button
                    onClick={() => handleSwipe('left')}
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    style={{
                        width: 64,
                        height: 64,
                        borderRadius: '50%',
                        background: 'white',
                        border: '2px solid #FEE2E2',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: 'var(--shadow-md)',
                        cursor: 'pointer',
                    }}
                >
                    <X size={30} color="#F87171" strokeWidth={3} />
                </motion.button>

                {/* Meet Button */}
                <motion.button
                    onClick={() => handleSwipe('meet')}
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    style={{
                        width: 64,
                        height: 64,
                        borderRadius: '50%',
                        background: 'var(--gradient-primary)',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: 'var(--shadow-glow-soft)',
                        cursor: 'pointer',
                    }}
                >
                    <Calendar size={28} color="white" />
                </motion.button>
            </div>
        </div>
    );
}
