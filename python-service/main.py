"""FarmEvidence chart-rendering service.

Purpose-built for one thing: turning numbers the Node API has already
computed (via the existing JS statistical/CBA engines — this service never
recomputes them) into publication-quality PNG charts, using Python's
data-science/graphing stack (matplotlib + pandas), for the Dashboards and
PDF reports. See docs/ARCHITECTURE.md if that file gets updated to reference
this service.
"""
import base64
import io
from typing import List, Literal, Optional

import chart_style  # noqa: F401 - applies matplotlib rcParams on import
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="FarmEvidence Chart Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000", "http://localhost:3000"],
    allow_methods=["POST"],
    allow_headers=["*"],
)


class Series(BaseModel):
    name: str
    values: List[Optional[float]]
    color: Optional[str] = None


class ChartRequest(BaseModel):
    type: Literal["bar", "line", "pie"]
    labels: List[str]
    series: List[Series]
    title: Optional[str] = None
    xLabel: Optional[str] = None
    yLabel: Optional[str] = None
    stacked: Optional[bool] = False


def _figure_to_data_uri(fig) -> str:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=160, bbox_inches="tight")
    plt.close(fig)
    encoded = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _series_color(s: Series, i: int) -> str:
    return s.color if s.color else chart_style.PALETTE[i % len(chart_style.PALETTE)]


def _render_bar(req: ChartRequest):
    df = pd.DataFrame({s.name: s.values for s in req.series}, index=req.labels)
    fig, ax = plt.subplots(figsize=(6.4, 4))
    n_series = len(req.series)
    x = np.arange(len(req.labels))

    if req.stacked:
        bottom = np.zeros(len(req.labels))
        for i, s in enumerate(req.series):
            values = df[s.name].to_numpy(dtype=float)
            ax.bar(x, values, 0.6, bottom=bottom, label=s.name, color=_series_color(s, i))
            bottom += np.nan_to_num(values)
    else:
        width = 0.8 / max(n_series, 1)
        for i, s in enumerate(req.series):
            ax.bar(x + i * width - (width * (n_series - 1) / 2), df[s.name].to_numpy(dtype=float), width, label=s.name, color=_series_color(s, i))

    total_label_len = sum(len(label) for label in req.labels)
    should_rotate = len(req.labels) > 4 or total_label_len > 30
    ax.set_xticks(x)
    ax.set_xticklabels(req.labels, rotation=30 if should_rotate else 0, ha="right" if should_rotate else "center")
    if n_series > 1:
        ax.legend()
    return fig, ax


def _render_line(req: ChartRequest):
    fig, ax = plt.subplots(figsize=(6.4, 4))
    x = np.arange(len(req.labels))
    for i, s in enumerate(req.series):
        ax.plot(x, s.values, marker="o", linewidth=2, label=s.name, color=_series_color(s, i))
    ax.set_xticks(x)
    ax.set_xticklabels(req.labels)
    if len(req.series) > 1:
        ax.legend()
    return fig, ax


def _render_pie(req: ChartRequest):
    values = req.series[0].values if req.series else []
    fig, ax = plt.subplots(figsize=(5, 5))
    ax.pie(
        values,
        labels=req.labels,
        autopct="%1.0f%%",
        colors=[chart_style.PALETTE[i % len(chart_style.PALETTE)] for i in range(len(req.labels))],
        wedgeprops={"linewidth": 1, "edgecolor": chart_style.WHITE},
    )
    ax.axis("equal")
    return fig, ax


@app.post("/charts/render")
def render_chart(req: ChartRequest):
    if req.type == "bar":
        fig, ax = _render_bar(req)
    elif req.type == "line":
        fig, ax = _render_line(req)
    else:
        fig, ax = _render_pie(req)

    if req.title:
        ax.set_title(req.title)
    if req.xLabel:
        ax.set_xlabel(req.xLabel)
    if req.yLabel:
        ax.set_ylabel(req.yLabel)
    fig.tight_layout()

    return {"image": _figure_to_data_uri(fig)}


@app.get("/health")
def health():
    return {"status": "ok"}
