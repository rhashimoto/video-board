import { css, html, LitElement } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import '@material/mwc-button';

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

    this.events = new Map();
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
          maxResults: 9,
          orderBy: 'startTime',
          singleEvents: true,
          timeMin: new Date(todayEpoch).toISOString(),
          //timeMax: new Date(todayEpoch + EVENTS_WINDOW_MILLIS).toISOString()
        });
      });
      this.events = new Map(result.items.map(item => [item.id, item]));

      for (const event of this.events.values()) {
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
    switch(Math.trunc((startEpoch - todayEpoch) / DAY_MILLIS)) {
      case 0:
        return 'Today';
      case 1:
        return 'Tomorrow';
      default:
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

  #getEventImminence(event) {
    const dateString = this.#getEventDateString(event).toLowerCase();
    return ['today', 'tomorrow'].includes(dateString) ? dateString : 'future';
  }

  #shouldEventBlink(event) {
    return event.extras.blink &&
      new Date(event.start.dateTime).valueOf() < new Date().valueOf();
  }

  #handleEventTap({currentTarget}) {
    const id = currentTarget.getAttribute('data-id');
    const event = this.events.get(id);
    this.detail = event;
  }

  #handleDetailBack() {
    this.detail = null;
  }

  #handleDetailComplete() {

  }

  static get styles() {
    return css`
      :host {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: 2em;

        width: 100%;
        height: 100%;
        overflow: hidden;
      }

      mwc-button {
        --mdc-theme-primary: #e9437a;
        --mdc-theme-on-primary: white;
      }

      #events-container {
        width: 100%;
        height: 100%;
        overflow: hidden;

        display: grid;
        grid-template-rows: repeat(3, 1fr);
        grid-template-columns: repeat(3, 1fr);
        grid-auto-flow: column;
        gap: 10px;
      }

      .event {
        display: flex;
        flex-direction: column;
        align-items: stretch;
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
        display: flex;
        justify-content: space-between;
        font-size: 18pt;
        padding-top: 0.5em;
      }

      #detail {
        width: 50%;
        aspect-ratio: 16 / 9;
      }
      
      #detail-buttons {
        display: flex;
        width: 50%;
        justify-content: space-around;
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

      .hidden {
        display: none;
      }
    `;
  }

  render() {
    if (this.detail) {
      return html`
        <div id="detail"
          class="event ${this.#getEventImminence(this.detail)}">
          <div class="event-summary">${this.detail.summary}</div>
            <div class="event-desc">${this.detail.extras?.text}</div>
            <div class="event-when">
              <span>${this.#getEventDateString(this.detail)}</span>
              <span>${this.#getEventTimeString(this.detail)}</span>
            </div>
        </div>
        <div id=detail-buttons>
          <mwc-button label="Back to events" raised
            @click=${this.#handleDetailBack}>
          </mwc-button>
          <mwc-button label="Task complete" raised
            class="${this.detail.extras.isTask ? '' : 'hidden'}"
            @click=${this.#handleDetailComplete}>
          </mwc-button>
        </div>
      `;
    } else {
      return html`
        <div id="events-container">
          ${repeat(this.events.values(), event => html`
            <div
              class="event ${this.#getEventImminence(event)} ${this.#shouldEventBlink(event) ? 'blink' : ''}"
              data-id="${event.id}" @click=${this.#handleEventTap}>
              <div class="event-summary">${event.summary}</div>
              <div class="event-desc">${event.extras?.text}</div>
              <div class="event-when">
                <span>${this.#getEventDateString(event)}</span>
                <span>${this.#getEventTimeString(event)}</span>
              </div>
            </div>
          `)}
        </div>
      `;
    }
  }
}
customElements.define('client-calendar', ClientCalendar);