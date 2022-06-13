// https://firebase.google.com/docs/web/setup#available-libraries
import { initializeApp } from "firebase/app";
import { getAuth, signInWithCredential, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { getDatabase } from "firebase/database";

import { getCredential } from './gapi.js';

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