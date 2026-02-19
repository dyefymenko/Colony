FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY *.ts tsconfig.json ./
COPY kite-wallets.json* ./

ARG SERVICE=proxy-api

EXPOSE 3010 3011 3012

CMD ["sh", "-c", "npx tsx ${SERVICE}.ts"]
