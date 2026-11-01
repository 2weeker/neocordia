ALTER TABLE `settings` ADD `share_banner_id` integer REFERENCES files(id) ON DELETE set null;
