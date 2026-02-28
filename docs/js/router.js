/**
 * Lightweight hash-based SPA router.
 * Usage:
 *   route('#/', homeHandler);
 *   route('#/character/:name', songListHandler);
 *   start();
 */

const routes = [];

export function route(pattern, handler) {
  // Convert pattern like '#/character/:name/song/:songId' to regex
  const paramNames = [];
  const regexStr = pattern
    .replace(/:([^/]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    })
    .replace(/\//g, '\\/');
  routes.push({ regex: new RegExp(`^${regexStr}$`), paramNames, handler });
}

export function navigate(path) {
  window.location.hash = path;
}

export function start() {
  window.addEventListener('hashchange', resolve);
  resolve();
}

function resolve() {
  const hash = window.location.hash || '#/';
  for (const r of routes) {
    const match = hash.match(r.regex);
    if (match) {
      const params = {};
      r.paramNames.forEach((name, i) => {
        params[name] = decodeURIComponent(match[i + 1]);
      });
      r.handler(params);
      return;
    }
  }
  // Fallback to home
  if (hash !== '#/') {
    navigate('#/');
  }
}
