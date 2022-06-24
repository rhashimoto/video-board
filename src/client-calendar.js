import { css, html, LitElement } from 'lit';
import { repeat } from 'lit/directives/repeat.js';

import { getFirebaseApp } from './firebase.js';
import  { gCall } from './gapi.js';

const UPDATE_EVENTS_INTERVAL_MILLIS = 5 * 60 * 1000;
const DAY_MILLIS = 24 * 60 * 60 * 1000;
const EVENTS_WINDOW_MILLIS = 7 * DAY_MILLIS;

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
    try {
      await servicesReady;
      const result = await gCall(gapi => {
        const todayEpoch = new Date().setHours(0,0,0,0);
        return gapi.client.calendar.events.list({
          calendarId: 'primary',
          maxResults: 8,
          orderBy: 'startTime',
          singleEvents: true,
          timeMin: new Date(todayEpoch).toISOString(),
          timeMax: new Date(todayEpoch + EVENTS_WINDOW_MILLIS).toISOString()
        });
      });
      this.events = result.items;

      for (const event of this.events) {
        this.#augmentEvent(event);
      }
      console.log(this.events);
    } finally {
      this.#fetchId = setTimeout(() => this.#fetchEvents(), UPDATE_EVENTS_INTERVAL_MILLIS);
    }
  }

  #augmentEvent(event) {
    // Build friendly date/time strings.
    const startDate =
      (event.start.dateTime && new Date(event.start.dateTime)) ||
      (event.start.date && new Date(event.start.date + 'T00:00')) ||
      new Date(0);
    const startEpoch = startDate.valueOf();

    const todayEpoch = new Date().setHours(0, 0, 0, 0);
    if (startEpoch - todayEpoch < DAY_MILLIS) {
      event.start.dateString = 'Today';
    } else if (startEpoch - todayEpoch < 2 * DAY_MILLIS) {
      event.start.dateString = 'Tomorrow';
    } else {
      event.start.dateString = startDate.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      });
    }

    if (event.start.dateTime) {
      event.start.timeString = startDate.toLocaleTimeString(undefined, { timeStyle: 'short' });
    } else {
      event.start.timeString = '';
    }

    // Parse description.
    try {
      event.extras = JSON.parse(event.description);
      if (typeof event.extras !== 'object') throw new Error();
    } catch {
      event.extras = { text: event.description ?? '' };
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
        display: flex;
        flex-direction: column;

        color: black;
        background-color: gold;
      }

      .event-summary {
        font-size: 18pt;
        font-weight: bold;
        padding-bottom: 0.5em;
      }

      .event-desc {
        flex: 1 1 auto;
        font-size: 16pt;
      }

      .event-when {
        width: 100%;
        display: flex;
        justify-content: space-between;
        font-size: 18pt;
        padding-top: 0.5em;
      }

      .blink {
        animation: blinker 1s step-start infinite;
      }
      
      @keyframes blinker {
        50% {
          background-color: hotpink;
        }
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
            <div class="event-summary">${event.summary}</div>
            <div class="event-desc">${event.extras?.text}</div>
            <div class="event-when">
              <span>${event.start.dateString}</span>
              <span>${event.start.timeString}</span>
            </div>
          </div>
        `)}
      `;
    }
  }
}
customElements.define('client-calendar', ClientCalendar);