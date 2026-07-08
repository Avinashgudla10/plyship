/**
 * Meeting fee pricing — based on the SEEKER's property type.
 *
 * The company pays this fee to book an offline consultation meeting; it is split
 * 50% to the seeker and 50% to the admin wallet. The fee is derived from the
 * seeker's saved profile `propertyType` and stored on the meeting doc at creation
 * (field `meetingFee`) so it stays fixed for the whole meeting lifecycle.
 *
 * This module is shared by the client (display + Razorpay order) and the server
 * (amount validation), so both compute identical amounts.
 */

export const DEFAULT_MEETING_FEE = 500;

/**
 * Pricing tiers in display order — the single source of truth for both the fee
 * lookup and any UI that explains the pricing to users. Larger properties command
 * a higher consultation fee because the interior scope (and the seeker's committed
 * time) grows with the space.
 */
export const FEE_TIERS = [
    { label: '1 BHK', fee: 500 },
    { label: '2 BHK', fee: 1000 },
    { label: '3 BHK', fee: 1500 },
    { label: '4+ BHK', fee: 2000 },
    { label: 'Villa', fee: 3000 },
    { label: 'Office', fee: 3000 },
];

// Normalised property-type key → fee (INR).
const FEE_TABLE = {
    '1 BHK': 500,
    '2 BHK': 1000,
    '3 BHK': 1500,
    '4+ BHK': 2000,
    'VILLA': 3000,
    'OFFICE': 3000,
};

/**
 * Normalise a free-form property type string to a canonical FEE_TABLE key.
 * Handles spacing/case variants and a few aliases ("1BHK", "Home Office", "4 BHK").
 */
function normalizePropertyType(propertyType) {
    if (!propertyType) return '';
    let s = String(propertyType).trim().toUpperCase().replace(/\s+/g, ' ');
    if (s === 'HOME OFFICE') return 'OFFICE';
    if (s === 'VILLA' || s === 'OFFICE') return s;
    // Bedroom-count variants → "<n> BHK" / "4+ BHK"
    const m = s.match(/^(\d)\s*\+?\s*BHK$/);
    if (m) {
        const n = parseInt(m[1], 10);
        return n >= 4 ? '4+ BHK' : `${n} BHK`;
    }
    return s;
}

/**
 * Get the meeting fee (INR) for a seeker's property type.
 * Falls back to DEFAULT_MEETING_FEE for missing/unknown types (e.g. legacy seekers).
 */
export function getMeetingFee(propertyType) {
    const key = normalizePropertyType(propertyType);
    return FEE_TABLE[key] ?? DEFAULT_MEETING_FEE;
}

/** Seeker's 50% share of a fee (rounded down; admin gets the remainder). */
export function getSeekerShare(fee) {
    const f = Number(fee) || DEFAULT_MEETING_FEE;
    return Math.floor(f / 2);
}

/** Admin's share = fee minus the seeker's share (keeps the split exact). */
export function getAdminShare(fee) {
    const f = Number(fee) || DEFAULT_MEETING_FEE;
    return f - getSeekerShare(f);
}
