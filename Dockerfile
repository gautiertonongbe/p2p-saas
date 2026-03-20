FROM node:20-alpine

WORKDIR /app

# Install pnpm via corepack
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --no-frozen-lockfile

# Copy all source files
COPY . .

# Build the app
RUN pnpm run build

EXPOSE 3000

# Use startup script that seeds DB then starts server
CMD ["node", "scripts/start.mjs"]
