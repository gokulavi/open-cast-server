// ============================================================
// config/firebase.js - Firebase Admin SDK initialization
// ============================================================

const admin = require('firebase-admin');

let db = null;
let initialized = false;

function initFirebase() {
  if (initialized) return;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (!projectId || !privateKey || !clientEmail) {
    console.warn('⚠️  Firebase credentials not set. Stream persistence disabled.');
    console.warn('   Set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL in .env');
    initialized = true;
    return;
  }

  try {
    // Avoid re-initializing if already done (important for hot reloads)
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          privateKey: privateKey.replace(/\\n/g, '\n'),
          clientEmail,
        }),
      });
    }

    db = admin.firestore();
    console.log(`✅ Firebase connected: ${projectId}`);
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
  }

  initialized = true;
}

function getFirestore() {
  if (!initialized) initFirebase();
  return db;
}

// Initialize on module load
initFirebase();

module.exports = { getFirestore, admin };
