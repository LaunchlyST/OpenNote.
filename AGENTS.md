# AGENTS.md — OpenNote

Standing instructions for any AI coding agent (OpenCode, Claude Code, Copilot)
working on this repository. `CLAUDE.md` mirrors this file so both tools behave
identically.

## One working copy, one branch

This repository is worked on from a **single directory**:
`C:\Users\Matas\Desktop\opennote\opennote`, on branch **`main`**.

`main` is the single source of truth and tracks `origin/main`. Do not create
feature branches, and do not switch branches — the other agent is on `main` too,
and a branch switch would put the two agents out of step.

## At the start of every session

Run this **before** reading or editing any file, so you are working from the
newest committed state:

```sh
npm run sync:pull
```

If it reports that sync is *blocked*, do not work around it. Tell the user
exactly what it said — usually uncommitted changes from the other agent that
need committing or discarding first.

## When the user says "push it"

Run exactly one command and report its output:

```sh
npm run sync:push -- "a real commit message describing the change"
```

That script runs the type-check/build and both test suites, commits anything
uncommitted, and pushes to `origin/main`. **Do not hand-roll `git add` /
`git commit` / `git push` for a "push it" request** — the script is what keeps
the two agents from diverging.

If the tests fail, the script refuses to push. Report the failure; do not
bypass it, and do not use `--force` under any circumstances.

## The one preview

There is exactly **one** preview for OpenNote:

> **http://localhost:5173**

Both tools use that URL. It is the only thing that shows the landing page,
dashboard, calendar, notes and settings, so it is the only place the two tools
can be compared.

- Never use a tool's built-in "artifact"/inline HTML preview for OpenNote. It
  renders whatever that tool hands it, is not connected to this machine, and
  will drift from `main`. It cannot be made to follow GitHub.
- Never start a second server. `npm run dev:ensure` reuses the running one and
  warns if a `vite preview` on :4173 is serving an older build.
- Vite hot-reloads from disk, so file edits appear immediately with no restart,
  and a `sync:pull` lands in the open preview within a second.
- The API is proxied at the same origin (`/api/*` → :3001), so sign-in, notes
  sync and the Deploy panel all work in the preview.

```sh
npm run dev:ensure     # reuse the running server, or start one if none is up
```

## Hard rules

- **Never** force-push, `git reset --hard`, `git checkout .`, or `git stash`.
- **Never** modify, commit or discard the other agent's uncommitted work.
- **Never** change the website's design, features, authentication or
  deployment settings unless the user asks for it specifically.
- **Never** deploy. Publishing needs `DEPLOY_ENABLED=true`, which is off, and
  needs the user's explicit "DEPLOY NOW".
- Never commit secrets. `.env` is git-ignored; `.env.example` is the template.

## Where things live

```
src/            React app (landing page + calendar)
server/         Express API: auth, workspace sync, deployment
scripts/        sync tooling and smoke tests
CLAUDE.md       mirror of this file
```

## Checks

```sh
npm run build          # type-checks src, vite config and server
npm test               # SSR smoke test
npm run test:deploy    # deployment API safety checks
npm run lint
```

`npm test` and `npm run test:deploy` must both pass before anything is pushed.