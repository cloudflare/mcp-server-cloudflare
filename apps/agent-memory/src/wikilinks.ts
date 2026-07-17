/**
 * Parse Obsidian-style wikilinks out of markdown content.
 *
 * Supports the three shapes Obsidian renders natively:
 *
 *   [[target]]               — plain link
 *   [[target|display text]]  — aliased link (display text ignored here)
 *   ![[target]]              — embed (treated identically for indexing)
 *
 * The `target` portion can include a heading anchor (`[[note#heading]]`)
 * or a block reference (`[[note#^block]]`); we strip those to get the
 * file-level target, since backlinks at the file level are what the
 * index cares about. Obsidian's UI does the same grouping.
 *
 * What this function intentionally does NOT do:
 *
 *   - Resolve the target to a concrete memory path. `[[foo]]` might
 *     live at `memory/foo.md` or `projects/foo.md`; resolution is a
 *     vault-level concern and can't be answered from parsing alone.
 *     We store the raw target string as written; callers can normalise
 *     further if they choose.
 *   - Skip links inside fenced code blocks. Code-fence awareness would
 *     add real parsing complexity; a false positive inside a fence is
 *     cheap (just an extra row in the index), so the simpler regex
 *     approach wins until it stops being cheap.
 *
 * External markdown links like `[text](url)` are explicitly not
 * wikilinks and are not captured.
 */

// Match [[...]] where the inside doesn't contain `[`, `]`, or newlines.
// Forbidding `[` keeps us from greedily bridging across an unterminated
// opening pair — the same behaviour Obsidian has. Leading `!` (embed)
// is optional.
const WIKILINK_RE = /!?\[\[([^[\]\n]+?)\]\]/g
const MAX_LINKS = 1_000
const MAX_TARGET_LENGTH = 1_024

function normalizeTarget(raw: string): string {
	let target = raw.trim()

	// Strip alias: [[foo|display]] → `foo`
	const pipe = target.indexOf('|')
	if (pipe !== -1) target = target.slice(0, pipe).trim()

	// Strip heading / block refs: [[foo#heading]] → `foo`
	const hash = target.indexOf('#')
	if (hash !== -1) target = target.slice(0, hash).trim()

	return target
}

/**
 * Extract wikilink targets from content.
 *
 * Returns unique, non-empty targets in first-occurrence order. Case is
 * preserved — unlike tags, wikilink targets are treated as path-like
 * identifiers and mixing `Foo` vs `foo` can be meaningful on
 * case-sensitive storage.
 */
export function parseWikilinks(content: string): string[] {
	if (!content) return []

	const seen = new Set<string>()
	const out: string[] = []

	WIKILINK_RE.lastIndex = 0
	for (let match = WIKILINK_RE.exec(content); match !== null; match = WIKILINK_RE.exec(content)) {
		const target = normalizeTarget(match[1])
		if (!target || target.length > MAX_TARGET_LENGTH || seen.has(target)) continue
		seen.add(target)
		out.push(target)
		if (out.length >= MAX_LINKS) break
	}

	return out
}
