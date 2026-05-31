CREATE TABLE `game_captures` (
	`session_key` text PRIMARY KEY NOT NULL,
	`snapshot_image` text NOT NULL,
	`screenshot_image` text NOT NULL,
	`match_percent` real,
	`created_at` text NOT NULL
);
