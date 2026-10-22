# Submission readiness checklist

Evidence recorded on 22 October 2026. “Manual action” means the repository cannot honestly prove the item without a human-operated simulator/device or external recording service.

| Item | Status | Evidence or next action |
|---|---|---|
| Existing implementation inspected | Verified | Screens, components, API client, authentication, services, Prisma schema, tests, configuration, docs, and Git history reviewed. |
| Baseline verification recorded | Verified | Clean `main`; baseline had 17 passing tests, strict types, and compatible Expo packages. |
| Existing user changes preserved | Verified | Baseline working tree was clean; prior commits were not amended or rewritten. |
| Required assignment functionality preserved | Verified | Authentication, loans, repayment, summaries, mobile routes, and PostgreSQL contracts remain intact. |
| UI/UX improvements implemented | Verified | Exact amounts, separate card actions, stable summary loading shape, responsive width, formatted phone entry, stronger accessibility, and unsaved-form protection. |
| Login and OTP logic verified | Verified | Automated issue, wrong-code, expiry, reuse, and production-logging tests pass. Full mobile touch flow still needs device confirmation. |
| Loan creation and repayment verified | Verified | Automated API suite and real PostgreSQL smoke workflow. |
| Financial summaries verified | Verified | Integer-paise tests, invariant assertion, and real database summary before/after repayment. |
| Overdue date boundaries verified | Verified | Yesterday, today, tomorrow, and repaid cases covered. |
| Cross-user controls verified | Verified | Read, repayment, list, summary, and receipt isolation tests pass; cross-user receipt upload/download/delete return 404. |
| Mobile network configuration reviewed | Verified | Environment-based base URL, iOS/Android/device table, timeout, bearer header, and 401 logout path documented. |
| Loading, empty, error, success states reviewed | Verified | Code review plus lint/type/bundle gates; native visual behavior requires manual confirmation. |
| Accessibility improvements checked | Verified in code | Roles, labels, selected/disabled/busy states, non-colour status text, separate targets, and live announcements. VoiceOver/TalkBack requires manual action. |
| Automated tests executed | Verified | 36/36 tests passed across auth, loans, and receipts. |
| TypeScript executed | Verified | All workspaces passed strict checking. |
| Linting executed | Verified | Expo ESLint passed. |
| Production bundles checked | Verified | iOS, Android, and web exports completed successfully. |
| Prisma checked | Verified | Schema validation, migration, and PostgreSQL persistence workflow completed. |
| Documentation matches implementation | Verified | README, API, architecture, interview, smoke-test, and demo documents reviewed after changes. |
| No secrets committed | Verified | `.env` and `.env.local` ignored; only placeholder examples tracked. |
| Final Git diff reviewed | Verified | Required before final push; recorded in final report. |
| Demo script ready | Verified | `docs/demo-script.md`. |
| Recording uploaded | Requires manual action | Record 2–3 minutes, upload, verify sharing in a private window, and add the genuine URL. |
| Receipt upload | Verified | Implemented end to end: secure JPEG/PNG upload with signature validation and 5 MB limit, private filesystem storage with server-generated keys, authenticated ownership-scoped retrieval/deletion, 17 regression tests, and a real upload/preview/delete flow against PostgreSQL. S3 remains a documented extension. |
| Native simulator/device visual QA | Requires manual action | Complete `docs/manual-smoke-test.md` on at least one target before recording. |

