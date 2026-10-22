# RC1 release-candidate checklist

Evidence recorded on 23 October 2026. The isolated rehearsal used `main` at `cffb8295787f5ff53772dac6ad6e75fe8240ed7c`; the targeted RC1 hardening described below remains uncommitted for developer review. A checked item means the command or inspection completed successfully in this audit; unchecked items are not claimed as verified.

## A. Automatically verified

- [x] Main checkout and isolated clone both matched commit `cffb8295787f5ff53772dac6ad6e75fe8240ed7c` with clean tracked worktrees before this checklist was added.
- [x] Fresh isolated-clone install completed with `npm ci` using Node 24.18.0 and npm 11.16.0.
- [x] Root and mobile environment examples match the variables consumed by the application; temporary verification values contained no production credentials.
- [x] Prisma Client generation and schema validation completed in the isolated clone.
- [x] All three migrations applied to a dedicated `miniledger_rc1_cffb829` database, and migration status reported up to date. The database was removed after verification; the developer database was not changed.
- [x] TypeScript passed for the mobile, backend, and shared workspaces.
- [x] Expo ESLint passed.
- [x] The isolated commit ran its original 93 tests with no failures or skips, including the real-PostgreSQL concurrent-repayment test.
- [x] After RC1 production-configuration and request-failure coverage was added, the current worktree passed all 97 tests with no failures or skips: 27 mobile tests and 70 backend tests.
- [x] Backend test discovery is scoped to source tests, so a prior production build cannot cause compiled `dist/tests` copies to run twice; the post-build suite still reports exactly 70 backend tests.
- [x] Expo web, iOS, and Android exports completed from both the isolated clone and the current RC1 worktree. Export success is not treated as native runtime verification.
- [x] OTP, JWT, ownership, production configuration, receipt validation/privacy/cleanup, conditional receipt deletion, integer-paise calculations, overdue boundaries, duplicate submission protection, and concurrent repayment coverage passed.
- [x] Frontend cancellation remains distinct from timeout and network failure in the API client; all three branches have regression coverage, and read requests plus web receipt previews clean up their abort resources.
- [x] `npm audit --json` was reviewed without suppression or forced upgrades: 52 findings (49 high, 3 moderate), 0 critical. No compatible direct patch/minor update is available within the current Expo SDK 54, React Native 0.81, Prisma 6, or Jest 29 constraints.
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

- [ ] Review this RC1 documentation diff and explicitly approve any commit and push; none were performed by this audit.
- [ ] Record the real app using [demo-script.md](demo-script.md), upload it to Loom or Google Drive, enable reviewer access, and test the link in a private window.
- [ ] Insert the genuine recording URL under `README.md` → **Demo recording**. Do not add a placeholder or fabricated URL.
- [ ] Schedule the dependency remediation as a separate, tested upgrade: Expo SDK 58 / React Native 0.88 and Router first, Prisma 7 separately, then Jest 30. Do not use `npm audit fix --force` on the release candidate.
- [ ] After native QA and the demo link are complete, run `npm test`, `npm run typecheck`, `npm run lint`, and the three Expo exports once more before tagging or submitting.
