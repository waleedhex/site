(function (root) {
  'use strict';

  const prefix = 'rich:v1:';
  const colors = { red: '#a72032', blue: '#1e51a4', green: '#18623b', purple: '#6d3990' };
  const tags = new Set(['b','strong','i','em','u','h2','h3','p','br','ul','ol','li','div','span','a','blockquote','s','sub','sup']);
  const blocks = new Set(['h2','h3','p','br','ul','ol','li','div','blockquote']);

  function escape(value = '') {
    return String(value).replace(/[&<>"']/g, character =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  }

  const contentToken = /\[([^\[\]\n]+)\]\(([^\s()]+)\)|\*\*([^\n]+?)\*\*|\[color=(red|blue|green|purple)\]([^\n]+?)\[\/color\]/g;

  function safeLink(value) {
    try {
      if (!/^(https?:\/\/[^\s]+|\/(?![\/\\])[^\s]*|#[^\s]*)$/i.test(value)) return '';
      const url = new URL(value, 'https://local.invalid');
      if (!['https:', 'http:'].includes(url.protocol)) return '';
      return value.startsWith('/') && url.origin !== 'https://local.invalid' ? '' : value;
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
        output += plain ? inner : bold ? `<strong>${inner}</strong>` : `<span style="color:${colors[color]}">${inner}</span>`;
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

  function safeStyle(value) {
    if (typeof value !== 'string') return '';
    return value.split(';').map(rule => rule.trim()).filter(rule =>
      /^(color|background-color|font-size|text-align|font-weight|font-style|text-decoration(?:-line)?|white-space|list-style-type|margin-inline-start|padding-inline-start)\s*:\s*[#a-z0-9(),.%\s-]+$/i.test(rule) ||
      /^font-family\s*:\s*[\p{L}\d\s,'"-]+$/iu.test(rule)
    ).join(';');
  }

  function clipboardStyle(node) {
    const rules = [node.getAttribute('style') || ''];
    const align = node.getAttribute('align');
    if (/^(left|center|right|justify)$/i.test(align || '')) rules.push('text-align:' + align);
    if (node.localName === 'font') {
      const color = node.getAttribute('color');
      const face = node.getAttribute('face');
      const size = node.getAttribute('size');
      if (color) rules.push('color:' + color);
      if (face) rules.push('font-family:' + face);
      if (/^[1-7]$/.test(size || '')) rules.push('font-size:' + [10,13,16,18,24,32,48][Number(size)-1] + 'px');
    }
    return safeStyle(rules.join(';'));
  }

  function renderNodes(nodes, plain, depth = 0) {
    if (!Array.isArray(nodes) || depth >= 48) return '';
    return nodes.map(node => {
      if (typeof node === 'string') return plain ? node : escape(node);
      if (!Array.isArray(node)) return '';
      const [tag, style, href, children] = node;
      if (!tags.has(tag)) return '';
      const text = renderNodes(children, plain, depth + 1);
      if (plain) return blocks.has(tag) ? text + ' ' : text;
      if (tag === 'br') return '<br>';
      const css = safeStyle(style);
      const link = tag === 'a' && safeLink(typeof href === 'string' ? href : '');
      return `<${tag}${css ? ` style="${escape(css)}"` : ''}${link ? ` href="${escape(link)}"` : ''}>${text}</${tag}>`;
    }).join('');
  }

  function render(body, plain = false) {
    const source = typeof body === 'string' ? body : '';
    if (source.startsWith(prefix)) {
      try {
        const nodes = JSON.parse(source.slice(prefix.length));
        if (Array.isArray(nodes)) return renderNodes(nodes, plain);
      } catch {}
    }
    return plain ? inlineContent(source.replace(/^#{2,3} +/gm, ''), true) : articleBody(source);
  }

  function encode(container) {
    function children(parent, depth = 0) {
      if (depth >= 48) return [];
      return Array.from(parent.childNodes).flatMap(node => {
        if (node.nodeType === 3) return [node.textContent];
        if (node.nodeType !== 1) return [];
        const sourceTag = node.localName;
        if (['script', 'style', 'template', 'iframe', 'object', 'svg', 'math'].includes(sourceTag)) return [];
        const tag = /^h[4-6]$/.test(sourceTag) ? 'h3' :
          ({ h1:'h2', font:'span', center:'div', strike:'s' })[sourceTag] || sourceTag;
        const contents = children(node, depth + 1);
        if (!tags.has(tag)) return contents;
        const style = clipboardStyle(node);
        return [[tag, (sourceTag === 'center' ? 'text-align:center;' : '') + style,
          tag === 'a' ? safeLink(node.getAttribute('href') || '') : '', contents]];
      });
    }
    return prefix + JSON.stringify(children(container));
  }

  const content = { render, encode, safeStyle };
  if (typeof module === 'object' && module.exports) module.exports = content;
  else root.sitePageContent = content;
})(globalThis);
