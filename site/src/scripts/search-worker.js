// Semantic half of site search, off the main thread.
// Loads the same embedding model the build used (Snowflake arctic-embed-xs, int8, ~23 MB) from this site,
// with the plain 14 MB ONNX WASM runtime (no CDN, no third parties), embeds the query, and scores every passage
// against the prebuilt int8 vectors. The browser keeps both in Cache Storage after the first visit.
// Messages: {type:'init', vectors, dims, model, base} -> progress/ready; {type:'query', id, q} -> {id, hits}.
import { pipeline, env } from '@huggingface/transformers';
let embed = null, vecs = null, scales = null, dims = 384, n = 0;
const QUERY_PREFIX = 'Represent this sentence for searching relevant passages: ';

async function load(model, base, local) {
  env.allowLocalModels = local; env.allowRemoteModels = !local;
  env.localModelPath = `${base}/models/`;
  env.backends.onnx.wasm.wasmPaths = { mjs: `${base}/ort/ort-wasm-simd-threaded.mjs`, wasm: `${base}/ort/ort-wasm-simd-threaded.wasm` };
  env.backends.onnx.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
  const files = new Map();
  return pipeline('feature-extraction', model, {
    dtype: 'q8',
    device: 'wasm',
    progress_callback: (p) => {
      if (p.status === 'progress' && p.total) {
        files.set(p.file, [p.loaded, p.total]);
        let a = 0, b = 0; for (const [l, t] of files.values()) { a += l; b += t; }
        postMessage({ type: 'progress', pct: Math.round((a / b) * 100) });
      }
    },
  });
}

async function init({ vectors, model, dims: d, base = '' }) {
  dims = d;
  n = vectors.byteLength / (dims + 4);
  vecs = new Int8Array(vectors, 0, n * dims);
  scales = new Float32Array(vectors.slice(n * dims));
  // the site's own copy first; if a build could not ship it, fall back to the Hugging Face hub
  try { embed = await load(model, base, true); } catch { embed = await load(model, base, false); }
  await embed('warm up', { pooling: 'cls', normalize: true });
  postMessage({ type: 'ready' });
}

// while typing, only the newest query matters: drop any that were overtaken, and remember recent answers
const memo = new Map();
let busy = false, next = null;
async function drain() {
  if (busy) return; busy = true;
  while (next) { const job = next; next = null; await query(job); }
  busy = false;
}
async function query({ id, q }) {
  if (memo.has(q)) { postMessage({ type: 'hits', id, hits: memo.get(q) }); return; }
  const v = (await embed(QUERY_PREFIX + q, { pooling: 'cls', normalize: true })).data;
  const scores = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const s = scales[i]; if (!s) { scores[i] = -1; continue; }
    let dot = 0; const o = i * dims;
    for (let j = 0; j < dims; j++) dot += vecs[o + j] * v[j];
    scores[i] = dot * s;
  }
  const idx = Array.from(scores.keys()).sort((a, b) => scores[b] - scores[a]).slice(0, 60);
  const hits = idx.map((i) => [i, scores[i]]);
  memo.set(q, hits); if (memo.size > 200) memo.delete(memo.keys().next().value);
  postMessage({ type: 'hits', id, hits });
}

onmessage = async (e) => {
  try {
    if (e.data.type === 'init') await init(e.data);
    else if (e.data.type === 'query' && embed) { next = e.data; await drain(); }
  } catch (err) { postMessage({ type: 'error', message: String(err?.message || err) }); }
};
