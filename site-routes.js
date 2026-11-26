(function (root) {
  'use strict';

  const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const reserved = new Set(['api', 'apps', 'blog', 'home', 'index', 'media', 'robots', 'sitemap']);

  function validSlug(value) {
    return typeof value === 'string' && value.length <= 80 && slugPattern.test(value);
  }

  function appSlug(app) {
    return validSlug(app.urlSlug) ? app.urlSlug : app.slug;
  }

  function appAliases(app) {
    return [...new Set([app.slug, ...(Array.isArray(app.urlAliases) ? app.urlAliases : [])].filter(validSlug))];
  }

  function resolveApp(apps, slug) {
    return apps.find(app => appSlug(app) === slug) || apps.find(app => appAliases(app).includes(slug));
  }

  function pageSlug(settings, page) {
    const route = settings?.pageRoutes?.[page.kind + ':' + page.slug];
    return validSlug(route?.slug) ? route.slug : page.slug;
  }

  function resolvePage(settings, kind, slug) {
    const entries = Object.entries(settings?.pageRoutes || {}).filter(([key]) => key.startsWith(kind + ':'));
    const match = entries.find(([, route]) => route?.slug === slug) ||
      entries.find(([, route]) => Array.isArray(route?.aliases) && route.aliases.includes(slug));
    return match ? match[0].slice(kind.length + 1) : slug;
  }

  function nextAliases(current, next, previous = []) {
    return [...new Set([...(Array.isArray(previous) ? previous : []), current].filter(validSlug))].filter(slug => slug !== next);
  }

  const routes = { validSlug, reserved, appSlug, appAliases, resolveApp, pageSlug, resolvePage, nextAliases };
  if (typeof module === 'object' && module.exports) module.exports = routes;
  else root.siteRoutes = routes;
})(globalThis);
