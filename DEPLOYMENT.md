# P2P SaaS Africa — Deployment Guide

## Prerequisites
- Node.js 20+
- MySQL 8+ database
- pnpm 10+

## Environment Variables

```env
DATABASE_URL=mysql://user:password@host:3306/database
JWT_SECRET=your-secret-key-minimum-32-characters
OAUTH_SERVER_URL=https://your-oauth-provider.com
OWNER_OPEN_ID=your-admin-user-open-id
PORT=3000

# Optional: AI features (OCR, supplier insights)
BUILT_IN_FORGE_API_URL=https://forge-api-url
BUILT_IN_FORGE_API_KEY=your-forge-api-key
```

## First-Time Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Apply database schema
pnpm db:push

# 3. Apply new migration (adds SLA, RFQ, notifications tables)
mysql -u user -p database < drizzle/0003_new_features.sql

# 4. Seed initial data (idempotent - safe to run multiple times)
node scripts/seed.mjs

# 5. Build for production
pnpm build

# 6. Start server
pnpm start
```

## Development

```bash
pnpm dev
```

## Feature Overview

### Core P2P Workflow
- Purchase Requests → Approval Chain → Purchase Orders → Receipt → Invoice → Payment
- Multi-step approval routing with role-based policies
- 48h SLA enforcement with automatic escalation notifications
- Three-way match (PO ↔ Receipt ↔ Invoice) with tolerance checking
- Budget commitment tracking (committed → actual → released)

### Vendor Management
- Vendor onboarding with bank/mobile money accounts
- Contract lifecycle with expiry alerts (30-day warning)
- Automatic performance scoring (rolling average, on-time delivery)
- Approved supplier list with status management

### RFQ / Sourcing
- Create RFQs with line items and weighted evaluation criteria
- Invite multiple vendors, track responses
- Score vendor responses per criterion with weighted totals
- Award contract and generate comparison matrix

### Inventory
- Multi-warehouse stock management
- Low-stock alerts with configurable reorder levels
- Stock movements (in/out/adjustment) with audit trail

### Payments
- Mark invoices as paid with method tracking (bank/mobile money/cash/cheque)
- Payment history with full audit trail
- Budget actualization on payment

### Notifications
- Real-time in-app notification bell (30s polling)
- Event types: approval required, approved, rejected, overdue, contract expiring, 
  low stock, RFQ response received, payment processed, invoice overdue
- Background job runs every 10 minutes

### Analytics
- Real-time spend by vendor, monthly trend, budget vs actual
- Savings tracking: estimate vs actual, consolidation opportunities
- CSV export for all data types

## Background Jobs (auto-start on server boot)
- **SLA Monitor**: every 10 min
  - Escalates overdue approvals (past 48h dueAt)
  - Notifies on overdue invoices (approved but past due date)  
  - Warns on contracts expiring within 30 days

## Role Hierarchy
| Role | Permissions |
|------|-------------|
| admin | Full access, bypass approvals, manage users/settings |
| procurement_manager | Create/manage POs, RFQs, approve invoices, manage vendors |
| approver | Approve/reject purchase requests |
| requester | Create purchase requests, view own data |

## Segregation of Duties
- Requesters cannot approve their own requests
- Admins can bypass the restriction with audit log entry

## API Health Check
`GET /api/health` → `{ status, db, timestamp, uptime }`
