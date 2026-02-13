// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyCjbJCaw-7A3eZL1m_doUCTVo75JFoEH9g",
  authDomain: "advitya-55c2a.firebaseapp.com",
  projectId: "advitya-55c2a",
  storageBucket: "advitya-55c2a.firebasestorage.app",
  messagingSenderId: "368208045831",
  appId: "1:368208045831:web:aeedfc127568bd2bed47a2",
  measurementId: "G-9TR13F40HY"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);