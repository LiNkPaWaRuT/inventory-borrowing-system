# Multi-stage production Dockerfile for Inventory & Borrowing System
# Stage 1: Build the React client
FROM node:20-alpine AS client-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production runtime image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./
RUN npm ci --omit=dev

# Copy generated Prisma client & schema
COPY prisma ./prisma
RUN npx prisma generate

# Copy built server and static client files
COPY server ./server
COPY tsconfig.json ./
COPY --from=client-builder /app/dist ./dist

# Install tsx globally in runner for production execution
RUN npm install -g tsx

EXPOSE 8080

CMD ["tsx", "server/src/index.ts"]
