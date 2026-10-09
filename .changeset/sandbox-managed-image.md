---
'containers-mcp': minor
---

Start sandboxes from a snapshot of the Cloudflare-managed `cloudflare/debian-trixie` image instead of a custom Dockerfile. The snapshot is built once with the same toolchain and restored for every sandbox, so deploys no longer build or push an image. A failed start no longer resets the sandbox's Durable Object.
