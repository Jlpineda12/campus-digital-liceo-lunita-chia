CREATE TYPE "public"."admission_doc_status" AS ENUM('PENDING', 'UPLOADED', 'APPROVED', 'RESUBMIT');--> statement-breakpoint
CREATE TYPE "public"."admission_status" AS ENUM('SUBMITTED', 'DOCS_REVIEW', 'ACADEMIC_APPROVED', 'PAYMENT_REVIEW', 'ENROLLED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."billing_charge_status" AS ENUM('PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'WAIVED');--> statement-breakpoint
CREATE TYPE "public"."billing_charge_type" AS ENUM('ENROLLMENT_FEE', 'TUITION', 'TRANSPORT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."payment_channel" AS ENUM('NEQUI', 'DAVIPLATA', 'BRE_B', 'PSE', 'BANK_TRANSFER', 'CASH_OFFICE');--> statement-breakpoint
CREATE TABLE "admission_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tracking_code" text NOT NULL,
	"target_year" smallint DEFAULT 2027 NOT NULL,
	"application_type" "enrollment_type" NOT NULL,
	"status" "admission_status" DEFAULT 'SUBMITTED' NOT NULL,
	"target_grade_id" uuid NOT NULL,
	"existing_student_id" uuid,
	"existing_guardian_id" uuid,
	"student_first_name" text NOT NULL,
	"student_last_name" text NOT NULL,
	"student_doc_type" "document_type" NOT NULL,
	"student_doc_number" text NOT NULL,
	"student_birth_date" date,
	"student_eps" text DEFAULT '' NOT NULL,
	"student_blood_type" text DEFAULT '' NOT NULL,
	"previous_school" text DEFAULT '' NOT NULL,
	"guardian_first_name" text NOT NULL,
	"guardian_last_name" text NOT NULL,
	"guardian_doc_type" "document_type" NOT NULL,
	"guardian_doc_number" text NOT NULL,
	"guardian_email" text NOT NULL,
	"guardian_phone" text NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"has_sibling_discount" boolean DEFAULT false NOT NULL,
	"has_early_bird_discount" boolean DEFAULT false NOT NULL,
	"estimated_enrollment_cop" integer DEFAULT 0 NOT NULL,
	"estimated_monthly_cop" integer DEFAULT 0 NOT NULL,
	"habeas_data_accepted_at" timestamp with time zone NOT NULL,
	"habeas_data_ip" text,
	"habeas_data_version" text DEFAULT '2026-v1' NOT NULL,
	"payment_channel" "payment_channel",
	"payment_reference" text,
	"payment_receipt_key" text,
	"payment_verified_at" timestamp with time zone,
	"academic_reviewed_by" uuid,
	"academic_reviewed_at" timestamp with time zone,
	"review_notes" text DEFAULT '' NOT NULL,
	"assigned_group_id" uuid,
	"formalized_enrollment_id" uuid,
	"formalized_by" uuid,
	"formalized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admission_applications_tracking_code_unique" UNIQUE("tracking_code")
);
--> statement-breakpoint
CREATE TABLE "billing_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"charge_type" "billing_charge_type" NOT NULL,
	"billing_month" smallint DEFAULT 0 NOT NULL,
	"concept" text NOT NULL,
	"amount_cop" integer NOT NULL,
	"discount_cop" integer DEFAULT 0 NOT NULL,
	"paid_cop" integer DEFAULT 0 NOT NULL,
	"due_date" date NOT NULL,
	"status" "billing_charge_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"charge_id" uuid NOT NULL,
	"amount_cop" integer NOT NULL,
	"channel" "payment_channel" NOT NULL,
	"reference_code" text NOT NULL,
	"receipt_number" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"recorded_by" uuid,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_payments_receipt_number_unique" UNIQUE("receipt_number")
);
--> statement-breakpoint
CREATE TABLE "enrollment_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"doc_key" text NOT NULL,
	"status" "admission_doc_status" DEFAULT 'PENDING' NOT NULL,
	"storage_key" text,
	"original_file_name" text,
	"file_size_bytes" integer,
	"review_note" text DEFAULT '' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"uploaded_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_target_grade_id_grades_id_fk" FOREIGN KEY ("target_grade_id") REFERENCES "public"."grades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_existing_student_id_users_id_fk" FOREIGN KEY ("existing_student_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_existing_guardian_id_users_id_fk" FOREIGN KEY ("existing_guardian_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_academic_reviewed_by_users_id_fk" FOREIGN KEY ("academic_reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_assigned_group_id_groups_id_fk" FOREIGN KEY ("assigned_group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_formalized_enrollment_id_enrollments_id_fk" FOREIGN KEY ("formalized_enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_formalized_by_users_id_fk" FOREIGN KEY ("formalized_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_charges" ADD CONSTRAINT "billing_charges_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_charges" ADD CONSTRAINT "billing_charges_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_charge_id_billing_charges_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."billing_charges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_documents" ADD CONSTRAINT "enrollment_documents_application_id_admission_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."admission_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_documents" ADD CONSTRAINT "enrollment_documents_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admission_applications_status_idx" ON "admission_applications" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "admission_applications_guardian_doc_idx" ON "admission_applications" USING btree ("guardian_doc_number");--> statement-breakpoint
CREATE INDEX "admission_applications_student_doc_idx" ON "admission_applications" USING btree ("student_doc_number");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_charges_enrollment_concept_uq" ON "billing_charges" USING btree ("enrollment_id","charge_type","billing_month");--> statement-breakpoint
CREATE INDEX "billing_charges_year_status_idx" ON "billing_charges" USING btree ("academic_year_id","status");--> statement-breakpoint
CREATE INDEX "billing_charges_enrollment_idx" ON "billing_charges" USING btree ("enrollment_id","due_date");--> statement-breakpoint
CREATE INDEX "billing_payments_charge_idx" ON "billing_payments" USING btree ("charge_id","paid_at");--> statement-breakpoint
CREATE UNIQUE INDEX "enrollment_documents_app_key_uq" ON "enrollment_documents" USING btree ("application_id","doc_key");