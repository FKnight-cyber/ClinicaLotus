---
description: "Use when: changing React/Next.js pages, admin screens, fetch flows, filters, pagination controls, cache, loading states, forms, or frontend data UX."
applyTo: "apps/web/src/**/*.{ts,tsx,css}"
---
# Web Data Loading And UX Pattern

- Do not fetch large lists only to filter or paginate on the client. Prefer backend query params for `limit`, `search`, status, and other filters.
- Use conservative defaults for admin list sizes. Start with `5` records when no specific requirement exists, and expose a clear control when the user can request more, capped at `100`.
- Label list-size controls in user language, such as `Grupos exibidos`, not generic labels like `Quantidade`.
- Cache stable reference data in component refs when it does not need to reload for every interaction, for example permissions or static option lists.
- Cache repeated list results by every input that affects the result, such as `limit + search`. Clear that cache after creates, updates, deletes, or permission changes that can affect the list.
- Debounce text search before calling the API. Use a short delay around `300-400ms` unless the product needs instant server-side search.
- Separate loading states by interaction:
  - initial page loading for first render;
  - list loading for filter, search, or limit changes;
  - button/form loading for create/update actions;
  - inline saving state for auto-save interactions.
- Keep the current content visible during list refreshes when possible. Add an inline loading indicator and disable only the affected list/actions instead of blanking the page.
- For optimistic updates, update local state immediately, show a saving state, and revert or show an error message if the request fails.
- Avoid refetching unrelated data after a narrow interaction. For example, changing a list filter should not refetch permissions if permissions are already cached.
- Keep UI controls accessible: disabled states during saving, clear loading text, and counters like `X de Y registros`.
- Validate with focused checks after frontend changes: `npm.cmd run typecheck`, focused `npx.cmd eslint <changed files>`, and a browser read/screenshot for visual state when applicable.
