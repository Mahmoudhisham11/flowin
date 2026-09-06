import { initializeApp, getApps, getApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyBJI5Vfuoj0nDGnrodQ-3Ubs1R1s9dlJu4",
  authDomain: "abodpos-1beee.firebaseapp.com",
  projectId: "abodpos-1beee",
  storageBucket: "abodpos-1beee.firebasestorage.app",
  messagingSenderId: "606982390793",
  appId: "1:606982390793:web:2582990955f1108cf064d8",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

/**
 * Safely get Firebase Messaging instance on client side only after checking browser support
 */
export async function getMessagingInstance() {
  if (typeof window !== "undefined" && "serviceWorker" in navigator && "Notification" in window) {
    try {
      const { getMessaging, isSupported } = await import("firebase/messaging");
      const supported = await isSupported();
      if (supported) {
        return getMessaging(app);
      }
    } catch (err) {
      console.warn("Firebase Messaging is not supported in this browser:", err);
    }
  }
  return null;
}

export { app, firebaseConfig };
