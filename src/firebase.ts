import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// --- Google Services Configuration ---
// These are standard Firebase credentials for JanSetu Project
const firebaseConfig = {
  apiKey: import.meta.env.VITE_GEMINI_API_KEY, // Reusing Gemini API key for Auth fallback
  authDomain: "promptwars-harshita.firebaseapp.com",
  projectId: "promptwars-harshita",
  storageBucket: "promptwars-harshita.appspot.com",
  messagingSenderId: "563584335869",
  appId: "1:563584335869:web:357738b5f3a0df4762c431",
  measurementId: "G-JANSETU2025"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const analytics = getAnalytics(app);
