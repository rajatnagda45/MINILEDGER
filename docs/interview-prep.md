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

Jest and React Native Testing Library exercise the real mobile screens, providers, hooks and components at user-facing boundaries; 56 tests cover auth, web/native token storage, fail-closed logout, loading/empty/error states, forms, duplicate submission, query refresh, receipts, cancellation/network/timeout classification and overdue cues. Supertest exercises the real Express middleware and routes. A deterministic in-memory implementation isolates most API tests from developer databases. The 71 backend tests cover production configuration, OTP boundaries, JWT algorithm pinning, malformed requests, validation, authentication, ownership, repayment, summaries, date boundaries, receipt validation, concurrent replacement, and storage failure handling. A gated real-PostgreSQL integration test applies the committed migrations to a disposable database and proves that only one of two concurrent repayment attempts succeeds.

## How are receipt uploads secured?

The service first loads the owned loan, then accepts only bounded, structurally inspected JPEG/PNG images. It generates a random storage key, writes with exclusive creation into a private `0700` directory using `0600` files, stores only metadata in PostgreSQL, and streams bytes through an authenticated ownership-checked endpoint. Replacement and deletion use ordered operations, conditional metadata deletion, retryable tombstones, and deterministic failure/concurrency tests.

## What changes are needed for production?

Use a real SMS vendor, distributed challenge/rate-limit storage, key rotation, refresh-token strategy, restricted CORS, production observability, managed PostgreSQL, encrypted object storage for receipts, backups, a privacy policy, and mobile release signing. Secrets would come from a managed secret store.

## What would another week add?

First I would run accessibility and device UI automation on several screen sizes. Then I would add pagination, move receipt bytes to private object storage for multi-instance deployment, model partial repayments with an immutable transaction table, add richer account recovery, and make the PostgreSQL integration test mandatory in CI.

