# Department of Physics — Tezpur University website

Built with [Astro](https://astro.build). Plain HTML/CSS, no Tailwind.

> **Owner-controlled repository.** Only the owner merges into `main`. Do not push to `main` directly.
> Fork, work on a branch, and open a pull request. **Read [CONTRIBUTING.md](CONTRIBUTING.md) first.**

## Run it locally

```sh
npm install
npm run dev         # http://localhost:4321/dphy/
npm run build       # production build into dist/
npm run preview     # serve the last build at http://localhost:4321/dphy/
npm run check-links # after a build: every internal link must start with /dphy/ and exist
```

The Student/Faculty Portal (Login, Register and the portal pages) is **off** in these builds.
It is switched on by one build-time setting, `PUBLIC_PORTAL_ENABLED=true`:
`npm run dev:portal` and `npm run build:portal` set it. Only build with it once the portal
API is running on the server ([docs/portal-trial/DEPLOY_API.md](docs/portal-trial/DEPLOY_API.md));
developing the portal: [docs/portal-trial/DEVELOPING.md](docs/portal-trial/DEVELOPING.md).

The site lives in a subfolder, **https://www.tezu.ernet.in/dphy/**, so every page and
file URL starts with `/dphy/` (set by `base` in `astro.config.mjs`). In code, write
internal links as site paths wrapped in `withBase()` from `src/lib/url.ts`, e.g.
`href={withBase('/people')}`, never a bare `href="/people"`.

## Where to look

| I want to… | Read |
|---|---|
| Add people, news, research areas, pages | [EDITING_GUIDE.md](EDITING_GUIDE.md) |
| Update the live site (build and upload to `/dphy/`) | [DEPLOY.md](DEPLOY.md) |
| Follow the contribution rules | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Understand the team roles (Claude Code sessions) | [CLAUDE.md](CLAUDE.md) |
| See page copy drafts | `content-notes/` |
| See past work | `Session_log/` |
