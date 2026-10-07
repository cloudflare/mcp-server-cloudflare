---
'containers-mcp': patch
---

Fix a path-traversal vulnerability in the sandbox container's file endpoints. `container_file_write`, `container_file_read`, and `container_file_delete` took the client-supplied `path` and used it directly (or after only a `path.join` with the working directory, which does not stop `..` segments or a leading `/` from escaping it) in `fs.writeFile`/`fs.readFile`/`fs.rm`, so a path like `../../etc/passwd` or an absolute path resolved outside the container's working directory. All three now resolve the requested path through a shared guard that rejects anything resolving outside the working directory.
