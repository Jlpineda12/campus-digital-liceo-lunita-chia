CREATE TYPE "public"."early_bird_status" AS ENUM('NOT_ELIGIBLE', 'ELIGIBLE', 'CONFIRMED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."sibling_claim_status" AS ENUM('NOT_REQUESTED', 'VERIFIED', 'PENDING_REVIEW', 'REJECTED');--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN "early_bird_status" "early_bird_status" DEFAULT 'NOT_ELIGIBLE' NOT NULL;--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN "sibling_claim_status" "sibling_claim_status" DEFAULT 'NOT_REQUESTED' NOT NULL;--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN "sibling_reference_doc" text;--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN "sibling_verification_note" text;--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN "sibling_reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN "sibling_reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN "payment_reported_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_sibling_reviewed_by_users_id_fk" FOREIGN KEY ("sibling_reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Conversión de datos: los descuentos autodeclarados dejan de aplicarse sin verificación.
-- Pronto pago es automático por fecha: toda solicitud vigente radicada hasta el 15-dic-2026 es elegible.
UPDATE "admission_applications" SET "early_bird_status" = 'ELIGIBLE', "estimated_enrollment_cop" = CASE WHEN "has_early_bird_discount" THEN "estimated_enrollment_cop" ELSE "estimated_enrollment_cop" - round("estimated_enrollment_cop" * 0.1)::int END, "has_early_bird_discount" = true WHERE "has_early_bird_discount" = true OR ("status" NOT IN ('ENROLLED', 'REJECTED') AND ("created_at" AT TIME ZONE 'America/Bogota')::date <= DATE '2026-12-15');--> statement-breakpoint
UPDATE "admission_applications" SET "sibling_claim_status" = 'PENDING_REVIEW', "has_sibling_discount" = false, "sibling_verification_note" = 'Descuento autodeclarado antes de la verificación automática: revisar con Secretaría.' WHERE "has_sibling_discount" = true AND "status" <> 'ENROLLED';
