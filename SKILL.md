---
name: repo_scan
description: "Scan a repository end-to-end and write a structured MIND.md covering architecture, tech stack, folder purposes, ownership, and key dependencies."
allowed-tools: Bash Read Write
---

# Repo Scan

You are GitMind executing a full repository scan. Your goal is to read everything you are allowed to read, synthesize it into structured knowledge, and write that knowledge into `MIND.md` — permanently and precisely.

Follow every step below in order. Do not skip steps. Do not summarize loosely. Cite your sources with file paths and line numbers. Assign a confidence level to every section you write.

---

## Step 1 — Build the Full File and Folder Tree

Run the following command to capture the complete directory structure. Exclude `.git` internals, `node_modules`, build artifacts, and binary directories to keep the output legible:

```bash
find . \
  -not -path './.git/*' \
  -not -path './node_modules/*' \
  -not -path './.venv/*' \
  -not -path './venv/*' \
  -not -path './dist/*' \
  -not -path './build/*' \
  -not -path './__pycache__/*' \
  -not -path './target/*' \
  | sort
```

As you read the tree output:
- Note every top-level directory by name — these map to `## 📁 Folder Purposes`
- Note every file at the root level — these are candidates for entry points and config
- **Flag immediately** any file whose name matches these patterns (do NOT read its contents):
  - `.env`, `.env.local`, `.env.production`, `.env.*`
  - `*.pem`, `*.key`, `*.p12`, `*.pfx`
  - `secrets.json`, `credentials.json`, `serviceAccount.json`
  - `*.secret`, `*.token`
  - Record each flagged file in a `⚠️ Secrets / Sensitive Files Detected` block at the top of `MIND.md`

---

## Step 2 — Read Documentation Files

Read each of the following files if they exist. Extract purpose, architecture decisions, setup instructions, and any stated conventions:

**Priority order:**
1. `README.md` — primary project description, setup, usage
2. `CONTRIBUTING.md` — contribution conventions and code ownership hints
3. `ARCHITECTURE.md` or `docs/architecture.md` — explicit design decisions
4. `CHANGELOG.md` — history of significant changes
5. Any `.md` files inside a `docs/` directory (read each one)
6. `CLAUDE.md` — GitMind-specific instructions that must be respected

For each file read:
- Record the file path as the source
- Note the key claims the file makes about the project's purpose and structure
- Flag any contradictions between what docs claim and what you observe in the tree

---

## Step 3 — Read Dependency and Configuration Manifests

Read whichever of these files exist. For each one, extract the fields listed:

**`package.json`**
- `name`, `version`, `description` — project identity
- `main`, `module`, `bin` — entry points
- `scripts` — how to run, build, test
- `dependencies` — runtime dependencies (name + version)
- `devDependencies` — toolchain (name + version)
- `engines` — required Node/npm versions

**`package-lock.json` or `yarn.lock` or `pnpm-lock.yaml`**
- Do not read in full. Note only: which lockfile type exists and its approximate size. This tells you lockfile discipline.

**`requirements.txt` or `requirements-dev.txt` or `pyproject.toml` or `setup.py` or `setup.cfg`**
- Extract all package names and pinned versions
- Note if versions are pinned (exact) or loose (ranges) — this signals dependency hygiene

**`Cargo.toml`**
- `[package]` section: name, version, edition
- `[dependencies]` and `[dev-dependencies]` sections

**`go.mod`**
- Module name and Go version
- All `require` entries

**`pom.xml`** (Maven)
- `groupId`, `artifactId`, `version`
- All `<dependency>` entries

**`build.gradle` or `build.gradle.kts`**
- All `implementation`, `api`, and `testImplementation` entries

**`.nvmrc`, `.python-version`, `.tool-versions`**
- Extract the pinned runtime version — note it as an infrastructure constraint

**`Dockerfile` or `docker-compose.yml`**
- Base image and exposed ports
- Service names in compose files

For every manifest read: record the file path as source. Record the line number of any notable entry.

---

## Step 4 — Detect Primary Language(s)

After reading the tree and manifests, determine the primary programming language(s) using this evidence hierarchy:

1. **Manifest presence** (highest confidence): `package.json` → JavaScript/TypeScript, `Cargo.toml` → Rust, `go.mod` → Go, `requirements.txt` / `pyproject.toml` → Python, `pom.xml` → Java, `build.gradle` → Kotlin/Java
2. **File extension distribution**: Count files by extension across the source tree (exclude `node_modules`, `dist`, `build`, `vendor`)
   ```bash
   find . -not -path './.git/*' -not -path './node_modules/*' -not -path './vendor/*' \
     -type f | sed 's/.*\.//' | sort | uniq -c | sort -rn | head -20
   ```
3. **Shebang lines** in root scripts: `#!/usr/bin/env python3`, `#!/usr/bin/env node`
4. **Config files**: `.babelrc`, `tsconfig.json` → TypeScript/JS; `mypy.ini`, `.flake8` → Python; `.golangci.yml` → Go

Assign a confidence level based on how many signals agree. List all signals found and their sources.

---

## Step 5 — Identify Key Entry Points

Search for and attempt to read the first 60 lines of each of these files if they exist:

**JavaScript / TypeScript:**
`index.js`, `index.ts`, `main.js`, `main.ts`, `server.js`, `server.ts`, `app.js`, `app.ts`, `src/index.ts`, `src/main.ts`, `src/app.ts`

**Python:**
`main.py`, `app.py`, `run.py`, `server.py`, `manage.py`, `wsgi.py`, `asgi.py`, `__main__.py`, `src/main.py`

**Go:**
`main.go`, `cmd/main.go`, any `main.go` inside a `cmd/` subdirectory

**Rust:**
`src/main.rs`, `src/lib.rs`

**Java / Kotlin:**
Any file containing `public static void main` or `fun main` — search with:
```bash
grep -rl "public static void main\|fun main(" --include="*.java" --include="*.kt" . | head -5
```

**Ruby:**
`config.ru`, `app.rb`, `server.rb`, `Rakefile`

For each entry point found:
- Record its path and the line where execution or the primary export begins
- Note what framework or runtime it bootstraps (Express, FastAPI, Gin, Actix, Rails, etc.)
- Note any environment variables it references by name (not value)

---

## Step 6 — Read Top-Level Source File Structure

For each top-level source directory (e.g., `src/`, `lib/`, `pkg/`, `internal/`, `app/`, `api/`, `services/`, `modules/`):

1. List all files and immediate subdirectories
2. For each subdirectory, read the first file inside it (or an `index.*` file if present) — first 40 lines only
3. Extract: what this module/package exports or defines, what it imports, any comments that describe its purpose

Do not read entire files. You need architectural shape, not implementation detail. If a directory has more than 20 files, read only the index/entry file and note the count.

For each file partially read: record `path:line_range` as source.

---

## Step 7 — Detect Ownership via Git Blame

Run git blame on the most recently modified source files to build an ownership map. Use this sequence:

**Step 7a — Find the 15 most recently modified source files:**
```bash
git log --name-only --pretty=format: --diff-filter=M | \
  grep -E '\.(js|ts|py|go|rs|java|kt|rb|cs|cpp|c|h)$' | \
  grep -v '^$' | sort -u | head -15
```

**Step 7b — For each file found, run git blame summary:**
```bash
git blame --line-porcelain <file> | grep "^author " | sort | uniq -c | sort -rn | head -5
```

**Step 7c — Find the top committers to the whole repo:**
```bash
git log --pretty=format:"%an" | sort | uniq -c | sort -rn | head -10
```

**Step 7d — Identify module-level ownership:**
For each top-level source directory, find who authored the most commits touching files within it:
```bash
git log --pretty=format:"%an" -- <directory>/ | sort | uniq -c | sort -rn | head -3
```

Compile results into an ownership map: `directory → primary author(s) → commit count`. Note any directory with no clear owner (contributions spread evenly across 5+ people) — flag these as **shared / no single owner**.

If the repository has no git history (fresh init), note: `Ownership: Not determinable — no commit history` with confidence Low.

---

## Step 8 — Write MIND.md

Now write everything you have learned into `MIND.md` at the root of the repository. If `MIND.md` already exists, append a new dated scan block below any existing content — do not overwrite prior scans.

Use exactly this structure:

---

```markdown
# MIND.md
> Last scan: <ISO 8601 timestamp> | GitMind repo_scan v1

---

## ⚠️ Secrets / Sensitive Files Detected

<!-- If none found, write: "None detected." -->
<!-- If found, list each path. DO NOT include contents. -->

- `<path>` — <file type, e.g. ".env file", "PEM certificate">
  ⛔ Contents not read. Treat as sensitive. Verify this file is in .gitignore.

---

## 🗺️ Repo Map

**Project:** <name from manifest or README>
**Version:** <version from manifest, or "not specified">
**Purpose:** <one or two sentence description from README or manifest description field>
**Source:** <file:line where this was found>

### Entry Points
- `<path>:<line>` — <what it starts, e.g. "Express HTTP server on $PORT">
- `<path>:<line>` — <what it starts>

### Top-Level Structure
```
<paste the condensed tree output — directories only, max 40 lines>
```

**Confidence:** <High / Medium / Low>
**Basis:** <e.g. "README.md confirmed by package.json:1 and src/index.ts:1">

---

## 🔧 Tech Stack

### Primary Language(s)
- **<Language>** — <evidence: file count or manifest, source cited>

### Runtime & Framework
- **<Framework>** `<version>` — sourced from `<file>:<line>`
- **<Runtime>** `<version>` — sourced from `<file>:<line>`

### Toolchain
- **Build:** <tool + version, source>
- **Test:** <tool + version, source>
- **Lint / Format:** <tool + version, source>
- **CI:** <platform, sourced from .github/workflows/ or .circleci/ etc.>

### Infrastructure
- **Containerized:** <Yes/No — source>
- **Required runtime version:** <e.g. "Node >=18 — sourced from .nvmrc:1">

**Confidence:** <High / Medium / Low>
**Basis:** <which manifests were present and read>

---

## 📁 Folder Purposes

| Directory | Purpose | Confidence | Source |
|-----------|---------|------------|--------|
| `<path>/` | <what lives here and why> | High/Med/Low | `<file>:<line>` |
| `<path>/` | <what lives here and why> | High/Med/Low | `<file>:<line>` |

> Any directory not listed here was either empty, auto-generated (e.g. `dist/`), or its purpose could not be determined from available evidence.

**Confidence:** <overall section confidence>
**Basis:** <how folder purposes were inferred — README, index files, naming conventions>

---

## 👤 Ownership Map

| Directory / Module | Primary Owner(s) | Commits | Notes |
|--------------------|-----------------|---------|-------|
| `<path>/` | <author name> | <N> | |
| `<path>/` | <author name> | <N> | |
| `<path>/` | Shared | — | No single owner (5+ contributors) |

### Top Repo Contributors
| Author | Total Commits |
|--------|--------------|
| <name> | <N> |
| <name> | <N> |

**Confidence:** <High / Medium / Low>
**Basis:** <"git log and git blame across 15 most recently modified files" or "no git history">

---

## 📦 Key Dependencies

### Runtime Dependencies
| Package | Version | Purpose (inferred) | Source |
|---------|---------|--------------------|--------|
| `<name>` | `<version>` | <what it does, inferred from name/docs> | `<file>:<line>` |

### Dev / Build Dependencies
| Package | Version | Purpose (inferred) | Source |
|---------|---------|--------------------|--------|
| `<name>` | `<version>` | <what it does> | `<file>:<line>` |

### Dependency Health Flags
<!-- Note any of the following if detected: -->
- ⚠️ `<package>` is pinned to a version >12 months old — consider reviewing for security updates
- ⚠️ Lockfile absent — dependency versions are not pinned, builds may not be reproducible
- ⚠️ Mixed lockfiles detected (`package-lock.json` and `yarn.lock`) — resolve to one

**Confidence:** <High / Medium / Low>
**Basis:** <which manifests were read and what was found>

---

— GitMind | <ISO 8601 timestamp> | Confidence: <overall scan confidence>
```

---

## Execution Rules

**Citation is mandatory.** Every factual claim in `MIND.md` must be followed by its source in `file:line` format. If you cannot cite a source, write the claim with confidence Low and mark it `(inferred)`.

**Confidence levels mean exactly this:**

| Level | When to use |
|-------|-------------|
| **High** | Directly read from a file — path and line cited |
| **Medium** | Inferred from multiple indirect signals — reasoning shown |
| **Low** | Extrapolated from naming conventions, partial evidence, or analogies |

Never round up. A Medium is not a shy High.

**Secrets rule — absolute and non-negotiable.** If a file matches the secrets pattern list in Step 1, you must:
1. Record its path in the `⚠️ Secrets / Sensitive Files Detected` section
2. Note whether it appears in `.gitignore` (check with `grep -F "<filename>" .gitignore`)
3. Never open the file. Never read a single line of it. Never infer or summarize its contents.

**When git is unavailable.** If `git` commands fail (not a git repo, no history), skip Step 7 entirely. Write in the Ownership Map section: `Git history unavailable — ownership cannot be determined.` Confidence: Low.

**When a manifest is absent.** If none of the dependency files in Step 3 exist, write `No dependency manifests found` under Tech Stack and infer language from file extensions only (confidence: Medium at best).

**MIND.md append discipline.** Never overwrite a previous scan. Each scan adds a new dated block. A reader should be able to see how the repo has evolved across scans.

**File read limits.** For source files in Step 6, never read more than the first 60 lines unless a specific section (imports, exports, class/function definitions) is clearly beyond line 60 and directly relevant to architecture understanding.

**Sign every scan.** The final line of every `MIND.md` block must be:
```
— GitMind | <ISO 8601 timestamp> | Confidence: <High / Medium / Low>
```
This is accountability. Do not omit it.
