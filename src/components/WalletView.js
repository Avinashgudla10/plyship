'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { buildRazorpayOptions, openRazorpayCheckout } from '../utils/razorpayHelper';
import {
    Wallet, ArrowLeft, Plus, ArrowDownLeft, ArrowUpRight,
    Clock, CheckCircle, AlertCircle, Lock, Unlock, CreditCard,
    TrendingUp, IndianRupee, ChevronRight, Building2, User, X
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
export function TopUpModal({ onClose, onSuccess }) {
    const { user, topUpWallet, recoverPendingPayments } = useAuth();
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    // Track pending order for iOS recovery
    const pendingOrderRef = React.useRef(null);

    const presetAmounts = [500, 1000, 2000, 5000];

    // ── iOS Recovery: check if a pending payment completed ──
    // On iOS WKWebView, when the user switches to a UPI app and back,
    // the Razorpay handler callback may not fire. This function polls
    // the server to check if the Razorpay order was actually paid.
    const recoverPendingPayment = React.useCallback(async () => {
        const pending = pendingOrderRef.current;
        if (!pending || pending.recovered) return;

        try {
            const res = await fetch('/api/razorpay/verify-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: pending.orderId,
                    userId: user.id,
                }),
            });

            const data = await res.json();

            if (data.success && data.paymentId) {
                // Payment was captured — credit the wallet
                pending.recovered = true; // prevent duplicate credits
                const result = await topUpWallet(
                    data.amount,
                    data.paymentId,
                    data.orderId
                );

                if (result.success) {
                    onSuccess?.(data.amount);
                    onClose();
                } else {
                    setError('Payment received but wallet update failed. Contact support with payment ID: ' + data.paymentId);
                }
                setLoading(false);
            }
            // If not paid yet, do nothing — user may have genuinely cancelled
        } catch (err) {
            console.error('Payment recovery check failed:', err);
        }
    }, [user, topUpWallet, onSuccess, onClose]);

    // Listen for app resume / visibility change — triggers recovery on iOS
    React.useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'visible' && pendingOrderRef.current) {
                // Small delay to let Razorpay's own handler fire first if it's going to
                setTimeout(() => recoverPendingPayment(), 1500);
            }
        };

        const handleFocus = () => {
            if (pendingOrderRef.current) {
                setTimeout(() => recoverPendingPayment(), 1500);
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('focus', handleFocus);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('focus', handleFocus);
        };
    }, [recoverPendingPayment]);

    const handlePayment = async () => {
        const numAmount = parseInt(amount);
        if (!numAmount || numAmount < 500) {
            setError('Minimum top-up amount is ₹500');
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

            // Track the pending order for iOS recovery
            pendingOrderRef.current = {
                orderId: orderData.orderId,
                amount: numAmount,
                recovered: false,
            };

            // Persist to localStorage for cross-restart recovery
            try {
                localStorage.setItem(`plyship_pending_order_${user.id}`, JSON.stringify({
                    orderId: orderData.orderId,
                    amount: numAmount,
                    createdAt: Date.now(),
                }));
            } catch (e) { /* localStorage may be unavailable */ }

            // 2. Open Razorpay checkout (UPI-first, in-app)
            const options = buildRazorpayOptions({
                key: orderData.keyId,
                amount: orderData.amount,
                currency: orderData.currency,
                orderId: orderData.orderId,
                description: 'Service Deposit — Interior Consultation',
                prefill: {
                    name: user?.profile?.companyName || user?.profile?.name || '',
                    email: user?.email || '',
                },
                handler: async function (response) {
                    // Mark as recovered so the background check doesn't double-credit
                    if (pendingOrderRef.current) {
                        pendingOrderRef.current.recovered = true;
                    }
                    // Clear localStorage
                    try { localStorage.removeItem(`plyship_pending_order_${user.id}`); } catch (e) {}

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
                onDismiss: function () {
                    // On iOS, the handler may not have fired. Check the order.
                    // Delay to let any pending handler execute first.
                    if (pendingOrderRef.current && !pendingOrderRef.current.recovered) {
                        setTimeout(() => recoverPendingPayment(), 2000);
                    } else {
                        setLoading(false);
                    }
                },
            });

            openRazorpayCheckout(options);
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                        Top Up Wallet
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <X size={20} color="var(--text-muted)" />
                    </button>
                </div>

                {/* App Store compliance: deposit clarification */}
                <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 16, padding: '8px 10px', background: '#F0FDF4', borderRadius: 8, border: '1px solid #BBF7D0' }}>
                    Wallet funds are a refundable deposit used only for confirmed offline interior consultation meetings. Not used for digital goods.
                </p>

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

                {/* Pre-payment clarification */}
                <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 12 }}>
                    No charge until meeting is confirmed
                </p>

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
                    Secure payment powered by Razorpay. Deposit is fully refundable.
                </p>
            </motion.div>
        </motion.div>
    );
}

// ============ COMPANY WALLET VIEW ============
function CompanyWalletView({ onBack }) {
    const { user, getWallet, getTransactions, requestWithdrawal, getWithdrawals, recoverPendingPayments } = useAuth();
    const { showToast } = useToast();
    const [wallet, setWallet] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showTopUp, setShowTopUp] = useState(false);
    const [hasPendingWithdrawal, setHasPendingWithdrawal] = useState(false);
    const [withdrawRequesting, setWithdrawRequesting] = useState(false);

    const loadWalletData = async () => {
        const walletData = await getWallet();
        const txns = await getTransactions();
        // Check for existing pending withdrawal
        const wds = await getWithdrawals();
        setHasPendingWithdrawal(wds.some(w => w.status === 'PENDING' || w.status === 'PROCESSING'));
        setWallet(walletData);
        setTransactions(txns);
        setLoading(false);
    };

    useEffect(() => {
        loadWalletData();
        // Also run payment recovery when wallet page opens
        recoverPendingPayments?.();
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
                    <div style={{ fontSize: 11, opacity: 0.75, marginTop: 8, lineHeight: 1.4 }}>
                        Wallet funds are a refundable deposit for offline interior consultation meetings only.
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
                            Low balance! Top up your service deposit to continue scheduling offline meetings.
                        </span>
                    </motion.div>
                )}

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
                    {/* Top Up Button */}
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        style={{
                            flex: 1,
                            padding: 16,
                            borderRadius: 14,
                            background: 'var(--gradient-primary)',
                            border: 'none',
                            color: 'white',
                            fontSize: 15,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            cursor: 'pointer',
                            boxShadow: 'var(--shadow-glow-soft)',
                        }}
                        onClick={() => setShowTopUp(true)}
                    >
                        <Plus size={18} />
                        Top Up
                    </motion.button>

                    {/* Withdraw Button */}
                    <motion.button
                        whileHover={balance >= 500 && !hasPendingWithdrawal ? { scale: 1.02 } : {}}
                        whileTap={balance >= 500 && !hasPendingWithdrawal ? { scale: 0.98 } : {}}
                        disabled={balance < 500 || hasPendingWithdrawal || withdrawRequesting}
                        style={{
                            flex: 1,
                            padding: 16,
                            borderRadius: 14,
                            background: hasPendingWithdrawal
                                ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
                                : balance >= 500
                                    ? 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)'
                                    : '#E5E7EB',
                            border: 'none',
                            color: hasPendingWithdrawal || balance >= 500 ? 'white' : '#9CA3AF',
                            fontSize: 15,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            cursor: balance >= 500 && !hasPendingWithdrawal ? 'pointer' : 'not-allowed',
                        }}
                        onClick={async () => {
                            if (balance < 500 || hasPendingWithdrawal) return;
                            setWithdrawRequesting(true);
                            const result = await requestWithdrawal(balance);
                            if (result.success) {
                                setHasPendingWithdrawal(true);
                                showToast('Withdrawal request submitted! Admin will process it shortly.', 'success');
                            } else {
                                showToast(result.error, 'error');
                            }
                            setWithdrawRequesting(false);
                        }}
                    >
                        <ArrowUpRight size={18} />
                        {withdrawRequesting ? 'Requesting...' : hasPendingWithdrawal ? 'Withdraw Requested ✓' : 'Withdraw'}
                    </motion.button>
                </div>

                {hasPendingWithdrawal && (
                    <p style={{ fontSize: 12, color: '#D97706', textAlign: 'center', marginTop: -16, marginBottom: 20, fontWeight: 500 }}>
                        Your withdrawal is being processed by admin
                    </p>
                )}

                {!hasPendingWithdrawal && balance < 500 && balance > 0 && (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: -16, marginBottom: 20 }}>
                        Minimum withdrawal amount is ₹500
                    </p>
                )}

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
                            showToast(`Service deposit of ₹${amount} added successfully!`, 'success');
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
    const { user, getWallet, getTransactions, getProjects, requestWithdrawal, getWithdrawals } = useAuth();
    const { showToast } = useToast();
    const [wallet, setWallet] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [hasConfirmedProject, setHasConfirmedProject] = useState(false);
    const [loading, setLoading] = useState(true);
    const [hasPendingWithdrawal, setHasPendingWithdrawal] = useState(false);
    const [withdrawRequesting, setWithdrawRequesting] = useState(false);

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

            // Check for existing pending withdrawal
            const wds = await getWithdrawals();
            setHasPendingWithdrawal(wds.some(w => w.status === 'PENDING' || w.status === 'PROCESSING'));

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

    // Can only withdraw if: balance >= 250 AND (has accepted project OR wallet is unlocked) AND no pending withdrawal
    const canWithdraw = availableBalance >= 250 && hasConfirmedProject && !hasPendingWithdrawal && !withdrawRequesting;
    const hasBalanceButNoProject = availableBalance >= 250 && !hasConfirmedProject;

    // Withdrawal handler
    const handleWithdrawal = async () => {
        setWithdrawRequesting(true);
        const result = await requestWithdrawal(availableBalance);
        if (result.success) {
            setHasPendingWithdrawal(true);
            showToast('Withdrawal request submitted! Admin will process it shortly.', 'success');
        } else {
            showToast(result.error, 'error');
        }
        setWithdrawRequesting(false);
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
                    <div style={{ fontSize: 11, opacity: 0.75, marginTop: 8, lineHeight: 1.4 }}>
                        Earnings from confirmed offline interior consultation meetings.
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
                            Complete a project to unlock your earnings. Confirm an offline interior consultation to release locked funds.
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
                        background: hasPendingWithdrawal
                            ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
                            : canWithdraw
                                ? 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)'
                                : '#E5E7EB',
                        border: 'none',
                        color: hasPendingWithdrawal || canWithdraw ? 'white' : '#9CA3AF',
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
                    <ArrowUpRight size={20} />
                    {withdrawRequesting ? 'Requesting...' : hasPendingWithdrawal ? 'Withdraw Requested ✓' : 'Withdraw Earnings'}
                </motion.button>

                {hasPendingWithdrawal && (
                    <p style={{ fontSize: 12, color: '#D97706', textAlign: 'center', marginBottom: 12, fontWeight: 500 }}>
                        Your withdrawal is being processed by admin
                    </p>
                )}

                {/* Withdrawal policy notice */}
                <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5, marginBottom: 12, padding: '8px 10px', background: '#F0FDF4', borderRadius: 8, border: '1px solid #BBF7D0' }}>
                    Any unused amount is fully refundable. Withdrawals are processed after project confirmation to ensure genuine interactions.
                </p>

                {!hasPendingWithdrawal && !canWithdraw && availableBalance < 250 && (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 24 }}>
                        Minimum withdrawal amount is ₹250
                    </p>
                )}

                {hasBalanceButNoProject && (
                    <p style={{ fontSize: 12, color: '#D97706', textAlign: 'center', marginBottom: 24 }}>
                        Confirm a project with an Interior Company to enable withdrawals
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
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
            paddingBottom: '16px',
            paddingLeft: '20px',
            paddingRight: '20px',
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
            case 'MEETING_FEE': return 'Consultation Meeting Fee';
            case 'MEETING_EARNINGS': return 'Meeting Earnings';
            case 'TOP_UP': return 'Service Deposit';
            case 'WITHDRAWAL': return 'Balance Withdrawal';
            case 'REFUND': return 'Deposit Refund';
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
