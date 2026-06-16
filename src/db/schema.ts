import { pgTable, uuid, varchar, text, timestamp, pgEnum, index, jsonb } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["admin", "developer", "auditor", "readonly"]);
export const sensitivityEnum = pgEnum("sensitivity", ["public", "internal", "confidential", "restricted"]);
export const permissionEnum = pgEnum("permission", ["read", "write", "admin"]);
export const requestStatusEnum = pgEnum("request_status", ["pending", "approved", "denied", "expired"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  role: roleEnum("role").notNull().default("developer"),
  department: varchar("department", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const applications = pgTable("applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  ownerTeam: varchar("owner_team", { length: 100 }).notNull(),
  sensitivity: sensitivityEnum("sensitivity").notNull().default("internal"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accessPolicies = pgTable(
  "access_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
    permission: permissionEnum("permission").notNull().default("read"),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => [
    index("access_policies_user_app_idx").on(table.userId, table.applicationId),
  ],
);

export const accessRequests = pgTable("access_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  requestedPermission: permissionEnum("requested_permission").notNull().default("read"),
  reason: text("reason").notNull(),
  status: requestStatusEnum("status").notNull().default("pending"),
  durationHours: varchar("duration_hours", { length: 10 }).notNull().default("24"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    actorEmail: varchar("actor_email", { length: 255 }),
    action: varchar("action", { length: 100 }).notNull(),
    resourceType: varchar("resource_type", { length: 100 }).notNull(),
    resourceId: varchar("resource_id", { length: 255 }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_events_created_at_idx").on(table.createdAt),
    index("audit_events_action_idx").on(table.action),
  ],
);

export const documentationArticles = pgTable(
  "documentation_articles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    title: varchar("title", { length: 255 }).notNull(),
    category: varchar("category", { length: 100 }).notNull(),
    content: text("content").notNull(),
    searchVector: text("search_vector"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("documentation_articles_category_idx").on(table.category)],
);
