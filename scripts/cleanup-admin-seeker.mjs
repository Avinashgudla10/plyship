// One-time cleanup script: Remove admin seeker profile and its matches
// Run with: node scripts/cleanup-admin-seeker.mjs

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

const ADMIN_EMAIL = 'avinashgudla10@gmail.com';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'plyshipdatabase');

async function cleanup() {
    console.log('🔍 Looking for admin seeker profile...');

    // Get ALL seekers and find the one with admin email
    const seekersRef = collection(db, 'seekers');
    const allSeekers = await getDocs(seekersRef);

    console.log(`📊 Total seekers found: ${allSeekers.size}`);

    let seekerId = null;
    for (const docSnap of allSeekers.docs) {
        const data = docSnap.data();
        const email = data.email || data.profile?.email || '';
        console.log(`  - ${docSnap.id}: ${email}`);

        if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
            seekerId = docSnap.id;
            console.log(`\n🎯 Found admin seeker: ${docSnap.id}`);
        }
    }

    if (!seekerId) {
        console.log('\n❌ No seeker found with admin email. Exiting.');
        process.exit(0);
    }

    // Delete the seeker document
    console.log(`\n🗑️  Deleting seeker document: ${seekerId}`);
    await deleteDoc(doc(db, 'seekers', seekerId));
    console.log('✅ Seeker deleted.');

    // Delete matches under seeker
    console.log('🔍 Looking for matches under seeker...');
    try {
        const matchedRef = collection(db, 'seekers', seekerId, 'matched');
        const matchSnap = await getDocs(matchedRef);
        for (const matchDoc of matchSnap.docs) {
            console.log(`🗑️  Deleting match: ${matchDoc.id}`);
            await deleteDoc(matchDoc.ref);
        }
        console.log(`✅ Deleted ${matchSnap.size} match(es).`);
    } catch (e) {
        console.log('ℹ️  No matches subcollection:', e.message);
    }

    // Delete swipes under seeker
    console.log('🔍 Looking for swipes under seeker...');
    try {
        const swipesRef = collection(db, 'seekers', seekerId, 'swipes');
        const swipeSnap = await getDocs(swipesRef);
        for (const swipeDoc of swipeSnap.docs) {
            await deleteDoc(swipeDoc.ref);
        }
        console.log(`✅ Deleted ${swipeSnap.size} swipe(s).`);
    } catch (e) {
        console.log('ℹ️  No swipes subcollection:', e.message);
    }

    // Check collectionGroup matched for cross-references
    console.log('🔍 Looking for cross-reference matches...');
    try {
        const allMatchedRef = collectionGroup(db, 'matched');
        const allMatchSnap = await getDocs(allMatchedRef);
        let crossDeleted = 0;
        for (const matchDoc of allMatchSnap.docs) {
            const data = matchDoc.data();
            if (data.matchedUserId === seekerId || data.userId === seekerId ||
                data.seekerId === seekerId || data.companyId === seekerId) {
                console.log(`🗑️  Deleting cross-match: ${matchDoc.ref.path}`);
                await deleteDoc(matchDoc.ref);
                crossDeleted++;
            }
        }
        console.log(`✅ Deleted ${crossDeleted} cross-reference match(es).`);
    } catch (e) {
        console.log('⚠️  Could not query collectionGroup:', e.message);
    }

    // Delete wallet
    console.log('🔍 Checking for wallet...');
    try {
        await deleteDoc(doc(db, 'wallets', seekerId));
        console.log('✅ Wallet deleted.');
    } catch (e) {
        console.log('ℹ️  No wallet found.');
    }

    console.log('\n🎉 Cleanup complete!');
    process.exit(0);
}

cleanup().catch((err) => {
    console.error('💥 Error:', err);
    process.exit(1);
});
