"""Extract a 2D plan slice from the home-digital-twin shell package for the airflow study.

    python3 scripts/extract-house-plan.py ../../home-digital-twin > src/data/house-plan.json

Reads the current model: the CAD shell (walls, doorways, joinery), the fit-out (fridge, AC head) and the
furniture lane at its DEFAULT layouts (main + retreat). Keeps only what the simulation needs: walls cut at
head height, room footprints and names, door openings, obstacles with their height range, and the indoor
AC head. No electrical, cameras or address.
"""
import json, sys, yaml

import os
repo = sys.argv[1]
shell_path = os.path.join(repo, 'twin/house/lowered/shell-0.8.17.yaml')
fitout_path = os.path.join(repo, 'twin/house/interior/fitout.yaml')
furniture_path = os.path.join(repo, 'twin/house/interior/furniture.yaml')
Z = 1.5  # slice height (m): doorways are open, benches (0.91 m) are below, overheads (1.61 m+) are above
d = yaml.safe_load(open(shell_path))
r = lambda v: round(float(v), 3)

solids, rooms, doors, obstacles = [], [], [], []
for e in d['elements']:
    cat = e['category']
    if cat == 'joinery':
        for b in e.get('boxes', []):
            obstacles.append({'k': e['key'], 'kind': 'joinery', 'b': [r(b['min'][0]), r(b['min'][1]), r(b['max'][0]), r(b['max'][1])], 'z': [r(b['min'][2]), r(b['max'][2])]})
    elif cat in ('wall', 'column', 'window', 'door'):
        for b in e.get('boxes', []):
            if b['min'][2] <= Z <= b['max'][2]:
                solids.append({'k': e['key'], 'c': cat, 'b': [r(b['min'][0]), r(b['min'][1]), r(b['max'][0]), r(b['max'][1])]})
    elif cat == 'space':
        v = e['meshes'][0]['vertices']
        ring = [[r(x), r(y)] for x, y, z in v if z == 0.0]
        rooms.append({'k': e['key'], 'name': e['name'], 'poly': ring})
    elif cat == 'opening' and '.door.' in e['key']:
        b = e['boxes'][0]
        doors.append({'k': e['key'], 'name': e['name'].replace(' Opening', ''), 'b': [r(b['min'][0]), r(b['min'][1]), r(b['max'][0]), r(b['max'][1])], 'external': not e.get('host', '').startswith('wall.int')})

import re
ac = None
fit = open(fitout_path).read()
for doc_key in ('fitout.ac.indoor.dining',):
    # small, explicit parse so we do not depend on the fitout schema layout
    m = re.search(r'key: %s.*?dims: \[([^\]]+)\], at: \{centre_x: ([\d.]+), wall_y: ([\d.]+), top_z: ([\d.]+)\}' % re.escape(doc_key), fit, re.S)
    if m:
        w, dpt, h = [float(x) for x in m.group(1).split(',')]
        ac = {'k': doc_key, 'room': 'Dining', 'centre_x': float(m.group(2)), 'wall_y': float(m.group(3)), 'top_z': float(m.group(4)), 'width': w, 'blows': [0, -1]}

# furniture at the default layouts (same placement convention as twin/house/interior/check/furniture_check.py)
FACING = {'E': (1, 0), 'W': (-1, 0), 'N': (0, 1), 'S': (0, -1)}
S = yaml.safe_load(open(furniture_path))
items = list(S['items'])
for lay in S.get('layouts', []):
    if lay.get('default'):
        ch = lay.get('changes') or {}
        rm = set(ch.get('remove') or [])
        items = [i for i in items if i['id'] not in rm] + list(ch.get('add') or [])
for it in items:
    if it.get('solid') is False or 'alfresco' in (it.get('room') or []):
        continue
    w, dd, hh = it['size']; z0 = it.get('z0', 0.0)
    fx, fy = FACING[it['facing']]; rx, ry = fy, -fx
    for u0, u1, v0, v1, a, b in (it.get('parts') or [[-w / 2, w / 2, -dd / 2, dd / 2, 0.0, hh]]):
        pts = [(it['at'][0] + u * rx + v * fx, it['at'][1] + u * ry + v * fy) for u in (u0, u1) for v in (v0, v1)]
        xs_, ys_ = zip(*pts)
        obstacles.append({'k': it['id'], 'kind': 'furniture', 'name': it.get('name', ''), 'b': [r(min(xs_)), r(min(ys_)), r(max(xs_)), r(max(ys_))], 'z': [r(z0 + a), r(z0 + b)]})
# fridge: fit-out appliance against the fridge gable (CP p7), approximate footprint from its dims
m = re.search(r'key: fitout.appliance.fridge.*?dims: \[([^\]]+)\]', fit, re.S)
g = re.search(r'fridge_gable: \{x: \[([\d.]+), ([\d.]+)\].*?depth: ([\d.]+)', fit)
if m and g:
    fw, fd, fh = [float(v) for v in m.group(1).split(',')]
    gx = float(g.group(2))
    obstacles.append({'k': 'fitout.appliance.fridge', 'kind': 'joinery', 'name': 'fridge', 'b': [r(gx), 4.61, r(gx + fw), r(4.61 + fd)], 'z': [0.0, fh]})

xs = [p for s in solids for p in (s['b'][0], s['b'][2])]
ys = [p for s in solids for p in (s['b'][1], s['b'][3])]
out = {'source': 'home-digital-twin shell@' + d['meta']['package_version'] + ' + fitout + furniture ' + '+'.join(l['id'] for l in S.get('layouts', []) if l.get('default')), 'slice_z': Z, 'units': 'm',
       'extent': [min(xs), min(ys), max(xs), max(ys)], 'solids': solids, 'obstacles': obstacles, 'rooms': rooms, 'doors': doors, 'ac': ac}
json.dump(out, sys.stdout, separators=(',', ':'))
