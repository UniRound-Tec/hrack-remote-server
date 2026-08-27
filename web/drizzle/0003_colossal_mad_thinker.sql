ALTER TABLE `pairings` ADD `node_id` text DEFAULT 'us-1' NOT NULL;--> statement-breakpoint
CREATE INDEX `pairings_room_id_idx` ON `pairings` (`room_id`);