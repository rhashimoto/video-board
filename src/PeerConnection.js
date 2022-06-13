export class PeerConnection extends RTCPeerConnection {
  /** @type {Promise<RTCDataChannel>} */ #dataChannelReady;

  /**
   * @param {RTCConfiguration} config 
   */
  constructor(config) {
    super(config);

    this.#dataChannelReady = new Promise(resolve => {
      const dataChannel = this.createDataChannel('chat', {
        negotiated: true,
        id: 0
      });
      dataChannel.addEventListener('open', () => {
        resolve(dataChannel);
      }, { once: true });
      dataChannel.addEventListener('message', ({data}) => {
        this.dispatchEvent(new CustomEvent('data', {
          detail: data
        }));
      });
    });
  }

  /**
   * @param {MediaStream|MediaStreamConstraints} constraintsOrStream 
   */
  async addMediaStream(constraintsOrStream) {
    const mediaStream = constraintsOrStream instanceof MediaStream ?
      constraintsOrStream :
      await navigator.mediaDevices.getUserMedia(constraintsOrStream);
    for (const track of mediaStream.getTracks()) {
      this.addTrack(track, mediaStream);
    }
  }

  async send(data) {
    const dataChannel = await this.#dataChannelReady;
    dataChannel.send(data);
  }
}