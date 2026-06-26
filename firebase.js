import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";

import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

import {
    getAuth,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyA9ZFz6YvXnYol9oG0aaIcQHpLkJp9mZXQ",
    authDomain: "bistro-menu-9345e.firebaseapp.com",
    projectId: "bistro-menu-9345e",
    storageBucket: "bistro-menu-9345e.firebasestorage.app",
    messagingSenderId: "994100712937",
    appId: "1:994100712937:web:6e8de36c8eae9d6a33a778",
    measurementId: "G-RQ4HF4LYFX"
};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };

export {
    collection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    setDoc,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
};
