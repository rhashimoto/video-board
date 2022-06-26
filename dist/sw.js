(function () {
    'use strict';

    // @ts-ignore
    try {
        self['workbox:core:6.5.2'] && _();
    }
    catch (e) { }

    /*
      Copyright 2018 Google LLC

      Use of this source code is governed by an MIT-style
      license that can be found in the LICENSE file or at
      https://opensource.org/licenses/MIT.
    */
    const fallback = (code, ...args) => {
        let msg = code;
        if (args.length > 0) {
            msg += ` :: ${JSON.stringify(args)}`;
        }
        return msg;
    };
    const messageGenerator = fallback ;

    /*
      Copyright 2018 Google LLC

      Use of this source code is governed by an MIT-style
      license that can be found in the LICENSE file or at
      https://opensource.org/licenses/MIT.
    */
    /**
     * Workbox errors should be thrown with this class.
     * This allows use to ensure the type easily in tests,
     * helps developers identify errors from workbox
     * easily and allows use to optimise error
     * messages correctly.
     *
     * @private
     */
    class WorkboxError extends Error {
        /**
         *
         * @param {string} errorCode The error code that
         * identifies this particular error.
         * @param {Object=} details Any relevant arguments
         * that will help developers identify issues should
         * be added as a key on the context object.
         */
        constructor(errorCode, details) {
            const message = messageGenerator(errorCode, details);
            super(message);
            this.name = errorCode;
            this.details = details;
        }
    }

    /*
      Copyright 2019 Google LLC
      Use of this source code is governed by an MIT-style
      license that can be found in the LICENSE file or at
      https://opensource.org/licenses/MIT.
    */
    const logger = (null
        );

    /*
      Copyright 2018 Google LLC

      Use of this source code is governed by an MIT-style
      license that can be found in the LICENSE file or at
      https://opensource.org/licenses/MIT.
    */
    const _cacheNameDetails = {
        googleAnalytics: 'googleAnalytics',
        precache: 'precache-v2',
        prefix: 'workbox',
        runtime: 'runtime',
        suffix: typeof registration !== 'undefined' ? registration.scope : '',
    };
    const _createCacheName = (cacheName) => {
        return [_cacheNameDetails.prefix, cacheName, _cacheNameDetails.suffix]
            .filter((value) => value && value.length > 0)
            .join('-');
    };
    const eachCacheNameDetail = (fn) => {
        for (const key of Object.keys(_cacheNameDetails)) {
            fn(key);
        }
    };
    const cacheNames = {
        updateDetails: (details) => {
            eachCacheNameDetail((key) => {
                if (typeof details[key] === 'string') {
                    _cacheNameDetails[key] = details[key];
                }
            });
        },
        getGoogleAnalyticsName: (userCacheName) => {
            return userCacheName || _createCacheName(_cacheNameDetails.googleAnalytics);
        },
        getPrecacheName: (userCacheName) => {
            return userCacheName || _createCacheName(_cacheNameDetails.precache);
        },
        getPrefix: () => {
            return _cacheNameDetails.prefix;
        },
        getRuntimeName: (userCacheName) => {
            return userCacheName || _createCacheName(_cacheNameDetails.runtime);
        },
        getSuffix: () => {
            return _cacheNameDetails.suffix;
        },
    };

    /*
      Copyright 2018 Google LLC

      Use of this source code is governed by an MIT-style
      license that can be found in the LICENSE file or at
      https://opensource.org/licenses/MIT.
    */
    const getFriendlyURL = (url) => {
        const urlObj = new URL(String(url), location.href);
        // See https://github.com/GoogleChrome/workbox/issues/2323
        // We want to include everything, except for the origin if it's same-origin.
        return urlObj.href.replace(new RegExp(`^${location.origin}`), '');
    };

    /*
      Copyright 2020 Google LLC
      Use of this source code is governed by an MIT-style
      license that can be found in the LICENSE file or at
      https://opensource.org/licenses/MIT.
    */
    function stripParams(fullURL, ignoreParams) {
        const strippedURL = new URL(fullURL);
        for (const param of ignoreParams) {
            strippedURL.searchParams.delete(param);
        }
        return strippedURL.href;
    }
    /**
     * Matches an item in the cache, ignoring specific URL params. This is similar
     * to the `ignoreSearch` option, but it allows you to ignore just specific
     * params (while continuing to match on the others).
     *
     * @private
     * @param {Cache} cache
     * @param {Request} request
     * @param {Object} matchOptions
     * @param {Array<string>} ignoreParams
     * @return {Promise<Response|undefined>}
     */
    async function cacheMatchIgnoreParams(cache, request, ignoreParams, matchOptions) {
        const strippedRequestURL = stripParams(request.url, ignoreParams);
        // If the request doesn't include any ignored params, match as normal.
        if (request.url === strippedRequestURL) {
            return cache.match(request, matchOptions);
        }
        // Otherwise, match by comparing keys
        const keysOptions = Object.assign(Object.assign({}, matchOptions), { ignoreSearch: true });
        const cacheKeys = await cache.keys(request, keysOptions);
        for (const cacheKey of cacheKeys) {
            const strippedCacheKeyURL = stripParams(cacheKey.url, ignoreParams);
            if (strippedRequestURL === strippedCacheKeyURL) {
                return cache.match(cacheKey, matchOptions);
            }
        }
        return;
    }

    /*
      Copyright 2018 Google LLC

      Use of this source code is governed by an MIT-style
      license that can be found in the LICENSE file or at
      https://opensource.org/licenses/MIT.
    */
    /**
     * The Deferred class composes Promises in a way that allows for them to be
     * resolved or rejected from outside the constructor. In most cases promises
     * should be used directly, but Deferreds can be necessary when the logic to
     * resolve a promise must be separate.
     *
     * @private
     */
    class Deferred {
        /**
         * Creates a promise and exposes its resolve and reject functions as methods.
         */
        constructor() {
            this.promise = new Promise((resolve, reject) => {
                this.resolve = resolve;
                this.reject = reject;
            });
        }
    }

    /*
      Copyright 2018 Google LLC

      Use of this source code is governed by an MIT-style
      license that can be found in the LICENSE file or at
      https://opensource.org/licenses/MIT.
    */
    // Callbacks to be executed whenever there's a quota error.
    // Can't change Function type right now.
    // eslint-disable-next-line @typescript-eslint/ban-types
    const quotaErrorCallbacks = new Set();

    /*
      Copyright 2018 Google LLC

      Use of this source code is governed by an MIT-style
      license that can be found in the LICENSE file or at
      https://opensource.org/licenses/MIT.
    */
    /**
     * Runs all of the callback functions, one at a time sequentially, in the order
     * in which they were registered.
     *
     * @memberof workbox-core
     * @private
     */
    async function executeQuotaErrorCallbacks() {
        for (const callback of quotaErrorCallbacks) {
            await callback();
        }
    }

    /*
      Copyright 2019 Google LLC
      Use of this source code is governed by an MIT-style
      license that can be found in the LICENSE file or at
      https://opensource.org/licenses/MIT.
    */
    /**
     * Returns a promise that resolves and the passed number of milliseconds.
     * This utility is an async/await-friendly version of `setTimeout`.
     *
     * @param {number} ms
     * @return {Promise}
     * @private
     */
    function timeout(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // @ts-ignore
    try {
        self['workbox:strategies:6.5.2'] && _();
    }
    catch (e) { }

    /*
      Copyright 2020 Google LLC

      Use of this source code is governed by an MIT-style
      license that can be found in the LICENSE file or at
      https://opensource.org/licenses/MIT.
    */
    function toRequest(input) {
        return typeof input === 'string' ? new Request(input) : input;
    }
    /**
     * A class created every time a Strategy instance instance calls
     * {@link workbox-strategies.Strategy~handle} or
     * {@link workbox-strategies.Strategy~handleAll} that wraps all fetch and
     * cache actions around plugin callbacks and keeps track of when the strategy
     * is "done" (i.e. all added `event.waitUntil()` promises have resolved).
     *
     * @memberof workbox-strategies
     */
    class StrategyHandler {
        /**
         * Creates a new instance associated with the passed strategy and event
         * that's handling the request.
         *
         * The constructor also initializes the state that will be passed to each of
         * the plugins handling this request.
         *
         * @param {workbox-strategies.Strategy} strategy
         * @param {Object} options
         * @param {Request|string} options.request A request to run this strategy for.
         * @param {ExtendableEvent} options.event The event associated with the
         *     request.
         * @param {URL} [options.url]
         * @param {*} [options.params] The return value from the
         *     {@link workbox-routing~matchCallback} (if applicable).
         */
        constructor(strategy, options) {
            this._cacheKeys = {};
            Object.assign(this, options);
            this.event = options.event;
            this._strategy = strategy;
            this._handlerDeferred = new Deferred();
            this._extendLifetimePromises = [];
            // Copy the plugins list (since it's mutable on the strategy),
            // so any mutations don't affect this handler instance.
            this._plugins = [...strategy.plugins];
            this._pluginStateMap = new Map();
            for (const plugin of this._plugins) {
                this._pluginStateMap.set(plugin, {});
            }
            this.event.waitUntil(this._handlerDeferred.promise);
        }
        /**
         * Fetches a given request (and invokes any applicable plugin callback
         * methods) using the `fetchOptions` (for non-navigation requests) and
         * `plugins` defined on the `Strategy` object.
         *
         * The following plugin lifecycle methods are invoked when using this method:
         * - `requestWillFetch()`
         * - `fetchDidSucceed()`
         * - `fetchDidFail()`
         *
         * @param {Request|string} input The URL or request to fetch.
         * @return {Promise<Response>}
         */
        async fetch(input) {
            const { event } = this;
            let request = toRequest(input);
            if (request.mode === 'navigate' &&
                event instanceof FetchEvent &&
                event.preloadResponse) {
                const possiblePreloadResponse = (await event.preloadResponse);
                if (possiblePreloadResponse) {
                    return possiblePreloadResponse;
                }
            }
            // If there is a fetchDidFail plugin, we need to save a clone of the
            // original request before it's either modified by a requestWillFetch
            // plugin or before the original request's body is consumed via fetch().
            const originalRequest = this.hasCallback('fetchDidFail')
                ? request.clone()
                : null;
            try {
                for (const cb of this.iterateCallbacks('requestWillFetch')) {
                    request = await cb({ request: request.clone(), event });
                }
            }
            catch (err) {
                if (err instanceof Error) {
                    throw new WorkboxError('plugin-error-request-will-fetch', {
                        thrownErrorMessage: err.message,
                    });
                }
            }
            // The request can be altered by plugins with `requestWillFetch` making
            // the original request (most likely from a `fetch` event) different
            // from the Request we make. Pass both to `fetchDidFail` to aid debugging.
            const pluginFilteredRequest = request.clone();
            try {
                let fetchResponse;
                // See https://github.com/GoogleChrome/workbox/issues/1796
                fetchResponse = await fetch(request, request.mode === 'navigate' ? undefined : this._strategy.fetchOptions);
                if ("production" !== 'production') ;
                for (const callback of this.iterateCallbacks('fetchDidSucceed')) {
                    fetchResponse = await callback({
                        event,
                        request: pluginFilteredRequest,
                        response: fetchResponse,
                    });
                }
                return fetchResponse;
            }
            catch (error) {
                // `originalRequest` will only exist if a `fetchDidFail` callback
                // is being used (see above).
                if (originalRequest) {
                    await this.runCallbacks('fetchDidFail', {
                        error: error,
                        event,
                        originalRequest: originalRequest.clone(),
                        request: pluginFilteredRequest.clone(),
                    });
                }
                throw error;
            }
        }
        /**
         * Calls `this.fetch()` and (in the background) runs `this.cachePut()` on
         * the response generated by `this.fetch()`.
         *
         * The call to `this.cachePut()` automatically invokes `this.waitUntil()`,
         * so you do not have to manually call `waitUntil()` on the event.
         *
         * @param {Request|string} input The request or URL to fetch and cache.
         * @return {Promise<Response>}
         */
        async fetchAndCachePut(input) {
            const response = await this.fetch(input);
            const responseClone = response.clone();
            void this.waitUntil(this.cachePut(input, responseClone));
            return response;
        }
        /**
         * Matches a request from the cache (and invokes any applicable plugin
         * callback methods) using the `cacheName`, `matchOptions`, and `plugins`
         * defined on the strategy object.
         *
         * The following plugin lifecycle methods are invoked when using this method:
         * - cacheKeyWillByUsed()
         * - cachedResponseWillByUsed()
         *
         * @param {Request|string} key The Request or URL to use as the cache key.
         * @return {Promise<Response|undefined>} A matching response, if found.
         */
        async cacheMatch(key) {
            const request = toRequest(key);
            let cachedResponse;
            const { cacheName, matchOptions } = this._strategy;
            const effectiveRequest = await this.getCacheKey(request, 'read');
            const multiMatchOptions = Object.assign(Object.assign({}, matchOptions), { cacheName });
            cachedResponse = await caches.match(effectiveRequest, multiMatchOptions);
            for (const callback of this.iterateCallbacks('cachedResponseWillBeUsed')) {
                cachedResponse =
                    (await callback({
                        cacheName,
                        matchOptions,
                        cachedResponse,
                        request: effectiveRequest,
                        event: this.event,
                    })) || undefined;
            }
            return cachedResponse;
        }
        /**
         * Puts a request/response pair in the cache (and invokes any applicable
         * plugin callback methods) using the `cacheName` and `plugins` defined on
         * the strategy object.
         *
         * The following plugin lifecycle methods are invoked when using this method:
         * - cacheKeyWillByUsed()
         * - cacheWillUpdate()
         * - cacheDidUpdate()
         *
         * @param {Request|string} key The request or URL to use as the cache key.
         * @param {Response} response The response to cache.
         * @return {Promise<boolean>} `false` if a cacheWillUpdate caused the response
         * not be cached, and `true` otherwise.
         */
        async cachePut(key, response) {
            const request = toRequest(key);
            // Run in the next task to avoid blocking other cache reads.
            // https://github.com/w3c/ServiceWorker/issues/1397
            await timeout(0);
            const effectiveRequest = await this.getCacheKey(request, 'write');
            if (!response) {
                throw new WorkboxError('cache-put-with-no-response', {
                    url: getFriendlyURL(effectiveRequest.url),
                });
            }
            const responseToCache = await this._ensureResponseSafeToCache(response);
            if (!responseToCache) {
                return false;
            }
            const { cacheName, matchOptions } = this._strategy;
            const cache = await self.caches.open(cacheName);
            const hasCacheUpdateCallback = this.hasCallback('cacheDidUpdate');
            const oldResponse = hasCacheUpdateCallback
                ? await cacheMatchIgnoreParams(
                // TODO(philipwalton): the `__WB_REVISION__` param is a precaching
                // feature. Consider into ways to only add this behavior if using
                // precaching.
                cache, effectiveRequest.clone(), ['__WB_REVISION__'], matchOptions)
                : null;
            try {
                await cache.put(effectiveRequest, hasCacheUpdateCallback ? responseToCache.clone() : responseToCache);
            }
            catch (error) {
                if (error instanceof Error) {
                    // See https://developer.mozilla.org/en-US/docs/Web/API/DOMException#exception-QuotaExceededError
                    if (error.name === 'QuotaExceededError') {
                        await executeQuotaErrorCallbacks();
                    }
                    throw error;
                }
            }
            for (const callback of this.iterateCallbacks('cacheDidUpdate')) {
                await callback({
                    cacheName,
                    oldResponse,
                    newResponse: responseToCache.clone(),
                    request: effectiveRequest,
                    event: this.event,
                });
            }
            return true;
        }
        /**
         * Checks the list of plugins for the `cacheKeyWillBeUsed` callback, and
         * executes any of those callbacks found in sequence. The final `Request`
         * object returned by the last plugin is treated as the cache key for cache
         * reads and/or writes. If no `cacheKeyWillBeUsed` plugin callbacks have
         * been registered, the passed request is returned unmodified
         *
         * @param {Request} request
         * @param {string} mode
         * @return {Promise<Request>}
         */
        async getCacheKey(request, mode) {
            const key = `${request.url} | ${mode}`;
            if (!this._cacheKeys[key]) {
                let effectiveRequest = request;
                for (const callback of this.iterateCallbacks('cacheKeyWillBeUsed')) {
                    effectiveRequest = toRequest(await callback({
                        mode,
                        request: effectiveRequest,
                        event: this.event,
                        // params has a type any can't change right now.
                        params: this.params, // eslint-disable-line
                    }));
                }
                this._cacheKeys[key] = effectiveRequest;
            }
            return this._cacheKeys[key];
        }
        /**
         * Returns true if the strategy has at least one plugin with the given
         * callback.
         *
         * @param {string} name The name of the callback to check for.
         * @return {boolean}
         */
        hasCallback(name) {
            for (const plugin of this._strategy.plugins) {
                if (name in plugin) {
                    return true;
                }
            }
            return false;
        }
        /**
         * Runs all plugin callbacks matching the given name, in order, passing the
         * given param object (merged ith the current plugin state) as the only
         * argument.
         *
         * Note: since this method runs all plugins, it's not suitable for cases
         * where the return value of a callback needs to be applied prior to calling
         * the next callback. See
         * {@link workbox-strategies.StrategyHandler#iterateCallbacks}
         * below for how to handle that case.
         *
         * @param {string} name The name of the callback to run within each plugin.
         * @param {Object} param The object to pass as the first (and only) param
         *     when executing each callback. This object will be merged with the
         *     current plugin state prior to callback execution.
         */
        async runCallbacks(name, param) {
            for (const callback of this.iterateCallbacks(name)) {
                // TODO(philipwalton): not sure why `any` is needed. It seems like
                // this should work with `as WorkboxPluginCallbackParam[C]`.
                await callback(param);
            }
        }
        /**
         * Accepts a callback and returns an iterable of matching plugin callbacks,
         * where each callback is wrapped with the current handler state (i.e. when
         * you call each callback, whatever object parameter you pass it will
         * be merged with the plugin's current state).
         *
         * @param {string} name The name fo the callback to run
         * @return {Array<Function>}
         */
        *iterateCallbacks(name) {
            for (const plugin of this._strategy.plugins) {
                if (typeof plugin[name] === 'function') {
                    const state = this._pluginStateMap.get(plugin);
                    const statefulCallback = (param) => {
                        const statefulParam = Object.assign(Object.assign({}, param), { state });
                        // TODO(philipwalton): not sure why `any` is needed. It seems like
                        // this should work with `as WorkboxPluginCallbackParam[C]`.
                        return plugin[name](statefulParam);
                    };
                    yield statefulCallback;
                }
            }
        }
        /**
         * Adds a promise to the
         * [extend lifetime promises]{@link https://w3c.github.io/ServiceWorker/#extendableevent-extend-lifetime-promises}
         * of the event event associated with the request being handled (usually a
         * `FetchEvent`).
         *
         * Note: you can await
         * {@link workbox-strategies.StrategyHandler~doneWaiting}
         * to know when all added promises have settled.
         *
         * @param {Promise} promise A promise to add to the extend lifetime promises
         *     of the event that triggered the request.
         */
        waitUntil(promise) {
            this._extendLifetimePromises.push(promise);
            return promise;
        }
        /**
         * Returns a promise that resolves once all promises passed to
         * {@link workbox-strategies.StrategyHandler~waitUntil}
         * have settled.
         *
         * Note: any work done after `doneWaiting()` settles should be manually
         * passed to an event's `waitUntil()` method (not this handler's
         * `waitUntil()` method), otherwise the service worker thread my be killed
         * prior to your work completing.
         */
        async doneWaiting() {
            let promise;
            while ((promise = this._extendLifetimePromises.shift())) {
                await promise;
            }
        }
        /**
         * Stops running the strategy and immediately resolves any pending
         * `waitUntil()` promises.
         */
        destroy() {
            this._handlerDeferred.resolve(null);
        }
        /**
         * This method will call cacheWillUpdate on the available plugins (or use
         * status === 200) to determine if the Response is safe and valid to cache.
         *
         * @param {Request} options.request
         * @param {Response} options.response
         * @return {Promise<Response|undefined>}
         *
         * @private
         */
        async _ensureResponseSafeToCache(response) {
            let responseToCache = response;
            let pluginsUsed = false;
            for (const callback of this.iterateCallbacks('cacheWillUpdate')) {
                responseToCache =
                    (await callback({
                        request: this.request,
                        response: responseToCache,
                        event: this.event,
                    })) || undefined;
                pluginsUsed = true;
                if (!responseToCache) {
                    break;
                }
            }
            if (!pluginsUsed) {
                if (responseToCache && responseToCache.status !== 200) {
                    responseToCache = undefined;
                }
            }
            return responseToCache;
        }
    }

    /*
      Copyright 2020 Google LLC

      Use of this source code is governed by an MIT-style
      license that can be found in the LICENSE file or at
      https://opensource.org/licenses/MIT.
    */
    /**
     * An abstract base class that all other strategy classes must extend from:
     *
     * @memberof workbox-strategies
     */
    class Strategy {
        /**
         * Creates a new instance of the strategy and sets all documented option
         * properties as public instance properties.
         *
         * Note: if a custom strategy class extends the base Strategy class and does
         * not need more than these properties, it does not need to define its own
         * constructor.
         *
         * @param {Object} [options]
         * @param {string} [options.cacheName] Cache name to store and retrieve
         * requests. Defaults to the cache names provided by
         * {@link workbox-core.cacheNames}.
         * @param {Array<Object>} [options.plugins] [Plugins]{@link https://developers.google.com/web/tools/workbox/guides/using-plugins}
         * to use in conjunction with this caching strategy.
         * @param {Object} [options.fetchOptions] Values passed along to the
         * [`init`](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch#Parameters)
         * of [non-navigation](https://github.com/GoogleChrome/workbox/issues/1796)
         * `fetch()` requests made by this strategy.
         * @param {Object} [options.matchOptions] The
         * [`CacheQueryOptions`]{@link https://w3c.github.io/ServiceWorker/#dictdef-cachequeryoptions}
         * for any `cache.match()` or `cache.put()` calls made by this strategy.
         */
        constructor(options = {}) {
            /**
             * Cache name to store and retrieve
             * requests. Defaults to the cache names provided by
             * {@link workbox-core.cacheNames}.
             *
             * @type {string}
             */
            this.cacheName = cacheNames.getRuntimeName(options.cacheName);
            /**
             * The list
             * [Plugins]{@link https://developers.google.com/web/tools/workbox/guides/using-plugins}
             * used by this strategy.
             *
             * @type {Array<Object>}
             */
            this.plugins = options.plugins || [];
            /**
             * Values passed along to the
             * [`init`]{@link https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch#Parameters}
             * of all fetch() requests made by this strategy.
             *
             * @type {Object}
             */
            this.fetchOptions = options.fetchOptions;
            /**
             * The
             * [`CacheQueryOptions`]{@link https://w3c.github.io/ServiceWorker/#dictdef-cachequeryoptions}
             * for any `cache.match()` or `cache.put()` calls made by this strategy.
             *
             * @type {Object}
             */
            this.matchOptions = options.matchOptions;
        }
        /**
         * Perform a request strategy and returns a `Promise` that will resolve with
         * a `Response`, invoking all relevant plugin callbacks.
         *
         * When a strategy instance is registered with a Workbox
         * {@link workbox-routing.Route}, this method is automatically
         * called when the route matches.
         *
         * Alternatively, this method can be used in a standalone `FetchEvent`
         * listener by passing it to `event.respondWith()`.
         *
         * @param {FetchEvent|Object} options A `FetchEvent` or an object with the
         *     properties listed below.
         * @param {Request|string} options.request A request to run this strategy for.
         * @param {ExtendableEvent} options.event The event associated with the
         *     request.
         * @param {URL} [options.url]
         * @param {*} [options.params]
         */
        handle(options) {
            const [responseDone] = this.handleAll(options);
            return responseDone;
        }
        /**
         * Similar to {@link workbox-strategies.Strategy~handle}, but
         * instead of just returning a `Promise` that resolves to a `Response` it
         * it will return an tuple of `[response, done]` promises, where the former
         * (`response`) is equivalent to what `handle()` returns, and the latter is a
         * Promise that will resolve once any promises that were added to
         * `event.waitUntil()` as part of performing the strategy have completed.
         *
         * You can await the `done` promise to ensure any extra work performed by
         * the strategy (usually caching responses) completes successfully.
         *
         * @param {FetchEvent|Object} options A `FetchEvent` or an object with the
         *     properties listed below.
         * @param {Request|string} options.request A request to run this strategy for.
         * @param {ExtendableEvent} options.event The event associated with the
         *     request.
         * @param {URL} [options.url]
         * @param {*} [options.params]
         * @return {Array<Promise>} A tuple of [response, done]
         *     promises that can be used to determine when the response resolves as
         *     well as when the handler has completed all its work.
         */
        handleAll(options) {
            // Allow for flexible options to be passed.
            if (options instanceof FetchEvent) {
                options = {
                    event: options,
                    request: options.request,
                };
            }
            const event = options.event;
            const request = typeof options.request === 'string'
                ? new Request(options.request)
                : options.request;
            const params = 'params' in options ? options.params : undefined;
            const handler = new StrategyHandler(this, { event, request, params });
            const responseDone = this._getResponse(handler, request, event);
            const handlerDone = this._awaitComplete(responseDone, handler, request, event);
            // Return an array of promises, suitable for use with Promise.all().
            return [responseDone, handlerDone];
        }
        async _getResponse(handler, request, event) {
            await handler.runCallbacks('handlerWillStart', { event, request });
            let response = undefined;
            try {
                response = await this._handle(request, handler);
                // The "official" Strategy subclasses all throw this error automatically,
                // but in case a third-party Strategy doesn't, ensure that we have a
                // consistent failure when there's no response or an error response.
                if (!response || response.type === 'error') {
                    throw new WorkboxError('no-response', { url: request.url });
                }
            }
            catch (error) {
                if (error instanceof Error) {
                    for (const callback of handler.iterateCallbacks('handlerDidError')) {
                        response = await callback({ error, event, request });
                        if (response) {
                            break;
                        }
                    }
                }
                if (!response) {
                    throw error;
                }
            }
            for (const callback of handler.iterateCallbacks('handlerWillRespond')) {
                response = await callback({ event, request, response });
            }
            return response;
        }
        async _awaitComplete(responseDone, handler, request, event) {
            let response;
            let error;
            try {
                response = await responseDone;
            }
            catch (error) {
                // Ignore errors, as response errors should be caught via the `response`
                // promise above. The `done` promise will only throw for errors in
                // promises passed to `handler.waitUntil()`.
            }
            try {
                await handler.runCallbacks('handlerDidRespond', {
                    event,
                    request,
                    response,
                });
                await handler.doneWaiting();
            }
            catch (waitUntilError) {
                if (waitUntilError instanceof Error) {
                    error = waitUntilError;
                }
            }
            await handler.runCallbacks('handlerDidComplete', {
                event,
                request,
                response,
                error: error,
            });
            handler.destroy();
            if (error) {
                throw error;
            }
        }
    }
    /**
     * Classes extending the `Strategy` based class should implement this method,
     * and leverage the {@link workbox-strategies.StrategyHandler}
     * arg to perform all fetching and cache logic, which will ensure all relevant
     * cache, cache options, fetch options and plugins are used (per the current
     * strategy instance).
     *
     * @name _handle
     * @instance
     * @abstract
     * @function
     * @param {Request} request
     * @param {workbox-strategies.StrategyHandler} handler
     * @return {Promise<Response>}
     *
     * @memberof workbox-strategies.Strategy
     */

    /*
      Copyright 2018 Google LLC

      Use of this source code is governed by an MIT-style
      license that can be found in the LICENSE file or at
      https://opensource.org/licenses/MIT.
    */
    const cacheOkAndOpaquePlugin = {
        /**
         * Returns a valid response (to allow caching) if the status is 200 (OK) or
         * 0 (opaque).
         *
         * @param {Object} options
         * @param {Response} options.response
         * @return {Response|null}
         *
         * @private
         */
        cacheWillUpdate: async ({ response }) => {
            if (response.status === 200 || response.status === 0) {
                return response;
            }
            return null;
        },
    };

    /*
      Copyright 2018 Google LLC

      Use of this source code is governed by an MIT-style
      license that can be found in the LICENSE file or at
      https://opensource.org/licenses/MIT.
    */
    /**
     * An implementation of a
     * [stale-while-revalidate](https://developer.chrome.com/docs/workbox/reference/workbox-strategies/#type-StaleWhileRevalidate)
     * request strategy.
     *
     * Resources are requested from both the cache and the network in parallel.
     * The strategy will respond with the cached version if available, otherwise
     * wait for the network response. The cache is updated with the network response
     * with each successful request.
     *
     * By default, this strategy will cache responses with a 200 status code as
     * well as [opaque responses](https://developer.chrome.com/docs/workbox/caching-resources-during-runtime/#opaque-responses).
     * Opaque responses are cross-origin requests where the response doesn't
     * support [CORS](https://enable-cors.org/).
     *
     * If the network request fails, and there is no cache match, this will throw
     * a `WorkboxError` exception.
     *
     * @extends workbox-strategies.Strategy
     * @memberof workbox-strategies
     */
    class StaleWhileRevalidate extends Strategy {
        /**
         * @param {Object} [options]
         * @param {string} [options.cacheName] Cache name to store and retrieve
         * requests. Defaults to cache names provided by
         * {@link workbox-core.cacheNames}.
         * @param {Array<Object>} [options.plugins] [Plugins]{@link https://developers.google.com/web/tools/workbox/guides/using-plugins}
         * to use in conjunction with this caching strategy.
         * @param {Object} [options.fetchOptions] Values passed along to the
         * [`init`](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch#Parameters)
         * of [non-navigation](https://github.com/GoogleChrome/workbox/issues/1796)
         * `fetch()` requests made by this strategy.
         * @param {Object} [options.matchOptions] [`CacheQueryOptions`](https://w3c.github.io/ServiceWorker/#dictdef-cachequeryoptions)
         */
        constructor(options = {}) {
            super(options);
            // If this instance contains no plugins with a 'cacheWillUpdate' callback,
            // prepend the `cacheOkAndOpaquePlugin` plugin to the plugins list.
            if (!this.plugins.some((p) => 'cacheWillUpdate' in p)) {
                this.plugins.unshift(cacheOkAndOpaquePlugin);
            }
        }
        /**
         * @private
         * @param {Request|string} request A request to run this strategy for.
         * @param {workbox-strategies.StrategyHandler} handler The event that
         *     triggered the request.
         * @return {Promise<Response>}
         */
        async _handle(request, handler) {
            const fetchAndCachePromise = handler.fetchAndCachePut(request).catch(() => {
                // Swallow this error because a 'no-response' error will be thrown in
                // main handler return flow. This will be in the `waitUntil()` flow.
            });
            void handler.waitUntil(fetchAndCachePromise);
            let response = await handler.cacheMatch(request);
            let error;
            if (response) ;
            else {
                try {
                    // NOTE(philipwalton): Really annoying that we have to type cast here.
                    // https://github.com/microsoft/TypeScript/issues/20006
                    response = (await fetchAndCachePromise);
                }
                catch (err) {
                    if (err instanceof Error) {
                        error = err;
                    }
                }
            }
            if (!response) {
                throw new WorkboxError('no-response', { url: request.url, error });
            }
            return response;
        }
    }

    // @ts-ignore
    try {
        self['workbox:routing:6.5.2'] && _();
    }
    catch (e) { }

    /*
      Copyright 2018 Google LLC

      Use of this source code is governed by an MIT-style
      license that can be found in the LICENSE file or at
      https://opensource.org/licenses/MIT.
    */
    /**
     * The default HTTP method, 'GET', used when there's no specific method
     * configured for a route.
     *
     * @type {string}
     *
     * @private
     */
    const defaultMethod = 'GET';

    /*
      Copyright 2018 Google LLC

      Use of this source code is governed by an MIT-style
      license that can be found in the LICENSE file or at
      https://opensource.org/licenses/MIT.
    */
    /**
     * @param {function()|Object} handler Either a function, or an object with a
     * 'handle' method.
     * @return {Object} An object with a handle method.
     *
     * @private
     */
    const normalizeHandler = (handler) => {
        if (handler && typeof handler === 'object') {
            return handler;
        }
        else {
            return { handle: handler };
        }
    };

    /*
      Copyright 2018 Google LLC

      Use of this source code is governed by an MIT-style
      license that can be found in the LICENSE file or at
      https://opensource.org/licenses/MIT.
    */
    /**
     * A `Route` consists of a pair of callback functions, "match" and "handler".
     * The "match" callback determine if a route should be used to "handle" a
     * request by returning a non-falsy value if it can. The "handler" callback
     * is called when there is a match and should return a Promise that resolves
     * to a `Response`.
     *
     * @memberof workbox-routing
     */
    class Route {
        /**
         * Constructor for Route class.
         *
         * @param {workbox-routing~matchCallback} match
         * A callback function that determines whether the route matches a given
         * `fetch` event by returning a non-falsy value.
         * @param {workbox-routing~handlerCallback} handler A callback
         * function that returns a Promise resolving to a Response.
         * @param {string} [method='GET'] The HTTP method to match the Route
         * against.
         */
        constructor(match, handler, method = defaultMethod) {
            // These values are referenced directly by Router so cannot be
            // altered by minificaton.
            this.handler = normalizeHandler(handler);
            this.match = match;
            this.method = method;
        }
        /**
         *
         * @param {workbox-routing-handlerCallback} handler A callback
         * function that returns a Promise resolving to a Response
         */
        setCatchHandler(handler) {
            this.catchHandler = normalizeHandler(handler);
        }
    }

    /*
      Copyright 2018 Google LLC

      Use of this source code is governed by an MIT-style
      license that can be found in the LICENSE file or at
      https://opensource.org/licenses/MIT.
    */
    /**
     * RegExpRoute makes it easy to create a regular expression based
     * {@link workbox-routing.Route}.
     *
     * For same-origin requests the RegExp only needs to match part of the URL. For
     * requests against third-party servers, you must define a RegExp that matches
     * the start of the URL.
     *
     * @memberof workbox-routing
     * @extends workbox-routing.Route
     */
    class RegExpRoute extends Route {
        /**
         * If the regular expression contains
         * [capture groups]{@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp#grouping-back-references},
         * the captured values will be passed to the
         * {@link workbox-routing~handlerCallback} `params`
         * argument.
         *
         * @param {RegExp} regExp The regular expression to match against URLs.
         * @param {workbox-routing~handlerCallback} handler A callback
         * function that returns a Promise resulting in a Response.
         * @param {string} [method='GET'] The HTTP method to match the Route
         * against.
         */
        constructor(regExp, handler, method) {
            const match = ({ url }) => {
                const result = regExp.exec(url.href);
                // Return immediately if there's no match.
                if (!result) {
                    return;
                }
                // Require that the match start at the first character in the URL string
                // if it's a cross-origin request.
                // See https://github.com/GoogleChrome/workbox/issues/281 for the context
                // behind this behavior.
                if (url.origin !== location.origin && result.index !== 0) {
                    return;
                }
                // If the route matches, but there aren't any capture groups defined, then
                // this will return [], which is truthy and therefore sufficient to
                // indicate a match.
                // If there are capture groups, then it will return their values.
                return result.slice(1);
            };
            super(match, handler, method);
        }
    }

    /*
      Copyright 2018 Google LLC

      Use of this source code is governed by an MIT-style
      license that can be found in the LICENSE file or at
      https://opensource.org/licenses/MIT.
    */
    /**
     * The Router can be used to process a `FetchEvent` using one or more
     * {@link workbox-routing.Route}, responding with a `Response` if
     * a matching route exists.
     *
     * If no route matches a given a request, the Router will use a "default"
     * handler if one is defined.
     *
     * Should the matching Route throw an error, the Router will use a "catch"
     * handler if one is defined to gracefully deal with issues and respond with a
     * Request.
     *
     * If a request matches multiple routes, the **earliest** registered route will
     * be used to respond to the request.
     *
     * @memberof workbox-routing
     */
    class Router {
        /**
         * Initializes a new Router.
         */
        constructor() {
            this._routes = new Map();
            this._defaultHandlerMap = new Map();
        }
        /**
         * @return {Map<string, Array<workbox-routing.Route>>} routes A `Map` of HTTP
         * method name ('GET', etc.) to an array of all the corresponding `Route`
         * instances that are registered.
         */
        get routes() {
            return this._routes;
        }
        /**
         * Adds a fetch event listener to respond to events when a route matches
         * the event's request.
         */
        addFetchListener() {
            // See https://github.com/Microsoft/TypeScript/issues/28357#issuecomment-436484705
            self.addEventListener('fetch', ((event) => {
                const { request } = event;
                const responsePromise = this.handleRequest({ request, event });
                if (responsePromise) {
                    event.respondWith(responsePromise);
                }
            }));
        }
        /**
         * Adds a message event listener for URLs to cache from the window.
         * This is useful to cache resources loaded on the page prior to when the
         * service worker started controlling it.
         *
         * The format of the message data sent from the window should be as follows.
         * Where the `urlsToCache` array may consist of URL strings or an array of
         * URL string + `requestInit` object (the same as you'd pass to `fetch()`).
         *
         * ```
         * {
         *   type: 'CACHE_URLS',
         *   payload: {
         *     urlsToCache: [
         *       './script1.js',
         *       './script2.js',
         *       ['./script3.js', {mode: 'no-cors'}],
         *     ],
         *   },
         * }
         * ```
         */
        addCacheListener() {
            // See https://github.com/Microsoft/TypeScript/issues/28357#issuecomment-436484705
            self.addEventListener('message', ((event) => {
                // event.data is type 'any'
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                if (event.data && event.data.type === 'CACHE_URLS') {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    const { payload } = event.data;
                    const requestPromises = Promise.all(payload.urlsToCache.map((entry) => {
                        if (typeof entry === 'string') {
                            entry = [entry];
                        }
                        const request = new Request(...entry);
                        return this.handleRequest({ request, event });
                        // TODO(philipwalton): TypeScript errors without this typecast for
                        // some reason (probably a bug). The real type here should work but
                        // doesn't: `Array<Promise<Response> | undefined>`.
                    })); // TypeScript
                    event.waitUntil(requestPromises);
                    // If a MessageChannel was used, reply to the message on success.
                    if (event.ports && event.ports[0]) {
                        void requestPromises.then(() => event.ports[0].postMessage(true));
                    }
                }
            }));
        }
        /**
         * Apply the routing rules to a FetchEvent object to get a Response from an
         * appropriate Route's handler.
         *
         * @param {Object} options
         * @param {Request} options.request The request to handle.
         * @param {ExtendableEvent} options.event The event that triggered the
         *     request.
         * @return {Promise<Response>|undefined} A promise is returned if a
         *     registered route can handle the request. If there is no matching
         *     route and there's no `defaultHandler`, `undefined` is returned.
         */
        handleRequest({ request, event, }) {
            const url = new URL(request.url, location.href);
            if (!url.protocol.startsWith('http')) {
                return;
            }
            const sameOrigin = url.origin === location.origin;
            const { params, route } = this.findMatchingRoute({
                event,
                request,
                sameOrigin,
                url,
            });
            let handler = route && route.handler;
            // If we don't have a handler because there was no matching route, then
            // fall back to defaultHandler if that's defined.
            const method = request.method;
            if (!handler && this._defaultHandlerMap.has(method)) {
                handler = this._defaultHandlerMap.get(method);
            }
            if (!handler) {
                return;
            }
            // Wrap in try and catch in case the handle method throws a synchronous
            // error. It should still callback to the catch handler.
            let responsePromise;
            try {
                responsePromise = handler.handle({ url, request, event, params });
            }
            catch (err) {
                responsePromise = Promise.reject(err);
            }
            // Get route's catch handler, if it exists
            const catchHandler = route && route.catchHandler;
            if (responsePromise instanceof Promise &&
                (this._catchHandler || catchHandler)) {
                responsePromise = responsePromise.catch(async (err) => {
                    // If there's a route catch handler, process that first
                    if (catchHandler) {
                        try {
                            return await catchHandler.handle({ url, request, event, params });
                        }
                        catch (catchErr) {
                            if (catchErr instanceof Error) {
                                err = catchErr;
                            }
                        }
                    }
                    if (this._catchHandler) {
                        return this._catchHandler.handle({ url, request, event });
                    }
                    throw err;
                });
            }
            return responsePromise;
        }
        /**
         * Checks a request and URL (and optionally an event) against the list of
         * registered routes, and if there's a match, returns the corresponding
         * route along with any params generated by the match.
         *
         * @param {Object} options
         * @param {URL} options.url
         * @param {boolean} options.sameOrigin The result of comparing `url.origin`
         *     against the current origin.
         * @param {Request} options.request The request to match.
         * @param {Event} options.event The corresponding event.
         * @return {Object} An object with `route` and `params` properties.
         *     They are populated if a matching route was found or `undefined`
         *     otherwise.
         */
        findMatchingRoute({ url, sameOrigin, request, event, }) {
            const routes = this._routes.get(request.method) || [];
            for (const route of routes) {
                let params;
                // route.match returns type any, not possible to change right now.
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const matchResult = route.match({ url, sameOrigin, request, event });
                if (matchResult) {
                    // See https://github.com/GoogleChrome/workbox/issues/2079
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    params = matchResult;
                    if (Array.isArray(params) && params.length === 0) {
                        // Instead of passing an empty array in as params, use undefined.
                        params = undefined;
                    }
                    else if (matchResult.constructor === Object && // eslint-disable-line
                        Object.keys(matchResult).length === 0) {
                        // Instead of passing an empty object in as params, use undefined.
                        params = undefined;
                    }
                    else if (typeof matchResult === 'boolean') {
                        // For the boolean value true (rather than just something truth-y),
                        // don't set params.
                        // See https://github.com/GoogleChrome/workbox/pull/2134#issuecomment-513924353
                        params = undefined;
                    }
                    // Return early if have a match.
                    return { route, params };
                }
            }
            // If no match was found above, return and empty object.
            return {};
        }
        /**
         * Define a default `handler` that's called when no routes explicitly
         * match the incoming request.
         *
         * Each HTTP method ('GET', 'POST', etc.) gets its own default handler.
         *
         * Without a default handler, unmatched requests will go against the
         * network as if there were no service worker present.
         *
         * @param {workbox-routing~handlerCallback} handler A callback
         * function that returns a Promise resulting in a Response.
         * @param {string} [method='GET'] The HTTP method to associate with this
         * default handler. Each method has its own default.
         */
        setDefaultHandler(handler, method = defaultMethod) {
            this._defaultHandlerMap.set(method, normalizeHandler(handler));
        }
        /**
         * If a Route throws an error while handling a request, this `handler`
         * will be called and given a chance to provide a response.
         *
         * @param {workbox-routing~handlerCallback} handler A callback
         * function that returns a Promise resulting in a Response.
         */
        setCatchHandler(handler) {
            this._catchHandler = normalizeHandler(handler);
        }
        /**
         * Registers a route with the router.
         *
         * @param {workbox-routing.Route} route The route to register.
         */
        registerRoute(route) {
            if (!this._routes.has(route.method)) {
                this._routes.set(route.method, []);
            }
            // Give precedence to all of the earlier routes by adding this additional
            // route to the end of the array.
            this._routes.get(route.method).push(route);
        }
        /**
         * Unregisters a route with the router.
         *
         * @param {workbox-routing.Route} route The route to unregister.
         */
        unregisterRoute(route) {
            if (!this._routes.has(route.method)) {
                throw new WorkboxError('unregister-route-but-not-found-with-method', {
                    method: route.method,
                });
            }
            const routeIndex = this._routes.get(route.method).indexOf(route);
            if (routeIndex > -1) {
                this._routes.get(route.method).splice(routeIndex, 1);
            }
            else {
                throw new WorkboxError('unregister-route-route-not-registered');
            }
        }
    }

    /*
      Copyright 2019 Google LLC

      Use of this source code is governed by an MIT-style
      license that can be found in the LICENSE file or at
      https://opensource.org/licenses/MIT.
    */
    let defaultRouter;
    /**
     * Creates a new, singleton Router instance if one does not exist. If one
     * does already exist, that instance is returned.
     *
     * @private
     * @return {Router}
     */
    const getOrCreateDefaultRouter = () => {
        if (!defaultRouter) {
            defaultRouter = new Router();
            // The helpers that use the default Router assume these listeners exist.
            defaultRouter.addFetchListener();
            defaultRouter.addCacheListener();
        }
        return defaultRouter;
    };

    /*
      Copyright 2019 Google LLC

      Use of this source code is governed by an MIT-style
      license that can be found in the LICENSE file or at
      https://opensource.org/licenses/MIT.
    */
    /**
     * Easily register a RegExp, string, or function with a caching
     * strategy to a singleton Router instance.
     *
     * This method will generate a Route for you if needed and
     * call {@link workbox-routing.Router#registerRoute}.
     *
     * @param {RegExp|string|workbox-routing.Route~matchCallback|workbox-routing.Route} capture
     * If the capture param is a `Route`, all other arguments will be ignored.
     * @param {workbox-routing~handlerCallback} [handler] A callback
     * function that returns a Promise resulting in a Response. This parameter
     * is required if `capture` is not a `Route` object.
     * @param {string} [method='GET'] The HTTP method to match the Route
     * against.
     * @return {workbox-routing.Route} The generated `Route`.
     *
     * @memberof workbox-routing
     */
    function registerRoute(capture, handler, method) {
        let route;
        if (typeof capture === 'string') {
            const captureUrl = new URL(capture, location.href);
            const matchCallback = ({ url }) => {
                return url.href === captureUrl.href;
            };
            // If `capture` is a string then `handler` and `method` must be present.
            route = new Route(matchCallback, handler, method);
        }
        else if (capture instanceof RegExp) {
            // If `capture` is a `RegExp` then `handler` and `method` must be present.
            route = new RegExpRoute(capture, handler, method);
        }
        else if (typeof capture === 'function') {
            // If `capture` is a function then `handler` and `method` must be present.
            route = new Route(capture, handler, method);
        }
        else if (capture instanceof Route) {
            route = capture;
        }
        else {
            throw new WorkboxError('unsupported-route-type', {
                moduleName: 'workbox-routing',
                funcName: 'registerRoute',
                paramName: 'capture',
            });
        }
        const defaultRouter = getOrCreateDefaultRouter();
        defaultRouter.registerRoute(route);
        return route;
    }

    const route = new Route(
      ({sameOrigin}) => {
        return sameOrigin;
      },
      new StaleWhileRevalidate({ cacheName: 'site'}));

    registerRoute(route);

})();
//# sourceMappingURL=sw.js.map
