import { z } from 'zod'

import { getCloudflareClient } from '@repo/mcp-common/src/cloudflare-api'
import { getProps } from '@repo/mcp-common/src/get-props'

import type { DNSRecordsMCP } from '../dns-records.app'

const DnsRecordType = z
	.enum(['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA', 'PTR'])
	.describe('DNS record type')

export function registerDnsRecordTools(agent: DNSRecordsMCP) {
	// List DNS records for a zone
	agent.server.tool(
		'dns_records_list',
		'List DNS records for a zone. Returns all records or filters by type and/or name.',
		{
			zone_id: z.string().describe('The zone ID to list DNS records for'),
			type: DnsRecordType.optional().describe('Filter by record type'),
			name: z
				.string()
				.optional()
				.describe('Filter by record name (e.g. "example.com" or "sub.example.com")'),
			content: z.string().optional().describe('Filter by record content/value'),
			page: z.number().min(1).default(1).describe('Page number for pagination'),
			per_page: z.number().min(5).max(100).default(50).describe('Number of records per page'),
		},
		{
			title: 'List DNS records',
			annotations: {
				readOnlyHint: true,
				destructiveHint: false,
			},
		},
		async ({ zone_id, type, name, content, page, per_page }) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const records = await client.dns.records.list({
					zone_id,
					type,
					name: name ? { exact: name } : undefined,
					content: content ? { exact: content } : undefined,
					page,
					per_page,
				})

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								records: records.result,
								result_info: records.result_info,
							}),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error listing DNS records: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	// Get a specific DNS record
	agent.server.tool(
		'dns_record_get',
		'Get details of a specific DNS record by its ID.',
		{
			zone_id: z.string().describe('The zone ID the record belongs to'),
			dns_record_id: z.string().describe('The DNS record ID'),
		},
		{
			title: 'Get DNS record',
			annotations: {
				readOnlyHint: true,
				destructiveHint: false,
			},
		},
		async ({ zone_id, dns_record_id }) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const record = await client.dns.records.get(dns_record_id, { zone_id })

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ record }),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error getting DNS record: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	// Create a DNS record
	agent.server.tool(
		'dns_record_create',
		'Create a new DNS record in a zone. Supports A, AAAA, CNAME, MX, TXT, NS, SRV, CAA, and PTR record types.',
		{
			zone_id: z.string().describe('The zone ID to create the record in'),
			type: DnsRecordType.describe('DNS record type'),
			name: z
				.string()
				.describe('DNS record name (e.g. "example.com", "sub.example.com", or "@" for zone apex)'),
			content: z
				.string()
				.describe(
					'DNS record content (e.g. IP address for A/AAAA, hostname for CNAME, text for TXT)'
				),
			ttl: z
				.number()
				.optional()
				.describe('Time to live in seconds. 1 = automatic. Must be between 60 and 86400.'),
			proxied: z
				.boolean()
				.optional()
				.describe(
					'Whether the record is proxied through Cloudflare (orange cloud). Only applies to A, AAAA, and CNAME records.'
				),
			priority: z
				.number()
				.optional()
				.describe('Required for MX and SRV records. Priority of the record.'),
			comment: z.string().optional().describe('Comment or note about the DNS record'),
		},
		{
			title: 'Create DNS record',
			annotations: {
				readOnlyHint: false,
				destructiveHint: false,
			},
		},
		async ({ zone_id, type, name, content, ttl, proxied, priority, comment }) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)

				const record = await client.dns.records.create({
					zone_id,
					type,
					name,
					content,
					...(ttl !== undefined && { ttl }),
					...(proxied !== undefined && { proxied }),
					...(priority !== undefined && { priority }),
					...(comment !== undefined && { comment }),
				} as Parameters<typeof client.dns.records.create>[0])

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ record }),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error creating DNS record: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	// Update a DNS record (PATCH — only provided fields are changed)
	agent.server.tool(
		'dns_record_update',
		'Update an existing DNS record. Only the provided fields will be changed (PATCH semantics).',
		{
			zone_id: z.string().describe('The zone ID the record belongs to'),
			dns_record_id: z.string().describe('The DNS record ID to update'),
			type: DnsRecordType.optional().describe('DNS record type'),
			name: z.string().optional().describe('DNS record name'),
			content: z.string().optional().describe('DNS record content'),
			ttl: z.number().optional().describe('Time to live in seconds. 1 = automatic.'),
			proxied: z.boolean().optional().describe('Whether the record is proxied through Cloudflare'),
			priority: z.number().optional().describe('Priority for MX and SRV records'),
			comment: z.string().optional().describe('Comment or note about the DNS record'),
		},
		{
			title: 'Update DNS record',
			annotations: {
				readOnlyHint: false,
				destructiveHint: false,
			},
		},
		async ({ zone_id, dns_record_id, type, name, content, ttl, proxied, priority, comment }) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)

				const record = await client.dns.records.edit(dns_record_id, {
					zone_id,
					...(type !== undefined && { type }),
					...(name !== undefined && { name }),
					...(content !== undefined && { content }),
					...(ttl !== undefined && { ttl }),
					...(proxied !== undefined && { proxied }),
					...(priority !== undefined && { priority }),
					...(comment !== undefined && { comment }),
				} as Parameters<typeof client.dns.records.edit>[1])

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ record }),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error updating DNS record: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	// Delete a DNS record
	agent.server.tool(
		'dns_record_delete',
		'Delete a DNS record from a zone.',
		{
			zone_id: z.string().describe('The zone ID the record belongs to'),
			dns_record_id: z.string().describe('The DNS record ID to delete'),
		},
		{
			title: 'Delete DNS record',
			annotations: {
				readOnlyHint: false,
				destructiveHint: true,
			},
		},
		async ({ zone_id, dns_record_id }) => {
			try {
				const props = getProps(agent)
				const client = getCloudflareClient(props.accessToken)
				const result = await client.dns.records.delete(dns_record_id, { zone_id })

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ result }),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error deleting DNS record: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)
}
