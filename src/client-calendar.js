import { css, html, LitElement } from 'lit';
import { repeat } from 'lit/directives/repeat.js';

import { getFirebaseApp } from './firebase.js';
import  { gCall } from './gapi.js';

const UPDATE_EVENTS_INTERVAL_MILLIS = 5 * 60 * 1000;
const DAY_MILLIS = 24 * 60 * 60 * 1000;
const EVENTS_WINDOW_MILLIS = 7 * DAY_MILLIS;

const servicesReady = getFirebaseApp();

class ClientCalendar extends LitElement {
  #nowId = 0;
  #fetchId = 0;

  static properties = {
    now: { attribute: null },
    events: { attribute: null },
    detail: { attribute: null }
  }

  constructor() {
    super();
    this.now = Date.now();
    setInterval(() => this.now = Date.now(), 60 * 1000);

    this.events = [];
    this.#fetchEvents();

    this.detail = null;
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
    // Calculate start time milliseconds since epoch.
    const startDate =
      (event.start.dateTime && new Date(event.start.dateTime)) ||
      (event.start.date && new Date(event.start.date + 'T00:00')) ||
      new Date(0);
    event.start.epochMillis = startDate.valueOf();

    // Parse description.
    try {
      event.extras = JSON.parse(event.description);
      if (typeof event.extras !== 'object') throw new Error();
    } catch {
      event.extras = { text: event.description ?? '' };
    }
  }

  #getEventDateString(event) {
    const startEpoch = event.start.epochMillis;
    const todayEpoch = new Date().setHours(0, 0, 0, 0);
    const delta = startEpoch - todayEpoch;
    if (delta < DAY_MILLIS) {
      return 'Today';
    } else if (delta < 2 * DAY_MILLIS) {
      return 'Tomorrow';
    } else {
      return new Date(startEpoch).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      });
    }
  }

  #getEventTimeString(event) {
    if (event.start.dateTime) {
      return new Date(event.start.dateTime)
        .toLocaleTimeString(undefined, { timeStyle: 'short' });
    }
    return '';
  }

  #getEventClasses(event) {
    const classes = ['event'];

    const startEpoch = event.start.epochMillis;
    const todayEpoch = new Date().setHours(0, 0, 0, 0);
    const delta = startEpoch - todayEpoch;
    if (delta < DAY_MILLIS) {
      classes.push('today');
    } else if (delta < 2 * DAY_MILLIS) {
      classes.push('tomorrow');
    } else {
      classes.push('future');
    }

    if (event.extras.blink &&
        new Date(event.start.dateTime).valueOf() < new Date().valueOf()) {
      classes.push('blink');
    }

    return classes.join(' ');
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

      .today {
        color: black;
        background-color: gold;
      }

      .tomorrow {
        color: black;
        background-color: lightgreen;
      }

      .future {
        color: black;
        background-color: lightblue;
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
          <div class="${this.#getEventClasses(event)}">
            <div class="event-summary">${event.summary}</div>
            <div class="event-desc">${event.extras?.text}</div>
            <div class="event-when">
              <span>${this.#getEventDateString(event)}</span>
              <span>${this.#getEventTimeString(event)}</span>
            </div>
          </div>
        `)}
      `;
    }
  }
}
customElements.define('client-calendar', ClientCalendar);