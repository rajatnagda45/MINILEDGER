# Submission readiness checklist

Evidence recorded on 23 October 2026. “Manual action” means the repository cannot honestly prove the item without a human-operated simulator/device or external recording service.

| Item | Status | Evidence or next action |
|---|---|---|
| Existing implementation inspected | Verified | Screens, components, API client, authentication, services, Prisma schema, tests, configuration, docs, and Git history reviewed. |
| Baseline verification recorded | Verified | The latest improvement pass began from a clean `main` synchronized with `origin/main`. The older `cffb829` reference in RC1 evidence is explicitly historical, not the current submission revision. |
| Existing user changes preserved | Verified | Receipt integrity, contrast, mobile test, resilience, documentation, and screenshot-removal changes remain present in the committed release source. |
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
| Automated tests executed | Verified | 127/127 tests passed across 23 files: 56 mobile tests plus 71 backend tests, including authentication restoration, fail-closed native logout, protected routing, production configuration, request failure classification, OTP boundaries, JWT pinning, receipt validation/consistency, deterministic replacement concurrency, storage permissions, and a real-PostgreSQL concurrent-repayment integration test. |
| TypeScript executed | Verified | All workspaces passed strict checking. |
| Linting executed | Verified | Expo ESLint passed. |
| Production bundles checked | Verified | iOS, Android, and web exports completed successfully. |
| Prisma checked | Verified | Schema validation, migration, and PostgreSQL persistence workflow completed. |
| Documentation matches implementation | Verified | README, API, architecture, interview, smoke-test, and demo documents reviewed after changes. |
| No secrets committed | Verified | `.env` and `.env.local` ignored; only placeholder examples tracked. |
| RC1 release checklist | Verified | Automatic, native-runtime, and developer-only tasks are separated in `docs/release-candidate-checklist.md`. |
| Final Git diff reviewed | Verified | The targeted logout, receipt-concurrency, test, and documentation changes were reviewed and remain uncommitted for developer approval, as required by this brief. `git diff --check` passed. |
| Demo script ready | Verified | `docs/demo-script.md`. |
| Recording uploaded | Developer-reported; external check pending | The developer reports the separate recording is complete. Its URL was not supplied here, so access permissions, duration, playback, and workflow coverage remain unverified. |
| Receipt upload | Verified | Implemented end to end: bounded JPEG/PNG validation and 5 MB limit, private filesystem storage with server-generated keys, authenticated ownership-scoped retrieval/deletion, per-loan replacement serialization, 27 receipt API regression tests plus dedicated image/storage tests, and a real upload/preview/delete flow against PostgreSQL. S3 remains a documented extension. |
| Native simulator/device visual QA | Requires manual action | Complete `docs/manual-smoke-test.md` on at least one target before submission. |

