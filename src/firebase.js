// https://firebase.google.com/docs/web/setup#available-libraries
import { initializeApp } from "firebase/app";
import { getAuth, signInWithCredential, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { getDatabase, get, ref } from "firebase/database";

import { getCredential, setTokenProvider } from './gapi.js';

const {
  GOOGLE_CLIENT_ID,
} = JSON.parse(document.getElementById('google-config')?.textContent ?? '{}');

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyASXeGyZygO7d_j_wfR6NiE-Fk49pG1uoQ",
  authDomain: "shoestring-videoboard.firebaseapp.com",
  projectId: "shoestring-videoboard",
  storageBucket: "shoestring-videoboard.appspot.com",
  messagingSenderId: "104957196093",
  appId: "1:104957196093:web:806779aabe41c1fee07754",
  measurementId: "G-V13R1N46M6"
};

export const getFirebaseApp = (function() {
  const app = initializeApp(FIREBASE_CONFIG);
  const signedIn = Promise.resolve().then(async function() {
    await signInWithCredential(
      getAuth(),
      GoogleAuthProvider.credential(await getCredential()));
    return app;
  });

  return function() {
    return signedIn;
  };
})();

export async function getFirebaseUid() {
  await getFirebaseApp();
  const auth = getAuth();
  return auth.currentUser.uid;
}

export async function getFirebaseAnalytics() {
  const app = await getFirebaseApp();
  return getAnalytics(app);
}

export async function getFirebaseDatabase() {
  const app = await getFirebaseApp();
  return getDatabase(app);
}

setTokenProvider(async function() {
  const uid = await getFirebaseUid();
  const database = await getFirebaseDatabase();
  const snapshot = await get(ref(database, `/clients/${uid}/config`));
  const { refresh, secret } = snapshot.val();
  const result = await fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: secret,
      grant_type: 'refresh_token',
      refresh_token: refresh
    })
  }).then(response => response.json());
  return result.access_token;
});