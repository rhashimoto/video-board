import { StaleWhileRevalidate } from 'workbox-strategies';
import { registerRoute, Route } from 'workbox-routing';

const route = new Route(
  ({sameOrigin}) => {
    return sameOrigin;
  },
  new StaleWhileRevalidate({ cacheName: 'site'}));

registerRoute(route);