# Desknoty design brain — read this before any design work

This folder is the project's permanent design memory. Every design or storefront
session reads it **before** writing JSX/CSS, consults it during review, and adds
to it after.

| File | Use it for |
|---|---|
| `DESKNOTY_RESEARCH.md` | What was actually inspected, what works, what to adapt, what not to copy |
| `DESKNOTY_DESIGN_SYSTEM.md` | Colours, type, layout, materials, components (Concept A) |
| `DESKNOTY_MOTION_SPEC.md` | Every animation: trigger, timing, easing, camera, fallbacks |
| `DESKNOTY_CONVERSION_PLAN.md` | Hook → curiosity → product → value → trust → purchase; metrics |
| `DESKNOTY_MISTAKES.md` | Real failed iterations from this project — check before shipping |
| `references/` | Screenshots that were actually captured (contact sheets) |

## Rules
1. Never cite a reference that is not in `DESKNOTY_RESEARCH.md` as *inspected*.
2. Before a design change: read MISTAKES, then the relevant spec.
3. After a review pass: add any new mistake (what / why / fix / prevention).
4. Real store data only. No fake products, reviews, discounts, timers or urgency.
5. Nothing goes live without approval: work on a branch; `main` auto-deploys.

## Tooling status (checked 2026-11-21)
- **Obsidian Second Brain** (eugeniughelbur/obsidian-second-brain, MIT): a Claude Code
  plugin; install via `/plugin marketplace add …` + `/plugin install …`, then
  `OBSIDIAN_VAULT_PATH` in `~/.claude/settings.json`. Core commands need no API keys.
  **Not installed.** The cloud session machine is wiped between sessions, so a vault
  here would not persist. Best place: the owner's computer (Obsidian is free), with
  this folder usable as (or copied into) the vault.
- **UI Design Second Brain** (albegosu/second-brain): captures inspiration via a
  "worker" that uses a vision model (OpenAI / Anthropic / Gemini / OpenRouter key —
  **paid API usage**), runs on GitHub Actions or locally, writes a private wiki repo and
  a DESIGN.md. **Not installed.** Needs the owner's approval for: an API key, a new
  private repo, and GitHub Actions minutes.
- **Fallback in use now:** this Markdown folder (in git, no third-party services).
