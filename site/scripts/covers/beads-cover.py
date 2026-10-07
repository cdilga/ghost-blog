# Cover for "Planning with beads": the real Physical Soccer bead graph, drawn like a bead-viewer terminal,
# laid over the game's pitch, with its forklift players and ball. Writes beads-cover.svg (1600x900).
import json, math, random, re, os
H = os.path.dirname(os.path.abspath(__file__))
d = json.load(open(os.path.join(H, '../../src/data/beads-physical-soccer.json')))
nodes, edges = d['nodes'], d['edges']
W, Hh = 1600, 900
X0, X1, Y0, Y1 = 150, 1450, 175, 640
L = max(n['l'] for n in nodes) + 1
random.seed(7)
by = {}
for i, n in enumerate(nodes): by.setdefault(n['l'], []).append(i)
pos = {}
for l, ids in by.items():
    ids.sort(key=lambda i: (nodes[i]['s'], i))
    k = len(ids)
    for j, i in enumerate(ids):
        x = X0 + (X1 - X0) * l / (L - 1)
        y = (Y0 + Y1) / 2 + ((j + 0.5) / k - 0.5) * min(Y1 - Y0, 26 * k)
        pos[i] = (x + random.uniform(-9, 9), y + random.uniform(-4, 4))
col = {'closed': '#17c86c', 'open': '#e5ecee', 'in_progress': '#fcc31a', 'blocked': '#fb4245', 'deferred': '#33475c'}
def inner(f, scale, tx, ty, flip=False):
    s = open(os.path.join(H, f)).read()
    s = re.sub(r'^<svg[^>]*>', '', s.strip()); s = s.replace('</svg>', '')
    s = re.sub(r'id="([^"]+)"', lambda m: f'id="{f[:6]}-{m.group(1)}"', s)
    fl = f' translate(250 0) scale(-1 1)' if flip else ''
    return f'<g transform="translate({tx} {ty}) scale({scale}){fl}">{s}</g>'
out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {Hh}" width="{W}" height="{Hh}">',
 '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b2a1c"/><stop offset="1" stop-color="#0e3b23"/></linearGradient>',
 '<radialGradient id="glow" cx=".5" cy=".45" r=".6"><stop offset="0" stop-color="#17c86c" stop-opacity=".22"/><stop offset="1" stop-color="#17c86c" stop-opacity="0"/></radialGradient>',
 '<pattern id="stripes" width="160" height="900" patternUnits="userSpaceOnUse"><rect width="80" height="900" fill="#ffffff" opacity=".025"/></pattern></defs>',
 f'<rect width="{W}" height="{Hh}" fill="#0e1926"/>',
 # terminal window
 '<rect x="40" y="40" width="1520" height="820" rx="22" fill="url(#g)" stroke="#33475c" stroke-width="3"/>',
 '<rect x="40" y="40" width="1520" height="820" rx="22" fill="url(#stripes)"/>',
 '<rect x="40" y="40" width="1520" height="820" rx="22" fill="url(#glow)"/>',
 '<path d="M40 100 H1560" stroke="#33475c" stroke-width="2"/>',
 '<circle cx="80" cy="70" r="9" fill="#fb4245"/><circle cx="110" cy="70" r="9" fill="#fcc31a"/><circle cx="140" cy="70" r="9" fill="#17c86c"/>',
 '<text x="800" y="79" fill="#9fb3c4" font-family="JetBrains Mono, monospace" font-size="24" text-anchor="middle">bv · physical-soccer · graph</text>',
 # pitch markings
 '<g fill="none" stroke="#ffffff" stroke-opacity=".16" stroke-width="4"><rect x="90" y="130" width="1420" height="560" rx="6"/><path d="M800 130 V690"/><circle cx="800" cy="410" r="110"/><rect x="90" y="300" width="120" height="220"/><rect x="1390" y="300" width="120" height="220"/></g>']
# edges
out.append('<g fill="none" stroke-width="1.6">')
for a, b in edges:
    if a not in pos or b not in pos: continue
    (x1, y1), (x2, y2) = pos[b], pos[a]  # dependency b -> dependent a
    if x1 > x2: (x1, y1), (x2, y2) = (x2, y2), (x1, y1)
    mx = (x1 + x2) / 2
    c = '#17c86c' if nodes[a]['s'] == 'closed' and nodes[b]['s'] == 'closed' else '#9fb3c4'
    out.append(f'<path d="M{x1:.1f} {y1:.1f} C{mx:.1f} {y1:.1f} {mx:.1f} {y2:.1f} {x2:.1f} {y2:.1f}" stroke="{c}" stroke-opacity=".28"/>')
out.append('</g><g>')
for i, n in enumerate(nodes):
    x, y = pos[i]; r = 7 + 9 * n.get('p', 0)
    c = col.get(n['s'], '#e5ecee')
    if n['t'] == 'epic':
        out.append(f'<rect x="{x-r-3:.1f}" y="{y-r-3:.1f}" width="{2*r+6:.1f}" height="{2*r+6:.1f}" rx="4" fill="{c}" stroke="#0e1926" stroke-width="3" transform="rotate(45 {x:.1f} {y:.1f})"/>')
    else:
        out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{c}" stroke="#0e1926" stroke-width="3"/>')
out.append('</g>')
# players and ball on the touchline
out.append(inner('forklift-a.svg', 1.15, 150, 600))
out.append(inner('forklift-b.svg', 1.15, 1160, 600, flip=True))
out.append(inner('ball-european-a.svg', 4.2, 760, 652))
# wordmark
out.append('<g font-family="Inter, system-ui, sans-serif" font-weight="900" text-anchor="middle">'
 '<text x="800" y="800" font-size="92" fill="#0e1926" stroke="#0e1926" stroke-width="16" stroke-linejoin="round" letter-spacing="2">PHYSICAL SOCCER</text>'
 '<text x="800" y="800" font-size="92" fill="#fcc31a" letter-spacing="2">PHYSICAL SOCCER</text></g>')
s = d['status']
out.append(f'<text x="800" y="840" fill="#e5ecee" font-family="JetBrains Mono, monospace" font-size="26" text-anchor="middle">{len(nodes)} beads · {d["layers"]} layers · {d["blocks"]} blocking edges · planned before the first line of code</text>')
out.append('</svg>')
open(os.path.join(H, 'beads-cover.svg'), 'w').write('\n'.join(out))
print('ok', len(nodes), len(edges))
