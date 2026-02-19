// FULL Firestore cleanup script — deletes ALL data from plyship database
// Run with: node scripts/cleanup-all.mjs
// ⚠️ THIS IS DESTRUCTIVE AND IRREVERSIBLE

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc, collectionGroup } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDE3lwuYJdTYj7dIYJUqcRBtdP_MNXJ0DE",
    authDomain: "plyship-277bf.firebaseapp.com",
    projectId: "plyship-277bf",
    storageBucket: "plyship-277bf.firebasestorage.app",
    messagingSenderId: "109538013062",
    appId: "1:109538013062:web:4394fc1e6b50bb405a8607",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'plyshipdatabase');

// All top-level collections in the app
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

// Subcollections to clean up (under parent collections)
const SUBCOLLECTIONS = [
    { parent: 'chats', sub: 'messages' },
    { parent: 'seekers', sub: 'matched' },
    { parent: 'seekers', sub: 'swipes' },
    { parent: 'companies', sub: 'matched' },
    { parent: 'companies', sub: 'swipes' },
];

async function deleteCollection(collectionName) {
    const colRef = collection(db, collectionName);
    const snapshot = await getDocs(colRef);

    if (snapshot.empty) {
        console.log(`  ✅ ${collectionName}: already empty`);
        return 0;
    }

    let count = 0;
    for (const docSnap of snapshot.docs) {
        await deleteDoc(docSnap.ref);
        count++;
    }
    console.log(`  🗑️  ${collectionName}: deleted ${count} document(s)`);
    return count;
}

async function deleteSubcollections(parentCollection, subName) {
    const parentRef = collection(db, parentCollection);
    const parentSnap = await getDocs(parentRef);

    let totalDeleted = 0;
    for (const parentDoc of parentSnap.docs) {
        const subRef = collection(db, parentCollection, parentDoc.id, subName);
        const subSnap = await getDocs(subRef);
        for (const subDoc of subSnap.docs) {
            await deleteDoc(subDoc.ref);
            totalDeleted++;
        }
    }
    return totalDeleted;
}

async function deleteAllSubcollectionsViaGroup(subName) {
    try {
        const groupRef = collectionGroup(db, subName);
        const snapshot = await getDocs(groupRef);
        let count = 0;
        for (const docSnap of snapshot.docs) {
            await deleteDoc(docSnap.ref);
            count++;
        }
        if (count > 0) {
            console.log(`  🗑️  [subcollection: ${subName}]: deleted ${count} document(s)`);
        }
        return count;
    } catch (e) {
        console.log(`  ⚠️  Could not query collectionGroup '${subName}': ${e.message}`);
        return 0;
    }
}

async function main() {
    console.log('');
    console.log('⚠️  ========================================');
    console.log('⚠️  DELETING ALL PLYSHIP FIRESTORE DATA');
    console.log('⚠️  THIS IS IRREVERSIBLE!');
    console.log('⚠️  ========================================');
    console.log('');

    let totalDeleted = 0;

    // 1. Delete subcollections first (must delete children before parents)
    console.log('📁 Cleaning subcollections...');
    for (const subName of ['messages', 'matched', 'swipes']) {
        const count = await deleteAllSubcollectionsViaGroup(subName);
        totalDeleted += count;
    }

    // 2. Delete all top-level collections
    console.log('');
    console.log('📁 Cleaning top-level collections...');
    for (const colName of COLLECTIONS) {
        const count = await deleteCollection(colName);
        totalDeleted += count;
    }

    console.log('');
    console.log(`🎉 Cleanup complete! Total deleted: ${totalDeleted} document(s)`);
    console.log('');
    console.log('ℹ️  Note: Firebase Auth accounts are NOT deleted by this script.');
    console.log('   Users can still log in but will need to re-register their profiles.');
    console.log('   To delete Auth accounts, use the Firebase Console → Authentication.');
    console.log('');
    process.exit(0);
}

main().catch((err) => {
    console.error('💥 Error:', err);
    process.exit(1);
});
