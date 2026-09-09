/**
 * EventOS - Firebase Configuration & Initialization
 * Hardcoded configuration connecting directly to Google Firebase Firestore & Auth
 */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCkbTqsZGZCh9FV6j-1ou-Lnx4YSGH9F1k",
  authDomain: "encrypted-armour-9eb83.firebaseapp.com",
  projectId: "encrypted-armour-9eb83",
  storageBucket: "encrypted-armour-9eb83.firebasestorage.app",
  messagingSenderId: "924842679175",
  appId: "1:924842679175:web:ae876db757af3a482f1122"
};

class FirebaseManager {
  static getConfig() {
    return FIREBASE_CONFIG;
  }

  static init() {
    if (typeof firebase === 'undefined') {
      console.error('Firebase SDK not loaded.');
      return { db: null, auth: null };
    }

    if (!firebase.apps.length) {
      try {
        firebase.initializeApp(FIREBASE_CONFIG);
      } catch (e) {
        console.error('Firebase initialization error:', e);
      }
    }

    let db = null;
    let auth = null;

    try {
      db = firebase.firestore();
      
      // Enable offline persistence if supported in browser
      db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
        if (err.code === 'failed-precondition') {
          console.warn('Firestore persistence warning: Multiple tabs open');
        } else if (err.code === 'unimplemented') {
          console.warn('Firestore persistence not supported in this browser environment');
        }
      });
    } catch (err) {
      console.warn('Error connecting to Firestore:', err);
    }

    try {
      if (typeof firebase.auth === 'function') {
        auth = firebase.auth();
      }
    } catch (err) {
      console.warn('Error initializing Firebase Auth:', err);
    }

    return { db, auth };
  }

  static async testConnection() {
    try {
      const { db } = this.init();
      if (!db) return { success: false, error: 'Firebase Firestore SDK not initialized' };
      
      // Attempt a lightweight read on settings
      await db.collection('settings').doc('global').get();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

// Global initialization
window.FirebaseManager = FirebaseManager;
window.firebaseConfig = FIREBASE_CONFIG;

const _fbInit = FirebaseManager.init();
window.db = _fbInit.db;
window.auth = _fbInit.auth;
