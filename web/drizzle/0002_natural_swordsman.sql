CREATE TABLE `pairing_projection_state` (
	`singleton` integer PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	CONSTRAINT "pairing_projection_singleton_check" CHECK("pairing_projection_state"."singleton" = 1)
);
--> statement-breakpoint
INSERT INTO `pairing_projection_state` (`singleton`, `revision`) VALUES (1, 0);
--> statement-breakpoint
CREATE TRIGGER `pairings_projection_after_insert`
AFTER INSERT ON `pairings`
BEGIN
  UPDATE `pairing_projection_state`
  SET `revision` = `revision` + 1
  WHERE `singleton` = 1;
END;
--> statement-breakpoint
CREATE TRIGGER `pairings_projection_after_update`
AFTER UPDATE ON `pairings`
BEGIN
  UPDATE `pairing_projection_state`
  SET `revision` = `revision` + 1
  WHERE `singleton` = 1;
END;
--> statement-breakpoint
CREATE TRIGGER `pairings_projection_after_delete`
AFTER DELETE ON `pairings`
BEGIN
  UPDATE `pairing_projection_state`
  SET `revision` = `revision` + 1
  WHERE `singleton` = 1;
END;
--> statement-breakpoint
CREATE TRIGGER `users_projection_after_ban_change`
AFTER UPDATE OF `banned` ON `user`
WHEN OLD.`banned` IS NOT NEW.`banned`
BEGIN
  UPDATE `pairing_projection_state`
  SET `revision` = `revision` + 1
  WHERE `singleton` = 1;
END;
