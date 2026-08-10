// These scopes are required for Cloudflare auth
export const RequiredScopes = {
	'user:read': 'See your user info such as name, email address, and account memberships.',
	offline_access: 'Grants refresh tokens for long-lived access.',
} as const
