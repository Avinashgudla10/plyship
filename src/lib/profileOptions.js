// The answers allowed in a PlyShip profile — used to check sign-ups that don't come through the app's own
// screens (WhatsApp sign-up, /api/wa/signup). Keep in step with src/app/profile-setup/page.js.
export const PROPERTY_TYPES = ['1 BHK', '2 BHK', '3 BHK', '4+ BHK', 'Villa', 'Office'];
export const STYLES = ['residential', 'commercial'];
export const ROOMS = ['full', 'living', 'bedroom', 'kitchen', 'bathroom', 'office'];
export const SEEKER_BUDGETS = ['3-5', '5-10', '10-20', '20+'];
export const TIMELINES = ['immediate', '1-3months', '3-6months', 'exploring'];
export const SERVICES = ['residential', 'commercial', 'modular', 'renovation', 'consultation', 'turnkey'];
export const SPECIALIZATIONS = ['modern', 'traditional', 'minimalist', 'luxury', 'budget', 'smart-home', 'eco-friendly', 'vastu'];
export const COMPANY_BUDGETS = ['3-5', '5-10', '10-25', '25+'];
export const SERVICE_RADII = [10, 25, 50, 100];

const txt = (x, max) => String(x ?? '').trim().slice(0, max);
const pickAll = (list, allowed) => [...new Set((Array.isArray(list) ? list : []).filter((x) => allowed.includes(x)))];
const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : null);

/** Same rules as the app's profile setup. Returns { profile, errors }. */
export function checkProfile(role, p = {}) {
    const errors = [];
    const lat = num(p.lat), lng = num(p.lng);
    const point = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : { lat: null, lng: null };
    if (role === 'SEEKER') {
        const profile = {
            name: txt(p.name, 60), city: txt(p.city, 60), locality: txt(p.locality, 80), ...point,
            propertyType: PROPERTY_TYPES.includes(p.propertyType) ? p.propertyType : '',
            styles: pickAll(p.styles, STYLES), rooms: pickAll(p.rooms, ROOMS),
            budget: SEEKER_BUDGETS.includes(p.budget) ? p.budget : '', timeline: TIMELINES.includes(p.timeline) ? p.timeline : '',
            marketplaceQuotes: p.marketplaceQuotes === true, quotesWanted: [1, 2, 3, 4, 5].includes(Number(p.quotesWanted)) ? Number(p.quotesWanted) : 3,
            avatar: null,
        };
        if (profile.name.length < 2) errors.push('name');
        if (profile.city.length < 2) errors.push('city');
        if (!profile.propertyType) errors.push('propertyType');
        if (!profile.styles.length) errors.push('styles');
        const commercialOnly = profile.styles.length === 1 && profile.styles[0] === 'commercial';
        if (!commercialOnly && !profile.rooms.length) errors.push('rooms');
        if (!profile.budget) errors.push('budget');
        if (!profile.timeline) errors.push('timeline');
        return { profile, errors };
    }
    const profile = {
        companyName: txt(p.companyName, 80), tagline: txt(p.tagline, 120), city: txt(p.city, 60), locality: txt(p.locality, 80), ...point,
        serviceRadius: SERVICE_RADII.includes(Number(p.serviceRadius)) ? Number(p.serviceRadius) : 50,
        services: pickAll(p.services, SERVICES), specializations: pickAll(p.specializations, SPECIALIZATIONS),
        portfolioImages: (Array.isArray(p.portfolioImages) ? p.portfolioImages : []).filter((u) => typeof u === 'string' && u.startsWith('https://firebasestorage.googleapis.com/')).slice(0, 10),
        portfolioDescription: txt(p.portfolioDescription, 500), yearsInBusiness: txt(p.yearsInBusiness, 3), projectsCompleted: txt(p.projectsCompleted, 6),
        minBudget: COMPANY_BUDGETS.includes(p.minBudget) ? p.minBudget : '',
        leadAlertsWhatsApp: p.leadAlertsWhatsApp === true, avatar: null,
    };
    if (profile.companyName.length < 2) errors.push('companyName');
    if (profile.city.length < 2) errors.push('city');
    if (!profile.services.length) errors.push('services');
    if (!profile.specializations.length) errors.push('specializations');
    if (!profile.portfolioImages.length) errors.push('portfolioImages');
    if (!profile.minBudget) errors.push('minBudget');
    return { profile, errors };
}
