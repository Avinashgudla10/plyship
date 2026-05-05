// Script to delete all PENDING withdrawal requests from Firestore
// Run with: node scripts/delete-pending-withdrawals.mjs

import { initializeApp } from 'firebase/app';
import { collection, getDocs, deleteDoc, doc, getFirestore, query, where } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDE3lwuYJdTYj7dIYJUqcRBtdP_MNXJ0DE",
    authDomain: "plyship-277bf.firebaseapp.com",
    projectId: "plyship-277bf",
    storageBucket: "plyship-277bf.firebasestorage.app",
    messagingSenderId: "109538013062",
    appId: "1:109538013062:web:4394fc1e6b50bb405a8607",
    measurementId: "G-LXDZ80TMM5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'plyshipdatabase');

async function deletePendingWithdrawals() {
    try {
        const q = query(collection(db, 'withdrawals'), where('status', '==', 'PENDING'));
        const snapshot = await getDocs(q);

        console.log(`Found ${snapshot.size} PENDING withdrawal requests`);

        if (snapshot.size === 0) {
            console.log('Nothing to delete.');
            process.exit(0);
        }

        let deleted = 0;
        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            console.log(`  Deleting: ${docSnap.id} - ${data.seekerName || data.companyName || data.userId || 'Unknown'} - Rs.${data.amount}`);
            await deleteDoc(doc(db, 'withdrawals', docSnap.id));
            deleted++;
        }

        console.log(`\nDeleted ${deleted} pending withdrawal requests.`);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

deletePendingWithdrawals();
