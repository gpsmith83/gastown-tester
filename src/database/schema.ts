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
  githubIssueUrl: varchar('github_issue_url', { length: 512 }),
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
  lastModified: timestamp('last_modified').notNull(),
  ingestedAt: timestamp('ingested_at').notNull().defaultNow(),
  ingestionMetadata: jsonb('ingestion_metadata').notNull(),
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
  changeMetadata: jsonb('change_metadata'),
  detectedAt: timestamp('detected_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Define relationships
export const usersRelations = relations(users, ({ many }) => ({
  ownedWorkspaces: many(workspaces),
  authoredRequirements: many(requirements),
  authoredTicketCandidates: many(ticketCandidates),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, {
    fields: [workspaces.ownerId],
    references: [users.id],
  }),
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [projects.workspaceId],
    references: [workspaces.id],
  }),
  requirements: many(requirements),
  contextSnapshots: many(contextSnapshots),
}));

export const requirementsRelations = relations(requirements, ({ one, many }) => ({
  project: one(projects, {
    fields: [requirements.projectId],
    references: [projects.id],
  }),
  author: one(users, {
    fields: [requirements.authorId],
    references: [users.id],
  }),
  ticketCandidates: many(ticketCandidates),
}));

export const ticketCandidatesRelations = relations(ticketCandidates, ({ one }) => ({
  requirement: one(requirements, {
    fields: [ticketCandidates.requirementId],
    references: [requirements.id],
  }),
  author: one(users, {
    fields: [ticketCandidates.authorId],
    references: [users.id],
  }),
}));

export const contextSnapshotsRelations = relations(contextSnapshots, ({ one, many }) => ({
  project: one(projects, {
    fields: [contextSnapshots.projectId],
    references: [projects.id],
  }),
  changes: many(contextChanges),
}));

export const contextChangesRelations = relations(contextChanges, ({ one }) => ({
  snapshot: one(contextSnapshots, {
    fields: [contextChanges.snapshotId],
    references: [contextSnapshots.id],
  }),
  project: one(projects, {
    fields: [contextChanges.projectId],
    references: [projects.id],
  }),
}));

// Export all tables for migrations
export const schema = {
  users,
  workspaces,
  projects,
  requirements,
  contextSnapshots,
  contextChanges,
  usersRelations,
  workspacesRelations,
  projectsRelations,
  requirementsRelations,
  contextSnapshotsRelations,
  contextChangesRelations,
};