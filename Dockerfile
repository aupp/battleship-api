FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Default to REST API, can be overridden to "mcp" for MCP HTTP server
ENV SERVER_TYPE=api

EXPOSE 8080

# Use shell form to allow variable substitution
CMD if [ "$SERVER_TYPE" = "mcp" ]; then node dist/mcp-http.js; else node dist/index.js; fi
