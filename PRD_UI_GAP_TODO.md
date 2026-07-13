# DanceGrid 开发清单

This file tracks the remaining work to move DanceGrid from the current React/Vite prototype to a pure PWA deployed on Cloudflare Pages.

## Current baseline

These items are already aligned in the current implementation:

- [x] Course status vocabulary matches PRD
  - `待开 / 已开 / 停课 / 请假`
  - `未收 / 已收 / 部分已收 / 超时未收`

- [x] Reconciliation logic is studio-grouped
  - Default view is the current month
  - Month navigation exists
  - Selected month cash-in is separated from billing month
  - One-click settle targets the previous month for that studio

- [x] Template editing does not rewrite historical course instances

- [x] Course instance fields are richer than the early mock prototype
  - Includes `template_id`, `content_tag`, `content_description`, `departure_minutes`, `actual_receivable_amount`, `actual_received_amount`, `music_note`, `attachments`, `created_at`, `updated_at`

- [x] Overdue unpaid is treated as a computed tag

- [x] Monthly copy rules are encoded for regular template-backed classes

## High Priority

These are the next blockers for a real deployable PWA.

- [x] Add IndexedDB persistence layer
  - Move the current in-memory/mock data to a real local store
  - Keep the UI API stable so screens do not need to care about storage internals
  - Seed first launch data only once

- [x] Add PWA support
  - Add manifest metadata
  - Register a service worker
  - Cache the app shell and static assets
  - Make the app installable on iPhone as a home-screen app

- [ ] Add Cloudflare Pages deployment path
  - Make the app deploy cleanly as static files
  - Confirm the build output works with Cloudflare Pages
  - Document the production URL and preview workflow
  - Bind the app domain to Cloudflare Pages and the invite subdomain to Worker

- [ ] Verify offline behavior
  - Open after first load without network
  - Refresh offline
  - Confirm local data is still readable and editable

- [ ] Add Cloudflare Worker invitation gate
  - First launch asks for an invite code
  - Worker validates invite code and seat availability
  - Local app caches a signed entitlement token
  - Expired / revoked entitlements must fail gracefully
  - Admin flow can create, revoke, and release invite seats

- [ ] Define beta seat admin flow
  - Issue single-use or batch invite codes
  - Revoke leaked or inactive seats
  - Reassign reclaimed seats to waitlist users
  - Keep the seat ceiling fixed at 100 for closed beta

## Medium Priority

These items improve correctness and reduce future rework.

- [ ] Split the single-file app into modules
  - `types`
  - `db`
  - `hooks`
  - `components`
  - `pages`

- [x] Finish studio archive / restore / soft delete flow

- [x] Add deletion confirmation with impact warning
  - Warn about affected templates and course instances

- [x] Align studio data model more strictly with PRD
  - `address`
  - `base_fee`
  - `fee_unit`
  - `pay_day`
  - `cancel_compensation_ratio`
  - `weekly_session_count`
  - `contact_name`
  - `contact_method`
  - `group_tag`
  - `note`

- [x] Add multi-weekday template selection

- [x] Make course creation rules stricter by type
  - Regular class prefers templates
  - Substitute / private / workshop keep manual fee entry explicit

- [x] Enforce `待开 + 已收` confirmation

- [ ] Expand month / week / list filtering

- [x] Expand course detail view fields

- [ ] Make calendar status colors match PRD consistently

- [ ] Add App Store buyout release path
  - Remove beta invite gate for public builds
  - Document one-time purchase entitlement flow
  - Keep price / payment method as a later decision
  - Keep the closed-beta Worker code isolated so the public build can drop it cleanly

## Low Priority

These are structural or future-proofing items.

- [ ] Add `user_id` to the data model for future multi-user expansion

- [ ] Refine naming consistency between UI and PRD

- [ ] Review whether some modal flows should become dedicated detail surfaces

## Release Checklist

Use this order for the next implementation pass:

1. Persistence
2. PWA installability
3. Cloudflare Pages deployment
4. Offline verification
5. Cloudflare Worker invite gate
6. Seat admin flow
7. Code split
8. Remaining PRD gaps
