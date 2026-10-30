#!/usr/bin/env bash
# Build a Linux x86_64 Lambda artifact without modifying the host Python setup.
set -euo pipefail
cd "$(dirname "$0")"
build_dir=$(mktemp -d)
trap 'rm -rf "$build_dir"' EXIT
python3 -m pip install --ignore-installed --no-warn-conflicts --no-compile --target "$build_dir" --only-binary=:all: \
  --platform manylinux2014_x86_64 --platform manylinux_2_28_x86_64 \
  --implementation cp --python-version 3.12 'cryptography==50.0.2' 'cffi==2.1.1' 'pycparser==3.12'
cp issuer.py "$build_dir/issuer.py"
mkdir -p dist
python3 - "$build_dir" "$PWD/dist/issuer.zip" <<'PY'
import pathlib, sys, zipfile
source, output = map(pathlib.Path, sys.argv[1:])
with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(source.rglob("*")):
        if path.is_file() and "__pycache__" not in path.parts:
            archive.write(path, path.relative_to(source))
PY
