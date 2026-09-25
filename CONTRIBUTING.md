# Contributing — read this before you change anything

This repository is the official website of the Department of Physics, Tezpur University.
**The repository owner is the only person who merges into `main`.**

## The rules

1. **Never push directly to `main`.** All changes come in through a pull request (PR).
2. **Work on your own fork or branch**, one topic per branch (e.g. `people-add-scholars`, `news-october`).
3. **Keep PRs small and single-purpose.** One page, one collection, or one fix.
4. **Do not delete or rename** files in `src/content/`, `src/pages/` or `src/content.config.ts` without asking the owner first. Renaming a content field can silently break pages.
5. **Plain HTML/CSS only.** No Tailwind or new frameworks or dependencies.
6. **Do not force-push** (`git push --force`) to anything that is shared.

## How to contribute (step by step)

```bash
# 1. Fork the repo on GitHub (Fork button), then clone YOUR fork
git clone https://github.com/<your-username>/TU-Physics-website.git
cd TU-Physics-website
npm install

# 2. Stay up to date with the owner's main
git remote add upstream https://github.com/SwagatPhy/TU-Physics-website.git
git fetch upstream && git checkout -b my-topic upstream/main

# 3. Make your change, then check it
npm run dev      # preview at http://localhost:4321
npm run build    # must finish with no errors

# 4. Commit and push to your fork, then open a Pull Request on GitHub
git add <the files you changed>
git commit -m "Short, clear description of the change"
git push -u origin my-topic
```

In the PR, say **what changed and which page(s) it affects**. If content came from someone, say who.

## Before you open a PR (checklist)

- [ ] `npm run build` passes with no errors
- [ ] I only changed files related to my topic
- [ ] No secrets, personal data or large unneeded files
- [ ] I checked the page in `npm run dev`, on desktop.

## For the owner: merging

1. Open the PR → review **Files changed**.
2. Test it if it touches layout or content: `gh pr checkout <number>`, then `npm run build`.
3. If it's good, click **Squash and merge** (keeps `main` history tidy). If not, comment and ask for changes.
4. Pull the result locally: `git checkout main && git pull`.
5. If two PRs touch the same file, merge one first. The other author then updates their branch (`git fetch upstream && git rebase upstream/main`) and resolves the conflict.

## Where things live

See [`EDITING_GUIDE.md`](EDITING_GUIDE.md) for how to add people, news, research areas and pages, and [`CLAUDE.md`](CLAUDE.md) for the team roles if you use Claude Code on this project.
