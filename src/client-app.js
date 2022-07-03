import { css, html, LitElement } from 'lit';

import { getGAPI } from './gapi.js';
import './client-calendar.js';
import './client-rtc.js';

class ClientApp extends LitElement {
  static properties = {
    isRTCActive: { attribute: null },
    timestamp: { attribute: null },
    dateString: { attribute: null },
    timeString: { attribute: null },
  }

  constructor() {
    super();
    this.isRTCActive = false;
    this.#updateDateTime();

    // Reload page if Google APIs did not initialize properly.
    Promise.race([
      getGAPI(),
      new Promise(resolve => setTimeout(resolve, 60_000))
    ]).then(async (gapi) => {
      if (!gapi) {
        window.location.reload();
      }
    });
  }

  firstUpdated() {
    // Switch to WebRTC tab when in a call.
    const rtc = this.shadowRoot.querySelector('client-rtc');
    rtc.addEventListener('beginConnection', () => {
      this.isRTCActive = true;      
    });
    rtc.addEventListener('endConnection', () => {
      this.isRTCActive = false;      
    });
  }

  #updateDateTime() {
    const date = new Date();
    this.timestamp = date.valueOf();
    this.dateString = date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    this.timeString = date.toLocaleTimeString(undefined, { timeStyle: 'short' });
    setTimeout(() => this.#updateDateTime(), 1000);
  }

  static get styles() {
    return css`
      :host {
        display: flex;
        flex-direction: column;
        gap: 10px;
        width: 100%;
        height: 100%;
        color: white;
        background-color: #2f2f4f;
      }

      #bar {
        display: flex;
        justify-content: space-between;
        font-size: 24pt;
      }

      #container {
        flex: auto 1 1;
      }

      .hidden {
        display: none;
      }
    `;
  }

  render() {
    return html`
      <div id="bar">
        <span>${this.dateString}</span>
        <span>${this.timeString}</span>
      </div>
      <div id="container">
        <client-rtc class="${this.isRTCActive ? '' : 'hidden'}" hide-controls></client-rtc>
        <client-calendar class="${this.isRTCActive ? 'hidden' : ''}"
          .timestamp=${this.timestamp}>
        </client-calendar>
      </div>
    `;
  }
}
customElements.define('client-app', ClientApp);