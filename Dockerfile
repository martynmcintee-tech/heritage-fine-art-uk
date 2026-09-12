# Production Dockerfile for UK Zero-Touch Dropshipping Bridge
FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application source
COPY . .

# Expose server port (default 3000)
ENV PORT=3000
EXPOSE 3000

# Run as non-root node user for security
USER node

CMD ["node", "shopify_prodigi_bridge.js"]
