# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Restaurant reservation management system for "aljonuschka" that processes email-based reservations, manages them through a web interface, and sends automated email responses.

**Stack**: Next.js 16 (App Router), PostgreSQL (Neon serverless), Prisma, NextAuth, IMAP/SMTP email processing, TypeScript, Tailwind CSS, shadcn/ui

## Development Commands

```bash
# Start development server with Turbopack
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run linter
pnpm lint

# Prisma commands
npx prisma generate        # Generate Prisma client (outputs to src/generated/prisma/)
npx prisma migrate dev     # Run migrations
npx prisma studio          # Open Prisma Studio
```

## Project Architecture

### Database Architecture

The project uses **two separate database models** with different access patterns:

1. **`reservations` table** (via Prisma):
   - Defined in `prisma/schema.prisma`
   - Accessed through Prisma Client from `src/generated/prisma`
   - Simple CRUD operations for manual reservations

2. **`reservation_emails` table** (via raw SQL):
   - Created in `scripts/create-email-reservation-table.sql`
   - Accessed directly through Neon SQL client in [src/lib/DB.ts](src/lib/DB.ts)
   - Stores email-based reservations with status tracking (pending/confirmed/rejected)
   - Uses email UID as primary key to prevent duplicates
   - SQL function `insert_reservation_email()` defined in `scripts/create-email-function.sql`

3. **`auth_passwords` table** (via raw SQL):
   - Created in `scripts/create-auth-table.sql`
   - Stores bcrypt password hashes for role-based authentication
   - Roles: `admin` and `staff`

### Authentication & Authorization

Role-based authentication using NextAuth with custom credentials provider:

- Configuration: [src/lib/auth.ts](src/lib/auth.ts)
- Single password per role (admin/staff) stored in `auth_passwords` table
- JWT strategy with role stored in token
- Route protection via [middleware.ts](middleware.ts):
  - `/reservations/*` - requires `staff` role
  - `/reservations/emails/*` - requires `staff` role
  - `/admin-only/*` - requires `admin` role
- Redirect logic in `src/app/api/auth/redirect/route.ts` for role-based landing pages

### Email Processing System

**IMAP Fetching** ([src/lib/IMAP.ts](src/lib/IMAP.ts)):
- Connects to IMAP server and searches for emails with subject `[aljonuschka] Reservierungsanfragen - neue Einreichung`
- Parses German form fields from email body (Vorname, Nachname, Telefon, E-Mail-Adresse, Datum wählen, Choose a time, Anzahl Personen, Anmerkungen)
- Handles multiple character encodings (UTF-8, quoted-printable, base64)
- Tracks email UIDs to avoid duplicate processing
- Monitors email flags (`\Seen`, `\Answered`) to auto-confirm reservations
- Two-phase processing:
  1. Fetch new emails (UID > max DB UID)
  2. Check existing pending reservations for confirmation flags

**Database Import** ([src/lib/DB.ts](src/lib/DB.ts)):
- `DatabaseImporter` class handles batch imports
- Checks for existing UIDs before insertion
- Updates reservation status (pending → confirmed/rejected)
- Uses SQL function or direct INSERT as fallback

**SMTP Email Sending** ([src/lib/smtp/SMTP.ts](src/lib/smtp/SMTP.ts)):
- Email templates in [src/lib/smtp/emailTemplates.ts](src/lib/smtp/emailTemplates.ts)
- Saves sent emails to IMAP Sent folder
- Confirmation and rejection email types

### API Routes Structure

**Reservation Management**:
- `GET/POST /api/reservations` - CRUD for Prisma reservations
- `GET /api/reservations/emails` - Fetch email-based reservations
- `GET /api/reservations/emails/IMAP` - Trigger IMAP fetch and import
- `POST /api/reservations/emails/SMTP` - Send email response
- `POST /api/reservations/emails/confirm` - Confirm reservation + mark email seen
- `POST /api/reservations/emails/reject` - Reject reservation + mark email seen
- `POST /api/reservations/emails/undo` - Reset reservation to pending

**Admin**:
- `POST /api/admin/change-password` - Update role passwords
- `POST /api/db` - Database testing/admin operations

### UI Components

Built with shadcn/ui and Radix UI primitives:

- [src/components/reservation-card.tsx](src/components/reservation-card.tsx) - Display manual reservations
- [src/components/email-reservation-card.tsx](src/components/email-reservation-card.tsx) - Display email reservations with confirm/reject actions
- [src/components/reservation-modal.tsx](src/components/reservation-modal.tsx) - Create/edit reservation dialog
- [src/components/new-email-form.tsx](src/components/new-email-form.tsx) - Compose custom emails
- [src/components/date-picker.tsx](src/components/date-picker.tsx) - Date selection with react-day-picker
- [src/components/current-time-indicator.tsx](src/components/current-time-indicator.tsx) - Live time display

shadcn/ui components in `src/components/ui/`: button, dialog, card, calendar, input, label, popover, toast, textarea

### Pages

- `/` - Landing page
- `/login` - Authentication page
- `/reservations` - Main reservations dashboard (staff only)
- `/reservations/emails` - Email-based reservations with confirm/reject UI (staff only)
- `/admin-only` - Admin panel for password changes (admin only)

## Important Patterns

### Working with Email Reservations

When modifying email processing logic:

1. Email parsing is in `IMAPFetcher.parseBody()` in [src/lib/IMAP.ts](src/lib/IMAP.ts)
2. Field extraction uses multiple regex patterns to handle variations
3. Date format: DD.MM.YYYY → YYYY-MM-DD conversion
4. Time format: HH:MM (24-hour)
5. Phone formatting: auto-adds +49 prefix if missing
6. Special requests field has cleanup logic for unwanted form text

### Character Encoding Handling

Email bodies require special attention:
- Raw bytes handled as latin1 to preserve encoding info
- Support for quoted-printable, base64, and plain text
- iconv-lite for charset conversion
- HTML tag stripping for text/html fallback

### Status Flow for Email Reservations

```
pending → confirmed (via confirm button OR email marked as \Seen)
pending → rejected (via reject button)
confirmed/rejected → pending (via undo button)
```

### Type Safety

Custom types in `src/types/`:
- [src/types/email-reservations.ts](src/types/email-reservations.ts) - Email reservation types
- [src/types/next-auth.d.ts](src/types/next-auth.d.ts) - NextAuth session extension with role

## Environment Variables

Required in `.env` (check `.env` file for current values):

```
DATABASE_URL=              # Neon PostgreSQL connection string
NEXTAUTH_SECRET=           # NextAuth JWT secret
NEXTAUTH_URL=              # Base URL for NextAuth
IMAP_SERVER=               # IMAP server hostname
IMAP_PORT=                 # IMAP port (usually 993)
EMAIL=                     # Email account for IMAP/SMTP
EMAIL_PASSWORD=            # Email account password
SMTP_SERVER=               # SMTP server hostname
SMTP_PORT=                 # SMTP port (usually 465/587)
```

## Working with Scripts

Utility scripts in `scripts/`:
- `create-auth-table.sql` - Initialize auth_passwords table
- `create-email-reservation-table.sql` - Initialize reservation_emails table
- `create-email-function.sql` - SQL function for safe insertions
- `mail-fetcher/` - Standalone email processing utilities

Run SQL scripts directly in Neon dashboard or via `psql`.
