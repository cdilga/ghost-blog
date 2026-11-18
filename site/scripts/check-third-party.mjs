// Build check: the site serves its own assets. Fails the build when a page would load a script, stylesheet, font or
// live iframe from another host, and warns about images and video still hotlinked from elsewhere (the "Localise
// images" workflow fixes those). Plain links to other sites are fine; so are embeds waiting behind a click
// (scripts/embed-gate.mjs keeps them in a <template>). Runs from the astro:build:done hook.
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const OWN = /^https?:\/\/(chris(-preview)?\.dilger\.me|localhost)(:\d+)?\//;
// scripts a page adds itself only after the reader clicks to load an embed (src/components/Tweet.astro)
const ON_CLICK = ['https://platform.twitter.com/widgets.js'];
const external = (u) => /^(https?:)?\/\//.test(u) && !OWN.test(u.startsWith('//') ? 'https:' + u : u);

export async function checkThirdParty(root, log = console) {
  const files = [];
  const walk = async (d) => { for (const e of await readdir(d, { withFileTypes: true })) { const f = join(d, e.name); if (e.isDirectory()) await walk(f); else if (/\.(html|css|js|mjs)$/.test(e.name)) files.push(f); } };
  await walk(root);
  const errors = [], warnings = [];
  for (const f of files) {
    const rel = relative(root, f);
    let text = await readFile(f, 'utf8');
    text = text.replace(/<template\b[\s\S]*?<\/template>/gi, ''); // gated embeds
    const hit = (list, what, u) => list.push(`${rel}: ${what} ${u.slice(0, 100)}`);
    for (const m of text.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/gi)) if (external(m[1])) hit(errors, 'script', m[1]);
    for (const m of text.matchAll(/<link\b[^>]*>/gi)) {
      const rel_ = m[0].match(/\brel="([^"]+)"/i)?.[1] || '', href = m[0].match(/\bhref="([^"]+)"/i)?.[1] || '';
      if (/stylesheet|preload|modulepreload|preconnect|dns-prefetch|icon|manifest/i.test(rel_) && external(href)) hit(errors, rel_, href);
    }
    for (const m of text.matchAll(/<iframe\b[^>]*\bsrc="([^"]+)"/gi)) if (external(m[1])) hit(errors, 'iframe', m[1]);
    for (const m of text.matchAll(/@import\s+(?:url\()?["']?([^"')\s]+)/gi)) if (external(m[1])) hit(errors, '@import', m[1]);
    for (const m of text.matchAll(/url\(\s*["']?(https?:[^"')]+)/gi)) if (external(m[1])) hit(errors, 'css url()', m[1]);
    // scripts that add other scripts or stylesheets at run time
    for (const m of text.matchAll(/\.src\s*=\s*['"`](https?:\/\/[^'"`]+)/g)) if (external(m[1]) && !ON_CLICK.includes(m[1])) hit(errors, 'runtime load', m[1]);
    for (const m of text.matchAll(/<(img|video|source|audio)\b[^>]*\b(?:src|poster)="([^"]+)"/gi)) if (external(m[2])) hit(warnings, m[1], m[2]);
  }
  for (const w of new Set(warnings)) log.warn(`third-party media (run the Localise images workflow): ${w}`);
  if (errors.length) throw new Error(`pages load third-party code or styles; self-host them instead:\n  ${[...new Set(errors)].join('\n  ')}`);
  log.info(`third-party check: no external scripts, styles, fonts or live embeds${warnings.length ? `; ${new Set(warnings).size} hotlinked media` : ''}`);
}
