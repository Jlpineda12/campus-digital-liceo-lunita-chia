CREATE TYPE "public"."attendance_status" AS ENUM('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');--> statement-breakpoint
CREATE TYPE "public"."certificate_type" AS ENUM('CONSTANCIA_ESTUDIO', 'CERTIFICADO_NOTAS', 'PAZ_Y_SALVO');--> statement-breakpoint
CREATE TYPE "public"."circular_scope" AS ENUM('ALL', 'LEVEL', 'GRADE', 'GROUP');--> statement-breakpoint
CREATE TYPE "public"."excuse_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."observer_category" AS ENUM('PRAISE', 'ACADEMIC', 'TYPE_I', 'TYPE_II', 'TYPE_III');--> statement-breakpoint
CREATE TYPE "public"."performance_level" AS ENUM('SUPERIOR', 'ALTO', 'BASICO', 'BAJO');--> statement-breakpoint
CREATE TYPE "public"."qualitative_level" AS ENUM('ALCANZADO', 'EN_PROCESO', 'REQUIERE_ACOMPANAMIENTO');--> statement-breakpoint
CREATE TYPE "public"."siee_dimension" AS ENUM('SABER', 'HACER', 'SER', 'QUALITATIVE');--> statement-breakpoint
CREATE TABLE "attendance_excuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"guardian_id" uuid,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"reason_type" text NOT NULL,
	"description" text,
	"attachment_key" text,
	"status" "excuse_status" DEFAULT 'PENDING' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"course_assignment_id" uuid,
	"date" date NOT NULL,
	"status" "attendance_status" NOT NULL,
	"notes" text,
	"recorded_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "certificate_type" NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"verification_code" text NOT NULL,
	"storage_key" text,
	"issued_by" uuid,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "certificates_verification_code_unique" UNIQUE("verification_code")
);
--> statement-breakpoint
CREATE TABLE "circular_reads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"circular_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "circulars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body_sanitized" text NOT NULL,
	"target_scope" "circular_scope" DEFAULT 'ALL' NOT NULL,
	"target_level_id" uuid,
	"target_grade_id" uuid,
	"target_group_id" uuid,
	"author_id" uuid,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "observer_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"period_id" uuid,
	"author_id" uuid,
	"category" "observer_category" NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"student_statement" text,
	"student_statement_at" timestamp with time zone,
	"commitment" text,
	"guardian_acknowledged_at" timestamp with time zone,
	"guardian_acknowledged_by" uuid,
	"guardian_comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "period_unlock_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_id" uuid NOT NULL,
	"course_assignment_id" uuid,
	"reason" text NOT NULL,
	"opened_by" uuid,
	"opens_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "report_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"verification_code" text NOT NULL,
	"average_score" numeric(2, 1),
	"performance_level" "performance_level",
	"director_observations" text,
	"storage_key" text,
	"is_stale" boolean DEFAULT false NOT NULL,
	"issued_at" timestamp with time zone,
	CONSTRAINT "report_cards_verification_code_unique" UNIQUE("verification_code")
);
--> statement-breakpoint
CREATE TABLE "siee_competencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_assignment_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"dimension" "siee_dimension" NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"weight_percent" numeric(5, 2) NOT NULL,
	"display_order" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "siee_grade_columns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_assignment_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"competency_id" uuid NOT NULL,
	"title" text NOT NULL,
	"weight_percent" numeric(5, 2) NOT NULL,
	"linked_activity_id" uuid,
	"is_published" boolean DEFAULT true NOT NULL,
	"display_order" smallint DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "siee_grade_columns_linked_activity_id_unique" UNIQUE("linked_activity_id")
);
--> statement-breakpoint
CREATE TABLE "student_grades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"column_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"numeric_score" numeric(2, 1),
	"qualitative_level" "qualitative_level",
	"performance_level" "performance_level",
	"feedback" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendance_excuses" ADD CONSTRAINT "attendance_excuses_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_excuses" ADD CONSTRAINT "attendance_excuses_guardian_id_users_id_fk" FOREIGN KEY ("guardian_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_excuses" ADD CONSTRAINT "attendance_excuses_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_course_assignment_id_course_assignments_id_fk" FOREIGN KEY ("course_assignment_id") REFERENCES "public"."course_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circular_reads" ADD CONSTRAINT "circular_reads_circular_id_circulars_id_fk" FOREIGN KEY ("circular_id") REFERENCES "public"."circulars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circular_reads" ADD CONSTRAINT "circular_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circulars" ADD CONSTRAINT "circulars_target_level_id_levels_id_fk" FOREIGN KEY ("target_level_id") REFERENCES "public"."levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circulars" ADD CONSTRAINT "circulars_target_grade_id_grades_id_fk" FOREIGN KEY ("target_grade_id") REFERENCES "public"."grades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circulars" ADD CONSTRAINT "circulars_target_group_id_groups_id_fk" FOREIGN KEY ("target_group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circulars" ADD CONSTRAINT "circulars_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observer_records" ADD CONSTRAINT "observer_records_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observer_records" ADD CONSTRAINT "observer_records_period_id_academic_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."academic_periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observer_records" ADD CONSTRAINT "observer_records_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observer_records" ADD CONSTRAINT "observer_records_guardian_acknowledged_by_users_id_fk" FOREIGN KEY ("guardian_acknowledged_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_unlock_windows" ADD CONSTRAINT "period_unlock_windows_period_id_academic_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."academic_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_unlock_windows" ADD CONSTRAINT "period_unlock_windows_course_assignment_id_course_assignments_id_fk" FOREIGN KEY ("course_assignment_id") REFERENCES "public"."course_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_unlock_windows" ADD CONSTRAINT "period_unlock_windows_opened_by_users_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_period_id_academic_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."academic_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "siee_competencies" ADD CONSTRAINT "siee_competencies_course_assignment_id_course_assignments_id_fk" FOREIGN KEY ("course_assignment_id") REFERENCES "public"."course_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "siee_competencies" ADD CONSTRAINT "siee_competencies_period_id_academic_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."academic_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "siee_grade_columns" ADD CONSTRAINT "siee_grade_columns_course_assignment_id_course_assignments_id_fk" FOREIGN KEY ("course_assignment_id") REFERENCES "public"."course_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "siee_grade_columns" ADD CONSTRAINT "siee_grade_columns_period_id_academic_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."academic_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "siee_grade_columns" ADD CONSTRAINT "siee_grade_columns_competency_id_siee_competencies_id_fk" FOREIGN KEY ("competency_id") REFERENCES "public"."siee_competencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "siee_grade_columns" ADD CONSTRAINT "siee_grade_columns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_grades" ADD CONSTRAINT "student_grades_column_id_siee_grade_columns_id_fk" FOREIGN KEY ("column_id") REFERENCES "public"."siee_grade_columns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_grades" ADD CONSTRAINT "student_grades_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_grades" ADD CONSTRAINT "student_grades_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attendance_excuses_enrollment_idx" ON "attendance_excuses" USING btree ("enrollment_id","status");--> statement-breakpoint
CREATE INDEX "attendance_excuses_status_idx" ON "attendance_excuses" USING btree ("status","from_date");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_logs_class_uq" ON "attendance_logs" USING btree ("enrollment_id","course_assignment_id","date") WHERE "attendance_logs"."course_assignment_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_logs_day_uq" ON "attendance_logs" USING btree ("enrollment_id","date") WHERE "attendance_logs"."course_assignment_id" is null;--> statement-breakpoint
CREATE INDEX "attendance_logs_date_status_idx" ON "attendance_logs" USING btree ("date","status");--> statement-breakpoint
CREATE INDEX "certificates_enrollment_idx" ON "certificates" USING btree ("enrollment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "circular_reads_uq" ON "circular_reads" USING btree ("circular_id","user_id");--> statement-breakpoint
CREATE INDEX "circulars_published_idx" ON "circulars" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "observer_records_enrollment_idx" ON "observer_records" USING btree ("enrollment_id","created_at");--> statement-breakpoint
CREATE INDEX "observer_records_category_idx" ON "observer_records" USING btree ("category","created_at");--> statement-breakpoint
CREATE INDEX "period_unlock_windows_period_idx" ON "period_unlock_windows" USING btree ("period_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "report_cards_enrollment_period_uq" ON "report_cards" USING btree ("enrollment_id","period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "siee_competencies_course_period_dimension_uq" ON "siee_competencies" USING btree ("course_assignment_id","period_id","dimension");--> statement-breakpoint
CREATE INDEX "siee_grade_columns_course_period_idx" ON "siee_grade_columns" USING btree ("course_assignment_id","period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "student_grades_column_enrollment_uq" ON "student_grades" USING btree ("column_id","enrollment_id");--> statement-breakpoint
CREATE INDEX "student_grades_enrollment_idx" ON "student_grades" USING btree ("enrollment_id");