import { css, html, LitElement } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import '@material/mwc-button';

import { getFirebaseApp } from './firebase.js';
import  { gCall } from './gapi.js';

const DEFAULT_LEAD_MINUTES = 30;
const UPDATE_EVENTS_INTERVAL_MILLIS = 5 * 60 * 1000;
const DETAIL_TIMEOUT_MILLIS = 1 * 60 * 1000;
const DAY_MILLIS = 24 * 60 * 60 * 1000;
const EVENTS_WINDOW_MILLIS = 7 * DAY_MILLIS;

const CALENDAR_IDS = [
  'primary',
  '35v5vbjh685ugfgnqouk6rlb98@group.calendar.google.com',
];

const servicesReady = getFirebaseApp();
 
class ClientCalendar extends LitElement {
  #fetchId;
  #detailId;
  #recurringEvents = new Set();

  static properties = {
    timestamp: { attribute: null},
    events: { attribute: null },
    detail: { attribute: null }
  }

  constructor() {
    super();

    this.timestamp = Date.now();
    this.events = new Map();
    this.#fetchEvents();

    this.detail = null;
  }

  async #fetchEvents() {
    clearTimeout(this.#fetchId);
    try {
      await servicesReady;

      const todayEpoch = new Date(this.timestamp).setHours(0,0,0,0);
      const results = CALENDAR_IDS.map(calendarId => gCall(gapi => {
        return gapi.client.calendar.events.list({
          calendarId,
          maxResults: 30,
          orderBy: 'startTime',
          singleEvents: true,
          timeMin: new Date(todayEpoch).toISOString(),
          timeMax: new Date(todayEpoch + EVENTS_WINDOW_MILLIS).toISOString()
        });
      }));

      const items = (await Promise.all(results))
        .flatMap(result => result.items)
        .map(event => {
          event.start.epochMillis = this.#getEventEpochMillis(event);
          return event;
        })
        .sort((a, b) => a.start.epochMillis - b.start.epochMillis);

      this.#recurringEvents.clear();
      this.events = new Map(items
        .map(item => this.#augmentEvent(item))
        .filter((item, i) => this.#shouldShowEvent(item))
        .filter((item, i) => i < 9)
        .map(item => [item.id, item]));
      console.log(this.events);
    } finally {
      this.#fetchId = setTimeout(() => this.#fetchEvents(), UPDATE_EVENTS_INTERVAL_MILLIS);
    }
  }

  #augmentEvent(event) {
    // Get description string, which may or may not be in an XML wrapper.
    let description = event.description ?? '';
    if (event.description?.startsWith('<html-blob>')) {
      const xml = new DOMParser().parseFromString(event.description, 'text/xml');
      description = xml.documentElement.textContent;
    }

    // Description may or may not be JSON.
    try {
      event.extras = JSON.parse(description);
      if (typeof event.extras !== 'object') throw new Error();
    } catch {
      event.extras = { text: description };
    }

    // Unescape HTML.
    if (event.extras.text) {
      event.extras.text = new DOMParser().parseFromString(event.extras.text, 'text/html')
        .body
        .innerHTML;
    }

    // Send update to invitees for expired incomplete tasks.
    if (event.extras.isTask && !event.extras.incomplete &&
        new Date(event.end.dateTime).valueOf() < this.timestamp) {
      event.extras.incomplete = true;
      gCall(gapi => gapi.client.calendar.events.patch({
        calendarId: 'primary',
        eventId: event.id,
        sendUpdates: 'all',
        description: JSON.stringify(event.extras),
      }));
    }
    return event;
  }

  #shouldShowEvent(event, index) {
    // Control whether to show multiple instances of a repeating event.
    if (event.recurringEventId) {
      const firstTime = !this.#recurringEvents.has(event.recurringEventId);
      this.#recurringEvents.add(event.recurringEventId);
      return firstTime || !event.extras.showOne;
    }
    return true;
  }

  #getEventDateString(event) {
    const startEpoch = event.start.epochMillis;
    const todayEpoch = new Date(this.timestamp).setHours(0, 0, 0, 0);
    switch(Math.trunc((startEpoch - todayEpoch) / DAY_MILLIS)) {
      case 0:
        return 'Today';
      case 1:
        return 'Tomorrow';
      default:
        return new Date(startEpoch).toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'short',
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

  #getEventEpochMillis(event) {
    const startDate =
      (event.start.dateTime && new Date(event.start.dateTime)) ||
      (event.start.date && new Date(event.start.date + 'T00:00')) ||
      new Date(0);
    return startDate.valueOf();
  }

  #isEventActiveTask(event) {
    if (event.extras.isTask) {
      // Tasks are active at the earliest reminder.
      const minutes = event.reminders?.overrides ?
      Math.max(0, ...event.reminders.overrides.map(override => override.minutes)) :
      DEFAULT_LEAD_MINUTES;
      const activeTime = event.start.epochMillis - minutes * 60_000;
      return activeTime < this.timestamp;
    }
    return false;
  }

  #handleEventTap({currentTarget}) {
    const id = currentTarget.getAttribute('data-id');
    const event = this.events.get(id);
    this.detail = event;
    this.#detailId = setTimeout(() => this.#clearDetail(), DETAIL_TIMEOUT_MILLIS);
  }

  #handleDetailBack() {
    this.#clearDetail();
  }

  async #handleDetailComplete() {
    try {
      await servicesReady;
      await gCall(gapi => gapi.client.calendar.events.delete({
        calendarId: 'primary',
        eventId: this.detail.id
      }));
      this.events.delete(this.detail.id);
    } finally {
      this.#clearDetail();
    }
  }

  #clearDetail() {
    clearTimeout(this.#detailId);
    this.detail = null;
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
        gap: 0.4em;
      }

      .event {
        display: flex;
        flex-direction: column;
        align-items: stretch;
      }

      .event-summary {
        font-size: min(4vh, 24pt);
        font-weight: bold;
        padding-bottom: 0.5em;
      }

      .event-desc {
        flex: 1 1 auto;
        font-size: min(3vh, 17pt);
      }

      .event-when {
        display: flex;
        justify-content: space-between;
        font-size: min(4vh, 22pt);
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
            <div class="event-desc">${unsafeHTML(this.detail.extras?.text ?? '')}</div>
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
            class="${this.#isEventActiveTask(this.detail) ? '' : 'hidden'}"
            @click=${this.#handleDetailComplete}>
          </mwc-button>
        </div>
      `;
    } else {
      return html`
        <div id="events-container">
          ${repeat(this.events.values(), event => html`
            <div
              class="event ${this.#getEventImminence(event)} ${this.#isEventActiveTask(event) ? 'blink' : ''}"
              data-id="${event.id}">
              <div class="event-summary">${event.summary}</div>
              <div class="event-desc">${unsafeHTML(event.extras?.text ?? '')}</div>
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
