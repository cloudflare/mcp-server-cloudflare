import type { Env } from './sandbox.server.context'
import type { UserContainer } from './userContainer'

/** Cloudflare-managed image: Node.js 24 on Debian Trixie slim, prepared on hosts before requests. */
export const BASE_IMAGE = 'cloudflare/debian-trixie'

/**
 * Bump to rebuild the template snapshot, for example after changing TEMPLATE_SETUP or to pick up a
 * newer BASE_IMAGE. Each version gets its own snapshot.
 */
export const TEMPLATE_VERSION = 1

/** Installs the toolchain users expect on top of BASE_IMAGE. Runs once per TEMPLATE_VERSION. */
export const TEMPLATE_SETUP = `set -eu
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends \\
	build-essential ca-certificates curl git python3 python3-pip python3-venv wget
rm -rf /var/lib/apt/lists/*
ln -sf /usr/bin/python3 /usr/bin/python
# exec() processes don't inherit image ENV, so pip's PEP 668 opt-out lives in its config file.
printf '[global]\\nbreak-system-packages = true\\nroot-user-action = ignore\\n' > /etc/pip.conf
npm install -g pnpm
npm cache clean --force
mkdir -p /workdir
`

/** Keeps a container alive; the image's own entrypoint is Node, which exits without a TTY. */
export const KEEP_ALIVE_ENTRYPOINT = ['sleep', 'infinity']

/**
 * The UserContainer instance that builds and owns the template snapshot. User sandboxes are named
 * by Cloudflare user ID, so this name can't collide with one.
 */
export function getTemplateContainer(env: Env): DurableObjectStub<UserContainer> {
	return env.USER_CONTAINER.get(env.USER_CONTAINER.idFromName('__sandbox-template__'))
}
