# Loyalio — private demonstration platform

An owner-private, persistent loyalty demonstration app using React/Vinext and Cloudflare D1. Intended for showing potential merchants a complete customer journey before company formation or commercial launch.

## Demonstration flow
1. Create a business or use the fictional Café Noma demo (eight example customers; no deliverable email addresses).
2. Configure business name, card color, logo and base reward.
3. Open **Klanten werven**; view/download via browser print the QR counter poster and test the customer enrollment page.
4. Customer enters an alias, optional email and optional marketing consent, then receives a QR card.
5. At the till, search/scan the card, award stamps, choose among reward tiers, redeem and see the automatically refreshed web-card balance.
6. Show clearly labeled Apple/Google Wallet browser mockups. These are not installed passes.
7. Inspect activity, correct transactions, export customer CSV and review return-visit statistics.
8. Save campaign drafts with consent-based segments; nothing is sent.
9. Customer can withdraw marketing consent or delete their test card and its ledger.

## Implemented boundaries
- Authenticated identity and owner/staff permissions for each merchant.
- Owner-only enrollment demonstration and private platform access. Existing audience preserved.
- Configured staff can operate the till, but cannot manage program settings, reward definitions, campaigns or team.
- All merchant data is persisted server-side in D1, with indexes and versioned schema migrations.
- Atomic reward balance checks and idempotent ledger mutation; corrections are recorded as compensating transactions and cannot create a negative balance.
- QR cards expose business/reward/balance, not customer alias or email.
- PNG/JPEG/WebP logo upload stored in D1, max 100 KB source file. No arbitrary HTML/SVG upload.
- CSV export protects formula-prefixed cell values.
- No mail, SMS, push notifications, purchases or charges are sent by this demo.

## Wallet implementation and activation blockers
The server contains Apple `.pkpass` generation and Google Generic Pass JWT signing, but no real issuer credentials are present and no real-device issuance has been verified. `.env.example` lists server-only secret names. Configure those through hosted secret controls, never browser code or source files.

Apple requires a Developer membership, matching Pass Type ID, Team ID, pass certificate/private key and WWDR certificate. Google requires an issuer account, existing Generic Class, authorized service account and publishing access for non-test users. Google pass type/class configuration should be reviewed with the final issuer setup before launch.

The current real Wallet pass implementation is a snapshot. Automatic Apple update web service/APNs and Google object synchronization are not implemented. Web cards do refresh from the server while open. Browser Wallet previews are clearly labeled simulations.

## Before a commercial launch
Public/self-service merchant onboarding and external customer access need an explicit launch/access change. Complete real Wallet updates and physical-device tests, provider-backed email delivery, billing, privacy terms for the selected market, monitoring, rate limits and backup/restore validation. Offline stamp/reward operations are not supported. Staff are configured without sending invitations. Browser visual/camera QA is unverified because the supported browser QA tool is unavailable in this environment.

## Checks
- `node node_modules/typescript/bin/tsc --noEmit`
- `python tests/ledger_test.py`
- `node tests/api-flow.mjs` — runs the real route handlers against an in-memory SQLite D1 adapter with mocked authentication. Covers enrollment, data isolation, role restrictions, transactions, consent and deletion. No preview server is started and no external service is called.
- Sites build helper, then source synchronization and private deployment.

Migrations already published are immutable. Append migrations with `node node_modules/drizzle-kit/bin.cjs generate`.
