// Recorded fallback for the live airflow figures. Some browsers cannot run the solver at a watchable speed or at all:
// Firefox with its JavaScript JIT switched off (a common privacy-hardening setting) runs it at about 0.1x real time,
// an extension can block web workers, and a slow phone can stall. Rather than a frozen or blank plan, the figure then
// plays a short seamless loop of the settled flow recorded from the real simulation (scripts/record-sims.mjs), with
// the room read-outs from the same run, and offers to run it live anyway.
//
// Videos live in /video/sims/<name>-<preset>-<slot>.{webm,mp4,jpg}; the read-outs in /video/sims/<name>.json.
// Nothing is fetched until a recording is actually shown. Append ?simrec to a page to force the recordings.

const BASE = '/video/sims';

export const forceRecording = () => /[?&]simrec\b/.test(location.search);

/**
 * @param {object} o
 * @param {HTMLElement} o.fig        the figure
 * @param {string} o.name            recording name (hair | h3d)
 * @param {{slot: string, canvas: HTMLCanvasElement}[]} o.slots  canvases a recording stands in for
 * @param {string[]} o.presets       presets that have recordings
 * @param {HTMLElement} o.note       the figure's note line
 * @param {(fill: object) => void} o.fill   puts a preset's recorded read-outs into the figure
 * @param {() => void} o.onLive      called when the reader asks for the live simulation
 */
export function createRecording({ fig, name, slots, presets, note, fill, onLive }) {
  let active = false, preset = '', data = null, loading = null, why = '';
  const vids = slots.map(({ slot, canvas }) => {
    const v = document.createElement('video');
    v.className = 'sim-rec';
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
    v.hidden = true;
    canvas.after(v);
    return { slot, canvas, v };
  });
  const badge = document.createElement('span');
  badge.className = 'sim-rec-badge mono';
  badge.textContent = 'recording';
  badge.hidden = true;
  slots[0].canvas.parentElement.append(badge);

  const readouts = () => (loading ||= fetch(`${BASE}/${name}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((d) => (data = d)));

  function load(p) {
    preset = p;
    const has = presets.includes(p);
    for (const { slot, v } of vids) {
      if (!has) continue; // keep the last recording on screen
      const stem = `${BASE}/${name}-${p}-${slot}`;
      v.poster = `${stem}.jpg`;
      v.innerHTML = `<source src="${stem}.webm" type="video/webm"><source src="${stem}.mp4" type="video/mp4">`;
      v.load();
      v.play().catch(() => { /* autoplay refused: the poster still shows the settled flow */ });
    }
    if (has) readouts().then(() => { if (active && preset === p && data?.[p]) fill(data[p]); });
    message(has ? '' : 'There is no recording of your own fan layout: run the simulation live to see it.');
  }

  function message(extra) {
    note.hidden = false;
    note.textContent = `Showing a recording of the simulation: ${why}. `;
    if (extra) note.append(`${extra} `);
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'sim-rec-live'; b.textContent = 'Run it live anyway';
    b.addEventListener('click', () => { hide(); note.hidden = true; onLive(); });
    note.append(b);
  }

  function show(p, reason) {
    why = reason;
    active = true;
    fig.classList.add('is-rec');
    badge.hidden = false;
    for (const { canvas, v } of vids) { canvas.hidden = true; v.hidden = false; }
    load(p);
  }

  function hide() {
    active = false;
    fig.classList.remove('is-rec');
    badge.hidden = true;
    for (const { canvas, v } of vids) { v.pause(); v.hidden = true; canvas.hidden = false; }
  }

  return {
    get active() { return active; },
    show,
    hide,
    preset: (p) => { if (active) load(p); },
    // pause off screen, like the live figure
    visible: (on) => { if (!active) return; for (const { v } of vids) { if (on) v.play().catch(() => {}); else v.pause(); } },
  };
}
