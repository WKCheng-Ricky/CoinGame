# GitHub Pages deploy: Design Spec

Date: 2026-10-28
Builds on: the test suite and CI spec (`2026-10-28-test-suite-and-ci-design.md`).

## Purpose

Host the game publicly on GitHub Pages so it can be played from a link, with no
cost and no extra account. The site redeploys automatically when `main`
changes, and only after the existing tests pass.

## Context

- The game is a static site with no build step: `index.html`, `styles.css`,
  `theme-boot.js`, `src/*.js` (ES modules) and `fonts/*.woff2`.
- Every asset path is relative (checked: no `/`-rooted `src`, `href`, `url()`
  or `fetch`). The site therefore works under the project-site subpath
  `/CoinGame/`.
- The repo (`WKCheng-Ricky/CoinGame`) is public. Pages and Actions are free
  for public repos on the Free plan.
- It is a **project site**: `https://wkcheng-ricky.github.io/CoinGame/`. It
  does not use the account's single user-site slot (`<owner>.github.io`).
- Pages limits (GitHub docs): 1 GB site size (hard), 100 GB/month bandwidth
  and 10 builds/hour (both soft; builds from a custom Actions workflow are
  exempt from the build cap). This site is well under all of them.

## Requirements

- **Publish only what the game needs:** `index.html`, `styles.css`,
  `theme-boot.js`, `src/`, `fonts/`. Nothing else is published (not
  `node_modules`, `tests`, `e2e`, `docs`, `coverage`, `.github`).
- **Deploy from `main` only.** Pull requests and other branches run CI but
  never deploy.
- **Gated on CI.** The deploy runs only if both the `unit` and `e2e` jobs
  pass.
- **No game code changes.** `src/`, `index.html` and `styles.css` are not
  touched.
- **Least privilege.** Workflow-wide permission stays `contents: read`. Only
  the deploy job gets `pages: write` and `id-token: write`.

## Design

### Workflow

Add a `deploy` job to `.github/workflows/ci.yml` rather than a second workflow.
`needs: [unit, e2e]` gives the CI gate directly, with no `workflow_run`
indirection and no duplicated test jobs.

```yaml
  deploy:
    needs: [unit, e2e]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: read
      pages: write
      id-token: write
    concurrency:
      group: pages
      cancel-in-progress: false
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - name: Stage site files
        run: |
          mkdir _site
          cp -r index.html styles.css theme-boot.js src fonts _site/
      - uses: actions/configure-pages@v6
      - uses: actions/upload-pages-artifact@v5
        with:
          path: _site
      - id: deployment
        uses: actions/deploy-pages@v5
```

Notes:

- The job-level `concurrency` group `pages` with `cancel-in-progress: false`
  stops two deploys racing. It does not protect against the workflow-level
  group, which would cancel the whole run (including a running deploy) when
  another push to `main` arrives. So the workflow-level setting changes to
  `cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}`: superseded
  runs on pull requests and feature branches are still cancelled, runs on
  `main` are not.
- `_site` is added to `.gitignore` so a local dry run does not get committed.
- Action major versions follow what `ci.yml` already pins (`@v4`). The Pages
  actions' current majors are confirmed when the plan is written.

### One-time repository setting (manual)

Settings → Pages → Build and deployment → Source: **GitHub Actions**. The
deploy job fails until this is set. It cannot be set from the workflow. `gh`
is not logged in on this machine, so it is done by the user in the browser.

### README

Replace the `## Deploy` section ("Any static host works, e.g. GitHub Pages")
with the live URL and a short description of the flow: push to `main` → CI →
deploy; staged files; the one-time setting.

## Verification

- **Before merge (local):** run the staging commands, serve `_site` under a
  `/CoinGame/` prefix, and confirm in a browser that the page loads, both
  fonts load, the ES modules load, and the theme boot script runs, with no
  console errors or 404s. A check that `_site` contains exactly the five
  entries above.
- **On a pull request:** CI runs and the `deploy` job is skipped (shown as
  skipped, not failed).
- **After merge to `main`:** the `deploy` job succeeds and the environment
  URL opens the playable game. This step cannot be tested before the first
  push to `main` with Pages enabled, so the first deploy is the real test.
- **Rollback:** revert the workflow change. To take the site down, set the
  Pages source to "None" in settings.

## Out of scope

- Custom domain.
- A `<owner>.github.io` landing page.
- Preview deploys for pull requests.
- Any build, bundling or minification step.

## Decisions to confirm

1. **CI gate** is implemented as a job in `ci.yml` (above). This was the
   recommended default; say if you would rather have a separate
   `pages.yml` that publishes on every push to `main` regardless of tests.
2. **Branch.** The change is written on `feature/github-pages-deploy`, based
   on `origin/main`, and the first deploy happens when that branch merges to
   `main`.
