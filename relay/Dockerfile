# Rentnode relay - one long-running Node process. Needs ssh-keygen for the
# per-lease keypairs and a persistent /app/data volume for state.json.
FROM node:22-alpine
RUN apk add --no-cache openssh-keygen
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY index.mjs ./
ENV PORT=8787 DATA_DIR=/app/data
EXPOSE 8787
VOLUME ["/app/data"]
CMD ["node", "index.mjs"]
