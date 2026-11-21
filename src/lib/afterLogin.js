// One sign-in for plyship.com: the Marketplace (plyship.com/marketplace) sends people here to log in with
// "?next=/marketplace/...". We remember where to go back to across the login → role → profile-setup steps.
const KEY = 'plyship_after_login';

const allowed = (next) => typeof next === 'string' && /^\/marketplace(\/|\?|$)/.test(next) && !next.startsWith('//');

/** Call on the login / signup pages: saves ?next= if it points into the Marketplace. */
export function rememberNext() {
    if (typeof window === 'undefined') return;
    try {
        const next = new URLSearchParams(window.location.search).get('next');
        if (allowed(next)) sessionStorage.setItem(KEY, next);
    } catch { }
}

export function hasNext() {
    try { return typeof window !== 'undefined' && allowed(sessionStorage.getItem(KEY)); } catch { return false; }
}

/** After a successful login / profile setup: go back to the Marketplace if that's where they came from. */
let leaving = false; // the login page can call this twice (auth listener + OTP handler): only the first counts
export function goAfterLogin(router, fallback = '/') {
    if (leaving) return;
    let next = null;
    try {
        next = sessionStorage.getItem(KEY);
        sessionStorage.removeItem(KEY);
    } catch { }
    if (allowed(next)) {
        leaving = true;
        window.location.href = next; // full page load: the Marketplace is a separate app behind src/proxy.js
        return;
    }
    router.replace(fallback);
}
