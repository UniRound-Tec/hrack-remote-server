FROM node:22.23.0-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22.23.0-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

# standalone 产物自带最小 node_modules；静态资源与字体单独拷贝
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/drizzle ./drizzle

# SQLite 数据目录（compose 挂 web-data 卷到 /app/data）
RUN mkdir -p /app/data && chown node:node /app/data
ENV HRACK_WEB_DATA=/app/data

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["node", "server.js"]
