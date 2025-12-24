# Multi-stage build for Next.js + Python/RenderCV
FROM node:20-alpine AS nextjs-builder

WORKDIR /app

# Copy package files
COPY cv-tailor-app/package*.json ./

# Install Node.js dependencies
RUN npm ci

# Copy Next.js source
COPY cv-tailor-app/ ./

# Ensure public directory exists (create if empty)
RUN mkdir -p public

# Build Next.js app
RUN npm run build

# Final stage: Python + Node.js runtime
FROM python:3.12-slim-bookworm

WORKDIR /app

# Install Node.js for Next.js runtime
RUN apt-get update && \
    apt-get install -y nodejs npm && \
    rm -rf /var/lib/apt/lists/*

# Install system dependencies for PDF generation (Typst needs these)
RUN apt-get update && \
    apt-get install -y \
    curl \
    fontconfig \
    && rm -rf /var/lib/apt/lists/*

# Copy RenderCV project files
COPY pyproject.toml uv.lock ./
COPY src/ ./src/
COPY schema.json ./
COPY README.md ./

# Install RenderCV with all dependencies
RUN pip install --no-cache-dir -e ".[full]"

# Copy Next.js build and runtime files
COPY --from=nextjs-builder /app/.next ./cv-tailor-app/.next
COPY --from=nextjs-builder /app/node_modules ./cv-tailor-app/node_modules
COPY --from=nextjs-builder /app/package.json ./cv-tailor-app/
COPY --from=nextjs-builder /app/public ./cv-tailor-app/public
COPY --from=nextjs-builder /app/app ./cv-tailor-app/app
COPY --from=nextjs-builder /app/next.config.js ./cv-tailor-app/
COPY --from=nextjs-builder /app/tsconfig.json ./cv-tailor-app/

# Copy template files to cv-tailor-app directory
COPY cv-tailor-app/Kshitij_Dahal_CV.yaml ./cv-tailor-app/
COPY cv-tailor-app/Kshitij_Dahal_Cover_Letter.yaml ./cv-tailor-app/

# Set working directory to cv-tailor-app
WORKDIR /app/cv-tailor-app

# Set environment variables
ENV NODE_ENV=production
# Ensure rendercv command is in PATH (pip installs to /usr/local/bin by default)
ENV PATH="/usr/local/bin:$PATH"

# Expose port
EXPOSE 3000

# Start Next.js
CMD ["npm", "start"]

