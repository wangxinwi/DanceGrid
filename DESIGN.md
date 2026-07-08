# DESIGN

## Product Surface
DanceGrid is a mobile-first product UI for schedule tracking and fee reconciliation. The visual system should feel like a professional task tool, not a lifestyle app.

## Theme
Light theme only for v0.1.
The interface is used in low-light rehearsal spaces and after class, but the product is operational rather than atmospheric, so the light theme should stay neutral, crisp, and readable.

## Color Strategy
Restrained.

### Palette
- Background: `#F3F5F7`
- Surface: `#FFFFFF`
- Surface Alt: `#EAF0F5`
- Primary: `#17324D`
- Primary Soft: `#DCE7F5`
- Text Strong: `#111827`
- Text Muted: `#5B6472`
- Border: `#D9E0E7`
- Success: `#2E7D5B`
- Warning: `#C47A1A`
- Danger: `#C14B46`
- Weekend Tint: `#EEF2F6`

## Typography
- Use a single clean sans-serif system stack.
- Prefer `-apple-system`, `BlinkMacSystemFont`, `SF Pro Text`, `Segoe UI`, `sans-serif`.
- Use tabular numbers for time and fee values.
- Titles should be concise; dense data should stay readable without fluid scaling.

## Layout
- Mobile-first, iPhone-optimized layout.
- Month view is the default entry point.
- Month, week, and day are peers within the same workbench.
- Week and day views use a vertical time axis on the left.
- Bottom action button stays fixed for fast add flows.

## Components
- Top bar with title, month/date, and quick actions.
- Segmented control for Month / Week / Day.
- Calendar grid with weekday header `M T W T F S S`.
- Time-axis schedule lists for week and day views.
- Course cards with clear status and payment badges.
- Reconciliation group cards by studio.
- Bottom sheets for add/edit and detail actions.

## Motion
- Keep motion short and functional, around 150–220ms.
- Use transitions for view switching, bottom sheets, and state changes only.
- Honor reduced motion with instant state changes.

## Interaction Notes
- Current day should be obvious without being loud.
- Weekend columns should be visually distinct but not dominate the surface.
- Status colors must always be paired with text labels.
- Common actions must be discoverable from the schedule and from the detail view.

## Visual Guardrails
- Avoid decorative gradients and glass effects.
- Avoid oversized corner radii on cards and panels.
- Avoid nonstandard controls or custom metaphors for core tasks.
- Avoid dense shadows when borders already define separation.
