'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import {
    Wallet, ArrowLeft, Plus, ArrowDownLeft, ArrowUpRight,
    Clock, CheckCircle, AlertCircle, Lock, Unlock, CreditCard,
    TrendingUp, IndianRupee, ChevronRight, Building2, User
} from 'lucide-react';

// Main Wallet View - Routes to appropriate view based on role
export default function WalletView({ onBack }) {
    const { user } = useAuth();
    const isCompany = user?.role === 'COMPANY';

    return isCompany ? (
        <CompanyWalletView onBack={onBack} />
    ) : (
        <SeekerWalletView onBack={onBack} />
    );
}

// ============ COMPANY WALLET VIEW ============
function CompanyWalletView({ onBack }) {
    const { getWallet, getTransactions } = useAuth();
    const [wallet, setWallet] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadWalletData = async () => {
            const walletData = await getWallet();
            const txns = await getTransactions();
            setWallet(walletData);
            setTransactions(txns);
            setLoading(false);
        };
        loadWalletData();
    }, [getWallet, getTransactions]);

    if (loading) {
        return <LoadingView />;
    }

    const balance = wallet?.balance || 0;
    const meetingsAvailable = Math.floor(balance / 500);
    const isLowBalance = balance < 1000;

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)' }}>
            {/* Header */}
            <Header title="Company Wallet" onBack={onBack} />

            {/* Scrollable Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                {/* Balance Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                        borderRadius: 20,
                        padding: 24,
                        color: 'white',
                        marginBottom: 20,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <Wallet size={20} />
                        <span style={{ fontSize: 14, opacity: 0.9 }}>Available Balance</span>
                    </div>
                    <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 4 }}>
                        ₹{balance.toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.85 }}>
                        {meetingsAvailable} meetings available
                    </div>
                </motion.div>

                {/* Low Balance Warning */}
                {isLowBalance && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: 14,
                            borderRadius: 12,
                            background: '#FEF3C7',
                            border: '1px solid #F59E0B',
                            marginBottom: 20,
                        }}
                    >
                        <AlertCircle size={20} color="#D97706" />
                        <span style={{ fontSize: 13, color: '#92400E' }}>
                            Low balance! Top up to continue scheduling meetings.
                        </span>
                    </motion.div>
                )}

                {/* Top Up Button */}
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                        width: '100%',
                        padding: 16,
                        borderRadius: 14,
                        background: 'var(--gradient-primary)',
                        border: 'none',
                        color: 'white',
                        fontSize: 16,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        marginBottom: 24,
                        boxShadow: 'var(--shadow-glow-soft)',
                    }}
                    onClick={() => alert('Razorpay integration coming soon!')}
                >
                    <Plus size={20} />
                    Top Up Wallet
                </motion.button>

                {/* Quick Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                    <StatCard
                        icon={TrendingUp}
                        label="Total Spent"
                        value={`₹${(wallet?.totalSpent || 0).toLocaleString('en-IN')}`}
                    />
                    <StatCard
                        icon={Building2}
                        label="Meetings"
                        value={Math.floor((wallet?.totalSpent || 0) / 500)}
                    />
                </div>

                {/* Transactions */}
                <TransactionsList transactions={transactions} />
            </div>
        </div>
    );
}

// ============ SEEKER WALLET VIEW ============
function SeekerWalletView({ onBack }) {
    const { getWallet, getTransactions } = useAuth();
    const [wallet, setWallet] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadWalletData = async () => {
            const walletData = await getWallet();
            const txns = await getTransactions();
            setWallet(walletData);
            setTransactions(txns);
            setLoading(false);
        };
        loadWalletData();
    }, [getWallet, getTransactions]);

    if (loading) {
        return <LoadingView />;
    }

    const availableBalance = wallet?.balance || 0;
    const lockedBalance = wallet?.lockedBalance || 0;
    const totalEarnings = wallet?.totalEarnings || 0;
    const canWithdraw = availableBalance >= 500;

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)' }}>
            {/* Header */}
            <Header title="My Earnings" onBack={onBack} />

            {/* Scrollable Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                {/* Available Balance Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                        borderRadius: 20,
                        padding: 24,
                        color: 'white',
                        marginBottom: 16,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <Unlock size={20} />
                        <span style={{ fontSize: 14, opacity: 0.9 }}>Available to Withdraw</span>
                    </div>
                    <div style={{ fontSize: 36, fontWeight: 800 }}>
                        ₹{availableBalance.toLocaleString('en-IN')}
                    </div>
                </motion.div>

                {/* Locked Balance Card */}
                {lockedBalance > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        style={{
                            background: 'white',
                            borderRadius: 16,
                            padding: 20,
                            border: '1px solid var(--border)',
                            marginBottom: 16,
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <Lock size={18} color="#F59E0B" />
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Locked Earnings</span>
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                            ₹{lockedBalance.toLocaleString('en-IN')}
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                            Complete a project to unlock your earnings. Select a company, pay the advance, and get confirmation.
                        </p>
                    </motion.div>
                )}

                {/* Withdraw Button */}
                <motion.button
                    whileHover={canWithdraw ? { scale: 1.02 } : {}}
                    whileTap={canWithdraw ? { scale: 0.98 } : {}}
                    disabled={!canWithdraw}
                    style={{
                        width: '100%',
                        padding: 16,
                        borderRadius: 14,
                        background: canWithdraw ? 'var(--gradient-primary)' : '#E5E7EB',
                        border: 'none',
                        color: canWithdraw ? 'white' : '#9CA3AF',
                        fontSize: 16,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        cursor: canWithdraw ? 'pointer' : 'not-allowed',
                        marginBottom: 24,
                    }}
                    onClick={() => canWithdraw && alert('Withdrawal feature coming soon!')}
                >
                    <CreditCard size={20} />
                    Withdraw to Bank
                </motion.button>

                {/* Quick Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                    <StatCard
                        icon={TrendingUp}
                        label="Total Earnings"
                        value={`₹${totalEarnings.toLocaleString('en-IN')}`}
                    />
                    <StatCard
                        icon={User}
                        label="Meetings"
                        value={Math.floor(totalEarnings / 500)}
                    />
                </div>

                {/* Transactions */}
                <TransactionsList transactions={transactions} />
            </div>
        </div>
    );
}

// ============ SHARED COMPONENTS ============

function Header({ title, onBack }) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '16px 20px',
            background: 'white',
            borderBottom: '1px solid var(--border-light)',
        }}>
            <motion.button
                onClick={onBack}
                whileTap={{ scale: 0.9 }}
                style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'var(--bg-secondary)', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                }}
            >
                <ArrowLeft size={20} color="var(--text-secondary)" />
            </motion.button>
            <h2 style={{ flex: 1, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                {title}
            </h2>
        </div>
    );
}

function LoadingView() {
    return (
        <div style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-secondary)',
        }}>
            <div style={{ textAlign: 'center' }}>
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    style={{ marginBottom: 12 }}
                >
                    <Wallet size={32} color="var(--primary)" />
                </motion.div>
                <p style={{ color: 'var(--text-muted)' }}>Loading wallet...</p>
            </div>
        </div>
    );
}

function StatCard({ icon: Icon, label, value }) {
    return (
        <div style={{
            padding: 16,
            borderRadius: 14,
            background: 'white',
            border: '1px solid var(--border-light)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Icon size={16} color="var(--primary)" />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                {value}
            </div>
        </div>
    );
}

function TransactionsList({ transactions }) {
    if (transactions.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: 32 }}>
                <Clock size={32} color="var(--text-muted)" style={{ marginBottom: 8 }} />
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No transactions yet</p>
            </div>
        );
    }

    return (
        <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12 }}>
                Recent Transactions
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {transactions.map((txn) => (
                    <TransactionItem key={txn.id} transaction={txn} />
                ))}
            </div>
        </div>
    );
}

function TransactionItem({ transaction }) {
    const isCredit = transaction.type === 'CREDIT' || transaction.type === 'UNLOCK';
    const isLock = transaction.type === 'LOCK';

    const getColor = () => {
        if (isLock) return '#F59E0B';
        return isCredit ? '#22C55E' : '#EF4444';
    };

    const color = getColor();

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    };

    const getReasonLabel = (reason) => {
        switch (reason) {
            case 'MEETING_FEE': return 'Meeting Fee';
            case 'MEETING_EARNINGS': return 'Meeting Reward';
            case 'TOP_UP': return 'Wallet Top Up';
            case 'WITHDRAWAL': return 'Bank Withdrawal';
            case 'REFUND': return 'Refund';
            default: return reason || 'Transaction';
        }
    };

    // Render the appropriate icon based on transaction type
    const renderIcon = () => {
        if (isLock) {
            return <Lock size={18} color={color} />;
        }
        return isCredit ?
            <ArrowDownLeft size={18} color={color} /> :
            <ArrowUpRight size={18} color={color} />;
    };

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: 14,
            borderRadius: 12,
            background: 'white',
            border: '1px solid var(--border-light)',
        }}>
            <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: `${color}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                {renderIcon()}
            </div>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {getReasonLabel(transaction.reason)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {formatDate(transaction.createdAt)}
                </div>
            </div>
            <div style={{
                fontSize: 15,
                fontWeight: 700,
                color: color,
            }}>
                {isCredit ? '+' : '-'}₹{Math.abs(transaction.amount).toLocaleString('en-IN')}
            </div>
        </div>
    );
}
