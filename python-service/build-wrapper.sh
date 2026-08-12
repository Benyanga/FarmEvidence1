#!/usr/bin/env bash
set -euo pipefail

echo "[build-wrapper] Upgrading pip/setuptools/wheel"
python -m pip install --upgrade pip setuptools wheel

echo "[build-wrapper] Trying to install binary wheels for numpy, matplotlib, pandas"
if python -m pip install --only-binary=:all: numpy matplotlib pandas; then
  echo "[build-wrapper] binary wheels installed"
else
  echo "[build-wrapper] binary-only install failed, falling back to normal install"
fi

echo "[build-wrapper] Installing requirements.txt"
python -m pip install -r requirements.txt

echo "[build-wrapper] done"
