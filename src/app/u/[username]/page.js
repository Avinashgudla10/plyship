'use client';

import React, { useEffect, useState } from 'react';
import { db } from '../../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function UsernameProfilePage({ params }) {
    const { username } = React.use(params);
    const router = useRouter();
    const [error, setError] = useState(null);

    useEffect(() => {
        const resolve = async () => {
            if (!username) { setError('No username provided'); return; }

            const clean = username.toLowerCase();
            const snap = await getDoc(doc(db, 'usernames', clean));

            if (!snap.exists()) {
                setError('Profile not found');
                return;
            }

            const userId = snap.data().userId;
            // Redirect to the actual profile page
            router.replace(`/profile/${userId}`);
        };

        resolve();
    }, [username, router]);

    if (error) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(180deg, #F0FDF4 0%, #FFFFFF 30%)',
                fontFamily: 'Inter, system-ui, sans-serif',
            }}>
                <div style={{ textAlign: 'center', padding: 40 }}>
                    <div style={{
                        width: 80, height: 80, borderRadius: '50%',
                        background: '#FEE2E2', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', margin: '0 auto 20px', fontSize: 36,
                    }}>
                        😕
                    </div>
                    <h2 style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginBottom: 8 }}>
                        Profile Not Found
                    </h2>
                    <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 24 }}>
                        The username <strong>@{username}</strong> doesn&apos;t exist on PlyShip.
                    </p>
                    <a href="/" style={{
                        display: 'inline-block', padding: '12px 28px', borderRadius: 12,
                        background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                        color: 'white', fontSize: 15, fontWeight: 700, textDecoration: 'none',
                    }}>
                        Go to PlyShip
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(180deg, #F0FDF4 0%, #FFFFFF 30%)',
            fontFamily: 'Inter, system-ui, sans-serif',
        }}>
            <div style={{ textAlign: 'center' }}>
                <Loader2 size={32} color="#22C55E" style={{ animation: 'spin 1s linear infinite', marginBottom: 16 }} />
                <p style={{ fontSize: 14, color: '#6B7280' }}>Loading profile...</p>
            </div>
            <style jsx global>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
