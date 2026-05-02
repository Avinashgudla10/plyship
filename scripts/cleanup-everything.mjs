// FULL Firebase cleanup — deletes ALL Firestore data + Storage + Auth users except admin
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

// Admin phone to KEEP (with +91 prefix)
const ADMIN_PHONE = '+918465834152';

// Initialize Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'plyship-277bf.firebasestorage.app',
});

// Use the named database 'plyshipdatabase'
const { getFirestore } = await import('firebase-admin/firestore');
const namedDb = getFirestore('plyshipdatabase');

// Firebase Storage
const bucket = admin.storage().bucket();

// All top-level collections to clean
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
    'likes',
    'passes',
    'notifications',
    'deletion_requests',
];

// Known subcollections to check inside each document
const SUBCOLLECTION_NAMES = [
    'messages',    // chats/{id}/messages
    'matched',     // matches/{id}/matched
    'swipes',      // legacy
    'outgoing',    // likes/{id}/outgoing
    'incoming',    // likes/{id}/incoming
    'passed',      // passes/{id}/passed
    'items',       // notifications/{id}/items
];

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
                if (subSnap.empty) continue;

                const batch = namedDb.batch();
                subSnap.docs.forEach(subDoc => batch.delete(subDoc.ref));
                await batch.commit();
                totalDeleted += subSnap.size;
                console.log(`    ↳ ${colName}/${docSnap.id}/${subName}: deleted ${subSnap.size} sub-doc(s)`);
            }
        }

        // Delete the documents themselves in batches
        const batch = namedDb.batch();
        let count = 0;
        for (const docSnap of snapshot.docs) {
            batch.delete(docSnap.ref);
            count++;
        }
        await batch.commit();
        totalDeleted += count;
        console.log(`  🗑️  ${colName}: deleted ${count} document(s)`);
    }

    console.log(`\n  📊 Total Firestore documents deleted: ${totalDeleted}`);
}

// ==========================================
// 2. DELETE ALL FIREBASE STORAGE FILES
// ==========================================
async function deleteAllStorageFiles() {
    console.log('\n🗂️  STEP 2: Deleting all Firebase Storage files...\n');

    try {
        const [files] = await bucket.getFiles({ prefix: 'users/' });

        if (files.length === 0) {
            console.log('  ✅ Storage: already empty');
            return;
        }

        let deleted = 0;
        for (const file of files) {
            await file.delete();
            deleted++;
        }
        console.log(`  🗑️  Deleted ${deleted} file(s) from Storage`);
    } catch (error) {
        if (error.code === 404) {
            console.log('  ✅ Storage: no files found');
        } else {
            console.error('  ⚠️  Storage cleanup error:', error.message);
        }
    }
}

// ==========================================
// 3. DELETE ALL AUTH USERS EXCEPT ADMIN
// ==========================================
async function deleteAllAuthUsers() {
    console.log('\n👤 STEP 3: Deleting all Auth users except admin...\n');

    let deletedCount = 0;
    let keptCount = 0;
    let nextPageToken;

    do {
        const listResult = await admin.auth().listUsers(1000, nextPageToken);

        for (const userRecord of listResult.users) {
            // Keep admin by phone number
            if (userRecord.phoneNumber === ADMIN_PHONE) {
                console.log(`  🛡️  KEEPING admin: ${userRecord.phoneNumber} (${userRecord.uid})`);
                keptCount++;
                continue;
            }

            const identifier = userRecord.phoneNumber || userRecord.email || userRecord.uid;
            console.log(`  🗑️  Deleting: ${identifier}`);
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
    console.log('⚠️  Deleting ALL data + storage + users');
    console.log(`⚠️  Keeping only admin: ${ADMIN_PHONE}`);
    console.log('⚠️  THIS IS IRREVERSIBLE!');
    console.log('⚠️  ==========================================');

    await deleteAllFirestoreData();
    await deleteAllStorageFiles();
    await deleteAllAuthUsers();

    console.log('\n🎉 ==========================================');
    console.log('🎉 CLEANUP COMPLETE!');
    console.log('🎉 All data wiped. Only admin account remains.');
    console.log('🎉 App is ready for fresh production users.');
    console.log('🎉 ==========================================\n');

    process.exit(0);
}

main().catch((err) => {
    console.error('💥 Error:', err);
    process.exit(1);
});
