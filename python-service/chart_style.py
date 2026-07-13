"""Shared matplotlib styling so every chart this service renders looks like
one consistent product, applied once at import time rather than repeated in
every chart function.

Colors here must match client/src/styles/design-tokens.css exactly — that
file is the single source of truth for the whole app (dashboards, charts,
PDF reports), but Python can't read CSS custom properties, so the categorical
palette and CA/CF treatment colors are duplicated here as plain constants.
If design-tokens.css changes, update this file to match.

PALETTE was CVD-validated with the dataviz skill's validator (5 of the
originally-supplied 8 slots read as gray — chroma below the categorical
floor — and one failed 3:1 contrast; each was corrected by raising OKLCH
chroma while holding its hue family, then re-validated: all checks pass,
worst adjacent CVD delta-E 18.3). Assigned in this fixed order for every
chart; never reshuffled per-request.
"""
import os

import matplotlib

matplotlib.use('Agg')
import matplotlib.font_manager as fm
import matplotlib.pyplot as plt

BLACK = '#111111'
GRAY = '#6b7a72'
WHITE = '#ffffff'

# CA/CF treatment identity — must match --fe-ca / --fe-cf in design-tokens.css.
CA_COLOR = '#1E2D40'
CF_COLOR = '#BA7517'

# Fixed-order categorical palette (sage teal, slate blue, dusty gold, clay
# rose, lavender, moss, olive, dusty sky) — must match --fe-cat-1..8 in
# design-tokens.css. Exempt from the green/black brand so multi-series charts
# (grouped bars, multi-line trends, pie/donut) stay distinguishable at 8+ series.
PALETTE = ['#008568', '#2D66A7', '#AA7E19', '#B8654F', '#8361AD', '#6B8F47', '#95902A', '#1493C1']

_FONT_DIR = os.path.join(os.path.dirname(__file__), 'fonts')
for _weight in ('Roboto-Regular.ttf', 'Roboto-Medium.ttf', 'Roboto-Bold.ttf'):
    _path = os.path.join(_FONT_DIR, _weight)
    if os.path.exists(_path):
        fm.fontManager.addfont(_path)

plt.rcParams.update({
    'font.family': ['Roboto', 'DejaVu Sans', 'Arial', 'sans-serif'],
    'font.size': 11,
    'axes.edgecolor': GRAY,
    'axes.labelcolor': BLACK,
    'axes.titlecolor': BLACK,
    'axes.titleweight': 'bold',
    'axes.titlesize': 13,
    'axes.spines.top': False,
    'axes.spines.right': False,
    'axes.grid': True,
    'grid.color': '#e9ecef',
    'grid.linewidth': 0.8,
    'text.color': BLACK,
    'xtick.color': BLACK,
    'ytick.color': BLACK,
    'figure.facecolor': WHITE,
    'axes.facecolor': WHITE,
    'savefig.facecolor': WHITE,
    'legend.frameon': False
})
