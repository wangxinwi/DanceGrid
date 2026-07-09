# DanceGrid

DanceGrid is a local-first iPhone-oriented app for a street dance teacher to record class schedules and reconcile teaching fees.

This repository currently contains a polished React + Vite prototype aligned to `prd-v0.1.md`. The product direction is single-user, offline-first, and focused on fast class logging plus monthly fee reconciliation.

## What It Covers

DanceGrid v0.1 is designed around these core workflows:

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

## Product Rules

The project follows these constraints from `prd-v0.1.md` and `AGENTS.md`:

- Local-first only
- iPhone-first
- Single-user in v0.1
- No cloud sync
- No import/export
- No multi-device collaboration
- No push notifications
- No automatic archiving
- No complex analytics dashboards
- No online attachment processing

## Current Prototype

The current UI prototype focuses on:

- A mobile-first app shell
- Month, week, and day schedule views
- Monthly reconciliation cards
- Studio and template management screens
- Class detail and repeat-rule dialogs
- A calm, practical visual style with blue, black, and white as the main palette

The current codebase is still a prototype, so some product behaviors are represented as static demo data and UI flows rather than full persistence or production data handling.

## Tech Stack

- React
- Vite
- TypeScript
- Tailwind CSS
- shadcn/ui
- Radix UI
- Lucide

## Scripts

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Project Structure

- `src/` - React application source
- `src/components/ui/` - reusable UI primitives
- `docs/` - supporting product and UI notes
- `prd-v0.1.md` - product source of truth
- `AGENTS.md` - repo operating rules for agents

## Notes For Contributors

- Read `prd-v0.1.md` before changing product behavior.
- Read `AGENTS.md` before making repo changes.
- Keep history traceable and avoid broadening scope beyond v0.1.
- Prefer explicit, reviewable changes over clever abstractions.

