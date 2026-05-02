'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext();

const ICONS = {
    success: { icon: CheckCircle, color: '#22C55E', bg: '#F0FDF4', border: '#BBF7D0' },
    error: { icon: XCircle, color: '#EF4444', bg: '#FEF2F2', border: '#FECACA' },
    warning: { icon: AlertTriangle, color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
    info: { icon: Info, color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' },
};

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const [confirmState, setConfirmState] = useState(null);
    const confirmResolveRef = useRef(null);
    const idRef = useRef(0);

    const showToast = useCallback((message, type = 'success', duration = 3500) => {
        const id = ++idRef.current;
        // Strip emoji prefixes
        const cleanMessage = message.replace(/^[✅❌⚠️🎉⏰💰🗑️📋]+\s*/, '');
        setToasts(prev => [...prev, { id, message: cleanMessage, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, duration);
    }, []);

    const dismissToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const showConfirm = useCallback((message, title = 'Confirm') => {
        return new Promise((resolve) => {
            confirmResolveRef.current = resolve;
            setConfirmState({ title, message });
        });
    }, []);

    const handleConfirm = (result) => {
        setConfirmState(null);
        confirmResolveRef.current?.(result);
    };

    return (
        <ToastContext.Provider value={{ showToast, showConfirm }}>
            {children}

            {/* Toast Stack */}
            <div style={{
                position: 'fixed',
                top: 'calc(env(safe-area-inset-top, 0px) + 8px)',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 99999,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                pointerEvents: 'none',
                width: '90%',
                maxWidth: 400,
            }}>
                <AnimatePresence>
                    {toasts.map((toast) => {
                        const style = ICONS[toast.type] || ICONS.info;
                        const Icon = style.icon;
                        return (
                            <motion.div
                                key={toast.id}
                                initial={{ opacity: 0, y: -30, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                                transition={{ duration: 0.25, ease: 'easeOut' }}
                                style={{
                                    background: style.bg,
                                    border: `1px solid ${style.border}`,
                                    borderRadius: 14,
                                    padding: '14px 16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                    pointerEvents: 'auto',
                                    cursor: 'pointer',
                                }}
                                onClick={() => dismissToast(toast.id)}
                            >
                                <Icon size={20} color={style.color} style={{ flexShrink: 0 }} />
                                <span style={{
                                    fontSize: 14,
                                    fontWeight: 500,
                                    color: '#1F2937',
                                    lineHeight: 1.4,
                                    flex: 1,
                                }}>
                                    {toast.message}
                                </span>
                                <X size={16} color="#9CA3AF" style={{ flexShrink: 0 }} />
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {/* Confirm Modal */}
            <AnimatePresence>
                {confirmState && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 99998,
                            padding: 20,
                        }}
                        onClick={() => handleConfirm(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={e => e.stopPropagation()}
                            style={{
                                background: 'white',
                                borderRadius: 20,
                                padding: '28px 24px',
                                width: '100%',
                                maxWidth: 360,
                                boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                            }}
                        >
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                marginBottom: 16,
                            }}>
                                <div style={{
                                    width: 44, height: 44, borderRadius: 12,
                                    background: '#FEF3C7',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <AlertTriangle size={22} color="#F59E0B" />
                                </div>
                                <h3 style={{
                                    fontSize: 18, fontWeight: 700, color: '#111',
                                    margin: 0,
                                }}>
                                    {confirmState.title}
                                </h3>
                            </div>

                            <p style={{
                                fontSize: 14, color: '#6B7280',
                                lineHeight: 1.6, marginBottom: 24,
                                whiteSpace: 'pre-line',
                            }}>
                                {confirmState.message}
                            </p>

                            <div style={{ display: 'flex', gap: 10 }}>
                                <button
                                    onClick={() => handleConfirm(false)}
                                    style={{
                                        flex: 1, padding: '12px 16px',
                                        borderRadius: 12, border: '1px solid #E5E7EB',
                                        background: '#F9FAFB', color: '#374151',
                                        fontSize: 14, fontWeight: 600,
                                        cursor: 'pointer',
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleConfirm(true)}
                                    style={{
                                        flex: 1, padding: '12px 16px',
                                        borderRadius: 12, border: 'none',
                                        background: 'var(--gradient-primary, linear-gradient(135deg, #22C55E, #16A34A))',
                                        color: 'white',
                                        fontSize: 14, fontWeight: 600,
                                        cursor: 'pointer',
                                    }}
                                >
                                    Confirm
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </ToastContext.Provider>
    );
}

export const useToast = () => useContext(ToastContext);
