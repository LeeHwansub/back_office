FROM node:22-bookworm

WORKDIR /app

COPY apps/api/package.json apps/api/package-lock.json ./
RUN npm ci

COPY apps/api/ ./

EXPOSE 3001

CMD ["npm", "run", "start:dev"]
