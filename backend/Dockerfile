FROM node:20-alpine
RUN apk add --no-cache curl
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --production
COPY backend/server.js .
COPY backend/scorecard-parser.js .
COPY templates /app/templates
RUN mkdir -p /tmp/uploads
EXPOSE 3001
CMD ["node", "server.js"]
