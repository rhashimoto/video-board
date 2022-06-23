import { css, html, LitElement } from 'lit';
import { repeat } from 'lit/directives/repeat.js';

import { getFirebaseApp } from './firebase.js';
import  { gCall } from './gapi.js';

const UPDATE_EVENTS_INTERVAL_MILLIS = 5 * 60 * 1000;

const servicesReady = getFirebaseApp();

class ClientCalendar extends LitElement {
  #fetchId = 0;

  static properties = {
    events: { attribute: null },
    detail: { attribute: null }
  }

  constructor() {
    super();
    this.events = [];
    this.detail = null;
    this.#fetchEvents()
  }

  async #fetchEvents() {
    clearTimeout(this.#fetchId);

    await servicesReady;
    const result = await gCall(gapi =>
      gapi.client.calendar.events.list({
        calendarId: 'primary',
        maxResults: 8,
        orderBy: 'startTime',
        singleEvents: true,
        timeMin: new Date(new Date().setHours(0,0,0,0)).toISOString()
      }));
    this.events = result.items;
    console.log(this.events);
    
    this.#fetchId = setTimeout(() => this.#fetchEvents(), UPDATE_EVENTS_INTERVAL_MILLIS)
  }

  static get styles() {
    return css`
      :host {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        width: 100%;
        height: 100%;
      }

      .event {
        width: 33%;
        height: 33%;
        background-color: lightblue;
      }
    `;
  }

  render() {
    if (this.detail) {
      return html`
        <div id="detail">

        </div>
      `;
    } else {
      return html`
        ${repeat(this.events, event => html`
          <div class="event">

          </div>
        `)}
      `;
    }
  }
}
customElements.define('client-calendar', ClientCalendar);