# Speed Kart Escape game server (Colyseus) for Boxity Legion hosting.
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
RUN mkdir -p /app/data && chown node:node /app/data

# Seats per room. Must match the seatCap the deploy workflow sends to Legion.
ARG SEAT_CAP=40
ARG APP_VERSION=dev
ENV SEAT_CAP=${SEAT_CAP} \
    APP_VERSION=${APP_VERSION} \
    PORT=2567

EXPOSE 2567
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s CMD wget -qO- http://127.0.0.1:${PORT}/health || exit 1

USER node
CMD ["node", "src/index.js"]
