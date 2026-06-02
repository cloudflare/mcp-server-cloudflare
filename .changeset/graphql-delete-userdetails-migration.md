---
'graphql-mcp-server': patch
---

Add a `deleted_classes: ["UserDetails"]` Durable Object migration to the graphql server.

\#384 removed the `UserDetails` Durable Object (and its bindings) from every server, and added the
required delete-class migration to the two servers that *own* the class (`workers-observability`,
`workers-builds`). The graphql worker's already-deployed version still depends on `UserDetails`, so
`wrangler deploy` rejected the new version with `code: 10064` ("New version of script does not export
class 'UserDetails' which is depended on by existing Durable Objects"), which aborted the staging and
production deploys. Adding the delete-class migration lets graphql deploy and releases the binding that
was blocking `workers-observability` from applying its own `deleted_classes` migration (`code: 10061`).

Validated on staging: graphql + observability deploy cleanly and the staging `UserDetails` namespace is
removed.
