# syntax=docker/dockerfile:1
FROM node:18 AS build

WORKDIR /app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm install

COPY . .

# Keep only production dependencies in the final image
FROM node:18-slim AS production

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/src ./src

EXPOSE 5001

CMD ["npm", "start"]
