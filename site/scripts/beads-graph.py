"""Summarise a beads database (.beads/issues.jsonl) as an anonymous dependency graph for the blog.

    python3 scripts/beads-graph.py <issues.jsonl> <name> > src/data/beads-<name>.json

Keeps structure only: status, type, dependency layer and edges. No titles, descriptions or ids, so a
private project's plan can be shown without publishing its contents.
"""
import collections, datetime as dt, json, statistics, sys

path, name = sys.argv[1], sys.argv[2]
rows = [json.loads(l) for l in open(path) if l.strip()]
idx = {r['id']: i for i, r in enumerate(rows)}
P = lambda s: dt.datetime.fromisoformat(s.replace('Z', '+00:00'))

blocks = []  # (blocker, blocked)
for i, r in enumerate(rows):
    for d in r.get('dependencies') or []:
        j = idx.get(d.get('depends_on_id'))
        if j is not None and d.get('type') == 'blocks' and j != i:
            blocks.append((j, i))
preds = collections.defaultdict(list)
for a, b in blocks: preds[b].append(a)

# longest-path layering (cycle-safe)
layer, state = {}, {}
def depth(n):
    if n in layer: return layer[n]
    if state.get(n) == 1: return 0
    state[n] = 1
    layer[n] = 0 if not preds[n] else 1 + max(depth(p) for p in preds[n])
    state[n] = 2
    return layer[n]
for n in range(len(rows)): depth(n)

# order within layers by the mean position of predecessors (one barycentre sweep)
by = collections.defaultdict(list)
for n, l in layer.items(): by[l].append(n)
pos = {}
for l in sorted(by):
    ns = by[l]
    ns.sort(key=lambda n: (statistics.mean(pos[p] for p in preds[n]) if preds[n] else 1e9, rows[n].get('issue_type') != 'epic'))
    for k, n in enumerate(ns): pos[n] = k / max(1, len(ns) - 1)

status_map = {'completed': 'closed'}
nodes = [{'l': layer[n], 'p': round(pos[n], 4), 's': status_map.get(rows[n].get('status'), rows[n].get('status')), 't': rows[n].get('issue_type')} for n in range(len(rows))]
hrs = [(P(r['closed_at']) - P(r['created_at'])).total_seconds() / 3600 for r in rows if r.get('closed_at')]
created = [P(r['created_at']) for r in rows]
out = {
    'name': name,
    'beads': len(rows),
    'status': dict(collections.Counter(n['s'] for n in nodes)),
    'types': dict(collections.Counter(n['t'] for n in nodes)),
    'blocks': len(blocks),
    'deps_total': sum(len(r.get('dependencies') or []) for r in rows),
    'layers': max(layer.values()) + 1,
    'blocked_by_something': sum(1 for n in range(len(rows)) if preds[n]),
    'span': [min(created).date().isoformat(), max(created + [P(r['closed_at']) for r in rows if r.get('closed_at')]).date().isoformat()],
    'median_close_h': round(statistics.median(hrs), 1) if hrs else None,
    'creators': len({r.get('created_by') for r in rows}),
    'nodes': nodes,
    'edges': blocks,
}
json.dump(out, sys.stdout, separators=(',', ':'))
