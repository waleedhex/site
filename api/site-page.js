const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { seoDescription, appDescription } = require('../seo-phrases');
const { render: renderContent } = require('../page-content');
const themeCss = require('../site-theme');
const origin = new URL(process.env.SITE_ORIGIN || 'https://hexgames.vercel.app').origin;
const supabase = process.env.SUPABASE_URL || 'https://poxlnqwjzepnxqpxymto.supabase.co';
const key = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_A-8c5QBeywouKmPGHTJGRQ__ilBGlNf';
const siteName = 'واجهة التطبيقات';
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function escape(value = '') {
  return String(value).replace(/[&<>"']/g, character =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function pagePath(page) {
  return (page.kind === 'post' ? '/blog/' : '/') + encodeURIComponent(page.slug);
}

function imageUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value, origin);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function layout({ title, description = '', path, image = '', indexable = true, body, nav = [], settings = {} }) {
  const canonical = path ? origin + path : '';
  const shareImage = imageUrl(image);
  return `<!doctype html><html lang="ar" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title><meta name="description" content="${escape(description)}">
${indexable ? '' : '<meta name="robots" content="noindex">'}
${canonical ? `<link rel="canonical" href="${escape(canonical)}"><meta property="og:url" content="${escape(canonical)}">` : ''}
<meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}">
${shareImage ? `<meta property="og:image" content="${escape(shareImage)}">` : ''}
<style>
  :root{--bg:#fff;--fg:#14161c;--primary:#21283a;--border:#e2e5eb}
  @media(prefers-color-scheme:dark){:root{--bg:#111522;--fg:#f3f4f6;--primary:#e5e9f3;--border:#393f50;color-scheme:dark}}
  ${themeCss(settings)}
  body{margin:0;background:var(--bg);color:var(--fg);font:1rem/1.8 system-ui,sans-serif}
  header,main,footer{max-width:48rem;margin:auto;padding:1.25rem}
  header,footer{max-width:none;border-color:var(--border);padding-inline:max(1.25rem,calc((100% - 48rem)/2))}
  header{border-bottom:1px solid var(--border);background:var(--header-bg,var(--bg));color:var(--header-fg,var(--fg))}
  footer{border-top:1px solid var(--border);background:var(--footer-bg,var(--bg));color:var(--footer-fg,var(--muted,var(--fg)))}
  header a{font-weight:700} header a,footer a{color:var(--link-color,inherit)} a{color:var(--link-color,var(--primary));text-underline-offset:.18em}
  h1{line-height:1.25;overflow-wrap:anywhere} article{min-height:40vh}
  article h2,article h3{line-height:1.4;overflow-wrap:anywhere}
  article ul,article ol{padding-inline-start:1.6rem}
  article p{white-space:pre-wrap;overflow-wrap:anywhere} nav{display:flex;gap:1rem;flex-wrap:wrap}
</style></head><body><header><a href="/">${siteName}</a></header>
<main>${body}</main><footer><nav aria-label="روابط الموقع"><a href="/">الرئيسية</a><a href="/blog">المدونة</a>
${nav.map(page => `<a href="${pagePath(page)}">${escape(page.title)}</a>`).join('')}
</nav></footer></body></html>`;
}

async function readTable(table, filters) {
  const query = new URLSearchParams(filters);
  const response = await fetch(`${supabase}/rest/v1/${table}?${query}`, {
    headers: { apikey: key },
    signal: AbortSignal.timeout(6000)
  });
  if (!response.ok) throw new Error('Public data request failed');
  return response.json();
}

const readPages = filters => readTable('site_pages_published', filters);
async function readSite() {
  const [row] = await readTable('site_content', { select: 'data', id: 'eq.1' });
  const data = row?.data;
  if (!Array.isArray(data?.a) || !data.s || !data.t) throw new Error('Site content unavailable');
  return data;
}

async function readTheme() {
  try {
    return (await readSite()).s;
  } catch {
    return {};
  }
}

function visibleApps(data) {
  return data.a.filter(app => !app.hd && typeof app.slug === 'string' && slugPattern.test(app.slug));
}

function appPath(app) {
  return '/apps/' + encodeURIComponent(app.slug);
}

function appProse(app, field) {
  const value = app[field + 'Rich'];
  if (typeof value === 'string') return renderContent(value);
  const text = String(app[field] || '');
  if (field === 'feat') {
    const items = text.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
    return items.length ? '<ul>' + items.map(item => `<li>${escape(item)}</li>`).join('') + '</ul>' : '';
  }
  return text.split(/\r?\n\s*\r?\n/).filter(Boolean).map(paragraph => `<p>${escape(paragraph)}</p>`).join('');
}

let template;
async function siteHtml(data, app) {
  template ||= await readFile(path.join(__dirname, '..', 'index.html'), 'utf8');
  const name = String(data.s.name || siteName);
  const title = app ? app.name + ' | ' + name : name;
  const description = app
    ? appDescription(app, renderContent)
    : seoDescription('', visibleApps(data).map(item => item.sub).filter(Boolean).join('\n'));
  const url = origin + (app ? appPath(app) : '/');
  const appList = visibleApps(data).map(item =>
    `<li><a href="${appPath(item)}">${escape(item.name)}</a><p>${escape(item.sub || '')}</p></li>`).join('');
  const header = `<header class="top"><div class="w"><a class="logo" href="/">${escape(name)}</a></div></header>`;
  const overview = app && !app.x3 && !app.h1 ? appProse(app, 'desc') + appProse(app, 'feat') : '';
  const body = app
    ? `<article class="ds"><h1>${escape(app.name)}</h1><p>${escape(app.sub || '')}</p>${overview}</article>`
    : `<h1>${escape(name)}</h1><ul>${appList}</ul><a href="/blog">المدونة</a>`;
  const metadata = `<link rel="canonical" href="${escape(url)}"><meta property="og:url" content="${escape(url)}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}">`;
  const safeData = JSON.stringify({ ...data, a: data.a.filter(item => !item.hd) }).replace(/</g, '\\u003c');
  return template
    .replace(/<title>[^<]*<\/title>/, () => `<title>${escape(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, () => `<meta name="description" content="${escape(description)}">${metadata}`)
    .replace('<div id="app"></div>', () => `<div id="app" data-rendered="true">${header}<main class="w">${body}</main></div>`)
    .replace(/(<script id="data" type="application\/json">)[\s\S]*?(<\/script>)/, (_, open, close) => open + safeData + close)
    .replace(/src="\.\/(site-theme|page-content|seo-phrases)\.js"/g, 'src="/$1.js"')
    .replace('</head>', () => `<style>${themeCss(data.s)}</style></head>`);
}

function send(res, status, type, body) {
  res.setHeader('Content-Type', type + '; charset=utf-8');
  res.setHeader('Cache-Control', status === 200 ? 'public, s-maxage=30' : 'no-store');
  res.status(status).send(body);
}

module.exports = async function handler(req, res) {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.setHeader('Allow', 'GET, HEAD');
    return send(res, 405, 'text/plain', 'Method not allowed');
  }
  const { route, slug } = req.query;
  const html = (status, options) => send(res, status, 'text/html', layout(options));
  const notFound = settings => html(404, {
    title: 'الصفحة غير موجودة', indexable: false, settings,
    body: '<h1>الصفحة غير موجودة</h1><p><a href="/">العودة للرئيسية</a></p>'
  });

  try {
    if (route === 'robots') {
      return send(res, 200, 'text/plain', `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
    }
    if (route === 'sitemap') {
      const [data, pages] = await Promise.all([readSite(), readPages({ select: 'slug,kind,updated_at', indexable: 'eq.true' })]);
      const entries = [{ path: '/' }, { path: '/blog' },
        ...visibleApps(data).map(app => ({ path: appPath(app) })),
        ...pages.map(page => ({ path: pagePath(page), updated: page.updated_at }))];
      const urls = entries.map(({ path, updated }) => `<url><loc>${escape(origin + path)}</loc>${updated ? `<lastmod>${escape(updated)}</lastmod>` : ''}</url>`).join('');
      return send(res, 200, 'application/xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
    }

    if (route === 'home' || route === 'app') {
      const data = await readSite();
      const app = route === 'app' && visibleApps(data).find(item => item.slug === slug);
      if (route === 'app' && !app) return notFound(data.s);
      return send(res, 200, 'text/html', await siteHtml(data, app));
    }

    const footer = () => readPages({ select: 'slug,kind,title', footer: 'eq.true', order: 'title.asc' }).catch(() => []);
    if (route === 'blog') {
      const [posts, nav, settings] = await Promise.all([
        readPages({ select: 'slug,kind,title,description', kind: 'eq.post', order: 'updated_at.desc' }),
        footer(), readTheme()
      ]);
      const list = posts.map(post => `<li><a href="${pagePath(post)}">${escape(post.title)}</a>${post.description ? `<p>${escape(post.description)}</p>` : ''}</li>`).join('');
      return html(200, { title: 'المدونة | ' + siteName, description: 'مقالات واجهة التطبيقات',
        path: '/blog', nav, settings, body: '<h1>المدونة</h1>' + (list ? '<ul>' + list + '</ul>' : '<p>لا توجد مقالات منشورة بعد.</p>') });
    }
    if (!['page', 'post'].includes(route) || typeof slug !== 'string' || slug.length > 80 || !slugPattern.test(slug)) return notFound();

    const [[page], nav, settings] = await Promise.all([
      readPages({ select: '*', slug: 'eq.' + slug, kind: 'eq.' + route, limit: '1' }), footer(), readTheme()
    ]);
    if (!page) return notFound(settings);
    const paragraphs = renderContent(page.body);
    return html(200, {
      title: page.seo_title || page.title + ' | ' + siteName,
      description: page.description || seoDescription('', renderContent(page.body, true)),
      path: pagePath(page), image: page.image, indexable: page.indexable, nav, settings,
      body: `<article><h1>${escape(page.title)}</h1>${paragraphs}</article>`
    });
  } catch {
    return html(503, { title: 'الصفحة غير متاحة مؤقتًا', indexable: false,
      body: '<h1>الصفحة غير متاحة مؤقتًا</h1><p>حاول فتح الصفحة مرة أخرى بعد قليل.</p>' });
  }
};
