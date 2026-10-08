"""A force-directed view of a beads graph with its human gates picked out, for the beads post.

    python3 scripts/beads-force.py <issues.jsonl> <name> > src/data/beads-force-<name>.json

The same questions beads_viewer (bv) answers with its graph view and robot insights, computed here so the
blog can draw them: which beads only the owner can close (design and taste reviews, couch playtests, release
calls), how much open work waits on each of them, what the remaining critical path is and how many of its
links are the owner. Like beads-graph.py it publishes structure only: agent beads carry no titles, and a
human gate carries a short generic name of what it asks of the owner.
"""
import collections, json, re, sys
import numpy as np

path, name = sys.argv[1], sys.argv[2]
rows = [json.loads(l) for l in open(path) if l.strip()]
idx = {r['id']: i for i, r in enumerate(rows)}
N = len(rows)
blocks = sorted({(idx[d['depends_on_id']], i) for i, r in enumerate(rows) for d in r.get('dependencies') or []
                 if d.get('type') == 'blocks' and d.get('depends_on_id') in idx and idx[d['depends_on_id']] != i})
succ, pred = collections.defaultdict(list), collections.defaultdict(list)
for a, b in blocks: succ[a].append(b); pred[b].append(a)
status = [{'completed': 'closed'}.get(r.get('status'), r.get('status')) for r in rows]
done = lambda i: status[i] == 'closed'
live = lambda i: status[i] not in ('closed', 'deferred')

# ---- human gates: beads only the owner can close ----
GATE = re.compile(r'\(owner(\)|,| release)|owner design review|owner-blocking|couch verdict|owner selects|owner real-phone|'
                  r"owner's android|human playtest", re.I)
def kind(t):
    t = t.lower()
    if re.search(r'playtest|couch|phone|hardware|android', t): return 'playtest'
    if re.search(r'promot|release|qualification|public|selects', t): return 'release'
    return 'review'
def short(t):
    t = re.sub(r'^[\w.\-/]+\s*[·—-]\s*', '', t)          # plan id prefix
    t = re.sub(r'^(C|E|P)\d+\w*\s+', '', t)             # Physical Soccer cut ids
    t = re.sub(r'\s*\*?\(owner[^)]*\)\*?', '', t)
    t = re.split(r'\s*[(:,]', t)[0].strip()
    return t[:44]
human = [bool(GATE.search(r['title']) or {'owner-gate', 'feedback-owner'} & set(r.get('labels') or [])) for r in rows]

# ---- downstream: everything a bead transitively blocks ----
down = []
for i in range(N):
    seen, st = set(), list(succ[i])
    while st:
        j = st.pop()
        if j in seen: continue
        seen.add(j); st.extend(succ[j])
    down.append(seen)
open_down = [sorted(j for j in down[i] if live(j)) for i in range(N)]

# ---- remaining critical path: the longest chain of beads still to close ----
memo = {}
def longest(i, stack=()):
    if i in memo: return memo[i]
    if i in stack: return [i]
    best = []
    for j in succ[i]:
        if live(j):
            c = longest(j, stack + (i,))
            if len(c) > len(best): best = c
    memo[i] = [i] + best
    return memo[i]
crit = max((longest(i) for i in range(N) if live(i) and not any(live(p) for p in pred[i])), key=len, default=[])

# ---- PageRank on the "is needed by" direction, as bv's insights do: a bead matters if important work waits on it ----
pr = np.full(N, 1 / N)
outdeg = np.array([len(pred[i]) for i in range(N)])
for _ in range(60):
    nxt = np.full(N, 0.15 / N)
    for a, b in blocks: nxt[a] += 0.85 * pr[b] / outdeg[b]
    nxt += 0.85 * pr[outdeg == 0].sum() / N
    pr = nxt

# ---- force-directed layout (Fruchterman-Reingold, seeded so rebuilds do not move it) ----
# Only linked beads take part; unlinked ones sit in a row along the bottom, so they cannot squeeze the network.
linked = sorted({a for a, _ in blocks} | {b for _, b in blocks})
loose = [i for i in range(N) if i not in set(linked)]
P = np.zeros((N, 2))
if linked:
    at = {n: k for k, n in enumerate(linked)}
    M = len(linked)
    rng = np.random.default_rng(7)
    Q = rng.random((M, 2))
    E = np.array([(at[a], at[b]) for a, b in blocks])
    k = np.sqrt(1 / M)
    temp = 0.1
    for it in range(900):
        d = Q[:, None, :] - Q[None, :, :]
        dist2 = np.maximum((d ** 2).sum(2), 1e-6)
        disp = (d * (k * k / dist2)[:, :, None]).sum(1)
        de = Q[E[:, 0]] - Q[E[:, 1]]
        le = np.maximum(np.linalg.norm(de, axis=1), 1e-3)
        f = de * (le / k)[:, None]
        np.add.at(disp, E[:, 0], -f); np.add.at(disp, E[:, 1], f)
        disp += (Q.mean(0) - Q) * 0.08 / k               # gravity: disconnected islands stay near the main body
        ln = np.maximum(np.linalg.norm(disp, axis=1), 1e-9)
        Q += disp / ln[:, None] * np.minimum(ln, temp)[:, None]
        temp = max(0.001, temp * 0.994)
    lo, hi = Q.min(0), Q.max(0)
    Q = (Q - lo) / np.maximum(hi - lo, 1e-9)
    Q = Q * [1, 0.9 if loose else 1]                    # leave a band at the bottom for the unlinked beads
    for n, k_ in at.items(): P[n] = Q[k_]
for k_, n in enumerate(loose):
    P[n] = [(k_ + 0.5) / len(loose), 1.0]

gates = sorted((i for i in range(N) if human[i]), key=lambda i: -len(open_down[i]))
waiting = sorted({j for i in gates if live(i) for j in open_down[i]})
behind = sorted({j for i in gates for j in down[i]})  # every bead that had to wait for the owner at some point
n_live = sum(1 for i in range(N) if live(i))
out = {
    'name': name,
    'beads': N,
    'open': n_live,
    'gates': len(gates),
    'gates_open': sum(1 for i in gates if live(i)),
    'waiting_on_owner': len(waiting),
    'behind_owner': len(behind),
    'behind_owner_closed': sum(1 for j in behind if done(j)),
    'crit': len(crit),
    'crit_owner': sum(1 for i in crit if human[i]),
    'nodes': [{'x': round(float(P[i, 0]), 4), 'y': round(float(P[i, 1]), 4), 's': status[i], 'h': kind(rows[i]['title']) if human[i] else 0,
               'd': len(open_down[i]), 'c': int(i in crit), 'pr': round(float(pr[i] * N), 3)} for i in range(N)],
    'edges': blocks,
    'gate_list': [{'i': i, 'name': short(rows[i]['title']), 'kind': kind(rows[i]['title']), 's': status[i], 'open_down': len(open_down[i]),
                   'all_down': len(down[i]), 'down': sorted(down[i])} for i in gates],
    'top_pr': [{'i': int(i), 'owner': human[i], 'pr': round(float(pr[i] * N), 2), 'open_down': len(open_down[i])} for i in np.argsort(-pr)[:10]],
}
json.dump(out, sys.stdout, separators=(',', ':'))
