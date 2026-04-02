# 🧠 GitMind

> **The living memory of your repository—every file, every commit, one clear brain.**

GitMind is a **[GitAgent](https://github.com/open-gitagent/gitagent)-native** agent that scans a git repo, reasons about structure, history, health, and risk, and writes what it learns into **`MIND.md`**—a single, living report your team can read, diff, and trust (and verify). It never edits your source code; it **observes**, **cites**, and **explains**.

---

## ✨ What is GitMind?

1. **GitMind** is the *brain* of a repo: it maps the tree, stack, ownership patterns, and dependencies with sources attached.  
2. It turns **git history** into plain-English signal—what changed, what went quiet, who’s active—without replacing your tools.  
3. It answers **natural-language questions** with **file:line** or **commit** citations, **High / Medium / Low** confidence, and honest “I don’t know” when the repo doesn’t say.

---

## 📄 The `MIND.md` idea

GitMind doesn’t scatter notes across chats. It maintains one **master report** (and can mirror summaries per folder per your rules). Judges and teammates open **one file** and see the state of the world.

**Example snippet** (illustrative):

```markdown
# 🧠 GitMind Report
> _Last updated: 2026-04-01T12:00:00Z_
> _Overall Confidence: High_

## 🗺️ Repo Map
- `src/` — application code; entry at `src/index.ts` (line 12)

## 🔍 Recent Changes
- `a1b2c3d` — 2026-03-30 — CI: add typecheck to workflow (`.github/workflows/ci.yml`)

## 🟡 Needs Attention
- `package.json:42` — caret range on `lodash`; consider pinning for reproducible builds
```

---

## 🛠️ Skills (6)

| Skill | What it does |
|--------|----------------|
| **repo-scan** | Maps the repo tree, tech stack, folders, ownership hints, dependencies, and sensitive-file *paths* (never values). |
| **change-digest** | Summarizes recent commits, hot/stale areas, velocity, and contributors for `MIND.md`. |
| **health-check** | Scores repo health, calls out what’s good, what needs attention, and critical issues—with evidence. |
| **proactive-suggest** | Surfaces cross-cutting warnings, suggestions, and **top 3** next actions. |
| **answer** | Interactive Q&A: plain English answers with sources and confidence. |
| **impact-trace** | Traces “what breaks if I change this?” via dependency and reference edges. |

---

## 🚀 Setup

```bash
git clone https://github.com/<your-org>/gitmindagent.git
cd gitmindagent
npm install
cd gitmind
npx gitagent validate
npx gitagent info
```

- **`npm install`** applies patches (via `patch-package`) so the GitAgent CLI runs cleanly on this repo.  
- Run all **`gitagent`** commands from the **`gitmind/`** folder (or pass `-d gitmind` from the repo root).

**One-liner from repo root:**

```bash
npm install && npx gitagent validate -d gitmind
```

*(If you meant the **GitAgent** CLI rather than “gitclaw”—that’s `gitagent`, provided by `@open-gitagent/gitagent` after `npm install`.)*

---

## 💬 Example questions (answer skill)

- *“What is this repo for?”*  
- *“Why does `legacy/auth.js` still exist?”*  
- *“Who last touched the database config?”*  
- *“What changed in the last two weeks?”*  
- *“What will break if I delete `utils.ts`?”*  
- *“Is there API documentation anywhere?”*

---

## 📐 `MIND.md` output format

Sections follow a fixed template so skills know **where** to write:

- **Header** — tagline, timestamp, overall confidence, scanner version.  
- **Repo / stack / folders / ownership / deps / sensitive paths** — repo-scan.  
- **Recent activity, active & stale areas, velocity, contributors** — change-digest.  
- **Health score, green / yellow / red issues** — health-check.  
- **Warnings, suggestions, top 3 actions** — proactive-suggest.  
- **Impact analysis** — impact-trace (on demand).  
- **Ask GitMind** — pointer to conversational Q&A.  
- **Footer** — AI disclaimer + verify-before-acting reminder.

Open **`gitmind/MIND.md`** in this repo for the full empty template.

---

## 🏁 Built for GitAgent Hackathon

[![Built for GitAgent Hackathon](https://img.shields.io/badge/GitAgent-Hackathon-111827?style=for-the-badge&logo=git&logoColor=white)](https://github.com/open-gitagent/gitagent)

GitMind is submitted as a **spec-compliant** GitAgent bundle: `agent.yaml`, `SOUL.md`, `RULES.md`, `MIND.md`, and `skills/*/SKILL.md`—portable, versionable, and ready for `gitagent export` (e.g. system prompt, Cursor rules).

---

## 🔧 Tech stack

| Layer | Choice |
|--------|--------|
| **Standard** | GitAgent **0.1.0** (`spec_version`, manifest schema) |
| **Manifest** | YAML (`agent.yaml`) |
| **Agent docs** | Markdown (`SOUL.md`, `RULES.md`, `MIND.md`, skills) |
| **CLI** | `@open-gitagent/gitagent` + `patch-package` (pinned patches for reliable validate/export) |
| **Runtime** | Node.js **18+** |
| **Default model** (declared in manifest) | `claude-sonnet-4-5-20250929` (with Gemini fallbacks) |

---

*GitMind insights are AI-generated—always verify before acting.*
