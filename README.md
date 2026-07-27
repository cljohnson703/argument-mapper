# Argument Mapper

A free tool for building **argument maps** — diagrams of contentions, supporting
premises, objections and rebuttals — with evaluation notes, and optional live
collaboration for small groups.

It is a **single self-contained HTML file**. Download it and it runs in your
browser with no installation, no account, and no internet connection.

---

## Using it

**On your own (no account, fully offline).** Open the file. Everything works:
building maps, evaluation notes, LaTeX maths, import/export, autosave. Nothing
is ever sent anywhere.

**Together (optional).** Open the hosted address, click **Collaborate → Share
this map**, and send the invite link. Collaborators click it, sign in with
Google, and edit the same map live — changes merge safely, and conflicting
edits are kept for review rather than silently lost.

> Google sign-in cannot run from a file opened directly off disk, so the
> downloaded copy is for solo/offline use. Sharing requires opening the app
> from its web address.

## Your data

* **Solo use sends nothing anywhere.** Maps live in your browser's storage and
  in files you save. No account, no tracking, no analytics.
* **Sharing a map** stores the map, and the Google display names of the people
  in it, in a Google Firebase database, so collaborators can see each other's
  work. Sign-in happens in Google's own window — the app never sees your
  password, and your email address is not shown to other collaborators.
* **If you receive an invite link,** everyone in that map — including whoever
  sent it — will see your display name, whatever you write, and which boxes you
  have selected while you are there. Nothing is shared until you choose to join,
  and you can leave at any time.
* **You don't need a Google account to view a shared map.** A view link opens
  as a guest, listed to the others only as "Anonymous"; you share nothing but
  your presence. Editing normally does require signing in, so that changes are
  attributable — the map's owner can allow guest editing if they want to.
* The map's owner can remove members, rotate invite links, or delete the map.

### A note on the Firebase key in the source

`argument-mapper-r27.html` contains a `FIREBASE_CONFIG` block with an `apiKey`.
**This is not a secret**, and it is not a mistake that it is committed. A
Firebase *web* API key is a public project identifier, not a credential — it
ships to every browser that loads any Firebase web app, by design. Access is
controlled by the Security Rules in `database.rules.json` plus Google sign-in,
never by hiding this value. (Automated secret scanners flag the `AIzaSy…`
shape regardless, because they cannot distinguish a web key from a private
service-account key.)

The key is additionally restricted to this project's domains in the Google
Cloud console, so it cannot be used to bill quota from elsewhere. If you fork
this project, replace the whole block with your own project's config — or
leave it and let each group use the in-app **"Set up my own free backend"**
wizard.

## Running your own backend (optional)

Collaboration needs a Firebase project. Anyone can create their own free one —
**Collaborate → "Set up my own free backend…"** walks through it in about ten
minutes, entirely in the browser, and verifies the result. Invite links then
carry that project's public identifiers, so *members* still need no setup at
all. See `FIREBASE-SETUP-r26.md`.

## Licence

Copyright (c) 2026 C. L. Johnson.

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0) — see
[`LICENSE`](LICENSE).

In short: you may use, study, share and modify this program freely. **If you run
a modified version and let other people use it over a network, you must also
offer them the complete corresponding source of your version under the same
licence**, and preserve attribution to the original author (AGPL-3.0 §7(b)).

The name **"Argument Mapper"** and the project's branding are **not** licensed
and remain the author's. A fork must not present itself as this project.

**No warranty.** This program is provided "AS IS", without warranty of any kind,
express or implied, including but not limited to the warranties of
merchantability, fitness for a particular purpose and non-infringement. In no
event shall the author be liable for any claim, damages or other liability
arising from, out of or in connection with the software or its use.

## For developers

| File | Purpose |
|---|---|
| `argument-mapper-r27.html` | the source of truth — edit only this |
| `build-public.js` | produces the deployable build (minified, KaTeX embedded) |
| `docs/index.html` | generated artifact, served by GitHub Pages; **not** the preferred form for modification |
| `database.rules.json` | Firebase security rules (the real access control) |
| `*-test*.js`, `run-all-tests.js` | the regression suites |

```bash
npm install      # jsdom, terser, katex
npm run build    # writes docs/index.html
npm test         # runs every suite against the source, then the build
```

Run the full suite against the source before releasing — see
`BUILD-AND-DEPLOY-r27.md`. Third-party components: [KaTeX](https://katex.org)
(MIT), embedded in the build; [Firebase JS SDK](https://firebase.google.com)
(Apache-2.0), loaded on demand only when collaboration is used.
