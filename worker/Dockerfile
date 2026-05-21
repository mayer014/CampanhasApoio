# Imagem oficial do Playwright já vem com Chromium + libs do sistema
FROM mcr.microsoft.com/playwright:v1.55.0-jammy

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
CMD ["node", "index.js"]
