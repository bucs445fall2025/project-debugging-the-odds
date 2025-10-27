# Build
from node:20-alpine as build
workdir /app
copy . .
run npm install
run npm run build

# Serve (slay)
from nginx:stable-alpine
copy --from=build /app/dist /usr/share/nginx/html
copy nginx.conf /etc/nginx/nginx.conf

expose 80
cmd [ "nginx", "-g", "daemon off;" ]
