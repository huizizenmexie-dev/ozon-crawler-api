FROM node:18-slim

# Install system dependencies for Playwright
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Playwright browsers and their dependencies
RUN npx playwright install --with-deps chromium

WORKDIR /app

COPY package.json .
RUN npm install --production

COPY server.js .

EXPOSE 8080

CMD ["node", "server.js"]
