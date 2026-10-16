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

## Development server

One shared dev server on <http://localhost:5173> (API on 3001), hot-reloading
from disk. Use `npm run dev:ensure` to start it only if it is not already up.
Never start a competing server on the same port.

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