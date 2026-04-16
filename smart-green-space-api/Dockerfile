FROM node:20-bookworm-slim AS base
WORKDIR /app

# Install Python and build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv make g++ curl \
    && apt-get clean && rm -rf /var/lib/apt/lists/* \
    && ln -sf python3 /usr/bin/python

COPY package.json ./
COPY package-lock.json ./

# Dev image
FROM base AS dev
RUN npm install
COPY . .

# Install Python dependencies for the internal ML pipeline
# Debian 12 (Bookworm) requires --break-system-packages or a venv
RUN pip3 install --no-cache-dir -r src/ml/requirements.txt --break-system-packages || true

ENV DATABASE_URL=postgresql://user:pass@localhost:5432/greenspace?schema=public
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Production image
FROM base AS prod
RUN npm install --omit=dev
COPY . .

# Install Python dependencies for the internal ML pipeline
RUN pip3 install --no-cache-dir -r src/ml/requirements.txt --break-system-packages || true

ENV DATABASE_URL=postgresql://user:pass@localhost:5432/greenspace?schema=public
RUN npx prisma generate
EXPOSE 3000
CMD ["node", "server.js"]

