'use client';

// One admin for the whole platform: every Marketplace admin page and action, inside plyship.com/admin.
// Talks to the Marketplace's own admin code through /marketplace/admin-api/m/* (the admin's PlyShip login
// token; same checks and same results as before). Pages come back as { view, data }, actions as { redirect, flash }.
import React, { useCallback, useEffect, useState } from 'react';
import { auth } from '../lib/firebase';
import { openMarketplace } from '../lib/marketplace';

const API = '/marketplace/admin-api/m';
const card = { background: 'white', borderRadius: 14, border: '1px solid #E5E7EB', padding: 16 };
const muted = { fontSize: 12, color: '#6B7280' };
const h3 = { fontSize: 15, fontWeight: 700, margin: '0 0 10px' };
const h2 = { fontSize: 17, fontWeight: 800, margin: '22px 0 10px' };
const input = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 13, background: 'white' };
const grid = (min = 200) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 12 });
const money = (c, cur = 'INR') => (cur === 'INR' ? '₹' : cur + ' ') + (Number(c || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const inr = (n) => (n == null ? '—' : (n < 0 ? '−₹' : '₹') + Math.abs(Number(n)).toLocaleString('en-IN'));
const date = (d, time) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: '2-digit', ...(time ? { hour: 'numeric', minute: '2-digit' } : {}) }) : '—');
const orderNo = (id) => 'PL-' + String(id).padStart(5, '0');
const pct = (n) => Math.round((n || 0) * 100) + '%';
const tel = (p) => 'tel:' + String(p || '').replace(/[^+\d]/g, '');

export const SECTIONS = [
    { path: '/', label: 'Sales chart' },
    { path: '/leads', label: 'Leads' },
    { path: '/review', label: 'Review queue', badge: 'reviewPending' },
    { path: '/orders', label: 'Orders & refunds' },
    { path: '/customers', label: 'Firms (buyers)' },
    { path: '/ai', label: 'AI, profit & replacements', badge: 'replacementsOpen' },
    { path: '/facebook', label: 'Facebook lead ads' },
    { path: '/whatsapp', label: 'WhatsApp' },
    { path: '/categories', label: 'Categories' },
    { path: '/settings', label: 'Store settings' },
];

async function call(path, { form, method = form ? 'POST' : 'GET', raw } = {}) {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Not signed in');
    const res = await fetch(API + path, {
        method, cache: 'no-store',
        headers: { Authorization: `Bearer ${token}`, ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
        body: form ? new URLSearchParams(Object.entries(form).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : v === undefined || v === null || v === false ? [] : [[k, v === true ? '1' : String(v)]]))) : undefined,
    });
    if (raw) return res;
    const j = await res.json().catch(() => ({ ok: false, error: `Marketplace unavailable (${res.status})` }));
    if (res.status === 401 || res.status === 403) throw new Error(j.error || 'Admins only');
    return j;
}

// ---------- small building blocks ----------
function Btn({ children, onClick, kind = 'default', disabled, type = 'button', title }) {
    const styles = {
        default: { background: 'white', color: '#111', border: '1px solid #D1D5DB' },
        primary: { background: '#16A34A', color: 'white', border: '1px solid #16A34A' },
        danger: { background: 'white', color: '#B91C1C', border: '1px solid #FCA5A5' },
    };
    return <button type={type} title={title} disabled={disabled} onClick={onClick} style={{ ...styles[kind], padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1, whiteSpace: 'nowrap' }}>{children}</button>;
}
const Stat = ({ label, value, sub }) => (
    <div style={card}><div style={muted}>{label}</div><div style={{ fontSize: 22, fontWeight: 800, margin: '4px 0' }}>{value}</div>{sub != null && <div style={muted}>{sub}</div>}</div>
);
const Badge = ({ children, tone = 'gray' }) => {
    const c = { green: ['#DCFCE7', '#166534'], red: ['#FEE2E2', '#991B1B'], amber: ['#FEF3C7', '#92400E'], gray: ['#F3F4F6', '#374151'], blue: ['#DBEAFE', '#1E40AF'] }[tone];
    return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 99, background: c[0], color: c[1], fontSize: 12, fontWeight: 600 }}>{children}</span>;
};
const statusTone = (s) => ({ paid: 'green', live: 'green', active: 'green', read: 'green', delivered: 'green', processed: 'green', replaced: 'green', closed: 'green', approved: 'green', APPROVED: 'green', refunded: 'amber', pending: 'amber', review: 'amber', soldout: 'blue', sent: 'blue', cancelled: 'red', failed: 'red', error: 'red', hidden: 'gray' }[s] || 'gray');
function Table({ head, rows, empty }) {
    return (
        <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: '#F9FAFB', textAlign: 'left' }}>{head.map((h, i) => <th key={i} style={{ padding: '9px 10px', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
                <tbody>
                    {rows.length ? rows.map((r, i) => <tr key={i} style={{ borderTop: '1px solid #E5E7EB', verticalAlign: 'top' }}>{r.map((c, j) => <td key={j} style={{ padding: '9px 10px' }}>{c}</td>)}</tr>)
                        : <tr><td colSpan={head.length} style={{ padding: 16, color: '#6B7280' }}>{empty}</td></tr>}
                </tbody>
            </table>
        </div>
    );
}
const Field = ({ label, children, hint }) => (
    <label style={{ display: 'block', marginBottom: 10 }}>
        <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{label}</span>
        {children}
        {hint && <span style={{ display: 'block', ...muted, marginTop: 3 }}>{hint}</span>}
    </label>
);
const Link = ({ to, go, children }) => <a href={'#' + to} onClick={(e) => { e.preventDefault(); go(to); }} style={{ color: '#15803D', fontWeight: 600, textDecoration: 'none' }}>{children}</a>;
const Row = ({ label, children }) => <div style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: '1px solid #F3F4F6', fontSize: 13 }}><span style={{ color: '#6B7280', minWidth: 150 }}>{label}</span><span style={{ flex: 1 }}>{children}</span></div>;

/** Form state helper: values + a submit that posts to the Marketplace admin. */
function useForm(initial) {
    const [v, setV] = useState(initial);
    useEffect(() => { setV(initial); }, [JSON.stringify(initial)]); // eslint-disable-line react-hooks/exhaustive-deps
    const bind = (k, type = 'text') => (type === 'checkbox'
        ? { type, checked: !!v[k], onChange: (e) => setV((x) => ({ ...x, [k]: e.target.checked })) }
        : { type, value: v[k] ?? '', onChange: (e) => setV((x) => ({ ...x, [k]: e.target.value })), style: input });
    return [v, bind, setV];
}

// ---------- the console ----------
export default function MarketplaceConsole({ start = '/', summary, only }) {
    const [route, setRoute] = useState(start);
    const [page, setPage] = useState(null);
    const [flash, setFlash] = useState([]);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async (to) => {
        setBusy(true); setError('');
        try {
            const j = await call(to === '/' ? '' : to);
            if (j.redirect) { setFlash(j.flash || []); return load(strip(j.redirect)); }
            setPage(j);
        } catch (e) { setError(e.message); }
        setBusy(false);
    }, []);
    useEffect(() => { load(route); }, [route, load]);
    useEffect(() => { setRoute(start); }, [start]);

    const go = (to) => { setFlash([]); setRoute(strip(to)); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); };
    const act = async (path, form = {}, { confirm: ask } = {}) => {
        if (ask && !window.confirm(ask)) return null;
        setBusy(true); setError('');
        try {
            const j = await call(strip(path), { form });
            setFlash(j.flash || []);
            if (j.redirect) {
                const to = strip(j.redirect);
                if (to === route) await load(route); else setRoute(to);
            } else if (j.view) setPage(j);
            else if (!j.ok) setError(j.error || 'That did not work.');
            setBusy(false);
            return j;
        } catch (e) { setError(e.message); setBusy(false); return null; }
    };
    const download = async (path, name) => {
        try {
            const res = await call(path, { raw: true });
            if (!res.ok) throw new Error(`Download failed (${res.status})`);
            const url = URL.createObjectURL(await res.blob());
            const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
        } catch (e) { setError(e.message); }
    };
    const ctx = { go, act, download, data: page?.data || {}, route, busy, currency: page?.data?.settings?.currency || 'INR' };
    const section = SECTIONS.find((s) => (s.path === '/' ? route === '/' : route === s.path || route.startsWith(s.path + '/') || route.startsWith(s.path + '?')))?.path;

    return (
        <div>
            {!only && (
                <nav aria-label="Marketplace sections" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                    {SECTIONS.map((s) => {
                        const n = s.badge && summary ? summary[s.badge] : 0;
                        const on = section === s.path;
                        return (
                            <button key={s.path} type="button" onClick={() => go(s.path)} aria-current={on ? 'page' : undefined}
                                style={{ padding: '7px 12px', borderRadius: 99, border: '1px solid ' + (on ? '#16A34A' : '#E5E7EB'), background: on ? '#16A34A' : 'white', color: on ? 'white' : '#111', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                                {s.label}{n > 0 && <span style={{ marginLeft: 6, padding: '0 6px', borderRadius: 99, background: on ? 'white' : '#F97316', color: on ? '#16A34A' : 'white', fontSize: 11 }}>{n}</span>}
                            </button>
                        );
                    })}
                </nav>
            )}
            <div aria-live="polite">
                {flash.map((f, i) => <div key={i} style={{ ...card, padding: 10, marginBottom: 10, background: f.type === 'error' ? '#FEF2F2' : '#F0FDF4', borderColor: f.type === 'error' ? '#FCA5A5' : '#BBF7D0', fontSize: 13 }}>{f.msg}</div>)}
                {error && <div role="alert" style={{ ...card, padding: 10, marginBottom: 10, background: '#FEF2F2', borderColor: '#FCA5A5', color: '#991B1B', fontSize: 13 }}>{error}</div>}
            </div>
            {busy && !page && <div style={card}>Loading…</div>}
            {page && <div style={{ opacity: busy ? 0.6 : 1, transition: 'opacity .15s' }}><View view={page.view} ctx={ctx} /></div>}
        </div>
    );
}
const strip = (to) => {
    let p = String(to || '/');
    try { if (/^https?:/.test(p)) { const u = new URL(p); p = u.pathname + u.search; } } catch { /* keep */ }
    p = p.replace(/^\/marketplace/, '').replace(/^\/admin(?=\/|\?|$)/, '');
    return p === '' ? '/' : p.startsWith('?') ? '/' + p : p;
};

function View({ view, ctx }) {
    switch (view) {
        case 'admin/dashboard': return <Dashboard {...ctx} />;
        case 'admin/leads': return <Leads {...ctx} />;
        case 'admin/lead-form': return <LeadForm {...ctx} />;
        case 'admin/import': return <Import {...ctx} />;
        case 'admin/review': return <Review {...ctx} />;
        case 'admin/orders': return <Orders {...ctx} />;
        case 'admin/order': return <Order {...ctx} />;
        case 'admin/customers': return <Customers {...ctx} />;
        case 'admin/customer': return <Customer {...ctx} />;
        case 'admin/categories': return <Categories {...ctx} />;
        case 'admin/settings': return <StoreSettings {...ctx} />;
        case 'admin/facebook': return <Facebook {...ctx} />;
        case 'admin/whatsapp': return <WhatsApp {...ctx} />;
        case 'admin/ai': return <Ai {...ctx} />;
        default: return <div style={card}>{ctx.data.message || 'Not found.'}</div>;
    }
}

// ---------- Dashboard ----------
function Dashboard({ data, go, currency }) {
    const s = data.stats || {};
    const max = Math.max(1, ...(data.chart || []).map((c) => Number(c.v)));
    return (
        <>
            <div style={grid(170)}>
                <Stat label="Revenue (all time)" value={money(s.revenue, currency)} sub={`${money(s.revenue30, currency)} in 30 days`} />
                <Stat label="Paid orders" value={s.orders} sub={`${s.leadsSold} leads sold`} />
                <Stat label="Leads on sale" value={s.live} sub={`${s.soldOut} sold out · ${s.hidden} hidden`} />
                <Stat label="Firms" value={s.customers} sub={`+${s.newCustomers30} in 30 days`} />
            </div>
            <div style={{ ...card, marginTop: 12 }}>
                <h3 style={h3}>Sales, last 14 days</h3>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 90 }} role="img" aria-label="Daily sales for the last 14 days">
                    {(data.chart || []).map((c) => <div key={c.d} title={`${c.d}: ${money(c.v, currency)}`} style={{ flex: 1, background: Number(c.v) ? '#16A34A' : '#E5E7EB', height: `${Math.max(3, (Number(c.v) / max) * 100)}%`, borderRadius: 3 }} />)}
                </div>
            </div>
            <h2 style={h2}>Latest orders</h2>
            <Table head={['Order', 'Firm', 'Leads', 'Status', 'Total']} empty="No orders yet."
                rows={(data.recentOrders || []).map((o) => [<Link key="o" to={`/orders/${o.id}`} go={go}>{orderNo(o.id)}</Link>, o.customer, o.items, <Badge key="b" tone={statusTone(o.status)}>{o.status}</Badge>, money(o.total_cents, currency)])} />
        </>
    );
}

// ---------- Leads ----------
function Leads({ data, go, act, download, currency }) {
    const f = data.filters || {};
    const [q, setQ] = useState(f.q || '');
    const [status, setStatus] = useState(f.status || '');
    const [category, setCategory] = useState(f.category ? String(f.category) : '');
    const query = (extra = {}) => '/leads?' + new URLSearchParams(Object.entries({ q, status, category, ...extra }).filter(([, v]) => v)).toString();
    const back = query({ page: data.page > 1 ? data.page : '' });
    return (
        <>
            <form onSubmit={(e) => { e.preventDefault(); go(query()); }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <input type="search" aria-label="Search leads" placeholder="Search title, city, contact…" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...input, flex: '1 1 220px', width: 'auto' }} />
                <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...input, width: 'auto' }}>
                    <option value="">All statuses</option><option value="live">On sale</option><option value="soldout">Sold out</option><option value="hidden">Hidden</option>
                </select>
                <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...input, width: 'auto' }}>
                    <option value="">All categories</option>{(data.categories || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <Btn type="submit">Filter</Btn>
                <span style={{ flex: 1 }} />
                <Btn onClick={() => download('/leads/export.csv', 'leads.csv')}>Export CSV</Btn>
                <Btn onClick={() => go('/leads/import')}>Import CSV</Btn>
                <Btn kind="primary" onClick={() => go('/leads/new')}>+ Add lead</Btn>
            </form>
            <p style={muted}>{data.total} lead{data.total === 1 ? '' : 's'}</p>
            <Table head={['#', 'Lead', 'Contact', 'Price', 'Sold', 'Status', '']} empty="No leads found."
                rows={(data.leads || []).map((l) => {
                    const st = l.status === 'hidden' ? 'hidden' : l.sold_count >= l.max_sales ? 'soldout' : 'live';
                    return [l.id,
                        <div key="t"><Link to={`/leads/${l.id}/edit`} go={go}>{l.title}</Link><div style={muted}>{l.category_name || 'Uncategorised'} · {[l.locality, l.city].filter(Boolean).join(', ')}{l.verified ? ' · ✓ verified' : ''}</div></div>,
                        <div key="c">{l.contact_name}<div style={muted}>{l.contact_phone}</div></div>,
                        money(l.price_cents, currency), `${l.sold_count} / ${l.max_sales}`,
                        <Badge key="s" tone={statusTone(st)}>{st === 'soldout' ? 'sold out' : st === 'live' ? 'on sale' : 'hidden'}</Badge>,
                        <div key="a" style={{ display: 'flex', gap: 6 }}><Btn onClick={() => go(`/leads/${l.id}/edit`)}>Edit</Btn><Btn onClick={() => act(`/leads/${l.id}/toggle`, { back: '/admin' + back })}>{l.status === 'active' ? 'Hide' : 'Publish'}</Btn></div>];
                })} />
            <Pager page={data.page} pages={data.pages} to={(p) => query({ page: p })} go={go} />
        </>
    );
}
function Pager({ page, pages, to, go }) {
    if (!pages || pages < 2) return null;
    return (
        <nav aria-label="Pages" style={{ display: 'flex', gap: 6, marginTop: 12, alignItems: 'center' }}>
            <Btn disabled={page <= 1} onClick={() => go(to(page - 1))}>‹ Prev</Btn>
            <span style={muted}>Page {page} of {pages}</span>
            <Btn disabled={page >= pages} onClick={() => go(to(page + 1))}>Next ›</Btn>
        </nav>
    );
}

const LEAD_TEXT = [['title', 'Title *'], ['category', 'Category'], ['property_type', 'Property type'], ['city', 'City *'], ['locality', 'Locality / area'], ['budget', 'Client budget'], ['area_sqft', 'Area (sq ft)'], ['timeline', 'Timeline']];
const CONTACT_TEXT = [['contact_name', 'Contact name'], ['contact_phone', 'Phone'], ['contact_email', 'Email']];
function LeadForm({ data, go, act, currency }) {
    const lead = data.lead;
    const [v, bind] = useForm({ ...data.values, verified: !!data.values?.verified });
    const save = (another) => act(lead ? `/leads/${lead.id}` : '/leads', { ...v, ...(another ? { another: '1' } : {}) });
    return (
        <>
            <div style={{ marginBottom: 10, fontSize: 13 }}><Link to="/leads" go={go}>Leads</Link> / {lead ? `#${lead.id}` : 'New lead'}</div>
            {(data.errors || []).length > 0 && <ul role="alert" style={{ ...card, background: '#FEF2F2', borderColor: '#FCA5A5', color: '#991B1B', fontSize: 13, paddingLeft: 30 }}>{data.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
            <form onSubmit={(e) => { e.preventDefault(); save(false); }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
                <div>
                    <div style={card}>
                        <h3 style={h3}>Public listing — visible to everyone</h3>
                        <datalist id="mp-cats">{(data.categories || []).map((c) => <option key={c.id} value={c.name} />)}</datalist>
                        {LEAD_TEXT.map(([k, l]) => <Field key={k} label={l}><input {...bind(k, k === 'area_sqft' ? 'number' : 'text')} list={k === 'category' ? 'mp-cats' : undefined} required={l.endsWith('*')} /></Field>)}
                        <Field label="Requirement details" hint="Don't put the phone number or email here — this text is public."><textarea rows={5} value={v.description || ''} onChange={bind('description').onChange} style={input} /></Field>
                    </div>
                    <div style={{ ...card, marginTop: 12 }}>
                        <h3 style={h3}>Private contact — revealed only after purchase</h3>
                        {CONTACT_TEXT.map(([k, l]) => <Field key={k} label={l}><input {...bind(k)} /></Field>)}
                        <Field label="Notes for the buyer"><textarea rows={3} value={v.contact_notes || ''} onChange={bind('contact_notes').onChange} style={input} /></Field>
                    </div>
                </div>
                <div>
                    <div style={card}>
                        <h3 style={h3}>Pricing & availability</h3>
                        <Field label={`Price (${currency}) *`}><input {...bind('price', 'number')} min="1" step="0.01" required /></Field>
                        <Field label="Max buyers *" hint={`1 = exclusive lead. Higher = shared lead.${lead ? ` Sold so far: ${lead.sold_count}.` : ''}`}><input {...bind('max_sales', 'number')} min={lead ? Math.max(1, lead.sold_count) : 1} required /></Field>
                        <Field label="Visibility"><select value={v.status === 'hidden' ? 'hidden' : 'active'} onChange={bind('status').onChange} style={input}><option value="active">Published — on sale</option><option value="hidden">Hidden — draft</option></select></Field>
                        <label style={{ display: 'flex', gap: 8, fontSize: 13, marginBottom: 12 }}><input {...bind('verified', 'checkbox')} /> Phone number verified</label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <Btn kind="primary" type="submit">{lead ? 'Save changes' : 'Create lead'}</Btn>
                            {!lead && <Btn onClick={() => save(true)}>Create & add another</Btn>}
                            {lead && <a href={`/marketplace/lead/${lead.id}`} target="_blank" rel="noopener" style={{ alignSelf: 'center', fontSize: 13, color: '#15803D', fontWeight: 600 }}>View in store ↗</a>}
                            {lead && lead.status === 'active' && <Btn onClick={() => act(`/leads/${lead.id}/notify`)}>Send WhatsApp alerts</Btn>}
                        </div>
                    </div>
                    {lead && (
                        <>
                            <div style={{ ...card, marginTop: 12 }}>
                                <h3 style={h3}>Buyers ({lead.buyers.length})</h3>
                                {!lead.buyers.length && <p style={muted}>Nobody has bought this lead yet.</p>}
                                {lead.buyers.map((b) => <div key={b.order_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}><Link to={`/customers/${b.id}`} go={go}>{b.name}{b.company ? ` · ${b.company}` : ''}</Link><Link to={`/orders/${b.order_id}`} go={go}><Badge tone={statusTone(b.status)}>{b.status}</Badge></Link></div>)}
                            </div>
                            <div style={{ ...card, marginTop: 12 }}>
                                <h3 style={h3}>Danger zone</h3>
                                <Btn kind="danger" onClick={() => act(`/leads/${lead.id}/delete`, {}, { confirm: 'Delete this lead? If it has been sold it will be hidden instead.' })}>{lead.buyers.length ? 'Hide from store' : 'Delete lead'}</Btn>
                                <p style={{ ...muted, marginTop: 6 }}>Sold leads can't be deleted, so buyers keep their access.</p>
                            </div>
                        </>
                    )}
                </div>
            </form>
        </>
    );
}

function Import({ data, go, act, download, currency }) {
    const [csv, setCsv] = useState(data.csv || '');
    const [skip, setSkip] = useState(false);
    const r = data.result;
    const readFile = (e) => { const f = e.target.files?.[0]; if (f) f.text().then(setCsv); };
    return (
        <>
            <div style={{ marginBottom: 10, fontSize: 13 }}><Link to="/leads" go={go}>Leads</Link> / Import</div>
            {r && r.created > 0 && <div style={{ ...card, background: '#F0FDF4', marginBottom: 10, fontSize: 13 }}>Imported {r.created} lead{r.created === 1 ? '' : 's'}. <Link to="/leads" go={go}>View leads</Link></div>}
            {r && r.errors?.length > 0 && <ul role="alert" style={{ ...card, background: '#FEF2F2', color: '#991B1B', fontSize: 13, paddingLeft: 30 }}>{r.errors.slice(0, 30).map((e, i) => <li key={i}>{e}</li>)}</ul>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
                <form style={card} onSubmit={(e) => { e.preventDefault(); act('/leads/import', { csv, skip_invalid: skip }); }}>
                    <Field label="Choose a CSV file" hint="Read in your browser and pasted below, so you can check it first."><input type="file" accept=".csv,text/csv" onChange={readFile} /></Field>
                    <Field label="…or paste CSV"><textarea rows={12} required value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={(data.fields || []).join(',')} style={{ ...input, fontFamily: 'monospace', fontSize: 12 }} /></Field>
                    <label style={{ display: 'flex', gap: 8, fontSize: 13, marginBottom: 10 }}><input type="checkbox" checked={skip} onChange={(e) => setSkip(e.target.checked)} /> Skip invalid rows and import the rest</label>
                    <Btn kind="primary" type="submit">Import leads</Btn>
                </form>
                <div style={card}>
                    <h3 style={h3}>Format</h3>
                    <p style={{ fontSize: 13 }}>Header row first. Required: <b>title</b>, <b>city</b>, <b>price</b> ({currency}), and a contact phone or email.</p>
                    <p style={{ ...muted, fontFamily: 'monospace' }}>{(data.fields || []).join(', ')}</p>
                    <p style={{ fontSize: 13 }}>max_sales: 1 = exclusive · verified: yes/no · status: active/hidden · new categories are created automatically.</p>
                    <Btn onClick={() => download('/leads/template.csv', 'leads-template.csv')}>Download template</Btn>
                </div>
            </div>
        </>
    );
}

// ---------- Review ----------
function Review({ data, go, act, currency }) {
    const leads = data.leads || [];
    if (!leads.length) return <div style={card}><h3 style={h3}>Nothing to review</h3><p style={{ fontSize: 13 }}>New Facebook leads that need a human check appear here. Auto-publish rules are under <Link to="/facebook" go={go}>Facebook lead ads</Link>.</p></div>;
    return leads.map((l) => (
        <div key={l.id} style={{ ...card, marginBottom: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            <div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}><Badge>{l.category_name || 'Uncategorised'}</Badge><Badge tone={(l.quality_score ?? 0) >= 70 ? 'green' : (l.quality_score ?? 0) >= 40 ? 'amber' : 'red'}>AI score {l.quality_score ?? 0}</Badge><span style={muted}>{l.source === 'facebook' ? 'Facebook' : l.source} · {date(l.created_at, true)}{l.ai?.campaign ? ' · ' + l.ai.campaign : ''}</span></div>
                <h3 style={{ ...h3, margin: '8px 0 4px' }}>{l.title}</h3>
                <p style={muted}>{[l.locality, l.city].filter(Boolean).join(', ') || 'City unknown'} · {l.property_type || '—'} · {l.budget || 'Budget —'} · {l.timeline || 'Timeline —'}</p>
                <p style={{ fontSize: 13 }}>{l.description}</p>
                {(l.ai?.flags || []).map((f) => <Badge key={f} tone="red">{f.replace(/_/g, ' ')}</Badge>)}
                {l.ai?.reasoning && <p style={{ fontSize: 12, color: '#374151' }}><b>{l.ai.by === 'ai' ? 'AI' : 'Rules'}:</b> {l.ai.reasoning}</p>}
            </div>
            <div>
                <Row label="Name">{l.contact_name || '—'}</Row><Row label="Phone">{l.contact_phone || '—'}</Row><Row label="Email">{l.contact_email || '—'}</Row>
                <Row label="Price"><b>{money(l.price_cents, currency)}</b></Row><Row label="Max buyers"><b>{l.max_sales === 1 ? 'Exclusive' : l.max_sales}</b></Row>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <Btn kind="primary" onClick={() => act(`/review/${l.id}/approve`)}>Approve & publish</Btn>
                    <Btn onClick={() => go(`/leads/${l.id}/edit`)}>Edit first</Btn>
                    <Btn kind="danger" onClick={() => act(`/review/${l.id}/reject`)}>Reject</Btn>
                </div>
            </div>
        </div>
    ));
}

// ---------- Orders ----------
function Orders({ data, go, download, currency }) {
    const f = data.filters || {};
    const [q, setQ] = useState(f.q || '');
    const [status, setStatus] = useState(f.status || '');
    return (
        <>
            <form onSubmit={(e) => { e.preventDefault(); go('/orders?' + new URLSearchParams(Object.entries({ q, status }).filter(([, v]) => v))); }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <input type="search" aria-label="Search orders" placeholder="Order no., firm, mobile, payment ref" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...input, flex: '1 1 220px', width: 'auto' }} />
                <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...input, width: 'auto' }}><option value="">All statuses</option>{['paid', 'pending', 'refunded', 'cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}</select>
                <Btn type="submit">Filter</Btn><span style={{ flex: 1 }} /><Btn onClick={() => download('/orders.csv', 'orders.csv')}>Export CSV</Btn>
            </form>
            <Table head={['Order', 'Firm', 'Date', 'Leads', 'Payment', 'Status', 'Total']} empty="No orders found."
                rows={(data.orders || []).map((o) => [<Link key="o" to={`/orders/${o.id}`} go={go}>{orderNo(o.id)}</Link>, <div key="c"><Link to={`/customers/${o.user_id}`} go={go}>{o.customer}</Link><div style={muted}>{o.phone}</div></div>, date(o.created_at, true), o.items, <div key="p">{o.payment_method}<div style={muted}>{o.payment_ref}</div></div>, <Badge key="s" tone={statusTone(o.status)}>{o.status}</Badge>, money(o.total_cents, currency)])} />
        </>
    );
}
function Order({ data, go, act, currency }) {
    const o = data.order;
    const [status, setStatus] = useState(o.status);
    const [refund, setRefund] = useState(true);
    const canGateway = o.payment_method === 'razorpay' && o.payment_ref && o.status === 'paid';
    const submit = () => act(`/orders/${o.id}/status`, { status, gateway_refund: canGateway && refund }, status === 'paid' ? {} : { confirm: 'The firm will lose access to these leads and the slots go back on sale. Continue?' });
    return (
        <>
            <div style={{ marginBottom: 10, fontSize: 13 }}><Link to="/orders" go={go}>Orders</Link> / {orderNo(o.id)}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
                <div>
                    <Table head={['Lead', 'City', 'Price']} empty="—" rows={[...(data.items || []).map((it) => [<Link key="l" to={`/leads/${it.lead_id}/edit`} go={go}>{it.title}</Link>, it.city, money(it.price_cents, currency)]), [<b key="t">Total</b>, '', <b key="v">{money(o.total_cents, currency)}</b>]]} />
                    <div style={{ ...card, marginTop: 12 }}>
                        <h3 style={h3}>Firm</h3>
                        <Row label="Name"><Link to={`/customers/${o.uid}`} go={go}>{o.name}</Link></Row><Row label="Mobile"><a href={tel(o.phone)}>{o.phone}</a></Row>
                        <Row label="Email">{o.email || '—'}</Row><Row label="Company">{o.company || '—'}</Row>
                    </div>
                </div>
                <div style={card}>
                    <h3 style={h3}>Order</h3>
                    <Row label="Status"><Badge tone={statusTone(o.status)}>{o.status}</Badge></Row><Row label="Date">{date(o.created_at, true)}</Row>
                    <Row label="Payment">{o.payment_method}</Row><Row label="Payment ID">{o.payment_ref || '—'}</Row>
                    {o.gateway_order_id && <Row label="Razorpay order">{o.gateway_order_id}</Row>}
                    {o.note && <Row label="Notes">{o.note}</Row>}
                    {o.payment_method === 'razorpay' && o.payment_ref && <p style={{ fontSize: 13 }}><a href={`https://dashboard.razorpay.com/app/payments/${encodeURIComponent(o.payment_ref)}`} target="_blank" rel="noopener">Open payment in Razorpay ↗</a></p>}
                    <Field label="Change status"><select value={status} onChange={(e) => setStatus(e.target.value)} style={input}>{['paid', 'pending', 'refunded', 'cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}</select></Field>
                    {canGateway && <label style={{ display: 'flex', gap: 8, fontSize: 13, marginBottom: 10 }}><input type="checkbox" checked={refund} onChange={(e) => setRefund(e.target.checked)} /> When refunding, also send {money(o.total_cents, currency)} back via Razorpay</label>}
                    <Btn kind="primary" onClick={submit}>Update status</Btn>
                    <p style={{ ...muted, marginTop: 8 }}>Only <b>paid</b> orders give access to contact details. Refunding or cancelling puts the lead slots back on sale. Wallet payments are refunded to the PlyShip wallet.</p>
                </div>
            </div>
        </>
    );
}

// ---------- Firms ----------
function Customers({ data, go, currency }) {
    const [q, setQ] = useState(data.q || '');
    return (
        <>
            <form onSubmit={(e) => { e.preventDefault(); go('/customers' + (q ? '?q=' + encodeURIComponent(q) : '')); }} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input type="search" aria-label="Search firms" placeholder="Name, mobile, company, city" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...input, flex: 1, width: 'auto' }} /><Btn type="submit">Search</Btn>
            </form>
            <Table head={['Name', 'Company', 'Joined', 'Orders', 'Spent', 'Status']} empty="No firms found."
                rows={(data.customers || []).map((c) => [<div key="n"><Link to={`/customers/${c.id}`} go={go}>{c.name}</Link><div style={muted}>{c.phone}</div></div>, <div key="c">{c.company || '—'}<div style={muted}>{[c.city, c.project_size].filter(Boolean).join(' · ')}</div></div>, date(c.created_at), c.orders, money(c.spent, currency), c.role === 'admin' ? <Badge key="a" tone="blue">admin</Badge> : c.blocked ? <Badge key="s" tone="red">suspended</Badge> : <Badge key="ok" tone="green">active</Badge>])} />
        </>
    );
}
function Customer({ data, go, act, currency }) {
    const c = data.customer;
    const me = data.user?.id === c.id;
    return (
        <>
            <div style={{ marginBottom: 10, fontSize: 13 }}><Link to="/customers" go={go}>Firms</Link> / {c.name}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
                <Table head={['Order', 'Date', 'Leads', 'Status', 'Total']} empty="No orders yet." rows={(data.orders || []).map((o) => [<Link key="o" to={`/orders/${o.id}`} go={go}>{orderNo(o.id)}</Link>, date(o.created_at, true), o.items, <Badge key="s" tone={statusTone(o.status)}>{o.status}</Badge>, money(o.total_cents, currency)])} />
                <div style={card}>
                    <h3 style={h3}>Account</h3>
                    {[['Mobile', <a key="t" href={tel(c.phone)}>{c.phone}</a>], ['Email', c.email || '—'], ['Company', c.company || '—'], ['City', c.city || '—'], ['Services', c.services || '—'], ['Experience', c.experience || '—'], ['Project size', c.project_size || '—'], ['Website', c.website || '—'], ['Joined', date(c.created_at)], ['Role', c.role], ['Status', c.blocked ? 'Suspended' : 'Active']].map(([k, v]) => <Row key={k} label={k}>{v}</Row>)}
                    {!me && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                            <Btn kind={c.blocked ? 'primary' : 'danger'} onClick={() => act(`/customers/${c.id}/block`)}>{c.blocked ? 'Reactivate account' : 'Suspend account'}</Btn>
                            <Btn onClick={() => act(`/customers/${c.id}/role`, {}, { confirm: "Change this user's admin access?" })}>{c.role === 'admin' ? 'Remove admin access' : 'Make admin'}</Btn>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

// ---------- Categories & settings ----------
function Categories({ data, go, act }) {
    const [names, setNames] = useState({});
    const [name, setName] = useState('');
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
            <Table head={['Name', 'Leads', 'On sale', '']} empty="No categories yet."
                rows={(data.categories || []).map((c) => [
                    <form key="n" onSubmit={(e) => { e.preventDefault(); act(`/categories/${c.id}`, { name: names[c.id] ?? c.name }); }} style={{ display: 'flex', gap: 6 }}><input aria-label="Category name" value={names[c.id] ?? c.name} onChange={(e) => setNames((x) => ({ ...x, [c.id]: e.target.value }))} style={input} /><Btn type="submit">Rename</Btn></form>,
                    <Link key="l" to={`/leads?category=${c.id}`} go={go}>{c.leads}</Link>, c.live || 0,
                    <Btn key="d" kind="danger" disabled={Number(c.leads) > 0} title={Number(c.leads) ? 'Move its leads first' : ''} onClick={() => act(`/categories/${c.id}`, { delete: '1' }, { confirm: 'Delete this category?' })}>Delete</Btn>])} />
            <form style={card} onSubmit={(e) => { e.preventDefault(); act('/categories', { name }).then(() => setName('')); }}>
                <h3 style={h3}>New category</h3>
                <Field label="Name"><input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. False Ceiling & Lighting" style={input} /></Field>
                <Btn kind="primary" type="submit">Add category</Btn>
            </form>
        </div>
    );
}
function StoreSettings({ data, act }) {
    const s = data.settings || {};
    const [v, bind] = useForm({ site_name: s.site_name, tagline: s.tagline, support_email: s.support_email, currency: s.currency });
    const p = data.payments || {};
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
            <form style={card} onSubmit={(e) => { e.preventDefault(); act('/settings', v); }}>
                <h3 style={h3}>Store</h3>
                <Field label="Store name"><input {...bind('site_name')} required /></Field>
                <Field label="Tagline"><input {...bind('tagline')} /></Field>
                <Field label="Support email"><input {...bind('support_email', 'email')} /></Field>
                <Field label="Currency" hint="Changes display only — prices are not converted."><select value={v.currency} onChange={bind('currency').onChange} style={input}>{(data.currencies || []).map((c) => <option key={c}>{c}</option>)}</select></Field>
                <Btn kind="primary" type="submit">Save settings</Btn>
            </form>
            <div style={card}>
                <h3 style={h3}>Payments</h3>
                {p.mode === 'razorpay' ? <p style={{ fontSize: 13 }}>Razorpay is <b>connected</b> ({p.keyMode} keys). Webhook {p.webhook ? 'enabled' : <b>not set — add RAZORPAY_WEBHOOK_SECRET</b>}.</p>
                    : p.mode === 'demo' ? <p style={{ fontSize: 13 }}><b>Demo mode</b> — checkout marks orders paid instantly.</p> : <p style={{ fontSize: 13, color: '#991B1B' }}>Payments are disabled (no Razorpay keys).</p>}
                <p style={muted}>Firms mostly pay from their PlyShip wallet; wallet top-ups go through plyship.com's Razorpay.</p>
                <p style={muted}>Sign-in is your PlyShip login — there's no separate Marketplace password.</p>
            </div>
        </div>
    );
}

// ---------- Facebook ----------
function Facebook({ data, go, act }) {
    const c = data.counts || {};
    const st = data.status || {};
    const [pub, bindPub] = useForm({ auto_publish: !!data.autoPublish, min_quality: data.minQuality });
    const [days, setDays] = useState('1');
    const Dot = ({ on }) => <span aria-hidden style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 99, background: on ? '#16A34A' : '#F59E0B', marginRight: 6 }} />;
    return (
        <>
            {data.apiError && <div role="alert" style={{ ...card, background: '#FEF2F2', color: '#991B1B', marginBottom: 12, fontSize: 13 }}>Facebook API error: {data.apiError}</div>}
            <div style={grid(170)}>
                <Stat label="Imported (30 days)" value={c.processed} sub="leads created" />
                <Stat label="Waiting for review" value={c.pending} sub={<Link to="/review" go={go}>Open review queue</Link>} />
                <Stat label="Duplicates skipped" value={c.duplicate} sub="same phone within 60 days" />
                <Stat label="Errors" value={c.error} sub="retry below" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12, marginTop: 12 }}>
                <div>
                    <div style={card}>
                        <h3 style={h3}>Connection</h3>
                        <p style={{ fontSize: 13 }}><Dot on={st.configured} />System user token {st.configured ? '' : '— add FB_SYSTEM_TOKEN'} · <b>{(data.pages || []).filter((p) => p.connected).length} page(s) connected</b></p>
                        <p style={{ fontSize: 13 }}><Dot on={st.webhook} />Webhook security {st.webhook ? '' : '— add FB_APP_SECRET and FB_VERIFY_TOKEN'}</p>
                        <p style={{ fontSize: 13 }}><Dot on={st.ai} />AI lead cleanup {st.ai ? '(Claude)' : '— rules only'}</p>
                        <p style={{ fontSize: 13 }}><Dot on={st.cron} />Daily safety-net sync</p>
                        <Field label="Webhook callback URL"><input readOnly value={data.webhookUrl || ''} style={input} /></Field>
                        <Field label="Verify token"><input readOnly value={data.verifyToken || 'not set'} style={input} /></Field>
                    </div>
                    <div style={{ ...card, marginTop: 12 }}>
                        <h3 style={h3}>Facebook Pages</h3>
                        {st.configured && !(data.pages || []).length && !data.apiError && <p style={muted}>No Pages are assigned to the system user yet.</p>}
                        {(data.pages || []).map((p) => (
                            <div key={p.id} style={{ borderTop: '1px solid #F3F4F6', padding: '10px 0' }}>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <Dot on={p.connected && !p.missing} /><b>{p.name}</b><span style={muted}>{p.id}</span><span style={{ flex: 1 }} />
                                    {!p.connected ? <Btn kind="primary" onClick={() => act(`/facebook/pages/${p.id}/connect`)}>Connect</Btn> : (
                                        <>
                                            {!p.subscribed && !p.missing && <><Btn onClick={() => act(`/facebook/pages/${p.id}/connect`)}>Retry instant delivery</Btn><Btn onClick={() => act(`/facebook/pages/${p.id}/mark-subscribed`)}>I subscribed it manually</Btn></>}
                                            <Btn kind="danger" onClick={() => act(`/facebook/pages/${p.id}/disconnect`)}>Disconnect</Btn>
                                        </>
                                    )}
                                </div>
                                {p.connected && <div style={{ ...muted, margin: '4px 0' }}>{p.missing ? 'No longer assigned to the system user' : (p.subscribed ? 'Instant delivery on' : 'Sync only') + (p.error ? ' · forms: ' + p.error : ` · ${p.forms.length} lead form(s)`)}</div>}
                                {p.connected && (p.forms || []).map((f) => {
                                    const firm = f.kind === 'firm';
                                    const live = !f.blocked && (f.approved || data.cfgImportAll);
                                    const what = f.blocked ? 'Stopped' : !live ? 'Not imported' : firm ? 'Firm sign-ups → prospects' : f.approved || f.consentOk ? 'Homeowner leads → on sale' : f.consentOk === false ? 'Homeowner leads → review (no sharing text)' : 'Homeowner leads';
                                    return (
                                        <div key={f.id} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 13, padding: '4px 0 4px 14px' }}>
                                            <span>{f.blocked ? '⛔' : live ? '✅' : '⏸️'} <b>{f.name}</b> ({f.status}{f.leads_count != null ? `, ${f.leads_count} leads` : ''}) — <span style={muted}>{what}</span></span>
                                            <span style={{ flex: 1 }} />
                                            <Btn onClick={() => act(`/facebook/forms/${f.id}/kind`, { kind: firm ? 'homeowner' : 'firm' })}>{firm ? 'Treat as homeowner leads' : 'Firm sign-up form'}</Btn>
                                            {f.blocked || !live
                                                ? <Btn kind="primary" onClick={() => act(`/facebook/forms/${f.id}/approve`, { page_id: p.id, name: f.name, consent: '1' }, firm ? {} : { confirm: 'Import this form? Only if it tells people their details are shared with interior companies.' })}>Import</Btn>
                                                : <Btn kind="danger" onClick={() => act(`/facebook/forms/${f.id}/stop`, { page_id: p.id, name: f.name })}>Stop importing</Btn>}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                        {(data.needAccess || []).length > 0 && <p style={{ fontSize: 13, marginTop: 10 }}><b>In your business, but PlyShip can't use them yet:</b> {data.needAccess.map((p) => p.name).join(', ')} — give the system user access in <a href="https://business.facebook.com/latest/settings/pages" target="_blank" rel="noopener">Business Settings → Pages ↗</a>, then <Btn onClick={() => go('/facebook')}>Check for new Pages</Btn></p>}
                    </div>
                </div>
                <div>
                    <form style={card} onSubmit={(e) => { e.preventDefault(); act('/facebook/settings', pub); }}>
                        <h3 style={h3}>Publishing</h3>
                        <label style={{ display: 'flex', gap: 8, fontSize: 13, marginBottom: 10 }}><input {...bindPub('auto_publish', 'checkbox')} /> Auto-publish good leads</label>
                        <Field label="Minimum AI quality score to auto-publish" hint="Lower scores, invalid phones and spam go to the review queue."><input {...bindPub('min_quality', 'number')} min="0" max="100" /></Field>
                        <Btn kind="primary" type="submit">Save</Btn>
                    </form>
                    <form style={{ ...card, marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); act('/facebook/sync', { days }); }}>
                        <h3 style={h3}>Import now (one-off)</h3>
                        <p style={muted}>New leads arrive instantly; a backup check runs every morning. Use this only to pull older leads — duplicates are skipped.</p>
                        <Field label="Fetch leads from the last"><select value={days} onChange={(e) => setDays(e.target.value)} style={input}>{[['1', '1 day'], ['7', '7 days'], ['30', '30 days'], ['90', '90 days']].map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
                        <Btn kind="primary" type="submit" disabled={!st.configured}>Sync from Facebook</Btn>
                    </form>
                </div>
            </div>
            <h2 style={h2}>Recent activity</h2>
            <Table head={['Received', 'Facebook lead', 'Via', 'Page / campaign', 'Result', '']} empty="No Facebook leads received yet."
                rows={(data.events || []).map((e) => [date(e.created_at, true), <span key="i" style={muted}>{e.leadgen_id}</span>, e.via, <div key="p">{e.page_name}<div style={muted}>{e.campaign_name}</div></div>,
                    <div key="r"><Badge tone={statusTone(e.status)}>{e.status}</Badge>{e.lead_id && <div><Link to={`/leads/${e.lead_id}/edit`} go={go}>{e.lead_title || 'Lead #' + e.lead_id}</Link></div>}{e.error && <div style={{ ...muted, color: '#B91C1C' }}>{e.error}</div>}</div>,
                    e.status === 'error' ? <Btn key="b" onClick={() => act(`/facebook/retry/${e.id}`)}>Retry</Btn> : ''])} />
        </>
    );
}

// ---------- WhatsApp ----------
function WhatsApp({ data, go, act }) {
    const c = data.counts || {};
    const cfg = data.cfg || {};
    const [v, bind] = useForm({ enabled: !!cfg.enabled, per_lead: cfg.perLead, per_user_day: cfg.perUserDay });
    const ph = data.phone;
    return (
        <>
            {data.apiError && <div role="alert" style={{ ...card, background: '#FEF2F2', color: '#991B1B', marginBottom: 12, fontSize: 13 }}>WhatsApp API: {data.apiError}</div>}
            <div style={grid(170)}>
                <Stat label="Firms opted in" value={c.opted_in} sub={`${c.opted_out} opted out`} />
                <Stat label="Sent (24 hours)" value={c.sent_24h} sub="lead alerts" />
                <Stat label="Read rate (30 days)" value={c.sent_30d ? Math.round((c.read_30d / c.sent_30d) * 100) + '%' : '—'} sub={`${c.read_30d} of ${c.sent_30d} read`} />
                <Stat label="Automatic alerts" value={cfg.enabled ? 'On' : 'Off'} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12, marginTop: 12 }}>
                <div style={card}>
                    <h3 style={h3}>Business number</h3>
                    {data.linked?.on ? (
                        <>
                            <p style={{ fontSize: 13 }}>Messages go from <b>{data.linked.display || data.linked.phone}</b> through Meta's WhatsApp Cloud API (billed by Meta). Linked {data.linked.at ? date(data.linked.at, true) : ''}.</p>
                            <Btn kind="danger" onClick={() => act('/whatsapp/unlink', {}, { confirm: 'Switch messages back to the Meta test number?' })}>Switch back to test number</Btn>
                        </>
                    ) : (
                        <p style={{ fontSize: 13 }}>No business number linked. <a href="/marketplace/admin/whatsapp" onClick={(e) => { e.preventDefault(); openMarketplace('/admin/whatsapp'); }}>Connect the WhatsApp Business app ↗</a> (Meta's sign-up window opens there).</p>
                    )}
                    {ph && <><Row label="Number">{ph.display_phone_number}{ph.verified_name ? ` · ${ph.verified_name}` : ''}</Row><Row label="Quality rating">{ph.quality_rating || '—'}</Row><Row label="Messaging limit">{(ph.messaging_limit_tier || 'TIER_250').replace('TIER_', '').replace('_', ' ')} people / 24h</Row></>}
                    <Row label={`Template ${data.ids?.template || ''}`}>{data.template ? <Badge tone={statusTone(data.template.status)}>{data.template.status}</Badge> : data.configured ? <Btn onClick={() => act('/whatsapp/template')}>Create template</Btn> : '—'}</Row>
                    <Row label="Delivery receipts & replies"><Btn onClick={() => act('/whatsapp/subscribe')}>Connect</Btn></Row>
                    <p style={muted}>Meta app → Webhooks → WhatsApp Business Account → callback {data.webhookUrl}, subscribe to messages.</p>
                </div>
                <div>
                    <form style={card} onSubmit={(e) => { e.preventDefault(); act('/whatsapp/settings', v); }}>
                        <h3 style={h3}>Automatic lead alerts</h3>
                        <label style={{ display: 'flex', gap: 8, fontSize: 13, marginBottom: 10 }}><input {...bind('enabled', 'checkbox')} /> Send WhatsApp alerts when a lead is published</label>
                        <Field label="Max firms per lead"><input {...bind('per_lead', 'number')} min="1" max="100" /></Field>
                        <Field label="Max alerts per firm / day"><input {...bind('per_user_day', 'number')} min="1" max="50" /></Field>
                        <p style={muted}>Only firms that asked for alerts, nearest first. Each message costs about ₹0.8–0.9 (Meta's rate).</p>
                        <Btn kind="primary" type="submit">Save</Btn>
                    </form>
                    <div style={{ ...card, marginTop: 12 }}>
                        <h3 style={h3}>Test</h3>
                        <p style={muted}>Sends the lead-alert template to your own number ({data.user?.phone}).</p>
                        <Btn disabled={!data.configured} onClick={() => act('/whatsapp/test')}>Send me a test alert</Btn>
                    </div>
                </div>
            </div>
            <h2 style={h2}>Recent messages</h2>
            <Table head={['When', 'To', 'Lead', 'Status']} empty="No WhatsApp messages yet."
                rows={(data.log || []).map((m) => [date(m.created_at, true), <div key="f">{m.user_name || '—'}<div style={muted}>{m.company || ''} · {m.phone}</div></div>, m.lead_id ? <Link key="l" to={`/leads/${m.lead_id}/edit`} go={go}>{m.lead_title || 'Lead #' + m.lead_id}</Link> : (m.kind || '—'), <div key="s"><Badge tone={statusTone(m.status)}>{m.status}</Badge>{m.error && <div style={{ ...muted, color: '#B91C1C' }}>{m.error}</div>}</div>])} />
        </>
    );
}

// ---------- AI: profit, autopilot, pricing, unsold leads, replacements, ratings, call list, invites, prospects ----------
function Ai({ data, go, act, currency }) {
    const latest = (data.reports || [])[0];
    const p30 = data.profit30 || {}, p7 = data.profit7 || {};
    const leverInit = Object.fromEntries((data.levers || []).map((l) => [l.key, l.value ?? '']));
    const [auto, bindAuto] = useForm({ autopilot: !!data.autopilot, ...leverInit, banner: data.banner, spend_filter: data.spendFilter, manual_spend: data.manualSpend, chat_per_user: data.chat?.perUser, chat_total: data.chat?.total });
    const [cfg, bindCfg] = useForm({ import_all: !!data.cfg?.importAll, auto_publish: !!data.cfg?.autoPublish, min_quality: data.cfg?.minQuality });
    const inv = data.invites || {};
    const [invV, bindInv] = useForm({ enabled: !!inv.enabled, per_day: inv.perDay });
    const [city, setCity] = useState('');
    const [notes, setNotes] = useState({});
    const fr = data.freshness || {}, life = data.life || {}, fc = data.feedbackCounts || {}, pol = data.policy || {}, reasons = data.REASONS || {};
    return (
        <>
            <div style={grid(170)}>
                <Stat label="Last AI review" value={latest ? date(latest.created_at) : '—'} sub={latest ? (latest.by === 'ai' ? 'by AI' : 'by rules') : 'runs daily'} />
                <Stat label="Segments tracked" value={(data.stats || []).length} sub="city × project type" />
                <Stat label="Open leads" value={(data.stats || []).reduce((a, s) => a + Number(s.open_now || 0), 0)} sub="on sale now" />
                <Stat label="Prospects" value={data.prospectCounts?.total} sub={`${data.prospectCounts?.new || 0} not called yet`} />
            </div>

            <h2 style={h2} id="mp-profit">Profit</h2>
            <div style={grid(170)}>
                <Stat label="Profit · 30 days" value={inr(p30.profit)} sub={`${p30.margin == null ? 'no sales yet' : p30.margin + '% margin'} · 7 days ${inr(p7.profit)}`} />
                <Stat label="Revenue · 30 days" value={inr(p30.revenue)} sub={`${p30.sold_slots || 0} lead sales`} />
                <Stat label="Ad spend · 30 days" value={inr(p30.ad_spend)} sub={`${p30.leads_imported || 0} leads · ${p30.cost_per_lead == null ? 'cost/lead —' : inr(p30.cost_per_lead) + ' per lead'}`} />
                <Stat label="WhatsApp · 30 days" value={inr(p30.wa_cost)} sub={`replacements given ${inr(p30.replacements_value)}`} />
            </div>

            <h2 style={h2}>AI autopilot & today's review</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
                <form style={card} onSubmit={(e) => { e.preventDefault(); act('/ai/autopilot', auto); }}>
                    <label style={{ display: 'flex', gap: 8, fontSize: 13, marginBottom: 10, fontWeight: 600 }}><input {...bindAuto('autopilot', 'checkbox')} /> Let the AI change these every morning (within the limits)</label>
                    {(data.levers || []).map((l) => <Field key={l.key} label={`${l.label} (${l.min}–${l.max})`}><input {...bindAuto(l.key, 'number')} min={l.min} max={l.max} placeholder="default" /></Field>)}
                    <Field label="Marketplace homepage message (blank = none)"><input {...bindAuto('banner')} maxLength={120} /></Field>
                    <Field label="Count ad spend of campaigns named like (blank = all with leads)"><input {...bindAuto('spend_filter')} /></Field>
                    <Field label="Ad spend per day if Meta can't be read (₹)"><input {...bindAuto('manual_spend', 'number')} min="0" /></Field>
                    <Field label="Help-chat AI replies per firm per day (0 = buttons only)"><input {...bindAuto('chat_per_user', 'number')} min="0" max="50" /></Field>
                    <Field label="Help-chat AI replies per day, whole site"><input {...bindAuto('chat_total', 'number')} min="0" max="2000" /></Field>
                    <Btn kind="primary" type="submit">Save</Btn>
                </form>
                <div>
                    <div style={card}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}><h3 style={{ ...h3, margin: 0, flex: 1 }}>Today's AI review</h3><Btn onClick={() => act('/ai/run')}>Run review now</Btn></div>
                        {!latest ? <p style={muted}>No review yet — it runs every morning.</p> : (
                            <>
                                <p style={{ fontSize: 14, lineHeight: 1.5 }}>{latest.summary}</p>
                                {latest.insights?.length > 0 && <ul style={{ fontSize: 13, paddingLeft: 18 }}>{latest.insights.map((i, k) => <li key={k}>{i}</li>)}</ul>}
                                {latest.actions?.map((a, k) => <div key={k} style={{ fontSize: 13, padding: '8px 10px', borderRadius: 10, background: '#F9FAFB', marginBottom: 6 }}><b>{a.action}</b><div style={muted}>{a.why}</div></div>)}
                            </>
                        )}
                    </div>
                    <div style={{ ...card, marginTop: 12 }}>
                        <h3 style={h3}>Selling loop</h3>
                        <p style={muted}>Alerts firms in waves, delivers leads on WhatsApp, asks for feedback and ratings, decides replacements. Runs every hour by itself.</p>
                        <Btn onClick={() => act('/outreach/run')}>Run selling loop now</Btn>
                    </div>
                    <form style={{ ...card, marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); act('/ai/settings', cfg); }}>
                        <h3 style={h3}>Lead import & publishing</h3>
                        <label style={{ display: 'flex', gap: 8, fontSize: 13, marginBottom: 6 }}><input {...bindCfg('import_all', 'checkbox')} /> Import leads from every form on connected Pages</label>
                        <label style={{ display: 'flex', gap: 8, fontSize: 13, marginBottom: 10 }}><input {...bindCfg('auto_publish', 'checkbox')} /> Publish good interior leads automatically</label>
                        <Field label="Minimum AI quality to auto-publish"><input {...bindCfg('min_quality', 'number')} min="0" max="100" /></Field>
                        <Btn kind="primary" type="submit">Save</Btn>
                    </form>
                    <div style={{ ...card, marginTop: 12 }}>
                        <h3 style={h3}>Status</h3>
                        <Row label="Claude AI">{data.ai ? 'On' : 'Rules only'}</Row><Row label="Daily schedule">{data.cronOn ? 'On' : 'Off'}</Row><Row label="Google Places">{data.places ? 'On' : 'Needs API key'}</Row>
                    </div>
                </div>
            </div>

            <h2 style={h2}>Demand & pricing by segment (90 days)</h2>
            <Table head={['City · type', 'Leads', 'Sell-through', 'Median sold', 'Hrs to 1st sale', 'Views', 'Open', 'Demand ×']} empty="No leads in the last 90 days."
                rows={(data.stats || []).map((s) => { const [ct, cat] = s.segment.split('|'); return [<div key="c"><b>{ct}</b><div style={muted}>{cat}</div></div>, s.listed, pct(s.sell_through), s.median_sold_price ? inr(s.median_sold_price) : '—', s.avg_hours_to_first_sale ?? '—', s.views, s.open_now, <b key="m">{(Number(data.mult?.[s.segment]) || 1).toFixed(2)}</b>]; })} />
            <p style={muted}>Demand × sets the price of new leads (0.80–1.30). A lead's price never changes after its first sale; unsold leads drop 10–15% a day from day 2, never below their floor.</p>
            {(data.changes || []).length > 0 && <div style={{ ...card, marginTop: 10 }}><h3 style={h3}>Recent price changes</h3>{data.changes.map((c, i) => <div key={i} style={{ fontSize: 13, padding: '4px 0' }}><span style={muted}>{date(c.created_at, true)}</span> · <Link to={`/leads/${c.lead_id}/edit`} go={go}>{c.title}</Link> · {money(c.old_cents, currency)} → <b>{money(c.new_cents, currency)}</b><div style={muted}>{c.reason}</div></div>)}</div>}
            {(data.buyers || []).length > 0 && <p style={{ ...muted, marginTop: 8 }}>Buyers by city: {data.buyers.slice(0, 12).map((b) => `${b.city} ${b.buyers}`).join(' · ')}</p>}

            <h2 style={h2}>Unsold leads — checking with the homeowner</h2>
            <div style={grid(170)}>
                <Stat label="Asked · 30 days" value={fr.asked} sub={`after ${life.checkDay} days unsold`} />
                <Stat label="Still looking" value={fr.still_looking} sub={`${fr.sold_after_reconfirm || 0} sold after`} />
                <Stat label="Done / not now" value={`${fr.done || 0} / ${fr.later || 0}`} />
                <Stat label="Expired" value={fr.expired} sub={`no answer in ${life.expireDays} days`} />
            </div>
            <div style={{ ...card, marginTop: 12 }}>
                <Row label={`WhatsApp check (${data.checkTemplateName})`}>{data.checkTemplate ? <Badge tone={statusTone(data.checkTemplate.status)}>{data.checkTemplate.status}</Badge> : <Btn onClick={() => act('/lifecycle-template')}>Create template</Btn>}</Row>
                <h3 style={{ ...h3, marginTop: 12 }}>Call to confirm ({(data.homeownerCalls || []).length})</h3>
                {!(data.homeownerCalls || []).length && <p style={muted}>Nothing to call — homeowners who allowed WhatsApp are asked automatically.</p>}
                {(data.homeownerCalls || []).map((c) => (
                    <div key={c.id} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', padding: '8px 0', borderTop: '1px solid #F3F4F6', fontSize: 13 }}>
                        <span style={{ flex: '1 1 200px' }}><b>{c.contact_name || 'Homeowner'}</b> · <Link to={`/leads/${c.lead_id}/edit`} go={go}>{c.title}</Link><div style={muted}>{c.city}</div></span>
                        <a href={tel(c.contact_phone)} style={{ fontWeight: 600 }}>📞 Call</a>
                        {[['yes', 'Still looking'], ['done', 'Done'], ['later', 'Not now'], ['no_answer', 'No answer']].map(([a, l]) => <Btn key={a} onClick={() => act(`/lifecycle/${c.id}`, { answer: a })}>{l}</Btn>)}
                    </div>
                ))}
            </div>

            <h2 style={h2}>Lead feedback & replacements</h2>
            <div style={grid(170)}>
                <Stat label="Delivered · 30 days" value={fc.delivered} sub="leads sent on WhatsApp" />
                <Stat label="Rated good" value={fc.good} sub={`${fc.bad || 0} reported a problem`} />
                <Stat label="Replaced" value={fc.replaced} sub="free, same city" />
                <Stat label="Need you" value={fc.review} sub="reports to check" />
            </div>
            <div style={{ ...card, margin: '12px 0' }}>
                <Row label={`Delivery template (${data.templates?.deliveryName})`}>{data.templates?.delivery ? <Badge tone={statusTone(data.templates.delivery.status)}>{data.templates.delivery.status}</Badge> : 'not created'}</Row>
                <Row label={`Feedback template (${data.templates?.feedbackName})`}>{data.templates?.feedback ? <Badge tone={statusTone(data.templates.feedback.status)}>{data.templates.feedback.status}</Badge> : 'not created'}</Row>
                {(!data.templates?.delivery || !data.templates?.feedback) && <Btn onClick={() => act('/delivery/templates')}>Create delivery, feedback & rating templates</Btn>}
                <p style={muted}>Rules the AI can't break: reports within {pol.windowDays} days; "not reachable" only after {pol.waitHours} h; "already hired" is never replaced.</p>
            </div>
            <Table head={['Firm', 'Lead', 'Report', 'Decision', '']} empty="No feedback yet — it starts with the first sale."
                rows={(data.feedback || []).map((f) => [
                    <div key="f"><b>{f.company || f.user_name}</b><div style={muted}>{f.phone}{f.replacements_blocked ? ' · replacements off' : ''}</div></div>,
                    <div key="l"><Link to={`/leads/${f.lead_id}/edit`} go={go}>{f.title}</Link><div style={muted}>{f.city}</div></div>,
                    <div key="r">{f.rating === 'good' ? '👍 Good' : f.rating === 'bad' ? '👎 ' + (reasons[f.reason] || 'details pending') : '—'}{f.details && <div style={muted}>{f.details}</div>}</div>,
                    <div key="d"><b>{String(f.status).replace('_', ' ')}</b>{f.decision_by && <span style={muted}> by {f.decision_by}</span>}{f.decision_note && <div style={muted}>{f.decision_note}</div>}{f.replacement_title && <div style={muted}>→ {f.replacement_title}</div>}</div>,
                    <div key="a" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {f.rating === 'bad' && !['replaced', 'replace_pending'].includes(f.status) && <Btn kind="primary" onClick={() => act(`/feedback/${f.id}/decide`, { decision: 'replace', notify: '1' })}>Replace</Btn>}
                        {f.status === 'review' && <Btn kind="danger" onClick={() => act(`/feedback/${f.id}/decide`, { decision: 'reject', notify: '1' })}>Reject</Btn>}
                        <Btn onClick={() => act(`/users/${f.user_id}/replacements`, f.replacements_blocked ? {} : { block: '1' })}>{f.replacements_blocked ? 'Allow replacements' : 'Block replacements'}</Btn>
                    </div>])} />

            <h2 style={h2}>How homeowners rate the firms</h2>
            <p style={muted}>{data.homeowners?.n} homeowner accounts ({data.homeowners?.month} this month). Well-rated firms get new leads first; firms reported for not calling get fewer.</p>
            <Table head={['Firm', 'Ratings', 'Avg ★', "Didn't call", 'Latest comment']} empty="No ratings yet."
                rows={(data.firmRatings || []).map((f) => [<div key="f"><b>{f.company || f.name}</b><div style={muted}>{f.city}</div></div>, f.ratings, f.avg_stars ?? '—', <b key="n">{f.no_calls}</b>, f.last_comment || ''])} />

            <h2 style={h2}>Call list — new firms for unsold leads</h2>
            <p style={muted}>Best-rated interior firms from Google Maps that aren't buyers yet. Call them; when they agree to WhatsApp alerts press “Agreed” and the AI takes over.</p>
            {!(data.calls || []).length && <div style={card}>No open leads right now.</div>}
            {(data.calls || []).map((c) => (
                <div key={c.name} style={{ ...card, marginBottom: 10 }}>
                    <h3 style={h3}>{c.name} <span style={{ ...muted, fontWeight: 400 }}>· {c.open} open lead{c.open === 1 ? '' : 's'} from {money(c.from_cents, currency)}</span></h3>
                    {!c.firms.length && <p style={muted}>No firms to call yet — the hourly loop searches Google Maps when a lead stays unsold for 12 hours.</p>}
                    {c.firms.map((p) => {
                        const d = String(p.phone || '').replace(/\D/g, '').slice(-10);
                        const msg = `Hi, this is from PlyShip (plyship.com). We have ${c.open} homeowner interior ${c.open === 1 ? 'enquiry' : 'enquiries'} in ${c.name}. Can we send you new leads on WhatsApp?`;
                        return (
                            <div key={p.id} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', padding: '6px 0', borderTop: '1px solid #F3F4F6', fontSize: 13 }}>
                                <span style={{ flex: '1 1 220px' }}><b>{p.name}</b> <span style={muted}>{p.distance_km != null ? Math.round(p.distance_km * 10) / 10 + ' km · ' : ''}{p.rating ? `★ ${p.rating} (${p.reviews || 0})` : ''} · {p.status}</span></span>
                                <a href={tel(p.phone)} style={{ fontWeight: 600 }}>📞 {p.phone}</a>
                                {d.length === 10 && <a href={`https://wa.me/91${d}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener" style={{ fontSize: 13 }}>Message from my phone ↗</a>}
                                <Btn kind="primary" onClick={() => act(`/prospects/${p.id}/optin`, { agreed: '1', back: 'calls' }, { confirm: `Did ${p.name} agree on the call to get WhatsApp messages from PlyShip? They may get an invite right away.` })}>Agreed</Btn>
                                <Btn onClick={() => act(`/prospects/${p.id}`, { status: 'not_interested' })}>Not interested</Btn>
                            </div>
                        );
                    })}
                </div>
            ))}

            <h2 style={h2}>WhatsApp invites to interior firms</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
                <div style={card}>
                    <p style={{ fontSize: 13 }}>Firms that <b>agreed</b> to WhatsApp messages ({data.prospectCounts?.opted_in || 0} so far) get an invite when leads are open in their city — at most once every {inv.every} days.</p>
                    {inv.waLink && <Field label="Link for ads, website and Instagram bio"><input readOnly value={inv.waLink} onFocus={(e) => e.target.select()} style={input} /></Field>}
                    <p style={muted}>Google Maps firms are never messaged until they agree — that protects the WhatsApp number.</p>
                </div>
                <form style={card} onSubmit={(e) => { e.preventDefault(); act('/invites/settings', invV); }}>
                    <Row label={`Template ${inv.name || ''}`}>{inv.template ? <Badge tone={statusTone(inv.template.status)}>{inv.template.status}</Badge> : <Btn onClick={() => act('/invites/template')}>Create invite template</Btn>}</Row>
                    <label style={{ display: 'flex', gap: 8, fontSize: 13, margin: '10px 0' }}><input {...bindInv('enabled', 'checkbox')} /> Send invites automatically (daily)</label>
                    <Field label="Max invites per day"><input {...bindInv('per_day', 'number')} min="1" max="250" /></Field>
                    <p style={muted}>Sent: {inv.counts?.day || 0} today · {inv.counts?.month || 0} in 30 days · {inv.counts?.read || 0} read.</p>
                    <div style={{ display: 'flex', gap: 8 }}><Btn kind="primary" type="submit">Save</Btn><Btn onClick={() => act('/invites/run')}>Send due invites now</Btn></div>
                </form>
            </div>

            <h2 style={h2}>Interior firm prospects</h2>
            {data.places && (
                <form onSubmit={(e) => { e.preventDefault(); act('/prospects/find', { city }); }} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <input required value={city} onChange={(e) => setCity(e.target.value)} placeholder="City, e.g. Hyderabad" aria-label="City" style={{ ...input, maxWidth: 260 }} /><Btn kind="primary" type="submit">Find interior firms</Btn>
                </form>
            )}
            <Table head={['Firm', 'Phone', 'City', 'Rating', 'WhatsApp', 'Status & notes']} empty={data.places ? 'No prospects yet — search a city above.' : 'Add a Google Places API key to find firms automatically.'}
                rows={(data.prospects || []).map((p) => {
                    const n = notes[p.id] || { status: p.status, notes: p.notes || '' };
                    return [
                        <div key="n"><b>{p.name}</b>{p.website && <div><a href={p.website} target="_blank" rel="noopener noreferrer" style={muted}>website ↗</a></div>}</div>,
                        <a key="t" href={tel(p.phone)}>{p.phone}</a>, p.city, p.rating ? `${p.rating} ★ (${p.reviews || 0})` : '—',
                        <div key="w"><label style={{ display: 'flex', gap: 6, fontSize: 13 }} title="Tick only if they agreed to WhatsApp messages"><input type="checkbox" checked={!!p.wa_opt_in} onChange={(e) => act(`/prospects/${p.id}/optin`, e.target.checked ? { agreed: '1' } : {}, e.target.checked ? { confirm: `Did ${p.name} agree to get WhatsApp messages from PlyShip? They may get an invite right away.` } : {})} /> Agreed</label>{p.wa_opt_out_at && <div style={muted}>opted out</div>}</div>,
                        <form key="s" onSubmit={(e) => { e.preventDefault(); act(`/prospects/${p.id}`, n); }} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <select aria-label="Status" value={n.status} onChange={(e) => setNotes((x) => ({ ...x, [p.id]: { ...n, status: e.target.value } }))} style={{ ...input, width: 'auto' }}>{['new', 'contacted', 'interested', 'joined', 'not_interested'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select>
                            <input aria-label="Notes" value={n.notes} onChange={(e) => setNotes((x) => ({ ...x, [p.id]: { ...n, notes: e.target.value } }))} placeholder="Notes" style={{ ...input, width: 160 }} />
                            <Btn type="submit">Save</Btn>
                        </form>];
                })} />
        </>
    );
}
