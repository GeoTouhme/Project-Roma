# Build Stage
FROM node:18-alpine as build

WORKDIR /app

COPY package.json ./

# Install dependencies

RUN npm install --force

COPY . .

# Build argument for API URL
# Build argument for API URL
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL

ARG REACT_APP_MAINTENANCE_MODE
ENV REACT_APP_MAINTENANCE_MODE=$REACT_APP_MAINTENANCE_MODE

ARG REACT_APP_ORDERING_DISABLED
ENV REACT_APP_ORDERING_DISABLED=$REACT_APP_ORDERING_DISABLED

# Set CI=false to ensure warnings don't break the build
ENV CI=false

RUN npm run build

# Serve Stage
FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html

# Copy custom nginx config to handle React Router (SPA)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

