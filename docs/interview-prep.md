# Interview preparation

## Why this architecture?

It keeps each responsibility visible without turning a small assignment into a framework. Routes handle HTTP, services enforce business rules, a data-store adapter owns persistence, and the mobile client only renders typed server data. The same service layer can be tested with an isolated store.

## How does phone OTP authentication work?

The server normalizes the number, generates six secure random digits, hashes the phone/code with a secret pepper, and stores the challenge with expiry, cooldown, and attempt counters. In development it prints the code. Correct verification deletes the challenge, upserts the user, and returns a signed JWT.

## How is OTP reuse prevented?

The challenge is deleted immediately after a successful constant-time comparison. A second verification finds no challenge and returns `OTP_INVALID`.

## Why JWT?

The mobile client can authenticate each API request without a server session table. Issuer, audience, signature, and expiry are verified. For a larger production system I would add rotation, revocation strategy, and shorter access tokens with refresh tokens.

## How is one user's data protected from another?

The API ignores any client user ID. It gets the user from the JWT and includes that ID in every loan query. Reading or repaying another user's UUID returns the same 404 as a missing loan.

## Why PostgreSQL and Prisma?

PostgreSQL gives strong constraints, transactions, precise types, and reliable indexes. Prisma makes the schema and query shapes readable in TypeScript and provides repeatable migrations.

## How are floating-point errors avoided?

The database stores rupees as integer paise. The server validates at most two decimal places, converts once on input, aggregates integers, and converts to rupees at the API boundary.

## How is overdue calculated?

Only an outstanding loan with a due date strictly earlier than the current date in `APP_TIME_ZONE` is overdue. Due today is not overdue. Repaid loans are never overdue.

## What happens on repayment?

The data store performs a conditional update on the owned loan only while its status is `OUTSTANDING`, inside a transaction. That makes concurrent repayment attempts safe; only one transition can succeed. The app invalidates list, detail, and summary queries, so the server immediately moves the amount from outstanding to repaid.

## How does TanStack Query keep the dashboard synchronized?

Loans and summary have separate cache keys. Create and repay mutations invalidate every affected key. Pull-to-refresh refetches both. Logout clears the entire private cache.

## How are network failures handled?

The client aborts requests after 12 seconds and converts network, timeout, authentication, validation, and server failures into consistent messages. Read screens offer retry. The add form keeps entered values after an API failure.

## How is the API tested?

Supertest exercises the real Express middleware and routes. A deterministic in-memory implementation isolates tests from developer databases. Nineteen tests cover OTP issue, wrong/expired/reused codes, production logging, malformed JSON and IDs, validation, authentication, ownership, repayment, user isolation, exact totals, and yesterday/today/tomorrow overdue boundaries. A separate PostgreSQL smoke test proves migrations and persistence.

## How would receipt uploads be secured?

I would first load the owned loan, then accept only a small allowlist of image formats with size and signature checks, generate a random server filename, store it outside the public source tree, and stream it back only through an authenticated ownership-checked endpoint. The current version does not claim this feature.

## What changes are needed for production?

Use a real SMS vendor, distributed challenge/rate-limit storage, key rotation, refresh-token strategy, restricted CORS, production observability, managed PostgreSQL, encrypted object storage for receipts, backups, a privacy policy, and mobile release signing. Secrets would come from a managed secret store.

## What would another week add?

First I would run accessibility and device UI automation on several screen sizes. Then I would add pagination, receipt upload with private object storage, partial repayments using an immutable transaction table, richer account recovery, and CI that provisions PostgreSQL for integration tests.

