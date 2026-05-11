FROM mcr.microsoft.com/playwright:v1.59.1-noble

WORKDIR /app

RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    python3 python3-pip python3-cairo libcairo2 librsvg2-bin fonts-noto-cjk fonts-dejavu-core ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY bot.js ./bot.js
COPY scripts ./scripts

ENV NODE_ENV=production \
    DATA_DIR=/app/data \
    TMP_DIR=/tmp/ip-tools-telegram-bot

CMD ["node", "/app/bot.js"]
