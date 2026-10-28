# GitHub Pages Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the game to GitHub Pages at `https://wkcheng-ricky.github.io/CoinGame/` whenever `main` changes and CI passes.

**Architecture:** Add a `deploy` job to the existing `.github/workflows/ci.yml` that stages the five runtime entries into `_site/` and publishes them with the official Pages actions. A small `node:test` file parses `ci.yml` (with the `yaml` package) and reads `index.html` and `styles.css`, so the staged file list and the deploy rules (main-only, after tests, least privilege, never cancelled) cannot drift unnoticed.

**Tech Stack:** GitHub Actions (`configure-pages`, `upload-pages-artifact`, `deploy-pages`), Node 22 `node:test`, plus one new dev dependency: `yaml` (to parse `ci.yml` in tests).

**Spec:** `docs/superpowers/specs/2026-10-28-github-pages-deploy-design.md`

## Global Constraints

- Published entries are exactly: `index.html`, `styles.css`, `theme-boot.js`, `src`, `fonts`. Nothing else.
- Deploy only on `push` to `refs/heads/main`; pull requests never deploy.
- Deploy `needs: [unit, e2e]`.
- Workflow-wide `permissions` stays `contents: read`; only the `deploy` job adds `pages: write` and `id-token: write`.
- No changes to `src/`, `index.html` or `styles.css`.
- The only new npm dependency is `yaml`, as a **devDependency**; tests parse `ci.yml` with it and assert on the parsed structure, not on exact text lines.
- Commit messages use Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `ci:`) and end with the line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Work happens on branch `feature/github-pages-deploy`, based on `origin/main` (commit `70e0f91`, which already contains `ci.yml`).

## Review Focus

- A new top-level asset (for example an `images/` folder) is referenced by `index.html` or `styles.css` but not staged: the live site would 404 it. Expected: the unit test fails. (Task 1)
- A root-absolute path (`/src/main.js`, `url(/fonts/x.woff2)`) is introduced: it works locally but breaks under `/CoinGame/`. Expected: the unit test fails. (Task 1)
- A pull request run reaches the deploy job: Expected: the job is skipped. (Task 1, `deploy job runs only...` test)
- Two quick pushes to `main` cancel a running deploy mid-publish: Expected: runs on `main` are never cancelled. (Task 1, `runs on main are never cancelled` test)
- A local `_site/` dry run gets committed. Expected: it is git-ignored. (Task 1, `.gitignore` assertion)

---

### Task 1: Deploy job, guard test and ignore rule

**Files:**
- Create: `tests/pages-site.test.js`
- Modify: `.github/workflows/ci.yml` (workflow-level `concurrency`, new `deploy` job at the end)
- Modify: `.gitignore` (add `_site/`)
- Modify: `package.json` and `package-lock.json` (add `yaml` to `devDependencies`)

**Interfaces:**
- Produces: the `deploy` job in `ci.yml` with a staging step whose command is exactly `cp -r index.html styles.css theme-boot.js src fonts _site/`. Task 2 and Task 3 rely on that command and on the `_site` directory name.

- [ ] **Step 1: Write the failing test file `tests/pages-site.test.js`**

Import `parse` from `yaml`. Parse `.github/workflows/ci.yml` into an object `wf`; read `.gitignore`, `index.html` and `styles.css` as text with `node:fs` and `import.meta.url`-relative paths (same style as the other files in `tests/`). Tests, with these names and assertions:

  - `staged entries are exactly the five runtime files`: find the step in `wf.jobs.deploy.steps` whose `run` contains `_site/`, and extract the entries from its `cp -r (.+) _site/` command; assert the sorted list deep-equals `["fonts", "index.html", "src", "styles.css", "theme-boot.js"]`, and that each exists in the repo root.
  - `every local reference in index.html and styles.css is staged`: collect `src="..."` and `href="..."` values in `index.html` and `url("...")` values in `styles.css`; ignore anything starting with `http`, `data:` or `#`; for each remaining reference assert its first path segment is in the staged entries.
  - `no reference is root-absolute`: assert none of the references collected above starts with `/`.
  - `deploy runs only for pushes to main, after unit and e2e`: assert `wf.jobs.deploy.needs` deep-equals `["unit", "e2e"]`, and that `wf.jobs.deploy.if` is a string containing both `github.event_name == 'push'` and `github.ref == 'refs/heads/main'` (either order, any spacing around `&&`).
  - `deploy job has least-privilege Pages permissions`: assert `wf.jobs.deploy.permissions` has `pages` and `id-token` equal to `"write"`, and that `wf.permissions` (workflow-level) has no `pages` and no `id-token` key.
  - `runs on main are never cancelled`: assert `wf.concurrency["cancel-in-progress"]` is a string containing `github.ref != 'refs/heads/main'`, and `wf.jobs.deploy.concurrency` deep-equals `{ group: "pages", "cancel-in-progress": false }`.
  - `_site is git-ignored`: assert `.gitignore` has a line `_site/`.

- [ ] **Step 2: Run the new test to verify it fails**

Run: `node --test tests/pages-site.test.js`
Expected: FAIL. These tests fail: `staged entries are exactly the five runtime files` (no `cp -r` line yet), `every local reference ... is staged` (no staged entries yet), `deploy runs only for pushes to main...`, `deploy job has least-privilege Pages permissions`, `runs on main are never cancelled`, and `_site is git-ignored`. (If `yaml` is not installed yet the whole file fails at import; the first run fails with an import error; that is the expected red. Step 2b installs it, after which the failures are the assertion failures above.) `no reference is root-absolute` passes already, because `index.html` and `styles.css` have no such paths today.

- [ ] **Step 2b: Install the `yaml` dev dependency**

Run: `npm install --save-dev yaml`
Expected: `package.json` lists `yaml` under `devDependencies`; `package-lock.json` is updated. Then re-run `node --test tests/pages-site.test.js` and confirm the failures are the assertion failures listed in Step 2.

- [ ] **Step 3: Confirm the current major versions of the three Pages actions**

Run: `for r in configure-pages upload-pages-artifact deploy-pages; do echo $r; git ls-remote --tags --refs https://github.com/actions/$r | sed 's#.*refs/tags/##' | sort -V | tail -3; done`
Expected: the highest tag per action. Use the highest major for each below. If any differs from the spec's `@v5` / `@v3` / `@v4`, use the one found and update the spec's snippet to match in the same commit.

- [ ] **Step 4: Edit `ci.yml` and `.gitignore`**

In `.github/workflows/ci.yml`: change the top-level `cancel-in-progress: true` to `cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}`, and append the `deploy` job copied verbatim from the spec's "Workflow" section, with the action versions from Step 3. Add the line `_site/` to `.gitignore`.

- [ ] **Step 5: Run the new test and the full unit suite**

Run: `node --test tests/pages-site.test.js` then `npm test`
Expected: the new file passes (7 tests, no `yaml` import errors); `npm test` passes with no other failures.

- [ ] **Step 5b: Lint the workflow with actionlint**

Run: `actionlint .github/workflows/ci.yml`. If `actionlint` is not installed (it was not on this machine), get it with `bash <(curl -s https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash) latest /tmp` and run `/tmp/actionlint .github/workflows/ci.yml` (read the script before running it; do not install into the repo).
Expected: no output and exit code 0. This catches YAML and expression mistakes that the structural tests cannot.

- [ ] **Step 6: Run the project's unit coverage gate**

Run: `npm run test:coverage`
Expected: exits 0 (the new test lives in `tests/` and does not affect the `src/**` thresholds).

- [ ] **Step 7: Commit**

```bash
git add tests/pages-site.test.js .github/workflows/ci.yml .gitignore package.json package-lock.json docs/superpowers/specs/2026-10-28-github-pages-deploy-design.md docs/superpowers/plans/2026-10-28-github-pages-deploy.md
git commit -m "ci: deploy the game to GitHub Pages from main after tests pass"
```

(Append the `Co-Authored-By` line from Global Constraints to the message.)

### Task 2: Verify the staged site under the `/CoinGame/` subpath

**Files:**
- No repo changes. Uses throwaway files in `/tmp/pages-check`, which are never committed.

**Interfaces:**
- Consumes: the staging command from Task 1.

- [ ] **Step 1: Stage the site exactly as the workflow does**

Run, from the repo root: `rm -rf _site && mkdir _site && cp -r index.html styles.css theme-boot.js src fonts _site/ && ls _site`
Expected: the listing shows exactly `fonts  index.html  src  styles.css  theme-boot.js`.

- [ ] **Step 2: Serve it under a `/CoinGame/` prefix**

Run: `mkdir -p /tmp/pages-check && ln -sfn "$PWD/_site" /tmp/pages-check/CoinGame && python3 -m http.server 8765 -d /tmp/pages-check` (in the background).
Expected: `http://localhost:8765/CoinGame/` is served.

- [ ] **Step 3: Load the page in the Playwright browser and check for failures**

Navigate to `http://localhost:8765/CoinGame/`, then read the console messages and network requests.
Expected: no console errors; no request returns 404; both `fonts/NotoSans-*-subset.woff2` files return 200; `src/main.js` and `theme-boot.js` return 200.

- [ ] **Step 4: Check the game responds**

On the loaded page, click through one round of Normal mode (add a coin from the tray and press Check).
Expected: the coin appears and Check gives feedback, which shows the ES module graph loaded under the subpath.

- [ ] **Step 5: Clean up**

Stop the server, then run `rm -rf _site /tmp/pages-check`.
Expected: `git status --short` shows no `_site` entry.

### Task 3: README deploy section

**Files:**
- Modify: `README.md` (replace the `## Deploy` section, currently one line: "Any static host works, e.g. GitHub Pages.")

**Interfaces:**
- Consumes: the live URL `https://wkcheng-ricky.github.io/CoinGame/` and the staged-entries list from Task 1.

- [ ] **Step 1: Replace the `## Deploy` section**

The new section states, in a few short lines: the live URL; that every push to `main` runs CI and, if `unit` and `e2e` pass, publishes `index.html`, `styles.css`, `theme-boot.js`, `src/` and `fonts/` to GitHub Pages; that pull requests run CI but never deploy; the one-time setting (Settings → Pages → Source: GitHub Actions); and that any other static host still works. Keep the existing sentence about hard-refreshing after an update as the only cache advice (do not duplicate it).

- [ ] **Step 2: Check the rendered text**

Run: `grep -n -A8 "^## Deploy" README.md`
Expected: the new section, with the URL and the one-time setting present.

- [ ] **Step 3: Run the unit suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document the GitHub Pages deploy in the README"
```

(Append the `Co-Authored-By` line from Global Constraints.)

### Task 4: Hand-off checks (no code)

**Files:**
- None.

- [ ] **Step 1: Confirm the branch state**

Run: `git log --oneline -3 && git status --short`
Expected: the two commits from Tasks 1 and 3 on `feature/github-pages-deploy`; clean working tree.

- [ ] **Step 2: Report the manual steps to the user**

State plainly that the following cannot be done from this machine (`gh` is not logged in) and must be done by the user:
  1. In the repo, set Settings → Pages → Source to "GitHub Actions" before the first push to `main`; otherwise the `deploy` job fails.
  2. After the first merge to `main`, open the `deploy` job's environment URL and confirm the game loads and plays. This is the only check of the real deploy.
  3. On a pull request, the `deploy` job should show as skipped, not failed.

Do not push or open a pull request unless the user asks.
