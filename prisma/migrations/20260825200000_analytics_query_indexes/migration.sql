CREATE INDEX `projects_tenantId_createdAt_idx`
  ON `projects`(`tenantId`, `createdAt`);

CREATE INDEX `generation_jobs_projectId_state_completedAt_idx`
  ON `generation_jobs`(`projectId`, `state`, `completedAt`);

CREATE INDEX `audit_events_projectId_action_createdAt_idx`
  ON `audit_events`(`projectId`, `action`, `createdAt`);

CREATE INDEX `analytics_events_occurredAt_idx`
  ON `analytics_events`(`occurredAt`);
