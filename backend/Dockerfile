FROM node:20-alpine
RUN apk add --no-cache curl
WORKDIR /app

# Backend dependencies
COPY backend/package*.json ./
RUN npm install --production

# Backend source
COPY backend/server.js .
COPY backend/scorecard-parser.js .
COPY backend/ocr-routes.js .
COPY backend/schema.sql .

# Frontend static files — served by Express on Railway
COPY frontend/public/ ./public/

# CSV templates
COPY templates /app/templates

RUN mkdir -p /tmp/uploads

EXPOSE 3001
CMD ["node", "server.js"]
