// Use a script element with type "application/json" to enclose a JSON
// object.
const {
  GOOGLE_CLIENT_ID,
  GOOGLE_DISCOVERY_DOCS, // array of [service, version]
  GOOGLE_GAPI_LIBRARIES  // colon-delimited string
} = JSON.parse(document.getElementById('google-config')?.textContent ?? '{}');

/**
 * Set the GAPI object. This is primarily called internally when GAPI
 * is fully configured, but is exported for mocking purposes.
 * @type {(gapi: object) => void}
 */
export let setGAPI;
const gapiReady = new Promise(function(resolve) {
  setGAPI = resolve;
});

/**
 * @returns {Promise}
 */
export function getGAPI() {
  return gapiReady;
}

// Configure GAPI using load callback.
window['onGAPILoad'] = (function() {
  const existingCallback = window['onGAPILoad'];
  return function() {
    existingCallback?.();
    onGAPILoad();
  };
})();
window.addEventListener('onGAPILoad', onGAPILoad);

async function onGAPILoad() {
  const gapi = window['gapi'];

  // Intiialize the client, plus any other top-level libraries (e.g. picker).
  await new Promise((callback, onerror) => {
    gapi.load(GOOGLE_GAPI_LIBRARIES, { callback, onerror });
  });
  await gapi.client.init({});

  // Load the client libraries, e.g. drive, docs, sheets.
  await Promise.all(GOOGLE_DISCOVERY_DOCS.map(doc => {
    return gapi.client.load(doc);
  }));

  setGAPI(gapi);
}

let getAccessToken = async function() {
  throw new Error('no token provider');
}

export function setTokenProvider(tokenProvider) {
  getAccessToken = tokenProvider;
}

/**
 * Wrapper function to retry API call on missing or expired access token.
 * @param {(gapi) => any} f function issuing client library call
 * @returns {Promise} return value of f
 */
export async function gCall(f) {
  const gapi = await getGAPI();
  for (let i = 0; i < 2; ++i) {
    try {
      const response = await f(gapi);
      return response.result;
    } catch (e) {
      const code = e.result?.error?.code;
      if (!i && (code === 401 || code === 403)) {
        // First try authorization failure so fetch a new token.
        const token = await getAccessToken();
        gapi.auth.setToken({ access_token: token });
      } else {
        throw new Error(e.result?.error?.message);
      }
    }
  }
}