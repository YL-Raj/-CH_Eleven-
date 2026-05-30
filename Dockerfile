# CH_Eleven — Railway deployment
# Unified image: Express backend + static frontend served together
# Copyright (c) 2026 RAJ.Y — All rights reserved.

FROM node:20-alpine
RUN apk add --no-cache curl

WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./
RUN npm install --production

# Copy backend source
COPY backend/server.js .
COPY backend/scorecard-parser.js .
COPY backend/ocr-routes.js .
COPY backend/schema.sql .

# Copy frontend static files → served by Express on Railway
COPY frontend/public/ ./public/

# Copy CSV templates
COPY templates/ ./templates/

RUN mkdir -p /tmp/uploads

EXPOSE 3001

CMD ["node", "server.js"]
