# DanceGrid Agent Guide

This file is the primary instruction source for AI agents working on this repo.
If anything here conflicts with other notes, `prd-v0.1.md` is the product source of truth.

## Project Summary

DanceGrid is a local-first iPhone app for a street dance teacher to record class schedules and reconcile teaching fees.

The product is for single-user use in v0.1. Future multi-user support should be anticipated in data modeling, but not implemented now.

## Read First

Before making changes, read:

1. `prd-v0.1.md`
2. `AGENTS.md`

If a task touches UI polish, also review the current prototype or screenshots before changing anything.

## Core Product Rules

- Local-first only.
- iPhone-first.
- Single-user in v0.1.
- No cloud sync.
- No import/export.
- No multi-device collaboration.
- No push notifications.
- No automatic archiving.
- No complex analytics dashboards.
- No online attachment processing.

## Product Principles

- Prioritize speed for frequent actions.
- Keep the app simple and operational.
- Make history traceable.
- Preserve room for future expansion without shipping future scope now.
- Prefer explicitness over cleverness.

## UX and UI Rules

- Overall style should feel like a practical calendar/tool app.
- Visual tone: clean, calm, functional, and easy to scan.
- Main palette direction: blue, black, white.
- Avoid gradients.
- Avoid flashy or complex motion.
- Important information should be visible immediately.
- Do not drift into generic AI-generated UI.
- Do not imitate Claude too closely. Keep the calm and clarity, but give the product its own visual signature.

## Frontend Stack Rules

- Current app code is React + Vite unless the user explicitly asks for a migration.
- The preferred target UI stack for future implementation is Next.js + React with shadcn/ui, Radix UI, and Lucide.
- When adding or revising UI, prefer reusable components from the existing project first.
- If the project adopts shadcn/ui, use shadcn/ui components as the primary application UI layer.
- Use Radix UI primitives for low-level interactive behavior where needed.
- Use Lucide for icons.
- Do not introduce a second UI library unless explicitly requested.
- Do not introduce a second icon library unless explicitly requested.
- If a change can be expressed with the current component set, do that instead of inventing a new one.

## Allowed UI / Icon Libraries

- shadcn/ui
- Radix UI
- Lucide

## Disallowed UI / Icon Libraries Without Approval

- Ant Design
- Material UI / MUI
- Chakra UI
- Mantine
- Blueprint
- Evergreen
- Semantic UI
- React Bootstrap
- Font Awesome
- Heroicons
- Tabler Icons
- Remix Icon
- Bootstrap Icons

## Business Domain Rules

### Studio

A studio is both the class location and settlement unit.

Studio fields may include:

- Name
- Address
- Base fee
- Fee unit
- Pay day
- Cancel compensation ratio
- Contact name
- Contact method
- Notes
- Group tag

### Course Types

v0.1 supports:

- Regular class
- Substitute class
- Studio private class
- Student private class
- Small group class
- Workshop

Rules:

- Regular classes come from templates.
- Substitute classes, private classes, and workshops require manual fee entry.
- Course type is used for filtering, stats, and reconciliation.

### Status Rules

Class status:

- Pending
- Held
- Canceled
- Leave

Payment status:

- Unpaid
- Paid
- Partially paid
- Overdue unpaid

Important combinations:

- Class status and payment status are independent.
- Held + unpaid is allowed.
- Canceled + paid is allowed.
- Pending + paid is discouraged and should trigger a confirmation prompt.

## v0.1 Scope

### In Scope

- Studio management
- Course template management
- Course instance management
- Month view
- Week view
- List view
- Daily detail view
- Course duplication
- Monthly copy of regular classes
- Reconciliation center
- Local data storage
- Local password protection

### Out of Scope

- Cloud sync
- Automatic archiving
- Import/export
- Multi-device sync
- Push reminders
- Complex reports
- Online attachment handling

## Data and Editing Rules

- Historical course instances must not be overwritten by template edits.
- Template changes do not retroactively rewrite history.
- Use soft delete or archive behavior for stable records when possible.
- Prefer confirmation before destructive actions.
- Deletions should warn about affected templates and course instances.

## Monthly Copy Rules

When copying the previous month:

- Copy only regular classes generated from templates.
- Do not copy substitute classes.
- Do not copy canceled records.
- Do not copy payment status.
- Do not copy class status.
- New records should default to `Pending + Unpaid`.
- Preserve original content, time, and notes.
- If target-month conflicts exist, prompt for overwrite, skip, or manual keep.

## Reconciliation Rules

- Reconciliation is grouped by studio.
- Default view is the current month.
- Show totals for:
  - Total sessions
  - Receivable amount
  - Received amount
  - Outstanding difference
  - Canceled sessions
  - Compensation amount
  - Expected pay day
  - Current month progress
- Overdue unpaid is a tag, not a modification to the base amount.

## Pay Day Rules

- Pay day supports 1 to 31.
- For 29, 30, or 31, if the target month does not contain that day, show an explicit warning.
- The user may choose to map to the last day of the month or change the setting.

## Development Workflow

1. Read the PRD and identify the exact scope.
2. Confirm the screen, flow, or rule being changed.
3. Preserve all v0.1 exclusions.
4. Implement the smallest correct change.
5. Verify UI, edge cases, and domain rules.
6. Do not add future scope unless explicitly requested.

## When Designing UI

- Start from task clarity, not decoration.
- Keep the primary action obvious.
- Show state clearly.
- Make empty, loading, error, and disabled states explicit.
- Use spacing and hierarchy to reduce cognitive load.
- Prefer stable, legible layouts over novelty.
- Default to the approved UI stack and icon set above.

## When Writing Code

- Prefer small, reviewable changes.
- Keep data models aligned with the PRD.
- Handle edge cases explicitly.
- Add tests when changing business rules or state transitions.
- Do not silently broaden the product scope.

## If Unsure

Ask before:

- Adding sync, export, reminders, or multi-user behavior
- Changing any business rule in the PRD
- Redesigning the overall visual direction
- Introducing a new data model that could affect history or reconciliation

## Success Criteria

A good change for this repo should:

- Match the PRD
- Keep the app local-first
- Reduce user effort
- Preserve historical accuracy
- Make reconciliation faster
- Keep the UI clear and calm
