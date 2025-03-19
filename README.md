# Publishing Multi-Architecture Docker Images: mindmap-converter-mcp

This guide explains how to publish your `mindmap-converter-mcp` Docker image with multi-architecture support.

## Complete Workflow in English

### 1. Login to Docker Hub

```bash
docker login
```
Enter your Docker Hub username and password when prompted.

### 2. Set up Docker Buildx

```bash
# Check if buildx is available
docker buildx version

# Create a new builder instance with multi-architecture support
docker buildx create --name multiarch-builder --use

# Verify the builder is ready
docker buildx inspect --bootstrap
```

### 3. Build and Push Multi-Architecture Image (Single Command)

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  -t yourusername/mindmap-converter-mcp:latest \
  --push .
```

This command:
- Builds for both AMD64 (Intel/AMD) and ARM64 (Apple Silicon/ARM) architectures
- Tags the image with your username
- Pushes directly to Docker Hub

### 4. Alternative: Step-by-Step Method

If you prefer more control:

```bash
# Build AMD64 version
docker buildx build --platform linux/amd64 \
  -t yourusername/mindmap-converter-mcp:amd64 \
  --push .

# Build ARM64 version
docker buildx build --platform linux/arm64 \
  -t yourusername/mindmap-converter-mcp:arm64 \
  --push .

# Create and push a multi-architecture manifest
docker manifest create yourusername/mindmap-converter-mcp:latest \
  yourusername/mindmap-converter-mcp:amd64 \
  yourusername/mindmap-converter-mcp:arm64

docker manifest push yourusername/mindmap-converter-mcp:latest
```

### 5. Verify Your Published Image

```bash
docker manifest inspect yourusername/mindmap-converter-mcp:latest
```

This displays the architectures supported by your image.

Remember to replace `yourusername` with your actual Docker Hub username in all commands.