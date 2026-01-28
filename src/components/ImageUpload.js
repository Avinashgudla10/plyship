'use client';

import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { Camera, X, Plus } from 'lucide-react';

// Single image upload (for avatar/logo)
export function AvatarUpload({ image, onImageChange, isCompany = false }) {
    const inputRef = useRef(null);

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                onImageChange(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemove = (e) => {
        e.stopPropagation();
        onImageChange(null);
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
            <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => inputRef.current?.click()}
                style={{
                    width: 100,
                    height: 100,
                    borderRadius: isCompany ? 20 : '50%',
                    background: image ? `url(${image}) center/cover` : 'var(--pastel-green)',
                    border: image ? '3px solid var(--primary)' : '3px dashed var(--pastel-mint)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {!image && (
                    <Camera size={32} color="var(--text-muted)" />
                )}
                {image && (
                    <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        onClick={handleRemove}
                        style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: 'rgba(0,0,0,0.6)',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                        }}
                    >
                        <X size={14} color="white" />
                    </motion.button>
                )}
            </motion.div>
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
            />
        </div>
    );
}

// Multiple image upload (for portfolio)
export function PortfolioUpload({ images = [], onImagesChange, maxImages = 6 }) {
    const inputRef = useRef(null);

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files || []);
        files.forEach(file => {
            if (images.length >= maxImages) return;

            const reader = new FileReader();
            reader.onloadend = () => {
                onImagesChange([...images, reader.result]);
            };
            reader.readAsDataURL(file);
        });
        // Reset input
        e.target.value = '';
    };

    const handleRemove = (index) => {
        const newImages = images.filter((_, i) => i !== index);
        onImagesChange(newImages);
    };

    const emptySlots = Math.max(0, Math.min(maxImages - images.length, 3));

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {images.map((img, index) => (
                <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{
                        aspectRatio: '1',
                        borderRadius: 16,
                        background: `url(${img}) center/cover`,
                        position: 'relative',
                        border: '2px solid var(--primary)',
                    }}
                >
                    <motion.button
                        onClick={() => handleRemove(index)}
                        whileHover={{ scale: 1.1 }}
                        style={{
                            position: 'absolute',
                            top: 6,
                            right: 6,
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: 'rgba(0,0,0,0.6)',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                        }}
                    >
                        <X size={14} color="white" />
                    </motion.button>
                </motion.div>
            ))}

            {/* Empty slots for adding more */}
            {Array.from({ length: emptySlots }).map((_, i) => (
                <motion.div
                    key={`empty-${i}`}
                    whileHover={{ scale: 1.03, borderColor: 'var(--primary)' }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => inputRef.current?.click()}
                    style={{
                        aspectRatio: '1',
                        borderRadius: 16,
                        background: 'var(--pastel-green)',
                        border: '2px dashed var(--pastel-mint)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                    }}
                >
                    <Plus size={24} color="var(--text-muted)" />
                </motion.div>
            ))}

            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                style={{ display: 'none' }}
            />
        </div>
    );
}
