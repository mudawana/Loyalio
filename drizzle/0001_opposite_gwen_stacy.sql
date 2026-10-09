CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`shop` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`segment` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`shop`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rewards` (
	`id` text PRIMARY KEY NOT NULL,
	`shop` text NOT NULL,
	`name` text NOT NULL,
	`cost` integer NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`shop`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `cards` ADD `email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `cards` ADD `consent` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `shops` ADD `logo` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `shops` ADD `demo` integer DEFAULT 0 NOT NULL;