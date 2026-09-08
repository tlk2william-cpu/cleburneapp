# Cleburne Cafeteria — Regulars Leaderboard 🏆

A gag "customer attendance tracker" for George. Tap a regular's name when they walk in;
they get one visit and $20 added to their all-time total. The leaderboard ranks everybody
by how much money they have handed over.

Everything is stored in the browser with `localStorage`. No backend, no login, no accounts.
Closing the app (or the whole phone) does not lose the totals.

## What's in here

| File | What it does |
| --- | --- |
| `src/App.jsx` | The entire app: state, storage, confetti, both tabs, all sheets |
| `src/styles.css` | The green-and-white styling |
| `src/main.jsx` | Mounts React, registers the service worker |
| `index.html` | Meta tags for iPhone home-screen install |
| `public/manifest.webmanifest` | Home-screen name, icons, colors |
| `public/sw.js` | Tiny offline cache |
| `public/*.png`, `public/favicon.svg` | App icons |

## Run it locally

```bash
npm install
npm run dev
```

Open the URL it prints (usually http://localhost:5173). To try it on your own phone while
on the same Wi-Fi, run `npm run dev -- --host` and open the network URL it shows.

To build the production version:

```bash
npm run build     # output lands in dist/
npm run preview   # serve dist/ locally to double-check
```

## Put it online for free (so George can save it to his home screen)

Easiest option, no command line, about two minutes:

1. Run `npm run build` — this creates a `dist` folder.
2. Go to https://app.netlify.com/drop and drag the `dist` folder onto the page.
3. Netlify gives you a public HTTPS link like `https://tender-pie-123abc.netlify.app`.
   Rename it to something friendlier in **Site settings → Change site name**.
4. Text George the link.

### Or: GitHub Pages, already wired up (recommended)

`.github/workflows/deploy.yml` builds and publishes the site on every push. Turn it on once:

1. Go to the repo's **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. That's it. The workflow runs on the next push, or start it by hand from the **Actions**
   tab → **Deploy to GitHub Pages** → **Run workflow**.

The live URL is `https://tlk2william-cpu.github.io/cleburneapp/` and it never changes.
From then on, any edit pushed to the default branch is live about a minute later.

Other free options that work just as well:

- **Vercel** — https://vercel.com/new, import the repo, framework "Vite", deploy.
- **Cloudflare Pages** — connect the repo, build command `npm run build`, output `dist`.

The app must be served over **https** for the home-screen install and offline cache to work.
All three options above give you https automatically.

### How George saves it to his home screen (iPhone)

1. Open the link in **Safari** (this does not work in Chrome on iPhone).
2. Tap the **Share** button (the square with the arrow pointing up).
3. Scroll down and tap **Add to Home Screen**, then tap **Add**.

It now opens full screen with its own icon, like a real app. The same instructions are in
the app under the ⚙︎ button.

## How to use it

- **Leaderboard tab** — everyone ranked by money spent, gold/silver/bronze medals for the
  top three, plus "All-time revenue tracked" and "Logged today" counters.
- **Check In tab** — everybody in alphabetical order. Tap the big green **Ate!** button to
  log a visit: confetti fires and a **+$20** pops up.
  - The yellow **+** button in the corner adds a new person.
  - **Edit** (top right) reveals red delete buttons, and deleting still asks for
    confirmation, so nobody gets erased by a stray thumb.
- **⚙︎ Settings** — totals at a glance, **Undo last check-in** for mis-taps, home-screen
  instructions, and a deliberately buried two-step **Reset all totals**.

## Things you might want to change

- `PER_VISIT` at the top of `src/App.jsx` — the assumed average spend ($20).
- `SEED_NAMES` in the same file — the placeholder regulars shown on first open.
- The colors in `:root` at the top of `src/styles.css`.

Note: their website wasn't reachable from the machine this was built on, so the palette is
the classic Cleburne green-and-white done by eye (`--green: #1B7A43`). If you want an exact
match, drop the real hex code into `src/styles.css` and everything follows from there.
