###
# STAGE: BASE
###
FROM node:22 AS base

# Set non-interactive mode to avoid prompts during package installation
ARG DEBIAN_FRONTEND=noninteractive

# Setup pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Use bash for the shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Update and install useful CLI utilities
RUN apt-get update && apt-get install -y curl ca-certificates \
    git \
    htop \
    vim \
    wget \
    net-tools \
    build-essential \
    nmap \
    sudo \
    lsb-release \
    python3 \
    python3-pip \
    python3-matplotlib \
    python3-numpy \
    python3-pandas \
    && apt-get clean

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
RUN pnpm install --frozen-lockfile 

WORKDIR /app/apps/sandbox-container

# Expose the port your Node.js server will run on
EXPOSE 8080

CMD ["pnpm", "run", "start:container"]
