'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { uploadImage } from '../lib/firebase';
import {
    Home, ArrowLeft, Clock, CheckCircle, XCircle, AlertCircle,
    User, Building2, ChevronRight, Plus, X, IndianRupee, Upload,
    FileText, Calendar, Lock, Unlock, Camera
} from 'lucide-react';

// Main Projects View
export default function ProjectsView({ onBack }) {
    const { user, getProjects } = useAuth();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedProject, setSelectedProject] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const isCompany = user?.role === 'COMPANY';

    useEffect(() => {
        let isMounted = true;

        const fetchProjects = async () => {
            setLoading(true);
            const data = await getProjects();
            if (isMounted) {
                setProjects(data);
                setLoading(false);
            }
        };

        fetchProjects();

        return () => {
            isMounted = false;
        };
    }, [getProjects, refreshKey]);

    const refreshProjects = () => {
        setRefreshKey(prev => prev + 1);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'PENDING_ACCEPTANCE': return '#F59E0B';
            case 'ACCEPTED': return '#3B82F6';
            case 'ADVANCE_RECORDED': return '#8B5CF6';
            case 'CONFIRMED': return '#22C55E';
            case 'COMPLETED': return '#22C55E';
            default: return '#6B7280';
        }
    };

    const getStatusText = (status) => {
        switch (status) {
            case 'PENDING_ACCEPTANCE': return 'Pending Acceptance';
            case 'ACCEPTED': return 'Accepted';
            case 'ADVANCE_RECORDED': return 'Advance Recorded';
            case 'CONFIRMED': return 'Confirmed';
            case 'COMPLETED': return 'Completed';
            default: return status;
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    if (loading) {
        return (
            <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-secondary)',
            }}>
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                    <Home size={32} color="var(--primary)" />
                </motion.div>
            </div>
        );
    }

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)' }}>
            {/* Header */}
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
                    My Projects
                </h2>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                {/* Info Card */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 14,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #E0F2FE 0%, #DBEAFE 100%)',
                    border: '1px solid #BFDBFE',
                    marginBottom: 20,
                }}>
                    <Home size={20} color="#2563EB" />
                    <span style={{ fontSize: 13, color: '#1E40AF' }}>
                        {isCompany
                            ? 'Accept projects and confirm advance payments to help seekers unlock their earnings'
                            : 'Start a project with a company to unlock your meeting earnings'
                        }
                    </span>
                </div>

                {projects.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40 }}>
                        <Home size={48} color="var(--text-muted)" style={{ marginBottom: 12 }} />
                        <p style={{ color: 'var(--text-muted)', marginBottom: 8 }}>No projects yet</p>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                            {isCompany
                                ? 'Seekers will send you project requests after meetings'
                                : 'Start a project with a company from the chat screen'
                            }
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {projects.map((project) => (
                            <ProjectCard
                                key={project.id}
                                project={project}
                                isCompany={isCompany}
                                onSelect={() => setSelectedProject(project)}
                                getStatusColor={getStatusColor}
                                getStatusText={getStatusText}
                                formatDate={formatDate}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Project Detail Modal */}
            <AnimatePresence>
                {selectedProject && (
                    <ProjectDetailModal
                        project={selectedProject}
                        isCompany={isCompany}
                        onClose={() => setSelectedProject(null)}
                        onRefresh={refreshProjects}
                        getStatusColor={getStatusColor}
                        getStatusText={getStatusText}
                        formatDate={formatDate}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// Project Card Component
function ProjectCard({ project, isCompany, onSelect, getStatusColor, getStatusText, formatDate }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={onSelect}
            style={{
                padding: 16,
                borderRadius: 14,
                background: 'white',
                border: '1px solid var(--border-light)',
                cursor: 'pointer',
            }}
        >
            {/* Status Badge */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
            }}>
                <span style={{
                    padding: '4px 10px',
                    borderRadius: 8,
                    background: `${getStatusColor(project.status)}20`,
                    color: getStatusColor(project.status),
                    fontSize: 12,
                    fontWeight: 600,
                }}>
                    {getStatusText(project.status)}
                </span>
                <ChevronRight size={18} color="var(--text-muted)" />
            </div>

            {/* Project Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                {isCompany ? <User size={16} color="var(--text-muted)" /> : <Building2 size={16} color="var(--text-muted)" />}
                <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>
                    {isCompany ? 'Seeker Project' : 'My Interior Project'}
                </span>
            </div>

            {/* Date */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={14} color="var(--text-muted)" />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Started {formatDate(project.createdAt)}
                </span>
            </div>

            {/* Advance Amount if exists */}
            {project.advanceAmount && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 10,
                    padding: '6px 10px',
                    borderRadius: 8,
                    background: 'var(--pastel-green)',
                }}>
                    <IndianRupee size={14} color="var(--primary)" />
                    <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                        Advance: ₹{project.advanceAmount.toLocaleString('en-IN')}
                    </span>
                </div>
            )}
        </motion.div>
    );
}

// Project Detail Modal
function ProjectDetailModal({ project, isCompany, onClose, onRefresh, getStatusColor, getStatusText, formatDate }) {
    const { acceptProject, recordAdvancePayment, confirmAdvancePayment } = useAuth();
    const [loading, setLoading] = useState(false);
    const [showPaymentForm, setShowPaymentForm] = useState(false);

    const handleAccept = async () => {
        setLoading(true);
        const result = await acceptProject(project.id);
        setLoading(false);

        if (result.success) {
            alert('✅ Project accepted!');
            onRefresh();
            onClose();
        } else {
            alert('Error: ' + result.error);
        }
    };

    const handleConfirmAdvance = async () => {
        setLoading(true);
        const result = await confirmAdvancePayment(project.id);
        setLoading(false);

        if (result.success) {
            alert('🎉 Advance confirmed! Seeker\'s earnings have been unlocked.');
            onRefresh();
            onClose();
        } else {
            alert('Error: ' + result.error);
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
                    maxHeight: '80vh',
                    background: 'white',
                    borderRadius: 20,
                    padding: 24,
                    overflow: 'auto',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                        Project Details
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <X size={20} color="var(--text-muted)" />
                    </button>
                </div>

                {/* Status */}
                <div style={{
                    padding: 14,
                    borderRadius: 12,
                    background: `${getStatusColor(project.status)}10`,
                    marginBottom: 16,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {project.status === 'CONFIRMED' ? <Unlock size={18} color={getStatusColor(project.status)} /> : <Lock size={18} color={getStatusColor(project.status)} />}
                        <span style={{ fontSize: 14, fontWeight: 600, color: getStatusColor(project.status) }}>
                            {getStatusText(project.status)}
                        </span>
                    </div>
                </div>

                {/* Timeline */}
                <div style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>TIMELINE</p>

                    <TimelineItem
                        label="Project Created"
                        date={formatDate(project.createdAt)}
                        completed={true}
                    />
                    <TimelineItem
                        label="Company Accepted"
                        date={project.acceptedAt ? formatDate(project.acceptedAt) : null}
                        completed={project.status !== 'PENDING_ACCEPTANCE'}
                    />
                    <TimelineItem
                        label="Advance Recorded"
                        date={project.advanceDate ? formatDate(project.advanceDate) : null}
                        completed={['ADVANCE_RECORDED', 'CONFIRMED', 'COMPLETED'].includes(project.status)}
                        amount={project.advanceAmount}
                    />
                    <TimelineItem
                        label="Advance Confirmed"
                        date={project.confirmedAt ? formatDate(project.confirmedAt) : null}
                        completed={['CONFIRMED', 'COMPLETED'].includes(project.status)}
                        isLast
                    />
                </div>

                {/* Actions based on status and role */}
                {isCompany && project.status === 'PENDING_ACCEPTANCE' && (
                    <motion.button
                        onClick={handleAccept}
                        disabled={loading}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        style={{
                            width: '100%',
                            padding: 14,
                            borderRadius: 12,
                            background: loading ? '#E5E7EB' : 'var(--gradient-primary)',
                            border: 'none',
                            color: loading ? '#9CA3AF' : 'white',
                            fontSize: 15,
                            fontWeight: 600,
                            cursor: loading ? 'wait' : 'pointer',
                        }}
                    >
                        {loading ? 'Accepting...' : 'Accept Project'}
                    </motion.button>
                )}

                {!isCompany && project.status === 'ACCEPTED' && (
                    showPaymentForm ? (
                        <AdvancePaymentForm
                            projectId={project.id}
                            onSuccess={() => {
                                onRefresh();
                                onClose();
                            }}
                            onCancel={() => setShowPaymentForm(false)}
                        />
                    ) : (
                        <motion.button
                            onClick={() => setShowPaymentForm(true)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            style={{
                                width: '100%',
                                padding: 14,
                                borderRadius: 12,
                                background: 'var(--gradient-primary)',
                                border: 'none',
                                color: 'white',
                                fontSize: 15,
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            Record Advance Payment
                        </motion.button>
                    )
                )}

                {isCompany && project.status === 'ADVANCE_RECORDED' && (
                    <div>
                        {/* Show advance details */}
                        <div style={{
                            padding: 14,
                            borderRadius: 12,
                            background: 'var(--pastel-green)',
                            marginBottom: 16,
                        }}>
                            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>ADVANCE PAYMENT DETAILS</p>
                            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)' }}>
                                ₹{project.advanceAmount?.toLocaleString('en-IN')}
                            </p>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                                Date: {formatDate(project.advanceDate)}
                            </p>
                            {project.advanceProofUrl && (
                                <a
                                    href={project.advanceProofUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ fontSize: 13, color: 'var(--primary)', marginTop: 8, display: 'inline-block' }}
                                >
                                    View Payment Proof →
                                </a>
                            )}
                        </div>

                        <motion.button
                            onClick={handleConfirmAdvance}
                            disabled={loading}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            style={{
                                width: '100%',
                                padding: 14,
                                borderRadius: 12,
                                background: loading ? '#E5E7EB' : 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                                border: 'none',
                                color: loading ? '#9CA3AF' : 'white',
                                fontSize: 15,
                                fontWeight: 600,
                                cursor: loading ? 'wait' : 'pointer',
                            }}
                        >
                            {loading ? 'Confirming...' : 'Confirm Advance Received'}
                        </motion.button>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 10 }}>
                            This will unlock the seeker&apos;s meeting earnings
                        </p>
                    </div>
                )}

                {project.status === 'CONFIRMED' && (
                    <div style={{
                        padding: 16,
                        borderRadius: 12,
                        background: 'linear-gradient(135deg, #DCFCE7 0%, #D1FAE5 100%)',
                        textAlign: 'center',
                    }}>
                        <CheckCircle size={32} color="#16A34A" style={{ marginBottom: 8 }} />
                        <p style={{ fontSize: 14, fontWeight: 600, color: '#166534' }}>
                            Project Confirmed!
                        </p>
                        <p style={{ fontSize: 12, color: '#15803D', marginTop: 4 }}>
                            {isCompany ? 'Thank you for confirming the advance payment' : 'Your earnings have been unlocked!'}
                        </p>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}

// Timeline Item Component
function TimelineItem({ label, date, completed, amount, isLast }) {
    return (
        <div style={{ display: 'flex', gap: 12, marginBottom: isLast ? 0 : 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: completed ? '#22C55E' : '#E5E7EB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    {completed && <CheckCircle size={12} color="white" />}
                </div>
                {!isLast && (
                    <div style={{
                        width: 2,
                        flex: 1,
                        minHeight: 20,
                        background: completed ? '#22C55E' : '#E5E7EB',
                    }} />
                )}
            </div>
            <div style={{ flex: 1, paddingBottom: isLast ? 0 : 12 }}>
                <p style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: completed ? 'var(--text-primary)' : 'var(--text-muted)',
                }}>
                    {label}
                </p>
                {date && (
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {date}
                    </p>
                )}
                {amount && (
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)', marginTop: 2 }}>
                        ₹{amount.toLocaleString('en-IN')}
                    </p>
                )}
            </div>
        </div>
    );
}

// Advance Payment Form
function AdvancePaymentForm({ projectId, onSuccess, onCancel }) {
    const { recordAdvancePayment } = useAuth();
    const [amount, setAmount] = useState('');
    const [paymentDate, setPaymentDate] = useState('');
    const [proofImage, setProofImage] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProofImage(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async () => {
        if (!amount || !paymentDate) {
            alert('Please fill in amount and date');
            return;
        }

        setSubmitting(true);

        let proofUrl = null;
        if (proofImage) {
            try {
                setUploading(true);
                proofUrl = await uploadImage(proofImage, `projects/${projectId}/advance_proof_${Date.now()}.jpg`);
                setUploading(false);
            } catch (error) {
                console.error('Error uploading proof:', error);
                setUploading(false);
            }
        }

        const result = await recordAdvancePayment(projectId, parseFloat(amount), paymentDate, proofUrl);
        setSubmitting(false);

        if (result.success) {
            alert('✅ Advance payment recorded! Waiting for company confirmation.');
            onSuccess();
        } else {
            alert('Error: ' + result.error);
        }
    };

    return (
        <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>
                RECORD ADVANCE PAYMENT
            </p>

            <label style={{ display: 'block', marginBottom: 14 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
                    Amount (₹)
                </span>
                <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g., 150000"
                    style={{
                        width: '100%',
                        padding: 12,
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        fontSize: 15,
                    }}
                />
            </label>

            <label style={{ display: 'block', marginBottom: 14 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
                    Payment Date
                </span>
                <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    style={{
                        width: '100%',
                        padding: 12,
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        fontSize: 15,
                    }}
                />
            </label>

            <label style={{ display: 'block', marginBottom: 16 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
                    Payment Proof (optional)
                </span>
                <div
                    style={{
                        width: '100%',
                        padding: 20,
                        borderRadius: 10,
                        border: '2px dashed var(--border)',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: proofImage ? '#F0FDF4' : 'transparent',
                    }}
                >
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        style={{ display: 'none' }}
                        id="proof-upload"
                    />
                    <label htmlFor="proof-upload" style={{ cursor: 'pointer' }}>
                        {proofImage ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                <CheckCircle size={18} color="#22C55E" />
                                <span style={{ fontSize: 13, color: '#16A34A' }}>Image selected</span>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                <Camera size={18} color="var(--text-muted)" />
                                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Upload payment screenshot</span>
                            </div>
                        )}
                    </label>
                </div>
            </label>

            <div style={{ display: 'flex', gap: 10 }}>
                <motion.button
                    onClick={onCancel}
                    whileTap={{ scale: 0.98 }}
                    style={{
                        flex: 1,
                        padding: 12,
                        borderRadius: 10,
                        background: 'var(--bg-secondary)',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                    }}
                >
                    Cancel
                </motion.button>
                <motion.button
                    onClick={handleSubmit}
                    disabled={submitting || uploading}
                    whileTap={{ scale: 0.98 }}
                    style={{
                        flex: 2,
                        padding: 12,
                        borderRadius: 10,
                        background: (submitting || uploading) ? '#E5E7EB' : 'var(--gradient-primary)',
                        border: 'none',
                        color: (submitting || uploading) ? '#9CA3AF' : 'white',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: (submitting || uploading) ? 'wait' : 'pointer',
                    }}
                >
                    {uploading ? 'Uploading...' : submitting ? 'Recording...' : 'Submit'}
                </motion.button>
            </div>
        </div>
    );
}

// Start Project Modal - for initiating a project from chat/matches
export function StartProjectModal({ match, onClose, onSuccess }) {
    const { createProject } = useAuth();
    const [description, setDescription] = useState('');
    const [budgetRange, setBudgetRange] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const budgetOptions = [
        '₹1-3 Lakhs',
        '₹3-5 Lakhs',
        '₹5-10 Lakhs',
        '₹10-20 Lakhs',
        '₹20+ Lakhs',
    ];

    const handleSubmit = async () => {
        setSubmitting(true);
        const result = await createProject(match.id, { description, budgetRange });
        setSubmitting(false);

        if (result.success) {
            alert('✅ Project request sent! Waiting for company to accept.');
            onSuccess?.();
            onClose();
        } else {
            alert('Error: ' + result.error);
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
                        Start Project
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <X size={20} color="var(--text-muted)" />
                    </button>
                </div>

                {/* Info */}
                <div style={{
                    padding: 12,
                    borderRadius: 10,
                    background: 'var(--pastel-green)',
                    marginBottom: 20,
                }}>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        Starting a project will send a request to the company. Once they accept and you record your advance payment, your meeting earnings will be unlocked.
                    </p>
                </div>

                {/* Budget Range */}
                <label style={{ display: 'block', marginBottom: 16 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, display: 'block' }}>
                        Estimated Budget
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {budgetOptions.map((option) => (
                            <motion.button
                                key={option}
                                onClick={() => setBudgetRange(option)}
                                whileTap={{ scale: 0.95 }}
                                style={{
                                    padding: '8px 14px',
                                    borderRadius: 20,
                                    border: 'none',
                                    background: budgetRange === option ? 'var(--primary)' : 'var(--bg-secondary)',
                                    color: budgetRange === option ? 'white' : 'var(--text-secondary)',
                                    fontSize: 13,
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                }}
                            >
                                {option}
                            </motion.button>
                        ))}
                    </div>
                </label>

                {/* Description */}
                <label style={{ display: 'block', marginBottom: 20 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
                        Project Description (optional)
                    </span>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Brief description of your interior project..."
                        style={{
                            width: '100%',
                            padding: 12,
                            borderRadius: 10,
                            border: '1px solid var(--border)',
                            fontSize: 14,
                            minHeight: 80,
                            resize: 'vertical',
                            fontFamily: 'inherit',
                        }}
                    />
                </label>

                {/* Submit */}
                <motion.button
                    onClick={handleSubmit}
                    disabled={submitting}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                        width: '100%',
                        padding: 14,
                        borderRadius: 12,
                        background: submitting ? '#E5E7EB' : 'var(--gradient-primary)',
                        border: 'none',
                        color: submitting ? '#9CA3AF' : 'white',
                        fontSize: 15,
                        fontWeight: 600,
                        cursor: submitting ? 'wait' : 'pointer',
                    }}
                >
                    {submitting ? 'Sending...' : 'Send Project Request'}
                </motion.button>
            </motion.div>
        </motion.div>
    );
}
