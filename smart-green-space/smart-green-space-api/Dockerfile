FROM node:20-alpine AS base
WORKDIR /app

COPY package*.json ./

# Dev image (includes devDependencies for nodemon/prisma)
FROM base AS dev
RUN npm ci
COPY . .
RUN apk add --no-cache python3 py3-pip && ln -sf /usr/bin/python3 /usr/bin/python && pip3 install --break-system-packages --no-cache-dir numpy requests geojson scikit-learn
ENV DATABASE_URL=postgresql://user:pass@localhost:5432/greenspace?schema=public
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Production image (minimal)
FROM base AS prod
RUN npm ci --omit=dev
COPY . .
RUN apk add --no-cache python3 py3-pip && ln -sf /usr/bin/python3 /usr/bin/python && pip3 install --break-system-packages --no-cache-dir numpy requests geojson scikit-learn
ENV DATABASE_URL=postgresql://user:pass@localhost:5432/greenspace?schema=public
RUN npx prisma generate
EXPOSE 3000
CMD ["node", "server.js"]

