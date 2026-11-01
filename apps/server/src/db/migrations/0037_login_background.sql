ALTER TABLE `settings` ADD `login_background_id` integer REFERENCES files(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `settings` ADD `login_background_dim` integer DEFAULT 60 NOT NULL;
