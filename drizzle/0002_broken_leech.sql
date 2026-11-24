CREATE TYPE "public"."activity_type" AS ENUM('ASSIGNMENT', 'QUIZ', 'FORUM');--> statement-breakpoint
CREATE TYPE "public"."question_type" AS ENUM('SINGLE_CHOICE', 'MULTI_CHOICE', 'TRUE_FALSE', 'SHORT_TEXT');--> statement-breakpoint
CREATE TYPE "public"."resource_type" AS ENUM('PDF', 'VIDEO', 'LINK', 'RICH_TEXT');--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"type" "activity_type" DEFAULT 'ASSIGNMENT' NOT NULL,
	"title" text NOT NULL,
	"instructions_sanitized" text DEFAULT '' NOT NULL,
	"due_date" timestamp with time zone,
	"max_score" numeric(2, 1) DEFAULT 5 NOT NULL,
	"allow_late" boolean DEFAULT true NOT NULL,
	"time_limit_minutes" smallint,
	"max_attempts" smallint DEFAULT 1 NOT NULL,
	"sync_to_siga" boolean DEFAULT false NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_assignment_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"display_order" smallint DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forum_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_assignment_id" uuid NOT NULL,
	"activity_id" uuid,
	"author_id" uuid NOT NULL,
	"parent_id" uuid,
	"body_sanitized" text NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"type" "resource_type" NOT NULL,
	"title" text NOT NULL,
	"content_text_or_url" text DEFAULT '' NOT NULL,
	"storage_key" text,
	"file_size_bytes" integer,
	"display_order" smallint DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"attempt_number" smallint DEFAULT 1 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"answers_json" jsonb,
	"auto_score" numeric(2, 1),
	"manual_score" numeric(2, 1),
	"final_score" numeric(2, 1)
);
--> statement-breakpoint
CREATE TABLE "quiz_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" uuid NOT NULL,
	"question_type" "question_type" NOT NULL,
	"prompt_sanitized" text NOT NULL,
	"options_json" jsonb NOT NULL,
	"correct_answer_json" jsonb NOT NULL,
	"points" numeric(4, 1) DEFAULT 1 NOT NULL,
	"display_order" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"text_response" text DEFAULT '' NOT NULL,
	"reference_url" text,
	"attachment_key" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_late" boolean DEFAULT false NOT NULL,
	"score" numeric(2, 1),
	"rubric_json" jsonb,
	"teacher_feedback" text,
	"graded_by" uuid,
	"graded_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_unit_id_course_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."course_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_units" ADD CONSTRAINT "course_units_course_assignment_id_course_assignments_id_fk" FOREIGN KEY ("course_assignment_id") REFERENCES "public"."course_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_units" ADD CONSTRAINT "course_units_period_id_academic_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."academic_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_course_assignment_id_course_assignments_id_fk" FOREIGN KEY ("course_assignment_id") REFERENCES "public"."course_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_resources" ADD CONSTRAINT "learning_resources_unit_id_course_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."course_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_views" ADD CONSTRAINT "resource_views_resource_id_learning_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."learning_resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_views" ADD CONSTRAINT "resource_views_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_graded_by_users_id_fk" FOREIGN KEY ("graded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_unit_due_idx" ON "activities" USING btree ("unit_id","due_date");--> statement-breakpoint
CREATE INDEX "activities_published_due_idx" ON "activities" USING btree ("is_published","due_date");--> statement-breakpoint
CREATE INDEX "course_units_course_period_idx" ON "course_units" USING btree ("course_assignment_id","period_id","display_order");--> statement-breakpoint
CREATE INDEX "forum_posts_course_created_idx" ON "forum_posts" USING btree ("course_assignment_id","created_at");--> statement-breakpoint
CREATE INDEX "learning_resources_unit_idx" ON "learning_resources" USING btree ("unit_id","display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_attempts_activity_enrollment_num_uq" ON "quiz_attempts" USING btree ("activity_id","enrollment_id","attempt_number");--> statement-breakpoint
CREATE INDEX "quiz_questions_activity_idx" ON "quiz_questions" USING btree ("activity_id","display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_views_resource_enrollment_uq" ON "resource_views" USING btree ("resource_id","enrollment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_activity_enrollment_uq" ON "submissions" USING btree ("activity_id","enrollment_id");--> statement-breakpoint
CREATE INDEX "submissions_enrollment_submitted_idx" ON "submissions" USING btree ("enrollment_id","submitted_at");