/**
 * Folder-path exclusion check. Enforced at the capture layer per
 * Phase 4 deliverable — excluded notes emit zero events, not "filtered on read".
 *
 * Match rules:
 *   - Case-sensitive POSIX prefix match (Obsidian normalises to forward slashes).
 *   - Trailing slash on the configured folder is tolerated.
 *   - Empty entries are ignored.
 *   - notePath === folder also counts (note inside a single-file "folder" edge case).
 */
export function isPathExcluded(
	notePath: string | null,
	excludedFolders: readonly string[],
): boolean {
	if (notePath === null) return false;
	for (const raw of excludedFolders) {
		if (raw === '') continue;
		const folder = raw.endsWith('/') ? raw.slice(0, -1) : raw;
		if (notePath === folder) return true;
		if (notePath.startsWith(folder + '/')) return true;
	}
	return false;
}
