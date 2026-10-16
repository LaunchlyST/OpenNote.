# OpenNote Free — what is enforced, and what needs a decision

## In place now

- Every account has a `plan` stored on its user row. New accounts get `free`;
  existing accounts were back-filled to `free`. Nothing was deleted.
- The plan can only be set by the server. Sign-up and profile updates cannot
  change it (Better Auth `input: false`; tested).
- `GET /api/plan` returns the signed-in user's plan and its features.
- `POST /api/billing/checkout` always refuses: Pro cannot be bought.
- `/api/pro/*` is guarded by `requirePlan('pro')`, so any Pro-only endpoint
  added later is closed to Free accounts on the server, not just in the UI.
- Account settings shows "OpenNote Free · Pro coming soon".
- The pricing page shows Pro as **Coming Soon** with no purchase path.

Free includes everything the pricing page lists as available: personal
calendar, day/week/month views, creating and managing events, basic notes,
daily scheduling, colour-coded calendars, desktop browser access.

## Needs your decision before enforcing

The pricing page promises Pro "Unlimited notes" and "Unlimited calendar
events", which implies Free has limits — but no numbers are defined anywhere.
**No limits are enforced today.** Proposed, for approval:

| Limit | Proposed Free value | Notes |
|---|---|---|
| Notes | 100 | Existing users above it keep their notes but cannot add more. |
| Calendar events | 1,000 | Generous for personal use. |
| Custom calendars | 6 | 4 come by default. |

Once approved, limits are enforced in `server/workspace.ts` (the save
endpoint) and shown in the UI.

## Tasks

The brief mentions tasks, but OpenNote has no tasks feature today and the
Free plan on the pricing page does not list one ("Task assignments" is a
planned Business feature). Building tasks is a new feature with its own UI and
needs a design decision first.
