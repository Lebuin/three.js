#!/bin/bash
set -e

source /emsdk/emsdk_env.sh

mkdir -p src/solvespace/build
cd src/solvespace/build

emcmake cmake .. \
  -DCMAKE_RELEASE_TYPE=Debug \
  -DENABLE_GUI="OFF" \
  -DENABLE_CLI="OFF" \
  -DENABLE_TESTS="OFF" \
  -DENABLE_COVERAGE="OFF" \
  -DENABLE_OPENMP="OFF" \
  -DFORCE_VENDORED_Eigen3="ON" \
  -DENABLE_LTO="ON" \
  -DENABLE_EMSCRIPTEN_LIB="ON"

cmake --build .
