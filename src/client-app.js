import { css, html, LitElement } from 'lit';

import { getGAPI } from './gapi.js';
import './client-calendar.js';

class ClientApp extends LitElement {
  static properties = {
    timestamp: { attribute: null },
    dateString: { attribute: null },
    timeString: { attribute: null },
  }

  constructor() {
    super();
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
    `;
  }

  render() {
    return html`
      <div id="bar">
        <span>${this.dateString}</span>
        <span>${this.timeString}</span>
      </div>
      <div id="container">
        <client-calendar .timestamp=${this.timestamp}></client-calendar>
      </div>
    `;
  }
}
customElements.define('client-app', ClientApp);