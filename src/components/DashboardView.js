'use client';

// Home dashboard for both kinds of PlyShip users — one screen with everything that matters to them:
//  • Home interior seekers: what to do next, upcoming meetings, earnings from meetings, their free quotes
//    (Marketplace enquiry) and the firms it went to.
//  • Interior company owners: what to do next, meeting pipeline, wallet, and homeowner leads near them
//    from the Marketplace.
// Meetings / wallet / projects come live from Firestore; the Marketplace part from /marketplace/api/me
// (the person's own login token). The "Next steps" list is worked out from their data, most valuable first.
import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarClock, Wallet, Store, MessageCircle, Star, ArrowRight, MapPin, IndianRupee, Bell, Image as ImageIcon, CheckCircle2, Sparkles, Home } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebase';
import { getMeetingFee, getSeekerShare } from '../lib/meetingFee';
import { openMarketplace, requestQuotes, enableLeadAlerts, QUOTES_CONSENT, ALERTS_CONSENT } from '../lib/marketplace';

const rs = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const mk = (path) => '/marketplace' + (path === '/' ? '' : path); // opened via openMarketplace (already signed in)
const when = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
};
const ago = (iso) => {
    const h = Math.round((Date.now() - new Date(iso)) / 3600000);
    return h < 1 ? 'just now' : h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
};

// Whose turn is it on a meeting?
function needsMe(m, me) {
    if (m.status === 'REQUESTED' || m.status === 'PENDING_ACCEPTANCE') return m.requestedBy && m.requestedBy !== me;
    if (m.status === 'PROPOSED') return m.proposedBy && m.proposedBy !== me;
    return false;
}
const isUpcoming = (m) => ['SCHEDULED', 'CONFIRMED', 'ACCEPTED'].includes(m.status) && m.scheduledAt && new Date(m.scheduledAt) > Date.now() - 2 * 3600000;

function useMarketplaceMe(user) {
    const [data, setData] = useState(null);
    const [n, setN] = useState(0);
    useEffect(() => {
        if (!user?.id) return;
        let gone = false;
        (async () => {
            try {
                const token = await auth.currentUser?.getIdToken();
                if (!token) return;
                const res = await fetch('/marketplace/api/me', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
                const j = await res.json();
                if (!gone && j.ok) setData(j);
            } catch { /* the dashboard still shows everything else */ }
        })();
        return () => { gone = true; };
    }, [user?.id, n]);
    return [data, () => setN((x) => x + 1)];
}

const box = { background: 'white', borderRadius: 18, border: '1px solid var(--border-light, #E5E7EB)', padding: 16 };
const h3 = { fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #111)', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 8 };
const muted = { fontSize: 13, color: 'var(--text-muted, #6B7280)', margin: 0 };

function Action({ icon: Icon, title, text, cta, onClick, href, tone = 'green' }) {
    const colors = { green: ['#F0FDF4', '#16A34A'], orange: ['#FFF7ED', '#EA580C'], blue: ['#EFF6FF', '#2563EB'] }[tone];
    const inner = (
        <>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: colors[0], display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon size={18} color={colors[1]} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #111)' }}>{title}</div>
                {text && <div style={{ ...muted, marginTop: 2 }}>{text}</div>}
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: colors[1], whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 2 }}>{cta}<ArrowRight size={14} /></span>
        </>
    );
    const style = { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', textDecoration: 'none', background: 'none', border: 0, borderTop: '1px solid var(--border-light, #F1F5F9)', width: '100%', textAlign: 'left', cursor: 'pointer' };
    return href ? <a href={href} style={style}>{inner}</a> : <button type="button" onClick={onClick} style={style}>{inner}</button>;
}

function Tile({ label, value, sub, onClick }) {
    return (
        <button type="button" onClick={onClick} style={{ ...box, padding: 14, textAlign: 'left', cursor: onClick ? 'pointer' : 'default' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #6B7280)', fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary, #111)', marginTop: 4 }}>{value}</div>
            {sub && <div style={{ fontSize: 12, color: 'var(--text-muted, #6B7280)', marginTop: 2 }}>{sub}</div>}
        </button>
    );
}

function MeetingRow({ m, me, onOpen }) {
    const other = m.companyId === me ? m.seekerName : m.companyName;
    const loc = (m.location || '').split('||')[0];
    return (
        <button type="button" onClick={onOpen} style={{ display: 'flex', gap: 12, alignItems: 'center', width: '100%', padding: '10px 0', background: 'none', border: 'none', borderTop: '1px solid var(--border-light, #F1F5F9)', textAlign: 'left', cursor: 'pointer' }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: '#F0FDF4', display: 'grid', placeItems: 'center' }}><CalendarClock size={18} color="#16A34A" /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #111)' }}>{other || 'Meeting'}</div>
                <div style={{ ...muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{when(m.scheduledAt)}{loc ? ' · ' + loc : ''}</div>
            </div>
        </button>
    );
}

export default function DashboardView({ onNavigate }) {
    const { user, subscribeMeetings, subscribeWallet, subscribeProjects, getUnreadCount } = useAuth();
    const [meetings, setMeetings] = useState([]);
    const [wallet, setWallet] = useState(null);
    const [projects, setProjects] = useState([]);
    const [unread, setUnread] = useState(0);
    const [market, reloadMarket] = useMarketplaceMe(user);
    const [busy, setBusy] = useState('');
    const [note, setNote] = useState('');
    const quotes = async () => {
        setBusy('quotes'); setNote('');
        try { await requestQuotes(); setNote('Done — verified firms near you will call with quotes.'); reloadMarket(); }
        catch (e) { setNote(e.message); }
        setBusy('');
    };
    const alerts = async () => {
        setBusy('alerts'); setNote('');
        try { await enableLeadAlerts(); setNote('WhatsApp lead alerts are on.'); reloadMarket(); }
        catch (e) { setNote(e.message); }
        setBusy('');
    };
    // Any Marketplace link opens already signed in (no sign-in page).
    const onClickCapture = (e) => {
        const a = e.target.closest?.('a[href^="/marketplace"]');
        if (!a) return;
        e.preventDefault();
        openMarketplace(a.getAttribute('href').replace(/^\/marketplace/, '') || '/');
    };
    const isCompany = user?.role === 'COMPANY';
    const p = user?.profile || {};
    const me = user?.id;

    useEffect(() => subscribeMeetings ? subscribeMeetings(setMeetings) : undefined, [subscribeMeetings]);
    useEffect(() => subscribeWallet ? subscribeWallet(setWallet) : undefined, [subscribeWallet]);
    useEffect(() => subscribeProjects ? subscribeProjects(setProjects) : undefined, [subscribeProjects]);
    useEffect(() => { getUnreadCount?.().then((n) => setUnread(Number(n) || 0)).catch(() => {}); }, [getUnreadCount]);

    const go = (tab, sub = null) => onNavigate?.(tab, sub);
    const waiting = useMemo(() => meetings.filter((m) => needsMe(m, me)), [meetings, me]);
    const upcoming = useMemo(() => meetings.filter(isUpcoming).sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)), [meetings]);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const doneThisMonth = meetings.filter((m) => m.status === 'COMPLETED' && new Date(m.updatedAt || m.scheduledAt) >= monthStart).length;
    const activeProjects = projects.filter((x) => !['DECLINED', 'CANCELLED', 'COMPLETED'].includes(x.status)).length;
    const balance = wallet?.balance || 0;
    const name = (isCompany ? p.companyName : p.name) || user?.name || '';

    // ---- Next steps, most valuable first ----
    const actions = [];
    if (waiting.length) actions.push({ icon: CalendarClock, tone: 'orange', title: `${waiting.length} meeting${waiting.length === 1 ? '' : 's'} waiting for your reply`, text: isCompany ? 'Homeowners are waiting — reply fast to win the project.' : 'Accept or suggest a time that suits you.', cta: 'Reply', onClick: () => go('profile', 'meetings') });
    if (unread > 0) actions.push({ icon: MessageCircle, tone: 'blue', title: `${unread} unread message${unread === 1 ? '' : 's'}`, cta: 'Open chat', onClick: () => go('messages') });
    if (isCompany) {
        const n = market?.nearby;
        if (n?.count) actions.push({ icon: Store, title: `${n.count} homeowner lead${n.count === 1 ? '' : 's'} near you`, text: `Within ${n.radiusKm} km${n.fromPrice ? ` · from ${rs(n.fromPrice)}` : ''} · see the requirement free`, cta: 'View', href: mk('/') });
        const due = (market?.recent || []).filter((x) => x.feedbackDue).length;
        if (due) actions.push({ icon: Star, tone: 'orange', title: `Rate ${due} lead${due === 1 ? '' : 's'} you bought`, text: 'Tell us if they picked up — bad leads are replaced free.', cta: 'Rate', href: mk('/account/orders') });
        const fee = getMeetingFee('2 BHK');
        if (balance < fee) actions.push({ icon: Wallet, tone: 'orange', title: 'Top up your wallet', text: `Meetings cost ${rs(getMeetingFee('1 BHK'))}–${rs(getMeetingFee('Villa'))}. Balance: ${rs(balance)}.`, cta: 'Top up', onClick: () => go('profile', 'wallet') });
        if (market && !market.whatsappAlerts) actions.push({ icon: Bell, tone: 'blue', title: 'Get new leads on WhatsApp', text: ALERTS_CONSENT, cta: busy === 'alerts' ? 'Turning on…' : 'Turn on', onClick: alerts });
        if ((p.portfolioImages || []).length < 3) actions.push({ icon: ImageIcon, title: 'Add portfolio photos', text: 'Firms with 3+ project photos get more meetings.', cta: 'Add', onClick: () => go('profile', 'edit') });
    } else {
        const e = market?.enquiry;
        if (e?.toRate) actions.push({ icon: Star, tone: 'orange', title: `Rate the firm${e.toRate === 1 ? '' : 's'} that contacted you`, text: 'Not happy with any of them? We find you more.', cta: 'Rate', href: mk('/my-enquiry') });
        if (market && !e) actions.push({ icon: Sparkles, title: 'Get free quotes from 3 verified firms', text: 'One tap — we use your PlyShip profile, no form.', cta: 'See', onClick: () => document.getElementById('free-quotes')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) });
        if (!upcoming.length && !waiting.length) actions.push({ icon: Home, tone: 'blue', title: 'Meet interior companies near you', text: `Earn ${rs(getSeekerShare(getMeetingFee(p.propertyType)))} for each meeting you attend.`, cta: 'Explore', onClick: () => go('explore') });
        if (!p.avatar) actions.push({ icon: ImageIcon, title: 'Add a profile photo', text: 'Companies respond more to complete profiles.', cta: 'Add', onClick: () => go('profile', 'edit') });
    }

    return (
        <div onClickCapture={onClickCapture} style={{ height: '100%', overflowY: 'auto', padding: '16px 16px 28px', background: 'var(--bg-secondary, #F8FAF9)' }}>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'grid', gap: 14, maxWidth: 720, margin: '0 auto' }}>
                {/* Hello */}
                <div style={{ borderRadius: 20, padding: 18, color: 'white', background: 'radial-gradient(120% 140% at 100% 0%, rgba(34,197,94,.35) 0%, rgba(11,20,16,0) 55%), #0b1410' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#86efac' }}>{isCompany ? 'Your business on PlyShip' : 'Your home on PlyShip'}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>Hi{name ? `, ${name.split(' ')[0]}` : ''} 👋</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                        {(isCompany
                            ? [p.city && `📍 ${p.city}`, p.serviceRadius && `Within ${p.serviceRadius} km`, (p.services || []).length && `${p.services.length} services`]
                            : [p.propertyType, p.budget && `Budget ${p.budget}`, p.city && `📍 ${p.city}`, p.timeline]
                        ).filter(Boolean).map((t) => <span key={t} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 99, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.15)' }}>{t}</span>)}
                    </div>
                </div>

                {/* Numbers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                    {isCompany ? (
                        <>
                            <Tile label="Meetings" value={upcoming.length} sub="upcoming" onClick={() => go('profile', 'meetings')} />
                            <Tile label="Wallet" value={rs(balance)} sub={`${rs(wallet?.totalSpent)} spent`} onClick={() => go('profile', 'wallet')} />
                            <Tile label="Leads" value={market?.nearby?.count ?? '…'} sub="near you" onClick={() => openMarketplace('/')} />
                        </>
                    ) : (
                        <>
                            <Tile label="Meetings" value={upcoming.length} sub="upcoming" onClick={() => go('profile', 'meetings')} />
                            <Tile label="Earned" value={rs(wallet?.totalEarnings)} sub={`${rs(balance)} to withdraw`} onClick={() => go('profile', 'wallet')} />
                            <Tile label="Projects" value={activeProjects} sub="active" onClick={() => go('profile', 'projects')} />
                        </>
                    )}
                </div>

                {/* Next steps */}
                <div style={box}>
                    <h3 style={h3}><Sparkles size={16} color="#16A34A" /> Next steps</h3>
                    {note && <p role="status" style={{ ...muted, color: '#15803D', fontWeight: 600, marginBottom: 6 }}>{note}</p>}
                    {actions.length ? actions.slice(0, 5).map((a) => <Action key={a.title} {...a} />) : (
                        <p style={{ ...muted, display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={16} color="#16A34A" /> You’re all caught up.</p>
                    )}
                </div>

                {/* Upcoming meetings */}
                <div style={box}>
                    <h3 style={h3}><CalendarClock size={16} color="#16A34A" /> Upcoming meetings</h3>
                    {upcoming.length ? upcoming.slice(0, 3).map((m) => <MeetingRow key={m.id} m={m} me={me} onOpen={() => go('profile', 'meetings')} />)
                        : <p style={muted}>{isCompany ? 'No meetings booked yet. Explore homeowners near you to book one.' : 'No meetings yet.'}</p>}
                    {isCompany && <p style={{ ...muted, marginTop: 8 }}>{doneThisMonth} completed this month · {activeProjects} active project{activeProjects === 1 ? '' : 's'}</p>}
                </div>

                {/* Marketplace */}
                {isCompany ? (
                    <div style={box}>
                        <h3 style={h3}><Store size={16} color="#16A34A" /> Homeowner leads near you</h3>
                        {!market ? <p style={muted}>Loading…</p> : market.nearby.top.length === 0 ? (
                            <p style={muted}>No open leads within {market.nearby.radiusKm} km right now. {market.whatsappAlerts ? 'We’ll WhatsApp you when one comes in.' : 'Turn on WhatsApp alerts to hear first.'}</p>
                        ) : market.nearby.top.map((l) => (
                            <a key={l.id} href={mk(`/lead/${l.id}`)} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--border-light, #F1F5F9)', textDecoration: 'none' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #111)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title}</div>
                                    <div style={{ ...muted, display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} />{l.area}{l.km != null ? ` · ${l.km} km` : ''}{l.budget ? ` · ${l.budget}` : ''} · {ago(l.at)}</div>
                                </div>
                                <span style={{ fontSize: 14, fontWeight: 800, color: '#15803D', display: 'flex', alignItems: 'center' }}><IndianRupee size={13} />{Number(l.price).toLocaleString('en-IN')}</span>
                            </a>
                        ))}
                        {market && <p style={{ ...muted, marginTop: 8 }}>You’ve bought {market.bought.leads} lead{market.bought.leads === 1 ? '' : 's'}{market.bought.leads30 ? ` (${market.bought.leads30} this month)` : ''}. <a href={mk('/')} style={{ color: '#15803D', fontWeight: 700 }}>Open Marketplace →</a></p>}
                    </div>
                ) : (
                    <div style={box}>
                        <h3 style={h3}><Store size={16} color="#16A34A" /> Your free quotes</h3>
                        {!market ? <p style={muted}>Loading…</p> : !market.enquiry ? (
                            <div id="free-quotes">
                                <p style={muted}>Up to 3 verified interior firms near you call with quotes — free for homeowners. We use the details in your PlyShip profile; no form to fill.</p>
                                <button type="button" onClick={quotes} disabled={busy === 'quotes'} style={{ marginTop: 10, width: '100%', padding: '12px 16px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)', color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                                    {busy === 'quotes' ? 'Sending…' : 'Get free quotes'}
                                </button>
                                <p style={{ fontSize: 11, color: 'var(--text-muted, #6B7280)', margin: '8px 0 0', lineHeight: 1.4 }}>{QUOTES_CONSENT}</p>
                            </div>
                        ) : (
                            <>
                                <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary, #111)' }}>{market.enquiry.title}</p>
                                <p style={muted}>{market.enquiry.status}</p>
                                {market.enquiry.firms.map((f) => (
                                    <div key={f.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border-light, #F1F5F9)', fontSize: 14 }}>
                                        <span style={{ fontWeight: 600 }}>{f.name}</span>
                                        <span style={muted}>{f.stars ? '★'.repeat(f.stars) : f.rated ? 'Didn’t call' : 'Not rated'}</span>
                                    </div>
                                ))}
                                <a href={mk('/my-enquiry')} style={{ display: 'inline-block', marginTop: 8, color: '#15803D', fontWeight: 700, fontSize: 13 }}>{market.enquiry.canAskMore ? 'Get more firms →' : 'See details →'}</a>
                            </>
                        )}
                    </div>
                )}
            </motion.div>
        </div>
    );
}
