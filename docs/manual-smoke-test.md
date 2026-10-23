# Manual mobile smoke test

Run this on at least one iOS or Android target before submission. A completed screen recording is useful evidence, but it does not replace this device checklist.

1. Start PostgreSQL, apply migrations, and start the API.
2. Start Expo with the correct device-specific `EXPO_PUBLIC_API_URL`.
3. Launch fresh and confirm the session-restoration screen leads to login.
4. Submit an invalid phone number and confirm inline validation.
5. Submit a valid number, read the server OTP, paste all six digits, and sign in.
6. Confirm empty, loading, and retry states using a new account and a temporarily stopped API.
7. Add a future loan and confirm it appears as active and updates total lent/outstanding.
   - Enter partial form data, navigate back, and verify the discard warning appears.
   - Try an impossible typed web date such as `2026-02-30` and verify inline rejection.
8. Add a past-due loan and confirm the red rail, overdue badge, explicit due copy, summary amount, and count.
9. Attach a receipt during add-loan:
   - Tap **Choose photo**, grant (then on a later run, deny) library permission, and confirm the permission-denied message.
   - On a device, tap **Take photo**, grant/deny camera permission, and confirm capture and the denial message.
   - Confirm the thumbnail preview, filename/size, and **Replace**/**Remove** before submitting. Cancel the picker and confirm nothing is attached.
10. Pull to refresh and reopen the overdue loan detail.
11. On the loan detail, confirm the receipt thumbnail loads, **View** opens the full-screen viewer and dismisses (back gesture / close button), **Replace** swaps the image, and **Remove** asks for confirmation and clears it. Confirm totals are unchanged by any receipt action.
12. With the API temporarily stopped, open a loan with a receipt and confirm the preview shows a recoverable "couldn't load" state rather than a crash.
13. Cancel the repayment confirmation once, then confirm it. Verify overdue styling clears and totals move to repaid.
14. Restart the app and confirm the session restores.
15. Sign out and confirm the dashboard is no longer reachable with back navigation.
16. Check keyboard avoidance and safe-area insets (notch/home indicator), long names, large Dynamic Type, VoiceOver/TalkBack labels (including the receipt view/remove controls), narrow screens (~360–390px), and dark system navigation bars.
17. Check an amount with paise and a large Indian-grouped amount; confirm neither summary value is compacted or rounded.

Record any platform-specific issue before submission. Do not treat a screen recording as proof of interactions it does not show.

