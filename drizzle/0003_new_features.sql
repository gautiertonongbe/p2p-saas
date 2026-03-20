-- Migration: Add SLA columns to approvals, RFQ tables, and notifications
-- Run: pnpm db:push  (or apply manually)

-- 1. SLA columns on approvals
ALTER TABLE `approvals` ADD `dueAt` timestamp;
ALTER TABLE `approvals` ADD `escalatedAt` timestamp;

-- 2. RFQ tables
CREATE TABLE IF NOT EXISTS `rfqs` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `organizationId` int NOT NULL,
  `rfqNumber` varchar(50) NOT NULL UNIQUE,
  `title` varchar(255) NOT NULL,
  `description` text,
  `requestId` int,
  `deadline` timestamp NOT NULL,
  `status` enum('draft','sent','closed','awarded','cancelled') NOT NULL DEFAULT 'draft',
  `createdBy` int NOT NULL,
  `awardedVendorId` int,
  `evaluationCriteria` json,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `org_idx` (`organizationId`)
);

CREATE TABLE IF NOT EXISTS `rfqItems` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `rfqId` int NOT NULL,
  `itemName` varchar(255) NOT NULL,
  `description` text,
  `quantity` decimal(10,2) NOT NULL,
  `unit` varchar(50),
  `estimatedUnitPrice` decimal(15,2),
  INDEX `rfq_idx` (`rfqId`)
);

CREATE TABLE IF NOT EXISTS `rfqVendors` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `rfqId` int NOT NULL,
  `vendorId` int NOT NULL,
  `status` enum('invited','responded','declined') NOT NULL DEFAULT 'invited',
  `invitedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `respondedAt` timestamp,
  INDEX `rfq_idx` (`rfqId`),
  INDEX `vendor_idx` (`vendorId`)
);

CREATE TABLE IF NOT EXISTS `rfqResponses` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `rfqId` int NOT NULL,
  `vendorId` int NOT NULL,
  `totalAmount` decimal(15,2) NOT NULL,
  `currency` varchar(3) DEFAULT 'XOF',
  `deliveryDays` int,
  `validUntil` timestamp,
  `notes` text,
  `documentUrl` text,
  `scores` json,
  `totalScore` decimal(5,2),
  `isAwarded` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `rfq_idx` (`rfqId`),
  INDEX `vendor_idx` (`vendorId`)
);

CREATE TABLE IF NOT EXISTS `rfqResponseItems` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `responseId` int NOT NULL,
  `rfqItemId` int NOT NULL,
  `unitPrice` decimal(15,2) NOT NULL,
  `totalPrice` decimal(15,2) NOT NULL,
  `notes` text,
  INDEX `response_idx` (`responseId`)
);

-- 3. Notifications
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `organizationId` int NOT NULL,
  `userId` int NOT NULL,
  `type` varchar(100) NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `entityType` varchar(100),
  `entityId` int,
  `isRead` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `user_idx` (`userId`),
  INDEX `org_idx` (`organizationId`),
  INDEX `unread_idx` (`userId`, `isRead`)
);

-- 4. Invoice dispute and revision columns
ALTER TABLE `invoices` MODIFY COLUMN `status` enum('pending','approved','rejected','disputed','revised','paid','cancelled') NOT NULL DEFAULT 'pending';
ALTER TABLE `invoices` ADD `disputeReason` text;
ALTER TABLE `invoices` ADD `disputedAt` timestamp;
ALTER TABLE `invoices` ADD `disputedBy` int;
ALTER TABLE `invoices` ADD `disputeResolution` text;
ALTER TABLE `invoices` ADD `resolvedAt` timestamp;
ALTER TABLE `invoices` ADD `originalInvoiceId` int;
ALTER TABLE `invoices` ADD `revisionNumber` int DEFAULT 1;
ALTER TABLE `invoices` ADD `revisionNote` text;

-- 5. Organizations new contact columns
ALTER TABLE `organizations` MODIFY COLUMN `country` varchar(100) NOT NULL DEFAULT 'Benin';
ALTER TABLE `organizations` ADD `address` varchar(500);
ALTER TABLE `organizations` ADD `city` varchar(100);
ALTER TABLE `organizations` ADD `phone` varchar(50);
ALTER TABLE `organizations` ADD `email` varchar(320);
ALTER TABLE `organizations` ADD `website` varchar(255);
ALTER TABLE `organizations` ADD `taxId` varchar(100);
ALTER TABLE `organizations` ADD `logoUrl` text;
ALTER TABLE `organizations` ADD `primaryColor` varchar(7) DEFAULT '#2563eb';

-- 6. Approval SLA columns
ALTER TABLE `approvals` ADD `dueAt` timestamp;
ALTER TABLE `approvals` ADD `escalatedAt` timestamp;

-- 7. Saved views — add new columns for full Coupa-style custom views
ALTER TABLE `savedViews` ADD `description` text;
ALTER TABLE `savedViews` ADD `sortBy` varchar(100);
ALTER TABLE `savedViews` ADD `sortDir` enum('asc','desc') DEFAULT 'asc';
ALTER TABLE `savedViews` ADD `displayType` enum('table','cards','compact') NOT NULL DEFAULT 'table';
ALTER TABLE `savedViews` ADD `isShared` boolean NOT NULL DEFAULT false;
ALTER TABLE `savedViews` ADD `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
CREATE INDEX `entity_idx` ON `savedViews` (`entity`, `organizationId`);

-- 8. Password field for standalone auth
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `password` varchar(255);
