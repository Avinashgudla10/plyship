'use client';

// One admin for plyship.com: the Marketplace (plyship.com/marketplace, homeowner leads for interior firms) inside
// this admin dashboard. Totals come from the Marketplace's /admin-api/summary, authorised with the admin's own
// PlyShip login token. Detailed tools open the Marketplace admin, signed in automatically (one sign-in).
import React, { useCallback, useEffect, useState } from 'react';
import { Store, IndianRupee, ShoppingBag, Home, Building2, ClipboardCheck, RefreshCw, MessageCircle, Bot, Megaphone, Settings, ListChecks, ExternalLink, AlertTriangle } from 'lucide-react';
import { auth } from '../lib/firebase';

const rs = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
/** Link into the Marketplace admin, through its sign-in hand-off (reuses the PlyShip login). */
export const marketplaceAdminUrl = (path = '/admin') => `/marketplace/login?next=${encodeURIComponent(path)}`;

export function useMarketplaceSummary(enabled) {
    const [summary, setSummary] = useState(null);
    const [error, setError] = useState('');
    const load = useCallback(async () => {
        if (!enabled) return;
        setError('');
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error('Not signed in');
            const res = await fetch('/marketplace/admin-api/summary', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.ok) throw new Error(json.error || `Marketplace unavailable (${res.status})`);
            setSummary(json);
        } catch (e) {
            setError(e.message || 'Could not load the Marketplace');
        }
    }, [enabled]);
    useEffect(() => {
        load();
        if (!enabled) return;
        const t = setInterval(load, 60_000); // refresh every minute while the admin is open
        return () => clearInterval(t);
    }, [enabled, load]);
    return { summary, error, reload: load };
}

const card = { padding: 16, borderRadius: 14, background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' };

function Stat({ icon: Icon, label, value, sub, color = '#16A34A' }) {
    return (
        <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: color + '1A', display: 'grid', placeItems: 'center' }}><Icon size={16} color={color} /></div>
                <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>{label}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#111' }}>{value}</div>
            {sub && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{sub}</div>}
        </div>
    );
}

/** The website AI's daily report for the whole platform (meetings + Marketplace). */
export function AiReportCard({ summary }) {
    const ai = summary?.ai;
    if (!ai) return null;
    const p = ai.platform || {};
    const n = p.nudges || {};
    const applied = Object.entries(ai.applied || {});
    return (
        <div style={{ ...card, marginBottom: 20, padding: 20, border: '1px solid #BBF7D0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Bot size={18} color="#16A34A" /> PlyShip AI — daily report</h3>
                <span style={{ fontSize: 12, color: '#6B7280' }}>{new Date(ai.at || ai.day).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}{ai.by === 'rules' ? ' · rules only (AI unavailable)' : ''}</span>
            </div>
            <p style={{ fontSize: 14, color: '#111', lineHeight: 1.5, margin: '0 0 12px' }}>{ai.summary}</p>
            {p.meetings_30d && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 12 }}>
                    <Stat icon={Building2} label="Meetings (30 days)" value={`${p.meetings_30d.completed}/${p.meetings_30d.created}`} sub={`completed · ${p.meetings_30d.cancelledOrDeclined} cancelled · ${p.meetings_30d.disputes} disputes`} color="#3B82F6" />
                    <Stat icon={IndianRupee} label="PlyShip share (30 days)" value={rs(p.meetings_30d.plyshipShare)} sub={`of ${rs(p.meetings_30d.feesCollected)} meeting fees`} color="#059669" />
                    <Stat icon={ClipboardCheck} label="Stuck / waiting" value={p.meetings_waiting_reply_48h ?? 0} sub={`meetings 48h+ without reply · ${p.companies_low_balance ?? 0} low wallets`} color={(p.meetings_waiting_reply_48h || 0) ? '#F97316' : '#16A34A'} />
                    <Stat icon={MessageCircle} label="App nudges" value={n.sent_yesterday_or_today ?? 0} sub={`sent ${n.on || 'today'} · limit ${n.limit ?? '—'}/day`} color="#8B5CF6" />
                </div>
            )}
            {(ai.actions || []).length > 0 && (
                <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>For you to decide</div>
                    {ai.actions.slice(0, 5).map((a, i) => (
                        <div key={i} style={{ fontSize: 13, padding: '8px 10px', borderRadius: 10, background: '#F9FAFB', marginBottom: 6 }}><b>{a.action}</b><div style={{ color: '#6B7280', marginTop: 2 }}>{a.why}</div></div>
                    ))}
                </div>
            )}
            {(ai.insights || []).length > 0 && (
                <details>
                    <summary style={{ fontSize: 13, fontWeight: 600, color: '#15803D', cursor: 'pointer' }}>What the AI noticed{applied.length ? ` · ${applied.length} setting${applied.length === 1 ? '' : 's'} changed` : ''}</summary>
                    <ul style={{ fontSize: 13, color: '#374151', margin: '8px 0 0', paddingLeft: 18 }}>
                        {ai.insights.map((x, i) => <li key={i} style={{ marginBottom: 4 }}>{x}</li>)}
                        {applied.map(([k, v]) => <li key={k} style={{ marginBottom: 4 }}>Changed <b>{k.replace(/_/g, ' ')}</b> → {String(v)}</li>)}
                    </ul>
                </details>
            )}
        </div>
    );
}

/** Overview tab: both businesses together — meetings (this app) + Marketplace (leads). */
export function PlatformRevenueCard({ meetingsRevenue, summary, error, onOpen }) {
    const leads = summary?.revenue || 0;
    return (
        <div style={{ ...card, marginBottom: 20, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: 0 }}>PlyShip platform — all revenue</h3>
                <button onClick={onOpen} style={{ padding: '6px 12px', borderRadius: 10, border: '1px solid #BBF7D0', background: '#F0FDF4', color: '#15803D', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Marketplace details →</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <Stat icon={IndianRupee} label="Total (all of PlyShip)" value={rs(meetingsRevenue + leads)} color="#059669" />
                <Stat icon={Building2} label="Meetings (this app)" value={rs(meetingsRevenue)} color="#3B82F6" />
                <Stat icon={Store} label="Marketplace (lead sales)" value={summary ? rs(leads) : error ? '—' : '…'} sub={summary ? `${rs(summary.revenueToday)} today · ${rs(summary.revenue30)} in 30 days` : error} color="#16A34A" />
            </div>
        </div>
    );
}

const TOOLS = [
    { path: '/admin', label: 'Marketplace dashboard', icon: Store },
    { path: '/admin/leads', label: 'Leads', icon: ListChecks },
    { path: '/admin/review', label: 'Review queue', icon: ClipboardCheck, badge: 'reviewPending' },
    { path: '/admin/orders', label: 'Orders & refunds', icon: ShoppingBag },
    { path: '/admin/customers', label: 'Firms (buyers)', icon: Building2 },
    { path: '/admin/ai', label: 'AI, profit & replacements', icon: Bot, badge: 'replacementsOpen' },
    { path: '/admin/facebook', label: 'Facebook lead ads', icon: Megaphone },
    { path: '/admin/whatsapp', label: 'WhatsApp alerts', icon: MessageCircle },
    { path: '/admin/settings', label: 'Marketplace settings', icon: Settings },
];

/** The Marketplace tab of this admin dashboard. */
export function MarketplaceTab({ summary, error, reload }) {
    const s = summary;
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
                <div>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111', margin: 0 }}>Marketplace</h2>
                    <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>Homeowner leads sold to interior firms at plyship.com/marketplace. Run by the website AI.</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={reload} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, border: '1px solid #E5E7EB', background: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}><RefreshCw size={14} /> Refresh</button>
                    <a href="/marketplace" target="_blank" rel="noopener" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, border: '1px solid #E5E7EB', background: 'white', fontWeight: 600, fontSize: 13, color: '#111', textDecoration: 'none' }}><ExternalLink size={14} /> View store</a>
                </div>
            </div>

            {error && !s && (
                <div style={{ ...card, display: 'flex', gap: 10, alignItems: 'center', color: '#B91C1C', marginBottom: 16 }}><AlertTriangle size={18} /> {error}</div>
            )}

            {s && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
                        <Stat icon={IndianRupee} label="Revenue today" value={rs(s.revenueToday)} sub={`${rs(s.revenue30)} in 30 days · ${rs(s.revenue)} all time`} />
                        <Stat icon={IndianRupee} label="Profit (30 days)" value={s.profit30 ? rs(s.profit30.profit) : '—'} sub={s.profit30 ? `Ads ${rs(s.profit30.adSpend)} · WhatsApp ${rs(s.profit30.whatsapp)}${s.profit30.margin != null ? ` · ${s.profit30.margin}% margin` : ''}` : ''} color={s.profit30 && s.profit30.profit < 0 ? '#DC2626' : '#059669'} />
                        <Stat icon={ShoppingBag} label="Leads sold" value={s.leadsSold} sub={`${s.orders} paid orders`} color="#3B82F6" />
                        <Stat icon={ListChecks} label="Leads on sale" value={s.leadsLive} sub={`${s.leadsNew30} new in 30 days`} color="#8B5CF6" />
                        <Stat icon={Building2} label="Firms" value={s.firms} sub={`${s.buyers} bought · ${s.firmsWhatsApp} get WhatsApp alerts · +${s.firmsNew30} in 30 days`} color="#0EA5E9" />
                        <Stat icon={Home} label="Homeowners" value={s.homeowners} color="#EC4899" />
                        <Stat icon={ClipboardCheck} label="Needs you" value={s.reviewPending + s.replacementsOpen} sub={`${s.reviewPending} leads to review · ${s.replacementsOpen} replacement claims`} color={s.reviewPending + s.replacementsOpen ? '#F97316' : '#16A34A'} />
                    </div>

                    <div style={{ ...card, marginBottom: 16 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 10px' }}>Latest sales</h3>
                        {s.recentOrders.length === 0 ? <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>No sales yet.</p> : (
                            <div style={{ display: 'grid', gap: 8 }}>
                                {s.recentOrders.map((o) => (
                                    <a key={o.id} href={marketplaceAdminUrl(`/admin/orders/${o.id}`)} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, color: '#111', textDecoration: 'none', padding: '8px 10px', borderRadius: 10, background: '#F9FAFB' }}>
                                        <span><b>{o.firm}</b> · {o.leads} lead{o.leads === 1 ? '' : 's'}</span>
                                        <span>{rs(o.amount)} · {new Date(o.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}

            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '6px 0 10px' }}>Marketplace tools</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                {TOOLS.map((t) => {
                    const n = t.badge && s ? s[t.badge] : 0;
                    return (
                        <a key={t.path} href={marketplaceAdminUrl(t.path)} style={{ ...card, display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: '#111', fontWeight: 600, fontSize: 14 }}>
                            <t.icon size={18} color="#16A34A" />
                            <span style={{ flex: 1 }}>{t.label}</span>
                            {n > 0 && <span style={{ minWidth: 22, padding: '2px 7px', borderRadius: 99, background: '#F97316', color: 'white', fontSize: 12, textAlign: 'center' }}>{n}</span>}
                        </a>
                    );
                })}
            </div>
        </div>
    );
}
