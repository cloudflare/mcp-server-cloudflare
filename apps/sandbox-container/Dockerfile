# Use Alpine as base for minimal size
FROM alpine:3.19 as base

# Install necessary packages while minimizing layers
# We combine commands with && and clean cache in the same layer
# to reduce the image size
RUN apk update && \
    apk add --no-cache \
    # Core utilities
    git \
    curl \
    wget \
    # Build essentials
    build-base \
    # Python and pip
    python3 \
    py3-pip \
    # Node and npm
    nodejs \
    npm && \
    # Clean up the cache to reduce image size
    rm -rf /var/cache/apk/* && \
    # Create symlink for python
    ln -sf /usr/bin/python3 /usr/bin/python

# Install pnpm in a separate layer for better caching
RUN npm install -g pnpm && \
    rm -rf /root/.npm

# Set up pnpm environment
ENV PNPM_HOME=/usr/local/bin
ENV PATH=$PNPM_HOME:$PATH

# Set working directory
WORKDIR /app

# Set environment variables
ENV PATH="/app/node_modules/.bin:${PATH}"

###
# STAGE: PRUNE -  Generate a partial monorepo for the sandbox-container app. The output will be placed into a directory named "out"
###
FROM base AS prune
WORKDIR /app
RUN pnpm install turbo --global
COPY . .
RUN turbo prune containers-starter

###
# STAGE: INSTALL & RUN
###
FROM base AS installer
WORKDIR /app

COPY --from=prune /app/out/ .
RUN pnpm install --frozen-lockfile --only=production

WORKDIR /app/apps/sandbox-container

# Expose the port your Node.js server will run on
EXPOSE 8080

CMD ["pnpm", "run", "start:container"]
