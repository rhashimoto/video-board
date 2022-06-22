import { css, html, LitElement } from 'lit';
import { repeat } from 'lit/directives/repeat.js';

import { getFirebaseApp } from './firebase.js';
import  { gCall } from './gapi.js';

const UPDATE_EVENTS_INTERVAL_MILLIS = 5 * 60 * 1000;

class ClientCalendar extends LitElement {
  #servicesReady = getFirebaseApp();
  #fetchId = 0;

  static properties = {
    example: { attribute: null }
  }

  constructor() {
    super();
    this.#fetchEvents()
  }

  async #fetchEvents() {
    clearTimeout(this.#fetchId);

    await this.#servicesReady;
    const result = await gCall(gapi =>
      gapi.client.calendar.events.list({
        calendarId: 'primary',
        maxResults: 8,
        orderBy: 'startTime',
        singleEvents: true,
        timeMin: new Date(new Date().setHours(0,0,0,0)).toISOString()
      }));
    console.log(result);
  
    this.#fetchId = setTimeout(() => this.#fetchEvents(), UPDATE_EVENTS_INTERVAL_MILLIS)
  }

  static get styles() {
    return css`
      :host {
        display: flex;
        width: 100%;
        height: 100%;
      }
    `;
  }

  render() {
    return html`
      <h1>Client Calendar</h1>
    `;
  }
}
customElements.define('client-calendar', ClientCalendar);