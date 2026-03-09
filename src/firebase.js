import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAhNyHfKFXdBbftmAQ_My7Sl7JR8J7q6e8",
  authDomain: "disc-golf-companion-ee97b.firebaseapp.com",
  projectId: "disc-golf-companion-ee97b",
  storageBucket: "disc-golf-companion-ee97b.firebasestorage.app",
  messagingSenderId: "142280989117",
  appId: "1:142280989117:web:529b45beff8145cdc2dad4",
  measurementId: "G-NW82JG6V6R"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
