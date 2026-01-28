'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, ArrowLeft, Briefcase, User, Phone, Video, Home } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { subscribeToMessages } from '../lib/firebase';
import { StartProjectModal } from './ProjectsView';

// Chat list view
export function ChatListView({ chats = [], onChatSelect }) {
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
                    Match with someone to start chatting!
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
            <h2 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 22,
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: 16,
            }}>
                Messages
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {chats.map((chat, index) => {
                    const isCompany = chat?.matchedUserRole === 'COMPANY' || chat?.role === 'COMPANY';
                    const profile = chat?.matchedUserProfile || chat?.profile || {};
                    const name = chat?.matchedUserName || (isCompany ? profile.companyName : profile.name);
                    const image = profile.avatar || profile.portfolioImages?.[0];

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
                                border: '1px solid var(--border-light)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                        >
                            {/* Avatar */}
                            <div style={{
                                width: 52,
                                height: 52,
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

                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <h3 style={{
                                    fontSize: 15,
                                    fontWeight: 700,
                                    color: 'var(--text-primary)',
                                    marginBottom: 4,
                                }}>
                                    {name || 'Unknown'}
                                </h3>
                                <p style={{
                                    fontSize: 13,
                                    color: 'var(--text-muted)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}>
                                    {chat.lastMessage || 'Tap to start chatting...'}
                                </p>
                            </div>

                            {/* Time */}
                            <span style={{
                                fontSize: 11,
                                color: 'var(--text-muted)',
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
export function ChatView({ chat, onBack }) {
    const { user, sendMessage, getChatId } = useAuth();
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [sending, setSending] = useState(false);
    const [showProjectModal, setShowProjectModal] = useState(false);
    const messagesEndRef = useRef(null);

    const isSeeker = user?.role === 'SEEKER';

    // Get chat partner info
    const isCompany = chat?.matchedUserRole === 'COMPANY' || chat?.role === 'COMPANY';
    const profile = chat?.matchedUserProfile || chat?.profile || {};
    const name = chat?.matchedUserName || (isCompany ? profile.companyName : profile.name);
    const image = profile.avatar || profile.portfolioImages?.[0];
    const otherUserId = chat?.matchedUserId || chat?.id;

    // Generate chat ID
    const chatId = user && otherUserId ? getChatId(user.id, otherUserId) : null;

    // Subscribe to real-time messages
    useEffect(() => {
        if (!chatId) return;

        console.log('📡 Subscribing to messages for chat:', chatId);
        const unsubscribe = subscribeToMessages(chatId, (newMessages) => {
            console.log('📨 Received', newMessages.length, 'messages');
            setMessages(newMessages);
        });

        return () => {
            console.log('🔌 Unsubscribing from chat:', chatId);
            unsubscribe();
        };
    }, [chatId]);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!message.trim() || sending) return;

        setSending(true);
        const result = await sendMessage(otherUserId, message);
        if (result.success) {
            setMessage('');
        }
        setSending(false);
    };

    // Format message time
    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-secondary)',
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
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

                <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: isCompany ? 12 : '50%',
                    background: image ? `url(${image}) center/cover` : 'var(--pastel-green)',
                    border: '2px solid var(--pastel-mint)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                }}>
                    {!image && (isCompany ? <Briefcase size={18} color="var(--primary)" /> : <User size={18} color="var(--primary)" />)}
                </div>

                <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {name || 'Unknown'}
                    </h3>
                    <span style={{ fontSize: 12, color: 'var(--success)' }}>Online</span>
                </div>

                <motion.button whileTap={{ scale: 0.9 }} style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'var(--bg-secondary)', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}>
                    <Phone size={18} color="var(--text-secondary)" />
                </motion.button>
                <motion.button whileTap={{ scale: 0.9 }} style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'var(--bg-secondary)', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}>
                    <Video size={18} color="var(--text-secondary)" />
                </motion.button>

                {/* Start Project Button - only for seekers */}
                {isSeeker && (
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
                                    maxWidth: '75%',
                                }}
                            >
                                <div style={{
                                    padding: '12px 16px',
                                    borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                    background: isMe ? 'var(--gradient-primary)' : 'white',
                                    color: isMe ? 'white' : 'var(--text-primary)',
                                    boxShadow: 'var(--shadow-sm)',
                                }}>
                                    <p style={{ fontSize: 14, lineHeight: 1.4 }}>{msg.text}</p>
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
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{
                padding: '12px 16px 24px',
                background: 'white',
                borderTop: '1px solid var(--border-light)',
                display: 'flex',
                gap: 10,
            }}>
                <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Type a message..."
                    disabled={sending}
                    style={{
                        flex: 1,
                        padding: '14px 18px',
                        borderRadius: 24,
                        border: '1px solid var(--border)',
                        background: 'var(--bg-secondary)',
                        fontSize: 15,
                        outline: 'none',
                        opacity: sending ? 0.7 : 1,
                    }}
                />
                <motion.button
                    onClick={handleSend}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    disabled={sending || !message.trim()}
                    style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        background: 'var(--gradient-primary)',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: sending || !message.trim() ? 'not-allowed' : 'pointer',
                        boxShadow: 'var(--shadow-glow-soft)',
                        opacity: sending || !message.trim() ? 0.7 : 1,
                    }}
                >
                    <Send size={20} color="white" />
                </motion.button>
            </div>

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
        </div>
    );
}
