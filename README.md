# dipenwho.com

Static site, built by `build.py` into `docs/` and served by GitHub Pages.

- Projects and their files: `content/projects.json` (+ files in `content/files/<id>/`)
- Styles and scripts: `static/assets/`
- Contact email: one line in `content/email.txt` (not committed)
- Rebuild: `python3 build.py`, then commit and push.

The project-page viewer opens Markdown, PDF, Excel/CSV, Word, Jupyter notebooks, code, images, video and HTML.
Set `"browse_repo": true` on a project to list every file in its GitHub repository.
