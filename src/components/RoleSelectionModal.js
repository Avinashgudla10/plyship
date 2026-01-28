'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Home, Briefcase, ArrowRight, Leaf } from 'lucide-react';

export default function RoleSelectionModal({ onSelect }) {
    const roles = [
        {
            id: 'SEEKER',
            icon: Home,
            title: 'I need Interior Design',
            description: 'Find verified companies & get exclusive rewards',
            bgColor: '#ECFDF5',
            borderColor: '#A7F3D0',
            iconColor: '#22C55E'
        },
        {
            id: 'COMPANY',
            icon: Briefcase,
            title: 'I am an Interior Company',
            description: 'Find clients & showcase your portfolio',
            bgColor: '#F0FDF4',
            borderColor: '#BBF7D0',
            iconColor: '#16A34A'
        }
    ];

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                zIndex: 200,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end'
            }}
        >
            <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                style={{
                    width: '100%',
                    maxWidth: 480,
                    background: 'white',
                    borderTop: '1px solid var(--border-light)',
                    borderTopLeftRadius: 32,
                    borderTopRightRadius: 32,
                    padding: '32px 24px 48px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 20,
                    boxShadow: '0 -16px 48px rgba(0,0,0,0.1)'
                }}
            >
                {/* Handle */}
                <div style={{
                    width: 40,
                    height: 4,
                    borderRadius: 2,
                    background: 'var(--border)',
                    margin: '0 auto 8px',
                }} />

                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 8 }}>
                    <div style={{
                        width: 56,
                        height: 56,
                        margin: '0 auto 16px',
                        borderRadius: 16,
                        background: 'var(--gradient-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: 'var(--shadow-glow-soft)'
                    }}>
                        <Leaf size={28} color="white" />
                    </div>
                    <h2 style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 24,
                        fontWeight: 800,
                        marginBottom: 8,
                        color: 'var(--text-primary)'
                    }}>
                        Choose your path
                    </h2>
                    <p style={{
                        fontSize: 15,
                        color: 'var(--text-secondary)',
                        lineHeight: 1.5,
                        maxWidth: 280,
                        margin: '0 auto'
                    }}>
                        Select how you want to use PLYSHIP for the best experience
                    </p>
                </div>

                {/* Role Options */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {roles.map((role, index) => (
                        <motion.button
                            key={role.id}
                            onClick={() => onSelect(role.id)}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 + index * 0.1 }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 16,
                                padding: 20,
                                borderRadius: 20,
                                border: `2px solid ${role.borderColor}`,
                                background: role.bgColor,
                                textAlign: 'left',
                                cursor: 'pointer',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                        >
                            <div style={{
                                width: 52,
                                height: 52,
                                borderRadius: 16,
                                background: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                boxShadow: 'var(--shadow-sm)'
                            }}>
                                <role.icon size={26} color={role.iconColor} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <h3 style={{
                                    fontSize: 16,
                                    fontWeight: 700,
                                    color: 'var(--text-primary)',
                                    marginBottom: 4
                                }}>
                                    {role.title}
                                </h3>
                                <p style={{
                                    fontSize: 13,
                                    color: 'var(--text-tertiary)',
                                    lineHeight: 1.4
                                }}>
                                    {role.description}
                                </p>
                            </div>
                            <ArrowRight size={20} color="var(--text-muted)" />
                        </motion.button>
                    ))}
                </div>
            </motion.div>
        </motion.div>
    );
}
