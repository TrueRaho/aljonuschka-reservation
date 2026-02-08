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
npx prisma migrate dev     # Create and apply migrations in development
npx prisma migrate deploy  # Apply migrations in production
npx prisma studio          # Open Prisma Studio GUI
```

## Project Architecture

### Database Architecture

**All database access uses Prisma Client** - no raw SQL queries:

- Prisma singleton: [src/lib/prisma.ts](src/lib/prisma.ts) with PrismaPg adapter for connection pooling
- Schema: [prisma/schema.prisma](prisma/schema.prisma)
- Generated client: `src/generated/prisma`

**Database Models:**

1. **`ReservationEmail`** (table: `reservation_emails`):
   - Stores email-based reservations with status tracking (pending/confirmed/rejected)
   - Primary key: `id` (BigInt) - stores IMAP email UID to prevent duplicates
   - Fields: firstName, lastName, phone, email, reservationDate, reservationTime, guests, specialRequests, receivedAt, status

2. **`AuthPassword`** (table: `auth_passwords`):
   - Stores bcrypt password hashes for role-based authentication
   - Roles: `admin` and `staff`

3. **`CustomerStrike`** (table: `customer_strikes`):
   - Tracks customer no-show/cancellation strikes by email
   - Used to identify problematic customers

### Service Layer Architecture

Business logic is organized into service modules that encapsulate domain operations:

**[src/services/mailService.ts](src/services/mailService.ts)** - Email processing singleton:
- **IMAP operations**: Fetches emails with subject `[aljonuschka] Reservierungsanfragen - neue Einreichung`
- **Email parsing**: Extracts German form fields (Vorname, Nachname, Telefon, E-Mail-Adresse, Datum wählen, Choose a time, Anzahl Personen, Anmerkungen)
- **Character encoding**: Handles UTF-8, quoted-printable, and base64 encodings
- **Auto-confirmation**: Monitors email flags (`\Seen`, `\Answered`) to auto-confirm reservations
- **Two-phase processing**:
  1. Fetch new emails (UID > max DB UID)
  2. Check existing pending reservations for confirmation flags
- **SMTP operations**: Sends confirmation/rejection emails, saves to IMAP Sent folder
- **Email templates**: Defined in [src/lib/smtp/emailTemplates.ts](src/lib/smtp/emailTemplates.ts)

**[src/services/reservationEmailService.ts](src/services/reservationEmailService.ts)** - Database operations:
- Import reservations from parsed emails
- Query reservations with date statistics
- Update reservation status (pending/confirmed/rejected)
- Handle BigInt UID conversion for JSON serialization

**[src/services/authService.ts](src/services/authService.ts)** - Authentication operations:
- Fetch password records for role-based auth
- Update role passwords

**[src/services/strikeService.ts](src/services/strikeService.ts)** - Customer strike tracking:
- Get strikes by email(s)
- Increment/decrement strikes for customer behavior tracking

### Authentication & Authorization

Role-based authentication using NextAuth with custom credentials provider:

- Configuration: [src/lib/auth.ts](src/lib/auth.ts)
- Single password per role (admin/staff) stored in `AuthPassword` model
- JWT strategy with role stored in token
- Route protection via [middleware.ts](middleware.ts):
  - `/reservations/*` - requires `staff` role
  - `/reservations/emails/*` - requires `staff` role
  - `/admin-only/*` - requires `admin` role
- Redirect logic in [src/app/api/auth/redirect/route.ts](src/app/api/auth/redirect/route.ts) for role-based landing pages

### API Routes Structure

**Thin wrapper pattern**: API routes delegate to service layer functions for business logic.

**Reservation Management**:
- `GET/POST /api/reservations` - CRUD for manual reservations
- `GET /api/reservations/emails` - Fetch email-based reservations with stats
- `GET /api/reservations/emails/IMAP` - Trigger IMAP fetch and import (calls `mailService.fetchAndProcessEmails()`)
- `POST /api/reservations/emails/SMTP` - Send notification email (calls `mailService.sendNotificationEmail()`)
- `POST /api/reservations/emails/send-custom` - Send custom email (calls `mailService.sendCustomEmail()`)
- `POST /api/reservations/emails/confirm` - Confirm reservation + mark email seen
- `POST /api/reservations/emails/reject` - Reject reservation + mark email seen
- `POST /api/reservations/emails/undo` - Undo rejection (rejected → confirmed)
- `GET/POST /api/reservations/emails/strikes` - Get/update customer strikes

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

### Working with BigInt UIDs

Email UIDs are stored as `BigInt` in Prisma (IMAP UIDs can exceed JavaScript's safe integer range):

```typescript
// In service layer - database operations use BigInt
await prisma.reservationEmail.findUnique({ where: { id: BigInt(uid) } })

// Before JSON serialization - MUST convert to Number
return { id: Number(reservation.id), ...otherFields }
```

**CRITICAL**: Always convert `BigInt` to `Number()` before sending to frontend via JSON.

### Working with Time Fields

The `reservationTime` field is `DateTime @db.Time()` in Prisma but returns a Date object:

```typescript
// Format for HH:MM display
function formatTime(dt: Date): string {
  return dt.toISOString().slice(11, 16)  // "14:30"
}

// When creating/updating - parse from HH:MM string
reservationTime: new Date(`1970-01-01T${timeString}:00Z`)
```

### Working with Email Reservations

When modifying email processing logic in [src/services/mailService.ts](src/services/mailService.ts):

1. Email parsing is in `MailService.parseBody()` and `MailService.parseEmailMessage()`
2. Field extraction uses multiple regex patterns to handle variations
3. Date format: DD.MM.YYYY → YYYY-MM-DD conversion
4. Time format: HH:MM (24-hour)
5. Phone formatting: auto-adds +49 prefix if missing
6. Special requests field has cleanup logic for unwanted form text

### Character Encoding Handling

Email bodies require special attention (see `MailService.extractEmailBody()`):
- Raw bytes handled as latin1 to preserve encoding info
- Support for quoted-printable, base64, and plain text
- iconv-lite for charset conversion
- HTML tag stripping for text/html fallback

### Status Flow for Email Reservations

```
pending → confirmed (via confirm button OR email marked as \Seen)
pending → rejected (via reject button)
rejected → confirmed (via undo button)
```

### Service Layer Pattern

- **Services** contain business logic and database operations
- **API routes** are thin wrappers that:
  1. Handle auth/session checks
  2. Parse request data
  3. Call service functions
  4. Return formatted responses
- **Example**:
  ```typescript
  // API route
  import { mailService } from '@/services/mailService'
  const result = await mailService.fetchAndProcessEmails()
  return NextResponse.json(result)
  ```

### Type Safety

Custom types:
- [src/services/reservationEmailService.ts](src/services/reservationEmailService.ts) - `EmailReservationWithStats` type (snake_case for frontend)
- [src/services/mailService.ts](src/services/mailService.ts) - `ParsedEmailReservation` type
- [src/types/next-auth.d.ts](src/types/next-auth.d.ts) - NextAuth session extension with `UserRole` type (`"admin" | "staff"`)

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

## Database Migrations

All database changes are managed through Prisma migrations:

```bash
# Create a new migration after schema changes
npx prisma migrate dev --name description_of_change

# Apply migrations to production
npx prisma migrate deploy

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

**Note**: The `scripts/` directory contains legacy SQL files from before the Prisma refactor. These are kept for reference but are not used in development. All database operations now go through Prisma Client.
