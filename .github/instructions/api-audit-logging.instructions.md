---
description: "Use when: adding or changing backend mutations, audit logs, administrative actions, status changes, permission changes, irreversible records, or future functionality that must be traceable."
applyTo: "apps/api/src/**/*.ts"
---
# API Audit Logging Pattern

- Every backend mutation that changes business data, access data, permissions, statuses, assignments, or administrative configuration must decide explicitly whether it needs an `AuditLog` entry. Prefer logging when the change affects clinical flow, user access, security, permissions, patient visibility, or operational history.
- Audit logs are append-only. Do not create delete endpoints, cleanup jobs, cascade deletes, or UI actions that remove audit records. If retention rules are ever needed, treat them as a product/legal decision, not a routine technical cleanup.
- Use the existing `AuditLog` Prisma model for traceability:
  - `entity`: stable machine-readable domain name, for example `access_user`, `access_group`, `anamnesis_record`, or `patient`.
  - `entityId`: id of the changed record when available.
  - `action`: stable machine-readable action, for example `update_user_status`, `update_group_permissions`, or `finalize_anamnesis`.
  - `beforeData`: JSON string snapshot before the change, or `null` for create actions.
  - `afterData`: JSON string snapshot after the change, or `null` only when there is no resulting entity.
  - `reason`: short Portuguese human-readable summary with the changed target, for example `Status atualizado: Maria Silva`.
  - `userId`: authenticated actor id from `request.user?.id` when the action is user-initiated; use `null` only for system actions.
- Capture the actor in controllers for mutating endpoints by accepting `@Req() request: { user?: AuthenticatedUser }` and passing `request.user?.id` to the service method. Keep audit writes inside the service that performs the mutation so the log and data change stay close together.
- For update mutations, read the previous entity before changing it, perform the mutation, invalidate affected caches, read the fresh entity, then write the audit log with both snapshots. Return the fresh entity from the mutation.
- Store enough related data in snapshots for future UI explanations. For example, include permission descriptions when logging permission changes and group names when logging group assignment changes, so the audit screen can show `Adicionado`/`Removido` details without extra joins later.
- Use action names that describe the exact change, not generic labels. Prefer `update_user_status`, `update_user_groups`, `update_group_permissions`, `create_group`, etc. Avoid vague actions such as `update` or `save`.
- If exposing audit logs in an endpoint, keep it read-only and paginated at the database level. Default to `limit=5`, clamp to max `100`, and include all filters in the cache key such as `limit`, `page`, `search`, `entity`, and `action`.
- Audit list filters should run in the database query, not by loading all logs in memory. Search may match `action`, `reason`, `beforeData`, and `afterData` when those fields are useful for the screen.
- Invalidate audit-log cache after any mutation that writes an audit record, for example `this.cache.deleteByPrefix("access:audit-logs:")` or the matching domain prefix.
- Validate backend audit changes with `npm.cmd run typecheck` from `apps/api`. If Prisma schema or permissions changed, also run the project’s Prisma sync/seed flow in the active environment.