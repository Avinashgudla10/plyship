'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Star, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ReviewModal({
    companyId,
    companyName,
    type, // 'MEETING' or 'PROJECT'
    relatedId, // meetingId or projectId
    onClose,
    onSuccess
}) {
    const { submitReview } = useAuth();
    const [rating, setRating] = useState(0);
    const [hoveredRating, setHoveredRating] = useState(0);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (rating === 0) {
            alert('Please select a rating');
            return;
        }

        setSubmitting(true);
        const result = await submitReview(companyId, type, rating, comment, relatedId);
        setSubmitting(false);

        if (result.success) {
            alert('✅ Thank you for your review!');
            onSuccess?.();
            onClose();
        } else {
            alert('Error: ' + result.error);
        }
    };

    const typeLabel = type === 'MEETING' ? 'meeting' : 'project';

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
                zIndex: 200,
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
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                        Rate Your {type === 'MEETING' ? 'Meeting' : 'Experience'}
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <X size={20} color="var(--text-muted)" />
                    </button>
                </div>

                {/* Company Name */}
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20, textAlign: 'center' }}>
                    How was your {typeLabel} with <strong>{companyName || 'this company'}</strong>?
                </p>

                {/* Star Rating */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 8,
                    marginBottom: 24
                }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                        <motion.button
                            key={star}
                            onClick={() => setRating(star)}
                            onMouseEnter={() => setHoveredRating(star)}
                            onMouseLeave={() => setHoveredRating(0)}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 4,
                            }}
                        >
                            <Star
                                size={36}
                                color={(hoveredRating || rating) >= star ? '#FBBF24' : '#E5E7EB'}
                                fill={(hoveredRating || rating) >= star ? '#FBBF24' : 'transparent'}
                            />
                        </motion.button>
                    ))}
                </div>

                {/* Rating Label */}
                <p style={{
                    fontSize: 14,
                    color: 'var(--text-secondary)',
                    textAlign: 'center',
                    marginBottom: 20,
                    minHeight: 20,
                }}>
                    {rating === 1 && 'Poor'}
                    {rating === 2 && 'Fair'}
                    {rating === 3 && 'Good'}
                    {rating === 4 && 'Very Good'}
                    {rating === 5 && 'Excellent!'}
                </p>

                {/* Comment */}
                <label style={{ display: 'block', marginBottom: 20 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
                        Comment (optional)
                    </span>
                    <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Share your experience..."
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

                {/* Submit Button */}
                <motion.button
                    onClick={handleSubmit}
                    disabled={submitting || rating === 0}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                        width: '100%',
                        padding: 14,
                        borderRadius: 12,
                        background: (submitting || rating === 0) ? '#E5E7EB' : 'var(--gradient-primary)',
                        border: 'none',
                        color: (submitting || rating === 0) ? '#9CA3AF' : 'white',
                        fontSize: 15,
                        fontWeight: 600,
                        cursor: (submitting || rating === 0) ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                    }}
                >
                    <Send size={18} />
                    {submitting ? 'Submitting...' : 'Submit Review'}
                </motion.button>
            </motion.div>
        </motion.div>
    );
}
