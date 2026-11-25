// Shared by the WhatsApp assistant routes (server-to-server with the Marketplace, shared secret).
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

export const DATABASE_ID = 'plyshipdatabase';
export function adminApp() {
    if (admin.apps.length) return admin.apps[0];
    const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!key) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not set');
    return admin.initializeApp({ credential: admin.credential.cert(JSON.parse(Buffer.from(key, 'base64').toString('utf-8'))), projectId: 'plyship-277bf' });
}
export const db = () => getFirestore(adminApp(), DATABASE_ID);
export function authorised(request) {
    const secret = process.env.MARKETPLACE_PROXY_SECRET || '';
    return secret.length >= 16 && request.headers.get('authorization') === `Bearer ${secret}`;
}
export const validUid = (uid) => typeof uid === 'string' && uid.length > 0 && uid.length < 128 && !/[/.]/.test(uid);
