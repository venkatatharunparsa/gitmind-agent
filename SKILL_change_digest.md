---
name: change_digest
description: "Reads git history and summarizes what changed, when, why, and by whom — identifying active areas, stale files, and team velocity."
allowed-tools: Bash Read Write
---

# Change Digest

You are GitMind executing a change digest scan. Your goal is to read the repository's git history, extract patterns, and write a clear, human-readable summary into `MIND.md` — who is working on what, what has been neglected, and how fast the codebase is moving.

Follow every step below in order. Never fabricate commit hashes, dates, or author names. Every claim must be sourced from actual git output. Assign a confidence level to every section you write.

---

## Step 0 — Verify Git History Exists

Before anything else, check whether the repository has any commits:

```bash
git rev-list --count HEAD 2>/dev/null
```

**If this command fails or returns `0`:**
- Skip all remaining steps
- Go directly to Step 8 (Write MIND.md) and write the no-history block described there
- Do not run any further git commands

**If this returns a number ≥ 1:** proceed to Step 1.

Also capture the total commit count for use in Step 7:
```bash
git rev-list --count HEAD
```

Store this number. You will use it in the Change Velocity section.

---

## Step 1 — Get the 20 Most Recent Commits

Run:
```bash
git log --oneline -20
```

This returns up to 20 lines in the format `<hash> <subject>`. Record the full output. From it, extract:

- The **short hash** of each commit (7 characters)
- The **commit subject line** — the human-readable summary of what changed
- The **relative order** — commit 1 is newest, commit 20 is oldest in this window

Also capture the full hash, author, date, and body for each of these commits:
```bash
git log --pretty=format:"%H|%an|%ae|%ad|%s|%b" --date=iso -20
```

Parse each line (pipe-delimited) and store:
- `%H` — full commit hash
- `%an` — author name
- `%ae` — author email
- `%ad` — author date (ISO 8601)
- `%s` — subject line
- `%b` — body (may be empty)

These fields are your primary source material. Every commit cited in `MIND.md` must use the full hash and ISO date from this output.

---

## Step 2 — Get Detailed Stats for the 5 Most Recent Commits

Run:
```bash
git log --stat -5
```

This shows each of the last 5 commits with the list of files changed and the insertions/deletions count per file. From this output, extract:

- **Which files changed** in each commit
- **How many lines were inserted and deleted** per file
- **The commit hash and timestamp** for each (present in the `--stat` output header)

This gives you the granular picture of recent work — not just "something changed" but exactly where the code moved.

---

## Step 3 — Inspect the Last Commit in Detail

Run:
```bash
git diff HEAD~1 HEAD --name-only
```

This lists only the file paths changed between the second-to-last and last commit. Record every path.

Then, for each file listed, determine its top-level directory (the first path segment). For example:
- `src/auth/middleware.ts` → `src/auth/`
- `tests/unit/parser_test.go` → `tests/unit/`
- `README.md` → root

This tells you which modules the most recent commit touched. If `HEAD~1` does not exist (only one commit in history), run instead:
```bash
git show --name-only --pretty=format: HEAD
```

Also capture the last commit metadata:
```bash
git log -1 --pretty=format:"%H|%an|%ad|%s" --date=iso
```

---

## Step 4 — Identify the Most Frequently Changed Areas

Find which directories and files have been touched most often across the last 50 commits (or all commits if fewer than 50 exist):

```bash
git log --name-only --pretty=format: -50 | grep -v '^$' | sort | uniq -c | sort -rn | head -20
```

This produces a ranked list: `<count> <filepath>`. Record the top 20 entries.

Then roll these up to the directory level:
```bash
git log --name-only --pretty=format: -50 \
  | grep -v '^$' \
  | sed 's|/[^/]*$||' \
  | sort | uniq -c | sort -rn | head -15
```

This tells you which **directories** are receiving the most churn — the active areas of the codebase.

Also find which **authors** have been most active in this window:
```bash
git log --pretty=format:"%an" -50 | sort | uniq -c | sort -rn | head -10
```

---

## Step 5 — Detect Stale Files (Not Touched in 90+ Days)

Calculate the cutoff date (90 days before today) and find all tracked files whose last modification commit is older than that date.

First, get today's date in a usable format:
```bash
date -d "90 days ago" +%Y-%m-%d 2>/dev/null || date -v-90d +%Y-%m-%d
```

Then find all files tracked by git:
```bash
git ls-files
```

For each file, find its last commit date. Rather than running this per-file (which is slow), use this efficient batch approach:

```bash
git log --pretty=format: --name-only --diff-filter=AM \
  | grep -v '^$' | sort -u > /tmp/gitmind_all_touched.txt

git ls-files > /tmp/gitmind_all_tracked.txt
```

Then find the last-modified date for the files you care about — focusing on source files (not generated files or lockfiles):

```bash
git ls-files \
  | grep -E '\.(js|ts|py|go|rs|java|kt|rb|cs|cpp|c|h|sh|yaml|yml|json|toml|md)$' \
  | grep -v -E '(node_modules|dist|build|vendor|\.min\.|package-lock|yarn\.lock)' \
  | while read f; do
      last=$(git log -1 --pretty=format:"%ad" --date=short -- "$f" 2>/dev/null)
      echo "$last $f"
    done \
  | sort | head -40
```

This gives you the 40 oldest-last-touched source files. From these, identify those whose last-touch date is more than 90 days before today. These are your **stale files**.

For stale files, also record:
- Path
- Last touched date (ISO 8601)
- Last author
- Last commit hash

```bash
git log -1 --pretty=format:"%H|%an|%ad" --date=iso -- <stale_file>
```

Group stale files by directory. A directory where all or most files are stale is a **stale zone** — worth calling out explicitly.

**Important nuance:** Some files are *supposed* to be stable — `LICENSE`, `CONTRIBUTING.md`, root config files. Use judgment: flag stale files only in `src/`, `lib/`, `pkg/`, `app/`, `services/`, `internal/`, or equivalent source directories. Do not flag stable-by-nature files as a concern.

---

## Step 6 — Summarize What the Team Is Working On

Based on the data gathered in Steps 1–5, write a plain-English paragraph (3–6 sentences) answering:

**"What is this team actively working on right now?"**

Draw on:
- The subjects of the last 20 commit messages (Step 1) — what themes recur?
- The top-changed directories (Step 4) — where is effort concentrated?
- The authors active in the last 50 commits (Step 4) — who is driving current work?
- Any obvious work streams: are there feature branches being merged? Bug fixes clustering in one module? A refactor in progress?

Do not fabricate intent. If commit messages are terse (`fix`, `update`, `wip`), say so and note that intent is unclear. Confidence should be Low in that case.

This paragraph becomes the opening of the `## 🔍 Recent Changes` section.

---

## Step 7 — Compute Change Velocity

Gather the data to characterize how fast this codebase is moving:

**Commits per time period:**
```bash
# Commits in the last 7 days
git log --oneline --after="7 days ago" | wc -l

# Commits in the last 30 days
git log --oneline --after="30 days ago" | wc -l

# Commits in the last 90 days
git log --oneline --after="90 days ago" | wc -l
```

**Lines changed in the last 30 days:**
```bash
git log --after="30 days ago" --pretty=tformat: --numstat \
  | awk '{add+=$1; del+=$2} END {print "+"add" -"del}'
```

**Active contributors in the last 30 days:**
```bash
git log --after="30 days ago" --pretty=format:"%an" | sort -u | wc -l
```

**Average commits per week over the last 90 days:**
Divide the 90-day commit count by 13 (weeks). Round to one decimal place.

**First commit date** (for repo age context):
```bash
git log --reverse --pretty=format:"%ad" --date=short | head -1
```

Combine these into a velocity profile: is this repo in active development, maintenance mode, or effectively abandoned?

---

## Step 8 — Write MIND.md

Append a new change digest block to `MIND.md` at the root of the repository. If `MIND.md` does not exist, create it. Never overwrite existing content — always append below any prior content.

---

### Block A — Normal output (git history exists)

```markdown
---
## Change Digest
> Scanned: <ISO 8601 timestamp> | GitMind change_digest v1

---

## 🔍 Recent Changes

<Plain-English paragraph from Step 6 — 3–6 sentences describing what the team is working on.>

### Last 20 Commits
| # | Hash | Date | Author | Summary |
|---|------|------|--------|---------|
| 1 | [`<short_hash>`]() | <YYYY-MM-DD> | <author> | <subject> |
| 2 | [`<short_hash>`]() | <YYYY-MM-DD> | <author> | <subject> |
<!-- ... repeat for all up to 20 commits -->

### Last Commit Detail
- **Commit:** `<full_hash>`
- **Author:** <name> `<<email>>`
- **Date:** <ISO 8601>
- **Message:** <subject line>
- **Files changed:**
  - `<path>` — <directory/module this belongs to>
  - `<path>` — <directory/module this belongs to>

**Confidence:** <High / Medium / Low>
**Basis:** `git log --oneline -20` and `git diff HEAD~1 HEAD --name-only`

---

## 🔥 Active Areas

> Directories and files receiving the most commits in the last 50 commits.

### By Directory
| Directory | Commits (last 50) | Primary Contributor(s) |
|-----------|------------------|------------------------|
| `<path>/` | <N> | <author(s)> |
| `<path>/` | <N> | <author(s)> |

### By File
| File | Commits (last 50) | Last Touched |
|------|------------------|-------------|
| `<path>` | <N> | <YYYY-MM-DD> (`<short_hash>`) |
| `<path>` | <N> | <YYYY-MM-DD> (`<short_hash>`) |

### Active Contributors (last 50 commits)
| Author | Commits |
|--------|---------|
| <name> | <N> |

**Confidence:** <High / Medium / Low>
**Basis:** `git log --name-only --pretty=format: -50` + directory rollup

---

## 🧊 Stale Areas (not touched in 90+ days)

<!-- If no stale source files found: write "No stale source files detected. All tracked source files have been touched within the last 90 days." -->

> Files and directories in source paths that have not been modified since <cutoff date (ISO 8601)>.

### Stale Files
| File | Last Touched | Last Author | Commit |
|------|-------------|-------------|--------|
| `<path>` | <YYYY-MM-DD> | <author> | `<short_hash>` |
| `<path>` | <YYYY-MM-DD> | <author> | `<short_hash>` |

### Stale Zones
<!-- Directories where the majority of files are stale -->
- `<directory>/` — <N> of <M> files untouched since <date>. Consider reviewing for removal or documentation.

> Note: Files that are stable by nature (LICENSE, CONTRIBUTING.md, root config) are excluded from this list.

**Confidence:** <High / Medium / Low>
**Basis:** `git ls-files` + `git log -1 --date=short` per source file

---

## 📈 Change Velocity

| Metric | Value |
|--------|-------|
| Commits (last 7 days) | <N> |
| Commits (last 30 days) | <N> |
| Commits (last 90 days) | <N> |
| Avg commits/week (90-day) | <N.N> |
| Lines changed (last 30 days) | <+N -N> |
| Active contributors (last 30 days) | <N> |
| Repo age | <N months/years> (first commit: <YYYY-MM-DD>) |
| Total commits | <N> |

### Velocity Assessment
<!-- Choose the most accurate description and expand in 1–2 sentences: -->
<!-- 🟢 Active Development — >10 commits/week, multiple contributors -->
<!-- 🟡 Maintenance Mode — 1–10 commits/week, changes are fixes/updates not features -->
<!-- 🔴 Low Activity — <1 commit/week on average over 90 days -->
<!-- ⚫ Dormant — no commits in 90+ days -->

<Assessment label and 1–2 sentence explanation citing the velocity numbers above.>

**Confidence:** High
**Basis:** `git log --oneline --after=` queries and `git log --numstat`

---

— GitMind | <ISO 8601 timestamp> | Confidence: <overall scan confidence>
```

---

### Block B — No git history (Step 0 returned 0 or failed)

```markdown
---
## Change Digest
> Scanned: <ISO 8601 timestamp> | GitMind change_digest v1

---

## 🔍 Recent Changes

No git history found in this repository.

This means either:
- The repository has been initialized (`git init`) but no commits have been made yet, **or**
- This directory is not a git repository

**To get started, make your first commit:**

```bash
git add .
git commit -m "Initial commit"
```

Once commits exist, re-run `change_digest` and GitMind will produce a full history analysis — recent changes, active areas, stale files, and velocity metrics.

## 🔥 Active Areas
_Not available — no commit history._

## 🧊 Stale Areas (not touched in 90+ days)
_Not available — no commit history._

## 📈 Change Velocity
_Not available — no commit history._

---

— GitMind | <ISO 8601 timestamp> | Confidence: High
<!-- Confidence is High because the absence of history is a definitive fact, not an inference. -->
```

---

## Execution Rules

**Never fabricate git data.** Commit hashes, author names, dates, and file paths must come directly from git command output. If a command returns no output, write "none found" — do not invent plausible-looking data.

**Short hash format for display, full hash for citation.** In tables and inline references, use the 7-character short hash for readability. In the "Basis" line of each section, always include the full hash when citing a specific commit.

**Confidence levels mean exactly this:**

| Level | When to use |
|-------|-------------|
| **High** | Output is directly from a git command — hash, date, author are all confirmed |
| **Medium** | Pattern inferred from aggregate data (e.g. "this directory seems active") with the counts shown |
| **Low** | Interpretation of sparse or ambiguous commit messages; intent cannot be confirmed from text alone |

Never round up. If commit messages are `fix`, `update`, `misc`, the velocity numbers may be High confidence but the plain-English summary of *intent* is Low.

**Append, never overwrite.** Each `change_digest` run adds a new dated block below existing `MIND.md` content. A reader should be able to see the digest history over time — like a changelog for the changelog.

**Sign every scan.** The final line of every block must be:
```
— GitMind | <ISO 8601 timestamp> | Confidence: <High / Medium / Low>
```
The overall confidence is the *lowest* confidence level assigned to any section in that scan.

**Stale file judgment.** Do not flag `LICENSE`, `*.md` at the repo root, lockfiles, or generated files as stale. Only flag files in source directories where staleness implies neglect, not stability.

**When `date -d` is unavailable** (macOS/BSD): use `date -v-90d +%Y-%m-%d`. If neither works, compute the cutoff manually from today's date minus 90 days and pass it as a literal string to `git log --before=`.

**If fewer than 20 commits exist:** show only as many rows as there are commits in the Recent Changes table. Do not pad with empty rows. Note: `Showing <N> of 20 requested commits — repository has <N> commits total.`

**If fewer than 2 commits exist:** skip Step 3 (`git diff HEAD~1 HEAD`) and note in the Last Commit Detail block: `Only one commit exists — no diff available.`
