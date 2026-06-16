import { eq, and, desc, ilike, or, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  users,
  applications,
  accessPolicies,
  accessRequests,
  auditEvents,
  documentationArticles,
} from "../db/schema.js";
import type {
  GetAuditEventsInputSchema,
  ListApplicationsInputSchema,
} from "../domain/schemas.js";
import type { z } from "zod";

export class UserRepository {
  async findById(id: string) {
    const db = getDb();
    const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ?? null;
  }

  async findByEmail(email: string) {
    const db = getDb();
    const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return row ?? null;
  }
}

export class ApplicationRepository {
  async findById(id: string) {
    const db = getDb();
    const [row] = await db.select().from(applications).where(eq(applications.id, id)).limit(1);
    return row ?? null;
  }

  async list(input: z.infer<typeof ListApplicationsInputSchema>) {
    const db = getDb();
    const conditions = input.sensitivity
      ? eq(applications.sensitivity, input.sensitivity)
      : undefined;
    const query = db.select().from(applications).orderBy(applications.name).limit(input.limit);
    if (conditions) {
      return query.where(conditions);
    }
    return query;
  }
}

export class AccessPolicyRepository {
  async findByUserAndApp(userId: string, applicationId: string) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(accessPolicies)
      .where(and(eq(accessPolicies.userId, userId), eq(accessPolicies.applicationId, applicationId)))
      .limit(1);
    return row ?? null;
  }

  async listByApplication(applicationId: string) {
    const db = getDb();
    return db
      .select()
      .from(accessPolicies)
      .where(eq(accessPolicies.applicationId, applicationId));
  }
}

export class AccessRequestRepository {
  async create(data: {
    userId: string;
    applicationId: string;
    requestedPermission: "read" | "write" | "admin";
    reason: string;
    durationHours: number;
  }) {
    const db = getDb();
    const [row] = await db
      .insert(accessRequests)
      .values({
        userId: data.userId,
        applicationId: data.applicationId,
        requestedPermission: data.requestedPermission,
        reason: data.reason,
        durationHours: String(data.durationHours),
        status: "pending",
      })
      .returning();
    return row;
  }
}

export class AuditRepository {
  async create(data: {
    actorUserId?: string | null;
    actorEmail?: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    metadata?: Record<string, unknown> | null;
  }) {
    const db = getDb();
    const [row] = await db
      .insert(auditEvents)
      .values({
        actorUserId: data.actorUserId ?? null,
        actorEmail: data.actorEmail ?? null,
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId ?? null,
        metadata: data.metadata ?? null,
      })
      .returning();
    return row;
  }

  async list(input: z.infer<typeof GetAuditEventsInputSchema>) {
    const db = getDb();
    const conditions = [];
    if (input.action) conditions.push(eq(auditEvents.action, input.action));
    if (input.resourceType) conditions.push(eq(auditEvents.resourceType, input.resourceType));

    const base = db.select().from(auditEvents).orderBy(desc(auditEvents.createdAt)).limit(input.limit);
    if (conditions.length === 1) return base.where(conditions[0]);
    if (conditions.length === 2) return base.where(and(conditions[0], conditions[1]));
    return base;
  }
}

export class DocumentationRepository {
  async search(query: string, limit: number) {
    const db = getDb();
    const pattern = `%${query}%`;
    return db
      .select({
        id: documentationArticles.id,
        slug: documentationArticles.slug,
        title: documentationArticles.title,
        category: documentationArticles.category,
        snippet: sql<string>`LEFT(${documentationArticles.content}, 300)`,
      })
      .from(documentationArticles)
      .where(
        or(
          ilike(documentationArticles.title, pattern),
          ilike(documentationArticles.content, pattern),
          ilike(documentationArticles.category, pattern),
        ),
      )
      .limit(limit);
  }

  async findBySlug(slug: string) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(documentationArticles)
      .where(eq(documentationArticles.slug, slug))
      .limit(1);
    return row ?? null;
  }

  async listAll() {
    const db = getDb();
    return db
      .select({
        slug: documentationArticles.slug,
        title: documentationArticles.title,
        category: documentationArticles.category,
      })
      .from(documentationArticles)
      .orderBy(documentationArticles.category, documentationArticles.title);
  }
}
