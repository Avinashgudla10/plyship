// One platform: the Marketplace (plyship.com/marketplace) uses the PlyShip login and profile directly.
// These run in the background so people never see a Marketplace sign-in page or fill a second form.
import { auth } from './firebase';

async function call(path, body) {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Not signed in');
    const res = await fetch(`/marketplace/api/me/${path}`, {
        method: 'POST', credentials: 'same-origin',
        headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok && !json.needsProfile) throw new Error(json.error || 'Something went wrong');
    return json;
}

/** Opens a Marketplace page already signed in (the session starts first, invisibly). */
export async function openMarketplace(path = '/') {
    try {
        const j = await call('session');
        if (j.needsProfile) { window.location.href = '/profile-setup'; return; }
    } catch { /* the page still opens; its own silent sign-in tries again */ }
    window.location.href = '/marketplace' + (path === '/' ? '' : path);
}

/** Homeowner: free quotes from the number of verified firms they choose (1–5, nearest first) — built from the PlyShip profile. */
export const requestQuotes = (firms) => call('enquiry', { consent: true, ...(firms ? { firms } : {}) });

/** How many free quotes a homeowner can ask for. */
export const QUOTE_CHOICES = [1, 2, 3, 4, 5];

/** Interior company: new homeowner leads near them on WhatsApp. */
export const enableLeadAlerts = () => call('alerts', { on: true });

/** Shown wherever a homeowner agrees to share their requirement (same words as the Marketplace forms). */
export const QUOTES_CONSENT = 'Your name, phone number and project details will be shared with the number of verified interior design firms you choose (nearest to you first) through PlyShip so they can send you quotes. PlyShip and these firms may contact you by call or WhatsApp about this enquiry. Reply STOP on WhatsApp at any time.';
export const ALERTS_CONSENT = 'PlyShip will WhatsApp you new homeowner leads near your office. Reply STOP at any time.';
