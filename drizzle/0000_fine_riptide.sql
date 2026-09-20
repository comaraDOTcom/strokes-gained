CREATE TABLE `courses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`location` text
);
--> statement-breakpoint
CREATE TABLE `rounds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` integer NOT NULL,
	`tee_id` integer NOT NULL,
	`played_on` text NOT NULL,
	`weather` text,
	`notes` text,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tee_id`) REFERENCES `tees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`round_id` integer NOT NULL,
	`hole_no` integer NOT NULL,
	`shot_no` integer NOT NULL,
	`start_lie` text NOT NULL,
	`start_yards` real NOT NULL,
	`end_lie` text,
	`end_yards` real NOT NULL,
	`holed` integer NOT NULL,
	`penalty_strokes` integer DEFAULT 0 NOT NULL,
	`penalty_type` text,
	`sg` real,
	`category` text,
	`bunker_subtype` text,
	`baseline_id` text,
	FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shots_round_id_hole_no_shot_no_unique` ON `shots` (`round_id`,`hole_no`,`shot_no`);--> statement-breakpoint
CREATE TABLE `tee_holes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tee_id` integer NOT NULL,
	`hole_no` integer NOT NULL,
	`par` integer NOT NULL,
	`stroke_index` integer,
	`yards` real NOT NULL,
	FOREIGN KEY (`tee_id`) REFERENCES `tees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tee_holes_tee_id_hole_no_unique` ON `tee_holes` (`tee_id`,`hole_no`);--> statement-breakpoint
CREATE TABLE `tees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` integer NOT NULL,
	`name` text NOT NULL,
	`gender` text NOT NULL,
	`distance_unit` text NOT NULL,
	`course_rating` real,
	`slope_rating` real,
	`expected_total_yards` real,
	`expected_par` integer,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tees_course_id_name_unique` ON `tees` (`course_id`,`name`);