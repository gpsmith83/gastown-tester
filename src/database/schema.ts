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
  githubIssueUrl: varchar('github_issue_url', { length: 512 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
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

// Define relationships
export const usersRelations = relations(users, ({ many }) => ({
  ownedWorkspaces: many(workspaces),
  workspaceMemberships: many(workspaceMembers),
  authoredRequirements: many(requirements),
  authoredTickets: many(tickets),
  assignedTickets: many(tickets),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, {
    fields: [workspaces.ownerId],
    references: [users.id],
  }),
  projects: many(projects),
  members: many(workspaceMembers),
}));

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMembers.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [workspaceMembers.userId],
    references: [users.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [projects.workspaceId],
    references: [workspaces.id],
  }),
  requirements: many(requirements),
  tickets: many(tickets),
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

export const ticketsRelations = relations(tickets, ({ one }) => ({
  project: one(projects, {
    fields: [tickets.projectId],
    references: [projects.id],
  }),
  author: one(users, {
    fields: [tickets.authorId],
    references: [users.id],
  }),
  assignee: one(users, {
    fields: [tickets.assigneeId],
    references: [users.id],
  }),
}));

// Export all tables for migrations
export const schema = {
  users,
  workspaces,
  workspaceMembers,
  projects,
  requirements,
  tickets,
  usersRelations,
  workspacesRelations,
  workspaceMembersRelations,
  projectsRelations,
  requirementsRelations,
  ticketsRelations,
};