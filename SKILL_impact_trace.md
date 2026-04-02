---
name: impact_trace
description: "Traces what would break or be affected if a specific file or function changes — maps direct and indirect dependents, test coverage, and historical risk."
allowed-tools: Bash Read Write
---

# Impact Trace

You are GitMind running an impact trace. A user has asked about a specific file or function — what depends on it, what would break if it changed, and how risky that change would be. Your job is to follow the dependency chain outward, read the dependent files, surface historical risk signals, and produce a clear impact map.

This skill is surgical and precise. You are not scanning the whole repo — you are tracing one thread from a known starting point. Be thorough on that thread. Cite every file you find. Stop at 2 levels of depth. Never guess at dependencies — only report what grep and git actually confirm.

---

## Step 0 — Parse the Target

The user has provided either:
- A **file path** (e.g. `src/auth/middleware.ts`, `utils/parser.py`)
- A **function or class name** (e.g. `parseToken`, `UserService`, `db_connect`)
- A **module name** (e.g. `auth`, `config`, `database`)
- A combination (e.g. `parseToken in src/auth/middleware.ts`)

**0a. Normalize the target:**

If a full file path was given:
- Confirm the file exists:
  ```bash
  ls "<target_path>" 2>/dev/null
  ```
- If the file does not exist, search for it by name:
  ```bash
  find . -not -path './.git/*' -not -path './node_modules/*' \
    -name "<filename>" 2>/dev/null
  ```
- If still not found: write the not-found block described in Step 9B and stop.

If only a function/class name was given:
- Find which file(s) define it:
  ```bash
  grep -rn \
    --include="*.js" --include="*.ts" --include="*.py" \
    --include="*.go" --include="*.rs" --include="*.java" \
    --include="*.kt" --include="*.rb" --include="*.cs" \
    --exclude-dir=".git" --exclude-dir="node_modules" \
    --exclude-dir="dist" --exclude-dir="build" \
    -E "(^|\s)(export\s+(default\s+)?(function|class|const|async function)|def |func |fn |public (static )?(class|function)|class )\s*<name>" \
    . 2>/dev/null | head -10
  ```
  Also try a simpler fallback:
  ```bash
  grep -rn \
    --include="*.js" --include="*.ts" --include="*.py" \
    --include="*.go" --include="*.rs" --include="*.java" \
    --exclude-dir=".git" --exclude-dir="node_modules" \
    "<name>" . 2>/dev/null | grep -E "(def |func |function |class |const |export)" | head -10
  ```
- If multiple definition sites are found, list all of them and trace each one. Note when a name is defined in multiple places — this is itself a finding worth flagging.

**Store:**
- `TARGET_FILE` — the canonical file path being analyzed
- `TARGET_SYMBOL` — the function/class/export name if one was specified (empty if file-level trace only)
- `TARGET_DISPLAY` — what to show in headers (filename, or "functionName in path/to/file.ext")

---

## Step 1 — Determine the Module Identity

Before searching for dependents, establish how this file/symbol is referenced by others — the exact string others would use to import or require it.

**1a. Detect the language of the target file** from its extension.

**1b. Determine the import identifier by language:**

**JavaScript / TypeScript:**
```bash
# Get the file's basename without extension
basename "<TARGET_FILE>" | sed 's/\.[^.]*$//'
```
Also check if the file is the `index` of a directory — in that case, the directory name is the import identifier:
```bash
dirname "<TARGET_FILE>"
```
Also read the first 20 lines to check for named exports:
Read `<TARGET_FILE>` lines 1–20 using the Read tool. Note every `export` statement — these are the symbols others import by name.

**Python:**
```bash
# Module name is the filename without .py, dots replaced
basename "<TARGET_FILE>" .py
# Package name is the directory name if __init__.py exists
ls "$(dirname '<TARGET_FILE>')/__init__.py" 2>/dev/null
```

**Go:**
```bash
# Package name is declared in the file
head -5 "<TARGET_FILE>" | grep "^package "
```

**Rust:**
```bash
# Module name is the filename without .rs, or mod.rs means the directory name
basename "<TARGET_FILE>" .rs
```

**Java / Kotlin:**
Read the first 5 lines using the Read tool to find the `package` declaration and class name.

Store the import identifier(s) — the string(s) that other files would use when referencing this target.

---

## Step 2 — Find Direct Dependents (Level 1)

Search for all files that import, require, or directly reference the target. Run the appropriate search for the detected language.

**JavaScript / TypeScript — all import forms:**
```bash
# ES module imports
grep -rln \
  --include="*.js" --include="*.ts" --include="*.jsx" --include="*.tsx" \
  --include="*.mjs" --include="*.cjs" \
  --exclude-dir=".git" --exclude-dir="node_modules" \
  --exclude-dir="dist" --exclude-dir="build" \
  -E "from ['\"]([./]+)?<IDENTIFIER>['\"]|require\(['\"]([./]+)?<IDENTIFIER>['\"]" \
  . 2>/dev/null
```
Also search for the symbol name directly if `TARGET_SYMBOL` is set:
```bash
grep -rln \
  --include="*.js" --include="*.ts" --include="*.jsx" --include="*.tsx" \
  --exclude-dir=".git" --exclude-dir="node_modules" --exclude-dir="dist" \
  "<TARGET_SYMBOL>" . 2>/dev/null
```

**Python:**
```bash
grep -rln \
  --include="*.py" \
  --exclude-dir=".git" --exclude-dir=".venv" \
  --exclude-dir="__pycache__" --exclude-dir="dist" \
  -E "^(import <MODULE>|from <MODULE> import|from \.<MODULE> import|from \.\.<MODULE> import)" \
  . 2>/dev/null
```

**Go:**
```bash
# Get the full module path from go.mod
module_path=$(grep "^module " go.mod 2>/dev/null | awk '{print $2}')
pkg_path="$module_path/$(dirname '<TARGET_FILE>')"
grep -rln --include="*.go" \
  --exclude-dir=".git" --exclude-dir="vendor" \
  "\"$pkg_path\"" . 2>/dev/null
```

**Rust:**
```bash
grep -rln --include="*.rs" \
  --exclude-dir=".git" --exclude-dir="target" \
  -E "(use |mod )<MODULE>" . 2>/dev/null
```

**Java / Kotlin:**
```bash
grep -rln \
  --include="*.java" --include="*.kt" \
  --exclude-dir=".git" --exclude-dir="build" --exclude-dir="target" \
  -E "import <PACKAGE>\.<CLASS>" . 2>/dev/null
```

**Universal fallback (catches any reference, including config files and docs):**
```bash
grep -rln \
  --exclude-dir=".git" --exclude-dir="node_modules" \
  --exclude-dir="dist" --exclude-dir="build" --exclude-dir="vendor" \
  "<IDENTIFIER>" . 2>/dev/null | head -30
```

**Exclude the target file itself from all results.**

Store the result as `LEVEL_1_DEPENDENTS` — the full list of file paths. Deduplicate. If the list exceeds 30 files, note the total count but only process the first 30 for detail.

**If `LEVEL_1_DEPENDENTS` is empty:** go to Step 9C (no dependents found). Do not proceed to Step 3.

---

## Step 3 — Read Dependent Files to Understand Usage

For each file in `LEVEL_1_DEPENDENTS` (up to 15 files — prioritize non-test files first, then test files):

**3a. Find the specific line(s) where the target is used:**
```bash
grep -n "<IDENTIFIER>\|<TARGET_SYMBOL>" "<dependent_file>" 2>/dev/null | head -15
```

**3b. Read context around each usage line:**
Read `<dependent_file>` using the Read tool, at the line number found ±5 lines.

For each dependent file, record:
- File path
- Line number(s) where the target is used
- How it is used: direct call, inheritance/extension, re-export, type annotation only, config reference
- Whether the usage is in production code or test code (check path: `test/`, `tests/`, `__tests__/`, `spec/`, `*.test.*`, `*.spec.*`)

**Usage classification:**

| Usage type | Risk signal |
|-----------|-------------|
| Called directly as a function | High — behavior change propagates |
| Instantiated as a class | High — interface change propagates |
| Inherited / extended | High — breaking the parent breaks all children |
| Re-exported (barrel file) | Medium-High — change propagates to re-export consumers |
| Used as a type annotation only | Low — type-only, no runtime impact |
| Referenced in config or docs | Low — informational reference |
| Imported but not visibly used | Low — may be unused import |

Carry the usage classifications forward into risk scoring in Step 8.

---

## Step 4 — Find Indirect Dependents (Level 2)

For each file in `LEVEL_1_DEPENDENTS`, find what depends on *it* — but only for non-test files (test files rarely have further dependents worth tracing).

**4a. Get the identifier for each Level 1 file:**
Apply the same identifier derivation logic from Step 1 to each Level 1 file.

**4b. Search for Level 2 dependents:**
For each Level 1 file, run the same search as Step 2 but targeting that file's identifier. Cap results at 10 per Level 1 file.

```bash
grep -rln \
  --exclude-dir=".git" --exclude-dir="node_modules" \
  --exclude-dir="dist" --exclude-dir="build" \
  "<LEVEL_1_IDENTIFIER>" . 2>/dev/null | head -10
```

**Exclude:**
- The original `TARGET_FILE`
- Any file already in `LEVEL_1_DEPENDENTS`
- The Level 1 file being searched

Store results as `LEVEL_2_DEPENDENTS`. Deduplicate across all Level 1 searches.

If `LEVEL_2_DEPENDENTS` is very large (> 50 unique files): this is a high-propagation signal. Record the total count but only list the first 20. Note explicitly: `This change propagates to 50+ files indirectly — treat as high-risk.`

---

## Step 5 — Detect Circular Dependencies

Check whether the target file imports from any of its own dependents — a circular dependency that would make changes unpredictable.

**5a. Get the imports of the TARGET_FILE:**
```bash
grep -n \
  -E "^(import|from|require|use |mod )" \
  "<TARGET_FILE>" 2>/dev/null | head -20
```

**5b. Extract imported paths and check if any appear in LEVEL_1_DEPENDENTS or LEVEL_2_DEPENDENTS:**

For each import line in the target file, extract the imported path and check:
```bash
echo "<imported_path>" | grep -F -f <(printf '%s\n' "${LEVEL_1_DEPENDENTS[@]}")
```

Any match is a **circular dependency**. Record:
- Target file imports from X
- X also imports from target file
- This means: changing the target may require simultaneous changes to X, and the two files are tightly coupled

Circular dependencies are always a **🔴 High Risk** signal regardless of other factors.

---

## Step 6 — Identify Test Coverage

**6a. Find test files that directly test the target:**
```bash
# By target filename pattern
target_base=$(basename "<TARGET_FILE>" | sed 's/\.[^.]*$//')
find . -not -path './.git/*' -not -path './node_modules/*' \
  \( \
    -name "${target_base}.test.*" \
    -o -name "${target_base}.spec.*" \
    -o -name "${target_base}_test.*" \
    -o -name "test_${target_base}.*" \
    -o -name "${target_base}Test.*" \
  \) 2>/dev/null
```

**6b. Search for the target symbol in test files:**
```bash
grep -rln \
  --include="*.test.js" --include="*.test.ts" \
  --include="*.spec.js" --include="*.spec.ts" \
  --include="*_test.go" --include="test_*.py" \
  --include="*_test.py" --include="*Test.java" \
  --include="*_test.rs" --include="*_spec.rb" \
  --exclude-dir=".git" --exclude-dir="node_modules" \
  "<TARGET_SYMBOL>\|<IDENTIFIER>" . 2>/dev/null
```

**6c. For each test file found, count how many test cases reference the target:**
```bash
grep -c \
  -E "(it\(|test\(|describe\(|def test_|func Test|#\[test\])" \
  "<test_file>" 2>/dev/null
```

**6d. Determine coverage classification:**

| Condition | Classification |
|-----------|---------------|
| Dedicated test file exists AND target symbol appears in multiple test cases | ✅ **Yes** — well covered |
| No dedicated test file but symbol appears in integration/e2e tests | ⚠️ **Partial** — covered indirectly |
| Symbol appears in test files but only in import statements (not test cases) | ⚠️ **Partial** — imported but not exercised |
| No test files reference the target at all | ❌ **None** — no test coverage found |

Record: test file paths, test case counts, coverage classification.

---

## Step 7 — Check Git History for Past Issues

Look for signals in git history that this file has caused problems before.

**7a. Get full commit history for the target file:**
```bash
git log --oneline -- "<TARGET_FILE>" 2>/dev/null | head -20
```

**7b. Look for fix/bug/revert commits touching this file:**
```bash
git log --oneline -- "<TARGET_FILE>" 2>/dev/null \
  | grep -iE "(fix|bug|revert|hotfix|patch|broke|broken|regression|issue|crash|error)" \
  | head -10
```

**7c. Check for revert commits specifically:**
```bash
git log --oneline -- "<TARGET_FILE>" 2>/dev/null \
  | grep -iE "^[a-f0-9]+ [Rr]evert" | head -5
```

**7d. Count total commits to this file and compute churn rate:**
```bash
git log --oneline -- "<TARGET_FILE>" 2>/dev/null | wc -l
```

Also get the date of the first and last commit to this file:
```bash
# First commit
git log --follow --diff-filter=A --pretty=format:"%ad %H" \
  --date=short -- "<TARGET_FILE>" 2>/dev/null | tail -1

# Last commit
git log -1 --pretty=format:"%ad %H %s" \
  --date=short -- "<TARGET_FILE>" 2>/dev/null
```

Churn rate = total commits ÷ file age in months. A rate above 3 commits/month is a signal of instability.

**7e. Check if this file appeared in any merge conflict resolutions:**
```bash
git log --oneline --merges -- "<TARGET_FILE>" 2>/dev/null | head -5
```

**7f. Look at the blame summary for this file:**
```bash
git blame --line-porcelain "<TARGET_FILE>" 2>/dev/null \
  | grep "^author " | sort | uniq -c | sort -rn | head -5
```

For each historical finding, record: commit hash, date, commit subject. Do not infer intent beyond what the commit message states.

---

## Step 8 — Compute Risk Level

Collect all signals gathered in Steps 1–7 and apply this scoring matrix.

Start at **Low Risk 🟢**. Escalate based on the following triggers:

**Escalate to 🟡 Medium if ANY of:**
- Level 1 dependents count ≥ 3
- Level 2 dependents count ≥ 5
- Test coverage is Partial (not None — None escalates further)
- File has 2–4 fix/bug/revert commits in history
- File churn rate is 1–3 commits/month
- A Level 1 dependent re-exports the target (change propagates further)

**Escalate to 🔴 High if ANY of:**
- Level 1 dependents count ≥ 8
- Level 2 dependents count ≥ 20
- Test coverage is None AND Level 1 dependents ≥ 3
- Circular dependency detected (always 🔴)
- File has 5+ fix/bug/revert commits in history
- File churn rate > 3 commits/month
- A revert commit exists for this file (indicates it caused a regression before)
- The file is a shared config, constants, schema, or type definition used across the repo

**Risk level is the highest triggered tier. 🔴 trumps 🟡 trumps 🟢 unconditionally.**

Also compute an overall **Confidence** level for the analysis:
- **High**: target file confirmed to exist, language-specific grep used, test file check returned definitive results
- **Medium**: one or more search steps fell back to a generic grep, or test coverage was ambiguous
- **Low**: target was inferred (name only, no file path), or grep returned more than 50 results making analysis approximate

---

## Step 9 — Write Output

Write the impact analysis both to the terminal (as the main response) and append it to `MIND.md`.

---

### Step 9A — Standard Output (dependents found)

```markdown
---
## 🔗 Impact Analysis: <TARGET_DISPLAY>
> Traced: <ISO 8601 timestamp> | GitMind impact_trace v1

---

**Target:** `<TARGET_FILE>`
**Symbol:** `<TARGET_SYMBOL>` *(omit this line if file-level trace only)*
**Language:** <detected language>
**Risk Level:** <🟢 Low | 🟡 Medium | 🔴 High>

---

### Direct Dependents (Level 1)
> Files that directly import or reference the target.
> Total: <N> file(s)

| File | Usage Type | Line(s) | Notes |
|------|-----------|---------|-------|
| `<path>` | <Direct call / Re-export / Type only / etc.> | <line numbers> | <any notable context> |
| `<path>` | ... | ... | ... |

<!-- If > 30 direct dependents: -->
<!-- > ⚠️ 30 shown of <total> total direct dependents. This is a widely-referenced file — treat any change as high-impact. -->

---

### Indirect Dependents (Level 2)
> Files that depend on the direct dependents — reached if those files change their interface.
> Total: <N> file(s)

| File | Depends via | Risk pathway |
|------|-------------|-------------|
| `<path>` | `<level-1-file>` | <one-line description of how change propagates> |

<!-- If none: write "No indirect dependents found — change impact is contained." -->
<!-- If > 50: write "⚠️ 50+ indirect dependents detected. Full propagation list omitted for brevity. Treat as maximum impact." -->

---

### ⭕ Circular Dependencies
<!-- If none found: -->
> No circular dependencies detected. ✅

<!-- If found: -->
> ⚠️ Circular dependency detected:
> `<TARGET_FILE>` → imports from → `<file_A>` → imports from → `<TARGET_FILE>`
>
> **Why this matters:** Changes to either file may require simultaneous changes to the other. This tight coupling increases the risk and complexity of any modification.
> **Recommended action:** Decouple by extracting shared logic into a third module that neither file imports from the other.

---

### 🧪 Test Coverage
**Status:** <✅ Yes — well covered | ⚠️ Partial — indirectly covered | ❌ None — no tests found>

<!-- If covered: -->
| Test File | Test Cases Referencing Target | Coverage Type |
|-----------|------------------------------|--------------|
| `<path>` | <N> test cases | <Unit / Integration / E2E> |

<!-- If partial: -->
> Coverage is indirect — the target is imported in test files but not directly exercised in test cases.
> Test files found: `<paths>`

<!-- If none: -->
> No test files reference `<TARGET_DISPLAY>`. Any change carries unverified risk.
> **Suggested action:** Before changing this file, write at least one test that captures its current behavior, so regressions are caught automatically.

---

### 📜 Historical Issues
**Total commits to this file:** <N> (first: <date>, last: <date>)
**Churn rate:** ~<N> commits/month
**Fix / bug / revert commits:** <N>

<!-- If fix/revert commits exist: -->
| Commit | Date | Subject |
|--------|------|---------|
| `<short_hash>` | <YYYY-MM-DD> | <subject> |

<!-- If none: -->
> No fix, bug, or revert commits found in this file's history. ✅

<!-- If reverts found: -->
> ⚠️ This file has been reverted before (`<hash>` on <date>: "<subject>"). This is a strong signal that changes here have caused regressions in the past.

---

### 🎯 Recommendation

**Risk Level: <🟢 Low | 🟡 Medium | 🔴 High>**

<One paragraph (3–5 sentences) written in plain English. Answer: what should the developer do before changing this file? Reference the specific dependents, test coverage state, and historical signals found. Name concrete actions — not general advice.>

**Checklist before changing `<TARGET_DISPLAY>`:**
- [ ] <Specific action — e.g. "Run the existing test suite: `npm test`">
- [ ] <Specific action — e.g. "Notify owner of `src/api/router.ts` (last touched by @alice) — it calls this directly at line 47">
- [ ] <Specific action — e.g. "Check that `AUTH_TOKEN` env var handling in `src/config/env.ts:12` still works after your change">
- [ ] <Only if test coverage is None: "Write a regression test before making changes">
- [ ] <Only if circular dependency found: "Resolve circular dependency before modifying">

**Confidence:** <High / Medium / Low> — <one-line reason>

---

— GitMind | <ISO 8601 timestamp> | Confidence: <High / Medium / Low>
```

---

### Step 9B — Target Not Found

```markdown
---
## 🔗 Impact Analysis: <user-provided name>
> Traced: <ISO 8601 timestamp> | GitMind impact_trace v1

**Status: Target not found.**

GitMind searched for `<name>` across all source files and could not locate a definition or file matching this name.

**Searches attempted:**
- File path: `find . -name "<name>"` → no results
- Definition search: `grep -rn "def |func |function |class " for "<name>"` → no results

**Possible reasons:**
- The file may have been deleted or renamed — check with: `git log --all --oneline -- "**/<name>*"`
- The name may be spelled differently in the codebase — check with: `grep -rn "<partial_name>" --include="*.ts" .`
- The function may be dynamically generated or loaded at runtime

**Confidence:** High — exhaustive search returned no matches.

---

— GitMind | <ISO 8601 timestamp> | Confidence: High
```

---

### Step 9C — No Dependents Found

```markdown
---
## 🔗 Impact Analysis: <TARGET_DISPLAY>
> Traced: <ISO 8601 timestamp> | GitMind impact_trace v1

**Target confirmed:** `<TARGET_FILE>` ✅
**Risk Level:** 🟢 Low

**No dependents found.**

GitMind searched all source files for imports and references to `<TARGET_DISPLAY>` and found none.

**Searches run:**
- ES module / CommonJS import grep → 0 results
- Direct symbol reference grep → 0 results
- Universal identifier grep → 0 results

**What this means:**
This file or function is not imported or referenced by any other file in the repository. It is either:
- A standalone entry point (e.g. `main.js`, `server.py`) — expected to have no dependents
- Dead code — worth confirming it is still needed before modifying or deleting it

**Verify it is still in use:**
```bash
git log --oneline -5 -- "<TARGET_FILE>"
```
If the last commit is old, this file may be a safe removal candidate.

<!-- Include test coverage and history sections even for leaf nodes — they still matter -->

**Test coverage:** <run Step 6 and report here>
**Last modified:** <date from git log>
**Confidence:** High — three independent grep strategies all returned zero results.

---

— GitMind | <ISO 8601 timestamp> | Confidence: High
```

---

## Execution Rules

**Follow the dependency chain — do not skip levels.** Level 1 is direct importers. Level 2 is importers of importers. Do not trace Level 3 or beyond — the signal-to-noise ratio drops sharply. State clearly that the trace stops at 2 levels.

**Exclude the target file from all dependent lists.** A file referencing itself (e.g. recursive call) is not a dependent — it is internal logic. Only external files belong in the dependent lists.

**Exclude `node_modules`, `dist`, `build`, `vendor`, `.venv`, `.git` from all grep searches.** Dependencies in these directories are not authored by the team and changes to the target do not affect them in the same way.

**Read dependent files, don't just list them.** Step 3 exists specifically to understand *how* the target is used — not just *where*. A file that imports the target only as a TypeScript type has zero runtime risk. A file that calls it in a hot path on every request has maximum risk. The distinction matters and must be reflected in the output.

**Circular dependencies are always 🔴 High, no exceptions.** They represent architectural coupling that cannot be mitigated by tests alone. Always recommend decoupling, and always provide the specific pair of files involved.

**Cite every dependency with its file path.** No naked assertions. Every file listed in the Direct or Indirect Dependents tables must have been found by an explicit grep command. If a dependency is inferred rather than confirmed by grep, mark it `(inferred)` with confidence Low.

**The recommendation must be actionable.** The checklist items at the end of Step 9A are not suggestions — they are instructions. Each one should name a specific file, a specific person (if git blame reveals a clear owner), or a specific command. Generic advice ("make sure tests pass") belongs in documentation, not in an impact trace.

**Never guess at propagation.** If a Level 2 search returns more files than can be meaningfully analyzed (> 50), state the count and stop. Do not list hundreds of files — explain the magnitude and let the developer decide what to do with that information.

**Confidence levels mean exactly this:**

| Level | When to use |
|-------|-------------|
| **High** | File confirmed to exist, language-specific grep used, results are definitive |
| **Medium** | One fallback grep used, or test coverage result was ambiguous |
| **Low** | Target was name-only, or grep returned very large result set requiring truncation |

**Sign every trace.** The final line of every block must be:
```
— GitMind | <ISO 8601 timestamp> | Confidence: <High / Medium / Low>
```
