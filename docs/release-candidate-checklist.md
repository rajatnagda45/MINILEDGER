# RC1 release-candidate checklist

Evidence updated on 23 October 2026. The SHA and database name below describe the historical isolated RC1 rehearsal; they are not the current submission revision. The latest quality-improvement worktree was based on a clean, synchronized `main` and remains uncommitted for developer review, as requested. A checked item means the command or inspection actually completed; unchecked items are not claimed as verified.

## A. Automatically verified

- [x] Historical RC1 evidence: the main checkout and isolated clone matched commit `cffb8295787f5ff53772dac6ad6e75fe8240ed7c` with clean tracked worktrees before the original checklist was added.
- [x] Fresh isolated-clone install completed with `npm ci` using Node 24.18.0 and npm 11.16.0.
- [x] Root and mobile environment examples match the variables consumed by the application; temporary verification values contained no production credentials.
- [x] Prisma Client generation and schema validation completed in the isolated clone.
- [x] Historical RC1 evidence: all three migrations applied to the dedicated `miniledger_rc1_cffb829` database, and migration status reported up to date. The database was removed after verification; the developer database was not changed.
- [x] TypeScript passed for the mobile, backend, and shared workspaces.
- [x] Expo ESLint passed.
- [x] The isolated commit ran its original 93 tests with no failures or skips, including the real-PostgreSQL concurrent-repayment test.
- [x] The current worktree passed all 127 tests with no failures or reported skips: 56 mobile tests and 71 backend tests, including authentication restoration, fail-closed native logout, protected routing, production configuration, request-failure coverage, and concurrent receipt replacement.
- [x] Backend test discovery is scoped to source tests, so a prior production build cannot cause compiled `dist/tests` copies to run twice; the post-build suite reports exactly 71 backend tests.
- [x] Expo web, iOS, and Android exports completed from both the isolated clone and the current RC1 worktree. Export success is not treated as native runtime verification.
- [x] OTP, JWT, ownership, production configuration, receipt validation/privacy/cleanup, serialized receipt replacement, conditional receipt deletion, integer-paise calculations, overdue boundaries, duplicate submission protection, and concurrent repayment coverage passed.
- [x] Frontend cancellation remains distinct from timeout and network failure in the API client; all three branches have regression coverage, and read requests plus web receipt previews clean up their abort resources.
- [x] `npm audit --json` was reviewed without suppression or forced upgrades: 52 package-level findings (49 high, 3 moderate), 0 critical. Direct roots are Expo/React Native/Jest tooling, Prisma CLI, Expo Router, and `@types/jest`; npm's available remediations require coordinated major upgrades. Stage Expo SDK/React Native/Router first, Prisma separately, then Jest/types after submission.
- [x] README screenshot links resolve to existing implementation captures, and the public GitHub repository returned HTTP 200.

## B. Requires a simulator, emulator, or physical device

- [ ] Verify OTP entry, paste/autofill, session restoration after force close, logout, and protected back navigation.
- [ ] Verify keyboard avoidance, safe areas, native date picker behavior, long content, large amounts, narrow screens, and large Dynamic Type.
- [ ] Verify camera and photo-library permission grant and denial, picker cancellation, receipt preview/replacement/removal, authenticated image loading, and viewer dismissal.
- [ ] Verify network-loss and retry behavior plus repayment confirmation and refreshed totals.
- [ ] Verify VoiceOver or TalkBack labels and focus order.
- [ ] For a physical phone, set `EXPO_PUBLIC_API_URL` to the Mac's reachable LAN address; do not use `localhost` or `127.0.0.1` on the phone.

Complete [manual-smoke-test.md](manual-smoke-test.md) on at least one target. This audit had no `simctl`, `adb`, emulator, or connected device, so these items remain **NOT VERIFIED**.

## C. Requires developer action or approval

- [ ] Review this quality-improvement diff and explicitly approve any commit and push; none were performed by this audit.
- [x] Developer reports that the separate assignment recording is complete. Its URL was not supplied to this audit, so playback, duration, workflow coverage, and reviewer permissions are not independently verified.
- [ ] Before submission, open the genuine recording URL in a private window and confirm that it plays without requesting access. Submit it separately; the README intentionally contains no placeholder or recording section.
- [ ] Schedule the dependency remediation as a separate, tested upgrade: Expo SDK 58 / React Native 0.88 and Router first, Prisma 7 separately, then Jest 30. Do not use `npm audit fix --force` on the release candidate.
- [ ] After native QA and the external recording-link check are complete, run `npm test`, `npm run typecheck`, `npm run lint`, and the three Expo exports once more before tagging or submitting.
