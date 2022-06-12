import { ScrambleStore } from "./ScrambleStore";

const DEFAULT_VALID_MILLIS = 30_000;
const TOKEN_KEY = 'VIDEO_BOARD_TOKEN';

// Use a script element with type "application/json" to enclose a JSON
// object.
const {
  GOOGLE_CLIENT_ID,
  GOOGLE_DISCOVERY_DOCS, // array of [service, version]
  GOOGLE_GAPI_LIBRARIES, // colon-delimited string
  GOOGLE_SCOPES          // array of scopes
} = JSON.parse(document.getElementById('google-config')?.textContent ?? '{}');

// Obfuscated store for access token.
const tokenStore = new ScrambleStore(GOOGLE_CLIENT_ID);

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

  // Restore access token.
  const storedToken = await tokenStore.get(TOKEN_KEY);
  if (storedToken) {
    console.log('restoring token', storedToken);
    gapi.auth.setToken(storedToken);
  }

  setGAPI(gapi);
}

// Prepare for token authorization.
const tokenClientReady = new Promise(async function(resolve) {
  // Wait for Google Identity Services.
  await new Promise(function(resolve) {
    const existingCallback = window['onGISLoad'];
    window['onGISLoad'] = function() {
      existingCallback?.();
      resolve();
    };
    window.addEventListener('onGISLoad', resolve);
  });

  // Create the token client.
  // https://developers.google.com/identity/oauth2/web/reference/js-reference#google.accounts.oauth2.initTokenClient
  const tokenClient = window['google'].accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: GOOGLE_SCOPES.join(' '),
    prompt: '',
    callback: '' // defined at request time in await/promise scope.
  });
  resolve(tokenClient);
});

let accessTokenExpiration = 0;
/**
 * @param {number} [millis] requested valid duration
 * @returns {Promise}
 */
export async function getAccessToken(millis = DEFAULT_VALID_MILLIS) {
  const gapi = await getGAPI();

  // Return existing token if valid for the requested time.
  const accessToken = gapi.client.getToken();
  console.log('getAccessToken', accessToken, (accessTokenExpiration - Date.now())/1000);
  if (accessToken && accessTokenExpiration - Date.now() >= millis) {
    return accessToken;
  }

  function updateToken(accessToken) {
    tokenStore.set(TOKEN_KEY, accessToken);
    accessTokenExpiration = Date.now() + accessToken?.expires_in * 1000;
    console.log('updated accessToken', accessToken);
  }

  // Attempt legacy method for token refresh. The documentation isn't clear
  // whether this is still supported but I don't know of an alternative that
  // doesn't show the popup.
  // if (accessToken) {
  //   console.log('gapi.auth.authorize');
  //   const maybeToken = await new Promise(function(resolve) {
  //     try {
  //       gapi.auth.authorize({
  //         client_id: GOOGLE_CLIENT_ID,
  //         scope: GOOGLE_SCOPES.join(' '),
  //         immediate: true
  //       }, resolve);
  //     } catch (e) {
  //       console.error('gapi.auth.authorize() failed', e);
  //       resolve(e);
  //     }
  //   });
    
  //   if (maybeToken.access_token) {
  //     updateToken(maybeToken);
  //     return maybeToken;
  //   } else {
  //     console.warn('gapi.auth.authorize() did not return token', maybeToken);
  //   }
  // } 

  // Fetch a new token. GAPI is updated automatically.
  const tokenClient = await tokenClientReady;
  return await new Promise(function (resolve, reject) {
    tokenClient.callback = function(response) {
      if (response.error) {
        return reject(new Error(response.error));
      }
      const accessToken = gapi.client.getToken();
      updateToken(accessToken);
      resolve(accessToken);
    };
    tokenClient.requestAccessToken();
  });
}

let credential;
export async function getCredential() {
  if (!credential) {
    // Fetch credential.
    await tokenClientReady;
    const response = await new Promise(function(resolve) {
      window['google'].accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        auto_select: true,
        cancel_on_tap_outside: false,
        callback: resolve
      });
      window['google'].accounts.id.prompt();
    });
    credential = response.credential;
  }
  return credential;
}

/**
 * Wrapper function to retry API call on missing or expired access token.
 * @param {() => any} f function issuing client library call
 * @returns {Promise} return value of f
 */
export async function gCall(f) {
  for (let i = 0; i < 2; ++i) {
    try {
      const response = await f();
      return response.result;
    } catch (e) {
      const code = e.result?.error?.code;
      if (!i && (code === 401 || code === 403)) {
        // First try authorization failure so fetch a new token.
        await getAccessToken();
      } else {
        throw new Error(e.result?.error?.message);
      }
    }
  }
}