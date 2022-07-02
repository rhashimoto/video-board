import { css, html, LitElement } from 'lit';
import { onChildAdded, push, ref, remove } from "firebase/database";
import { repeat } from 'lit/directives/repeat.js';

import { getFirebaseUid, getFirebaseDatabase } from './firebase.js';
import { PeerConnection } from './PeerConnection.js';

const MESSAGE_EXPIRATION_MILLIS = 60_000;

const MEDIA_CONSTRAINTS = { audio: true, video: { facingMode: "user" } };
const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:openrelay.metered.ca:80" },
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

class ClientRTC extends LitElement {
  #ready;
  #uid;
  #database;
  #runOnDisconnect = [];

  // Call state.
  /** @type {PeerConnection} */ #peerConnection = null;
  #nonce = null;

  static properties = {
    peers: { attribute: null }
  }

  constructor() {
    super();
    this.#ready = this.#initialize();
    this.peers = new Map();
  }

  async #initialize() {
    this.#uid = await getFirebaseUid();
    this.#database = await getFirebaseDatabase();

    // Fetch peers.
    const peers = ref(this.#database, `/users/${this.#uid}/peers`)
    const unsubPeers = onChildAdded(peers, snapshot => {
      this.peers = new Map(this.peers);
      this.peers.set(snapshot.key, snapshot.val());
    });
    this.#runOnDisconnect.push(unsubPeers);

    // Listen for signaling messages.
    const incoming = ref(this.#database, `/users/${this.#uid}/inbox`);
    const unsubInbox = onChildAdded(incoming, snapshot => {
      const message = snapshot.val();
      console.log('incoming', message);
      if (message.timestamp > Date.now() - MESSAGE_EXPIRATION_MILLIS) {
        this.#handleMessage(message);
      }
      remove(snapshot.ref);
    });
    this.#runOnDisconnect.push(unsubInbox);
  }

  async #handleMessage(message) {
    if (this.#nonce !== null && this.#nonce !== message.nonce) {
      this.#destroyPeerConnection();
    }
    this.#nonce = message.nonce;

    // Create the connection if necessary.
    if (!this.#peerConnection) {
      this.#peerConnection = this.#createPeerConnection(message.src);
    }
    this.#peerConnection.postMessage(message.data);
  }

  async #start() {
    if (!this.#peerConnection) {
      const peerSelector = this.shadowRoot.getElementById('peer-selector');
      this.#peerConnection = this.#createPeerConnection(peerSelector['value']);
    }
  }

  async #stop() {
    this.#destroyPeerConnection();
  }

  #createPeerConnection(dst) {
    const peerConnection = new PeerConnection(RTC_CONFIG, {
      polite: this.#uid < dst,
      remoteView: this.shadowRoot.getElementById('remote')
    });
    peerConnection.addMediaStream(MEDIA_CONSTRAINTS).then(mediaStream => {
      const localView = /** @type {HTMLVideoElement} */
        (this.shadowRoot.getElementById('local'));
      localView.srcObject = mediaStream;
    });
    peerConnection.addEventListener('message', async event => {
      await this.#ready;
      const message = {
        timestamp: Date.now(),
        nonce: this.#nonce || (this.#nonce = Math.random().toString(36).replace('0.', '')),
        src: this.#uid,
        data: event['data']
      };
      await push(ref(this.#database, `/users/${dst}/inbox`), message);
    });

    peerConnection.addEventListener('iceconnectionstatechange', () => {
      if (peerConnection.iceConnectionState === 'disconnected') {
        console.log('ice disconnected');
        this.#destroyPeerConnection();
      }
    });
    return peerConnection;
  }

  #destroyPeerConnection() {
    if (this.#peerConnection) {
      this.#peerConnection.close();
      this.#peerConnection = null;
      this.#nonce = null;

      this.shadowRoot.querySelectorAll('video').forEach(video => {
        if (video.srcObject instanceof MediaStream) {
          video.srcObject.getTracks().forEach(track => track.stop());
          video.srcObject = null;
        }
      });
    }
  }

  static get styles() {
    return css`
      :host {
        display: block;
        gap: 1em;
      }

      video {
        border: 1px solid;
        width: 320px;
        min-height: 160px;
      }
    `;
  }

  render() {
    return html`
      <div>
        <select id="peer-selector">
          ${repeat(this.peers, ([uid, email]) => {
            return html`
              <option value="${uid}">${email}</option>
            `
          })}
        </select>
        <button @click=${this.#start}>Call</button>
        <button @click=${this.#stop}>Stop</button>
      </div>
      <video id="local" autoplay muted></video>
      <video id="remote" autoplay></video>
    `;
  }

  disconnectedCallback() {
    for (const fn of this.#runOnDisconnect) {
      try {
        fn();
      } catch (e) {
      }
    }
  }
}
customElements.define('client-rtc', ClientRTC);