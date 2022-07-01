export class PeerConnection extends RTCPeerConnection {
  #messageChannel = new MessageChannel();
  #hasLocalMedia = false;

  /**
   * @param {RTCConfiguration} config 
   * @param {{polite: boolean, remoteView: HTMLElement}} options
   */
  constructor(config, options) {
    super(config);

    // Adapt to WebRTC perfect negotiation sample code.
    // https://w3c.github.io/webrtc-pc/#perfect-negotiation-example
    const pc = this;
    /** @type {*} */ const signaling = this.#messageChannel.port1;
    signaling.send = (message) => signaling.postMessage(JSON.stringify(message));
    signaling.start();
    const polite = options.polite;
    const remoteView = /** @type {HTMLVideoElement} */ (options.remoteView ?? {});

    pc.ontrack = ({track, streams}) => {
      // once media for a remote track arrives, show it in the remote video element
      track.onunmute = () => {
        // don't set srcObject again if it is already set.
        if (remoteView.srcObject) return;
        remoteView.srcObject = streams[0];
      };
    };

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

    // this.#dataChannelReady = new Promise(resolve => {
    //   const dataChannel = this.createDataChannel('chat', {
    //     negotiated: true,
    //     id: 0
    //   });
    //   dataChannel.addEventListener('open', () => {
    //     resolve(dataChannel);
    //   }, { once: true });
    // });
  }

  /**
   * @returns {MessagePort}
   */
  getSignalPort() {
    return this.#messageChannel.port2;
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