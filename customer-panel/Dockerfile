# Build Stage
FROM node:22.23.4-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 as build

WORKDIR /app

COPY package.json ./
COPY package-lock.json ./

# Install dependencies

RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps

COPY . .

# CRA only auto-loads .env files at build time; write the API URL and other
# production env values into a production env file so they are inlined into the bundle.
RUN printf "REACT_APP_API_URL=%s\n" "$REACT_APP_API_URL" > .env.production && \
    printf "REACT_APP_GOOGLE_CLIENT_ID=%s\n" "$REACT_APP_GOOGLE_CLIENT_ID" >> .env.production && \
    printf "REACT_APP_STRIPE_PUBLIC_KEY=%s\n" "$REACT_APP_STRIPE_PUBLIC_KEY" >> .env.production && \
    printf "REACT_APP_GOOGLE_MAPS_KEY=%s\n" "$REACT_APP_GOOGLE_MAPS_KEY" >> .env.production

# Build argument for API URL
# Build argument for API URL
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL

ARG REACT_APP_MAINTENANCE_MODE
ENV REACT_APP_MAINTENANCE_MODE=$REACT_APP_MAINTENANCE_MODE

ARG REACT_APP_ORDERING_DISABLED
ENV REACT_APP_ORDERING_DISABLED=$REACT_APP_ORDERING_DISABLED

ARG REACT_APP_GOOGLE_MAPS_KEY
ENV REACT_APP_GOOGLE_MAPS_KEY=$REACT_APP_GOOGLE_MAPS_KEY

ARG REACT_APP_STRIPE_PUBLIC_KEY
ENV REACT_APP_STRIPE_PUBLIC_KEY=$REACT_APP_STRIPE_PUBLIC_KEY

ARG REACT_APP_GOOGLE_CLIENT_ID
ENV REACT_APP_GOOGLE_CLIENT_ID=$REACT_APP_GOOGLE_CLIENT_ID

# Set CI=false to ensure warnings don't break the build
ENV CI=false

# react-app/jest ESLint config is incompatible with newer ESLint ("jest/globals" env key).
# Skip the ESLint plugin during the production build.
ENV DISABLE_ESLINT_PLUGIN=true

RUN npm run build

# Serve Stage
FROM nginx:alpine@sha256:a3554c0d0b48177b1413c26e01f695334428020d9df01243fbae3e11cfd17417
RUN apk add --no-cache --upgrade brotli-libs=1.2.1-r0 curl=8.23.0-r0 libcurl=8.23.0-r0

COPY --from=build /app/build /usr/share/nginx/html

# Copy custom nginx config to handle React Router (SPA)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

