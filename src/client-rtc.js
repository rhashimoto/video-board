import { css, html, LitElement } from 'lit';
import { onChildAdded, onValue, push, ref, remove } from "firebase/database";
import { repeat } from 'lit/directives/repeat.js';

import { getFirebaseUid, getFirebaseDatabase } from './firebase.js';
import { PeerConnection } from './PeerConnection.js';

const TIMEOUT_MILLIS = 60_000;

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
  #timeoutId;

  static properties = {
    peers: { attribute: null },
    hideControls: { attribute: 'hide-controls', type: Boolean }
  }

  constructor() {
    super();
    this.#ready = this.#initialize();
    this.peers = {};
    this.hideControls = false;
  }

  async #initialize() {
    this.#uid = await getFirebaseUid();
    this.#database = await getFirebaseDatabase();

    // Synchronize peers.
    const peers = ref(this.#database, `/users/${this.#uid}/peers`)
    const unsubPeers = onValue(peers, snapshot => {
      this.peers = snapshot.val();
    });
    this.#runOnDisconnect.push(unsubPeers);

    // Listen for signaling messages.
    const incoming = ref(this.#database, `/users/${this.#uid}/inbox`);
    const unsubInbox = onChildAdded(incoming, snapshot => {
      const message = snapshot.val();
      console.log('incoming', message);
      if (message.timestamp > Date.now() - TIMEOUT_MILLIS) {
        this.#handleMessage(message);
      }
      remove(snapshot.ref);
    });
    this.#runOnDisconnect.push(unsubInbox);
  }

  async #handleMessage(message) {
    if (message.nonce) {
      // Signaling message.
      if (this.#nonce === null || this.#nonce === message.nonce) {
        // Create the connection if necessary.
        if (!this.#peerConnection) {
          this.#nonce = message.nonce;
          this.#peerConnection = this.#createPeerConnection(message.src);
        }
        this.#peerConnection.postMessage(message.data);
      }
    } else {
      switch (message.type) {
        case 'caption':
          const caption = document.createElement('div');
          caption.textContent = message.data;
          this.shadowRoot.getElementById('caption-container').prepend(caption);
          break;
        case 'peek':
          // @ts-ignore
          this.shadowRoot.getElementById('peer-selector').value = message.id;
          this.#start();
          break;
        case 'reload':
          window.location.reload();
          break;
      }
    }
  }

  async #start() {
    if (!this.#peerConnection) {
      const peerSelector = this.shadowRoot.getElementById('peer-selector');
      // @ts-ignore
      this.#peerConnection = this.#createPeerConnection(peerSelector.value);
    }
  }

  async #stop() {
    this.#destroyPeerConnection();
  }

  #createPeerConnection(dst) {
    const primary = this.#uid < dst;
    const peerConnection = new PeerConnection(RTC_CONFIG, primary);

    // Display local and remote video.
    peerConnection.addMediaStream(MEDIA_CONSTRAINTS).then(mediaStream => {
      const view = /** @type {HTMLVideoElement} */(this.shadowRoot.getElementById('local'));
      view.srcObject = mediaStream;
    });
    peerConnection.addEventListener('track', ({track, streams}) => {
      const view = /** @type {HTMLVideoElement} */(this.shadowRoot.getElementById('remote'));
      track.addEventListener('unmute', () => {
        view.srcObject = streams[0];
      }, { once: true });
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

    // Tear down the connection on timeout.
    const scheduleDisconnect = () => {
      clearTimeout(this.#timeoutId);
      this.#timeoutId = setTimeout(() => this.#destroyPeerConnection(), TIMEOUT_MILLIS);
    }
    scheduleDisconnect();

    // Send keepalive pings over a data channel to reset the timeout.
    Promise.resolve().then(async () => {
      // Create the channel on one side, get notified on the other.
      const dataChannel = primary ?
        peerConnection.createDataChannel('keepalive') :
        await new Promise(resolve => {
          peerConnection.addEventListener('datachannel', ({channel}) => {
            if (channel.label === 'keepalive') {
              resolve(channel);
            }
          });
        });
      
      dataChannel.addEventListener('open', () => {
        // Start pinging.
        const pingId = setInterval(() => dataChannel.send('ping'), TIMEOUT_MILLIS / 4);
        dataChannel.addEventListener('close', () => {
          clearInterval(pingId);
          this.#destroyPeerConnection();
        });
      });
      dataChannel.addEventListener('message', scheduleDisconnect);
    });

    return peerConnection;
  }

  #destroyPeerConnection() {
    clearTimeout(this.#timeoutId);
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

      this.shadowRoot.querySelectorAll('#caption-container *').forEach(element => {
        element.remove();
      });
    }
  }

  #key(event) {
    if (event.key === 'Enter') {
      this.#caption(event.target.value);
      event.target.value = '';
    }
  }

  #caption(s) {
    if (s) {
      const message = {
        timestamp: Date.now(),
        type: 'caption',
        data: s
      };

      // @ts-ignore
      const dst = this.shadowRoot.getElementById('peer-selector').value;
      const inbox = ref(this.#database, `/users/${dst}/inbox`);
      push(inbox, message);

      this.#handleMessage(message);
    }
  }

  static get styles() {
    return css`
      :host {
        display: flex;
        width: 100%;
        height: 100%;

        flex-direction: column;
        gap: 0.5em;
      }

      #input {
        width: 50%;
      }

      #video-container {
        display: flex;
        width: 100%;
      }

      #remote {
        width: 50%;
        transform: scale(-1, 1);
      }

      #local {
        width: 0;
        flex: 0px 1 1;
      }

      #caption-container {
        display: flex;
        flex-direction: column-reverse;
        width: 100%;
        overflow: hidden;
        flex: 0px 1 1;

        font-size: 5vh;
        color: yellow;
      }

      .hidden {
        display: none;
      }
    `;
  }

  render() {
    return html`
      <div class="${this.hideControls ? 'hidden' : ''}">
        <select id="peer-selector">
          ${repeat(Object.entries(this.peers), ([uid, email]) => {
            return html`
              <option value="${uid}">${email}</option>
            `
          })}
        </select>
        <button @click=${this.#start}>Call</button>
        <button @click=${this.#stop}>Stop</button>
        <input id="input" @keydown=${this.#key}>
      </div>
      <div id="video-container">
        <video id="remote" autoplay></video>
        <video id="local" autoplay muted></video>
      </div>
      <div id="caption-container"></div>
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