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
8. Native clients store the JWT in Expo SecureStore; the web client uses browser storage for the bearer token. On startup the app validates a stored token through an authenticated API request before protected routes render. A rejected token is cleared, while a network failure keeps the potentially valid session behind a retry state. Logout clears the token and TanStack Query cache on every platform.

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

The app requires confirmation, sends `PATCH /loans/:id/repay`, and disables the active action. In one transaction the data store conditionally updates only an owned `OUTSTANDING` row, preventing two concurrent requests from both performing the transition. Missing and already-repaid states are then distinguished consistently. On success the app invalidates loan-list, loan-detail, and summary queries. The next server responses remove overdue styling and move the amount between outstanding and repaid totals.

## Frontend data flow

TanStack Query independently owns `['loans']`, `['summary']`, and `['loan', id]`. The dashboard renders server fields, including `isOverdue`; it does not duplicate date or money business rules. Create and repay mutations invalidate all affected keys. Pull-to-refresh refetches list and summary together. A 401 triggers centralized sign-out, secure token deletion, private cache removal, and redirect to login.

React Hook Form and Zod provide immediate input guidance while the API repeats all validation as the security authority. The API client distinguishes server, authentication, validation, timeout, and network errors for useful UI messages.

## UI system

Reusable tokens control colour, typography, spacing, radii, and elevation. The Midnight Ledger system uses a graphite canvas, layered slate surfaces, an electric-blue action colour, mint success, and coral overdue states. Every displayed amount uses exact Indian currency grouping without compact rounding. Overdue loans combine a coral rail, icon, explicit “OVERDUE” badge, and date copy so meaning never depends on colour alone. Card navigation and repayment are separate sibling targets rather than nested controls. Native touch targets are at least roughly 44 points and controls expose roles, labels, selected/busy states, and live announcements where relevant.

## Receipts

Each loan can carry one optional receipt photo, implemented end to end.

- **Selection and upload.** The add-loan form and loan-detail screen select a JPEG/PNG from the library (or camera on native) via `expo-image-picker`, then `POST /loans/:id/receipt` as `multipart/form-data`. The loan is created first; a failed receipt upload never discards it.
- **Authorization.** Upload, retrieval, and deletion require a valid JWT and verify loan ownership via `findLoan(userId, …)` before any storage or metadata access, so one user can never reach another's receipt (cross-user requests return `404`).
- **Validation.** The declared MIME type and filename are untrusted. `inspectImage` performs a bounded structural check (PNG `IHDR`/`IEND`, JPEG `SOI`/`SOF`/`EOI`), rejects truncated/malformed files, and bounds real pixel dimensions; multer enforces a 5 MB limit. Only JPEG and PNG are accepted.
- **Storage split.** Bytes live on a private local filesystem (`RECEIPT_STORAGE_DIR`, `0700` dir / `0600` files, exclusive-create, server-generated random keys, outside any served path). PostgreSQL stores only metadata (`receipts`: storage key, verified media type, byte size, timestamp) one-to-one with the loan.
- **Retrieval.** `GET /loans/:id/receipt` streams the bytes from an authenticated endpoint with `X-Content-Type-Options: nosniff` and `Cache-Control: private, no-store`; images are never base64-embedded in JSON. The mobile client loads them with request headers on native and a token-authenticated object URL on web (an expired session follows the normal sign-out flow).
- **Replacement and deletion consistency.** The filesystem and database are not one transaction, so operations are ordered: a replacement writes the new object, persists metadata, then removes the old object; a deletion removes the file *before* its metadata so a failed file delete leaves the receipt intact and retryable. Cleanup failures (replace/rollback) are recorded in an `orphaned_objects` tombstone table and retried by `reconcileOrphans()` (run best-effort at startup). Metadata removal is conditional on the storage key originally read: if a concurrent replacement wins, its newer metadata is preserved and the delete returns `409 RECEIPT_CHANGED` instead of removing the replacement.

## Error handling

Expected business errors use `AppError` with HTTP status, stable code, and user-safe message. Zod failures return 422 details. Unknown failures are logged without request secrets and return a generic 500 response. The app preserves add-loan form values after recoverable failures and exposes retry actions for read failures.

## Trade-offs and limitations

- Full repayments only; partial payments would require a transaction/payment ledger rather than mutating one status.
- OTP storage is process-local and not suitable for horizontal scaling.
- Lists are unpaginated because the assignment targets small personal ledgers.
- Receipt bytes use the local filesystem; a private-bucket Amazon S3 backend is a documented extension of the `ReceiptStorage` interface, not built. Only JPEG/PNG are accepted (iOS HEIC captures are rejected). Validation is a bounded structural check, not a full decode.
- Mobile component/integration tests use Jest and React Native Testing Library with API and platform services mocked at their boundaries. Automated API tests use an in-memory store to remain isolated and deterministic. A gated real-PostgreSQL integration test verifies concurrent repayment, and migration/persistence are verified separately.

