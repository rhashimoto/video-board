const CIPHER_NAME = 'AES-CTR';
const CIPHER_KEY_LENGTH = 256;
const CIPHER_BLOCK_LENGTH = 128;
const DERIVATION_NAME = 'PBKDF2';
const DERIVATION_HASH = 'SHA-256';
const DERIVATION_DEFAULT_SALT = new Uint8Array(new Array(16).fill(0));
const DERIVATION_DEFAULT_ITERATIONS = 1;

const DEFAULT_IV = new Uint8Array(new Array(16).fill(0));

// Obfuscated LocalStorage.
export class ScrambleStore {
  /**
   * @param {string} password 
   * @param {BufferSource} [salt] 
   * @param {number} [iterations]
   */
  constructor(
    password,
    salt = DERIVATION_DEFAULT_SALT,
    iterations = DERIVATION_DEFAULT_ITERATIONS) {
    this.key = ScrambleStore.createSymmetricKey(password, salt, iterations);
  }

  /**
   * @param {string} key 
   * @param {*} value 
   */
  async set(key, value) {
    const json = JSON.stringify(value);
    const buffer = await ScrambleStore.encrypt(
      await this.key,
      DEFAULT_IV,
      new TextEncoder().encode(json))
    const base64 = ScrambleStore.cvtBufferToBase64(buffer)
    localStorage.setItem(await ScrambleStore.digest(key), base64);
  }

  /**
   * @param {string} key 
   * @returns {Promise}
   */
  async get(key) {
    const base64 = localStorage.getItem(await ScrambleStore.digest(key));
    if (!base64) return undefined;

    const buffer = await ScrambleStore.decrypt(
      await this.key,
      DEFAULT_IV,
      ScrambleStore.cvtBase64ToBuffer(base64));
    const json = new TextDecoder().decode(buffer);
    return JSON.parse(json);
  }

  /**
   * @param {string} key 
   */
  async delete(key) {
    localStorage.removeItem(await ScrambleStore.digest(key));
  }

  /**
   * @param {string} password 
   * @param {BufferSource} [salt] 
   * @param {number} [iterations] 
   * @returns {Promise<CryptoKey>}
   */
  static async createSymmetricKey(
    password,
    salt = DERIVATION_DEFAULT_SALT,
    iterations = DERIVATION_DEFAULT_ITERATIONS) {
    const material = await window.crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      DERIVATION_NAME,
      false,
      ['deriveKey']);

    const key = await window.crypto.subtle.deriveKey(
      {
        name: DERIVATION_NAME,
        hash: DERIVATION_HASH,
        salt,
        iterations
      },
      material,
      {
        name: CIPHER_NAME,
        length: CIPHER_KEY_LENGTH
      },
      false,
      ['encrypt', 'decrypt']);

    return key;
  }

  /**
   * @param {CryptoKey} key 
   * @param {BufferSource} iv 
   * @param {BufferSource} plaintext 
   * @returns {Promise<ArrayBuffer>}
   */
  static encrypt(key, iv, plaintext) {
    return window.crypto.subtle.encrypt({
      name: CIPHER_NAME,
      counter: iv,
      length: CIPHER_BLOCK_LENGTH / 2
    }, key, plaintext);
  }

  /**
   * @param {CryptoKey} key 
   * @param {BufferSource} iv 
   * @param {BufferSource} crypttext 
   * @returns {Promise<ArrayBuffer>}
   */
  static decrypt(key, iv, crypttext) {
    // Counter-mode encryption and decryption are the same.
    return this.encrypt(key, iv, crypttext);
  }

  /**
   * @param {string} base64 
   * @returns {ArrayBuffer}
   */
  static cvtBase64ToBuffer(base64) {
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0)).buffer;
  }

  /**
   * @param {BufferSource} source 
   * @returns {string}
   */
  static cvtBufferToBase64(source) {
    const bytes = ArrayBuffer.isView(source) ?
      new Uint8Array(source.buffer, source.byteOffset, source.byteLength) :
      new Uint8Array(source);
    return btoa(Array.prototype.map.call(bytes, byte => String.fromCharCode(byte)).join(''));
  }

  /**
   * @param {BufferSource|string} corpus 
   */
  static async digest(corpus) {
    const bytes = typeof corpus === 'string' ? new TextEncoder().encode(corpus) : corpus;
    const digest = await crypto.subtle.digest(DERIVATION_HASH, bytes);
    return ScrambleStore.cvtBufferToBase64(digest);
  }
}