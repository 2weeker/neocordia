ALTER TABLE `settings` ADD `message_retention_max_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `message_retention_max_age_days` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `dm_retention_max_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `dm_retention_max_age_days` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `log_retention_days` integer DEFAULT 0 NOT NULL;
