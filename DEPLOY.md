# How to update and deploy the website

The site is a **static website**: a folder of plain HTML, CSS and images. There is no PHP, no
database and no login. It is served from `https://www.tezu.ernet.in/dphy/`, so the physics home
page is `/dphy/`.

The server does not build anything. You build the site on your own computer, then copy the
result to the server.

## One-time setup (on your computer)

1. Install [Node.js](https://nodejs.org) version 22.12 or newer.
2. Get the project: `git clone https://github.com/SwagatPhy/TU-Physics-website.git`
3. In the project folder run `npm install`.

## Every time you change the site

### 1. Edit the content

Content lives in plain files. Never edit anything inside `dist/`; it is rebuilt every time.

| To change… | Edit |
|---|---|
| People, courses, research areas, admissions, news and events | `src/content/` (see [EDITING_GUIDE.md](EDITING_GUIDE.md)) |
| Photos, PDFs, downloadable files | `public/` (for example `public/People-photos/`, `public/Resources-files/`) |
| Page layout or wording written inside a page | `src/pages/` |

### 2. Check it on your computer

```sh
npm run dev
```

Open the address it prints (it ends in `/dphy/`). Click through the pages you changed.
Press Ctrl+C to stop.

### 3. Build

```sh
npm run build
```

This creates the `dist/` folder, which is the complete website. If the build prints an error,
fix it before going on. Do not upload a failed build.

Then check that every link and image in the build points inside `/dphy/` and to a file that exists:

```sh
npm run check-links
```

If it reports a problem, do not upload.

Optional: `npm run preview` serves the finished `dist/` folder locally so you can check the
real result before uploading.

### 4. Upload

Copy **everything inside** `dist/` into the `dphy` folder on the university server, replacing the
old files.

- Upload the *contents* of `dist/`, not the `dist` folder itself. After uploading,
  `index.html` must be directly inside `/dphy/`.
- Upload method: [PLACEHOLDER — FTP/SFTP/other and login details, to be confirmed by the
  university IT team]
- Before replacing anything, download a copy of the current `/dphy/` folder as a backup.
- Uploading does not delete old files. If you removed a page, photo or PDF, delete it from
  `/dphy/` on the server too, or the old copy stays reachable.
- Some FTP programs hide files that start with a dot. Turn on "show hidden files" if you
  later add a `.htaccess` file.

### 5. Check the live site

Open `https://www.tezu.ernet.in/dphy/` and check:

- [ ] The home page loads with its styling and images.
- [ ] The menu links all work (no "page not found").
- [ ] The page you changed shows the new content. If it still shows the old version, refresh
      with Ctrl+Shift+R (Cmd+Shift+R on Mac).
- [ ] A PDF or photo you added opens.

## If something goes wrong

- **Page unstyled or images missing:** the files were probably uploaded one level too deep or
  too shallow. `index.html` and the `_astro` folder must sit directly inside `/dphy/`.
- **A link goes to `tezu.ernet.in/people` instead of `/dphy/people`:** that is a bug in the site
  code, not in the upload. Report it to the maintainer.
- **Need to go back:** re-upload the backup copy of `/dphy/` you took in step 4.

## Saving your work in GitHub

After changing content, save it so the next person has it:

```sh
git checkout -b my-change
git add -A
git commit -m "Describe what you changed"
git push origin my-change
```

Then open a pull request on GitHub. The repository owner merges into `main`
(see [CONTRIBUTING.md](CONTRIBUTING.md)).
