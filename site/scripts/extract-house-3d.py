"""Extract 3D boxes from the home-digital-twin shell package for the 3D airflow study.

    python3 scripts/extract-house-3d.py ../../home-digital-twin > src/data/house-3d.json

Same sources and privacy rules as extract-house-plan.py (the 2D slice): the CAD shell (walls with their door
heads and window sills, windows, columns, joinery), the fit-out (fridge, over-fridge cupboard, AC head) and the
furniture lane at its DEFAULT layouts. Everything is an axis-aligned box [x0, y0, z0, x1, y1, z1] in metres
(x east, y north, z up from finished floor). No address, electrical, cameras or package name.

Spaces outside the conditioned envelope (Alfresco, Porch, Garage) and the cupboards behind closed sliders
(robes, linen) are left out; openings into them are treated as closed and are not listed as doors.
"""
import json, os, re, sys
import yaml

repo = sys.argv[1]
shell_path = os.path.join(repo, 'twin/house/lowered/shell-0.8.17.yaml')
fitout_path = os.path.join(repo, 'twin/house/interior/fitout.yaml')
furniture_path = os.path.join(repo, 'twin/house/interior/furniture.yaml')
d = yaml.safe_load(open(shell_path))
r = lambda v: round(float(v), 3)
box6 = lambda b: [r(b['min'][0]), r(b['min'][1]), r(b['min'][2]), r(b['max'][0]), r(b['max'][1]), r(b['max'][2])]
EXCLUDE = {'Alfresco', 'Porch', 'Garage', 'Linen', 'Robe (Bed 2)', 'Robe (Bed 3)', 'Robe (Bed 4)'}
CLOSABLE = re.compile(r'^(Bed \d Door|Bath Door|WC|Media)$')  # doors a person would shut (same rule as the 2D figure)


def in_poly(x, y, poly):
    c = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]; xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            c = not c
        j = i
    return c


# ---- spaces: footprint ring at z = 0 and ceiling height from the space mesh / ceiling finish
rooms, ceilings = [], {}
for e in d['elements']:
    if e['category'] == 'ceiling_finish':
        zs = [v[2] for m in e.get('meshes', []) for v in m['vertices']]
        if zs:
            ceilings[e['key'].replace('finish.ceiling.', '')] = max(zs)
for e in d['elements']:
    if e['category'] != 'space':
        continue
    v = e['meshes'][0]['vertices']
    ring = [[r(x), r(y)] for x, y, z in v if z == 0.0]
    top = max(z for _, _, z in v)
    rooms.append({'k': e['key'], 'name': e['name'], 'poly': ring, 'ceiling_z': r(ceilings.get(e['key'], top))})
inside = [q for q in rooms if q['name'] not in EXCLUDE]


def room_at(x, y):
    for q in rooms:
        if in_poly(x, y, q['poly']):
            return q
    return None


# ---- walls (every box, so door heads and window sills come with them), columns, windows, joinery, doors
solids, joinery, doors, closed = [], [], [], []
for e in d['elements']:
    cat = e['category']
    if cat in ('wall', 'column'):
        for b in e.get('boxes', []):
            solids.append({'k': e['key'], 'c': cat, 'b': box6(b)})
    elif cat == 'joinery':
        for b in e.get('boxes', []):
            joinery.append({'k': e['key'], 'name': e['name'], 'b': box6(b)})
    elif cat == 'opening':
        b = e['boxes'][0]
        bb = box6(b)
        if '.window.' in e['key']:
            # windows are modelled closed: the whole opening (frame + glass) is a solid
            solids.append({'k': e['key'].replace('opening.', ''), 'c': 'window', 'b': bb})
            continue
        # a doorway: which spaces does it join? probe 0.15 m either side of the wall
        thin_x = bb[3] - bb[0] < bb[4] - bb[1]
        cx, cy = (bb[0] + bb[3]) / 2, (bb[1] + bb[4]) / 2
        if thin_x:
            a, c2 = room_at(bb[0] - 0.15, cy), room_at(bb[3] + 0.15, cy)
        else:
            a, c2 = room_at(cx, bb[1] - 0.15), room_at(cx, bb[4] + 0.15)
        names = [q['name'] if q else None for q in (a, c2)]
        name = e['name'].replace(' Opening', '')
        if all(n and n not in EXCLUDE for n in names) and e.get('host', '').startswith('wall.int'):
            doors.append({'k': e['key'], 'name': name, 'b': bb, 'head_z': bb[5], 'axis': 'x' if thin_x else 'y',
                          'joins': names, 'closable': bool(CLOSABLE.match(name))})
        else:
            # closed: external doors and sliders, robe sliders, the garage door. A solid plug in the wall.
            solids.append({'k': e['key'].replace('opening.', ''), 'c': 'door_closed', 'b': bb})
            closed.append(name)

# ---- fit-out: AC indoor head, fridge, over-fridge cupboard, bulkhead over the fridge (CP p7)
fit = open(fitout_path).read()
ac = None
m = re.search(r'key: fitout\.ac\.indoor\.dining.*?dims: \[([^\]]+)\], at: \{centre_x: ([\d.]+), wall_y: ([\d.]+), top_z: ([\d.]+)\}', fit, re.S)
if m:
    w, dp, hh = [float(x) for x in m.group(1).split(',')]
    cx, wy, top = float(m.group(2)), float(m.group(3)), float(m.group(4))
    # north wall inner face: the head hangs on it and blows south (-y)
    ac = {'k': 'fitout.ac.indoor.dining', 'room': 'Dining', 'wall': 'north', 'normal': [0, -1], 'centre_x': cx, 'wall_y': wy,
          'top_z': top, 'size': [w, dp, hh], 'b': [r(cx - w / 2), r(wy - dp), r(top - hh), r(cx + w / 2), r(wy), r(top)]}
mf = re.search(r'key: fitout\.appliance\.fridge.*?dims: \[([^\]]+)\]', fit, re.S)
g = re.search(r'fridge_gable: \{x: \[([\d.]+), ([\d.]+)\].*?depth: ([\d.]+)', fit)
ofr = re.search(r'over_fridge: \{x: \[([\d.]+), ([\d.]+)\], z: \[([\d.]+), ([\d.]+)\], depth: ([\d.]+)', fit)
bh = re.search(r'bulkhead: \{elementKey: [\w.]+, x: \[([\d.]+), ([\d.]+)\], z: \[([\d.]+), ([\d.]+)\]', fit)
wall_y = 4.61  # rear run backs onto the hall wall face (fitout kitchen.rear_run.wall_y)
if mf and g:
    fw, fd, fh = [float(v) for v in mf.group(1).split(',')]
    gx = float(g.group(2))
    joinery.append({'k': 'fitout.appliance.fridge', 'name': 'fridge', 'b': [r(gx), wall_y, 0.0, r(gx + fw), r(wall_y + fd), r(fh)]})
    joinery.append({'k': 'fitout.kitchen.fridge_gable', 'name': 'fridge gable', 'b': [float(g.group(1)), wall_y, 0.0, gx, r(wall_y + float(g.group(3))), 2.38]})
if ofr:
    x0, x1, z0, z1, dep = [float(v) for v in ofr.groups()]
    joinery.append({'k': 'fitout.kitchen.over_fridge', 'name': 'cupboard over the fridge', 'b': [x0, wall_y, z0, x1, r(wall_y + dep), z1]})
if bh:
    x0, x1, z0, z1 = [float(v) for v in bh.groups()]
    shell_bh = next((j for j in joinery if j['k'] == 'joinery.kitchen.bulkhead.rear'), None)
    if shell_bh and x1 > shell_bh['b'][3]:  # p7: the bulkhead runs on over the fridge
        joinery.append({'k': 'fitout.kitchen.bulkhead.over_fridge', 'name': 'bulkhead over the fridge', 'b': [shell_bh['b'][3], shell_bh['b'][1], z0, x1, shell_bh['b'][4], z1]})

# ---- furniture at the default layouts (placement convention of twin/house/interior/check/furniture_check.py)
FACING = {'E': (1, 0), 'W': (-1, 0), 'N': (0, 1), 'S': (0, -1)}
S = yaml.safe_load(open(furniture_path))
items = list(S['items'])
for lay in S.get('layouts', []):
    if lay.get('default'):
        ch = lay.get('changes') or {}
        rm = set(ch.get('remove') or [])
        items = [i for i in items if i['id'] not in rm] + list(ch.get('add') or [])
furniture = []
for it in items:
    if it.get('solid') is False or 'alfresco' in (it.get('room') or []):
        continue
    q = room_at(*it['at'])
    if not q or q['name'] in EXCLUDE:
        continue
    w, dd, hh = it['size']; z0 = it.get('z0', 0.0)
    fx, fy = FACING[it['facing']]; rx, ry = fy, -fx
    for u0, u1, v0, v1, a, b in (it.get('parts') or [[-w / 2, w / 2, -dd / 2, dd / 2, 0.0, hh]]):
        pts = [(it['at'][0] + u * rx + v * fx, it['at'][1] + u * ry + v * fy) for u in (u0, u1) for v in (v0, v1)]
        xs_, ys_ = zip(*pts)
        furniture.append({'k': it['id'], 'name': it.get('name', ''), 'room': q['name'], 'b': [r(min(xs_)), r(min(ys_)), r(z0 + a), r(max(xs_)), r(max(ys_)), r(z0 + b)]})

xs = [p for q in inside for p, _ in q['poly']]
ys = [p for q in inside for _, p in q['poly']]
xw = [p for s in solids for p in (s['b'][0], s['b'][3])]
yw = [p for s in solids for p in (s['b'][1], s['b'][4])]
x0, y0 = max(min(xw), min(xs) - 0.07), max(min(yw), min(ys) - 0.07)
x1, y1 = min(max(xw), max(xs) + 0.07), min(max(yw), max(ys) + 0.07)
out = {
    'source': 'home-digital-twin shell@' + d['meta']['package_version'] + ' + fitout + furniture ' + '+'.join(l['id'] for l in S.get('layouts', []) if l.get('default')),
    'units': 'm', 'frame': 'x east, y north, z up from finished floor; boxes are [x0, y0, z0, x1, y1, z1]',
    'extent': [r(x0), r(y0), r(x1), r(y1)], 'ceiling_z': max(q['ceiling_z'] for q in inside),
    'excluded_spaces': sorted(EXCLUDE), 'closed_openings': sorted(set(closed)),
    'rooms': inside, 'solids': solids, 'joinery': joinery, 'furniture': furniture, 'doors': doors, 'ac': ac,
}
json.dump(out, sys.stdout, separators=(',', ':'))
