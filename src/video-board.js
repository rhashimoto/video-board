import { LitElement, css, html } from 'lit';

// https://firebase.google.com/docs/web/setup#available-libraries
import { initializeApp } from "firebase/app";
import { getAuth, signInWithCredential, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { getDatabase, ref, onChildAdded, remove } from "firebase/database";

import { getAccessToken, getCredential } from './gapi.js';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyASXeGyZygO7d_j_wfR6NiE-Fk49pG1uoQ",
  authDomain: "shoestring-videoboard.firebaseapp.com",
  projectId: "shoestring-videoboard",
  storageBucket: "shoestring-videoboard.appspot.com",
  messagingSenderId: "104957196093",
  appId: "1:104957196093:web:806779aabe41c1fee07754",
  measurementId: "G-V13R1N46M6"
};

(async function() {
  const gapi = await getGAPI();
  console.log('gapi loaded');

  const result = await gCall(() => gapi.client.calendar.events.list({
    'calendarId': 'primary',
    'timeMin': (new Date()).toISOString(),
    'showDeleted': false,
    'singleEvents': true,
    'maxResults': 10,
    'orderBy': 'startTime',
  }));
  console.log(new Date(), result);
});

class VideoBoard extends LitElement {
  static properties = {
    example: { attribute: null }
  }

  constructor() {
    super();
    this.ready = this.initialize();
  }

  async initialize() {
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    this.auth = getAuth();
    this.database = getDatabase(app);

    // Sign in to Firebase.
    const userCredential = await signInWithCredential(
      this.auth,
      GoogleAuthProvider.credential(await getCredential()));

    const offersRef = ref(this.database, `clients/${this.auth.currentUser.uid}/offers`);
    onChildAdded(offersRef, child => {
      console.log('offer', child.key, child.val());
      remove(child.ref);
    });
  }

  static get styles() {
    return css`
      :host {
        display: flex;
      }
    `;
  }

  render() {
    return html`
      <h1>Hello VideoBoard</h1>
    `;
  }
}
customElements.define('video-board', VideoBoard);