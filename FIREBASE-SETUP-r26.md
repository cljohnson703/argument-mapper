# Argument Mapper r26 — Live Collaboration Setup Guide

There are **two roles** in setting up collaboration, and only the first one is
you:

- **Path A — the app owner (you, once):** put the app itself online and give
  it a default shared backend. ~25 minutes. After this, EVERY user of your
  site can share maps with zero setup, on your project's free capacity.
- **Path B — group leaders (optional, self-serve):** anyone running a group
  can claim their own free backend so their maps live under THEIR Google
  account and use their own private free capacity. They do this **inside the
  app** — Collaborate → "Set up my own free backend…" — a ~10 minute,
  browser-only wizard that links them to each screen, hands them the security
  rules with one click, and then *tests* their setup and names any step they
  missed. **Members never set up anything either way**: invite links carry
  everything needed — click, sign in with Google, join.

Everything is free: Firebase's no-cost ("Spark") tier needs **no credit
card** and includes 100 simultaneous connections, 1 GB stored, and 10 GB/month
downloaded **per project** — and every group leader who does Path B brings
their own fresh allowance. (Limits current as of July 2026.)

---

# Path A — App owner setup (you, once, ~25 min)

## A1. Create the Firebase project (≈5 min)

1. Go to <https://console.firebase.google.com> and sign in with the Google
   account that should own the deployment.
2. **Create a project** → name it (e.g. `argument-mapper`) → turn Google
   Analytics **OFF** → Create.

## A2. Turn on Google sign-in — and guest access (≈3 min)

Sidebar **Build → Authentication → Get started** → Sign-in method →
**Google** → Enable → pick a support email → Save.

Then, on the same Sign-in method screen, also enable **Anonymous**. That is
what lets someone open a *view* link and start reading immediately without a
Google account — they appear to the others simply as "Anonymous". It is not
a security hole: guests still need a live invite link, they are still bound by
the same Security Rules, and each map's owner can switch guest viewing or
guest editing on and off from the Collaborate panel (guest **viewing** is on
by default, guest **editing** is off).

If you skip this, everything still works — people will just be asked to sign
in with Google before they can view a shared map.

## A3. Create the Realtime Database (≈2 min)

**Build → Realtime Database → Create Database** → nearest region (New York:
United States) → **Start in locked mode**.

## A4. Publish the security rules (≈3 min)

The rules enforce — on Google's servers — that only invited people open a
map, "view only" really is view only, and simultaneous saves can never
silently overwrite each other.

On the database's **Rules** tab: delete everything, paste the entire contents
of `database.rules.json` (next to this guide), click **Publish**. (The editor
accepts the `//` comments. The same rules text also ships inside the app for
Path B's copy button; if you ever change one, change both.)

## A5. Register the web app and bake in the config (≈3 min)

1. ⚙ **Project settings → Your apps →** the **`</>`** (Web) icon → nickname
   `argument-mapper` → do **NOT** tick hosting here → Register.
2. Copy the `firebaseConfig = { ... }` object it shows. (If `databaseURL` is
   missing, read it off the Realtime Database page.) These values are
   **public identifiers, not secrets** — the rules protect the data.
3. In `argument-mapper-r26.html`, replace `var FIREBASE_CONFIG = null;` with:

   ```js
   var FIREBASE_CONFIG = {
       apiKey: "AIzaSy...",
       authDomain: "argument-mapper-xxxxx.firebaseapp.com",
       databaseURL: "https://argument-mapper-xxxxx-default-rtdb.firebaseio.com",
       projectId: "argument-mapper-xxxxx",
       appId: "1:1234:web:abcd"
   };
   ```

## A6. Put the app online with Firebase Hosting (≈10 min)

Google sign-in cannot run from a file opened off the disk, so the app needs a
web address; Firebase Hosting serves your exact HTML file for free. You need
**Node.js 20+** (<https://nodejs.org>, "LTS").

First, tell the deploy tool which project is yours — it reads this from the
`.firebaserc` file BEFORE any command runs (even `login`), so do this first
or every command fails with "Invalid project id":

1. Find your **Project ID** in the console: ⚙ → Project settings (all
   lowercase, e.g. `argument-mapper-4a9be` — the ID, not the display name).
2. In a terminal opened in this folder, run `notepad .firebaserc` and replace
   `YOUR-FIREBASE-PROJECT-ID` with your Project ID, keeping the quotes. Save.

Then, in the same terminal:

```
npx firebase-tools login
mkdir collab-site
copy argument-mapper-r26.html collab-site\index.html
npx firebase-tools deploy --only hosting,database
```

`firebase.json` / `database.rules.json` here are pre-wired — this deploy
publishes the app **and** the rules. The printed address,
**`https://YOUR-PROJECT-ID.web.app`**, is the link you give everyone. To ship
an update: copy the new HTML over `collab-site\index.html`, deploy again.

**Redeploying never touches map data.** A deploy replaces the HTML file
Google serves (and the access rules); the Realtime Database's contents — the
maps — are a separate store that deploys neither read nor write. If a shared
map ever looks wrong after an update, check the sync chip for "conflicts to
review" (overwritten text is kept there), and note that every shared map also
gets an **automatic hourly server-side backup** the owner can roll back to:
Collaborate → Safety → Restore from backup. The restore itself is reversible.
One habit that helps during updates: ask collaborators to close tabs running
the old version, since a very stale tab rejoining can produce a confusing
merge.

Sign-in is pre-authorized on `localhost`, `YOUR-PROJECT.web.app`, and
`YOUR-PROJECT.firebaseapp.com`. Hosting the file anywhere else additionally
requires adding that domain under **Authentication → Settings → Authorized
domains**.

## A7. Try it (≈5 min)

Open your address, make a tiny map, **Collaborate → Share this map…**, copy
the edit link, open it in an incognito window with a second Google account,
join, and type — the other window updates within a couple of seconds, with
named presence. Also try the view link: reading and exporting work; every
edit control is refused, client- and server-side.

---

# Path B — Group leaders (self-serve, in-app, ~10 min)

You don't need to do anything for this — it ships in the app. What a leader
experiences, for your reference:

1. **Collaborate → "Set up my own free backend…"** opens a 6-step checklist.
   Each step is one console screen (create project, enable Google sign-in,
   create database, paste rules — via a **Copy the rules** button — register
   web app, authorize your site's domain), each with an **Open** button that
   jumps straight there.
2. They paste their config into the wizard and click **Verify & save**. The
   app then actually tests the backend: modules load, database reachable,
   rules genuinely published (a database left open or still locked is caught
   and named), Google sign-in enabled, this domain authorized, and a
   throwaway room created and deleted. Any failure names the exact step to
   redo.
3. From then on, **Share this map…** creates rooms in *their* project, and
   their invite links automatically carry their project's public identifiers
   — so members still just click, sign in, and join, with zero setup, even
   though the map lives on the leader's backend. "Stop using my backend"
   returns them to the site default at any time.

Notes for leaders' IT/privacy questions: the leader's project stores map
content, members' Google display names and account ids, and transient
presence heartbeats — no passwords, no email contents. The whole tenant is
deletable by the leader in their Firebase console at any time.

---

# Day-to-day use (what to tell a class or group)

- **Sharer:** open your map → Collaborate → Share this map → send the *edit*
  link to contributors, the *view* link to observers. Links carry the room
  secret after `#` — browsers don't send that part to other websites, but
  anyone with the link can join, so share it like a Google Doc link.
- **Members:** click → Sign in & join → work. Reload reconnects; later,
  Collaborate → Recent shared maps.
- **Leaked link?** Collaborate → **Rotate** (old links die; members stay), or
  **Close to new members**. Remove any member live from the panel.
- **Archive/grade:** Collaborate → **Download a copy** at any moment.
- **Shared computers:** Leave / Sign out and accept the "remove offline copy"
  prompt so the next person at the machine can't open your map.

# Capacity and staying free

Per project: ~100 simultaneously open tabs, 1 GB stored, 10 GB/month
downloaded. One class fits easily on one project; every Path-B leader brings
their own fresh allowance, which is how the app scales to thousands of
independent groups at $0. Watch **Realtime Database → Usage** during a first
pilot. Maps over ~4 MB refuse to sync (by design). If YOUR default project
ever runs hot because the app got popular: encourage heavy users onto Path B,
or upgrade just your project to pay-as-you-go (connections cap rises to
200,000; set a budget alert first).

# Troubleshooting

| Symptom | Fix |
|---|---|
| Terminal: "Invalid project id: YOUR-FIREBASE-PROJECT-ID" | `.firebaserc` still has the placeholder — see the start of A6 (run `notepad .firebaserc`, put your real lowercase Project ID in). |
| "Your browser blocked the sign-in window" | Allow pop-ups for the site, try again. |
| "Google sign-in cannot run from a file opened directly on disk" | Use the hosted address (or `py serve.py` + `http://localhost:8000` for local testing). |
| "Collaboration is not configured in this copy" | Path A5 wasn't done in the served file (members with a full invite link are unaffected — links carry their group's backend). |
| Wizard: "database refused a test write" / "public reads allowed" | Rules step: paste the copied rules over EVERYTHING on the Rules tab, Publish, verify again. |
| Wizard: "not on that project's Authorized domains list" | Step 6 — add the exact domain the message shows. |
| "The server refused this account's access" | Removed from the map, or sign-in expired — sign in again / ask for a re-invite. |
| Chip: "Offline — changes waiting" | Connection dropped; edits are safe on the device and sync on reconnect. |
| Chip: "N conflicts to review" | Two people rewrote the same node — click the chip; nothing is lost silently. |

# For developers

- Suites: the sixteen `*-test*.js` files plus `collab-r26-firebase-test.js`,
  each run as `node <file> argument-mapper-r26.html`. The collab suite drives
  real multi-window sessions against a fake Firebase SDK that mirrors the
  security rules (read AND write side), including bring-your-own-backend
  links and the wizard verifier.
- Firebase Web SDK v12.16.0, pinned in `FIREBASE_SDK_VERSION`, loaded lazily
  from Google's CDN only when collaboration is used; local use never touches
  the network.
- Invite-link format: `#join=<roomId>.<token>.<e|v>[&fb=<base64url public
  config>]` — `fb` present whenever the room's backend isn't the one baked
  into the served file.
- Emulator run of the REAL rules: `npx firebase-tools emulators:start --only
  auth,database` (Java 11+).
- Google Drive snapshots remain deferred (COLLABORATION-HANDOFF-r26.md §3
  explains why Drive must never be the live transport).
