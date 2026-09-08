# Cleburne Cafeteria — Regulars Club 🍽️🏆

A leaderboard for the people who eat at Cleburne Cafeteria. Regulars sign up on their own
phones and log what they spent, down to the cent. George sees the leaderboard.

## Two kinds of account

|  | George (owner) | A Regular |
| --- | --- | --- |
| Sees the full leaderboard | ✅ | ❌ |
| Sees their own spend and visits | — | ✅ |
| Sees their rank as a number ("You are 9th of 42 Regulars") | — | ✅ |
| Logs a meal | ❌ | ✅ |
| Adds or edits people | ❌ | own account only |
| Shares the signup link and QR code | ✅ | — |

A Regular can never read another Regular's rows. That is enforced by row-level security in
the database, not just hidden in the app: rank arrives as a bare number computed server-side.
Even George cannot read individual meals, only per-person totals.

## How it is built

- **Front end**: React + Vite, mobile first, installable to an iPhone home screen.
- **Back end**: Supabase (Postgres, row-level security, magic-link email auth).
- **Hosting**: GitHub Pages, deployed by `.github/workflows/deploy.yml` on every push.

| File | What it does |
| --- | --- |
| `supabase/schema.sql` | Tables, security policies, ranking functions. Run once. |
| `src/App.jsx` | Sign-in, first-run naming, routes to the right account type |
| `src/Regular.jsx` | Log a meal, your meals, your standing |
| `src/Owner.jsx` | George's leaderboard, invite link, QR code |
| `src/lib/api.js` | Every data call, plus the demo-mode fake |
| `src/ui.jsx` | Money formatting, confetti, sheets, shared pieces |
| `src/styles.css` | The green-and-white styling |

## Try it without any setup

Add `?demo=1` to the URL. Everything runs on fake local data: sign-in is instant, the
leaderboard is populated, and a button in the corner flips between George's view and a
Regular's view. Nothing is saved anywhere but that browser. Good for showing people what the
app does before the database exists.

## Setup

### 1. Create the database

1. Make a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste the whole of `supabase/schema.sql`, and run it.

### 2. Turn on email sign-in and connect a real mail service

This step is **required**, not optional. Supabase's built-in email sender allows only
**2 messages per hour across the whole project**, and refuses to send to anyone who is not on
your Supabase team. Customers would never receive their sign-in link.

1. In **Authentication → Sign In / Providers**, make sure **Email** is enabled.
2. In **Authentication → Emails → SMTP Settings**, connect a mail provider.
   [Resend](https://resend.com) has a free tier that covers this easily; Brevo and Mailgun work too.
3. In **Authentication → Rate Limits**, raise the email limit from the default 30 per hour if
   you expect a rush of signups.
4. In **Authentication → URL Configuration**, set **Site URL** to
   `https://tlk2william-cpu.github.io/cleburneapp/` and add the same address under
   **Redirect URLs**.

### 3. Point the app at the database

From **Project Settings → Data API**, copy the project URL and the `anon` public key. The
anon key is designed to be public; the security policies are what protect the data.

These live in `.env.production`, which is committed on purpose: the anon key is compiled into
the JavaScript every visitor downloads, so hiding it in the repo would protect nothing. Row-level
security is what protects the data. To move them out of git anyway, add `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` under repo **Settings → Secrets and variables → Actions → Variables**,
delete `.env.production`, and pass them to the build step in the workflow.

The **service_role** key is a different thing entirely: it bypasses every policy in the schema.
It must never go in this repo, the browser, or a chat window.

For local work, copy `.env.example` to `.env.local` and fill in the same two values.

### 4. Make George the owner

Everyone starts as a Regular. After George signs in once, run this in the SQL Editor with his
email address:

```sql
update public.profiles
set role = 'owner'
where id = (select id from auth.users where email = 'george@example.com');
```

He now sees the leaderboard instead of the logging screen. To undo it, set the role back to
`'regular'`.

## Run it locally

```bash
npm install
npm run dev          # http://localhost:5173  (add ?demo=1 to skip the database)
npm run build        # production build into dist/
```

## Deploying

Already automatic. Every push to the default branch builds and publishes to
<https://tlk2william-cpu.github.io/cleburneapp/>. Pages must be set to **Settings → Pages →
Source: GitHub Actions**, which is a one-time switch that GitHub does not allow a workflow to
flip on its own.

## Things worth knowing

- **The amounts are self-reported.** Anyone can claim they spent $900. That is the joke, and
  the app says "honor system" out loud. If it ever needs to be real, receipts or a POS
  integration would be the way, and that is a much bigger build.
- **Weeks start on Sunday**, and days roll over at midnight Houston time, not UTC.
- **Free-tier pause**: a Supabase project with no activity for a week goes to sleep and takes
  about 30 seconds to wake on the next visit. Regular lunch traffic keeps it awake.
- **Deleting the home screen icon on iPhone can clear the app's stored session**, which just
  means signing in again with a new magic link.

## Changing things

- Milestone amounts that trigger confetti: `MILESTONES` at the top of `src/Regular.jsx`.
- Fake regulars used by demo mode: `DEMO_NAMES` in `src/lib/api.js`.
- Colors: the `:root` block at the top of `src/styles.css`.
- Maximum a single meal can be logged as ($1,000): the `amount_cents` check in
  `supabase/schema.sql`.
