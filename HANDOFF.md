# Project handoff — Cleburne Cafeteria Regulars Club

Everything needed to pick this project up cold. Written 2026-09-08.

## What this is

A leaderboard app for the regular customers of Cleburne Cafeteria in Houston. It began as a
gag gift for the owner, George Mickelis, and grew into a small two-role product.

- **Regulars** create their own account, log each meal with the exact amount spent, and see
  their own spend, visit count, average plate, and their rank as a bare number
  ("You are 9th of 42 Regulars"). They never see anyone else's name or numbers.
- **George** has one screen: the full leaderboard, plus a share button and a printable QR
  code for recruiting customers. He cannot add, edit, or delete anybody.

## Current status

| Piece | State |
| --- | --- |
| App code | ✅ Done, deployed |
| Database schema and security rules | ✅ Written and applied to Supabase |
| GitHub Pages deploy pipeline | ✅ Automatic on every push |
| Supabase project connected | ✅ URL and anon key committed in `.env.production` |
| Owner account for George | ⬜ Not created yet (one SQL statement, below) |
| Email delivery to real customers | ⬜ **Blocked**, see "The one unfinished thing" |
| End-to-end test with a real signup | ⬜ Not yet confirmed by a human |

**Live app**: https://tlk2william-cpu.github.io/cleburneapp/
**Demo mode** (fake local data, no database, includes a view-as-George toggle):
https://tlk2william-cpu.github.io/cleburneapp/?demo=1
**Supabase project ref**: `mznhlirwckrqmnygxevs`
**Repo default branch**: `claude/cleburne-cafeteria-leaderboard-wbc3dm` (deploys from here)

## The one unfinished thing

Email sign-in works by magic link. Supabase's built-in email sender allows only **2 messages
per hour across the whole project** and refuses to deliver to anyone who is not on the
Supabase team, so customers cannot currently sign up.

A Resend account exists. Two steps remain:

1. **Connect Resend as custom SMTP.** Create an API key in Resend (Sending access), then in
   Supabase go to **Authentication → Emails → SMTP Settings** and enter:

   | Field | Value |
   | --- | --- |
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | the `re_...` API key |
   | Sender email | see step 2 |
   | Sender name | `Cleburne Regulars` |

   Then raise the cap at **Authentication → Rate Limits** (defaults to 30/hour once custom
   SMTP is on).

2. **Verify a sending domain in Resend.** This is the actual blocker. Resend's test sender
   `onboarding@resend.dev` only delivers to the Resend account owner's own address, so it is
   fine for testing and useless for customers. Verifying a domain means adding a few DNS
   records (SPF/DKIM) at whatever registrar holds the domain. Using a subdomain such as
   `mail.example.com` keeps this isolated from any existing business email. No domain has
   been chosen yet.

Until step 2 is done, only the Resend account owner's address can receive sign-in links.

## Also outstanding

**Make George an owner.** Every account starts as a regular. After the person signs in once,
run this in the Supabase SQL editor:

```sql
update public.profiles
set role = 'owner'
where id = (select id from auth.users where email = 'george@example.com')
returning display_name, role;
```

No rows returned means that address has not signed in yet. Reverse it by setting the role
back to `'regular'`.

**Set the auth URLs**, if not already done: **Authentication → URL Configuration**, Site URL
and Redirect URLs both set to `https://tlk2william-cpu.github.io/cleburneapp/`. Magic links
land in the wrong place without this.

## How it is built

React 18 + Vite, no router, no state library. Supabase for Postgres and auth. GitHub Pages
for hosting. About 1,500 lines total.

| File | Responsibility |
| --- | --- |
| `supabase/schema.sql` | Tables, row-level security, ranking functions. Idempotent, safe to re-run. |
| `src/App.jsx` | Auth gate, first-run naming step, routes to owner or regular UI |
| `src/Regular.jsx` | Log a meal, list of your meals, your standing |
| `src/Owner.jsx` | Leaderboard, native share sheet, QR code |
| `src/lib/api.js` | Every data call, plus the demo-mode fake behind the same interface |
| `src/lib/supabase.js` | Client construction, `isDemo` / `isConfigured` flags |
| `src/ui.jsx` | Money formatting, cents parsing, confetti, bottom sheets |
| `src/styles.css` | All styling, tokens in `:root` |
| `.github/workflows/deploy.yml` | Build and publish to Pages on push |

### Data model

```
profiles (id → auth.users, display_name, role 'regular'|'owner', created_at)
visits   (id, user_id → profiles, ate_on date, amount_cents int, note, created_at)
```

Money is stored as whole cents, never floats. Amounts are capped at $1,000 per meal and
cannot be dated in the future.

### Security model, which is the part worth understanding

The privacy split is enforced in the database, not in the UI:

- A regular can select, insert, update and delete only rows where `user_id = auth.uid()`.
- `my_dashboard()` is `SECURITY DEFINER`. It computes rank across everyone but returns only
  the caller's own numbers plus their position and the size of the field. Other people's
  amounts never leave the database.
- `leaderboard(win)` raises an exception unless `is_owner()`. Even for George it returns
  per-person totals only, never individual visit rows.
- Nobody can promote themselves: the insert policy pins `role = 'regular'`, and `update` on
  `profiles` is granted **per column** (`display_name` only), so the role column is
  unreachable from the client.

Windows are `week` (Sunday start), `month`, `year`, `lifetime`, all evaluated in
`America/Chicago` so days roll over at midnight in Houston rather than 6pm UTC.

### Testing that was actually done

- The schema was loaded into a real Postgres 16 instance with a stubbed `auth` schema, then
  exercised: cross-user reads, inserting a visit under another user's id, self-promotion to
  owner, calling the owner-only leaderboard as a regular, negative amounts, future dates.
  All correctly rejected. Ranking was checked across all four windows, including a user with
  no visits in the current window.
- That testing caught a real bug worth remembering: `my_dashboard()` originally filtered to
  the calling user in the same SELECT as the `rank()` window function. SQL applies WHERE
  before window functions, so every regular would have been told they were in 1st place.
  Rank is now computed in its own CTE before filtering.
- The full UI was driven in a headless browser at iPhone 13 and iPhone SE sizes in demo
  mode: signup, naming, logging with cents, backdating, editing, deleting, window switching,
  the owner leaderboard, and QR rendering. No console errors, no horizontal overflow.
- **Never tested against the live Supabase project.** The machine this was built on could not
  reach supabase.co. A real end-to-end signup has not been confirmed by anyone.

## Running it

```bash
npm install
npm run dev            # http://localhost:5173, add ?demo=1 to skip the database
npm run build          # production build into dist/
```

Local config goes in `.env.local` (copy `.env.example`). The committed `.env.production`
holds the live values.

**On the anon key being committed**: it is public by design. Vite compiles it into the
JavaScript bundle every visitor downloads, so hiding it in the repo would protect nothing.
Row-level security is the protection. The **service_role** key is the dangerous one: it
bypasses every policy and must never appear in this repo, a browser, or a chat window.

## Deploying

Every push to the default branch triggers `.github/workflows/deploy.yml`, which builds and
publishes to Pages. Pages must stay set to **Settings → Pages → Source: GitHub Actions**;
GitHub does not permit a workflow token to set that itself, which is why the first two
deploys failed.

## Known limitations and deliberate choices

- **Self-reported amounts.** Anyone can claim they spent $900. The app says "honor system"
  out loud. Making it real would mean receipts or a POS integration, a much larger project.
- **Supabase free tier sleeps** after a week with no activity and takes about 30 seconds to
  wake. Regular lunch traffic prevents it.
- **No password reset flow** because there are no passwords. Losing access means requesting
  a new magic link.
- **No admin UI.** Promoting an owner, or fixing a user's data, is done in the SQL editor.
- **Deleting the iPhone home-screen icon can clear the stored session**, which just means
  signing in again.
- **Personal data**: this holds real customers' names and spending histories. It was kept
  deliberately minimal (display name only, email never shown to anyone including George).
  Worth keeping that constraint if the app grows.

## Suggested next steps, in order

1. Finish the Resend domain verification so customers can receive sign-in links.
2. Run a real end-to-end test: sign up, log meals, promote to owner, confirm the board.
3. Have George sign in and promote his account.
4. Print the QR code for the tables. It is in the app under "Show QR code for the table".
