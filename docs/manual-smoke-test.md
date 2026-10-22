# Manual mobile smoke test

Run this on at least one iOS or Android target before recording.

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
9. Pull to refresh and reopen the overdue loan detail.
10. Cancel the repayment confirmation once, then confirm it. Verify overdue styling clears and totals move to repaid.
11. Restart the app and confirm the session restores.
12. Sign out and confirm the dashboard is no longer reachable with back navigation.
13. Check keyboard avoidance, long names, large Dynamic Type, VoiceOver/TalkBack labels, narrow screens, and dark system navigation bars.
14. Check an amount with paise and a large Indian-grouped amount; confirm neither summary value is compacted or rounded.

Record any platform-specific issue before submission. Do not use a screen recording to hide a failed interaction.

