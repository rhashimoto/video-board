import { LitElement, css, html } from 'lit';

// https://firebase.google.com/docs/web/setup#available-libraries
import { initializeApp } from "firebase/app";
import { getAuth, signInWithCredential, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { getDatabase, onChildAdded, push, ref, remove } from "firebase/database";

import { getAccessToken, getCredential } from './gapi.js';

const MESSAGE_EXPIRATION_MILLIS = 60_000;
const MEDIA_CONSTRAINTS = { audio: true, video: { facingMode: "user" } };

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
  instanceId = Math.random().toString(36).replace('0.', '');
  clientUIDs = new Set();

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
    this.database = getDatabase(app);

    // Sign in to Firebase.
    const auth = getAuth();
    await signInWithCredential(
      auth,
      GoogleAuthProvider.credential(await getCredential()));
    this.uid = auth.currentUser.uid;

    const inbox = ref(this.database, `clients/${this.uid}/in`);
    onChildAdded(inbox, snapshot => this.handleMessage(snapshot));
  }

  handleMessage(snapshot) {
    const message = snapshot.val();
    if (message.dst !== this.uid && message.dst !== this.instanceId) return;
    try {
      if (message.timestamp > Date.now() - MESSAGE_EXPIRATION_MILLIS) {
        // TODO: dispatch message
        console.log('message', message);
      }
    } finally {
      remove(snapshot.ref);
    }
  }

  _call() {
    // Post offer to destination inbox.
    const dst = this.shadowRoot.getElementById('target').value;
    const inbox = ref(this.database, `clients/${dst}/in`);
    push(inbox, {
      src: this.instanceId,
      dst,
      timestamp: Date.now(),
      data: 'how now brown cow'
    });

    // Listen for responses.
    if (!this.clientUIDs.has(dst)) {
      const outbox = ref(this.database, `clients/${dst}/out`);
      onChildAdded(outbox, snapshot => this.handleMessage(snapshot));
      this.clientUIDs.add(dst);
    }
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }
    `;
  }

  render() {
    return html`
      <h1>Hello VideoBoard</h1>
      <input id="target" value="rJKmGm9VjuXjmiTuLi9Wcj7TOtt2">
      <button id="call" @click=${this._call}>Call</button>
    `;
  }
}
customElements.define('video-board', VideoBoard);