# The sandbox users' commands run in. The Worker drives it with ctx.container.exec(), so the image
# runs no server: it only needs the toolchains and a process that keeps it alive.
FROM node:24.20.0-trixie-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    curl \
    git \
    python3 \
    python3-pip \
    python3-venv \
    wget && \
    rm -rf /var/lib/apt/lists/* && \
    ln -sf /usr/bin/python3 /usr/bin/python && \
    # exec() processes don't inherit image ENV, so pip's PEP 668 opt-out lives in its config file.
    printf '[global]\nbreak-system-packages = true\nroot-user-action = ignore\n' > /etc/pip.conf && \
    npm install -g pnpm && \
    npm cache clean --force

WORKDIR /workdir

ENTRYPOINT ["sleep", "infinity"]
