# BUBER — single image for any Docker host (Railway, Render, Fly.io, a VPS…)
FROM node:22-bookworm-slim

# ffmpeg/ffprobe for reel processing; openssl for Prisma
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate && npx next build

ENV NODE_ENV=production \
    MEDIA_ROOT=/data/storage \
    RUN_WORKER_IN_APP=true \
    PORT=3000
EXPOSE 3000
CMD ["bash", "scripts/start.sh"]
