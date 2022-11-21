import { css, html, LitElement } from 'lit';

import { getGAPI } from './gapi.js';
import './client-calendar.js';
import './client-rtc.js';

const DAYLIGHT_RANGES = [
  [[7, 0, 0, 0],[19, 0, 0, 0]],
];

function isDaylight(date) {
  for (const [startTime, endTime] of DAYLIGHT_RANGES) {
    const startDate = new Date(date);
    // @ts-ignore
    startDate.setHours(...startTime);
    
    const endDate = new Date(date);
    // @ts-ignore
    endDate.setHours(...endTime);

    if (date >= startDate && date < endDate) {
      return true;
    }
  }
  return false;
}

class ClientApp extends LitElement {
  static properties = {
    isRTCActive: { attribute: null },
    isDaylight: { attribute: null },
    timestamp: { attribute: null },
    dateString: { attribute: null },
    timeString: { attribute: null },
  }

  constructor() {
    super();
    this.isRTCActive = false;
    this.isDaylight = true;
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
    this.dateString = date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    this.timeString = date.toLocaleTimeString(undefined, { timeStyle: 'short' }).toLowerCase();
    setTimeout(() => this.#updateDateTime(), 1000);

    // Set night mode.
    this.isDaylight = isDaylight(date);
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
        background-color: black;
      }

      #bar {
        display: flex;
        justify-content: space-between;
        font-size: min(13vh, 64pt);
      }

      #container {
        flex: auto 1 1;
        height: 1px;
      }

      .overlay {
        position: absolute;
        top: 0;
        left: 0;
        z-index: 10;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.98);

        pointer-events: none;
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
      <div class="overlay ${this.isDaylight ? 'hidden' : ''}"></div>
    `;
  }
}
customElements.define('client-app', ClientApp);