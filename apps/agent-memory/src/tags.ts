/**
 * Parse tags from YAML frontmatter at the top of a markdown file.
 *
 * Supports the two tag formats that Obsidian reads natively:
 *
 *   ---
 *   tags: [one, two, three]
 *   ---
 *
 * and
 *
 *   ---
 *   tags:
 *     - one
 *     - two
 *   ---
 *
 * We deliberately do not pull in a full YAML parser here — memory files
 * are plain markdown with a simple tags field, and a handful of lines of
 * regex keep the Worker bundle lean. If frontmatter becomes richer later,
 * swap to a real parser (e.g. js-yaml) behind this same function.
 */

const FRONTMATTER_RE = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/
const MAX_TAGS = 100
const MAX_TAG_LENGTH = 128

/**
 * Normalise a single tag string: trim whitespace, strip surrounding
 * quotes, drop a leading `#` (Obsidian inline-tag style), and lowercase.
 *
 * Returns an empty string for inputs that should be dropped.
 */
function normalizeTag(raw: string): string {
	let tag = raw.trim()
	if (!tag) return ''
	if ((tag.startsWith('"') && tag.endsWith('"')) || (tag.startsWith("'") && tag.endsWith("'"))) {
		tag = tag.slice(1, -1).trim()
	}
	if (tag.startsWith('#')) tag = tag.slice(1).trim()
	return tag.toLowerCase()
}

/**
 * Extract the `tags:` frontmatter field from a file's content.
 *
 * Returns an empty array when:
 *   - there is no frontmatter block
 *   - the frontmatter has no `tags:` key
 *   - the `tags:` value is empty or unparseable
 *
 * The returned array is deduplicated and lowercased for stable indexing.
 * Tag order from the source file is preserved for the first occurrence
 * of each tag.
 */
export function parseTags(content: string): string[] {
	if (!content) return []

	const match = content.match(FRONTMATTER_RE)
	if (!match) return []

	const block = match[1]
	const lines = block.split(/\r?\n/)

	const rawTags: string[] = []
	let inList = false

	for (const line of lines) {
		if (!inList) {
			// Look for the tags key. Accept `tags:` at the start of a line,
			// possibly indented (we only scan top-level keys in practice).
			const inline = line.match(/^\s*tags\s*:\s*(.*)$/)
			if (!inline) continue

			const value = inline[1].trim()

			// Inline array: tags: [a, b, c]
			if (value.startsWith('[') && value.endsWith(']')) {
				const inner = value.slice(1, -1)
				for (const part of inner.split(',')) {
					rawTags.push(part)
				}
				break
			}

			// Block list: tags: followed by `- item` lines
			if (value === '' || value === '|' || value === '>') {
				inList = true
				continue
			}

			// Single scalar: tags: foo (treat as one tag)
			rawTags.push(value)
			break
		}

		// We're inside a block list. Stop at the first line that isn't a
		// `- item` — that signals the end of the tags field.
		const item = line.match(/^\s*-\s*(.*)$/)
		if (!item) break
		rawTags.push(item[1])
	}

	const seen = new Set<string>()
	const out: string[] = []
	for (const raw of rawTags) {
		const tag = normalizeTag(raw)
		if (!tag || tag.length > MAX_TAG_LENGTH || seen.has(tag)) continue
		seen.add(tag)
		out.push(tag)
		if (out.length >= MAX_TAGS) break
	}
	return out
}
