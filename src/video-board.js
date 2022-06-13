import { LitElement, css, html } from 'lit';

// https://firebase.google.com/docs/web/setup#available-libraries
import { initializeApp } from "firebase/app";
import { getAuth, signInWithCredential, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { getDatabase, onChildAdded, push, ref, remove } from "firebase/database";

import { getAccessToken, getCredential } from './gapi.js';

const MESSAGE_EXPIRATION_MILLIS = 60_000;
const MEDIA_CONSTRAINTS = { audio: true, video: { facingMode: "user" } };
const RTC_CONFIG = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302"
    },
    {
      urls: "stun:stun1.l.google.com:19302"
    },
    {
      urls: "stun:stun2.l.google.com:19302"
    },
    {
      urls: "stun:stun3.l.google.com:19302"
    },
    {
      urls: "stun:stun4.l.google.com:19302"
    },
    {
      urls: "stun:openrelay.metered.ca:80",
    },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ]
};

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
    this.database = getDatabase(app);

    // Sign in to Firebase.
    const auth = getAuth();
    await signInWithCredential(
      auth,
      GoogleAuthProvider.credential(await getCredential()));
    this.uid = auth.currentUser.uid;

    const inbox = ref(this.database, `clients/${this.uid}/in`);
    let inboxChain = Promise.resolve();
    onChildAdded(inbox, snapshot => {
      inboxChain = inboxChain.then(() => this.handleIncoming(snapshot));
    });
  }

  async handleIncoming(snapshot) {
    const message = snapshot.val();
    console.log('inbox message', message);
    try {
      if (message.timestamp > Date.now() - MESSAGE_EXPIRATION_MILLIS) {
        if (message.offer) {
          const outbox = ref(this.database, `clients/${this.uid}/out`);

          this.peerConnection = await this.#createPeerConnection();
          this.peerConnection.onicecandidate = ({candidate}) => {
            if (candidate) {
              push(outbox, {
                timestamp: Date.now(),
                contextId: message.contextId,
                candidate: candidate.toJSON()
              });
            }
          };
          this.peerConnection.ontrack = ({streams}) => {
            const element = this.shadowRoot.getElementById('answerer');
            element.srcObject = streams[0];
          };
            
          await this.peerConnection.setRemoteDescription(message.offer);

          const answer = await this.peerConnection.createAnswer();
          await this.peerConnection.setLocalDescription(answer);
          push(outbox, {
            timestamp: Date.now(),
            contextId: message.contextId,
            answer: answer.toJSON()
          });
        } else if (message.candidate) {
          this.peerConnection.addIceCandidate(message.candidate);
        }
      }
    } finally {
      remove(snapshot.ref);
    }
  }

  async #createPeerConnection() {
    const peerConnection = new RTCPeerConnection(RTC_CONFIG);

    const mediaStream = await navigator.mediaDevices.getUserMedia(MEDIA_CONSTRAINTS);
    for (const track of mediaStream.getTracks()) {
      peerConnection.addTrack(track, mediaStream);
    }
    return peerConnection;
  }

  async _call() {
    const contextId = Math.random().toString(36).replace('0.', '');
    const clientId = this.shadowRoot.getElementById('target').value;

    const peerConnection = await this.#createPeerConnection();
    peerConnection.onnegotiationneeded = async () => {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      const inbox = ref(this.database, `clients/${clientId}/in`);
      push(inbox, {
        timestamp: Date.now(),
        contextId,
        offer: offer.toJSON()
      })
    };
    peerConnection.onicecandidate = ({candidate}) => {
      if (candidate) {
        const inbox = ref(this.database, `clients/${clientId}/in`);
        push(inbox, {
          timestamp: Date.now(),
          contextId,
          candidate: candidate.toJSON()
        });
      }
    };
    peerConnection.ontrack = ({streams}) => {
      const element = this.shadowRoot.getElementById('offerer');
      element.srcObject = streams[0];
    };
    peerConnection.oniceconnectionstatechange = () => {
      console.log('iceConnectionState', peerConnection.iceConnectionState);
      if (peerConnection.iceConnectionState === 'disconnected') {
        // TODO: tear down connection
      }
    };

    // Listen for answer.
    const outbox = ref(this.database, `clients/${clientId}/out`);
    const closeSignaling = onChildAdded(outbox, async (snapshot) => {
      const message = snapshot.val();
      console.log('outbox message', message);
      if (message.contextId === contextId) {
        if (message.answer) {
          await peerConnection.setRemoteDescription(message.answer);
        } else if (message.candidate) {
          peerConnection.addIceCandidate(message.candidate);
        }
      }
      remove(snapshot.ref);
    });
    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'connected') {
        closeSignaling();
      }
    };
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
      <div>
        <input id="target" value="rJKmGm9VjuXjmiTuLi9Wcj7TOtt2">
        <button id="call" @click=${this._call}>Call</button>
      </div>
      <video id="offerer" autoplay width="160" height="120"></video>
      <video id="answerer" autoplay width="160" height="120"></video>
    `;
  }
}
customElements.define('video-board', VideoBoard);