'use client';

// The Marketplace as a tab of the PlyShip app: the app's header and bottom bar stay, the Marketplace pages show
// inside. Same login (the Marketplace session starts in the background first) and the same account.
import React, { useEffect, useState } from 'react';
import { startMarketplaceSession } from '../lib/marketplace';

export default function MarketplaceFrame({ path = '/' }) {
    const [ready, setReady] = useState(false);
    useEffect(() => {
        let on = true;
        startMarketplaceSession().then((j) => {
            if (j?.needsProfile) { window.location.href = '/profile-setup'; return; }
            if (on) setReady(true);
        });
        return () => { on = false; };
    }, []);
    if (!ready) {
        return <div role="status" style={{ padding: 24, color: 'var(--text-muted)', fontSize: 14 }}>Opening the Marketplace…</div>;
    }
    return (
        <iframe
            key={path}
            title="PlyShip Marketplace"
            src={'/marketplace' + (path === '/' ? '' : path)}
            style={{ width: '100%', height: '100%', border: 0, display: 'block', background: 'white' }}
            allow="geolocation; payment"
        />
    );
}
