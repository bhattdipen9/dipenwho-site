/* In-page file viewer: Markdown, PDF, Excel/CSV, Word, Jupyter, code, images, video, HTML. */
(() => {
  const root = document.querySelector('[data-viewer]');
  const manifestEl = document.getElementById('project-files');
  if (!root || !manifestEl) return;
  const manifest = JSON.parse(manifestEl.textContent);

  const CDN = {
    marked: 'https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.2/marked.min.js',
    purify: 'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.1.6/purify.min.js',
    pdf: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    pdfWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
    xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    jszip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
    docx: 'https://cdn.jsdelivr.net/npm/docx-preview@0.3.2/dist/docx-preview.min.js',
    hljs: 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js',
  };

  const TYPES = {
    md: 'markdown', markdown: 'markdown',
    pdf: 'pdf',
    xlsx: 'sheet', xlsm: 'sheet', xls: 'sheet', ods: 'sheet', csv: 'sheet', tsv: 'sheet',
    docx: 'docx',
    ipynb: 'notebook',
    png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', svg: 'image', webp: 'image',
    mp4: 'video', webm: 'video', mov: 'video', mp3: 'audio', wav: 'audio',
    html: 'html', htm: 'html',
    pptx: 'unsupported', ppt: 'unsupported', doc: 'unsupported', zip: 'unsupported', parquet: 'unsupported',
  };
  const CODE = {
    py: 'python', r: 'r', sql: 'sql', js: 'javascript', ts: 'typescript', json: 'json', yaml: 'yaml', yml: 'yaml',
    toml: 'ini', ini: 'ini', sh: 'bash', m: 'matlab', jl: 'julia', cpp: 'cpp', c: 'c', java: 'java', css: 'css',
    xml: 'xml', vba: 'vbnet', bas: 'vbnet', tex: 'latex', txt: 'plaintext', log: 'plaintext', cfg: 'ini', '': 'plaintext',
  };

  const $ = (sel) => root.querySelector(sel);
  const listEl = $('[data-file-list]');
  const nameEl = $('[data-file-name]');
  const bodyEl = $('[data-file-body]');
  const dlEl = $('[data-file-download]');
  const ghEl = $('[data-file-github]');
  const fsBtn = $('[data-fullscreen]');
  const repoUrl = `https://github.com/${manifest.repo}`;
  const branch = manifest.branch || 'main';

  const loaded = {};
  function load(url) {
    if (!loaded[url]) {
      loaded[url] = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = url; s.async = true; s.onload = res; s.onerror = () => rej(new Error('Could not load viewer library'));
        document.head.appendChild(s);
      });
    }
    return loaded[url];
  }

  const ext = (name) => { const m = /\.([^./]+)$/.exec(name.toLowerCase()); return m ? m[1] : ''; };
  const kindOf = (name) => { const x = ext(name); return TYPES[x] || (x in CODE ? 'code' : 'unsupported'); };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtSize = (n) => (n == null ? '' : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);

  function status(html) { bodyEl.innerHTML = `<div class="v-status"><div>${html}</div></div>`; }
  function spinner(msg) { status(`<div class="v-spin"></div>${esc(msg || 'Loading…')}`); }
  function failed(file, msg) {
    status(`<p><strong>${esc(msg)}</strong></p><p>You can still download the file or open it on GitHub.</p>
      <a class="btn" href="${esc(file.src)}" download>Download ${esc(file.name)}</a>`);
  }

  async function fetchOk(url, as) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`File could not be loaded (${r.status})`);
    return as === 'buffer' ? r.arrayBuffer() : r.text();
  }

  /* ---------- renderers ---------- */
  async function mdToHtml(text) {
    await Promise.all([load(CDN.marked), load(CDN.purify)]);
    const html = window.marked.parse(text, { gfm: true, breaks: false });
    return window.DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });
  }

  function slug(s, used) {
    let base = s.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'section';
    let id = base, n = 2;
    while (used.has(id)) id = `${base}-${n++}`;
    used.add(id); return id;
  }

  async function renderMarkdown(file) {
    const text = await fetchOk(file.src);
    const html = await mdToHtml(text);
    const wrap = document.createElement('div');
    wrap.className = 'doc-with-toc';
    wrap.innerHTML = `<nav class="doc-toc" aria-label="Contents"><p>Contents</p></nav><div class="doc">${html}</div>`;
    const doc = wrap.querySelector('.doc');
    doc.querySelectorAll('a[href^="http"]').forEach((a) => { a.target = '_blank'; a.rel = 'noopener'; });
    const base = file.src.replace(/[^/]*$/, '');
    doc.querySelectorAll('img[src]').forEach((img) => {
      const s = img.getAttribute('src');
      if (!/^(https?:|data:|\/)/.test(s)) img.src = base + s;
      img.loading = 'lazy';
    });
    const used = new Set();
    const heads = [...doc.querySelectorAll('h1, h2, h3')];
    const toc = wrap.querySelector('.doc-toc');
    heads.forEach((h) => { h.id = slug(h.textContent, used); });
    const tocHeads = heads.filter((h) => h.tagName !== 'H1');
    if (tocHeads.length < 3) { wrap.classList.remove('doc-with-toc'); toc.remove(); }
    else {
      tocHeads.slice(0, 80).forEach((h) => {
        const a = document.createElement('a');
        a.href = `#${h.id}`; a.textContent = h.textContent; if (h.tagName === 'H3') a.className = 'sub';
        a.addEventListener('click', (ev) => { ev.preventDefault(); h.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
        toc.appendChild(a);
      });
      const links = new Map([...toc.querySelectorAll('a')].map((a) => [a.getAttribute('href').slice(1), a]));
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting && links.has(en.target.id)) {
            toc.querySelectorAll('a.on').forEach((x) => x.classList.remove('on'));
            links.get(en.target.id).classList.add('on');
          }
        });
      }, { root: bodyEl, rootMargin: '0px 0px -75% 0px' });
      tocHeads.forEach((h) => io.observe(h));
    }
    bodyEl.replaceChildren(wrap);
  }

  async function renderPdf(file) {
    await load(CDN.pdf);
    const pdfjs = window.pdfjsLib;
    pdfjs.GlobalWorkerOptions.workerSrc = CDN.pdfWorker;
    const pdf = await pdfjs.getDocument({ url: file.src }).promise;
    const box = document.createElement('div');
    box.className = 'pdf-pages';
    bodyEl.replaceChildren(box);
    const width = Math.min(bodyEl.clientWidth - 48, 980);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const c = document.createElement('canvas');
      c.dataset.page = i; c.setAttribute('aria-label', `Page ${i}`);
      c.style.width = `${width}px`; c.style.aspectRatio = '0.773';
      box.appendChild(c); pages.push(c);
    }
    const draw = async (c) => {
      if (c.dataset.done) return; c.dataset.done = '1';
      const page = await pdf.getPage(Number(c.dataset.page));
      const v1 = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: (width / v1.width) * dpr });
      c.width = vp.width; c.height = vp.height; c.style.aspectRatio = `${vp.width} / ${vp.height}`;
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    };
    const io = new IntersectionObserver((es) => es.forEach((en) => en.isIntersecting && draw(en.target)), { root: bodyEl, rootMargin: '600px 0px' });
    pages.forEach((c) => io.observe(c));
  }

  async function renderSheet(file) {
    await load(CDN.xlsx);
    const X = window.XLSX;
    const x = ext(file.name);
    const wb = (x === 'csv' || x === 'tsv')
      ? X.read(await fetchOk(file.src), { type: 'string', FS: x === 'tsv' ? '\t' : ',' })
      : X.read(await fetchOk(file.src, 'buffer'), { type: 'array', cellStyles: true });
    const box = document.createElement('div');
    box.className = 'sheet-box';
    const tabs = document.createElement('div');
    tabs.className = 'sheet-tabs';
    const area = document.createElement('div');
    area.className = 'sheet-wrap';
    const MAXR = 3000, MAXC = 80;
    const show = (name) => {
      tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.textContent === name)));
      const ws = wb.Sheets[name];
      if (!ws || !ws['!ref']) { area.innerHTML = '<div class="v-status">This sheet is empty.</div>'; return; }
      const r = X.utils.decode_range(ws['!ref']);
      const r1 = Math.min(r.e.r, r.s.r + MAXR - 1), c1 = Math.min(r.e.c, r.s.c + MAXC - 1);
      const cols = ws['!cols'] || [];
      let h = '<table class="grid-table"><colgroup><col style="width:48px">';
      for (let c = r.s.c; c <= c1; c++) {
        const w = cols[c] && (cols[c].wpx || (cols[c].wch && cols[c].wch * 7.5) || (cols[c].width && cols[c].width * 7.5));
        h += `<col style="width:${Math.round(Math.max(48, Math.min(w || 90, 420)))}px">`;
      }
      h += '</colgroup><thead><tr><th></th>';
      for (let c = r.s.c; c <= c1; c++) h += `<th>${X.utils.encode_col(c)}</th>`;
      h += '</tr></thead><tbody>';
      for (let rr = r.s.r; rr <= r1; rr++) {
        h += `<tr><td class="rn">${rr + 1}</td>`;
        for (let c = r.s.c; c <= c1; c++) {
          const cell = ws[X.utils.encode_cell({ r: rr, c })];
          const v = cell ? (cell.w != null ? cell.w : (cell.v != null ? cell.v : '')) : '';
          if (v === '') { h += '<td></td>'; continue; }
          h += `<td${cell.t === 'n' ? ' class="num"' : ''} title="${esc(cell.f ? '=' + cell.f : v)}">${esc(v)}</td>`;
        }
        h += '</tr>';
      }
      h += '</tbody></table>';
      if (r.e.r > r1 || r.e.c > c1) h += '<p class="muted" style="padding:12px 16px">Large sheet: showing the first rows and columns. Download for the full file.</p>';
      area.innerHTML = h;
      area.scrollTop = 0;
    };
    wb.SheetNames.forEach((n) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = n; b.addEventListener('click', () => show(n));
      tabs.appendChild(b);
    });
    if (wb.SheetNames.length > 1) box.appendChild(tabs);
    box.appendChild(area);
    bodyEl.replaceChildren(box);
    show(wb.SheetNames[0]);
  }

  async function renderDocx(file) {
    await load(CDN.jszip);
    await load(CDN.docx);
    const buf = await fetchOk(file.src, 'buffer');
    const box = document.createElement('div');
    box.className = 'docx-view';
    bodyEl.replaceChildren(box);
    await window.docx.renderAsync(buf, box, null, { inWrapper: true, ignoreLastRenderedPageBreak: true, breakPages: true });
  }

  async function highlight(code, lang) {
    try {
      await load(CDN.hljs);
      if (lang && window.hljs.getLanguage(lang)) return window.hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
    } catch (_) { /* plain text fallback */ }
    return esc(code);
  }

  async function renderCode(file) {
    const text = await fetchOk(file.src);
    const lang = CODE[ext(file.name)] || 'plaintext';
    const html = (text.length > 400000) ? esc(text) : await highlight(text, lang);
    const n = text.replace(/\n$/, '').split('\n').length;
    const gutter = Array.from({ length: n }, (_, k) => k + 1).join('\n');
    bodyEl.innerHTML = `<div class="code-view"><pre class="gutter" aria-hidden="true">${gutter}</pre><pre class="src"><code>${html}</code></pre></div>`;
  }

  async function renderNotebook(file) {
    const nb = JSON.parse(await fetchOk(file.src));
    const lang = (nb.metadata && nb.metadata.kernelspec && nb.metadata.kernelspec.language) || 'python';
    const src = (s) => (Array.isArray(s) ? s.join('') : s || '');
    const out = [];
    for (const cell of nb.cells || []) {
      if (cell.cell_type === 'markdown') {
        out.push(`<div class="nb-cell md"><div class="doc">${await mdToHtml(src(cell.source))}</div></div>`);
      } else if (cell.cell_type === 'code') {
        let h = `<div class="nb-cell code"><div class="nb-label">In [${cell.execution_count ?? ' '}]</div><div class="nb-src"><pre><code>${await highlight(src(cell.source), lang)}</code></pre></div>`;
        const outs = [];
        for (const o of cell.outputs || []) {
          if (o.output_type === 'stream') outs.push(`<pre>${esc(src(o.text))}</pre>`);
          else if (o.output_type === 'error') outs.push(`<pre class="neg">${esc((o.ename || '') + ': ' + (o.evalue || ''))}</pre>`);
          else if (o.data) {
            const d = o.data;
            if (d['image/png']) outs.push(`<img alt="Output" src="data:image/png;base64,${src(d['image/png']).trim()}">`);
            else if (d['image/jpeg']) outs.push(`<img alt="Output" src="data:image/jpeg;base64,${src(d['image/jpeg']).trim()}">`);
            else if (d['image/svg+xml']) { await load(CDN.purify); outs.push(window.DOMPurify.sanitize(src(d['image/svg+xml']))); }
            else if (d['text/html']) { await load(CDN.purify); outs.push(`<div class="doc">${window.DOMPurify.sanitize(src(d['text/html']))}</div>`); }
            else if (d['text/markdown']) outs.push(`<div class="doc">${await mdToHtml(src(d['text/markdown']))}</div>`);
            else if (d['text/plain']) outs.push(`<pre>${esc(src(d['text/plain']))}</pre>`);
          }
        }
        if (outs.length) h += `<div class="nb-out">${outs.join('')}</div>`;
        out.push(h + '</div>');
      }
    }
    bodyEl.innerHTML = `<div class="nb">${out.join('')}</div>`;
  }

  function renderMedia(file, kind) {
    const s = esc(file.src);
    const el = kind === 'image' ? `<img src="${s}" alt="${esc(file.label || file.name)}">`
      : kind === 'video' ? `<video src="${s}" controls playsinline preload="metadata"></video>`
        : `<audio src="${s}" controls preload="metadata"></audio>`;
    bodyEl.innerHTML = `<div class="media-view">${el}</div>`;
  }

  function renderHtml(file) {
    bodyEl.innerHTML = `<iframe class="html-view" sandbox="" referrerpolicy="no-referrer" src="${esc(file.src)}" title="${esc(file.name)}"></iframe>`;
  }

  /* ---------- file list ---------- */
  function ghLink(file) {
    return file.github ? `${repoUrl}/blob/${branch}/${file.github.split('/').map(encodeURIComponent).join('/')}` : repoUrl;
  }

  let files = manifest.files.map((f) => ({ ...f, group: f.group || '' }));
  let current = -1;

  async function open(i, push = true) {
    const file = files[i];
    if (!file) return;
    current = i;
    listEl.querySelectorAll('button').forEach((b) => b.setAttribute('aria-current', String(Number(b.dataset.i) === i)));
    nameEl.textContent = file.label ? `${file.label} · ${file.name}` : file.name;
    dlEl.href = file.src; dlEl.setAttribute('download', file.name);
    ghEl.href = ghLink(file);
    if (push) history.replaceState(null, '', `#file=${encodeURIComponent(file.name)}`);
    const kind = kindOf(file.name);
    spinner(`Opening ${file.name}…`);
    bodyEl.scrollTop = 0;
    try {
      if (kind === 'markdown') await renderMarkdown(file);
      else if (kind === 'pdf') await renderPdf(file);
      else if (kind === 'sheet') await renderSheet(file);
      else if (kind === 'docx') await renderDocx(file);
      else if (kind === 'notebook') await renderNotebook(file);
      else if (kind === 'code') await renderCode(file);
      else if (kind === 'image' || kind === 'video' || kind === 'audio') renderMedia(file, kind);
      else if (kind === 'html') renderHtml(file);
      else failed(file, `${ext(file.name).toUpperCase() || 'This'} files can’t be previewed in the browser.`);
    } catch (err) {
      if (current === i) failed(file, err.message || 'This file could not be displayed.');
    }
  }

  function renderList() {
    listEl.innerHTML = '';
    let lastGroup = null;
    files.forEach((f, i) => {
      if (f.group !== lastGroup && f.group) {
        const g = document.createElement('li'); g.className = 'group'; g.textContent = f.group; listEl.appendChild(g);
      }
      lastGroup = f.group;
      const li = document.createElement('li');
      const x = ext(f.name) || 'file';
      li.innerHTML = `<button type="button" data-i="${i}"><span class="badge">${esc(x.slice(0, 4))}</span><span><span class="fname">${esc(f.label || f.name)}</span><span class="fsub">${esc(f.label ? f.name : fmtSize(f.size))}</span></span></button>`;
      li.firstChild.addEventListener('click', () => {
        open(i);
        if (window.matchMedia('(max-width: 760px)').matches) bodyEl.focus({ preventScroll: true });
      });
      listEl.appendChild(li);
    });
    root.classList.toggle('single', files.length < 2);
  }

  async function addRepoFiles() {
    try {
      const r = await fetch(`https://api.github.com/repos/${manifest.repo}/git/trees/${branch}?recursive=1`);
      if (!r.ok) return;
      const data = await r.json();
      const known = new Set(files.map((f) => f.github).filter(Boolean));
      const extra = (data.tree || [])
        .filter((t) => t.type === 'blob' && !known.has(t.path) && !/(^|\/)\.|(^|\/)(node_modules|__pycache__)\//.test(t.path))
        .map((t) => ({
          name: t.path.split('/').pop(), github: t.path, size: t.size,
          group: t.path.includes('/') ? t.path.split('/').slice(0, -1).join(' / ') : 'Repository',
          src: `https://raw.githubusercontent.com/${manifest.repo}/${branch}/${t.path.split('/').map(encodeURIComponent).join('/')}`,
        }))
        .sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
      if (extra.length) {
        files.forEach((f) => { if (!f.group) f.group = 'Featured'; });
        files = files.concat(extra);
      }
    } catch (_) { /* GitHub unavailable: keep featured files */ }
  }

  function fromHash() {
    const m = /#file=([^&]+)/.exec(location.hash);
    if (!m) return -1;
    const n = decodeURIComponent(m[1]);
    return files.findIndex((f) => f.name === n);
  }

  fsBtn.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (root.requestFullscreen) root.requestFullscreen().catch(() => root.classList.toggle('is-full'));
    else root.classList.toggle('is-full');
  });
  document.addEventListener('fullscreenchange', () => { fsBtn.textContent = document.fullscreenElement ? 'Close' : 'Expand'; });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') root.classList.remove('is-full'); });

  (async () => {
    if (manifest.browseRepo) await addRepoFiles();
    renderList();
    if (!files.length) { status('No files have been added to this project yet.'); return; }
    const h = fromHash();
    open(h >= 0 ? h : 0, false);
    if (h >= 0) {
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
      setTimeout(() => document.getElementById('files').scrollIntoView({ behavior: 'instant', block: 'start' }), 60);
    }
  })();
})();
