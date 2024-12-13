# Cloudflare MCP Server

[![smithery badge](https://smithery.ai/badge/@cloudflare/mcp-server-cloudflare)](https://smithery.ai/protocol/@cloudflare/mcp-server-cloudflare)

Model Context Protocol (MCP) is a [new, standardized protocol](https://modelcontextprotocol.io/introduction) for managing context between large language models (LLMs) and external systems. In this repository, we provide an installer as well as an MCP Server for [Cloudflare's API](https://api.cloudflare.com).

This lets you use Claude Desktop, or any MCP Client, to use natural language to accomplish things on your Cloudflare account, e.g.:

* `Please deploy me a new Worker with an example durable object.`
* `Can you tell me about the data in my D1 database named '...'?`
* `Can you copy all the entries from my KV namespace '...' into my R2 bucket '...'?`

## Demo

<div align="center">
  <a href="https://www.youtube.com/watch?v=vGajZpl_9yA">
    <img src="https://img.youtube.com/vi/vGajZpl_9yA/maxresdefault.jpg" alt="Demonstrating the newly-released MCP server to explore Cloudflare properties, like Workers, KV, and D1." width="600"/>
  </a>
</div>

## Setup

### Installing via Smithery

To install Cloudflare MCP Server for Claude Desktop automatically via [Smithery](https://smithery.ai/protocol/@cloudflare/mcp-server-cloudflare):

```bash
npx @smithery/cli install @cloudflare/mcp-server-cloudflare --client claude
```

### Manual Installation

1. Run `npx @cloudflare/mcp-server-cloudflare init`

<div align="left">
    <img src="https://github.com/user-attachments/assets/163bed75-ec0c-478a-94b2-179969a90923" alt="Example console output" width="300"/>
</div>

2. Restart Claude Desktop, you should see a small 🔨 icon that shows the following tools available for use:

<div align="left">
    <img src="https://github.com/user-attachments/assets/a24275b1-1c6f-4754-96ef-dd7b9f0f5903" alt="Example tool icon" height="160"/>
    <img src="https://github.com/user-attachments/assets/4fb8badb-6800-4a3f-a530-a344b3584bec" alt="Example tool list" height="160"/>
</div>

## Features

### KV Store Management
- `get_kvs`: List all KV namespaces in your account
- `kv_get`: Get a value from a KV namespace
- `kv_put`: Store a value in a KV namespace
- `kv_list`: List keys in a KV namespace
- `kv_delete`: Delete a key from a KV namespace

### R2 Storage Management
- `r2_list_buckets`: List all R2 buckets in your account
- `r2_create_bucket`: Create a new R2 bucket
- `r2_delete_bucket`: Delete an R2 bucket
- `r2_list_objects`: List objects in an R2 bucket
- `r2_get_object`: Get an object from an R2 bucket
- `r2_put_object`: Put an object into an R2 bucket
- `r2_delete_object`: Delete an object from an R2 bucket

### D1 Database Management
- `d1_list_databases`: List all D1 databases in your account
- `d1_create_database`: Create a new D1 database
- `d1_delete_database`: Delete a D1 database
- `d1_query`: Execute a SQL query against a D1 database

### Workers Management
- `worker_list`: List all Workers in your account
- `worker_get`: Get a Worker's script content
- `worker_put`: Create or update a Worker script
- `worker_delete`: Delete a Worker script

### Analytics
- `analytics_get`: Retrieve analytics data for your domain
  - Includes metrics like requests, bandwidth, threats, and page views
  - Supports date range filtering

## Developing

In the current project folder, run:

```
pnpm install
pnpm build:watch
```

Then, in a second terminal:

```
node dist/index.js init
```

This will link Claude Desktop against your locally-installed version for you to test.

## Usage outside of Claude

To run the server locally, run `node dist/index run <account-id>`.

If you're using an alternative MCP Client, or testing things locally, emit the `tools/list` command to get an up-to-date list of all available tools. Then you can call these directly using the `tools/call` command.

### Workers

```javascript
// List workers
worker_list()

// Get worker code
worker_get({ name: "my-worker" })

// Update worker
worker_put({
  name: "my-worker",
  script: "export default { async fetch(request, env, ctx) { ... }}",
  bindings: [
    {
      type: "kv_namespace",
      name: "MY_KV",
      namespace_id: "abcd1234"
    },
    {
      type: "r2_bucket",
      name: "MY_BUCKET",
      bucket_name: "my-files"
    }
  ],
  compatibility_date: "2024-01-01",
  compatibility_flags: ["nodejs_compat"]
})

// Delete worker
worker_delete({ name: "my-worker" })
```

### KV Store

```javascript
// List KV namespaces
get_kvs()

// Get value
kv_get({
    namespaceId: "your_namespace_id",
    key: "myKey"
})

// Store value
kv_put({
    namespaceId: "your_namespace_id",
    key: "myKey",
    value: "myValue",
    expirationTtl: 3600 // optional, in seconds
})

// List keys
kv_list({
    namespaceId: "your_namespace_id",
    prefix: "app_", // optional
    limit: 10 // optional
})

// Delete key
kv_delete({
    namespaceId: "your_namespace_id",
    key: "myKey"
})
```

### R2 Storage

```javascript
// List buckets
r2_list_buckets()

// Create bucket
r2_create_bucket({ name: "my-bucket" })

// Delete bucket
r2_delete_bucket({ name: "my-bucket" })

// List objects in bucket
r2_list_objects({ 
    bucket: "my-bucket",
    prefix: "folder/", // optional
    delimiter: "/", // optional
    limit: 1000 // optional
})

// Get object
r2_get_object({
    bucket: "my-bucket",
    key: "folder/file.txt"
})

// Put object
r2_put_object({
    bucket: "my-bucket",
    key: "folder/file.txt",
    content: "Hello, World!",
    contentType: "text/plain" // optional
})

// Delete object
r2_delete_object({
    bucket: "my-bucket",
    key: "folder/file.txt"
})
```

### D1 Database

```javascript
// List databases
d1_list_databases()

// Create database
d1_create_database({ name: "my-database" })

// Delete database
d1_delete_database({ databaseId: "your_database_id" })

// Execute a single query
d1_query({
    databaseId: "your_database_id",
    query: "SELECT * FROM users WHERE age > ?",
    params: ["25"] // optional
})

// Create a table
d1_query({
    databaseId: "your_database_id",
    query: `
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `
})
```

### Analytics

```javascript
// Get today's analytics
analytics_get({
    zoneId: "your_zone_id",
    since: "2024-11-26T00:00:00Z",
    until: "2024-11-26T23:59:59Z"
})
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
