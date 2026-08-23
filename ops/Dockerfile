FROM node:22.23.0-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app
COPY --chown=node:node production-monitor.mjs ./production-monitor.mjs

USER node
CMD ["node", "production-monitor.mjs"]
