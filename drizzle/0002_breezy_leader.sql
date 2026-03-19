ALTER TABLE `purchaseOrders` MODIFY COLUMN `status` enum('draft','issued','confirmed','approved','rejected','partially_received','received','closed','cancelled') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `purchaseOrders` ADD `approvedBy` int;--> statement-breakpoint
ALTER TABLE `purchaseOrders` ADD `approvedAt` timestamp;