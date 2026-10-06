import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Kod rahsia Cikgu (Dah masukkan yang betul)
const firebaseConfig = {
  apiKey: "AIzaSyBfIJJtJ9pkv7FwQqd_QASeorxVLv7Wgrg",
  authDomain: "smart-rph-dzurri.firebaseapp.com",
  projectId: "smart-rph-dzurri",
  storageBucket: "smart-rph-dzurri.firebasestorage.app",
  messagingSenderId: "1067321929449",
  appId: "1:1067321929449:web:db07762c316c9ed0464a78",
  measurementId: "G-S3XQWYF07E"
};

// 1. Initialize Firebase
const app = initializeApp(firebaseConfig);

// 2. Export database Firestore (Ini yang App.tsx cari!)
export const db = getFirestore(app);
