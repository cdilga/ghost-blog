"""Beads created, closed and open over time, for the line charts in the beads post.

    python3 scripts/beads-flow.py <issues.jsonl> <step_hours> [<key> <src/data/beads-flow.json>]

Prints {created, closed, open, step_h}: running totals sampled every step_hours from the first bead. With a key and a
file it updates that key in the file instead. Like beads-graph.py, it keeps no titles or ids.
"""
import datetime as dt, json, math, sys

path, step = sys.argv[1], float(sys.argv[2])
rows = [json.loads(l) for l in open(path) if l.strip()]
P = lambda s: dt.datetime.fromisoformat(s.replace('Z', '+00:00'))
created = sorted(P(r['created_at']) for r in rows)
closed = sorted(P(r['closed_at']) for r in rows if r.get('closed_at'))
t0, t1 = created[0], max(created + closed)
out = {'created': [], 'closed': [], 'open': [], 'step_h': step}
for k in range(math.ceil((t1 - t0).total_seconds() / 3600 / step) + 1):
    t = t0 + dt.timedelta(hours=k * step)
    c = sum(1 for x in created if x <= t); d = sum(1 for x in closed if x <= t)
    for key, v in (('created', c), ('closed', d), ('open', c - d)): out[key].append([round(k * step, 1), v])
if len(sys.argv) > 4:
    key, file = sys.argv[3], sys.argv[4]
    data = json.load(open(file)); data[key] = out
    json.dump(data, open(file, 'w'), separators=(',', ':'))
else:
    json.dump(out, sys.stdout, separators=(',', ':'))
