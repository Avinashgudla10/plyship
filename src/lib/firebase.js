import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage, ref, uploadString, getDownloadURL, listAll, deleteObject } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDE3lwuYJdTYj7dIYJUqcRBtdP_MNXJ0DE",
    authDomain: "plyship-277bf.firebaseapp.com",
    projectId: "plyship-277bf",
    storageBucket: "plyship-277bf.firebasestorage.app",
    messagingSenderId: "109538013062",
    appId: "1:109538013062:web:4394fc1e6b50bb405a8607",
    measurementId: "G-LXDZ80TMM5"
};

// Initialize Firebase (prevent re-initialization in dev mode)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firestore with the named database
export const db = getFirestore(app, 'plyshipdatabase');

// Initialize Auth
export const auth = getAuth(app);

// Initialize Storage
export const storage = getStorage(app);

/**
 * Delete all files in a user's storage folder
 * @param {string} userId - The user ID  
 */
export const deleteUserStorage = async (userId) => {
    try {
        const userStorageRef = ref(storage, `users/${userId}`);
        const listResult = await listAll(userStorageRef);

        // Delete all files in the user's folder
        for (const fileRef of listResult.items) {
            await deleteObject(fileRef);
        }

        // Recursively delete files in subdirectories (portfolio, etc.)
        for (const folderRef of listResult.prefixes) {
            const subListResult = await listAll(folderRef);
            for (const fileRef of subListResult.items) {
                await deleteObject(fileRef);
            }
        }

    } catch (error) {
        // If folder doesn't exist or is empty, that's fine
        if (error.code !== 'storage/object-not-found') {
        }
    }
};

/**
 * Subscribe to real-time messages in a chat
 * @param {string} chatId - The chat ID
 * @param {function} callback - Callback function that receives messages array
 * @returns {function} - Unsubscribe function
 */
export const subscribeToMessages = (chatId, callback) => {
    if (!chatId) {
        callback([]);
        return () => { };
    }

    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const messages = [];
        snapshot.forEach((doc) => {
            messages.push({
                id: doc.id,
                ...doc.data(),
            });
        });
        callback(messages);
    }, (error) => {
        callback([]);
    });

    return unsubscribe;
};

/**
 * Upload a base64 image to Firebase Storage and return the download URL
 * @param {string} base64Data - The base64 encoded image (with or without data URL prefix)
 * @param {string} path - The storage path (e.g., 'users/uid/avatar.jpg')
 * @returns {Promise<string>} - The download URL
 */
export const uploadImage = async (base64Data, path) => {
    try {
        const storageRef = ref(storage, path);

        // Upload the base64 string
        const snapshot = await uploadString(storageRef, base64Data, 'data_url');
        // Get the download URL
        const downloadURL = await getDownloadURL(snapshot.ref);
        return downloadURL;
    } catch (error) {
        throw error;
    }
};

/**
 * Upload multiple images and return their URLs
 * @param {string[]} base64Images - Array of base64 encoded images
 * @param {string} basePath - Base storage path (e.g., 'users/uid/portfolio')
 * @returns {Promise<string[]>} - Array of download URLs
 */
export const uploadImages = async (base64Images, basePath) => {
    const uploadPromises = base64Images.map((img, i) =>
        uploadImage(img, `${basePath}/image_${i}_${Date.now()}.jpg`)
    );
    return Promise.all(uploadPromises);
};

export default app;

