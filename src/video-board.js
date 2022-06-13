import { LitElement, css, html } from 'lit';
import { onChildAdded, push, ref, remove } from "firebase/database";

import { getFirebaseDatabase, getFirebaseUid } from './firebase.js';
import { PeerConnection } from './PeerConnection.js';

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

class VideoBoard extends LitElement {

  static properties = {
    example: { attribute: null }
  }

  constructor() {
    super();
    this.ready = this.initialize();
  }

  async initialize() {
    this.uid = await getFirebaseUid();
    this.database = await getFirebaseDatabase();
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

          this.peerConnection = new PeerConnection(RTC_CONFIG);
          await this.peerConnection.addMediaStream(MEDIA_CONSTRAINTS);
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

          this.peerConnection.addEventListener('data', ({detail}) => {
            console.log('chat', detail);
          });
          this.peerConnection.send('from answerer');
        } else if (message.candidate) {
          this.peerConnection.addIceCandidate(message.candidate);
        }
      }
    } finally {
      remove(snapshot.ref);
    }
  }

  async _call() {
    const contextId = Math.random().toString(36).replace('0.', '');
    const clientId = this.shadowRoot.getElementById('target').value;

    const peerConnection = new PeerConnection(RTC_CONFIG);
    await peerConnection.addMediaStream(MEDIA_CONSTRAINTS);
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

    // Make offer.
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    const inbox = ref(this.database, `clients/${clientId}/in`);
    push(inbox, {
      timestamp: Date.now(),
      contextId,
      offer: offer.toJSON()
    })

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

    peerConnection.addEventListener('data', ({detail}) => {
      console.log('chat', detail);
    });
    peerConnection.send('from offerer');
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