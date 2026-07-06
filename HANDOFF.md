# Project Handoff — "MovieHub" Watchlist App

> **Purpose of this document.** This is a complete handoff for a new model/agent
> (e.g. Fable 5) taking over the project. It captures **what exists today**,
> **what's broken or weak**, **concrete ways to improve**, and an **honest,
> researched answer to the "ship it on Steam" goal**. Read it top to bottom
> before touching code. Nothing here is aspirational hand-waving — every feature
> listed below maps to real routes/controllers in the repo.

**Repo:** `wuntunnnn/IS113`  ·  **App root:** `/Project`
**Handoff written:** 2026-07-06

---

## 0. TL;DR (read this first)

- **What it is:** a movie discovery + watchlist + review web app. Server-rendered
  Node/Express with MongoDB, EJS templates, session auth, and TMDB (The Movie DB)
  as the external movie data source. It's a functional coursework-grade CRUD app
  with a real feature set (auth, browse, search, reviews, watchlist, profiles,
  admin moderation).
- **The Steam goal needs a reframe.** Steam distributes **downloadable desktop
  applications**, not web URLs. A web app cannot be "uploaded to Steam" as-is.
  There are two real paths (wrap as a desktop app, or rebuild as a game) — see
  **Section 6**. Both have real cost and effort; the doc lays them out so you can
  choose deliberately instead of hitting a wall late.
- **Before "adding features," fix the foundation.** There are several security,
  scalability, and correctness issues (Section 4) that will bite hard the moment
  this leaves a single laptop. Fix those first; they're cheap now and expensive
  later.

---

## 1. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Runtime | Node.js (tested on v22) | |
| Web framework | Express 4 | |
| Views | EJS 3 | server-side rendering, no SPA/JS framework |
| Database | MongoDB via Mongoose 9 | |
| Auth | `express-session` + `bcrypt` | session cookie, 30-day maxAge |
| External API | TMDB (`api.themoviedb.org/v3`) | via native `fetch`, `utils/tmdb.js` |
| Dev | `nodemon` | `npm run dev` |

**Config/secrets** live in `Project/config.env` (loaded by `dotenv`), which is
**not** committed (shared out-of-band per the README). Required keys observed in
code: `MONGO_URI`, `API_KEY` (TMDB), `SESSION_SECRET`.

> ⚠️ There is **no `config.env.example`** in the repo. The very first thing the
> next dev needs is a template of these keys. Create one (Section 4).

---

## 2. Architecture & directory map

Classic Express MVC-ish layout. `Project/server.js` wires everything together.

```
Project/
├── server.js            # app bootstrap: db connect, session, view engine, route mounts
├── config.env           # (gitignored) MONGO_URI, API_KEY, SESSION_SECRET
├── nodemon.json         # ignores data/ so JSON writes don't restart the server
├── routes/              # thin route definitions → controllers
│   ├── auth.js          # /signup /login /logout
│   ├── home.js          # /home, recently-viewed clear
│   ├── movie.js         # /movies, /details, custom movies, admin submissions
│   ├── review.js        # nested under /movies/:movieId/reviews
│   ├── watchlist.js     # /watchlist add/remove/watched/clear
│   ├── search.js        # /search query + genre + history
│   ├── profile.js       # /profile view/edit
│   ├── report.js        # review reporting + admin report moderation
│   ├── admin.js         # /admin dashboard
│   └── user.js          # /users (thin)
├── controllers/         # business logic per route group
├── models/              # Mongoose schemas (see Section 3)
├── middleware/
│   └── authMiddleware.js# requireLogin, requireAdmin, alreadyLoggedIn
├── utils/
│   ├── tmdb.js          # TMDB API wrapper (getMovies, getMovieById, getGenres, search, byGenre)
│   └── recentlyViewedHelper.js  # reads/writes data/recentlyViewed.json
├── data/
│   └── recentlyViewed.json      # ⚠️ file-based "recently viewed" store (not a DB)
├── views/               # EJS templates (+ partials/header, reviews/)
└── public/              # per-page CSS + images
```

**Request flow:** `route → (auth middleware) → controller → (model / tmdb util) → res.render(ejs)`.

**Entry point:** `GET /` redirects to `/movies`. Server is hard-bound to
`127.0.0.1:8000` (see Section 4 — this breaks most hosting).

---

## 3. Data models (Mongoose)

| Model | Key fields | Constraints / notes |
|---|---|---|
| **User** | username, email (unique), password (bcrypt hash), role `user\|admin`, bio, favouriteGenre[] | collection explicitly named `users`; has static helpers (`createUser`, `getUserByEmail`, …) |
| **Movie** | title, genre_ids[], overview, poster_path, backdrop_path, uploadedBy→User | user-uploaded ("custom") movies; field names mirror TMDB for easy mapping |
| **MovieSubmission** | title, genre, description, posterUrl, bannerUrl, submittedBy→User, status `pending\|approved\|rejected` | admin approval queue feeding into Movie |
| **Review** | movie (string id), user→User, username, rating 1–10, comment (10–1000 chars), timestamps | **unique index (movie,user)** → one review per user per movie |
| **Report** | reviewId→Review, reportedBy→User, reason enum, details, status `pending\|dismissed\|actioned` | **unique index (reportedBy,reviewId)** → one report per user per review |
| **Watchlist** | userId→User, movieId, movieTitle, posterPath, addedAt, watchedDate | **unique index (userId,movieId)**; `watchedDate` toggles watched state |
| **SearchHistory** | userId→User, query, timestamps | **unique index (userId,query)**; static CRUD + `getHistory` (last 5) |

Observations:
- **Two sources of movie truth:** TMDB (external) and user-submitted `Movie`
  docs. `Review.movie` and `Watchlist.movieId` are **strings** so they can hold
  either a TMDB numeric id or a Mongo ObjectId. This works but is implicit and
  fragile — document/normalize it.
- Mixed export styles across models (`mongoose.models.X || model(...)` vs plain
  `model(...)`). Harmless but inconsistent.

---

## 4. Feature inventory (what actually works today)

Grouped by route file. All admin routes are gated by `requireAdmin`.

**Auth** (`auth.js` / `authController`)
- Signup (bcrypt-hashed password), login, logout. `alreadyLoggedIn` bounces
  logged-in users away from auth pages.

**Home** (`home.js` / `homeController`)
- Personalized home page; "recently viewed" strip; clear-recently-viewed.

**Movies** (`movie.js` / `movieController`)
- Browse movies (TMDB popular + custom), infinite "load more" (`/movies/loadMore`).
- Movie details for both TMDB (`/details`) and custom movies (`/movies/custom/:id`).
- Submit a custom movie (`/movies/add`) → goes into `MovieSubmission` queue.
- **Bulk add to watchlist** (`/movies/bulk-add`).
- Admin submissions queue: approve / reject / delete.

**Reviews** (`review.js` / `reviewController`, mounted at `/movies/:movieId/reviews`)
- List, create (one per user per movie), edit, delete. Ratings 1–10, comment
  length validation.

**Watchlist** (`watchlist.js` / `watchlistController`)
- Add / remove, mark watched / un-watched, clear all, clear selected.

**Search** (`search.js` / `searchController`)
- Search by title, filter by genre, paginated "more", per-user search history
  (last 5) with delete.

**Profile** (`profile.js` / `profileController`)
- View profile, edit bio + favourite genres.

**Reports & moderation** (`report.js` / `reportController`)
- Users report a review (reason enum). Admin: view reports, dismiss, or
  delete the offending review.

**Admin** (`admin.js` + admin routes above)
- Dashboard aggregating submissions and reports.

This is a genuinely complete little product. The gaps are **quality**, not
missing CRUD.

---

## 5. Known issues, tech debt & risks

Ordered roughly by severity. **These are the highest-ROI things to fix and are
prime candidates for the incoming model's first PR.**

### Security
1. **Hardcoded session-secret fallback.** `server.js` uses
   `process.env.SESSION_SECRET || "moviehubsecret"`. If the env var is ever
   missing, every session is signed with a public secret → forgeable sessions.
   Fail fast instead: throw on missing secret in production.
2. **No CSRF protection.** All state changes are non-idempotent POSTs from forms
   with cookie auth → classic CSRF exposure. Add `csurf` or double-submit tokens.
3. **No rate limiting / brute-force protection** on `/login` and `/signup`.
4. **`requireAdmin` leaks via `res.send("Access denied…")`** — returns a bare
   string, not a proper 403 page, and the file has a leftover absolute
   `Downloads/...` path in a comment. Clean this up.
5. **Cookie `secure:false` hardcoded.** Must be `true` behind HTTPS in prod.
6. **XSS review:** EJS `<%= %>` auto-escapes, but audit every `<%- %>` (raw)
   usage in views, especially anywhere user text (reviews, bio) is rendered.
7. **TMDB `API_KEY` is passed as a query param** — fine for TMDB, but never log
   full URLs. `server.js` currently `console.log`s the Mongo URI at boot — remove.

### Scalability / correctness
8. **"Recently viewed" is a JSON file** (`data/recentlyViewed.json`) read/written
   on disk. This breaks under concurrency (race conditions on write), and won't
   work on any multi-instance or serverless host (ephemeral/!shared filesystem).
   **Move it into MongoDB** (a `RecentlyViewed` collection or an array on User).
   This is also the #1 blocker for the desktop/Steam packaging in Section 6.
9. **Server hard-bound to `127.0.0.1:8000`.** Most hosts inject `PORT` and need
   `0.0.0.0`. Change to `app.listen(process.env.PORT || 8000)`.
10. **DB connection failure doesn't stop the app** — it logs and continues, so
    the app serves 500s instead of failing fast. Decide the desired behavior.
11. **Dual movie-id typing** (TMDB int vs Mongo ObjectId stored as strings) is
    implicit. One malformed id can throw. Add a helper that classifies/validates.

### Code quality / DX
12. **No `config.env.example`.** Add one listing `MONGO_URI`, `API_KEY`,
    `SESSION_SECRET` with placeholder values so onboarding isn't "ask the group chat."
13. **No tests, no linter, no CI.** Even a handful of controller/route tests plus
    ESLint + Prettier would pay for themselves before adding features.
14. **Dead/commented code and debug `console.log`s** scattered (server.js,
    authMiddleware.js, movie.js). Sweep them.
15. **`package.json` name is `transport-selector`** — a leftover from a template.
    Rename to match the product.
16. **README is thin** — no architecture overview, no seed instructions, no
    admin-account bootstrap steps.

---

## 6. The Steam question — honest reality + real paths

**Goal as stated:** "make a full functioning app with features and upload it to
Steam."

**The hard truth:** Steam does **not** host or distribute web apps. Steam ships
**downloadable desktop applications** (games, plus a limited "Software"
category) as platform binaries for Windows/macOS/Linux. You cannot point Steam at
a URL. So the current Express server can't "go on Steam" without being
transformed into a distributable desktop application. There are two credible
routes.

### What Steam requires regardless of path
- **Steamworks Direct fee:** ~**US$100 per app** (recoupable against sales), paid
  before you can publish.
- **A Steamworks account** with company/individual **tax + banking** identity
  verification.
- **A review/approval process** and content/build configuration in Steamworks.
- **Realistic timeline:** weeks, not an afternoon — build packaging, store page,
  review round-trips.
- **Policy fit:** Steam has tightened on low-effort "software" listings. A movie
  *utility* is a weaker fit than a *game*. Read Steam's Distribution Agreement
  and Onboarding docs before committing the $100.

### Path A — Wrap the existing app as a desktop application (Electron or Tauri)
Turn the web app into an installable `.exe`/`.app`/AppImage.
- **Electron:** bundles Chromium + Node; easiest lift because your Express app is
  already Node. You'd run the server in the Electron main process and load it in a
  BrowserWindow.
- **Tauri:** much smaller binaries (uses the OS webview), Rust shell; more work to
  integrate a Node backend.
- **The real blocker isn't the wrapper — it's the backend.** Today the app needs a
  live **MongoDB** and calls **TMDB** with a secret key. A Steam download must be
  **self-contained** for the user. That forces one of:
  - **(A1) Hosted backend:** ship a thin desktop client that talks to *your*
    hosted server + DB. Simplest to build, but now you're running (and paying for)
    server infrastructure forever, and the "app" is basically a browser in a
    frame — questionable value and questionable Steam-policy fit.
  - **(A2) Local-first:** embed a local database (e.g. SQLite/`better-sqlite3` or
    an embedded Mongo alternative) and remove the shared-server assumptions
    (kill the JSON-file store from issue #8, make TMDB calls optional/cached).
    More work, but a genuinely standalone app.
- **Verdict:** technically doable, but a movie watchlist is a **weak Steam
  product**. Steam's audience wants games/tools with clear standalone value.

### Path B — Reconceive the project as a *game* (this is likely why Fable 5 is in play)
Fable 5 is strong at creative, narrative, and systems design. If the *real* goal
is "publish something on Steam," a **game** is the native Steam product and the
far better fit. Options:
- **Reuse the domain:** a movie-trivia / "guess the film" / cinema-tycoon /
  narrative game that reuses your TMDB integration and data model instincts.
- **Engine choice:** Godot (free, great 2D, exports to all desktop + Steam),
  Unity, or a web-tech game (Phaser/PixiJS) wrapped in Electron/Tauri for Steam.
- **Verdict:** highest ceiling, but it's a **new build**, not an upgrade of the
  Express app. Be honest with yourself about scope.

### Recommendation
1. **Decouple the two goals.** "A polished, full-featured app" and "on Steam" are
   different projects. Nail #1 first (it's close), then decide on Steam
   deliberately.
2. If you want it on Steam **and** keep the movie app: go **Path A2 (local-first
   Electron)** and treat it as a standalone desktop "media library / watchlist"
   tool — but validate Steam policy fit *before* paying the $100.
3. If Steam is the point and the movie theme is negotiable: go **Path B** and let
   Fable 5 design a small, shippable game. Scope it to something finishable.
4. Either way, **do Section 5's foundation fixes first** — a hosted-backend or
   local-first build is impossible while "recently viewed" is a JSON file and the
   port is hardcoded.

---

## 7. Suggested roadmap (phased)

**Phase 0 — Stabilize (do before anything else)**
- Add `config.env.example`; fix hardcoded port → `process.env.PORT`.
- Remove secret-logging; fail-fast on missing `SESSION_SECRET`.
- Move "recently viewed" from JSON file → MongoDB.
- Add ESLint/Prettier + a few smoke tests + a basic CI check.

**Phase 1 — Harden**
- CSRF tokens, login rate limiting, proper 403 admin page, HTTPS cookie flag.
- Audit EJS `<%-` raw output for XSS.

**Phase 2 — Feature polish (great work for the new model)**
- See Section 8 for a concrete feature backlog.

**Phase 3 — Distribution decision**
- Choose Path A2 or Path B from Section 6. Validate Steam policy + budget the
  $100 + tax setup *before* building the wrapper.

---

## 8. Improvement / feature backlog (for the incoming model to consider)

Product-level ideas that fit the existing architecture:
- **Ratings aggregation** on movie pages (avg user rating, rating distribution).
- **Social layer:** follow users, activity feed, like/upvote reviews.
- **Recommendations:** "because you watchlisted X" using genre overlap.
- **Watched history & stats:** minutes watched, genres breakdown (ties into a
  dashboard — if you build charts, follow the project's data-viz conventions).
- **Better search:** debounced autocomplete, combine title+genre+year filters.
- **Image handling:** real poster upload (currently URL-only) with validation.
- **Notifications** on report resolution / submission approval.
- **Accessibility & responsive pass** on the EJS/CSS (per-page CSS suggests drift).
- **API layer:** extract a JSON API so a future desktop/mobile/game client can
  reuse the backend (directly enables Path A).

---

## 9. Open decisions the next model should surface to the user

1. **Is Steam the real goal, or "share a finished thing"?** If the latter, a
   hosted web deploy (Render/Railway/Fly) with a public URL is *far* cheaper and
   faster than Steam and better shows off this exact codebase.
2. **App vs game?** (Section 6, Path A vs B). This determines everything.
3. **Local-first or hosted-backend** if going desktop? (issue #8 gates this).
4. **Budget & timeline** for the Steam $100 + infra + review process — confirmed?
5. **Is the movie theme fixed**, or is it a vehicle for "ship on Steam"?

---

## 10. Kickoff prompt for the incoming model (Fable 5)

> You're taking over the MovieHub project (Node/Express/MongoDB/EJS movie
> watchlist web app). Read `HANDOFF.md` fully first. The owner wants to (a) make
> it a polished, full-featured app and (b) eventually ship on Steam — but Steam
> only distributes desktop binaries, so that goal needs the reframe in Section 6.
> **Start by proposing a plan, not code:** confirm the app-vs-game decision
> (Section 9), then execute Phase 0 stabilization (Section 7) as the first PR —
> especially moving "recently viewed" out of the JSON file and de-hardcoding the
> port — before adding any features. Flag the Steam cost/policy realities to the
> owner before anyone pays the $100.

---

*End of handoff. Keep this document updated as decisions are made — it is the
single source of truth for anyone (human or model) picking up the project.*
