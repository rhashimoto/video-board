import { css, html, LitElement } from 'lit';

import './client-calendar.js';

class ClientTop extends LitElement {
  static properties = {
    date: { attribute: null },
    time: { attribute: null },
  }

  constructor() {
    super();
    this.#updateDateTime();
  }

  #updateDateTime() {
    this.date = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    this.time = new Date().toLocaleTimeString(undefined, { timeStyle: 'short' });
    setTimeout(() => this.#updateDateTime(), 1000);
  }

  static get styles() {
    return css`
      :host {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
      }

      #bar {
        display: flex;
        justify-content: space-between;
      }

      #container {
        flex: auto 1 1;
      }
    `;
  }

  render() {
    return html`
      <div id="bar">
        <span>${this.date}</span>
        <span>${this.time}</span>
      </div>
      <div id="container">
        <client-calendar></client-calendar>
      </div>
    `;
  }
}
customElements.define('client-top', ClientTop);