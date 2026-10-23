---
'containers-mcp': patch
---

Name every sandbox `sandbox`. The runtime names containers after their 64-character Durable Object ID, longer than a DNS label allows, so tools that resolve their own hostname failed: `python3 -m http.server` crashed with `UnicodeEncodeError: label too long`.
