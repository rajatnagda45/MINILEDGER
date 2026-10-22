# Architecture

## Request lifecycle

The mobile API client creates a timed JSON request and attaches the current bearer token. Express applies security headers, CORS, a 100 KB JSON limit, validation, and authentication before the route delegates to a service. Services own the business rules. `PrismaDataStore` owns persistence. Errors flow to one handler that returns a stable public shape without database or stack details.

## Authentication lifecycle

1. The client submits an Indian mobile number.
2. The server normalizes it to E.164-like `+91…` format.
3. `OtpService` generates six digits with `crypto.randomInt`.
4. Only a SHA-256 digest containing the phone, code, and server pepper is held in memory.
5. The development server prints the code because this assignment has no SMS provider.
6. The challenge expires after five minutes, limits verification attempts, rate-limits requests, and enforces a resend cooldown.
7. Successful verification deletes the challenge, upserts the user, and returns an issuer/audience-scoped JWT.
8. Native clients store the JWT in Expo SecureStore. Logout clears the token and TanStack Query cache.

The in-memory challenge store is intentionally simple for one development instance. Production needs a durable shared challenge store and a real SMS delivery service.

## Database relationships

`User` has many `Loan` rows. `Loan.userId` is a required foreign key with cascade deletion. Phone numbers are unique. Compound indexes support the common user/status and user/due-date reads. Amounts are integer paise and due dates use PostgreSQL `DATE`, so neither currency precision nor calendar dates drift through JavaScript floating-point/timezone conversions.

## Security boundary

The authenticated user ID comes only from the verified JWT. The client cannot submit a `userId`. Every loan read and mutation filters by both loan ID and authenticated user ID. Another user's valid identifier therefore behaves like a missing record. JWTs, OTP digests, raw secrets, and authorization headers are never intentionally logged.

## Financial calculations

The loan service loads only the authenticated user's records and aggregates integer paise. Repaid loans add to `totalRepaid`; outstanding loans add to `outstandingAmount`; only outstanding loans whose date is earlier than the local calendar date add to `overdueAmount`. The result converts paise to rupees only at the response boundary.

This preserves the full-repayment invariant:

```text
totalLent = totalRepaid + outstandingAmount
```

## Repayment lifecycle

The app requires confirmation, sends `PATCH /loans/:id/repay`, and disables the active action. The data store checks ownership and current status in a transaction, sets `REPAID` plus `repaidAt`, and rejects a repeated transition consistently. On success the app invalidates loan-list, loan-detail, and summary queries. The next server responses remove overdue styling and move the amount between outstanding and repaid totals.

## Frontend data flow

TanStack Query independently owns `['loans']`, `['summary']`, and `['loan', id]`. The dashboard renders server fields, including `isOverdue`; it does not duplicate date or money business rules. Create and repay mutations invalidate all affected keys. Pull-to-refresh refetches list and summary together. A 401 triggers centralized sign-out, secure token deletion, private cache removal, and redirect to login.

React Hook Form and Zod provide immediate input guidance while the API repeats all validation as the security authority. The API client distinguishes server, authentication, validation, timeout, and network errors for useful UI messages.

## UI system

Reusable tokens control colour, typography, spacing, radii, and elevation. A deep navy financial card establishes hierarchy; white neutral surfaces keep dense information calm. Overdue loans combine a red rail, icon, explicit “OVERDUE” badge, and date copy so meaning never depends on colour alone. Native touch targets are at least roughly 44 points and controls expose accessibility roles and labels.

## Error handling

Expected business errors use `AppError` with HTTP status, stable code, and user-safe message. Zod failures return 422 details. Unknown failures are logged without request secrets and return a generic 500 response. The app preserves add-loan form values after recoverable failures and exposes retry actions for read failures.

## Trade-offs and limitations

- Full repayments only; partial payments would require a transaction/payment ledger rather than mutating one status.
- OTP storage is process-local and not suitable for horizontal scaling.
- Lists are unpaginated because the assignment targets small personal ledgers.
- Receipt upload is not present; adding it requires authenticated streaming/storage endpoints and mobile image selection.
- Automated API tests use an in-memory store to remain isolated and deterministic. A real PostgreSQL smoke test verifies migration and persistence separately.

