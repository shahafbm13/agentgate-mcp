import type { AppConfig } from "../config/index.js";
import type { AuthContext } from "../auth/jwt-validator.js";
import { canReadUserProfile } from "../auth/rbac.js";
import { ForbiddenError, NotFoundError, ConflictError } from "../domain/errors.js";
import type {
  CheckPermissionInputSchema,
  CreateAccessRequestInputSchema,
  GetAuditEventsInputSchema,
  ListApplicationsInputSchema,
} from "../domain/schemas.js";
import type { z } from "zod";
import {
  UserRepository,
  ApplicationRepository,
  AccessPolicyRepository,
  AccessRequestRepository,
  AuditRepository,
  DocumentationRepository,
} from "../repositories/index.js";
import type { Logger } from "../infra/logger.js";

const PERMISSION_RANK = { read: 1, write: 2, admin: 3 } as const;

export class UserService {
  constructor(private readonly users = new UserRepository()) {}

  async getUser(
    auth: AuthContext,
    input: { userId?: string; email?: string },
  ) {
    const user = input.userId
      ? await this.users.findById(input.userId)
      : input.email
        ? await this.users.findByEmail(input.email)
        : null;

    if (!user) throw new NotFoundError("User", input.userId ?? input.email);

    const role = auth.roles[0] ?? "readonly";
    if (!canReadUserProfile(role, auth.sub, user.id)) {
      throw new ForbiddenError("You can only read your own profile");
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      department: user.department,
      createdAt: user.createdAt.toISOString(),
    };
  }
}

export class ApplicationService {
  constructor(private readonly apps = new ApplicationRepository()) {}

  async listApplications(input: z.infer<typeof ListApplicationsInputSchema>) {
    const rows = await this.apps.list(input);
    return rows.map((a) => ({
      id: a.id,
      slug: a.slug,
      name: a.name,
      description: a.description,
      ownerTeam: a.ownerTeam,
      sensitivity: a.sensitivity,
    }));
  }

  async getMetadata(applicationId: string) {
    const app = await this.apps.findById(applicationId);
    if (!app) throw new NotFoundError("Application", applicationId);
    return {
      id: app.id,
      slug: app.slug,
      name: app.name,
      description: app.description,
      ownerTeam: app.ownerTeam,
      sensitivity: app.sensitivity,
      createdAt: app.createdAt.toISOString(),
    };
  }
}

export class PermissionService {
  constructor(
    private readonly policies = new AccessPolicyRepository(),
    private readonly apps = new ApplicationRepository(),
    private readonly users = new UserRepository(),
  ) {}

  async checkPermission(input: z.infer<typeof CheckPermissionInputSchema>) {
    const user = await this.users.findById(input.userId);
    if (!user) throw new NotFoundError("User", input.userId);

    const app = await this.apps.findById(input.applicationId);
    if (!app) throw new NotFoundError("Application", input.applicationId);

    const policy = await this.policies.findByUserAndApp(input.userId, input.applicationId);

    if (!policy) {
      return {
        allowed: false,
        userId: input.userId,
        applicationId: input.applicationId,
        applicationName: app.name,
        action: input.action,
        reason: "No access policy found",
      };
    }

    if (policy.expiresAt && policy.expiresAt < new Date()) {
      return {
        allowed: false,
        userId: input.userId,
        applicationId: input.applicationId,
        applicationName: app.name,
        action: input.action,
        reason: "Access policy expired",
      };
    }

    const allowed = PERMISSION_RANK[policy.permission] >= PERMISSION_RANK[input.action];
    return {
      allowed,
      userId: input.userId,
      applicationId: input.applicationId,
      applicationName: app.name,
      action: input.action,
      grantedPermission: policy.permission,
      reason: allowed ? "Policy grants sufficient permission" : "Policy permission insufficient",
    };
  }

  async getPoliciesForApp(applicationId: string) {
    const app = await this.apps.findById(applicationId);
    if (!app) throw new NotFoundError("Application", applicationId);

    const policies = await this.policies.listByApplication(applicationId);
    return {
      applicationId,
      applicationName: app.name,
      policies: policies.map((p) => ({
        id: p.id,
        userId: p.userId,
        permission: p.permission,
        grantedAt: p.grantedAt.toISOString(),
        expiresAt: p.expiresAt?.toISOString() ?? null,
      })),
    };
  }
}

export class AccessRequestService {
  constructor(
    private readonly requests = new AccessRequestRepository(),
    private readonly policies = new AccessPolicyRepository(),
    private readonly apps = new ApplicationRepository(),
    private readonly audit = new AuditRepository(),
    private readonly config: AppConfig,
    private readonly logger: Logger,
  ) {}

  async createRequest(
    auth: AuthContext,
    input: z.infer<typeof CreateAccessRequestInputSchema>,
  ) {
    const app = await this.apps.findById(input.applicationId);
    if (!app) throw new NotFoundError("Application", input.applicationId);

    const existing = await this.policies.findByUserAndApp(auth.sub, input.applicationId);
    if (existing) {
      const rank = PERMISSION_RANK[existing.permission];
      const requested = PERMISSION_RANK[input.requestedPermission];
      if (rank >= requested && (!existing.expiresAt || existing.expiresAt > new Date())) {
        throw new ConflictError("User already has sufficient access to this application");
      }
    }

    const request = await this.requests.create({
      userId: auth.sub,
      applicationId: input.applicationId,
      requestedPermission: input.requestedPermission,
      reason: input.reason,
      durationHours: input.durationHours,
    });

    await this.audit.create({
      actorUserId: auth.sub,
      actorEmail: auth.email ?? null,
      action: "access_request.created",
      resourceType: "access_request",
      resourceId: request.id,
      metadata: {
        applicationId: input.applicationId,
        requestedPermission: input.requestedPermission,
        durationHours: input.durationHours,
      },
    });

    let notificationResult: { deliveryId?: string; status: string } = { status: "skipped" };
    try {
      const response = await fetch(`${this.config.NOTIFICATION_API_URL}/notify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": this.config.NOTIFICATION_API_KEY,
        },
        body: JSON.stringify({
          type: "access_request",
          requestId: request.id,
          userId: auth.sub,
          userEmail: auth.email,
          applicationName: app.name,
          reason: input.reason,
        }),
      });
      if (response.ok) {
        const body = await response.json() as { deliveryId?: string };
        notificationResult = { ...body, status: "sent" };
      } else {
        notificationResult = { status: "failed" };
        this.logger.warn({ status: response.status }, "Notification API call failed");
      }
    } catch (err) {
      this.logger.warn({ err }, "Notification API unreachable");
      notificationResult = { status: "unreachable" };
    }

    return {
      id: request.id,
      status: request.status,
      applicationId: request.applicationId,
      applicationName: app.name,
      requestedPermission: request.requestedPermission,
      reason: request.reason,
      durationHours: input.durationHours,
      createdAt: request.createdAt.toISOString(),
      notification: notificationResult,
    };
  }
}

export class AuditService {
  constructor(private readonly audit = new AuditRepository()) {}

  async getRecentEvents(input: z.infer<typeof GetAuditEventsInputSchema>) {
    const rows = await this.audit.list(input);
    return rows.map((e) => ({
      id: e.id,
      actorUserId: e.actorUserId,
      actorEmail: e.actorEmail,
      action: e.action,
      resourceType: e.resourceType,
      resourceId: e.resourceId,
      metadata: e.metadata,
      createdAt: e.createdAt.toISOString(),
    }));
  }
}

export class DocumentationSearchService {
  constructor(private readonly docs = new DocumentationRepository()) {}

  async search(input: { query: string; limit: number }) {
    const results = await this.docs.search(input.query, input.limit);
    return {
      query: input.query,
      results: results.map((r) => ({
        slug: r.slug,
        title: r.title,
        category: r.category,
        snippet: r.snippet,
      })),
    };
  }

  async getIndex() {
    const articles = await this.docs.listAll();
    return { articles, count: articles.length };
  }
}

export function createServices(config: AppConfig, logger: Logger) {
  return {
    users: new UserService(),
    applications: new ApplicationService(),
    permissions: new PermissionService(),
    accessRequests: new AccessRequestService(
      undefined,
      undefined,
      undefined,
      undefined,
      config,
      logger,
    ),
    audit: new AuditService(),
    documentation: new DocumentationSearchService(),
  };
}

export type Services = ReturnType<typeof createServices>;
