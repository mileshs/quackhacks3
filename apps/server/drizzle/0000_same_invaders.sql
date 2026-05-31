CREATE TABLE `leaderboard_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_name` text NOT NULL,
	`score` integer NOT NULL,
	`accuracy` real NOT NULL,
	`survival_seconds` integer NOT NULL,
	`created_at` text NOT NULL
);
