# API reference

Base path: `/api`

All responses are JSON. Protected routes require a JWT in `Authorization: Bearer <token>`.

## Error shape

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the submitted details.",
    "details": {}
  }
}
```

Expected codes include `VALIDATION_ERROR`, `MALFORMED_JSON`, `UNAUTHENTICATED`, `SESSION_EXPIRED`, `OTP_INVALID`, `OTP_EXPIRED`, `OTP_COOLDOWN`, `OTP_RATE_LIMIT`, `LOAN_NOT_FOUND`, and `LOAN_ALREADY_REPAID`. Malformed JSON returns a safe `400`; invalid loan UUIDs return `422` before reaching Prisma.

## Health

### `GET /health`

Returns `200`:

```json
{ "status": "ok" }
```

## Authentication

### `POST /auth/send-otp`

```json
{ "phoneNumber": "+919876543210" }
```

Spaces and common formatting are removed. This build accepts Indian mobile numbers beginning with 6–9. Returns `202` with the normalized number and timing metadata. The six-digit code is printed only in development server output.

```json
{
  "phoneNumber": "+919876543210",
  "expiresInSeconds": 300,
  "resendInSeconds": 30
}
```

### `POST /auth/verify-otp`

```json
{ "phoneNumber": "+919876543210", "otp": "123456" }
```

Returns the signed token and minimal user record. A successfully verified code is immediately deleted and cannot be reused.

## Loans

The API exposes rupee values as JSON numbers with up to two decimal places. PostgreSQL stores `amountPaise` as an integer, avoiding floating-point aggregation.

### `GET /loans`

Optional query: `status=OUTSTANDING` or `status=REPAID`.

```json
{
  "loans": [
    {
      "id": "uuid",
      "friendName": "Aarav Sharma",
      "amount": 2500,
      "currency": "INR",
      "dueDate": "2026-10-30",
      "status": "OUTSTANDING",
      "isOverdue": false,
      "receiptAvailable": false,
      "createdAt": "2026-10-22T10:00:00.000Z",
      "updatedAt": "2026-10-22T10:00:00.000Z",
      "repaidAt": null
    }
  ]
}
```

### `GET /loans/:id`

Returns `{ "loan": Loan }`. A missing loan and a loan owned by another user both return `404`, preventing record discovery across accounts.

### `POST /loans`

```json
{
  "friendName": "Aarav Sharma",
  "amount": 2500.5,
  "dueDate": "2026-10-30"
}
```

Returns `201` with `{ "loan": Loan }`. Names must contain 2–80 characters. Amounts must be ₹0.01–₹1,00,00,000 with no more than two decimal places. Past dates are accepted and become overdue immediately when they precede the configured local date.

### `PATCH /loans/:id/repay`

Returns the updated loan. Full repayment is atomic for this model. A second request returns `409 LOAN_ALREADY_REPAID`.

## Summary

### `GET /summary`

```json
{
  "currency": "INR",
  "totalLent": 12500,
  "totalRepaid": 4000,
  "outstandingAmount": 8500,
  "overdueAmount": 2500,
  "activeLoanCount": 3,
  "repaidLoanCount": 2,
  "overdueLoanCount": 1
}
```

Rules:

- `totalLent` is every original loan amount.
- `totalRepaid` includes loans in `REPAID` state.
- `outstandingAmount` includes loans in `OUTSTANDING` state.
- `overdueAmount` includes outstanding loans whose `dueDate` is before today.
- Due today is not overdue.
- Under full repayment, `totalLent = totalRepaid + outstandingAmount`.

The configured `APP_TIME_ZONE` defines today's calendar date; the default is `Asia/Kolkata`.

