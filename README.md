# Cloudflare MCP Server

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

1. Run `npx @cloudflare/mcp-server-cloudflare init`

   > **Note:** The MCP server will automatically run `npx wrangler login` if you're not already authenticated with Cloudflare. You'll be prompted to complete the authentication process in your browser if needed.

<div align="left">
    <img src="https://github.com/user-attachments/assets/163bed75-ec0c-478a-94b2-179969a90923" alt="Example console output" width="300"/>
</div>

3. Restart Claude Desktop, you should see a small 🔨 icon that shows the following tools available for use:

<div align="left">
    <img src="https://github.com/user-attachments/assets/a24275b1-1c6f-4754-96ef-dd7b9f0f5903" alt="Example tool icon" height="160"/>
    <img src="https://github.com/user-attachments/assets/4fb8badb-6800-4a3f-a530-a344b3584bec" alt="Example tool list" height="160"/>
</div>

## Paid Features

Some features in this MCP server require a paid Cloudflare Workers plan:

- **Observability and Analytics**: The `analytics_get` tool and related analytics features require a paid Workers plan to access these metrics
- Other premium Cloudflare features like advanced D1 database capabilities and higher usage limits also require appropriate paid plans

Ensure your Cloudflare account has the necessary subscription level for the features you intend to use.

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

### Durable Objects
- `durable_objects_list`: List all Durable Objects namespaces
- `durable_objects_create`: Create a new Durable Objects namespace
- `durable_objects_delete`: Delete a Durable Objects namespace
- `durable_objects_list_instances`: List all instances for a specific Durable Objects namespace
- `durable_objects_get_instance`: Get details about a specific Durable Objects instance
- `durable_objects_delete_instance`: Delete a specific Durable Objects instance

### Queues
- `queues_list`: List all Queues in your account
- `queues_create`: Create a new Queue
- `queues_delete`: Delete a Queue
- `queues_get`: Get details about a specific Queue
- `queues_send_message`: Send a message to a Queue
- `queues_get_messages`: Get messages from a Queue
- `queues_update_consumer`: Update a Queue consumer

### Workers AI
- `workers_ai_list_models`: List available AI models
- `workers_ai_get_model`: Get details about a specific AI model
- `workers_ai_run_inference`: Run inference using Workers AI
- `workers_ai_list_tasks`: List AI tasks

### Workflows
- `workflows_list`: List all Workflows in your account
- `workflows_create`: Create a new Workflow
- `workflows_delete`: Delete a Workflow
- `workflows_get`: Get details about a specific Workflow
- `workflows_update`: Update a Workflow
- `workflows_execute`: Execute a Workflow

### Templates
- `templates_list`: List available Worker templates
- `templates_get`: Get details about a specific template
- `templates_create_from_template`: Create a new Worker from a template

### Workers for Platforms
- `w4p_list_dispatchers`: List all Workers for Platforms dispatchers
- `w4p_create_dispatcher`: Create a new dispatcher
- `w4p_delete_dispatcher`: Delete a dispatcher
- `w4p_get_dispatcher`: Get details about a specific dispatcher
- `w4p_update_dispatcher`: Update a dispatcher configuration

### Service Bindings
- `bindings_list`: List all service bindings for a Worker
- `bindings_create`: Create a new service binding
- `bindings_update`: Update a service binding
- `bindings_delete`: Delete a service binding

### URL Routing
- `routing_list_routes`: List all routes for a Worker
- `routing_create_route`: Create a new route
- `routing_update_route`: Update a route
- `routing_delete_route`: Delete a route

### Cron Triggers
- `cron_list`: List all cron triggers for a Worker
- `cron_create`: Create a new cron trigger
- `cron_update`: Update a cron trigger
- `cron_delete`: Delete a cron trigger

### Zones & Domains
- `zones_list`: List all zones in your account
- `zones_create`: Create a new zone
- `zones_delete`: Delete a zone
- `zones_get`: Get details about a specific zone
- `zones_check_activation`: Check zone activation status

### Secrets
- `secrets_list`: List all secrets for a Worker
- `secrets_put`: Create or update a secret
- `secrets_delete`: Delete a secret

### Version Management
- `versions_list`: List all versions of a Worker
- `versions_get`: Get details about a specific version
- `versions_rollback`: Rollback to a previous version

### Wrangler Config
- `wrangler_get_config`: Get the current Wrangler configuration
- `wrangler_update_config`: Update Wrangler configuration

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

This will link Claude Desktop against your locally-installed version for you to test. If you're not already authenticated with Wrangler, the server will automatically prompt you to complete the authentication process in your browser.

## Testing

The project uses Vitest as the testing framework with MSW (Mock Service Worker) for API mocking.

### Running Tests

To run all tests:

```bash
pnpm test
```

To run tests with coverage:

```bash
pnpm test:coverage
```

To run a specific test file:

```bash
pnpm test -- tests/tools/queues.test.ts
```

To run tests in watch mode (useful during development):

```bash
pnpm test:watch
```

### Test Structure

The test suite is organized as follows:

- `tests/tools/`: Contains tests for each Cloudflare API tool
- `tests/mocks/`: Contains mock data and request handlers
- `tests/utils/`: Contains test helper functions
- `tests/setup.ts`: Global test setup configuration

Each tool test file follows a consistent pattern of testing both successful operations and error handling scenarios.

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

### Durable Objects

```javascript
// List Durable Objects namespaces
durable_objects_list()

// Create a new Durable Objects namespace
durable_objects_create({
    name: "my-durable-object",
    script_name: "my-worker",
    class_name: "MyDurableObjectClass"
})

// Delete a Durable Objects namespace
durable_objects_delete({
    id: "your_namespace_id"
})

// List instances for a namespace
durable_objects_list_instances({
    namespaceId: "your_namespace_id",
    limit: 100 // optional
})

// Get details about a specific instance
durable_objects_get_instance({
    namespaceId: "your_namespace_id",
    instanceId: "your_instance_id"
})

// Delete a specific instance
durable_objects_delete_instance({
    namespaceId: "your_namespace_id",
    instanceId: "your_instance_id"
})
```

### Queues

```javascript
// List all queues
queues_list()

// Create a new queue
queues_create({
    name: "my-queue",
    settings: {
        delivery_delay: 0,
        dead_letter_queue: "dead-letter-queue" // optional
    }
})

// Delete a queue
queues_delete({
    name: "my-queue"
})

// Get queue details
queues_get({
    name: "my-queue"
})

// Send a message to a queue
queues_send_message({
    queue: "my-queue",
    messages: [
        { body: JSON.stringify({ key: "value" }) }
    ]
})

// Get messages from a queue
queues_get_messages({
    queue: "my-queue",
    batchSize: 10, // optional
    visibilityTimeout: 30 // optional, in seconds
})

// Update a queue consumer
queues_update_consumer({
    queue: "my-queue",
    consumer: "my-consumer",
    settings: {
        dead_letter_queue: "dead-letter-queue",
        batch_size: 10,
        max_retries: 3
    }
})
```

### Workers AI

```javascript
// List available AI models
workers_ai_list_models()

// Get details about a specific model
workers_ai_get_model({
    model: "@cf/meta/llama-2-7b-chat-int8"
})

// Run inference using Workers AI
workers_ai_run_inference({
    model: "@cf/meta/llama-2-7b-chat-int8",
    input: {
        messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: "Hello, who are you?" }
        ]
    },
    options: {
        temperature: 0.7,
        max_tokens: 100
    }
})

// List AI tasks
workers_ai_list_tasks()
```

### Workflows

```javascript
// List all workflows
workflows_list()

// Create a new workflow
workflows_create({
    name: "my-workflow",
    content: "// Workflow script content here"
})

// Delete a workflow
workflows_delete({
    name: "my-workflow"
})

// Get workflow details
workflows_get({
    name: "my-workflow"
})

// Update a workflow
workflows_update({
    name: "my-workflow",
    content: "// Updated workflow script content"
})

// Execute a workflow
workflows_execute({
    name: "my-workflow",
    input: { key: "value" }
})
```

### Templates

```javascript
// List available templates
templates_list()

// Get details about a specific template
templates_get({
    template: "worker-typescript"
})

// Create a worker from a template
templates_create_from_template({
    name: "my-new-worker",
    template: "worker-typescript",
    options: {
        // Template-specific options
    }
})
```

### Workers for Platforms

```javascript
// List dispatchers
w4p_list_dispatchers()

// Create a new dispatcher
w4p_create_dispatcher({
    name: "my-dispatcher",
    script: "// Dispatcher script content"
})

// Delete a dispatcher
w4p_delete_dispatcher({
    name: "my-dispatcher"
})

// Get dispatcher details
w4p_get_dispatcher({
    name: "my-dispatcher"
})

// Update dispatcher
w4p_update_dispatcher({
    name: "my-dispatcher",
    script: "// Updated dispatcher script content"
})
```

### Service Bindings

```javascript
// List all service bindings for a worker
bindings_list({
    workerName: "my-worker"
})

// Create a new service binding
bindings_create({
    workerName: "my-worker",
    bindingName: "MY_SERVICE",
    serviceEnvironment: "production",
    serviceName: "target-worker"
})

// Update a service binding
bindings_update({
    workerName: "my-worker",
    bindingName: "MY_SERVICE",
    serviceEnvironment: "staging",
    serviceName: "target-worker"
})

// Delete a service binding
bindings_delete({
    workerName: "my-worker",
    bindingName: "MY_SERVICE"
})
```

### URL Routing

```javascript
// List all routes for a worker
routing_list_routes({
    workerName: "my-worker"
})

// Create a new route
routing_create_route({
    workerName: "my-worker",
    pattern: "example.com/*",
    zoneId: "your_zone_id"
})

// Update a route
routing_update_route({
    routeId: "your_route_id",
    pattern: "api.example.com/*",
    zoneId: "your_zone_id"
})

// Delete a route
routing_delete_route({
    routeId: "your_route_id"
})
```

### Cron Triggers

```javascript
// List all cron triggers for a worker
cron_list({
    workerName: "my-worker"
})

// Create a new cron trigger
cron_create({
    workerName: "my-worker",
    schedule: "*/5 * * * *",
    timezone: "UTC" // optional
})

// Update a cron trigger
cron_update({
    triggerId: "your_trigger_id",
    schedule: "0 */2 * * *",
    timezone: "America/New_York"
})

// Delete a cron trigger
cron_delete({
    triggerId: "your_trigger_id"
})
```

### Zones & Domains

```javascript
// List all zones
zones_list()

// Create a new zone
zones_create({
    name: "example.com",
    account: {
        id: "your_account_id"
    }
})

// Get zone details
zones_get({
    zoneId: "your_zone_id"
})

// Delete a zone
zones_delete({
    zoneId: "your_zone_id"
})

// Check zone activation status
zones_check_activation({
    zoneId: "your_zone_id"
})
```

### Secrets

```javascript
// List all secrets for a worker
secrets_list({
    workerName: "my-worker"
})

// Create or update a secret
secrets_put({
    workerName: "my-worker",
    secretName: "API_KEY",
    secretValue: "your-secret-api-key"
})

// Delete a secret
secrets_delete({
    workerName: "my-worker",
    secretName: "API_KEY"
})
```

### Version Management

```javascript
// List all versions of a worker
versions_list({
    workerName: "my-worker"
})

// Get details about a specific version
versions_get({
    workerName: "my-worker",
    versionId: "your_version_id"
})

// Rollback to a previous version
versions_rollback({
    workerName: "my-worker",
    versionId: "your_version_id"
})
```

### Wrangler Config

```javascript
// Get current wrangler configuration
wrangler_get_config()

// Update wrangler configuration
wrangler_update_config({
    config: {
        name: "my-worker",
        main: "src/index.ts",
        compatibility_date: "2024-03-11",
        workers_dev: true
    }
})
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
