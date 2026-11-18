// Rehype plugin: third-party embeds (YouTube, Google Maps and Drive, 360 photos...) load nothing until the reader asks.
// Each <iframe> pointing at another host becomes a small card naming the host, with "Load" (swaps in the original
// iframe, kept in a <template>) and "Open on <host>" links. Posts keep their markup; this runs at build time.
// The click handler lives in src/layouts/Base.astro ([data-embed-gate]).
const LABELS = [
  [/(^|\.)youtube(-nocookie)?\.com$/, 'video', 'YouTube'],
  [/^(www\.)?google\.com$/, 'map', 'Google Maps'],
  [/^(drive|docs)\.google\.com$/, 'document', 'Google Drive'],
  [/(^|\.)momento360\.com$/, '360° photo', 'Momento360'],
  [/(^|\.)easyzoom\.com$/, 'zoomable photo', 'EasyZoom'],
];

const unescape = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// a link a person can open in a new tab (embed URLs are often not one)
function openUrl(u) {
  const h = u.hostname;
  if (/youtube/.test(h)) { const id = u.pathname.match(/\/embed\/([^/?]+)/)?.[1]; if (id) return `https://www.youtube.com/watch?v=${id}`; }
  if (/^(www\.)?google\.com$/.test(h) && u.pathname.startsWith('/maps/embed')) {
    const q = u.searchParams.get('q') || '';
    const place = q.match(/^place_id:(.+)$/)?.[1];
    return place ? `https://www.google.com/maps/search/?api=1&query=place&query_place_id=${encodeURIComponent(place)}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  }
  if (/drive\.google\.com$/.test(h) && u.pathname.startsWith('/viewerng/')) return u.searchParams.get('url') || u.href;
  return u.href;
}

function gate(iframeHtml, src, height) {
  let u; try { u = new URL(unescape(src)); } catch { return null; }
  const [, what, where] = LABELS.find(([re]) => re.test(u.hostname)) || [null, 'embed', u.hostname.replace(/^www\./, '')];
  const style = height ? ` style="--h:${parseInt(height, 10)}px"` : '';
  return `<div class="embed-gate" data-embed-gate${style}>`
    + `<p class="embed-gate-what">${esc(what[0].toUpperCase() + what.slice(1))} <span class="mono">from ${esc(where)}</span></p>`
    + `<p class="embed-gate-note">Not loaded until you ask, so nothing reaches ${esc(where)} just by reading.</p>`
    + `<p class="embed-gate-actions"><button type="button" class="embed-gate-load">Load it here</button>`
    + `<a href="${esc(openUrl(u))}" rel="noopener" target="_blank">Open on ${esc(where)} ↗</a></p>`
    + `<template>${iframeHtml}</template></div>`;
}

const IFRAME = /<iframe\b[^>]*\bsrc="(https?:\/\/[^"]+)"[^>]*>\s*<\/iframe>/gi;
const attr = (tag, a) => tag.match(new RegExp(`\\b${a}="([^"]*)"`, 'i'))?.[1];

export function rehypeEmbedGate() {
  const walk = (node) => {
    if (node.type === 'raw' && /<iframe/i.test(node.value)) {
      node.value = node.value.replace(IFRAME, (m, src) => gate(m, src, attr(m, 'height')) ?? m);
    }
    node.children?.forEach(walk);
  };
  return (tree) => walk(tree);
}
