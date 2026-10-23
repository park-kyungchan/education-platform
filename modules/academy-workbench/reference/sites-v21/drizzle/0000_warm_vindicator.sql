CREATE TABLE `academy_ledger_commits` (
	`owner` text NOT NULL,
	`student_id` text NOT NULL,
	`revision` integer NOT NULL,
	`request_id` text NOT NULL,
	`content_hash` text NOT NULL,
	`previous_hash` text NOT NULL,
	`committed_at` text NOT NULL,
	`evidence_source` text NOT NULL,
	`request_json` text NOT NULL,
	PRIMARY KEY(`owner`, `student_id`, `revision`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `academy_commit_idempotency` ON `academy_ledger_commits` (`owner`,`student_id`,`request_id`);--> statement-breakpoint
CREATE TABLE `academy_ledger_events` (
	`owner` text NOT NULL,
	`student_id` text NOT NULL,
	`event_id` text NOT NULL,
	`revision` integer NOT NULL,
	`event_hash` text NOT NULL,
	`raw_json` text NOT NULL,
	PRIMARY KEY(`owner`, `student_id`, `event_id`)
);
--> statement-breakpoint
CREATE TABLE `academy_ledger_heads` (
	`owner` text NOT NULL,
	`student_id` text NOT NULL,
	`revision` integer NOT NULL,
	`commit_hash` text NOT NULL,
	PRIMARY KEY(`owner`, `student_id`)
);
--> statement-breakpoint
CREATE TABLE `academy_import_sources` (
	`owner` text NOT NULL,
	`source_hash` text NOT NULL,
	`source_ref` text NOT NULL,
	`raw_text` text NOT NULL,
	`imported_at` text NOT NULL,
	PRIMARY KEY(`owner`, `source_hash`)
);
