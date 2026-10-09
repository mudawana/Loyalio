CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`shop` text NOT NULL,
	`name` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`shop`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`card` text NOT NULL,
	`delta` integer NOT NULL,
	`kind` text NOT NULL,
	`actor` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`card`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shops` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`reward` text NOT NULL,
	`target` integer NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `staff` (
	`id` text PRIMARY KEY NOT NULL,
	`shop` text NOT NULL,
	`email` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`shop`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
