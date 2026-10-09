---
'containers-mcp': patch
---

`container_exec` timeouts now return on time and kill everything the command started, keeping the output produced before the timeout. A command that starts a background process, such as a dev server, returns once the command exits and leaves that process running.
