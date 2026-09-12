FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend/package.json backend/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN pnpm install --frozen-lockfile --filter @velozity/backend...
COPY backend backend
COPY packages/contracts packages/contracts
RUN pnpm --filter @velozity/backend db:generate && pnpm --filter @velozity/backend build

FROM node:24-alpine
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 4000
CMD ["sh", "-c", "pnpm --filter @velozity/backend exec prisma migrate deploy && exec pnpm --filter @velozity/backend start"]
