CREATE INDEX `cards_shop_idx` ON `cards` (`shop`);--> statement-breakpoint
CREATE INDEX `ledger_card_idx` ON `ledger` (`card`);--> statement-breakpoint
CREATE INDEX `shops_owner_idx` ON `shops` (`owner`);--> statement-breakpoint
CREATE INDEX `staff_access_idx` ON `staff` (`shop`,`email`);