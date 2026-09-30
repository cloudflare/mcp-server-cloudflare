# MCP Events for real-time issues

Implement webhook subscriptions to `cloudflare.alert.workers_observability_real_time_issue`
using ANS webhook destinations, notification policies and Vega issue automations.
Expose the event only when the authenticated account is eligible for the alert.

## Delivery and retry ownership

ANS is the only delivery queue and retry scheduler. Each incoming ANS webhook makes
one synchronous callback attempt. The bridge acknowledges ANS only after callback
acceptance; network failures, callback timeouts (408), rate limits (429) and server
errors return 503 so ANS schedules the next attempt. Transient authorization-check
failures also return 503 without deactivating the subscription.

Do not persist outgoing events before acknowledging ANS, enqueue background delivery,
or add callback retry loops, backoff timers or delivery alarms. Persist subscription
configuration and managed resource identities only. Subscription expiry and resource
cleanup are lifecycle work, not delivery retries.

## Implemented bridge behavior

- Validated event/subscription schemas and account-eligible catalogue projection.
- Principal-scoped subscription identity, finite TTL and bounded key rotation.
- Signed callback challenge and Standard Webhooks delivery envelope.
- Synchronous ANS-to-callback bridge: acknowledge only after acceptance; translate
  transient errors, including 429, to 503 for existing ANS retry handling.
- Stable event ID/body across retries, fresh signing timestamps, expiry/revocation
  checks, tenant/policy/type binding and a 256 KiB streaming input limit.

This is an implementation foundation, not an enabled feature. No event capabilities,
MCP methods, public callback routes or deployment bindings are registered yet.

## Required before enabling

1. Register `events/list`, `events/subscribe` and `events/unsubscribe` on the existing
   authenticated MCP endpoint and advertise `events: {}` only once all three work.
2. Persist principal-owned subscription state and encrypted callback/ingress secrets.
   Verify callbacks before activation; cache verification by principal and URL with
   a bounded lifetime. Refresh the same subscription and deactivate before cleanup.
3. Under the user's authorised Cloudflare credentials, provision a generic ANS
   destination targeting our bridge, a managed ANS policy and a Vega issue automation.
   Define the issue automation arguments explicitly; do not equate ANS policy filters
   with Vega threshold/inactivity triggers. Reconcile partially completed provisioning.
4. Route ANS callbacks to `forwardAnsWebhook` with the stored subscription. Recheck
   current user access and source the delivery identity from Vega's persisted run ID
   (`alert_correlation_id`). Do not use ANS's resource-valued `event_id` as a unique
   occurrence ID. Require immutable occurrence time/payload across ANS retries.
5. Supply hardened callback egress for both verification and delivery: validate DNS
   at connection time, block non-public addresses, connect to the validated address
   with the original TLS hostname and never follow redirects. `webhookFetch` is an
   injected dependency; passing unguarded global `fetch` is not production-safe.
6. Verify the existing ANS timeout/retry window, backoff and bounded attempts satisfy
   the callback contract. No second delivery queue is required. Expiry, unsubscribe,
   revocation and callback 410 must also clean up managed ANS/Vega resources.

The v1 event is non-replayable: return `cursor: null`. A successful callback response
acknowledges receipt, not completion of an agent investigation or repository change.

Protocol reference: https://developers.openai.com/plugins/build/mcp-events
