// FULL Firebase cleanup — deletes ALL Firestore data + ALL Auth users except admin
// Run with: node scripts/cleanup-everything.mjs
// ⚠️ THIS IS DESTRUCTIVE AND IRREVERSIBLE

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load service account key
const serviceAccount = JSON.parse(
    readFileSync(join(__dirname, 'serviceAccountKey.json'), 'utf8')
);

// Admin email to KEEP
const ADMIN_EMAIL = 'avinashgudla10@gmail.com';

// Initialize Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

// Use the named database 'plyshipdatabase'
const db = admin.firestore();
// For named database, we need to use getFirestore with databaseId
const { getFirestore } = await import('firebase-admin/firestore');
const namedDb = getFirestore('plyshipdatabase');

// All top-level collections
const COLLECTIONS = [
    'users',
    'seekers',
    'companies',
    'wallets',
    'transactions',
    'meetings',
    'matches',
    'chats',
    'projects',
];

// Known subcollections
const SUBCOLLECTION_NAMES = ['messages', 'matched', 'swipes'];

// ==========================================
// 1. DELETE ALL FIRESTORE DATA
// ==========================================
async function deleteAllFirestoreData() {
    console.log('\n📁 STEP 1: Deleting all Firestore data...\n');
    let totalDeleted = 0;

    for (const colName of COLLECTIONS) {
        const colRef = namedDb.collection(colName);
        const snapshot = await colRef.get();

        if (snapshot.empty) {
            console.log(`  ✅ ${colName}: already empty`);
            continue;
        }

        // Delete subcollections first
        for (const docSnap of snapshot.docs) {
            for (const subName of SUBCOLLECTION_NAMES) {
                const subRef = docSnap.ref.collection(subName);
                const subSnap = await subRef.get();
                for (const subDoc of subSnap.docs) {
                    await subDoc.ref.delete();
                    totalDeleted++;
                }
                if (!subSnap.empty) {
                    console.log(`    ↳ ${colName}/${docSnap.id}/${subName}: deleted ${subSnap.size} sub-doc(s)`);
                }
            }
        }

        // Delete the documents themselves
        let count = 0;
        for (const docSnap of snapshot.docs) {
            await docSnap.ref.delete();
            count++;
        }
        totalDeleted += count;
        console.log(`  🗑️  ${colName}: deleted ${count} document(s)`);
    }

    console.log(`\n  📊 Total Firestore documents deleted: ${totalDeleted}`);
}

// ==========================================
// 2. DELETE ALL AUTH USERS EXCEPT ADMIN
// ==========================================
async function deleteAllAuthUsers() {
    console.log('\n👤 STEP 2: Deleting all Auth users except admin...\n');

    let deletedCount = 0;
    let keptCount = 0;
    let nextPageToken;

    do {
        const listResult = await admin.auth().listUsers(1000, nextPageToken);

        for (const userRecord of listResult.users) {
            if (userRecord.email && userRecord.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
                console.log(`  🛡️  KEEPING admin: ${userRecord.email} (${userRecord.uid})`);
                keptCount++;
                continue;
            }

            console.log(`  🗑️  Deleting: ${userRecord.email || userRecord.uid}`);
            await admin.auth().deleteUser(userRecord.uid);
            deletedCount++;
        }

        nextPageToken = listResult.pageToken;
    } while (nextPageToken);

    console.log(`\n  📊 Auth users deleted: ${deletedCount}, kept: ${keptCount}`);
}

// ==========================================
// MAIN
// ==========================================
async function main() {
    console.log('');
    console.log('⚠️  ==========================================');
    console.log('⚠️  FULL FIREBASE CLEANUP — PLYSHIP');
    console.log('⚠️  Deleting ALL data + ALL users except admin');
    console.log('⚠️  THIS IS IRREVERSIBLE!');
    console.log('⚠️  ==========================================');

    await deleteAllFirestoreData();
    await deleteAllAuthUsers();

    console.log('\n🎉 ==========================================');
    console.log('🎉 CLEANUP COMPLETE!');
    console.log('🎉 All data wiped. Only admin account remains.');
    console.log('🎉 You can now test from scratch.');
    console.log('🎉 ==========================================\n');

    process.exit(0);
}

main().catch((err) => {
    console.error('💥 Error:', err);
    process.exit(1);
});
