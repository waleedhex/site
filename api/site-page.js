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

const contentToken = /\[([^\[\]\n]+)\]\(([^\s()]+)\)|\*\*([^\n]+?)\*\*|\[color=(red|blue|green|purple)\]([^\n]+?)\[\/color\]/g;

function safeLink(value) {
  try {
    if (!/^(https?:\/\/[^\s]+|\/(?![\/\\])[^\s]*)$/i.test(value)) return '';
    const url = new URL(value, origin);
    if (!['https:', 'http:'].includes(url.protocol)) return '';
    return value.startsWith('/') && url.origin !== origin ? '' : url.href;
  } catch {
    return '';
  }
}

function inlineContent(text, plain = false, depth = 0) {
  if (depth >= 8) return plain ? text : escape(text);
  let output = '';
  let offset = 0;
  for (const token of text.matchAll(contentToken)) {
    const before = text.slice(offset, token.index);
    output += plain ? before : escape(before);
    const [source, label, destination, bold, color, colored] = token;
    if (label) {
      const href = safeLink(destination);
      output += plain ? label : href ? `<a href="${escape(href)}">${escape(label)}</a>` : escape(source);
    } else {
      const inner = inlineContent(bold ?? colored, plain, depth + 1);
      output += plain ? inner : bold ? `<strong>${inner}</strong>` : `<span class="text-${color}">${inner}</span>`;
    }
    offset = token.index + source.length;
  }
  const remainder = text.slice(offset);
  return output + (plain ? remainder : escape(remainder));
}

function articleBody(body) {
  const blocks = [];
  let paragraph = [];
  const flush = () => {
    if (paragraph.length) blocks.push(`<p>${paragraph.map(line => inlineContent(line)).join('\n')}</p>`);
    paragraph = [];
  };
  for (const line of body.split(/\r?\n/)) {
    const heading = /^(#{2,3}) +(.+)$/.exec(line);
    if (heading) {
      flush();
      const level = heading[1].length;
      blocks.push(`<h${level}>${inlineContent(heading[2])}</h${level}>`);
    } else if (line.trim()) paragraph.push(line);
    else flush();
  }
  flush();
  return blocks.join('');
}

function layout({ title, description = '', path, image = '', indexable = true, body, nav = [] }) {
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
  body{margin:0;background:#faf8fa;color:#262129;font:1rem/1.8 system-ui,sans-serif}
  header,main,footer{max-width:48rem;margin:auto;padding:1.25rem}
  header{border-bottom:1px solid #e0d9e0} footer{border-top:1px solid #e0d9e0}
  header a{font-weight:700} a{color:#694066;text-underline-offset:.18em}
  h1{line-height:1.25;overflow-wrap:anywhere} article{min-height:40vh}
  article h2,article h3{line-height:1.4;overflow-wrap:anywhere}
  .text-red{color:#a72032}.text-blue{color:#1e51a4}.text-green{color:#18623b}.text-purple{color:#6d3990}
  article p{white-space:pre-wrap;overflow-wrap:anywhere} nav{display:flex;gap:1rem;flex-wrap:wrap}
</style></head><body><header><a href="/">${siteName}</a></header>
<main>${body}</main><footer><nav aria-label="روابط الموقع"><a href="/">الرئيسية</a><a href="/blog">المدونة</a>
${nav.map(page => `<a href="${pagePath(page)}">${escape(page.title)}</a>`).join('')}
</nav></footer></body></html>`;
}

async function readPages(filters) {
  const query = new URLSearchParams(filters);
  const response = await fetch(`${supabase}/rest/v1/site_pages_published?${query}`, {
    headers: { apikey: key },
    signal: AbortSignal.timeout(6000)
  });
  if (!response.ok) throw new Error('Public pages request failed');
  return response.json();
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
  const notFound = () => html(404, {
    title: 'الصفحة غير موجودة', indexable: false,
    body: '<h1>الصفحة غير موجودة</h1><p><a href="/">العودة للرئيسية</a></p>'
  });

  try {
    if (route === 'robots') {
      return send(res, 200, 'text/plain', `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
    }
    if (route === 'sitemap') {
      const pages = await readPages({ select: 'slug,kind,updated_at', indexable: 'eq.true' });
      const entries = [{ path: '/' }, { path: '/blog' },
        ...pages.map(page => ({ path: pagePath(page), updated: page.updated_at }))];
      const urls = entries.map(({ path, updated }) => `<url><loc>${escape(origin + path)}</loc>${updated ? `<lastmod>${escape(updated)}</lastmod>` : ''}</url>`).join('');
      return send(res, 200, 'application/xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
    }

    const footer = () => readPages({ select: 'slug,kind,title', footer: 'eq.true', order: 'title.asc' }).catch(() => []);
    if (route === 'blog') {
      const [posts, nav] = await Promise.all([
        readPages({ select: 'slug,kind,title,description', kind: 'eq.post', order: 'updated_at.desc' }),
        footer()
      ]);
      const list = posts.map(post => `<li><a href="${pagePath(post)}">${escape(post.title)}</a>${post.description ? `<p>${escape(post.description)}</p>` : ''}</li>`).join('');
      return html(200, { title: 'المدونة | ' + siteName, description: 'مقالات واجهة التطبيقات',
        path: '/blog', nav, body: '<h1>المدونة</h1>' + (list ? '<ul>' + list + '</ul>' : '<p>لا توجد مقالات منشورة بعد.</p>') });
    }
    if (!['page', 'post'].includes(route) || typeof slug !== 'string' || slug.length > 80 || !slugPattern.test(slug)) return notFound();

    const [[page], nav] = await Promise.all([
      readPages({ select: '*', slug: 'eq.' + slug, kind: 'eq.' + route, limit: '1' }), footer()
    ]);
    if (!page) return notFound();
    const paragraphs = articleBody(page.body);
    return html(200, {
      title: page.seo_title || page.title + ' | ' + siteName,
      description: page.description || inlineContent(page.body.replace(/^#{2,3} +/gm, ''), true).replace(/\s+/g, ' ').trim().slice(0, 160),
      path: pagePath(page), image: page.image, indexable: page.indexable, nav,
      body: `<article><h1>${escape(page.title)}</h1>${paragraphs}</article>`
    });
  } catch {
    return html(503, { title: 'الصفحة غير متاحة مؤقتًا', indexable: false,
      body: '<h1>الصفحة غير متاحة مؤقتًا</h1><p>حاول فتح الصفحة مرة أخرى بعد قليل.</p>' });
  }
};
