'use client';

import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, Plus, Image as ImageIcon } from 'lucide-react';

// Single image upload (for avatar/logo)
export function AvatarUpload({ image, onImageChange, isCompany = false }) {
    const cameraRef = useRef(null);
    const galleryRef = useRef(null);
    const [showPicker, setShowPicker] = useState(false);

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                onImageChange(reader.result);
            };
            reader.readAsDataURL(file);
        }
        setShowPicker(false);
    };

    const handleRemove = (e) => {
        e.stopPropagation();
        onImageChange(null);
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ position: 'relative' }}>
                <motion.div
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setShowPicker(true)}
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

                {/* Camera/Gallery picker modal */}
                <AnimatePresence>
                    {showPicker && (
                        <>
                            {/* Backdrop */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowPicker(false)}
                                style={{
                                    position: 'fixed',
                                    inset: 0,
                                    background: 'rgba(0,0,0,0.4)',
                                    zIndex: 99999,
                                }}
                            />
                            {/* Action sheet */}
                            <motion.div
                                initial={{ opacity: 0, y: 100 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 100 }}
                                transition={{ type: 'spring', damping: 25 }}
                                style={{
                                    position: 'fixed',
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    zIndex: 100000,
                                    padding: '8px',
                                    paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
                                }}
                            >
                                <div style={{
                                    background: 'white',
                                    borderRadius: 16,
                                    overflow: 'hidden',
                                    marginBottom: 8,
                                }}>
                                    <button
                                        onClick={() => { cameraRef.current?.click(); }}
                                        style={{
                                            width: '100%',
                                            padding: '16px',
                                            background: 'none',
                                            border: 'none',
                                            borderBottom: '1px solid var(--border-light)',
                                            fontSize: 17,
                                            fontWeight: 500,
                                            color: '#007AFF',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 10,
                                        }}
                                    >
                                        <Camera size={20} />
                                        Take Photo
                                    </button>
                                    <button
                                        onClick={() => { galleryRef.current?.click(); }}
                                        style={{
                                            width: '100%',
                                            padding: '16px',
                                            background: 'none',
                                            border: 'none',
                                            fontSize: 17,
                                            fontWeight: 500,
                                            color: '#007AFF',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 10,
                                        }}
                                    >
                                        <ImageIcon size={20} />
                                        Choose from Library
                                    </button>
                                </div>
                                <button
                                    onClick={() => setShowPicker(false)}
                                    style={{
                                        width: '100%',
                                        padding: '16px',
                                        background: 'white',
                                        border: 'none',
                                        borderRadius: 16,
                                        fontSize: 17,
                                        fontWeight: 600,
                                        color: '#007AFF',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Cancel
                                </button>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </div>

            {/* Hidden camera input */}
            <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                style={{ display: 'none' }}
            />
            {/* Hidden gallery input */}
            <input
                ref={galleryRef}
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

    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files || []);
        const remaining = maxImages - images.length;
        const filesToProcess = files.slice(0, remaining);

        if (filesToProcess.length === 0) return;

        // Read all files in parallel, then update state once
        const readFile = (file) => new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(file);
        });

        const newImages = await Promise.all(filesToProcess.map(readFile));
        onImagesChange([...images, ...newImages]);

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
