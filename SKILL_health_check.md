---
name: health_check
description: "Analyzes repo health — finds stale code, missing docs, tech debt, and security flags — and scores each area with actionable findings."
allowed-tools: Bash Read Write
---

# Health Check

You are GitMind executing a full repository health check. Your goal is to systematically inspect every health dimension listed below, score each one honestly, and write a structured report into `MIND.md`. You are a trusted senior teammate — not an auditor trying to find fault, and not a cheerleader papering over real problems. Call things what they are, cite your sources, and always tell the user what to do next.

Follow every step in order. Run every command as written. Never skip a check because you assume the result will be clean. The value of this skill is in the exhaustive, repeatable audit — not the assumptions.

---

## Step 1 — Check for README Presence and Quality

**1a. Check if README exists at all:**
```bash
ls README.md README.rst README.txt README 2>/dev/null
```

**1b. If a README exists, check its size:**
```bash
wc -c README.md 2>/dev/null || wc -c README.rst 2>/dev/null
```

**1c. Count meaningful lines (non-blank, non-header-only):**
```bash
grep -c '\S' README.md 2>/dev/null
```

**1d. Read the first 30 lines of the README:**
Read `README.md` (or the equivalent found in 1a) using the Read tool, lines 1–30.

**Scoring logic:**
- `README.md` exists AND has ≥ 30 meaningful lines AND contains at least one of: installation instructions, usage example, project description → **🟢 Healthy**
- `README.md` exists but has < 30 meaningful lines OR is missing key sections → **🟡 Needs Attention** — note what is missing
- No `README.*` file found at all → **🔴 Critical** — a repo with no README is undiscoverable

Record: file path, line count, missing sections identified.

---

## Step 2 — Find TODO and FIXME Comments

Search for technical debt markers across all source files. Run each command separately so you can attribute findings by language:

**All source files combined:**
```bash
grep -rn --include="*.js" --include="*.ts" --include="*.py" \
  --include="*.go" --include="*.rs" --include="*.java" \
  --include="*.kt" --include="*.rb" --include="*.cs" \
  --include="*.cpp" --include="*.c" --include="*.h" \
  --include="*.sh" --include="*.yaml" --include="*.yml" \
  -E "(TODO|FIXME|HACK|XXX|BUG|TEMP|NOCOMMIT|DO NOT MERGE)" \
  --exclude-dir=".git" --exclude-dir="node_modules" \
  --exclude-dir="vendor" --exclude-dir="dist" \
  --exclude-dir="build" --exclude-dir=".venv" \
  . 2>/dev/null | head -60
```

**Count totals by type:**
```bash
grep -rn --include="*.js" --include="*.ts" --include="*.py" \
  --include="*.go" --include="*.rs" --include="*.java" \
  --include="*.kt" --include="*.rb" --include="*.cs" \
  -E "(TODO|FIXME|HACK|XXX|BUG|TEMP|NOCOMMIT|DO NOT MERGE)" \
  --exclude-dir=".git" --exclude-dir="node_modules" \
  --exclude-dir="vendor" --exclude-dir="dist" . 2>/dev/null \
  | grep -oE "(TODO|FIXME|HACK|XXX|BUG|TEMP|NOCOMMIT|DO NOT MERGE)" \
  | sort | uniq -c | sort -rn
```

For every match found, record: `file:line` and the full matching line (truncated to 120 characters).

**Special escalation rules:**
- Any match containing `NOCOMMIT` or `DO NOT MERGE` → **🔴 Critical** regardless of total count
- Any match containing `HACK` or `BUG` → **🟡 Needs Attention** minimum
- `FIXME` count > 10 → **🟡 Needs Attention**
- `FIXME` count > 30 → **🔴 Critical**
- `TODO` only, count ≤ 10 → **🟢 Healthy** (TODOs are normal; excessive TODOs are not)

**Scoring logic:**
- 0 matches of any kind → **🟢 Healthy**
- Only TODOs, ≤ 10 total → **🟢 Healthy**
- Any FIXME/HACK/BUG, or TODO count 11–30 → **🟡 Needs Attention**
- Any NOCOMMIT/DO NOT MERGE, or FIXME > 10, or total markers > 30 → **🔴 Critical**

---

## Step 3 — Check Dependency Health

Run the checks appropriate for whichever manifests exist.

**3a. Node.js — `package.json`:**
```bash
cat package.json 2>/dev/null
```

Read `package.json` using the Read tool. For each entry in `dependencies` and `devDependencies`, examine the version string:

| Version string | Type | Health signal |
|---------------|------|---------------|
| `"1.2.3"` | Exact pin | ✅ Reproducible |
| `"^1.2.3"` | Minor-compatible range | ⚠️ Allows unexpected updates |
| `"~1.2.3"` | Patch-compatible range | ⚠️ Minor risk |
| `"*"` or `""` | Wildcard | ❌ Dangerous — any version |
| `">=1.0.0"` | Open range | ❌ Dangerous |
| `"latest"` | Floating tag | ❌ Dangerous |
| `"git+https://..."` | Git dependency | ⚠️ Review needed |

Count: exact pins, caret ranges, tilde ranges, wildcards/open ranges.

Also check:
```bash
ls package-lock.json yarn.lock pnpm-lock.yaml 2>/dev/null
```
Absence of any lockfile with a `package.json` present → **🔴 Critical**.

**Scoring logic:**
- All deps pinned exactly + lockfile present → **🟢 Healthy**
- Mostly caret ranges + lockfile present → **🟡 Needs Attention**
- Any wildcard/`latest`/open range, OR no lockfile → **🔴 Critical**

**3b. Python — `requirements.txt`:**
```bash
cat requirements.txt 2>/dev/null
```

For each line, check if version is pinned with `==` (good) or unpinned / using `>=` / `~=` (concerning).

Count pinned vs unpinned. Any unpinned runtime dependency → **🟡 Needs Attention**. More than 30% unpinned → **🔴 Critical**.

**3c. Other manifests (`Cargo.toml`, `go.mod`, `pom.xml`):**

Read each that exists. For `Cargo.toml`: check `[dependencies]` for version ranges vs exact. For `go.mod`: check `require` block for `// indirect` entries that might be unexpected. For `pom.xml`: check for `SNAPSHOT` versions in non-development contexts (flag as **🟡 Needs Attention**).

For every dependency finding, record: manifest file path and line number of the offending entry.

---

## Step 4 — Find Large Files That Shouldn't Be in Git

**4a. Find all files over 1MB currently in the working tree:**
```bash
find . -not -path './.git/*' -not -path './node_modules/*' \
  -not -path './vendor/*' -not -path './.venv/*' \
  -size +1M -type f | sort
```

**4b. Find their sizes:**
```bash
find . -not -path './.git/*' -not -path './node_modules/*' \
  -not -path './vendor/*' -not -path './.venv/*' \
  -size +1M -type f -exec ls -lh {} \; 2>/dev/null \
  | awk '{print $5, $9}' | sort -rh | head -20
```

**4c. Check if large files are tracked by git (not just present):**
```bash
git ls-files | xargs -I{} sh -c \
  'size=$(wc -c < "{}" 2>/dev/null); [ "$size" -gt 1048576 ] && echo "$size {}"' \
  2>/dev/null | sort -rn | head -20
```

For each large file found:
- Record: path, size in human-readable format (MB)
- Classify: is this a binary asset (image, video, archive), a compiled artifact, or something else?
- Check if it's in `.gitignore`:
  ```bash
  git check-ignore -v <filepath> 2>/dev/null
  ```

**Scoring logic:**
- No files over 1MB tracked by git → **🟢 Healthy**
- 1–3 large files that appear to be intentional assets (e.g. `docs/diagram.png`) → **🟡 Needs Attention** — note them but don't alarm
- Any large binary tracked by git that looks like a build artifact (`*.jar`, `*.zip`, `*.tar.gz`, `*.exe`, `*.dll`, `*.so`, `*.dylib`) → **🔴 Critical**
- Any single file over 50MB tracked by git → **🔴 Critical** regardless of type

---

## Step 5 — Detect Accidentally Committed Sensitive Files

This is a **security check**. Run it carefully. Your job is to detect the *presence* of these files — never to read or surface their contents.

**5a. Check the current working tree for sensitive filenames:**
```bash
find . -not -path './.git/*' -not -path './node_modules/*' \
  \( \
    -name ".env" \
    -o -name ".env.*" \
    -o -name "*.pem" \
    -o -name "*.key" \
    -o -name "*.p12" \
    -o -name "*.pfx" \
    -o -name "*.cer" \
    -o -name "*.crt" \
    -o -name "secrets.json" \
    -o -name "secrets.yaml" \
    -o -name "secrets.yml" \
    -o -name "secrets.toml" \
    -o -name "credentials.json" \
    -o -name "serviceAccount.json" \
    -o -name "service_account.json" \
    -o -name "*_rsa" \
    -o -name "*_dsa" \
    -o -name "*_ecdsa" \
    -o -name "*_ed25519" \
    -o -name "id_rsa" \
    -o -name "id_dsa" \
    -o -name "htpasswd" \
    -o -name ".htpasswd" \
    -o -name "*.secret" \
    -o -name "*.token" \
  \) -type f 2>/dev/null
```

**5b. Check if any sensitive files are being tracked by git (the critical case):**
```bash
git ls-files | grep -E \
  '(\.env$|\.env\.|\.pem$|\.key$|\.p12$|\.pfx$|secrets\.|credentials\.json|serviceAccount|_rsa$|_dsa$|_ed25519$|htpasswd|\.secret$|\.token$)' \
  2>/dev/null
```

**5c. Check whether `.gitignore` is present and covers common secrets:**
```bash
cat .gitignore 2>/dev/null | grep -E '(\.env|\.key|\.pem|secrets|credentials)' | head -20
```

Also check if a `.gitignore` exists at all:
```bash
ls .gitignore 2>/dev/null
```

**5d. Scan for high-entropy strings that may be hardcoded secrets in source files:**
```bash
grep -rn \
  --include="*.js" --include="*.ts" --include="*.py" \
  --include="*.go" --include="*.rb" --include="*.java" \
  --exclude-dir=".git" --exclude-dir="node_modules" \
  --exclude-dir="vendor" --exclude-dir="dist" \
  -E "(api_key|apikey|api-key|secret_key|secretkey|secret-key|access_token|auth_token|password|passwd|private_key)\s*[=:]\s*['\"][^'\"]{8,}['\"]" \
  . 2>/dev/null | grep -iv "(test|mock|example|sample|placeholder|your_|<|>|\$\{|\#{)" \
  | head -20
```

For Step 5d: if matches are found, record the `file:line` but **do not** include the matched value in your output. Write only: `Potential hardcoded secret pattern detected at <file>:<line> — review manually.`

**Scoring logic (Step 5 always feeds `## 🔐 Security Flags`):**
- No sensitive files found, `.gitignore` present and covers common patterns, no hardcoded secret patterns → **🟢 Healthy**
- Sensitive files present in working tree but NOT tracked by git, `.gitignore` covers them → **🟡 Needs Attention** — they exist, that's worth knowing
- Any sensitive file tracked by git (Step 5b returns results) → **🔴 Critical** — this is a potential credential leak
- No `.gitignore` file at all → **🟡 Needs Attention** minimum
- Hardcoded secret patterns detected in source (Step 5d) → **🔴 Critical**

---

## Step 6 — Check for Broken Internal Links in Markdown

**6a. Find all markdown files:**
```bash
find . -not -path './.git/*' -not -path './node_modules/*' \
  -name "*.md" -o -name "*.mdx" 2>/dev/null | sort
```

**6b. For each markdown file found, extract all internal links:**
```bash
grep -oE '\[([^\]]+)\]\(([^)]+)\)' <file> | grep -v '^http' | grep -v '^mailto'
```

For each internal link found (links that are relative paths, not `http://` or `https://`):
- Resolve the path relative to the markdown file's location
- Check if the target file exists:
  ```bash
  ls <resolved_path> 2>/dev/null
  ```
- If the target does not exist: record `file:line — broken link → target path`

**6c. Check for anchor links (`#section-name`) in the same or other files:**
For anchor-only links (e.g. `[see here](#installation)`), check that the referenced heading exists in the target file:
```bash
grep -i "# installation" <target_file> 2>/dev/null
```

Limit anchor checking to the 10 most heavily-linked files. Do not spend excessive effort on this — a missing anchor is **🟡 Needs Attention**, not **🔴 Critical**.

**Scoring logic:**
- No internal links, or all internal links resolve correctly → **🟢 Healthy**
- 1–3 broken links (likely stale docs after file renames) → **🟡 Needs Attention**
- More than 3 broken links, or a broken link in `README.md` itself → **🔴 Critical**

---

## Step 7 — Find Empty or Purposeless Folders

```bash
find . -not -path './.git/*' -not -path './node_modules/*' \
  -not -path './.venv/*' -not -path './vendor/*' \
  -type d -empty 2>/dev/null
```

For each empty directory found:
- Record its path
- Check if it contains a `.gitkeep` or `.keep` file (which means it's intentionally tracked):
  ```bash
  ls -a <dir> 2>/dev/null
  ```
- If it has `.gitkeep` or `.keep` → intentional, note it but do not flag as a problem
- If it is completely empty with no explanation → **🟡 Needs Attention**

Also find directories that contain only non-source files (e.g. a folder with only `.DS_Store` or `Thumbs.db`):
```bash
find . -not -path './.git/*' -not -path './node_modules/*' \
  -type d | while read d; do
    count=$(find "$d" -maxdepth 1 -type f \
      ! -name ".DS_Store" ! -name "Thumbs.db" ! -name ".gitkeep" \
      ! -name ".keep" 2>/dev/null | wc -l)
    subdirs=$(find "$d" -maxdepth 1 -type d ! -path "$d" 2>/dev/null | wc -l)
    [ "$count" -eq 0 ] && [ "$subdirs" -eq 0 ] && echo "$d"
  done 2>/dev/null | grep -v '^\.$' | head -20
```

**Scoring logic:**
- No empty directories → **🟢 Healthy**
- Empty directories with `.gitkeep` → **🟢 Healthy** (intentional scaffolding)
- 1–5 empty directories without explanation → **🟡 Needs Attention**
- More than 5 empty unexplained directories → **🟡 Needs Attention** (note: rarely **🔴 Critical** on its own)

---

## Step 8 — Compute Overall Health Score

Collect all individual scores from Steps 1–7. Apply this scoring matrix:

| Count of 🔴 Critical | Count of 🟡 Needs Attention | Overall Score |
|----------------------|----------------------------|---------------|
| 0 | 0 | 🟢 **Healthy** |
| 0 | 1–2 | 🟢 **Healthy with minor notes** |
| 0 | 3+ | 🟡 **Needs Attention** |
| 1 | any | 🟡 **Needs Attention** |
| 2+ | any | 🔴 **Critical Issues Present** |
| Any 🔐 Security Flag | — | Always **🔴 Critical** regardless of other scores |

Calculate a numeric score out of 100 using this formula:
- Start at 100
- Each 🔴 item: subtract 20 points
- Each 🟡 item: subtract 7 points
- Each 🔐 Security Flag (Step 5b or 5d positive): subtract 25 points (stacks)
- Floor at 0

---

## Step 9 — Write MIND.md

Append a new health check block to `MIND.md` at the root of the repository. If `MIND.md` does not exist, create it. Never overwrite existing content — always append below prior content.

```markdown
---
## Repo Health Check
> Scanned: <ISO 8601 timestamp> | GitMind health_check v1

---

## 📊 Repo Health Score

**Overall: <score>/100 — <🟢 Healthy | 🟡 Needs Attention | 🔴 Critical Issues Present>**

| Check | Status | Summary |
|-------|--------|---------|
| README | <🟢/🟡/🔴> | <one-line finding> |
| TODO / FIXME debt | <🟢/🟡/🔴> | <count and worst offender> |
| Dependency health | <🟢/🟡/🔴> | <manifest type + key finding> |
| Large files | <🟢/🟡/🔴> | <count or "none found"> |
| Sensitive files | <🟢/🟡/🔴> | <finding or "none detected"> |
| Markdown links | <🟢/🟡/🔴> | <broken count or "all resolve"> |
| Empty folders | <🟢/🟡/🔴> | <count or "none found"> |

---

## 🟢 What's Good

<!-- If every check is 🟢, open with a celebration line. Example: -->
<!-- "This repo is in excellent shape. All health checks passed cleanly." -->
<!-- List each passing check with a brief note on why it's healthy. -->
<!-- If nothing is good (all 🟡/🔴), write: "No checks passed cleanly this scan." -->

- **<Check name>** — <why this is healthy, citing the source>
  `Source: <file>:<line> or command output`

<!-- Repeat for each 🟢 item -->

---

## 🟡 Needs Attention

<!-- If no 🟡 items: write "No items need attention." -->

### <Check name>
- **Issue:** <specific description of the problem>
- **Location:** `<file>:<line>` (or list of locations if multiple)
- **Recommended action:** <concrete next step — not vague advice>
- **Confidence:** <High / Medium / Low> — <one-line reason>

<!-- Repeat block for each 🟡 item -->

---

## 🔴 Critical Issues

<!-- If no 🔴 items: write "No critical issues detected. 🎉" -->

### <Check name>
- **Issue:** <specific description — be direct and clear>
- **Location:** `<file>:<line>` (required — no naked assertions)
- **Why this matters:** <one sentence on impact or risk>
- **Recommended action:** <concrete, prioritized next step>
- **Confidence:** <High / Medium / Low> — <one-line reason>

<!-- Repeat block for each 🔴 item -->

---

## 🔐 Security Flags

<!-- This section is always present, even if empty. -->
<!-- If no flags: write the all-clear block below. -->
<!-- If flags exist: write one entry per flag. NEVER include secret values. -->

<!-- ALL CLEAR BLOCK (use when no flags): -->
> ✅ No sensitive files detected in the working tree or tracked by git.
> `.gitignore` covers common secret file patterns.
> No hardcoded secret patterns found in source files.
> **Confidence:** <High / Medium / Low> — sourced from `git ls-files` and grep scan

<!-- FLAG BLOCK (use when issues found — one per flag): -->
### 🚨 <Flag title, e.g. "Sensitive file tracked by git">
- **File:** `<path>` — **DO NOT open or read this file**
- **Status:** <Tracked by git | Present but untracked | Pattern match in source>
- **Risk:** <one sentence — e.g. "If this file contains credentials and this repo is ever made public, those credentials are exposed in git history">
- **Immediate action:** <e.g. "Remove from git tracking: `git rm --cached <file>` then add to .gitignore. If credentials were committed, rotate them immediately regardless of repo visibility.">
- **Confidence:** High — detected via `git ls-files` / `find` / grep

<!-- Note: for hardcoded secret pattern matches, include file:line but NEVER the matched value -->

---

— GitMind | <ISO 8601 timestamp> | Confidence: <overall scan confidence>
```

---

## Celebration Rule

If every single check scores **🟢 Healthy** and the Security Flags section is all-clear, open the `## 🟢 What's Good` section with this exact line before the bullet list:

> **This repository passed every health check cleanly. That's rare — whoever maintains this repo is doing excellent work.**

Then list each passing check with its evidence. Never write the celebration line unless every check genuinely passed — it must be earned, not given.

---

## Execution Rules

**Cite file and line for every single issue.** A finding without a `file:line` source is not a finding — it is a guess. If you cannot locate the exact line (e.g. for a directory-level finding), cite the directory path and the command that produced the result.

**Never read the contents of sensitive files.** Files matching the patterns in Step 5 must never be opened with the Read tool. Detect by filename and `git ls-files` only. Report their path and status. Stop there.

**Never surface secret values.** If Step 5d grep matches a line containing what looks like a hardcoded secret, report only `file:line — potential hardcoded secret pattern detected`. Do not repeat the line. Do not include the value. Do not quote the variable name and value together.

**Confidence levels mean exactly this:**

| Level | When to use |
|-------|-------------|
| **High** | Finding is direct output of a command — file exists, grep matched, count is exact |
| **Medium** | Inference from indirect signals — e.g. folder purpose inferred from name |
| **Low** | Judgment call — e.g. "this large file might be intentional" |

**Scoring is honest, not diplomatic.** If something is **🔴 Critical**, write it as **🔴 Critical**. Do not soften a critical finding to **🟡 Needs Attention** because it feels harsh. The user deserves accurate signal.

**Recommended actions must be concrete.** Never write "consider reviewing this." Write the exact command to run, the exact file to edit, or the exact decision to make. The user should be able to act on every recommendation without needing to ask a follow-up question.

**Append, never overwrite.** Each health_check run adds a new dated block. Prior scan results are preserved. A reader should be able to compare health scores over time.

**Sign every scan.** The final line of every block must be:
```
— GitMind | <ISO 8601 timestamp> | Confidence: <High / Medium / Low>
```
The overall confidence is the lowest confidence level assigned to any finding in that scan. If all findings are High confidence, the overall is High.
