CREATE TABLE `approvalPolicies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`conditions` json,
	`isActive` boolean NOT NULL DEFAULT true,
	`priority` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `approvalPolicies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `approvalSteps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`policyId` int NOT NULL,
	`stepOrder` int NOT NULL,
	`approverType` enum('role','user','manager') NOT NULL,
	`approverId` int,
	`isParallel` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `approvalSteps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `approvals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`stepOrder` int NOT NULL,
	`approverId` int NOT NULL,
	`decision` enum('pending','approved','rejected','delegated') NOT NULL DEFAULT 'pending',
	`comment` text,
	`decidedAt` timestamp,
	`delegatedTo` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `approvals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`entityType` varchar(100) NOT NULL,
	`entityId` int NOT NULL,
	`action` varchar(100) NOT NULL,
	`actorId` int NOT NULL,
	`oldValue` json,
	`newValue` json,
	`ipAddress` varchar(45),
	`userAgent` text,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`scopeType` enum('department','project','category') NOT NULL,
	`scopeId` int NOT NULL,
	`fiscalPeriod` varchar(20) NOT NULL,
	`allocatedAmount` decimal(15,2) NOT NULL,
	`committedAmount` decimal(15,2) NOT NULL DEFAULT '0',
	`actualAmount` decimal(15,2) NOT NULL DEFAULT '0',
	`currency` varchar(3) DEFAULT 'XOF',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `budgets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `departments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`code` varchar(50) NOT NULL,
	`name` varchar(255) NOT NULL,
	`managerId` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `departments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventoryItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`itemCode` varchar(100) NOT NULL,
	`itemName` varchar(255) NOT NULL,
	`description` text,
	`unit` varchar(50),
	`reorderLevel` decimal(10,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventoryItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventoryStock` (
	`id` int AUTO_INCREMENT NOT NULL,
	`itemId` int NOT NULL,
	`warehouseId` int NOT NULL,
	`quantity` decimal(10,2) NOT NULL DEFAULT '0',
	`lastUpdated` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventoryStock_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`invoiceNumber` varchar(100) NOT NULL,
	`vendorId` int NOT NULL,
	`poId` int,
	`invoiceDate` timestamp NOT NULL,
	`dueDate` timestamp,
	`amount` decimal(15,2) NOT NULL,
	`taxAmount` decimal(15,2) DEFAULT '0',
	`currency` varchar(3) DEFAULT 'XOF',
	`invoiceFileUrl` text,
	`ocrData` json,
	`matchStatus` enum('unmatched','matched','exception','manual_review') NOT NULL DEFAULT 'unmatched',
	`status` enum('pending','approved','rejected','paid','cancelled') NOT NULL DEFAULT 'pending',
	`approvedBy` int,
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lookupTypes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`isSystem` boolean NOT NULL DEFAULT false,
	`isEditable` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lookupTypes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lookupValues` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lookupTypeId` int NOT NULL,
	`code` varchar(50) NOT NULL,
	`label` varchar(255) NOT NULL,
	`parentValueId` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lookupValues_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`legalName` varchar(255) NOT NULL,
	`tradeName` varchar(255),
	`country` enum('Benin','Côte d''Ivoire') NOT NULL,
	`baseCurrency` varchar(3) NOT NULL DEFAULT 'XOF',
	`fiscalYearStart` varchar(5) DEFAULT '01-01',
	`settings` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`invoiceId` int NOT NULL,
	`paymentMethod` enum('bank_transfer','mobile_money','check','cash') NOT NULL,
	`amount` decimal(15,2) NOT NULL,
	`currency` varchar(3) DEFAULT 'XOF',
	`reference` varchar(255),
	`valueDate` timestamp NOT NULL,
	`status` enum('scheduled','processing','completed','failed','cancelled') NOT NULL DEFAULT 'scheduled',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchaseOrderItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`poId` int NOT NULL,
	`itemName` varchar(255) NOT NULL,
	`description` text,
	`quantity` decimal(10,2) NOT NULL,
	`unitPrice` decimal(15,2) NOT NULL,
	`totalPrice` decimal(15,2) NOT NULL,
	`unit` varchar(50),
	`receivedQuantity` decimal(10,2) DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `purchaseOrderItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchaseOrders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`poNumber` varchar(50) NOT NULL,
	`requestId` int,
	`vendorId` int NOT NULL,
	`totalAmount` decimal(15,2) NOT NULL,
	`taxAmount` decimal(15,2) DEFAULT '0',
	`currency` varchar(3) DEFAULT 'XOF',
	`status` enum('draft','issued','confirmed','partially_received','received','closed','cancelled') NOT NULL DEFAULT 'draft',
	`issuedAt` timestamp,
	`expectedDeliveryDate` timestamp,
	`version` int NOT NULL DEFAULT 1,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchaseOrders_id` PRIMARY KEY(`id`),
	CONSTRAINT `purchaseOrders_poNumber_unique` UNIQUE(`poNumber`)
);
--> statement-breakpoint
CREATE TABLE `purchaseRequestItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`itemName` varchar(255) NOT NULL,
	`description` text,
	`quantity` decimal(10,2) NOT NULL,
	`unitPrice` decimal(15,2) NOT NULL,
	`totalPrice` decimal(15,2) NOT NULL,
	`unit` varchar(50),
	`preferredVendorId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `purchaseRequestItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchaseRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`requestNumber` varchar(50) NOT NULL,
	`requesterId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`categoryId` int,
	`billingStringId` int,
	`costCenterId` int,
	`projectId` int,
	`departmentId` int,
	`amountEstimate` decimal(15,2) NOT NULL,
	`currency` varchar(3) DEFAULT 'XOF',
	`taxIncluded` boolean NOT NULL DEFAULT false,
	`urgencyLevel` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`status` enum('draft','submitted','pending_approval','approved','rejected','cancelled') NOT NULL DEFAULT 'draft',
	`currentApprovalStep` int DEFAULT 0,
	`attachments` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchaseRequests_id` PRIMARY KEY(`id`),
	CONSTRAINT `purchaseRequests_requestNumber_unique` UNIQUE(`requestNumber`)
);
--> statement-breakpoint
CREATE TABLE `receiptItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`receiptId` int NOT NULL,
	`poItemId` int NOT NULL,
	`quantityReceived` decimal(10,2) NOT NULL,
	`condition` enum('good','damaged','partial') NOT NULL DEFAULT 'good',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `receiptItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`poId` int NOT NULL,
	`receiptNumber` varchar(50) NOT NULL,
	`receivedBy` int NOT NULL,
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `receipts_id` PRIMARY KEY(`id`),
	CONSTRAINT `receipts_receiptNumber_unique` UNIQUE(`receiptNumber`)
);
--> statement-breakpoint
CREATE TABLE `savedViews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`userId` int NOT NULL,
	`entity` varchar(100) NOT NULL,
	`name` varchar(255) NOT NULL,
	`filters` json,
	`columns` json,
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `savedViews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vendorContracts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vendorId` int NOT NULL,
	`contractNumber` varchar(100) NOT NULL,
	`title` varchar(255) NOT NULL,
	`startDate` timestamp NOT NULL,
	`endDate` timestamp,
	`totalValue` decimal(15,2),
	`currency` varchar(3) DEFAULT 'XOF',
	`status` enum('active','expired','terminated') NOT NULL DEFAULT 'active',
	`documentUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vendorContracts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vendors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`legalName` varchar(255) NOT NULL,
	`tradeName` varchar(255),
	`country` varchar(100),
	`taxId` varchar(100),
	`isFormal` boolean NOT NULL DEFAULT true,
	`contactName` varchar(255),
	`contactEmail` varchar(320),
	`contactPhone` varchar(50),
	`bankAccounts` json,
	`mobileMoneyAccounts` json,
	`status` enum('active','inactive','pending') NOT NULL DEFAULT 'pending',
	`performanceScore` decimal(5,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vendors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `warehouses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`code` varchar(50) NOT NULL,
	`name` varchar(255) NOT NULL,
	`location` varchar(255),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `warehouses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','procurement_manager','approver','requester') NOT NULL DEFAULT 'requester';--> statement-breakpoint
ALTER TABLE `users` ADD `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `departmentId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `approvalLimit` decimal(15,2);--> statement-breakpoint
ALTER TABLE `users` ADD `status` enum('active','disabled') DEFAULT 'active' NOT NULL;--> statement-breakpoint
CREATE INDEX `org_idx` ON `approvalPolicies` (`organizationId`);--> statement-breakpoint
CREATE INDEX `policy_idx` ON `approvalSteps` (`policyId`);--> statement-breakpoint
CREATE INDEX `request_idx` ON `approvals` (`requestId`);--> statement-breakpoint
CREATE INDEX `approver_idx` ON `approvals` (`approverId`);--> statement-breakpoint
CREATE INDEX `org_idx` ON `auditLogs` (`organizationId`);--> statement-breakpoint
CREATE INDEX `entity_idx` ON `auditLogs` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `timestamp_idx` ON `auditLogs` (`timestamp`);--> statement-breakpoint
CREATE INDEX `org_idx` ON `budgets` (`organizationId`);--> statement-breakpoint
CREATE INDEX `scope_idx` ON `budgets` (`scopeType`,`scopeId`);--> statement-breakpoint
CREATE INDEX `org_idx` ON `departments` (`organizationId`);--> statement-breakpoint
CREATE INDEX `org_idx` ON `inventoryItems` (`organizationId`);--> statement-breakpoint
CREATE INDEX `item_idx` ON `inventoryStock` (`itemId`);--> statement-breakpoint
CREATE INDEX `warehouse_idx` ON `inventoryStock` (`warehouseId`);--> statement-breakpoint
CREATE INDEX `org_idx` ON `invoices` (`organizationId`);--> statement-breakpoint
CREATE INDEX `vendor_idx` ON `invoices` (`vendorId`);--> statement-breakpoint
CREATE INDEX `po_idx` ON `invoices` (`poId`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `invoices` (`status`);--> statement-breakpoint
CREATE INDEX `org_idx` ON `lookupTypes` (`organizationId`);--> statement-breakpoint
CREATE INDEX `type_idx` ON `lookupValues` (`lookupTypeId`);--> statement-breakpoint
CREATE INDEX `org_idx` ON `payments` (`organizationId`);--> statement-breakpoint
CREATE INDEX `invoice_idx` ON `payments` (`invoiceId`);--> statement-breakpoint
CREATE INDEX `po_idx` ON `purchaseOrderItems` (`poId`);--> statement-breakpoint
CREATE INDEX `org_idx` ON `purchaseOrders` (`organizationId`);--> statement-breakpoint
CREATE INDEX `vendor_idx` ON `purchaseOrders` (`vendorId`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `purchaseOrders` (`status`);--> statement-breakpoint
CREATE INDEX `request_idx` ON `purchaseRequestItems` (`requestId`);--> statement-breakpoint
CREATE INDEX `org_idx` ON `purchaseRequests` (`organizationId`);--> statement-breakpoint
CREATE INDEX `requester_idx` ON `purchaseRequests` (`requesterId`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `purchaseRequests` (`status`);--> statement-breakpoint
CREATE INDEX `receipt_idx` ON `receiptItems` (`receiptId`);--> statement-breakpoint
CREATE INDEX `org_idx` ON `receipts` (`organizationId`);--> statement-breakpoint
CREATE INDEX `po_idx` ON `receipts` (`poId`);--> statement-breakpoint
CREATE INDEX `org_idx` ON `savedViews` (`organizationId`);--> statement-breakpoint
CREATE INDEX `user_idx` ON `savedViews` (`userId`);--> statement-breakpoint
CREATE INDEX `vendor_idx` ON `vendorContracts` (`vendorId`);--> statement-breakpoint
CREATE INDEX `org_idx` ON `vendors` (`organizationId`);--> statement-breakpoint
CREATE INDEX `org_idx` ON `warehouses` (`organizationId`);--> statement-breakpoint
CREATE INDEX `org_idx` ON `users` (`organizationId`);--> statement-breakpoint
CREATE INDEX `dept_idx` ON `users` (`departmentId`);