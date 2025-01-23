#!/bin/bash
set -e

cd "$(dirname "$0")"

docker run \
  --rm \
  -it \
  -v "$(pwd):/src" \
  -v $(pwd)/emcc-cache:/emsdk/upstream/emscripten/cache \
  -u "$(id -u):$(id -g)" \
  donalffons/opencascade.js \
  config.yml

sed -i 's/Graphic3d_ZLayerId/Standard_Integer/g' maqet-occt.d.ts
