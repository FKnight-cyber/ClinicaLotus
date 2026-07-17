---
description: "Use when: changing NestJS API endpoints, Prisma queries, list endpoints, pagination, search, cache invalidation, or backend data loading."
applyTo: "apps/api/src/**/*.ts"
---
# API Pagination And Cache Pattern

- For list endpoints, prefer database-level pagination/filtering over loading all rows and slicing/filtering in memory.
- Default list limits should be conservative. For admin lists, use `limit=5` by default when no product requirement says otherwise.
- Clamp user-provided limits in the service layer. Do not allow callers to request more than `100` records.
- Return list payloads with explicit metadata: `{ items, total, limit }`. Add `offset` or `page` only when the UI needs true page navigation.
- Keep search in the database query when possible, using Prisma `where` conditions, so search works across the full dataset and not only the currently loaded slice.
- Cache read-heavy reference data and repeated list queries with keys that include every query input that changes the result, such as `limit`, `search`, `status`, or user scope.
- Invalidate cache by prefix after mutations that can affect list results, permissions, auth profile, or user/group relationships.
- Avoid reusing one cache key for multiple query shapes.
- Keep mutation responses fresh by returning the updated entity from the database after writes.
- Validate with the narrowest useful command after backend changes, usually `npm.cmd run typecheck` from `apps/api`.
