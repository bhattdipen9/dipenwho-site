#!/usr/bin/env python3
"""Build dipenwho.com into docs/ (served by GitHub Pages).

Edit content/projects.json (projects and their files) and the page text below,
then run:  python3 build.py

Contact email: put the address on one line in content/email.txt (or set the
SITE_EMAIL environment variable). Without it, email links are left out.
"""
import html
import json
import os
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "docs"
SITE = "https://www.dipenwho.com"
NAME = "Dipen Bhatt"
GITHUB = "https://github.com/bhattdipen9"
LINKEDIN = "https://www.linkedin.com/in/bhattdipen9"
DESCRIPTION = ("CFA charterholder and quantitative finance graduate student at Washington University "
               "in St. Louis, with a background in civil engineering. Investment research, valuation "
               "and the data behind investment decisions.")


def load_email():
    f = ROOT / "content" / "email.txt"
    if f.exists() and f.read_text().strip():
        return f.read_text().strip()
    return os.environ.get("SITE_EMAIL", "").strip()


EMAIL = load_email()

NAV = [("Work", "/projects/"), ("Tools", "/tone-analyzer/"), ("Vlogs", "/vlogs/"),
       ("About", "/about/"), ("Contact", "/contact/")]

CATEGORIES = {"equity": "Equity research", "academic": "Academic research", "engineering": "Engineering"}

e = html.escape


def icon(name):
    paths = {
        "github": '<path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" fill="currentColor"/>',
        "linkedin": '<path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4v11H3v-11Zm6.5 0h3.8v1.5h.06c.53-1 1.83-2.06 3.77-2.06 4.03 0 4.77 2.65 4.77 6.1v5.46h-4v-4.84c0-1.15-.02-2.64-1.6-2.64-1.61 0-1.86 1.26-1.86 2.56v4.92h-4v-11Z" fill="currentColor"/>',
        "mail": '<path d="M3 6.5h18v11H3z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m3.5 7 8.5 6.5L20.5 7" fill="none" stroke="currentColor" stroke-width="1.6"/>',
        "arrow": '<path d="M5 12h13m-5-5 5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
        "back": '<path d="M19 12H6m5 5-5-5 5-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
    }
    return f'<svg class="i" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>'


def mail_href():
    return "mailto:" + EMAIL


def page(path, title, body, *, description=DESCRIPTION, active=None, head_extra="", scripts=""):
    full_title = f"{title} · {NAME}" if title else f"{NAME}, CFA · Investment research & projects"
    url = SITE + (path if path != "/404.html" else "/")
    nav = "".join(
        f'<a href="{href}"{" aria-current=page" if active == label else ""}>{label}</a>' for label, href in NAV)
    email_link = f'<a href="{e(mail_href())}">{icon("mail")}Email</a>' if EMAIL else ""
    doc = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(full_title)}</title>
<meta name="description" content="{e(description)}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{NAME}">
<meta property="og:title" content="{e(full_title)}">
<meta property="og:description" content="{e(description)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{SITE}/assets/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#f7f6f2" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#111317" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=IBM+Plex+Mono:wght@400;500&display=swap">
{head_extra}
<link rel="stylesheet" href="/assets/site.css">
<script defer src="/assets/site.js"></script>
{scripts}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="container header-inner">
    <a class="brand" href="/" aria-label="{NAME}, home"><span class="mark">DB</span><span class="brand-text">{NAME}<small>CFA</small></span></a>
    <button class="menu-toggle" aria-expanded="false" aria-controls="nav"><span></span><span></span><span class="sr">Menu</span></button>
    <nav id="nav" aria-label="Main">{nav}</nav>
  </div>
</header>
<main id="main">
{body}
</main>
<footer class="site-footer">
  <div class="container footer-inner">
    <div>
      <a class="brand" href="/"><span class="mark">DB</span><span class="brand-text">{NAME}<small>CFA</small></span></a>
      <p class="muted">Investment research · Valuation · Infrastructure</p>
    </div>
    <div class="footer-links">
      {email_link}
      <a href="{LINKEDIN}" target="_blank" rel="noopener">{icon("linkedin")}LinkedIn</a>
      <a href="{GITHUB}" target="_blank" rel="noopener">{icon("github")}GitHub</a>
    </div>
    <p class="fine muted">© 2026 {NAME}. Research shown here is for educational purposes and is not investment advice.</p>
  </div>
</footer>
</body>
</html>
"""
    target = OUT / path.lstrip("/") / "index.html" if path.endswith("/") else OUT / path.lstrip("/")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(doc, encoding="utf-8")


def cover(p, size=""):
    c = p["cover"]
    return (f'<div class="cover cover-{c["tone"]} {size}" aria-hidden="true">'
            f'<span class="cover-label">{e(c["label"])}</span>'
            f'<span class="cover-head">{e(c["headline"])}</span>'
            f'<span class="cover-sub">{e(c["sub"])}</span>'
            f'<span class="cover-lines"><i></i><i></i><i></i></span></div>')


def card(p):
    tags = "".join(f"<li>{e(m)}</li>" for m in p["methods"][:3])
    return f"""<a class="card" href="/projects/{p['id']}/" data-category="{p['category']}">
  {cover(p)}
  <div class="card-body">
    <p class="meta"><span>{e(p['kind'])}</span><span>{e(p['date'])}</span></p>
    <h3>{e(p['title'])}</h3>
    <p>{e(p['summary'])}</p>
    <ul class="tags">{tags}</ul>
    <span class="link-arrow">View project {icon('arrow')}</span>
  </div>
</a>"""


def section_head(eyebrow, title, link=None):
    more = f'<a class="link-arrow" href="{link[1]}">{link[0]} {icon("arrow")}</a>' if link else ""
    return f'<div class="section-head"><div><p class="eyebrow">{eyebrow}</p><h2>{title}</h2></div>{more}</div>'


def contact_band():
    first = (f'<a class="btn" href="{e(mail_href())}">{icon("mail")} Email me</a>' if EMAIL
             else f'<a class="btn" href="/contact/">Contact {icon("arrow")}</a>')
    return f"""<section class="container">
  <div class="cta">
    <div>
      <p class="eyebrow">Let’s connect</p>
      <h2>Good conversations start with curiosity.</h2>
      <p>For research discussions, professional opportunities, or a shared interest in markets.</p>
    </div>
    <div class="actions">
      {first}
      <a class="btn ghost" href="{LINKEDIN}" target="_blank" rel="noopener">{icon('linkedin')} LinkedIn</a>
    </div>
  </div>
</section>"""


def build_home(projects):
    cards = "".join(card(p) for p in projects)
    body = f"""
<section class="hero container">
  <div class="hero-copy">
    <p class="eyebrow">Dipen Bhatt, CFA</p>
    <h1>Understanding businesses.<br><em>Connecting the dots.</em></h1>
    <p class="lead">I’m a CFA charterholder and quantitative finance graduate student at Washington University in St. Louis, with a background in civil engineering. I explore businesses, infrastructure, and the data behind investment decisions.</p>
    <div class="actions">
      <a class="btn" href="/projects/">Explore my work {icon('arrow')}</a>
      <a class="btn ghost" href="/about/">My story</a>
    </div>
  </div>
  <aside class="profile" aria-label="At a glance">
    <p class="eyebrow">At a glance</p>
    <dl>
      <div><dt>Credential</dt><dd>CFA Charterholder</dd></div>
      <div><dt>Education</dt><dd>MS Quantitative Finance<span class="muted">WashU Olin · December 2026</span></dd></div>
      <div><dt>Experience</dt><dd>Investment Analyst<span class="muted">Infrastructure &amp; renewable energy</span></dd></div>
      <div><dt>Foundation</dt><dd>B.E. Civil Engineering<span class="muted">Tribhuvan University</span></dd></div>
    </dl>
  </aside>
</section>

<section class="container section">
  {section_head("Selected work", "Projects &amp; research", ("All projects", "/projects/"))}
  <div class="grid cards">{cards}</div>
</section>

<section class="band">
  <div class="container tool-feature">
    <div>
      <p class="eyebrow">Interactive tool</p>
      <h2>ER Tone Analyzer</h2>
      <p>Score management tone in 10-Ks, 10-Qs, earnings calls and news with an equity-research lexicon, and compare it with a prior period. Files are processed in your browser and never uploaded.</p>
      <a class="btn" href="/tone-analyzer/">Open the analyzer {icon('arrow')}</a>
    </div>
    <div class="tone-mock" aria-hidden="true">
      <div class="tm-head"><span>Sample: current call vs prior</span><b>+18</b></div>
      <div class="tm-scale"><i style="left:59%"></i></div>
      <ul>
        <li><span class="pos">+3</span>free cash flow positive</li>
        <li><span class="pos">+2</span>raising guidance</li>
        <li><span class="neg">−2</span>gross margin compressed</li>
        <li><span class="neg">−3</span>covenant waiver</li>
      </ul>
    </div>
  </div>
</section>

<section class="container section split">
  <div>
    <p class="eyebrow">Behind the work</p>
    <h2>An engineer’s perspective.<br>An investor’s questions.</h2>
  </div>
  <div>
    <p>Born and raised in Nepal, I first trained as a civil engineer. Investing drew me toward valuation and financial research, and eventually to graduate study in the United States. I bring an understanding of physical assets to questions about capital, risk, and growth.</p>
    <a class="link-arrow" href="/about/">More about me {icon('arrow')}</a>
  </div>
</section>

{contact_band()}
"""
    page("/", "", body)


def build_projects(projects):
    used = [c for c in CATEGORIES if any(p["category"] == c for p in projects)]
    chips = '<button class="chip" data-filter="all" aria-pressed="true">All</button>' + "".join(
        f'<button class="chip" data-filter="{c}" aria-pressed="false">{CATEGORIES[c]}</button>' for c in used)
    cards = "".join(card(p) for p in projects)
    body = f"""
<section class="container page-head">
  <p class="eyebrow">Work</p>
  <h1>Projects &amp; research</h1>
  <p class="lead">Equity research, academic research and engineering work. Each project opens with the question, approach and takeaway, and the full files can be read right on the page.</p>
</section>
<section class="container section tight">
  <div class="chips" role="group" aria-label="Filter projects">{chips}<span class="sr" id="filter-status" aria-live="polite"></span></div>
  <div class="grid cards">{cards}</div>
  <a class="tool-row" href="/tone-analyzer/">
    <span class="eyebrow">Interactive tool</span>
    <strong>ER Tone Analyzer</strong>
    <span class="muted">Score and compare management tone in filings and earnings calls, in your browser.</span>
    <span class="link-arrow">Open {icon('arrow')}</span>
  </a>
</section>
"""
    page("/projects/", "Projects", body, active="Work",
         description="Equity research, academic research and engineering projects by Dipen Bhatt, CFA.")


def build_project(p, prev_p, next_p):
    methods = "".join(f"<li>{e(m)}</li>" for m in p["methods"])
    overview = "".join(f"<p>{e(x)}</p>" for x in p["overview"])
    repo_url = f"{GITHUB}/{p['repo']}"
    manifest = {"repo": f"bhattdipen9/{p['repo']}", "branch": p.get("branch", "main"),
                "browseRepo": p.get("browse_repo", False), "files": p["files"]}
    nav = ""
    if prev_p or next_p:
        a = f'<a href="/projects/{prev_p["id"]}/"><small>Previous</small>{e(prev_p["title"])}</a>' if prev_p else "<span></span>"
        b = f'<a class="next" href="/projects/{next_p["id"]}/"><small>Next</small>{e(next_p["title"])}</a>' if next_p else "<span></span>"
        nav = f'<nav class="pager container" aria-label="More projects">{a}{b}</nav>'
    body = f"""
<article>
<header class="container project-head">
  <a class="back" href="/projects/">{icon('back')} All projects</a>
  <div class="project-title">
    <div>
      <p class="meta"><span>{e(p['kind'])}</span><span>{e(p['date'])}</span></p>
      <h1>{e(p['title'])}</h1>
      <p class="question">{e(p['question'])}</p>
      <div class="actions">
        <a class="btn" href="#files">Read the files {icon('arrow')}</a>
        <a class="btn ghost" href="{repo_url}" target="_blank" rel="noopener">{icon('github')} Full project on GitHub</a>
      </div>
    </div>
    {cover(p, "cover-lg")}
  </div>
</header>

<section class="container facts">
  <div><h2>My role</h2><p>{e(p['role'])}</p></div>
  <div><h2>Approach</h2><ul class="tags">{methods}</ul></div>
  <div><h2>Takeaway</h2><p>{e(p['takeaway'])}</p></div>
</section>

<section class="container overview">
  <h2 class="eyebrow">Overview</h2>
  <div class="prose">{overview}</div>
</section>

<section class="container files-section" id="files">
  <div class="section-head"><div><p class="eyebrow">Project files</p><h2>Read it here</h2></div>
  <a class="link-arrow" href="{repo_url}" target="_blank" rel="noopener">Browse on GitHub {icon('arrow')}</a></div>
  <div class="viewer" data-viewer>
    <aside class="file-list" aria-label="Files"><ul data-file-list></ul></aside>
    <div class="file-pane">
      <div class="file-bar">
        <div class="file-name" data-file-name>Loading…</div>
        <div class="file-actions">
          <a class="icon-btn" data-file-download download>Download</a>
          <a class="icon-btn" data-file-github target="_blank" rel="noopener">GitHub</a>
          <button class="icon-btn" type="button" data-fullscreen>Expand</button>
        </div>
      </div>
      <div class="file-body" data-file-body tabindex="0"></div>
    </div>
  </div>
  <script type="application/json" id="project-files">{json.dumps(manifest)}</script>
</section>
</article>
{nav}
"""
    page(f"/projects/{p['id']}/", p["title"], body, active="Work", description=p["summary"],
         scripts='<script defer src="/assets/viewer.js"></script>')


def build_about():
    body = f"""
<section class="container page-head">
  <p class="eyebrow">About</p>
  <h1>Engineering roots.<br><em>Financial curiosity.</em></h1>
</section>
<section class="container about">
  <aside class="about-card">
    <div class="monogram" aria-hidden="true">DB</div>
    <p class="about-name">Dipen Bhatt, CFA</p>
    <ul class="tags"><li>Investment research</li><li>Valuation</li><li>Infrastructure &amp; energy</li></ul>
    <div class="about-links">
      <a class="btn small" href="{LINKEDIN}" target="_blank" rel="noopener">{icon('linkedin')} LinkedIn</a>
      <a class="btn small ghost" href="{GITHUB}" target="_blank" rel="noopener">{icon('github')} GitHub</a>
    </div>
  </aside>
  <div class="prose">
    <h2>My path into finance</h2>
    <p>Born and raised in Nepal, I first trained as a civil engineer. Investing drew me toward valuation and financial research, and eventually to graduate study in the United States. I bring an understanding of physical assets to questions about capital, risk, and growth.</p>
    <p>I began following and investing in stocks in 2020. What started as an interest in markets became a desire to understand what a business is worth, why expectations change, and where a differentiated view might come from. That curiosity led me to the CFA Program and a career in investment analysis.</p>
    <h2>Where I bring perspective</h2>
    <p>At Gen Alpha Private Limited, I worked on investment analysis, valuation, and financial and technical due diligence across infrastructure and renewable energy. My engineering background helps me think about the assets behind the model: how they are built, how they operate, and what can change their cash flows.</p>
    <p>As a valuation consultant for Aadhya School, I developed a ten-year FCFE model and enrollment scenarios to support expansion and capital-raising analysis.</p>
    <h2>What I’m exploring now</h2>
    <p>I am completing an MS in Quantitative Finance at Washington University in St. Louis’s Olin Business School, with graduation expected in December 2026. My projects connect fundamental research with Python, data analysis, and an interest in applying AI to financial research workflows.</p>
    <h2>Beyond the work</h2>
    <p>I enjoy playing guitar, traveling, watching films, and reading about philosophy, psychology, and markets. I like meeting people and learning how their experiences shape the way they think.</p>
  </div>
</section>
<section class="container section">
  {section_head("Background", "A foundation in analysis")}
  <ol class="timeline">
    <li><span class="when">2026</span><div><h3>CFA Charterholder</h3><p class="muted">CFA Institute · Private Markets pathway</p></div></li>
    <li><span class="when">2025 – 2026</span><div><h3>MS in Quantitative Finance</h3><p class="muted">Washington University in St. Louis · Olin Business School<br>Dean’s Scholar · Expected December 2026</p></div></li>
    <li><span class="when">2023 – 2025</span><div><h3>Investment Analyst</h3><p class="muted">Gen Alpha Private Limited · Nepal</p></div></li>
    <li><span class="when">Foundation</span><div><h3>Bachelor of Engineering, Civil Engineering</h3><p class="muted">Tribhuvan University · Institute of Engineering, Thapathali</p></div></li>
  </ol>
</section>
{contact_band()}
"""
    page("/about/", "About", body, active="About",
         description="Dipen Bhatt, CFA: civil engineer turned investment analyst, MS Quantitative Finance at WashU Olin.")


def build_contact():
    email_card = (f'<a class="contact-card" href="{e(mail_href())}">{icon("mail")}<span class="eyebrow">Email</span>'
                  f'<strong>{e(EMAIL)}</strong><span class="muted">Professional opportunities, research and collaborations.</span></a>'
                  if EMAIL else "")
    body = f"""
<section class="container page-head">
  <p class="eyebrow">Contact</p>
  <h1>Let’s start a conversation.</h1>
  <p class="lead">I’m interested in thoughtful conversations about investment research, infrastructure, valuation, and the tools that make analysis better.</p>
</section>
<section class="container section tight">
  <div class="grid contact-grid">
    {email_card}
    <a class="contact-card" href="{LINKEDIN}" target="_blank" rel="noopener">{icon('linkedin')}<span class="eyebrow">LinkedIn</span><strong>Connect professionally</strong><span class="muted">My professional background and a place to keep in touch.</span></a>
    <a class="contact-card" href="{GITHUB}" target="_blank" rel="noopener">{icon('github')}<span class="eyebrow">GitHub</span><strong>Explore the source</strong><span class="muted">Code and materials for my public projects.</span></a>
  </div>
</section>
"""
    page("/contact/", "Contact", body, active="Contact",
         description="Get in touch with Dipen Bhatt, CFA.")


def build_vlogs():
    body = f"""
<section class="container page-head">
  <p class="eyebrow">Vlogs</p>
  <h1>Life beyond the models.</h1>
  <p class="lead">A home for videos, personal perspectives, and the experiences behind the work.</p>
</section>
<section class="container section tight">
  <div class="empty">
    <div class="empty-art" aria-hidden="true"><span></span></div>
    <h2>The first episode is on its way.</h2>
    <p class="muted">No videos are published yet. In the meantime, the research and projects are already here.</p>
    <a class="btn" href="/projects/">Explore projects {icon('arrow')}</a>
  </div>
</section>
"""
    page("/vlogs/", "Vlogs", body, active="Vlogs", description="Videos and perspectives from Dipen Bhatt, CFA.")


def build_tone():
    app = (ROOT / "content" / "tone-app.html").read_text(encoding="utf-8")
    body = f"""
<section class="container page-head">
  <p class="eyebrow">Interactive equity research tool</p>
  <h1>ER Tone Analyzer</h1>
  <p class="lead">Explore management tone in 10-K and 10-Q filings, earnings call transcripts and news, then compare it with a prior period to find meaningful shifts. Documents are processed privately in your browser; nothing is uploaded. A research aid, not investment advice.</p>
</section>
<div class="container tone-shell">{app}</div>
"""
    scripts = "".join(f'<script defer src="/tone-analyzer/js/{n}.js"></script>' for n in ("lexicon", "engine", "samples", "app"))
    page("/tone-analyzer/", "ER Tone Analyzer", body, active="Tools",
         description="Score management tone in 10-Ks, 10-Qs, earnings calls and news with an equity-research lexicon. Runs in your browser.",
         head_extra='<link rel="stylesheet" href="/tone-analyzer/css/styles.css">', scripts=scripts)


def build_404():
    body = """
<section class="container page-head notfound">
  <p class="eyebrow">404</p>
  <h1>This page isn’t here.</h1>
  <p class="lead">The link may be old or mistyped.</p>
  <div class="actions"><a class="btn" href="/">Go home</a><a class="btn ghost" href="/projects/">See projects</a></div>
</section>"""
    page("/404.html", "Page not found", body)


def build_meta(projects):
    paths = ["/", "/projects/", "/tone-analyzer/", "/about/", "/contact/", "/vlogs/"] + [
        f"/projects/{p['id']}/" for p in projects]
    urls = "".join(f"<url><loc>{SITE}{u}</loc></url>" for u in paths)
    (OUT / "sitemap.xml").write_text(
        f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>\n')
    (OUT / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {SITE}/sitemap.xml\n")
    (OUT / "CNAME").write_text("www.dipenwho.com\n")
    (OUT / ".nojekyll").write_text("")


def main():
    projects = json.loads((ROOT / "content" / "projects.json").read_text(encoding="utf-8"))
    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(ROOT / "static", OUT)
    shutil.copytree(ROOT / "content" / "files", OUT / "files")
    build_home(projects)
    build_projects(projects)
    for i, p in enumerate(projects):
        build_project(p, projects[i - 1] if i > 0 else None, projects[i + 1] if i + 1 < len(projects) else None)
    build_about()
    build_contact()
    build_vlogs()
    build_tone()
    build_404()
    build_meta(projects)
    print(f"Built {len(projects)} projects into {OUT}" + ("" if EMAIL else " (no email set: email links left out)"))


if __name__ == "__main__":
    main()
