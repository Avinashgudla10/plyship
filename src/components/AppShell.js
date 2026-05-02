'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

// ============ OFFLINE BANNER (non-blocking toast) ============
function OfflineBanner({ isOffline, wasOffline }) {
    // Show "back online" briefly when reconnecting
    const [showReconnected, setShowReconnected] = useState(false);

    useEffect(() => {
        if (!isOffline && wasOffline) {
            setShowReconnected(true);
            const timer = setTimeout(() => setShowReconnected(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [isOffline, wasOffline]);

    if (!isOffline && !showReconnected) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 99999,
            paddingTop: 'env(safe-area-inset-top, 0px)',
            pointerEvents: 'none',
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '10px 16px',
                background: isOffline
                    ? 'linear-gradient(90deg, #DC2626 0%, #B91C1C 100%)'
                    : 'linear-gradient(90deg, #22C55E 0%, #16A34A 100%)',
                animation: 'offlineBannerSlideDown 0.3s ease forwards',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
            }}>
                {isOffline ? (
                    <>
                        {/* Wifi off icon */}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="1" y1="1" x2="23" y2="23" />
                            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
                            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
                            <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
                            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
                            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                            <line x1="12" y1="20" x2="12.01" y2="20" />
                        </svg>
                        <span style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: 'white',
                            letterSpacing: '0.2px',
                        }}>
                            No Internet Connection
                        </span>
                        {/* Animated dots */}
                        <div style={{ display: 'flex', gap: 3, marginLeft: 4 }}>
                            {[0, 1, 2].map(i => (
                                <div
                                    key={i}
                                    style={{
                                        width: 4,
                                        height: 4,
                                        borderRadius: '50%',
                                        background: 'rgba(255,255,255,0.7)',
                                        animation: `offlinePulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                                    }}
                                />
                            ))}
                        </div>
                    </>
                ) : (
                    <>
                        {/* Check icon */}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: 'white',
                        }}>
                            Back Online
                        </span>
                    </>
                )}
            </div>
        </div>
    );
}

// ============ LOADING SCREEN ============
function LoadingScreen() {
    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99998,
            background: 'linear-gradient(180deg, #0A0F0A 0%, #132A13 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 24,
        }}>
            <img
                src="/logo.png"
                alt="PLYSHIP"
                style={{
                    height: 48,
                    width: 'auto',
                    filter: 'brightness(1.1)',
                    animation: 'fadeIn 0.4s ease forwards',
                }}
            />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                    <div
                        key={i}
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: '#22C55E',
                            animation: `pulse 1s ease-in-out ${i * 0.15}s infinite`,
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

// ============ PULL-TO-REFRESH INDICATOR ============
function PullIndicator({ pullDistance, isRefreshing }) {
    const progress = Math.min(pullDistance / 80, 1);
    const opacity = Math.min(progress * 1.5, 1);
    const rotate = progress * 360;

    if (pullDistance <= 0 && !isRefreshing) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 'env(safe-area-inset-top, 0px)',
            left: 0,
            right: 0,
            zIndex: 99997,
            display: 'flex',
            justifyContent: 'center',
            paddingTop: Math.min(pullDistance * 0.4, 48),
            pointerEvents: 'none',
            transition: isRefreshing ? 'padding-top 0.3s ease' : 'none',
        }}>
            <div style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'white',
                boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity,
                transform: `scale(${0.5 + progress * 0.5})`,
                transition: isRefreshing ? 'transform 0.3s ease' : 'none',
            }}>
                {isRefreshing ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        style={{ animation: 'pullRefreshSpin 0.8s linear infinite' }}>
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        style={{ transform: `rotate(${rotate}deg)`, transition: 'none' }}>
                        <polyline points="23 4 23 10 17 10" />
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                    </svg>
                )}
            </div>
        </div>
    );
}

// ============ MAIN APP SHELL ============
export default function AppShell({ children }) {
    const [isOffline, setIsOffline] = useState(false);
    const [wasOffline, setWasOffline] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const touchStartY = useRef(0);
    const isPulling = useRef(false);

    // ---- Offline Detection ----
    useEffect(() => {
        const handleOnline = () => {
            setWasOffline(true);
            setIsOffline(false);
        };
        const handleOffline = () => {
            setIsOffline(true);
        };

        // Check initial state
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            setIsOffline(true);
        }

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // ---- Initial Loading Screen ----
    useEffect(() => {
        // Wait for document to be fully interactive
        const handleLoad = () => {
            // Small delay to ensure content renders
            setTimeout(() => setIsLoading(false), 800);
        };

        if (document.readyState === 'complete') {
            handleLoad();
        } else {
            window.addEventListener('load', handleLoad);
            // Fallback: hide loading after 3 seconds max
            const fallback = setTimeout(() => setIsLoading(false), 3000);
            return () => {
                window.removeEventListener('load', handleLoad);
                clearTimeout(fallback);
            };
        }
    }, []);

    // ---- Pull to Refresh ----
    const handleTouchStart = useCallback((e) => {
        // Only enable pull-to-refresh when at top of page
        // Check multiple scroll containers
        const target = e.target;
        let scrollParent = target;
        while (scrollParent && scrollParent !== document.body) {
            if (scrollParent.scrollTop > 5) return; // Not at top
            scrollParent = scrollParent.parentElement;
        }

        const documentScrollTop = document.documentElement.scrollTop || document.body.scrollTop;
        if (documentScrollTop <= 5) {
            touchStartY.current = e.touches[0].clientY;
            isPulling.current = true;
        }
    }, []);

    const handleTouchMove = useCallback((e) => {
        if (!isPulling.current || isRefreshing) return;

        const currentY = e.touches[0].clientY;
        const diff = currentY - touchStartY.current;

        if (diff > 0) {
            // Apply resistance: the further you pull, the harder it gets
            const distance = Math.min(diff * 0.4, 120);
            setPullDistance(distance);
        } else {
            // If scrolling up, cancel pull
            isPulling.current = false;
            setPullDistance(0);
        }
    }, [isRefreshing]);

    const handleTouchEnd = useCallback(() => {
        if (!isPulling.current) return;
        isPulling.current = false;

        if (pullDistance >= 80 && !isRefreshing) {
            // Trigger refresh
            setIsRefreshing(true);
            setPullDistance(48); // Keep indicator visible

            // Dispatch a custom event for pages to handle refresh
            window.dispatchEvent(new CustomEvent('pullToRefresh'));

            // Fallback: reload the page if no handler caught it
            setTimeout(() => {
                window.location.reload();
            }, 500);
        } else {
            // Snap back
            setPullDistance(0);
        }
    }, [pullDistance, isRefreshing]);

    useEffect(() => {
        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchmove', handleTouchMove, { passive: true });
        document.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

    return (
        <>
            {/* Offline banner - non-blocking toast at top */}
            <OfflineBanner isOffline={isOffline} wasOffline={wasOffline} />

            {/* Loading screen on initial load */}
            {isLoading && !isOffline && <LoadingScreen />}

            {/* Pull-to-refresh indicator */}
            <PullIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />

            {/* App content */}
            {children}
        </>
    );
}
