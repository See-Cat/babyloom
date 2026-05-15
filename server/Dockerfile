FROM node:18-alpine

WORKDIR /app

RUN mkdir -p /app/uploads /app/config /app/data

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3001

VOLUME ["/app/uploads", "/app/config", "/app/data"]

CMD ["node", "dist/main.js"]
