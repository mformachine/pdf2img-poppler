FROM node:20-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends poppler-utils && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm ci --omit=dev

COPY server.js ./
RUN mkdir media

EXPOSE 5000

CMD ["node", "server.js"]
