/* UI wiring for the ER Tone Analyzer. All processing happens in the browser. */
(function () {
  'use strict';
  const E = window.SentimentEngine;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const MAX_BYTES = 30 * 1024 * 1024;

  let mode = 'single';
  let last = null; // { current, prior, cmp }
  let shown = 0;

  // ---------------------------------------------------------------------------
  // Mode switch
  // ---------------------------------------------------------------------------
  $$('.mode').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  function setMode(m) {
    mode = m;
    $$('.mode').forEach((b) => { const on = b.dataset.mode === m; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
    $('[data-slot="prior"]').hidden = m !== 'compare';
    $('#inputs').classList.toggle('two', m === 'compare');
    $('[data-slot="current"] [data-title]').textContent = m === 'compare' ? 'Current document' : 'Document';
  }

  // ---------------------------------------------------------------------------
  // File reading: PDF (pdf.js, lazy-loaded), HTML (EDGAR filings), plain text
  // ---------------------------------------------------------------------------
  let pdfReady = null;
  function loadPdfJs() {
    if (pdfReady) return pdfReady;
    pdfReady = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = PDFJS;
      s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; resolve(window.pdfjsLib); };
      s.onerror = () => { pdfReady = null; reject(new Error('Could not load the PDF reader. Check your connection, or paste the text instead.')); };
      document.head.appendChild(s);
    });
    return pdfReady;
  }

  async function pdfToText(buf, onProgress) {
    const lib = await loadPdfJs();
    const doc = await lib.getDocument({ data: buf }).promise;
    const pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      let out = '', lastY = null, lastEndX = null, lineH = 10;
      for (const it of content.items) {
        if (!('str' in it)) continue;
        const x = it.transform[4], y = it.transform[5];
        if (it.height) lineH = it.height; // empty end-of-line markers report height 0
        const dy = lastY === null ? 0 : Math.abs(y - lastY);
        if (lastY !== null && dy > lineH * 0.5) {
          // new line; a gap of well over one line-height is a paragraph break
          const want = dy > lineH * 1.6 ? '\n\n' : '\n';
          out = out.replace(/[ \t]*\n*$/, '') + want;
        } else if (lastEndX !== null && x - lastEndX > 1.5 && !/\s$/.test(out) && !it.str.startsWith(' ')) {
          out += ' ';
        }
        out += it.str;
        if (it.hasEOL && !out.endsWith('\n')) out += '\n';
        lastY = y; lastEndX = x + (it.width || 0);
      }
      pages.push(out);
      onProgress && onProgress(p, doc.numPages);
    }
    const text = pages.join('\n\n');
    if (text.replace(/\s/g, '').length < 200) throw new Error('This PDF has almost no selectable text. It is probably scanned; OCR is not supported yet.');
    return text;
  }

  function htmlToText(html) {
    const marked = html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|li|h[1-6]|table|section)>/gi, '\n\n');
    const doc = new DOMParser().parseFromString(marked, 'text/html');
    return (doc.body ? doc.body.textContent : '').replace(/[ \t]+/g, ' ').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n');
  }

  async function readFile(file, onProgress) {
    if (file.size > MAX_BYTES) throw new Error('File is larger than 30 MB.');
    const name = file.name.toLowerCase();
    if (name.endsWith('.pdf') || file.type === 'application/pdf') return pdfToText(await file.arrayBuffer(), onProgress);
    const txt = await file.text();
    if (name.endsWith('.htm') || name.endsWith('.html') || /^\s*<(!doctype|html)/i.test(txt)) return htmlToText(txt);
    return txt;
  }

  // ---------------------------------------------------------------------------
  // Input cards
  // ---------------------------------------------------------------------------
  function wordCount(t) { return (t.match(/\S+/g) || []).length; }

  $$('.doc-card').forEach((card) => {
    const drop = $('.drop', card), input = $('input[type=file]', card), ta = $('textarea', card);
    const updateCount = () => { $('.count', card).textContent = wordCount(ta.value).toLocaleString() + ' words'; };
    ta.addEventListener('input', updateCount);
    $('.clear', card).addEventListener('click', () => {
      ta.value = ''; input.value = ''; $('.doc-label', card).value = '';
      $('.drop-file', card).hidden = true; $('.drop-main', card).hidden = false; updateCount();
    });
    const handle = async (file) => {
      if (!file) return;
      status(`Reading ${file.name}…`);
      try {
        const text = await readFile(file, (p, n) => status(`Reading ${file.name}: page ${p} of ${n}`));
        ta.value = text.trim();
        const lbl = $('.doc-label', card);
        if (!lbl.value) lbl.value = file.name.replace(/\.[^.]+$/, '');
        $('.drop-file', card).textContent = file.name;
        $('.drop-file', card).hidden = false; $('.drop-main', card).hidden = true;
        updateCount();
        status(`Loaded ${file.name} (${wordCount(text).toLocaleString()} words).`);
      } catch (e) { status(e.message, true); }
    };
    input.addEventListener('change', () => handle(input.files[0]));
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); handle(e.dataTransfer.files[0]); });
    card._get = () => ({ text: ta.value, label: $('.doc-label', card).value.trim() });
    card._set = (text, label) => { ta.value = text; $('.doc-label', card).value = label; updateCount(); };
  });

  $('#btn-sample').addEventListener('click', () => {
    const S = window.ER_SAMPLES;
    setMode('compare');
    $('[data-slot="current"]')._set(S.current.text, S.current.label);
    $('[data-slot="prior"]')._set(S.prior.text, S.prior.label);
    $('#opt-type').value = 'transcript';
    status('Loaded a fictional sample: two consecutive earnings calls. Press Analyze.');
  });

  function status(msg, err) { const s = $('#status'); s.textContent = msg; s.classList.toggle('err', !!err); }

  // ---------------------------------------------------------------------------
  // Run
  // ---------------------------------------------------------------------------
  $('#btn-run').addEventListener('click', run);

  function run() {
    const cur = $('[data-slot="current"]')._get();
    const pri = $('[data-slot="prior"]')._get();
    if (wordCount(cur.text) < 30) return status('Add a document first (upload a file or paste at least a paragraph).', true);
    if (mode === 'compare' && wordCount(pri.text) < 30) return status('Add the prior document to compare against.', true);
    const opts = {
      docType: $('#opt-type').value,
      section: $('#opt-section').value,
      managementOnly: $('#opt-mgmt').checked,
    };
    const btn = $('#btn-run');
    btn.disabled = true; status('Analyzing…');
    setTimeout(() => {
      try {
        const current = E.analyze(cur.text, opts);
        current.label_ = cur.label || (mode === 'compare' ? 'Current' : 'Document');
        let prior = null, cmp = null;
        if (mode === 'compare') {
          prior = E.analyze(pri.text, opts);
          prior.label_ = pri.label || 'Prior';
          cmp = E.compare(current, prior);
        }
        if (!current.sentences.length) throw new Error('No scorable sentences found. Try "Full text" or a different document type.');
        last = { current, prior, cmp };
        render();
        status(`Done in ${current.meta.ms + (prior ? prior.meta.ms : 0)} ms.`);
        $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (e) {
        console.error(e); status(e.message, true);
      } finally { btn.disabled = false; }
    }, 20);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const signed = (x, dp = 0) => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(dp);
  const cls = (x) => (x > 0 ? 'up' : x < 0 ? 'down' : '');

  function render() {
    const { current: c, prior: p, cmp } = last;
    $('#results').hidden = false;

    // Summary
    const bullets = cmp ? cmp.summary.concat(E.describeSingle(c).slice(1)) : E.describeSingle(c);
    $('#summary').innerHTML = `<h3>${cmp ? `Analyst summary: ${esc(c.label_)} vs ${esc(p.label_)}` : `Analyst summary: ${esc(c.label_)}`}</h3><ul>${bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`;

    // KPIs
    const k = [];
    k.push(kpi('Tone score', signed(c.score), c.label, cls(c.score)));
    if (cmp) {
      const sig = cmp.bootstrap ? (cmp.bootstrap.significant ? 'Significant (95% CI excludes 0)' : 'Not significant (within noise)') : 'Too short to test';
      k.push(kpi('Change vs prior', signed(cmp.deltas.score) + ' pts', sig, cls(cmp.deltas.score)));
      k.push(kpi('Language similarity', Math.round(cmp.similarity * 100) + '%', cmp.similarity < 0.6 ? 'Substantial rewrite' : 'Similar wording'));
    }
    if (c.forward.words > 0) k.push(kpi('Forward-looking tone', signed(c.forward.net * 100), `Results tone ${signed(c.backward.net * 100)}`, cls(c.forward.net)));
    if (c.qa.words > 0 && c.prepared.words > 0) k.push(kpi('Q&A tone', signed(c.qa.net * 100), `Prepared remarks ${signed(c.prepared.net * 100)}`, cls(c.qa.net)));
    k.push(kpi('Uncertainty', c.overall.uncertaintyPer1k.toFixed(1), cmp ? `per 1k words (${signed(cmp.deltas.uncertainty, 1)} vs prior)` : 'words per 1,000'));
    k.push(kpi('Hedged sentences', Math.round(c.hedgedShare * 100) + '%', `${c.meta.sentences} sentences scored`));
    $('#kpis').innerHTML = k.join('');

    // Gauge
    const pos = (s) => `${50 + s / 2}%`;
    const edge = (s) => (s > 60 ? ' edge-r' : s < -60 ? ' edge-l' : '');
    $('#gauge').innerHTML = '<div class="tick"></div>' +
      (p ? `<div class="mk prior${edge(p.score)}" style="left:${pos(p.score)}" title="${esc(p.label_)}"><span>${esc(p.label_)} ${signed(p.score)}</span></div>` : '') +
      `<div class="mk${edge(c.score)}" style="left:${pos(c.score)}" title="${esc(c.label_)}"><span>${esc(c.label_)} ${signed(c.score)}</span></div>`;

    // Drivers
    renderDrivers('#drv-pos', c.topPositive, 'pos');
    renderDrivers('#drv-neg', c.topNegative, 'neg');

    // Diff
    $('#diff-card').hidden = !cmp;
    if (cmp) {
      const li = (x, right) => `<li><span>${layerTag(x.layer)}${esc(x.label)}</span><span>${right}</span></li>`;
      const list = (arr, f) => arr.length ? `<ul>${arr.map(f).join('')}</ul>` : '<p class="none">None</p>';
      $('#diff').innerHTML =
        `<div><h4>New this period</h4>${list(cmp.appeared, (x) => li(x, `<b class="${cls(x.total)}">${signed(x.total, 1)}</b> ×${x.count}`))}</div>` +
        `<div><h4>Dropped since prior</h4>${list(cmp.disappeared, (x) => li(x, `<b class="${cls(x.total)}">${signed(x.total, 1)}</b> ×${x.count}`))}</div>` +
        `<div><h4>Flipped or shifted</h4>${list(cmp.changed, (x) => x.flipped
          ? li(x, `${signed(x.prevTotal, 1)} → <b class="${cls(x.curTotal)}">${signed(x.curTotal, 1)}</b> flipped`)
          : li(x, `×${x.prevCount} → <b class="${cls(x.weight * (x.ratio - 1))}">×${x.curCount}</b>`))}</div>`;
    }

    // Explorer
    $('#ex-doc').hidden = !p;
    $('#ex-doc').value = 'current';
    renderSentences(true);

    // Notes
    const notes = [`Detected type: ${c.meta.docType}. Section scored: ${c.meta.sectionUsed}. Word list: ${c.meta.wordSource}.`].concat(c.meta.notes);
    if (p) notes.push(`Prior: type ${p.meta.docType}, section ${p.meta.sectionUsed}. ${p.meta.notes.join(' ')}`);
    const lt = c.layerTotals, tot = lt.phrase + lt.metric + lt.word || 1;
    notes.push(`Share of signal: ER phrases ${Math.round(lt.phrase / tot * 100)}%, metric moves ${Math.round(lt.metric / tot * 100)}%, single words ${Math.round(lt.word / tot * 100)}%.`);
    $('#notes').innerHTML = `<b>Processing notes</b><ul>${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`;
  }

  function kpi(k, v, s, c = '') {
    return `<div class="kpi"><div class="k">${esc(k)}</div><div class="v ${c}">${esc(v)}</div><div class="s">${esc(s || '')}</div></div>`;
  }

  function layerTag(layer) {
    return layer === 'phrase' ? '<span class="tag">ER</span>' : layer === 'metric' ? '<span class="tag">M</span>' : '';
  }

  function renderDrivers(sel, list, kind) {
    const max = Math.max(...list.map((d) => Math.abs(d.total)), 1);
    $(sel).innerHTML = list.length
      ? list.map((d) => `<li title="${esc(d.label)}: ${d.count} mention(s)"><span class="lbl">${layerTag(d.layer)}${esc(d.label)} <small>×${d.count}</small></span><span class="bar ${kind}"><i style="width:${(Math.abs(d.total) / max) * 100}%"></i></span><span class="num">${signed(d.total, 1)}</span></li>`).join('')
      : '<li class="empty">None found</li>';
  }

  $('#ex-filter').addEventListener('change', () => renderSentences(true));
  $('#ex-doc').addEventListener('change', () => renderSentences(true));
  $('#ex-more').addEventListener('click', () => renderSentences(false));

  function highlight(s) {
    const spans = [];
    for (const m of s.matches) for (const [a, b] of m.spans) spans.push({ a, b, m });
    spans.sort((x, y) => x.a - y.a);
    let out = '', pos = 0;
    for (const sp of spans) {
      if (sp.a < pos) continue;
      const m = sp.m;
      const k = m.score > 0 ? 'pos' : m.score < 0 ? 'neg' : 'neu';
      const tip = `${m.layer === 'phrase' ? 'ER phrase' : m.layer === 'metric' ? 'Metric move' : 'Word'}: ${m.label} → ${signed(m.score, 2)}` +
        `${m.negated ? ' (negated)' : ''}${m.hedged ? ' (hedged)' : ''}${m.intensity !== 1 ? ` (×${m.intensity})` : ''}`;
      out += esc(s.text.slice(pos, sp.a)) + `<mark class="${k}" title="${esc(tip)}">${m.negated ? '¬' : ''}${esc(s.text.slice(sp.a, sp.b))}</mark>`;
      pos = sp.b;
    }
    return out + esc(s.text.slice(pos));
  }

  function renderSentences(reset) {
    if (!last) return;
    const doc = $('#ex-doc').value === 'prior' && last.prior ? last.prior : last.current;
    const f = $('#ex-filter').value;
    let list = doc.sentences.map((s, i) => ({ s, i }));
    if (f === 'impact') list = list.filter((x) => x.s.matches.length).sort((a, b) => Math.abs(b.s.net) - Math.abs(a.s.net));
    else if (f === 'neg') list = list.filter((x) => x.s.net < 0).sort((a, b) => a.s.net - b.s.net);
    else if (f === 'pos') list = list.filter((x) => x.s.net > 0).sort((a, b) => b.s.net - a.s.net);
    else if (f === 'scored') list = list.filter((x) => x.s.matches.length);
    if (reset) { shown = 0; $('#sentences').innerHTML = ''; }
    const page = list.slice(shown, shown + 40);
    shown += page.length;
    const html = page.map(({ s }) => {
      const tags = [];
      if (s.matches.some((m) => m.layer === 'phrase')) tags.push('<span class="tag">ER</span>');
      if (s.matches.some((m) => m.layer === 'metric')) tags.push('<span class="tag">M</span>');
      if (s.hedged) tags.push('<span class="tag">~</span>');
      if (s.forward) tags.push('<span class="tag">→</span>');
      const who = [s.speaker, s.part === 'qa' ? 'Q&A' : s.part === 'prepared' ? 'Prepared remarks' : ''].filter(Boolean).join(' · ');
      return `<div class="sent"><div class="sc ${cls(s.net)}">${s.matches.length ? signed(s.net, 1) : '·'}</div><div>${highlight(s)}<div class="meta">${tags.join('')}${esc(who)}</div></div></div>`;
    }).join('');
    $('#sentences').insertAdjacentHTML('beforeend', html || (reset ? '<p class="legend">No sentences match this filter.</p>' : ''));
    $('#ex-more').hidden = shown >= list.length;
  }

  // ---------------------------------------------------------------------------
  // Optional Loughran-McDonald dictionary
  //   1. Site owner: place data/lm-dictionary.json (see tools/convert_lm.py), auto-loaded.
  //   2. Visitor: upload the LM Master Dictionary CSV in "How the score works".
  // ---------------------------------------------------------------------------
  function applyLM(lists, source) {
    E.loadWordLists({ ...lists, source });
    $('#lm-status').textContent = `Loaded ${source}: ${lists.positive.length.toLocaleString()} positive, ${lists.negative.length.toLocaleString()} negative, ${(lists.uncertainty || []).length.toLocaleString()} uncertainty words.`;
    if (last) status('Word list changed. Press Analyze again to rescore.');
  }

  function parseLMcsv(text) {
    const lines = text.split(/\r?\n/);
    const head = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const iw = head.indexOf('word'), ip = head.indexOf('positive'), ineg = head.indexOf('negative'), iu = head.indexOf('uncertainty');
    if (iw < 0 || ip < 0 || ineg < 0) throw new Error('This does not look like the LM Master Dictionary CSV (needs Word, Positive, Negative columns).');
    const out = { positive: [], negative: [], uncertainty: [] };
    for (let i = 1; i < lines.length; i++) {
      const c = lines[i].split(',');
      if (!c[iw]) continue;
      const w = c[iw].trim().toLowerCase();
      if (c[ip] && c[ip].trim() !== '0') out.positive.push(w);
      if (c[ineg] && c[ineg].trim() !== '0') out.negative.push(w);
      if (iu >= 0 && c[iu] && c[iu].trim() !== '0') out.uncertainty.push(w);
    }
    return out;
  }

  $('#lm-file').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const t = await f.text();
      const lists = f.name.toLowerCase().endsWith('.json') ? JSON.parse(t) : parseLMcsv(t);
      applyLM(lists, 'Loughran-McDonald (uploaded)');
    } catch (err) { $('#lm-status').textContent = err.message; }
  });

  if (location.protocol.startsWith('http')) {
    fetch('data/lm-dictionary.json').then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) applyLM(j, 'Loughran-McDonald'); }).catch(() => {});
  }
})();
