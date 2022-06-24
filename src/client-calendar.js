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

  _buildDateTimeString(timestamp) {
    // Build the default date representation.
    const ts = timestamp.dateTime ?
      new Date(timestamp.dateTime) :
      new Date(timestamp.date + 'T00:00');

    let s = ts.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });

    // Replace with 'Today' or 'Tomorrow' if appropriate.
    const todayEpochMillis = new Date().setHours(0, 0, 0, 0);
    if (ts.valueOf() - todayEpochMillis < 24 * 60 * 60 * 1000) {
      s = 'Today';
    } else if (ts.valueOf() - todayEpochMillis < 48 * 60 * 60 * 1000) {
      s = 'Tomorrow';
    }

    // Add the time.
    if (timestamp.dateTime) {
      s += ', ' + ts.toLocaleTimeString(undefined, { timeStyle: 'short' });
    }
    return s;
  }

  async #fetchEvents() {
    clearTimeout(this.#fetchId);
    try {
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
    } finally {
      this.#fetchId = setTimeout(() => this.#fetchEvents(), UPDATE_EVENTS_INTERVAL_MILLIS);
    }
  }

  static get styles() {
    return css`
      :host {
        display: flex;
        flex-flow: column wrap;
        align-content: flex-start;
        gap: 10px;
        overflow: hidden;
        width: 100%;
        height: 100%;
      }

      .event {
        box-sizing: border-box;
        width: calc((100% - 20px) / 3);
        height: calc((100% - 20px) / 3);
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
            <div>${this._buildDateTimeString(event.start)}</div>
          </div>
        `)}
      `;
    }
  }
}
customElements.define('client-calendar', ClientCalendar);