# ---- build stage: client + server ----
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npx tsc -p tsconfig.server.json

# ---- runtime ----
FROM node:24-alpine
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data CLIENT_DIR=/app/dist
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/server/dist ./server/dist
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "server/dist/index.js"]
