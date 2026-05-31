CREATE TABLE `game_capture_galleries` (
	`session_key` text PRIMARY KEY NOT NULL,
	`frames_json` text NOT NULL,
	`updated_at` text NOT NULL
);
