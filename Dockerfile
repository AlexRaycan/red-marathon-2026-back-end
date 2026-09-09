FROM node:22.23.2-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/* \
  && npm install --global pnpm@11.25.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma

RUN pnpm install --frozen-lockfile

COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN pnpm prisma:generate \
  && pnpm build

FROM node:22.23.2-bookworm-slim AS runtime

ENV NODE_ENV=development

WORKDIR /app

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./
COPY --from=build /app/dist ./dist

EXPOSE 4000

CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && exec node dist/main"]
