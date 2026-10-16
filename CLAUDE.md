# CLAUDE.md — OpenNote

This file mirrors `AGENTS.md` so Claude and OpenCode behave identically in this
repository. **Read `AGENTS.md` — it is the canonical version.** Everything below
is a summary; if the two ever disagree, `AGENTS.md` wins.

## One working copy, one branch

Single directory: `C:\Users\Matas\Desktop\opennote\opennote`, branch **`main`**
only. Do not create or switch branches.

## Start of every session

```sh
npm run sync:pull
```

Run it before reading or editing files. If it says sync is *blocked*, report
what it said and stop — do not work around it.

## When the user says "push it"

```sh
npm run sync:push -- "a real commit message describing the change"
```

That runs the build and both test suites, commits, and pushes to `origin/main`.
Do not hand-roll `git add` / `commit` / `push` for a "push it" request, and
never force-push. If the tests fail the script refuses; report the failure
rather than bypassing it.

## The one preview

There is exactly one preview for OpenNote: **http://localhost:5173** (API
proxied from :3001). Both tools use it.

- **Do not use Claude's artifact / inline HTML preview for OpenNote.** It
  renders a copy handed over by Claude, runs on Claude's own machine, and has
  no connection to GitHub or to this dev server. It cannot be made to follow
  `main`, so it will drift. Point at http://localhost:5173 instead.
- Never start a second server. `npm run dev:ensure` reuses the running one and
  warns if an older static build is being served on :4173.
- Vite hot-reloads from disk, so edits and `sync:pull` results appear in the
  open preview immediately.

## Hard rules

- Never force-push, `reset --hard`, `checkout .`, or `git stash`.
- Never touch the other agent's uncommitted work.
- Never change the site's design, features, auth or deployment settings unless
  specifically asked.
- Never deploy. Publishing requires `DEPLOY_ENABLED=true` plus the user's
  explicit "DEPLOY NOW".
- Never commit secrets; `.env` is git-ignored.

## Checks

`npm run build`, `npm test`, `npm run test:deploy` must pass before a push.

## Claude cloud sessions only

Claude on claude.ai runs in its own cloud copy of the repo, not in the folder
above. The SessionStart hook pulls `origin/main` automatically. After a
successful "push it", rebuild the claude.ai preview artifact from the new
`main` — it is a static snapshot and cannot refresh itself.
