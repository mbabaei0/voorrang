# Wayfinder tracker (local markdown)

No issue tracker is configured, so the map and its tickets live here as markdown files.

- One file per issue: `NNNN-slug.md`. The number is the issue id.
- Frontmatter fields: `id`, `title`, `labels`, `parent` (map id), `status` (`open` | `closed`), `assignee` (the claim; empty = unclaimed), `blocked_by` (list of ids).
- **Blocking**: `blocked_by` is the dependency (no native blocking here). A ticket is unblocked when every id in it is closed.
- **Frontier**: children of the map with `status: open`, empty `assignee`, and all `blocked_by` closed.
- **Resolution**: append a `## Resolution` section to the ticket, set `status: closed`, and add a line to the map's Decisions so far.
- Research findings live in `research/<name>.md`, linked from the ticket.
