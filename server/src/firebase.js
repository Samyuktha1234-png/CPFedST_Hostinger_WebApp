const admin = require('firebase-admin');

let db = null;
let firebaseError = null;

function initFirebase() {
  try {
    if (admin.apps.length) {
      db = admin.firestore();
      return;
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      firebaseError = 'Firebase is not configured; prediction logging is disabled.';
      return;
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });

    db = admin.firestore();
  } catch (error) {
    firebaseError = error.message;
  }
}

initFirebase();

async function savePrediction(record) {
  if (!db) return { stored: false, reason: firebaseError || 'Firebase disabled' };
  await db.collection(process.env.FIREBASE_COLLECTION || 'predictions').add(record);
  return { stored: true };
}

function firebaseStatus() {
  return {
    enabled: Boolean(db),
    error: firebaseError,
  };
}

module.exports = { savePrediction, firebaseStatus };
