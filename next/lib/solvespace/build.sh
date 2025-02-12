#!/bin/bash
set -e

cd "$(dirname "$0")"

docker build --tag solvespace-builder .

docker run \
  --rm \
  -it \
  -v "$(pwd):/src" \
  -v "$(pwd)/../../../.git/modules/next/lib/solvespace/solvespace:/src/solvespace/.gitroot" \
  -v $(pwd)/emcc-cache:/emsdk/upstream/emscripten/cache \
  -u "$(id -u):$(id -g)" \
  solvespace-builder

cp solvespace/build/bin/slvs.js .
cp solvespace/js/slvs.d.ts .
