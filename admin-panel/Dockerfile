# Build Stage
FROM node:18-alpine as build

# Accept API URL as build argument
ARG VITE_API_URL=http://localhost:5001
ENV VITE_API_URL=$VITE_API_URL

WORKDIR /app

COPY package.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm install

COPY . .

# Vite only auto-loads .env files, not arbitrary shell env vars, at build time.
# Write the build-time API URL into a production env file so it is inlined.
RUN printf "VITE_API_URL=%s\n" "$VITE_API_URL" > .env.production

RUN npm run build

# Production Stage
FROM nginx:stable-alpine as production

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
