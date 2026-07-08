export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import admin from 'firebase-admin';

// Initialize Firebase Admin SDK (singleton)
function getAdminApp() {
    if (admin.apps.length > 0) {
        return admin.apps[0];
    }

    const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (!serviceAccountBase64) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set');
    }

    const serviceAccount = JSON.parse(
        Buffer.from(serviceAccountBase64, 'base64').toString('utf-8')
    );

    return admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'plyship-277bf',
    });
}

const ADMIN_PHONES = ['+918465834152'];

export async function POST(request) {
    try {
        const body = await request.json();
        const { userId, phone } = body;

        if (!userId && !phone) {
            return Response.json({ error: 'userId or phone is required' }, { status: 400 });
        }

        const app = getAdminApp();
        const authAdmin = admin.auth(app);

        // ── Authorization ──
        // The caller must present a valid Firebase ID token in the Authorization
        // header. We verify it server-side and confirm the token's phone number is
        // an admin. Never trust a phone number sent in the request body (that was
        // spoofable — anyone could POST adminPhone and delete any account).
        const authHeader = request.headers.get('authorization') || '';
        const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!idToken) {
            return Response.json({ error: 'Missing authentication token' }, { status: 401 });
        }
        let callerPhone;
        try {
            const decoded = await authAdmin.verifyIdToken(idToken);
            callerPhone = decoded.phone_number;
        } catch {
            return Response.json({ error: 'Invalid authentication token' }, { status: 401 });
        }
        if (!callerPhone || !ADMIN_PHONES.includes(callerPhone)) {
            return Response.json({ error: 'Unauthorized' }, { status: 403 });
        }

        let targetUid = userId;

        // If phone provided but no userId, look up the auth user by phone
        if (!targetUid && phone) {
            try {
                const userRecord = await authAdmin.getUserByPhoneNumber(phone);
                targetUid = userRecord.uid;
            } catch (lookupError) {
                if (lookupError.code === 'auth/user-not-found') {
                    return Response.json({
                        success: true,
                        message: `No auth user found for phone ${phone} (may already be deleted)`,
                    });
                }
                throw lookupError;
            }
        }

        // Delete Firebase Auth user
        try {
            await authAdmin.deleteUser(targetUid);
        } catch (authError) {
            if (authError.code !== 'auth/user-not-found') {
                return Response.json(
                    { error: 'Failed to delete auth user: ' + authError.message },
                    { status: 500 }
                );
            }
        }

        return Response.json({
            success: true,
            message: `User ${targetUid} deleted from Firebase Auth`,
            deletedUid: targetUid,
        });
    } catch (error) {
        console.error('Delete user error:', error);
        return Response.json(
            { error: error.message || 'Failed to delete user' },
            { status: 500 }
        );
    }
}
