// Ensure chalk doesn't add colors to output for consistent snapshots
delete process.env.FORCE_COLOR

// runx uses zx/globals imported in bin/runx.ts
// This import ensures that tests work without
// needing to import this manually.
await import('zx/globals')
