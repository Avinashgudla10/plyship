'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
    Wallet, ArrowLeft, Plus, ArrowDownLeft, ArrowUpRight,
    Clock, CheckCircle, AlertCircle, Lock, Unlock, CreditCard,
    TrendingUp, IndianRupee, ChevronRight, Building2, User, X, MessageCircle
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

// ============ TOP UP MODAL ============
function TopUpModal({ onClose, onSuccess }) {
    const { user, topUpWallet } = useAuth();
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const presetAmounts = [500, 1000, 2000, 5000];

    const handlePayment = async () => {
        const numAmount = parseInt(amount);
        if (!numAmount || numAmount < 100) {
            setError('Minimum top-up amount is ₹100');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // 1. Create order on server
            const orderRes = await fetch('/api/razorpay/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: numAmount, userId: user.id }),
            });

            const orderData = await orderRes.json();

            if (!orderData.success) {
                throw new Error(orderData.error || 'Failed to create order');
            }

            // 2. Open Razorpay checkout
            const options = {
                key: orderData.keyId,
                amount: orderData.amount,
                currency: orderData.currency,
                name: 'Plyship',
                description: 'Wallet Top Up',
                order_id: orderData.orderId,
                handler: async function (response) {
                    // 3. Verify payment on server
                    const verifyRes = await fetch('/api/razorpay/verify-payment', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            userId: user.id,
                            amount: numAmount,
                        }),
                    });

                    const verifyData = await verifyRes.json();

                    if (verifyData.success) {
                        // 4. Update wallet in Firebase
                        const result = await topUpWallet(
                            numAmount,
                            response.razorpay_payment_id,
                            response.razorpay_order_id
                        );

                        if (result.success) {
                            onSuccess?.(numAmount);
                            onClose();
                        } else {
                            setError('Payment successful but wallet update failed. Contact support.');
                        }
                    } else {
                        setError('Payment verification failed');
                    }
                    setLoading(false);
                },
                prefill: {
                    name: user?.profile?.companyName || user?.profile?.name || '',
                    email: user?.email || '',
                },
                theme: {
                    color: '#22C55E',
                },
                modal: {
                    ondismiss: function () {
                        setLoading(false);
                    },
                },
            };

            // Load Razorpay script dynamically
            if (!window.Razorpay) {
                const script = document.createElement('script');
                script.src = 'https://checkout.razorpay.com/v1/checkout.js';
                script.async = true;
                document.body.appendChild(script);
                script.onload = () => {
                    const rzp = new window.Razorpay(options);
                    rzp.open();
                };
            } else {
                const rzp = new window.Razorpay(options);
                rzp.open();
            }
        } catch (err) {
            console.error('Payment error:', err);
            setError(err.message || 'Payment failed. Please try again.');
            setLoading(false);
        }
    };

    return (
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
                padding: 20,
                zIndex: 100,
            }}
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                style={{
                    width: '100%',
                    maxWidth: 400,
                    background: 'white',
                    borderRadius: 20,
                    padding: 24,
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                        Top Up Wallet
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <X size={20} color="var(--text-muted)" />
                    </button>
                </div>

                {/* Preset Amounts */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
                    {presetAmounts.map((preset) => (
                        <motion.button
                            key={preset}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setAmount(preset.toString())}
                            style={{
                                padding: '12px 8px',
                                borderRadius: 10,
                                background: amount === preset.toString() ? 'var(--primary)' : 'var(--bg-secondary)',
                                border: amount === preset.toString() ? 'none' : '1px solid var(--border)',
                                color: amount === preset.toString() ? 'white' : 'var(--text-primary)',
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            ₹{preset}
                        </motion.button>
                    ))}
                </div>

                {/* Custom Amount */}
                <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
                        Or enter custom amount
                    </label>
                    <div style={{ position: 'relative' }}>
                        <span style={{
                            position: 'absolute',
                            left: 14,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--text-muted)',
                            fontSize: 16,
                        }}>₹</span>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="Enter amount"
                            style={{
                                width: '100%',
                                padding: '14px 14px 14px 32px',
                                borderRadius: 12,
                                border: '1px solid var(--border)',
                                fontSize: 16,
                                fontWeight: 600,
                            }}
                        />
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div style={{
                        padding: 12,
                        borderRadius: 10,
                        background: '#FEE2E2',
                        color: '#DC2626',
                        fontSize: 13,
                        marginBottom: 16,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                    }}>
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                {/* Pay Button */}
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handlePayment}
                    disabled={loading || !amount}
                    style={{
                        width: '100%',
                        padding: 16,
                        borderRadius: 14,
                        background: loading || !amount ? '#E5E7EB' : 'var(--gradient-primary)',
                        border: 'none',
                        color: loading || !amount ? '#9CA3AF' : 'white',
                        fontSize: 16,
                        fontWeight: 700,
                        cursor: loading || !amount ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                    }}
                >
                    {loading ? (
                        <>Processing...</>
                    ) : (
                        <>
                            <CreditCard size={20} />
                            Pay ₹{amount || '0'}
                        </>
                    )}
                </motion.button>

                <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 12 }}>
                    Secure payment powered by Razorpay
                </p>
            </motion.div>
        </motion.div>
    );
}

// ============ COMPANY WALLET VIEW ============
function CompanyWalletView({ onBack }) {
    const { getWallet, getTransactions } = useAuth();
    const { showToast } = useToast();
    const [wallet, setWallet] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showTopUp, setShowTopUp] = useState(false);

    const loadWalletData = async () => {
        const walletData = await getWallet();
        const txns = await getTransactions();
        setWallet(walletData);
        setTransactions(txns);
        setLoading(false);
    };

    useEffect(() => {
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
                    onClick={() => setShowTopUp(true)}
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

            {/* Top Up Modal */}
            <AnimatePresence>
                {showTopUp && (
                    <TopUpModal
                        onClose={() => setShowTopUp(false)}
                        onSuccess={(amount) => {
                            showToast(`Wallet topped up with ₹${amount}!`, 'success');
                            loadWalletData();
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// ============ SEEKER WALLET VIEW ============
function SeekerWalletView({ onBack }) {
    const { user, getWallet, getTransactions, getProjects, requestWithdrawal } = useAuth();
    const { showToast } = useToast();
    const [wallet, setWallet] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [hasConfirmedProject, setHasConfirmedProject] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadWalletData = async () => {
            const walletData = await getWallet();
            const txns = await getTransactions();
            const projects = await getProjects();

            // Check if user has at least one ACCEPTED project (or wallet explicitly unlocked)
            const acceptedProject = projects.find(p => p.status === 'ACCEPTED' || p.status === 'CONFIRMED' || p.status === 'COMPLETED');
            // Also check if wallet isLocked field is explicitly false
            const walletUnlocked = walletData?.isLocked === false;
            setHasConfirmedProject(!!acceptedProject || walletUnlocked);

            setWallet(walletData);
            setTransactions(txns);
            setLoading(false);
        };
        loadWalletData();
    }, [getWallet, getTransactions, getProjects]);

    if (loading) {
        return <LoadingView />;
    }

    const availableBalance = wallet?.balance || 0;
    const lockedBalance = wallet?.lockedBalance || 0;
    const totalEarnings = wallet?.totalEarnings || 0;

    // Can only withdraw if: balance >= 250 AND (has accepted project OR wallet is unlocked)
    const canWithdraw = availableBalance >= 250 && hasConfirmedProject;
    const hasBalanceButNoProject = availableBalance >= 250 && !hasConfirmedProject;

    // WhatsApp withdrawal handler
    const handleWithdrawal = async () => {
        // Create withdrawal record in Firestore for admin tracking
        const result = await requestWithdrawal(availableBalance);
        if (!result.success) {
            showToast(result.error, 'error');
            return;
        }

        const userName = user?.profile?.name || 'User';
        const phone = '918465834152'; // WhatsApp number with country code
        const message = encodeURIComponent(
            `Hi, I would like to withdraw ₹${availableBalance} from my Plyship wallet.\n\n` +
            `Name: ${userName}\n` +
            `Amount: ₹${availableBalance}\n` +
            `Email: ${user?.email || 'N/A'}`
        );

        window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
    };

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

                {/* Project Required Notice */}
                {hasBalanceButNoProject && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        style={{
                            background: '#FEF3C7',
                            borderRadius: 16,
                            padding: 20,
                            border: '1px solid #F59E0B',
                            marginBottom: 16,
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <AlertCircle size={18} color="#D97706" />
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#92400E' }}>Project Confirmation Required</span>
                        </div>
                        <p style={{ fontSize: 13, color: '#92400E', lineHeight: 1.5 }}>
                            To withdraw your earnings, you need to confirm at least one project with an Interior Company.
                            Start a project from your connections to unlock withdrawals.
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
                        background: canWithdraw ? 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)' : '#E5E7EB',
                        border: 'none',
                        color: canWithdraw ? 'white' : '#9CA3AF',
                        fontSize: 16,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        cursor: canWithdraw ? 'pointer' : 'not-allowed',
                        marginBottom: 12,
                    }}
                    onClick={() => canWithdraw && handleWithdrawal()}
                >
                    <MessageCircle size={20} />
                    Withdraw via WhatsApp
                </motion.button>

                {!canWithdraw && availableBalance < 250 && (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 24 }}>
                        Minimum withdrawal amount is ₹250
                    </p>
                )}

                {hasBalanceButNoProject && (
                    <p style={{ fontSize: 12, color: '#D97706', textAlign: 'center', marginBottom: 24 }}>
                        Confirm a project with an Interior Company to enable withdrawals
                    </p>
                )}

                {canWithdraw && (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 24 }}>
                        You'll be redirected to WhatsApp to request withdrawal
                    </p>
                )}

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
                        value={Math.floor(totalEarnings / 250)}
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
