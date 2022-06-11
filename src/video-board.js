import { LitElement, css, html } from 'lit';

class VideoBoard extends LitElement {
  static properties = {
    example: { attribute: null }
  }

  constructor() {
    super();
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