CREATE TABLE `admin_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`at` integer NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`target` text,
	`fields` text
);
--> statement-breakpoint
CREATE TABLE `otp_send_guard` (
	`email` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer NOT NULL,
	`last_attempt_at` integer NOT NULL,
	`last_ok_at` integer
);
--> statement-breakpoint
CREATE TABLE `platform_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`alg` text DEFAULT 'aes-256-gcm-v1' NOT NULL,
	`key_version` integer DEFAULT 1 NOT NULL,
	`nonce` blob NOT NULL,
	`ciphertext` blob NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text
);
