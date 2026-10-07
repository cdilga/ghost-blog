# Cover for the fan post: a frame of the 3D airflow sim (two fans, coloured by AC air) with the title set in the
# empty space outside the house. Run capture-sim.cjs first to produce sim-plan.png.
import base64, os
H = os.path.dirname(os.path.abspath(__file__))
from PIL import Image
im = Image.open(os.path.join(H, 'sim-plan.png')); w, h = im.size
b64 = base64.b64encode(open(os.path.join(H, 'sim-plan.png'), 'rb').read()).decode()
W, Hh = 1600, 900
s = W / w; ih = h * s; y = (Hh - ih) / 2
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {W} {Hh}" width="{W}" height="{Hh}">
<rect width="{W}" height="{Hh}" fill="#120d0a"/>
<image href="data:image/png;base64,{b64}" x="0" y="{y:.1f}" width="{W}" height="{ih:.1f}"/>
<rect x="955" y="44" width="560" height="410" rx="18" fill="#120d0a" fill-opacity=".94" stroke="#3a2a1f" stroke-width="2"/>
<g font-family="Inter, system-ui, sans-serif" text-anchor="start">
<text x="985" y="96" fill="#ff7a1a" font-family="JetBrains Mono, monospace" font-size="22" letter-spacing="3">JET PHYSICS · 3D AIRFLOW</text>
<text x="982" y="170" fill="#f2e6d3" font-size="64" font-weight="800" letter-spacing="-1.5">Choosing a</text>
<text x="982" y="240" fill="#f2e6d3" font-size="64" font-weight="800" letter-spacing="-1.5">quiet fan</text>
<text x="985" y="300" fill="#b9a68f" font-size="27">How far does the cold air get?</text>
<text x="985" y="336" fill="#b9a68f" font-size="27">Two fans: 4.7% → 18.7% into Bed 2.</text>
<g transform="translate(985 380)"><rect width="300" height="12" rx="6" fill="url(#ramp)"/><text y="40" fill="#8a7a66" font-family="JetBrains Mono, monospace" font-size="18">share of air from the AC</text></g>
</g>
<defs><linearGradient id="ramp"><stop offset="0" stop-color="#1b2a38"/><stop offset=".6" stop-color="#5d93c0"/><stop offset="1" stop-color="#c9ddf2"/></linearGradient></defs>
</svg>'''
open(os.path.join(H, 'fan-cover.svg'), 'w').write(svg)
print('ok', y, ih)
