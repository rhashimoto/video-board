// https://firebase.google.com/docs/web/setup#available-libraries
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { getDatabase, get, ref } from "firebase/database";

import { setTokenProvider } from './gapi.js';

const {
  GOOGLE_CLIENT_ID,
} = JSON.parse(document.getElementById('google-config')?.textContent ?? '{}');

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const app = initializeApp({
  apiKey: "AIzaSyASXeGyZygO7d_j_wfR6NiE-Fk49pG1uoQ",
  authDomain: "shoestring-videoboard.firebaseapp.com",
  projectId: "shoestring-videoboard",
  storageBucket: "shoestring-videoboard.appspot.com",
  messagingSenderId: "104957196093",
  appId: "1:104957196093:web:806779aabe41c1fee07754",
  measurementId: "G-V13R1N46M6"
});

const userReady = new Promise(function(resolve) {
  const auth = getAuth(app);
  onAuthStateChanged(auth, function(user) {
    if (user) {
      resolve?.(user);
      resolve = null;
    } else {
      // Start a sign in process for an unauthenticated user.
      // It is allowed to add Google API scopes to call Google APIs with
      // the resulting access token, but there doesn't seem to be a
      // mechanism to refresh the token.
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      signInWithRedirect(auth, provider);
    }
  });
});

export async function getFirebaseApp() {
  await userReady;
  return app;
}

export async function getFirebaseUid() {
  const user = await userReady;
  return user.uid;
}

const gAnalytics = getAnalytics(app);
export async function getFirebaseAnalytics() {
  await userReady;
  return gAnalytics;
}

const gDatabase = getDatabase(app);
export async function getFirebaseDatabase() {
  await userReady;
  return gDatabase;
}

async function queryDatabase(path) {
  const database = await getFirebaseDatabase();
  const query = ref(database, path);
  const snapshot = await get(query);
  return snapshot.val();
}

// Install the Google API access token provider.
setTokenProvider(async function() {
  const uid = await getFirebaseUid();
  const secret = await queryDatabase(`/config/secret`);
  const refresh = await queryDatabase(`/clients/${uid}/config/refresh`);
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