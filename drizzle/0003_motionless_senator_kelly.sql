CREATE TABLE "course_themes" (
	"course_assignment_id" uuid PRIMARY KEY NOT NULL,
	"banner_preset" text DEFAULT 'constellation' NOT NULL,
	"accent_tone" text DEFAULT 'cobalt' NOT NULL,
	"icon_key" text DEFAULT 'book' NOT NULL,
	"layout_style" text DEFAULT 'cards' NOT NULL,
	"welcome_message" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "course_themes" ADD CONSTRAINT "course_themes_course_assignment_id_course_assignments_id_fk" FOREIGN KEY ("course_assignment_id") REFERENCES "public"."course_assignments"("id") ON DELETE cascade ON UPDATE no action;