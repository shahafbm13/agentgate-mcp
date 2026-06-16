CREATE TYPE "public"."role" AS ENUM('admin', 'developer', 'auditor', 'readonly');
CREATE TYPE "public"."sensitivity" AS ENUM('public', 'internal', 'confidential', 'restricted');
CREATE TYPE "public"."permission" AS ENUM('read', 'write', 'admin');
CREATE TYPE "public"."request_status" AS ENUM('pending', 'approved', 'denied', 'expired');

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" varchar(255) NOT NULL UNIQUE,
  "display_name" varchar(255) NOT NULL,
  "role" "role" DEFAULT 'developer' NOT NULL,
  "department" varchar(100),
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "applications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" varchar(100) NOT NULL UNIQUE,
  "name" varchar(255) NOT NULL,
  "description" text,
  "owner_team" varchar(100) NOT NULL,
  "sensitivity" "sensitivity" DEFAULT 'internal' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "access_policies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "application_id" uuid NOT NULL REFERENCES "applications"("id") ON DELETE cascade,
  "permission" "permission" DEFAULT 'read' NOT NULL,
  "granted_at" timestamptz DEFAULT now() NOT NULL,
  "expires_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "access_policies_user_app_idx" ON "access_policies" ("user_id", "application_id");

CREATE TABLE IF NOT EXISTS "access_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "application_id" uuid NOT NULL REFERENCES "applications"("id") ON DELETE cascade,
  "requested_permission" "permission" DEFAULT 'read' NOT NULL,
  "reason" text NOT NULL,
  "status" "request_status" DEFAULT 'pending' NOT NULL,
  "duration_hours" varchar(10) DEFAULT '24' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "actor_email" varchar(255),
  "action" varchar(100) NOT NULL,
  "resource_type" varchar(100) NOT NULL,
  "resource_id" varchar(255),
  "metadata" jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "audit_events_created_at_idx" ON "audit_events" ("created_at");
CREATE INDEX IF NOT EXISTS "audit_events_action_idx" ON "audit_events" ("action");

CREATE TABLE IF NOT EXISTS "documentation_articles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" varchar(100) NOT NULL UNIQUE,
  "title" varchar(255) NOT NULL,
  "category" varchar(100) NOT NULL,
  "content" text NOT NULL,
  "search_vector" text,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "documentation_articles_category_idx" ON "documentation_articles" ("category");
