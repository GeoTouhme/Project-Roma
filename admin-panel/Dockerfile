# Build Stage
FROM node:22.23.4-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 as build

# Accept API URL as build argument
ARG VITE_API_URL=http://localhost:5001
ENV VITE_API_URL=$VITE_API_URL

WORKDIR /app

COPY package.json ./
COPY package-lock.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci

COPY . .

# Vite only auto-loads .env files, not arbitrary shell env vars, at build time.
# Write the build-time API URL into a production env file so it is inlined.
RUN printf "VITE_API_URL=%s\n" "$VITE_API_URL" > .env.production

RUN npm run build

# Production Stage
FROM nginx:alpine@sha256:a3554c0d0b48177b1413c26e01f695334428020d9df01243fbae3e11cfd17417 as production
RUN apk add --no-cache --upgrade brotli-libs=1.2.1-r0 curl=8.23.0-r0 libcurl=8.23.0-r0

COPY --from=build /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
