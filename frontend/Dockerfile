# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage
FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/dist ./dist

LABEL org.opencontainers.image.title="VOID Frontend" \
      org.opencontainers.image.description="VOID - Vault-Oriented Infrastructure for Developers"

EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
