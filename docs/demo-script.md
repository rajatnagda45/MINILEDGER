# 2–3 minute demo script

## 0:00–0:15 — Purpose

“MiniLedger is a mobile app for keeping track of money lent to friends. The key goal is to make what is outstanding and overdue immediately clear.”

## 0:15–0:35 — Mock OTP

Enter a phone number, request the code, show the six-digit OTP in the API terminal, and verify it. Mention the five-minute expiry, resend cooldown, attempt limit, and one-time use.

## 0:35–1:00 — Dashboard

Point to still-to-receive first, then total lent, repaid, and overdue. Show the loan filters and explain that every amount comes from the summary endpoint.

## 1:00–1:30 — Add a loan with a receipt

Add “Neha Kapoor”, ₹2,750, with a visible due date. Briefly trigger one validation message and correct it. In the optional Receipt section, choose a JPEG/PNG photo and show the thumbnail preview, then save and show the new entry without restarting.

## 1:30–1:55 — Overdue emphasis and receipt preview

Open a seeded overdue entry. Call out the red rail, explicit badge, due-date wording, and matching overdue total (due today is not overdue). Open the loan with the receipt, tap View to show the full image, and mention it is served from an authenticated, ownership-checked endpoint — never public.

## 1:55–2:15 — Repayment

Tap Mark repaid, show the confirmation, confirm it, and point to the refreshed status and dashboard totals.

## 2:15–2:40 — Engineering

Show the PostgreSQL/Prisma schema (loans + receipts metadata), integer-paise field, authenticated user-scoped query, and the passing test command (127 tests: 56 mobile + 71 backend, including authentication restoration, fail-closed native logout, production configuration, request failure classification, deterministic receipt concurrency, and a real-PostgreSQL concurrent-repayment test). Mention Expo, Express, TanStack Query, SecureStore, the tested ownership boundary, and that receipt bytes live in private storage while only metadata is in the database.

## 2:40–2:50 — Close

“That is the full MiniLedger journey: secure mock login, real persistence, exact summaries, overdue visibility, and repayment.”

Upload the final recording to Loom or Google Drive, enable reviewer access, test the link in a private window, then add it to the README. Do not add a placeholder URL.

