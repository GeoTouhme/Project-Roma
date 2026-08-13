# Build Stage
FROM node:18-alpine as build

WORKDIR /app

COPY package.json ./

# Install dependencies

RUN --mount=type=cache,target=/root/.npm \
    npm install --force

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
FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html

# Copy custom nginx config to handle React Router (SPA)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

