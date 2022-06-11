import { LitElement, css, html } from 'lit';

// https://firebase.google.com/docs/web/setup#available-libraries
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase } from "firebase/database";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyASXeGyZygO7d_j_wfR6NiE-Fk49pG1uoQ",
  authDomain: "shoestring-videoboard.firebaseapp.com",
  projectId: "shoestring-videoboard",
  storageBucket: "shoestring-videoboard.appspot.com",
  messagingSenderId: "104957196093",
  appId: "1:104957196093:web:806779aabe41c1fee07754",
  measurementId: "G-V13R1N46M6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const database = getDatabase(app);

class VideoBoard extends LitElement {
  static properties = {
    example: { attribute: null }
  }

  constructor() {
    super();
  }

  static get styles() {
    return css`
      :host {
        display: flex;
      }
    `;
  }

  render() {
    return html`
      <h1>Hello VideoBoard</h1>
    `;
  }
}
customElements.define('video-board', VideoBoard);