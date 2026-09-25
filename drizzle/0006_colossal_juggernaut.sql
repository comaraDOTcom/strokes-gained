CREATE TABLE "played_courses" (
	"user_id" text NOT NULL,
	"course_key" text NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "played_courses_user_id_course_key_pk" PRIMARY KEY("user_id","course_key")
);
--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "directory_key" text;--> statement-breakpoint
ALTER TABLE "played_courses" ADD CONSTRAINT "played_courses_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;