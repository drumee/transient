FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends nginx curl ca-certificates \
  && mkdir -p /var/lib/drumee /srv/drumee \
  && chmod 0777 /var/lib/drumee /srv/drumee \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/setup-infra
COPY setup-infra/package.json setup-infra/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY setup-infra/ ./

WORKDIR /opt/kernel/ui-build
COPY ui-build/ ./
RUN npm ci --include=dev --ignore-scripts \
  && node -e "require.resolve('style-loader'); require.resolve('sass-loader');"

WORKDIR /opt/kernel
COPY server-runtime/ ./server-runtime/
COPY ui-runtime/ ./ui-runtime/
COPY server-essentials/ ./server-essentials/
COPY container/ ./scripts/

RUN node ./scripts/build-ui-runtime.js

EXPOSE 28642
ENTRYPOINT ["/opt/kernel/scripts/entrypoint.sh"]
