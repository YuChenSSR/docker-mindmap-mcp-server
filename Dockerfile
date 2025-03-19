# Use Node.js Alpine for a lightweight image
FROM node:18-alpine

# Install markmap-cli globally
RUN npm install -g markmap-cli

# Create app directory
WORKDIR /app

# Copy package files
COPY package.json tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY src/ ./src/

# Build TypeScript code
RUN npm run build

# Clean up dev dependencies to reduce image size
RUN npm prune --production

# Run the server
CMD ["node", "build/index.js"]
