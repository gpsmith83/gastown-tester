import { pgTable, uuid, varchar, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core';
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

// Define relationships
export const usersRelations = relations(users, ({ many }) => ({
  ownedWorkspaces: many(workspaces),
  authoredRequirements: many(requirements),
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
}));

export const requirementsRelations = relations(requirements, ({ one }) => ({
  project: one(projects, {
    fields: [requirements.projectId],
    references: [projects.id],
  }),
  author: one(users, {
    fields: [requirements.authorId],
    references: [users.id],
  }),
}));

// Export all tables for migrations
export const schema = {
  users,
  workspaces,
  projects,
  requirements,
  usersRelations,
  workspacesRelations,
  projectsRelations,
  requirementsRelations,
};