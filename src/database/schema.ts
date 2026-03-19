import { pgTable, uuid, varchar, text, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  avatarUrl: varchar('avatar_url', { length: 512 }),
  githubId: varchar('github_id', { length: 100 }).unique(),
  githubUsername: varchar('github_username', { length: 100 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Workspaces table
export const workspaces = pgTable('workspaces', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  description: text('description'),
  ownerId: uuid('owner_id').notNull().references(() => users.id),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Workspace members table
export const workspaceMembers = pgTable('workspace_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  role: varchar('role', { length: 50 }).notNull().default('member'), // owner, admin, member
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Projects table
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull(),
  description: text('description'),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  githubRepoUrl: varchar('github_repo_url', { length: 512 }),
  githubRepoId: varchar('github_repo_id', { length: 100 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Requirements table
export const requirements = pgTable('requirements', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  authorId: uuid('author_id').notNull().references(() => users.id),
  priority: integer('priority').notNull().default(3), // 1=highest, 5=lowest
  status: varchar('status', { length: 50 }).notNull().default('draft'), // draft, active, completed, archived
  type: varchar('type', { length: 50 }).notNull().default('feature'), // feature, bug, enhancement, epic
  githubIssueNumber: integer('github_issue_number'),
  githubIssueUrl: varchar('github_issue_url', { length: 500 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Ticket Candidates table
export const ticketCandidates = pgTable("ticket_candidates", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  requirementId: uuid("requirement_id").notNull().references(() => requirements.id),
  authorId: uuid("author_id").notNull().references(() => users.id),
  priority: integer("priority").notNull().default(3),
  status: varchar("status", { length: 50 }).notNull().default("draft"),
  orderIndex: integer("order_index").notNull().default(0),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Tickets table
export const tickets = pgTable('tickets', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  assigneeId: uuid('assignee_id').references(() => users.id),
  authorId: uuid('author_id').notNull().references(() => users.id),
  priority: integer('priority').notNull().default(3), // 1=highest, 5=lowest
  status: varchar('status', { length: 50 }).notNull().default('open'), // open, in_progress, completed, closed, cancelled
  type: varchar('type', { length: 50 }).notNull().default('task'), // bug, feature, task, enhancement
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Context snapshots table for B-601: Repository context models and analysis
export const contextSnapshots = pgTable('context_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  sourceFilePath: varchar('source_file_path', { length: 1000 }).notNull(),
  sourceTypeId: varchar('source_type_id', { length: 100 }).notNull(),
  contentText: text('content_text').notNull(),
  contentHash: varchar('content_hash', { length: 64 }).notNull(),
  fileSize: integer('file_size').notNull(),
  lastModifiedAt: timestamp('last_modified_at').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Context changes table for tracking context evolution over time
export const contextChanges = pgTable('context_changes', {
  id: uuid('id').defaultRandom().primaryKey(),
  snapshotId: uuid('snapshot_id').notNull().references(() => contextSnapshots.id),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  changeType: varchar('change_type', { length: 50 }).notNull(), // 'created', 'updated', 'deleted'
  previousHash: varchar('previous_hash', { length: 64 }),
  newHash: varchar('new_hash', { length: 64 }),
  diffMetadata: jsonb('diff_metadata'), // Store diff information as JSON
  changeDescription: text('change_description'),
  authorId: uuid('author_id').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Context analysis results table for repository insights
export const contextAnalysisResults = pgTable('context_analysis_results', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  analysisType: varchar('analysis_type', { length: 100 }).notNull(),
  analysisVersion: varchar('analysis_version', { length: 50 }).notNull().default('1.0'),
  resultData: jsonb('result_data').notNull(),
  confidence: integer('confidence').notNull().default(80), // 0-100
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Jobs table
export const jobs = pgTable('jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobType: varchar('job_type', { length: 100 }).notNull(),
  projectId: uuid('project_id').references(() => projects.id),
  userId: uuid('user_id').references(() => users.id),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  payload: jsonb('payload').notNull(),
  result: jsonb('result'),
  error: text('error'),
  priority: integer('priority').notNull().default(5),
  maxRetries: integer('max_retries').notNull().default(3),
  retryCount: integer('retry_count').notNull().default(0),
  retryDelayMs: integer('retry_delay_ms').notNull().default(5000),
  scheduledFor: timestamp('scheduled_for'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Linear connections table
export const linearConnections = pgTable('linear_connections', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  apiToken: varchar('api_token', { length: 255 }).notNull(), // encrypted
  workspaceId: varchar('workspace_id', { length: 100 }).notNull(),
  teamId: varchar('team_id', { length: 100 }).notNull(),
  boardId: varchar('board_id', { length: 100 }),
  projectIdLinear: varchar('project_id_linear', { length: 100 }),
  isActive: boolean('is_active').notNull().default(true),
  lastSyncAt: timestamp('last_sync_at'),
  syncStatus: varchar('sync_status', { length: 50 }).default('pending'),
  syncError: text('sync_error'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Linear issues table
export const linearIssues = pgTable('linear_issues', {
  id: uuid('id').defaultRandom().primaryKey(),
  linearIssueId: varchar('linear_issue_id', { length: 100 }).notNull().unique(),
  linearConnectionId: uuid('linear_connection_id').notNull().references(() => linearConnections.id),
  ticketCandidateId: uuid('ticket_candidate_id').references(() => ticketCandidates.id),
  requirementId: uuid('requirement_id').references(() => requirements.id),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 100 }).notNull(),
  priority: integer('priority').notNull(),
  assigneeId: varchar('assignee_id', { length: 100 }),
  assigneeName: varchar('assignee_name', { length: 255 }),
  labels: jsonb('labels').notNull().default('[]'),
  syncedAt: timestamp('synced_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Define relations
export const userRelations = relations(users, ({ many }) => ({
  ownedWorkspaces: many(workspaces),
  workspaceMemberships: many(workspaceMembers),
  requirements: many(requirements),
  jobs: many(jobs),
}));

export const workspaceRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, { fields: [workspaces.ownerId], references: [users.id] }),
  members: many(workspaceMembers),
  projects: many(projects),
}));

export const workspaceMemberRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, { fields: [workspaceMembers.workspaceId], references: [workspaces.id] }),
  user: one(users, { fields: [workspaceMembers.userId], references: [users.id] }),
}));

export const projectRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [projects.workspaceId], references: [workspaces.id] }),
  requirements: many(requirements),
  tickets: many(tickets),
  jobs: many(jobs),
  contextSnapshots: many(contextSnapshots),
  contextAnalysisResults: many(contextAnalysisResults),
  linearConnections: many(linearConnections),
}));

export const requirementRelations = relations(requirements, ({ one, many }) => ({
  project: one(projects, { fields: [requirements.projectId], references: [projects.id] }),
  author: one(users, { fields: [requirements.authorId], references: [users.id] }),
  ticketCandidates: many(ticketCandidates),
  linearIssues: many(linearIssues),
}));

export const ticketCandidateRelations = relations(ticketCandidates, ({ one, many }) => ({
  requirement: one(requirements, { fields: [ticketCandidates.requirementId], references: [requirements.id] }),
  author: one(users, { fields: [ticketCandidates.authorId], references: [users.id] }),
  linearIssues: many(linearIssues),
}));

export const ticketRelations = relations(tickets, ({ one }) => ({
  project: one(projects, { fields: [tickets.projectId], references: [projects.id] }),
  assignee: one(users, { fields: [tickets.assigneeId], references: [users.id] }),
  author: one(users, { fields: [tickets.authorId], references: [users.id] }),
}));

export const contextSnapshotRelations = relations(contextSnapshots, ({ one, many }) => ({
  project: one(projects, { fields: [contextSnapshots.projectId], references: [projects.id] }),
  changes: many(contextChanges),
}));

export const contextChangeRelations = relations(contextChanges, ({ one }) => ({
  snapshot: one(contextSnapshots, { fields: [contextChanges.snapshotId], references: [contextSnapshots.id] }),
  project: one(projects, { fields: [contextChanges.projectId], references: [projects.id] }),
  author: one(users, { fields: [contextChanges.authorId], references: [users.id] }),
}));

export const contextAnalysisResultRelations = relations(contextAnalysisResults, ({ one }) => ({
  project: one(projects, { fields: [contextAnalysisResults.projectId], references: [projects.id] }),
}));

export const jobRelations = relations(jobs, ({ one }) => ({
  project: one(projects, { fields: [jobs.projectId], references: [projects.id] }),
  user: one(users, { fields: [jobs.userId], references: [users.id] }),
}));

export const linearConnectionRelations = relations(linearConnections, ({ one, many }) => ({
  project: one(projects, { fields: [linearConnections.projectId], references: [projects.id] }),
  issues: many(linearIssues),
}));

export const linearIssueRelations = relations(linearIssues, ({ one }) => ({
  connection: one(linearConnections, { fields: [linearIssues.linearConnectionId], references: [linearConnections.id] }),
  ticketCandidate: one(ticketCandidates, { fields: [linearIssues.ticketCandidateId], references: [ticketCandidates.id] }),
  requirement: one(requirements, { fields: [linearIssues.requirementId], references: [requirements.id] }),
}));