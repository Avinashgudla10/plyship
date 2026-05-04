'use client';

import React, { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, Plus, Image as ImageIcon, Check } from 'lucide-react';

// ============ IMAGE COMPRESSION UTILITY ============
// Compresses images before upload to reduce upload time significantly
function compressImage(dataUrl, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve) => {
        const img = new window.Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let { width, height } = img;

            // Scale down if larger than maxWidth
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Convert to JPEG with compression
            const compressed = canvas.toDataURL('image/jpeg', quality);
            resolve(compressed);
        };
        img.onerror = () => resolve(dataUrl); // fallback to original
        img.src = dataUrl;
    });
}

// ============ UPLOAD PROGRESS OVERLAY ============
function UploadOverlay({ isUploading, progress, borderRadius = '50%' }) {
    return (
        <AnimatePresence>
            {isUploading && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius,
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10,
                    }}
                >
                    {/* Pulsing ring animation */}
                    <motion.div
                        animate={{
                            scale: [1, 1.2, 1],
                            opacity: [0.5, 1, 0.5],
                        }}
                        transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: 'easeInOut',
                        }}
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: '50%',
                            border: '3px solid rgba(255,255,255,0.3)',
                            borderTopColor: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{
                                duration: 1,
                                repeat: Infinity,
                                ease: 'linear',
                            }}
                            style={{
                                width: 44,
                                height: 44,
                                borderRadius: '50%',
                                border: '3px solid transparent',
                                borderTopColor: 'white',
                                position: 'absolute',
                            }}
                        />
                        <Camera size={16} color="white" />
                    </motion.div>
                    <motion.p
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{
                            color: 'white',
                            fontSize: 10,
                            fontWeight: 600,
                            marginTop: 6,
                            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                        }}
                    >
                        {progress || 'Processing...'}
                    </motion.p>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// ============ SUCCESS CHECK ANIMATION ============
function SuccessCheck({ show, borderRadius = '50%' }) {
    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={{ type: 'spring', damping: 15 }}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius,
                        background: 'rgba(22, 163, 74, 0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10,
                    }}
                >
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.1, type: 'spring', damping: 12 }}
                    >
                        <Check size={32} color="white" strokeWidth={3} />
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// ============ SINGLE IMAGE UPLOAD (Avatar/Logo) ============
export function AvatarUpload({ image, onImageChange, isCompany = false }) {
    const cameraRef = useRef(null);
    const galleryRef = useRef(null);
    const [showPicker, setShowPicker] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const handleFileChange = useCallback(async (e) => {
        const file = e.target.files?.[0];
        if (!file) {
            setShowPicker(false);
            return;
        }

        setShowPicker(false);
        setIsProcessing(true);

        try {
            // Read file
            const dataUrl = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(file);
            });

            // Compress before setting
            const compressed = await compressImage(dataUrl, 600, 0.75);
            onImageChange(compressed);

            // Show success briefly
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 1200);
        } catch (err) {
            console.error('Error processing image:', err);
        } finally {
            setIsProcessing(false);
        }
    }, [onImageChange]);

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
                    {!image && !isProcessing && (
                        <Camera size={32} color="var(--text-muted)" />
                    )}
                    {image && !isProcessing && !showSuccess && (
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

                    {/* Upload progress overlay */}
                    <UploadOverlay
                        isUploading={isProcessing}
                        progress="Compressing..."
                        borderRadius={isCompany ? '20px' : '50%'}
                    />

                    {/* Success check */}
                    <SuccessCheck
                        show={showSuccess}
                        borderRadius={isCompany ? '20px' : '50%'}
                    />
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
                                        Photo Library
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

// ============ MULTIPLE IMAGE UPLOAD (Portfolio) ============
export function PortfolioUpload({ images = [], onImagesChange, maxImages = 6 }) {
    const cameraRef = useRef(null);
    const galleryRef = useRef(null);
    const [showPicker, setShowPicker] = useState(false);
    const [processingCount, setProcessingCount] = useState(0);

    const handleFileChange = useCallback(async (e) => {
        const files = Array.from(e.target.files || []);
        const remaining = maxImages - images.length;
        const filesToProcess = files.slice(0, remaining);

        if (filesToProcess.length === 0) {
            setShowPicker(false);
            return;
        }

        setShowPicker(false);
        setProcessingCount(filesToProcess.length);

        try {
            // Read and compress all files in parallel
            const readAndCompress = async (file) => {
                const dataUrl = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(file);
                });
                return compressImage(dataUrl, 800, 0.7);
            };

            const newImages = await Promise.all(filesToProcess.map(readAndCompress));
            onImagesChange([...images, ...newImages]);
        } catch (err) {
            console.error('Error processing images:', err);
        } finally {
            setProcessingCount(0);
        }

        // Reset input
        e.target.value = '';
    }, [images, maxImages, onImagesChange]);

    const handleRemove = (index) => {
        const newImages = images.filter((_, i) => i !== index);
        onImagesChange(newImages);
    };

    const emptySlots = Math.max(0, Math.min(maxImages - images.length, 3));

    return (
        <div style={{ position: 'relative' }}>
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

                {/* Processing indicators */}
                {processingCount > 0 && Array.from({ length: processingCount }).map((_, i) => (
                    <motion.div
                        key={`processing-${i}`}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={{
                            aspectRatio: '1',
                            borderRadius: 16,
                            background: 'var(--pastel-green)',
                            border: '2px solid var(--pastel-mint)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                        }}
                    >
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            style={{
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                border: '3px solid var(--border)',
                                borderTopColor: 'var(--primary)',
                            }}
                        />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>
                            Processing
                        </span>
                    </motion.div>
                ))}

                {/* Empty slots for adding more */}
                {processingCount === 0 && Array.from({ length: emptySlots }).map((_, i) => (
                    <motion.div
                        key={`empty-${i}`}
                        whileHover={{ scale: 1.03, borderColor: 'var(--primary)' }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setShowPicker(true)}
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
            </div>

            {/* Action sheet for portfolio */}
            <AnimatePresence>
                {showPicker && (
                    <>
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
                                    Photo Library
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
                multiple
                onChange={handleFileChange}
                style={{ display: 'none' }}
            />
        </div>
    );
}

// Export compress utility for use elsewhere
export { compressImage };
