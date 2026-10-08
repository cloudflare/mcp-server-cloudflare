---
'containers-mcp': minor
---

Run sandboxes on the Containers `durable_object` scheduling policy. `UserContainer` starts the image itself and runs every tool through native `ctx.container.exec()`, so the container no longer runs an HTTP server and starts faster. `container_exec` now honours its `timeout`, and `container_file_read` returns text files with unknown extensions, such as `.py`, as text.
