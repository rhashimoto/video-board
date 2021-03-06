export class PeerConnection extends RTCPeerConnection {
  #hasLocalMedia = false;
  #signaling = {
    send: (message) => {
      this.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify(message)
      }));
    },

    postMessage(data) {
      this.onmessage({ data: JSON.parse(data) });
    },

    onmessage: null
  };

  /**
   * @param {RTCConfiguration} config 
   * @param {boolean} polite
   */
  constructor(config, polite) {
    super(config);

    // Adapt to use WebRTC perfect negotiation sample code verbatim.
    // https://w3c.github.io/webrtc-pc/#perfect-negotiation-example
    const pc = this;
    const signaling = this.#signaling;

    // - The perfect negotiation logic, separated from the rest of the application ---
    
    // keep track of some negotiation state to prevent races and errors
    let makingOffer = false;
    let ignoreOffer = false;
    let isSettingRemoteAnswerPending = false;
    
    // send any ice candidates to the other peer
    pc.onicecandidate = ({candidate}) => signaling.send({candidate});
    
    // let the "negotiationneeded" event trigger offer generation
    pc.onnegotiationneeded = async () => {
      try {
        makingOffer = true;
        await pc.setLocalDescription();
        signaling.send({description: pc.localDescription});
      } catch (err) {
         console.error(err);
      } finally {
        makingOffer = false;
      }
    };
    
    signaling.onmessage = async ({data: {description, candidate}}) => {
      try {
        if (description) {
          // An offer may come in while we are busy processing SRD(answer).
          // In this case, we will be in "stable" by the time the offer is processed
          // so it is safe to chain it on our Operations Chain now.
          const readyForOffer =
              !makingOffer &&
              (pc.signalingState == "stable" || isSettingRemoteAnswerPending);
          const offerCollision = description.type == "offer" && !readyForOffer;
    
          ignoreOffer = !polite && offerCollision;
          if (ignoreOffer) {
            return;
          }
          isSettingRemoteAnswerPending = description.type == "answer";
          await pc.setRemoteDescription(description); // SRD rolls back as needed
          isSettingRemoteAnswerPending = false;
          if (description.type == "offer") {
            await pc.setLocalDescription();
            signaling.send({description: pc.localDescription});
          }
        } else if (candidate) {
          try {
            await pc.addIceCandidate(candidate);
          } catch (err) {
            if (!ignoreOffer) throw err; // Suppress ignored offer's candidates
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
  }

  postMessage(data) {
    this.#signaling.postMessage(data);
  }

  /**
   * @param {MediaStream|MediaStreamConstraints} constraintsOrStream 
   * @returns {Promise<MediaStream>}
   */
  async addMediaStream(constraintsOrStream) {
    if (this.#hasLocalMedia) throw new Error('media already added');

    const mediaStream = constraintsOrStream instanceof MediaStream ?
      constraintsOrStream :
      await navigator.mediaDevices.getUserMedia(constraintsOrStream);
    for (const track of mediaStream.getTracks()) {
      this.addTrack(track, mediaStream);
    }

    this.#hasLocalMedia = true;
    return mediaStream;
  }

  hasLocalMedia() {
    return this.#hasLocalMedia;
  }
}