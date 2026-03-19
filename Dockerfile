FROM node:20-alpine

WORKDIR /app

# Install pnpm via corepack (built into Node 20)
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies (no patches needed)
RUN pnpm install --no-frozen-lockfile

# Copy all source files
COPY . .

# Build the app
RUN pnpm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]
