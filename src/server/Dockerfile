# ./server/Dockerfile

# Stage 1: Build
from mcr.microsoft.com/dotnet/sdk:8.0 AS build
workdir /src
copy . .
run dotnet restore
run dotnet publish -c Release -o /app/publish

# Stage 2: Runtime
from mcr.microsoft.com/dotnet/aspnet:8.0
workdir /app
copy --from=build /app/publish .

# Expose default HTTP port
expose 80

# Start the app
cmd [ "dotnet", "server.dll" ]

