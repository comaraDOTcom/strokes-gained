CREATE TABLE "invited_emails" (
	"email" text PRIMARY KEY NOT NULL,
	"invited_at" timestamp DEFAULT now() NOT NULL
);
