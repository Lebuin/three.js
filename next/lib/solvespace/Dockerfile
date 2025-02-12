FROM ubuntu:24.04 AS base-image

RUN apt-get update -y \
  && apt-get install --no-install-recommends -y \
  python3 \
  # Build dependencies
  ca-certificates \
  git \
  xz-utils \
  && git clone https://github.com/emscripten-core/emsdk.git --depth 1 \
  && cd emsdk \
  &&  ./emsdk install latest \
  && ./emsdk activate latest \
  && apt-get remove -y \
  ca-certificates \
  git \
  xz-utils \
  && rm -rf /var/lib/apt/lists/* /var/log/* /tmp/* /root/.cache

RUN apt-get update -y \
  && apt-get install --no-install-recommends -y \
  bash \
  build-essential \
  cmake \
  libcairo2-dev \
  libfreetype6-dev \
  libjson-c-dev \
  libpng-dev \
  zlib1g-dev \
  && rm -rf /var/lib/apt/lists/* /var/log/* /tmp/* /root/.cache

COPY builder.sh /builder.sh

CMD ["/builder.sh"]
