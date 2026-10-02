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

The site lives in a subfolder, **https://www.tezu.ernet.in/dphy/**, so every page and
file URL starts with `/dphy/` (set by `base` in `astro.config.mjs`). In code, write
internal links as site paths wrapped in `withBase()` from `src/lib/url.ts`, e.g.
`href={withBase('/people')}`, never a bare `href="/people"`.

## How to update and deploy the site

The server only hosts plain files — there is no Node and no automatic rebuild. You build
the site on your own computer and upload the result.

1. **Edit the content.** Text and data are in `src/content/` (people, research areas,
   news and events, courses, admissions); images and PDFs are in `public/`.
   [EDITING_GUIDE.md](EDITING_GUIDE.md) explains each folder.
2. **Check it locally.** Run `npm run dev` and open http://localhost:4321/dphy/.
3. **Build.** Run `npm run build`, then `npm run check-links`. Both must finish without
   errors. The finished site is in the `dist/` folder.
4. **Upload.** Copy the *contents* of `dist/` (not the `dist` folder itself) into `/dphy/` on
   the university server, replacing the old files. Upload method:
   [PLACEHOLDER — FTP/SFTP/other, server address and login, to be confirmed by IT].
   If you deleted a page or file, delete it on the server too — uploading doesn't remove
   old files.
5. **Check the live site.**
   - https://www.tezu.ernet.in/dphy/ shows the home page with its photo and styling.
   - Click through the top menu; every page loads and images appear.
   - Open the page you changed and confirm the change is there (refresh with
     Ctrl+F5 / Cmd+Shift+R if the old version shows).
   - A made-up address such as https://www.tezu.ernet.in/dphy/xyz/ should show the
     server's "not found" page (or the site's own 404 page once the server is set up for it).

## Where to look

| I want to… | Read |
|---|---|
| Add people, news, research areas, pages | [EDITING_GUIDE.md](EDITING_GUIDE.md) |
| Follow the contribution rules | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Understand the team roles (Claude Code sessions) | [CLAUDE.md](CLAUDE.md) |
| See page copy drafts | `content-notes/` |
| See past work | `Session_log/` |
