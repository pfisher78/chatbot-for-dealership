FROM node:20-alpine

WORKDIR /app

# Install dependencies first (cached layer)
COPY package.json package-lock.json ./
RUN npm ci

# Build TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# Runtime assets
COPY public ./public
COPY config ./config

# Leads/appointments are written here — mount a persistent volume at this path
ENV DATA_DIR=/data
VOLUME ["/data"]

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/server.js"]
