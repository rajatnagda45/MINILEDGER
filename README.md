# MiniLedger

MiniLedger is a focused mobile lending tracker for money lent to friends. It combines a polished Expo application with a typed Express API and PostgreSQL persistence, so login, loan creation, overdue status, repayment, and every dashboard total come from real server data.

## What it does

- Passwordless Indian mobile login with a six-digit development OTP printed by the API
- Secure session persistence using Expo SecureStore on native devices
- Server-calculated total lent, repaid, outstanding, and overdue amounts
- Loan creation with client and server validation
- Strong visual treatment for overdue loans without relying on colour alone
- Confirmation before repayment and immediate query refresh afterward
- Loan list filters, pull-to-refresh, detail pages, and logout
- Purposeful loading, empty, validation, error, and success states
- User ownership checks on every protected loan operation
- Exact money storage in integer paise
- 19 automated tests for authentication, loans, ownership, malformed requests, dates, and summaries

Receipt upload is deliberately not included in this version. The required login, lending, repayment, and summary journey is complete and tested first.

## Architecture

```text
Expo mobile app
  ├── Expo Router screens
  ├── React Hook Form + Zod
  ├── TanStack Query
  └── typed API client + SecureStore
              │ JSON / JWT
              ▼
Express API
  ├── OTP + JWT authentication
  ├── validation and error boundary
  ├── loan and summary services
  └── Prisma data store
              │
              ▼
PostgreSQL (integer paise, DATE due dates)
```

The API is authoritative for status and financial totals. The client never recomputes a summary or simulates a successful mutation. See [architecture notes](docs/architecture.md) for the full lifecycle and trade-offs.

## Responsive design

The app is built mobile-first with React Native Web, and composition — not just font size — changes by viewport (`apps/mobile/hooks/use-responsive.ts`):

- **Mobile:** a single natural column with a full-width summary card and a scannable loan list.
- **Desktop (≥1024px):** a deliberate two-column shell — a summary/overview sidebar beside a dedicated loan-list column — instead of a narrow centred strip. Login uses a two-column split: a brand/product panel (with an illustrative, clearly-labelled sample ledger) beside a focused authentication panel.

### Design system & motion

Tokens live in `apps/mobile/constants/theme.ts` and are applied across every screen: a warm porcelain page, white card surfaces, ink-navy text, cobalt for primary actions and active states, and semantic mint/coral/amber reserved for repaid, overdue, and warning states (never colour alone — status also carries a label and icon). Financial amounts use exact INR formatting with tabular numerals.

Motion is restrained and purposeful (`components/fade-in-view.tsx`): a short fade-and-rise entrance on native (iOS/Android) that honours the OS *reduce motion* setting, plus button press feedback, stable loading skeletons, and a success banner shown only after the server confirms repayment. On React Native Web the entrance renders statically so motion can never conceal content.

## Screenshots

Captured from the running web build against the seeded PostgreSQL database on 22 October 2026.

| Desktop login | Desktop dashboard |
|---|---|
| ![Desktop login](docs/screenshots/login-desktop.png) | ![Desktop dashboard](docs/screenshots/dashboard-desktop.png) |

| Mobile login | Mobile dashboard | Add loan |
|---|---|---|
| ![Mobile login](docs/screenshots/login-mobile.png) | ![Mobile dashboard](docs/screenshots/dashboard-mobile.png) | ![Add loan](docs/screenshots/add-loan-desktop.png) |

The narrow (mobile) captures were taken at a 500px viewport, which is headless Chrome's minimum window width; the single-column layout is identical at smaller phone widths.

## Technology

- Mobile: React Native 0.81, Expo SDK 54, Expo Router 6, TypeScript
- Forms/state: React Hook Form, Zod, TanStack Query
- Backend: Node.js, Express 5, TypeScript, JWT, Zod
- Data: PostgreSQL 16, Prisma 6 migrations
- Tests: Vitest and Supertest with an isolated in-memory data-store adapter

## Repository layout

```text
apps/mobile/       Expo application, screens, components, theme, API client
backend/           Express API, Prisma schema/migration, services, tests
packages/shared/   Shared API response types
docs/              API, architecture, interview, smoke-test, and demo notes
```

## Prerequisites

- Node.js 20 or newer (verified with Node 24.18.0)
- npm 11 or newer
- PostgreSQL 16, either local or through Docker
- Expo Go, an emulator, or an iOS/Android development environment for device testing

## Setup

```bash
git clone https://github.com/rajatnagda45/MINILEDGER.git
cd MINILEDGER
npm install
cp .env.example .env
cp apps/mobile/.env.example apps/mobile/.env.local
npm run db:generate
```

Replace `JWT_SECRET` and `OTP_PEPPER` in `.env` with different long random values. The committed example contains placeholders only.

### Start PostgreSQL with Docker

```bash
docker compose up -d postgres
npm run db:migrate
npm run db:seed
```

If PostgreSQL already occupies port 5432, either use that server and update `DATABASE_URL`, or stop it before starting the Compose service. Never run the migrations against an unspecified database.

### Start the API

```bash
npm run dev:backend
```

The health endpoint is `http://localhost:4000/api/health`.

### Start the mobile app

Open a second terminal:

```bash
npm run dev:mobile
```

Then press `i` for iOS, `a` for Android, or scan the Expo QR code with a device.

## Mobile network configuration

Set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env.local` before starting Expo. Restart Metro after changing it.

| Run target | Typical value |
|---|---|
| iOS simulator | `http://127.0.0.1:4000/api` |
| Android emulator | `http://10.0.2.2:4000/api` |
| Physical phone | `http://YOUR_MAC_LAN_IP:4000/api` |

The phone and development Mac must be on the same network. Ensure the API listens on a reachable interface and the local firewall allows port 4000 when using a physical device. Do not put secrets in any `EXPO_PUBLIC_` variable.

## Mock OTP login

1. Enter a valid Indian mobile number, such as `9876543210`.
2. Tap **Continue securely**.
3. Read the API terminal line: `[DEV OTP] +919876543210: 123456`.
4. Enter that code in the app.

The code expires after five minutes, has a 30-second resend cooldown, permits five verification attempts, and is removed after successful use. Only a hash is kept in memory. Restarting the API clears outstanding challenges. Terminal OTP logging is assignment-specific and must be replaced by an SMS provider in production.

## Commands

```bash
npm run typecheck       # all workspaces
npm test                # backend automated tests
npm run lint            # Expo ESLint rules
npm run db:generate     # generate Prisma client
npm run db:migrate      # create/apply a development migration
npm run db:seed         # add demonstration records
npm run dev:backend     # Express API with watch mode
npm run dev:mobile      # Expo development server
```

To verify release bundling:

```bash
cd apps/mobile
npx expo export --platform ios
npx expo export --platform android
npx expo export --platform web
```

## API overview

All protected endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| POST | `/api/auth/send-otp` | Create a mock OTP challenge |
| POST | `/api/auth/verify-otp` | Verify OTP and return JWT |
| GET | `/api/loans` | List the signed-in user's loans |
| GET | `/api/loans/:id` | Read one owned loan |
| POST | `/api/loans` | Create a loan |
| PATCH | `/api/loans/:id/repay` | Mark an owned loan repaid |
| GET | `/api/summary` | Return server-calculated totals |

Example loan request:

```json
{
  "friendName": "Aarav Sharma",
  "amount": 2500,
  "dueDate": "2026-10-30"
}
```

Amounts are rupee numbers in JSON and integer paise in PostgreSQL. See the complete [API reference](docs/api.md).

## Verification status

Verified on 22 October 2026:

- TypeScript passed across mobile, backend, and shared packages.
- 19 automated tests passed across two test files.
- Expo ESLint completed without warnings or errors.
- Prisma migration applied successfully to PostgreSQL 16.
- OTP issue/verification (`[DEV OTP]` log), authenticated loan listing, and server-calculated summary were exercised against the real PostgreSQL database.
- Expo produced a successful web release bundle (`expo export --platform web`).
- The web build was served and loaded in headless Chrome with a real session token; genuine screenshots of login, dashboard, and add-loan were captured at desktop (1440px) and narrow (500px) viewports — see [Screenshots](#screenshots).

No iOS simulator or connected physical device was available in the build environment, so native touch interaction and iOS/Android visual QA still need the short manual pass in [docs/manual-smoke-test.md](docs/manual-smoke-test.md). The desktop/mobile web visuals are evidenced by the captured screenshots; native-only rendering is not claimed from them. No screenshots or device-test claims are fabricated.

## Security and limits

- Loan access always includes the authenticated `userId` in the data query.
- OTPs are cryptographically generated, hashed with a pepper, time-limited, attempt-limited, cooldown-protected, and one-time use.
- OTP values are printed only outside production mode; production configuration never uses the development logger.
- JWTs are issuer/audience checked; secrets are environment-only.
- Request bodies are size-limited, security headers are enabled, and errors use a stable non-sensitive shape.
- Full repayment is the only repayment model; partial repayment is intentionally out of scope.
- OTP challenges are held in process memory, so they are not shared across multiple API instances.
- Receipt upload and loan deletion are not implemented.
- The npm advisory report includes transitive development-tool advisories in Expo/Prisma chains. Do not apply `npm audit fix --force` without testing their breaking major upgrades.

## Demo recording

The concise recording plan is in [docs/demo-script.md](docs/demo-script.md). Add the real Loom or Drive URL here only after recording and checking access permissions.

