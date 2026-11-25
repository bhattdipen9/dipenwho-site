/*
 * ER Sentiment Engine
 * -------------------
 * Pure JavaScript, no dependencies, runs in the browser. Nothing leaves the visitor's machine.
 *
 *   SentimentEngine.analyze(text, { docType, section, managementOnly })  -> result
 *   SentimentEngine.compare(currentResult, priorResult)                -> comparison
 *   SentimentEngine.loadWordLists({ positive, negative, uncertainty })  -> swap in LM dictionary
 */
(function (root) {
  'use strict';

  const L = root.ER_LEXICON || (typeof require !== 'undefined' ? require('./lexicon.js') : null);
  if (!L) throw new Error('lexicon.js must be loaded before engine.js');

  // ---------------------------------------------------------------------------
  // Text utilities
  // ---------------------------------------------------------------------------

  /** Light stemmer: enough to make raise/raised/raising and margin/margins line up. */
  function stem(w) {
    if (w.length <= 3) return w;
    if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
    if (w.endsWith('ing') && w.length > 5) w = w.slice(0, -3);
    else if (w.endsWith('ed') && w.length > 4) w = w.slice(0, -2);
    else if (w.endsWith('es') && w.length > 4 && !w.endsWith('ses')) w = w.slice(0, -2);
    else if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && w.length > 3) w = w.slice(0, -1);
    if (w.endsWith('e') && w.length > 3) w = w.slice(0, -1);
    return w;
  }

  /** Tokens with character offsets into the source string, for highlighting. */
  function tokenize(s) {
    const out = [];
    const re = /[A-Za-z0-9]+(?:['’][A-Za-z]+)?/g;
    let m;
    while ((m = re.exec(s))) {
      const raw = m[0].toLowerCase().replace(/['’]/g, '');
      out.push({ raw, stem: stem(raw), start: m.index, end: m.index + m[0].length });
    }
    return out;
  }

  const stemPhrase = (p) => tokenize(p).map((t) => t.stem);

  function normalizeText(t) {
    return t
      .replace(/\r\n?/g, '\n')
      .replace(/[‘’‛]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, ' - ')
      .replace(/ /g, ' ')
      .replace(/(\w)-\n(\w)/g, '$1$2'); // re-join words hyphenated across lines
  }

  /** Drop lines that are page furniture or table rows (mostly numbers). */
  function cleanLines(text) {
    let removed = 0;
    const kept = text.split('\n').filter((line) => {
      const l = line.trim();
      if (!l) return true;
      if (/^(page\s*)?\d+(\s*of\s*\d+)?$/i.test(l) || /^table of contents$/i.test(l)) { removed++; return false; }
      const digits = (l.match(/[\d$%(),.]/g) || []).length;
      const letters = (l.match(/[A-Za-z]/g) || []).length;
      if (l.length > 8 && digits > letters * 1.2) { removed++; return false; }
      return true;
    });
    return { text: kept.join('\n'), removed };
  }

  const ABBREV = /\b(Inc|Corp|Co|Ltd|LLC|Mr|Mrs|Ms|Dr|Jr|Sr|vs|approx|est|No|U\.S|e\.g|i\.e|etc|Q\d)\.$/i;

  function splitSentences(text) {
    const paragraphs = text.split(/\n\s*\n/);
    const out = [];
    for (const para of paragraphs) {
      const flat = para.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
      if (!flat) continue;
      const parts = flat.split(/(?<=[.!?])\s+(?=["(]?[A-Z0-9])/);
      let buf = '';
      for (const p of parts) {
        buf = buf ? buf + ' ' + p : p;
        if (ABBREV.test(buf)) continue; // "Acme Inc." is not a sentence end
        out.push(buf);
        buf = '';
      }
      if (buf) out.push(buf);
    }
    return out.filter((s) => tokenize(s).length >= 3);
  }

  // ---------------------------------------------------------------------------
  // Compiled lexicon (built once, rebuilt if word lists are swapped)
  // ---------------------------------------------------------------------------
  let C = null;
  const WEAK_MOVES = new Set(['growth', 'gain', 'up', 'down', 'expansion']);

  function buildIndex(entries) {
    // entries: [{ tokens:[stems], ...data }] -> Map(firstStem -> entries sorted longest first)
    const idx = new Map();
    for (const e of entries) {
      const k = e.tokens[0];
      if (!idx.has(k)) idx.set(k, []);
      idx.get(k).push(e);
    }
    for (const list of idx.values()) list.sort((a, b) => b.tokens.length - a.tokens.length);
    return idx;
  }

  function compile(wordLists) {
    const phrases = [];
    for (const [category, list] of Object.entries(L.PHRASES)) {
      for (const [text, weight] of list) phrases.push({ tokens: stemPhrase(text), text, weight, category });
    }
    const metrics = L.METRICS.map(([text, polarity, weight]) => ({ tokens: stemPhrase(text), text, polarity, weight }));
    const moves = L.MOVES.map(([text, type, strength]) => ({ tokens: stemPhrase(text), text, type, strength }));
    const wl = wordLists || L.WORDS;
    const toSet = (arr) => new Set(arr.map((w) => stem(w.toLowerCase())));
    const multi = (arr) => arr.filter((x) => x.includes(' ')).map(stemPhrase);
    C = {
      phraseIdx: buildIndex(phrases),
      metricIdx: buildIndex(metrics),
      moveIdx: buildIndex(moves),
      pos: toSet(wl.positive),
      neg: toSet(wl.negative),
      unc: toSet(wl.uncertainty),
      negations: new Set(L.NEGATIONS.filter((x) => !x.includes(' ')).map((w) => w)),
      negationPhrases: multi(L.NEGATIONS),
      intensifiers: new Map(Object.entries(L.INTENSIFIERS).map(([k, v]) => [stem(k), v])),
      hedges: new Set(L.HEDGES.filter((x) => !x.includes(' ')).map(stem)),
      hedgePhrases: multi(L.HEDGES),
      forward: new Set(L.FORWARD.filter((x) => !x.includes(' ')).map(stem)),
      forwardPhrases: multi(L.FORWARD),
      boilerplate: L.BOILERPLATE.map((b) => ' ' + stemPhrase(b).join(' ') + ' '),
      stop: new Set(L.STOPWORDS.map(stem)),
      wordSource: wordLists ? 'Loughran-McDonald' : 'Built-in starter list',
    };
  }
  compile(null);

  function loadWordLists(lists) {
    if (!lists || !lists.positive || !lists.negative) throw new Error('Expected { positive, negative, uncertainty }');
    compile({ positive: lists.positive, negative: lists.negative, uncertainty: lists.uncertainty || L.WORDS.uncertainty });
    C.wordSource = lists.source || 'Loughran-McDonald';
  }

  function matchAt(idx, toks, i, used) {
    const cands = idx.get(toks[i].stem);
    if (!cands) return null;
    for (const c of cands) {
      const n = c.tokens.length;
      if (i + n > toks.length) continue;
      let ok = true;
      for (let k = 0; k < n; k++) {
        if (used[i + k] || toks[i + k].stem !== c.tokens[k]) { ok = false; break; }
      }
      if (ok) return { entry: c, start: i, end: i + n - 1 };
    }
    return null;
  }

  function containsSeq(stems, seq) {
    outer: for (let i = 0; i + seq.length <= stems.length; i++) {
      for (let k = 0; k < seq.length; k++) if (stems[i + k] !== seq[k]) continue outer;
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Sentence scoring
  // ---------------------------------------------------------------------------

  function modifiersBefore(toks, start, floor) {
    let negated = false, mult = 1;
    for (let j = start - 1; j >= Math.max(floor, start - L.NEGATION_WINDOW); j--) {
      const r = toks[j].raw;
      if (C.negations.has(r)) {
        // "not only ... but" is emphasis, not negation
        if (r === 'not' && toks[j + 1] && toks[j + 1].raw === 'only') continue;
        negated = true;
      }
      if (r === 'yet' && toks[j - 1] && toks[j - 1].raw === 'not') negated = true;
    }
    for (let j = start - 1; j >= Math.max(floor, start - L.INTENSIFIER_WINDOW); j--) {
      const v = C.intensifiers.get(toks[j].stem);
      if (v) { mult *= v; break; }
    }
    return { negated, mult };
  }

  function scoreSentence(text) {
    const toks = tokenize(text);
    const stems = toks.map((t) => t.stem);
    const used = new Array(toks.length).fill(false);
    const matches = [];

    const hedged = stems.some((s) => C.hedges.has(s)) || C.hedgePhrases.some((p) => containsSeq(stems, p));
    const forward = stems.some((s) => C.forward.has(s)) || C.forwardPhrases.some((p) => containsSeq(stems, p));

    function finalize(m, base, floor, extraNegation) {
      const mod = modifiersBefore(toks, m.spanStart, floor);
      const negated = mod.negated !== !!extraNegation; // two negations cancel
      const mult = mod.mult;
      let score = base * mult;
      if (negated) score *= L.NEGATION_FACTOR;
      if (hedged) score *= L.HEDGE_FACTOR;
      m.base = base;
      m.score = Math.round(score * 100) / 100;
      m.negated = negated;
      m.hedged = hedged;
      m.intensity = mult;
      matches.push(m);
    }

    // ---- Layer 1: ER phrases ------------------------------------------------
    for (let i = 0; i < toks.length; i++) {
      if (used[i]) continue;
      const hit = matchAt(C.phraseIdx, toks, i, used);
      if (!hit) continue;
      for (let k = hit.start; k <= hit.end; k++) used[k] = true;
      finalize({
        layer: 'phrase', key: hit.entry.text, label: hit.entry.text, category: hit.entry.category,
        spans: [[toks[hit.start].start, toks[hit.end].end]], spanStart: hit.start,
      }, hit.entry.weight, 0);
      i = hit.end;
    }

    // ---- Layer 2: metric x move ---------------------------------------------
    const metricHits = [];
    for (let i = 0; i < toks.length; i++) {
      if (used[i]) continue;
      const hit = matchAt(C.metricIdx, toks, i, used);
      if (!hit) continue;
      metricHits.push(hit);
      for (let k = hit.start; k <= hit.end; k++) used[k] = true;
      i = hit.end;
    }
    for (const mh of metricHits) {
      let best = null;
      const lo = Math.max(0, mh.start - L.WINDOW), hi = Math.min(toks.length - 1, mh.end + L.WINDOW);
      for (let j = lo; j <= hi; j++) {
        if (used[j]) continue;
        const mv = matchAt(C.moveIdx, toks, j, used);
        if (!mv) continue;
        let dist = j < mh.start ? mh.start - mv.end : j - mh.end;
        // "growth" is often a noun followed by the real verb: "ARR growth decelerated"
        if (WEAK_MOVES.has(mv.entry.text)) dist += 3;
        if (!best || dist < best.dist) best = { ...mv, dist };
      }
      if (!best) { for (let k = mh.start; k <= mh.end; k++) used[k] = false; continue; } // free tokens for word layer
      for (let k = best.start; k <= best.end; k++) used[k] = true;
      const mv = best.entry, met = mh.entry;
      let sign;
      if (mv.type === 'up') sign = met.polarity;
      else if (mv.type === 'down') sign = -met.polarity;
      else sign = mv.type === 'good' ? 1 : -1;
      if (met.weight === 0) continue;
      const dirLabel = mv.type === 'up' ? '↑' : mv.type === 'down' ? '↓' : mv.type === 'good' ? '✓' : '✗';
      const first = Math.min(mh.start, best.start);
      // modifiers may sit between the two words ("margin significantly compressed")
      // a diminisher right after the pair also counts: "churn increased modestly"
      const after = toks[Math.max(mh.end, best.end) + 1];
      let between = after && C.intensifiers.get(after.stem) && C.intensifiers.get(after.stem) < 1 ? C.intensifiers.get(after.stem) : 1;
      let negBetween = false;
      for (let j = Math.min(mh.end, best.end) + 1; j < Math.max(mh.start, best.start); j++) {
        const v = C.intensifiers.get(toks[j].stem);
        if (v) between = v;
        if (C.negations.has(toks[j].raw)) negBetween = true;
      }
      finalize({
        layer: 'metric',
        key: `${met.text}: ${sign > 0 ? 'improving' : 'worsening'}`,
        label: `${met.text} ${dirLabel} ${toks[best.start].raw}${best.end > best.start ? ' ' + toks[best.end].raw : ''}`,
        category: 'metric',
        spans: [[toks[mh.start].start, toks[mh.end].end], [toks[best.start].start, toks[best.end].end]],
        spanStart: first,
      }, sign * met.weight * mv.strength * between, 0, negBetween);
    }

    // ---- Layer 3: single words ----------------------------------------------
    let uncertainty = 0;
    for (let i = 0; i < toks.length; i++) {
      const s = toks[i].stem;
      if (C.unc.has(s) || C.unc.has(toks[i].raw)) uncertainty++;
      if (used[i]) continue;
      const isPos = C.pos.has(s) || C.pos.has(toks[i].raw);
      const isNeg = C.neg.has(s) || C.neg.has(toks[i].raw);
      if (!isPos && !isNeg) continue;
      used[i] = true;
      finalize({
        layer: 'word', key: toks[i].raw, label: toks[i].raw, category: 'word',
        spans: [[toks[i].start, toks[i].end]], spanStart: i,
      }, isPos ? 1 : -1, 0);
    }

    let pos = 0, neg = 0;
    for (const m of matches) { if (m.score > 0) pos += m.score; else neg -= m.score; }
    matches.sort((a, b) => a.spans[0][0] - b.spans[0][0]);
    return { text, words: toks.length, stems, matches, pos, neg, net: pos - neg, uncertainty, hedged, forward };
  }

  // ---------------------------------------------------------------------------
  // Document structure: doc type, MD&A extraction, transcript speakers
  // ---------------------------------------------------------------------------

  function detectDocType(text) {
    const head = text.slice(0, 200000);
    if (/\boperator\b/i.test(head) && /(question[- ]and[- ]answer|q\s*&\s*a|questions and answers|first question)/i.test(head)) return 'transcript';
    if (/management['’]s discussion and analysis/i.test(head) || /\bform 10-?[kq]\b/i.test(head)) return 'filing';
    return 'news';
  }

  function extractMDA(text) {
    const startRe = /item\s*[27]\.?\s*[-:–—]?\s*management['’]s\s+discussion\s+and\s+analysis/gi;
    const altStart = /management['’]s\s+discussion\s+and\s+analysis\s+of\s+financial\s+condition/gi;
    const endRe = /item\s*(7a|3|8)\.?\s*[-:–—]?\s*(quantitative\s+and\s+qualitative|financial\s+statements)|quantitative\s+and\s+qualitative\s+disclosures?\s+about\s+market\s+risk/gi;
    const starts = [];
    let m;
    for (const re of [startRe, altStart]) { re.lastIndex = 0; while ((m = re.exec(text))) starts.push(m.index); }
    let best = null;
    for (const s of starts) {
      endRe.lastIndex = s + 200;
      const e = endRe.exec(text);
      const end = e ? e.index : Math.min(text.length, s + 400000);
      if (!best || end - s > best.end - best.start) best = { start: s, end };
    }
    if (best && best.end - best.start > 3000) return { text: text.slice(best.start, best.end), found: true };
    return { text, found: false };
  }

  const SPEAKER_RE = /^([A-Z][A-Za-z.'\- ]{1,48}?)\s*(?:(?:-{1,2}|–|—|,|:)\s*(.{0,90}))?$/;

  function parseTranscript(text) {
    const lines = text.split('\n');
    const segs = [];
    let cur = null, part = 'prepared';
    const mgmt = new Set();
    const qaHeader = /^(question[- ]and[- ]answer|questions and answers|q\s*&\s*a)(\s+session)?\s*:?$/i;

    const isSpeakerLine = (l, next) => {
      if (l.length > 110 || /[.?!]$/.test(l)) return false;
      const words = l.split(/\s+/).length;
      if (words > 14) return false;
      if (/^operator\s*:?$/i.test(l)) return true;
      const m = l.match(SPEAKER_RE);
      if (!m) return false;
      const name = m[1].trim();
      const nameWords = name.split(/\s+/);
      if (nameWords.length < 2 || nameWords.length > 5) return false;
      if (!nameWords.every((w) => /^[A-Z]/.test(w) || /^(de|van|von|da|la|le)$/i.test(w))) return false;
      if (/\b(highlights|overview|results|outlook|summary|section|presentation|remarks|session|statements|discussion|guidance|quarter|fiscal|financial|table|item|part|note)\b/i.test(name)) return false;
      // A title after the name must look like a job title or firm, not wrapped prose ("North America, as customers…")
      const title = (m[2] || '').trim();
      if (title) {
        const titleish = /\b(officer|president|chair(man|woman|person)?|ceo|cfo|coo|cto|evp|svp|vp|director|head|relations|treasurer|controller|founder|analyst|research|securities|capital|partners|bank|llc|inc|group|& co|markets|advisors|management)\b/i;
        if (!titleish.test(title) && !/^[A-Z]/.test(title)) return false;
        if (!titleish.test(title) && title.split(/\s+/).length > 6) return false;
      }
      // Inline "Name: text" format is handled separately; a speaker line must be followed by text
      return !!next;
    };

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].trim();
      if (!l) { if (cur) cur.lines.push(''); continue; }
      if (qaHeader.test(l)) { part = 'qa'; continue; }
      // "Jane Doe: Thanks, operator..." inline format
      const inline = l.match(/^([A-Z][A-Za-z.'\-]+(?:\s+[A-Z][A-Za-z.'\-]+){0,3})\s*:\s+(.{20,})$/);
      const next = lines.slice(i + 1).find((x) => x.trim());
      if (inline || isSpeakerLine(l, next)) {
        const head = inline ? inline[1] : l;
        const m = head.match(SPEAKER_RE) || [head, head, ''];
        const name = (m[1] || head).trim();
        const title = (m[2] || '').trim();
        let role;
        if (/^operator$/i.test(name)) role = 'operator';
        else if (/analyst|research|securities|capital markets|partners|bank|llc|& co/i.test(title)) role = 'analyst';
        else if (/(ceo|cfo|coo|cto|chief|president|chair|officer|vice president|vp|director|head of|treasurer|controller|investor relations|founder)/i.test(title)) role = 'management';
        else if (part === 'prepared') role = 'management';
        else role = mgmt.has(name) ? 'management' : 'analyst';
        if (role === 'management') mgmt.add(name);
        if (/first question|next question|question comes from/i.test(inline ? inline[2] : '') && role === 'operator') part = 'qa';
        cur = { speaker: name, role, part, lines: inline ? [inline[2]] : [] };
        segs.push(cur);
        continue;
      }
      if (!cur) { cur = { speaker: 'Unknown', role: 'management', part, lines: [] }; segs.push(cur); }
      if (cur.role === 'operator' && /(first|next) question|question comes from/i.test(l)) part = 'qa';
      cur.lines.push(l);
    }
    // Re-tag segments: once Q&A starts, everything after is Q&A
    let inQA = false;
    for (const s of segs) {
      if (s.part === 'qa') inQA = true;
      if (inQA) s.part = 'qa';
      if (s.part === 'qa' && s.role !== 'operator' && !mgmt.has(s.speaker) && s.role !== 'management') s.role = 'analyst';
    }
    const speakers = new Set(segs.map((s) => s.speaker)).size;
    return { segments: segs, detected: speakers >= 2 };
  }

  // ---------------------------------------------------------------------------
  // analyze()
  // ---------------------------------------------------------------------------

  function isBoilerplate(stems) {
    const s = ' ' + stems.join(' ') + ' ';
    return C.boilerplate.some((b) => s.includes(b));
  }

  function analyze(rawText, opts = {}) {
    const t0 = Date.now();
    const text = normalizeText(rawText || '');
    const docType = !opts.docType || opts.docType === 'auto' ? detectDocType(text) : opts.docType;
    const notes = [];

    // Build the list of {text, part, speaker, role} blocks to score
    let blocks = [];
    let sectionUsed = 'Full text';
    if (docType === 'filing' && opts.section !== 'full') {
      const mda = extractMDA(text);
      if (mda.found) { sectionUsed = 'MD&A'; blocks.push({ text: mda.text, part: 'body', role: 'management' }); }
      else { notes.push('MD&A section not found; scored the full text.'); blocks.push({ text, part: 'body', role: 'management' }); }
    } else if (docType === 'transcript') {
      const tr = parseTranscript(text);
      if (tr.detected) {
        sectionUsed = opts.managementOnly === false ? 'All speakers' : 'Management remarks only';
        for (const s of tr.segments) {
          if (s.role === 'operator') continue;
          if (opts.managementOnly !== false && s.role !== 'management') continue;
          blocks.push({ text: s.lines.join('\n'), part: s.part, speaker: s.speaker, role: s.role });
        }
        const analysts = new Set(tr.segments.filter((s) => s.role === 'analyst').map((s) => s.speaker));
        if (analysts.size) notes.push(`Excluded ${analysts.size} analyst speaker(s) from tone.`);
      } else {
        notes.push('Could not identify speakers; scored the full transcript.');
        blocks.push({ text, part: 'body', role: 'management' });
      }
    } else {
      blocks.push({ text, part: 'body', role: 'management' });
    }

    const sentences = [];
    let boilerplateRemoved = 0, linesRemoved = 0;
    for (const b of blocks) {
      const cl = cleanLines(b.text);
      linesRemoved += cl.removed;
      for (const s of splitSentences(cl.text)) {
        const sc = scoreSentence(s);
        if (isBoilerplate(sc.stems)) { boilerplateRemoved++; continue; }
        sc.part = b.part; sc.speaker = b.speaker; sc.role = b.role;
        sentences.push(sc);
      }
    }
    if (boilerplateRemoved) notes.push(`Removed ${boilerplateRemoved} boilerplate sentence(s) (safe harbor, call logistics).`);
    if (linesRemoved) notes.push(`Skipped ${linesRemoved} table/page-number line(s).`);

    const result = summarize(sentences);
    result.meta = {
      docType, sectionUsed, notes, wordSource: C.wordSource,
      sentences: sentences.length, ms: Date.now() - t0,
    };
    result.sentences = sentences;
    return result;
  }

  function toneOf(list) {
    let pos = 0, neg = 0, words = 0, unc = 0;
    for (const s of list) { pos += s.pos; neg += s.neg; words += s.words; unc += s.uncertainty; }
    return {
      pos, neg, words, uncertainty: unc,
      net: pos + neg > 0 ? (pos - neg) / (pos + neg) : 0,
      density: words ? ((pos - neg) / words) * 1000 : 0,
      uncertaintyPer1k: words ? (unc / words) * 1000 : 0,
    };
  }

  function summarize(sentences) {
    const overall = toneOf(sentences);
    const forward = toneOf(sentences.filter((s) => s.forward));
    const backward = toneOf(sentences.filter((s) => !s.forward));
    const prepared = toneOf(sentences.filter((s) => s.part === 'prepared'));
    const qa = toneOf(sentences.filter((s) => s.part === 'qa'));
    const hedgedShare = sentences.length ? sentences.filter((s) => s.hedged).length / sentences.length : 0;

    const drivers = new Map();
    const layerTotals = { phrase: 0, metric: 0, word: 0 };
    for (const s of sentences) {
      for (const m of s.matches) {
        layerTotals[m.layer] += Math.abs(m.score);
        const d = drivers.get(m.key) || { key: m.key, label: m.label, layer: m.layer, category: m.category, count: 0, total: 0 };
        d.count++; d.total += m.score;
        if (m.layer === 'metric') d.label = m.key; // aggregate label
        drivers.set(m.key, d);
      }
    }
    const all = [...drivers.values()].map((d) => ({ ...d, total: Math.round(d.total * 100) / 100 }));
    return {
      overall, forward, backward, prepared, qa, hedgedShare, layerTotals,
      drivers: all,
      topPositive: all.filter((d) => d.total > 0).sort((a, b) => b.total - a.total).slice(0, 12),
      topNegative: all.filter((d) => d.total < 0).sort((a, b) => a.total - b.total).slice(0, 12),
      score: Math.round(overall.net * 100),
      label: labelFor(overall.net),
    };
  }

  function labelFor(net) {
    if (net >= 0.5) return 'Very positive';
    if (net >= 0.2) return 'Positive';
    if (net > -0.2) return 'Neutral / mixed';
    if (net > -0.5) return 'Negative';
    return 'Very negative';
  }

  // ---------------------------------------------------------------------------
  // compare(current, prior)
  // ---------------------------------------------------------------------------

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Bootstrap the difference in net tone by resampling sentences. */
  function bootstrapDiff(a, b, iters = 1000) {
    if (a.length < 5 || b.length < 5) return null;
    const rnd = mulberry32(42);
    const net = (arr, n) => {
      let p = 0, q = 0;
      for (let i = 0; i < n; i++) { const s = arr[(rnd() * arr.length) | 0]; p += s.pos; q += s.neg; }
      return p + q > 0 ? (p - q) / (p + q) : 0;
    };
    const diffs = [];
    for (let i = 0; i < iters; i++) diffs.push(net(a, a.length) - net(b, b.length));
    diffs.sort((x, y) => x - y);
    const lo = diffs[Math.floor(iters * 0.025)], hi = diffs[Math.floor(iters * 0.975)];
    const below = diffs.filter((d) => d <= 0).length / iters;
    const pTwoSided = Math.min(1, 2 * Math.min(below, 1 - below));
    return { lo, hi, p: pTwoSided, significant: lo > 0 || hi < 0 };
  }

  function cosineSimilarity(a, b) {
    const vec = (sents) => {
      const m = new Map();
      for (const s of sents) for (const st of s.stems) {
        if (st.length < 3 || C.stop.has(st) || /^\d+$/.test(st)) continue;
        m.set(st, (m.get(st) || 0) + 1);
      }
      return m;
    };
    const va = vec(a), vb = vec(b);
    let dot = 0, na = 0, nb = 0;
    for (const [k, v] of va) { na += v * v; if (vb.has(k)) dot += v * vb.get(k); }
    for (const v of vb.values()) nb += v * v;
    return na && nb ? dot / Math.sqrt(na * nb) : 0;
  }

  function compare(cur, prev) {
    const d = (x, y) => x - y;
    const deltas = {
      net: d(cur.overall.net, prev.overall.net),
      score: cur.score - prev.score,
      density: d(cur.overall.density, prev.overall.density),
      uncertainty: d(cur.overall.uncertaintyPer1k, prev.overall.uncertaintyPer1k),
      forward: d(cur.forward.net, prev.forward.net),
      backward: d(cur.backward.net, prev.backward.net),
      hedged: d(cur.hedgedShare, prev.hedgedShare),
    };
    const boot = bootstrapDiff(cur.sentences, prev.sentences);
    const similarity = cosineSimilarity(cur.sentences, prev.sentences);

    // Phrase diff, normalised per 10,000 words so different lengths compare fairly
    const per10k = (doc, key) => {
      const dr = doc.drivers.find((x) => x.key === key);
      return dr ? (dr.count / Math.max(1, doc.overall.words)) * 10000 : 0;
    };
    const keys = new Set([...cur.drivers, ...prev.drivers].filter((x) => x.layer !== 'word' || Math.abs(x.total) >= 2).map((x) => x.key));
    const appeared = [], disappeared = [], changed = [];
    for (const k of keys) {
      const c = cur.drivers.find((x) => x.key === k);
      const p = prev.drivers.find((x) => x.key === k);
      if (c && !p) appeared.push(c);
      else if (p && !c) disappeared.push(p);
      else if (c && p && Math.sign(c.total) !== Math.sign(p.total) && c.total !== 0 && p.total !== 0) {
        // same phrase, opposite sign: "free cash flow positive" -> "no longer free cash flow positive"
        changed.push({ key: k, label: c.label, layer: c.layer, prevCount: p.count, curCount: c.count, ratio: 1,
          weight: c.total / c.count, flipped: true, prevTotal: p.total, curTotal: c.total });
      } else if (c && p) {
        const rc = per10k(cur, k), rp = per10k(prev, k);
        const ratio = (rc + 1) / (rp + 1);
        if ((ratio >= 1.75 || ratio <= 0.57) && c.count + p.count >= 3) {
          changed.push({ key: k, label: c.label, layer: c.layer, prevCount: p.count, curCount: c.count, ratio, weight: c.total / c.count });
        }
      }
    }
    const byImpact = (a, b) => Math.abs(b.total) - Math.abs(a.total);
    appeared.sort(byImpact); disappeared.sort(byImpact);
    const shiftRank = (x) => (x.flipped ? 100 + Math.abs(x.curTotal - x.prevTotal) : Math.abs(Math.log(x.ratio)) * Math.abs(x.weight));
    changed.sort((a, b) => shiftRank(b) - shiftRank(a));

    const result = {
      deltas, bootstrap: boot, similarity,
      appeared: appeared.slice(0, 15), disappeared: disappeared.slice(0, 15), changed: changed.slice(0, 15),
    };
    result.summary = writeSummary(cur, prev, result);
    return result;
  }

  // ---------------------------------------------------------------------------
  // Template-based analyst summary (no AI needed)
  // ---------------------------------------------------------------------------

  const fmt = (x, dp = 2) => (x >= 0 ? '+' : '') + x.toFixed(dp);
  const quote = (s) => `“${s}”`;

  function describeSingle(r) {
    const out = [];
    out.push(`Overall management tone is ${r.label.toLowerCase()} (score ${r.score > 0 ? '+' : ''}${r.score} on a −100 to +100 scale).`);
    if (r.topPositive.length) out.push(`Biggest positives: ${r.topPositive.slice(0, 3).map((d) => quote(d.label)).join(', ')}.`);
    if (r.topNegative.length) out.push(`Biggest negatives: ${r.topNegative.slice(0, 3).map((d) => quote(d.label)).join(', ')}.`);
    if (r.forward.words > 200 && r.backward.words > 200) {
      const gap = r.forward.net - r.backward.net;
      if (Math.abs(gap) >= 0.15) {
        out.push(gap > 0
          ? 'Forward-looking statements are more upbeat than commentary on reported results, so management is leaning on the outlook.'
          : 'Forward-looking statements are more cautious than commentary on reported results, which is a possible early sign of softer guidance.');
      }
    }
    if (r.prepared.words > 200 && r.qa.words > 200) {
      const gap = r.qa.net - r.prepared.net;
      if (gap <= -0.15) out.push('Tone drops in Q&A versus prepared remarks. Unscripted answers are less confident than the script.');
      else if (gap >= 0.15) out.push('Tone in Q&A is stronger than in prepared remarks.');
    }
    if (r.hedgedShare > 0.3) out.push(`${Math.round(r.hedgedShare * 100)}% of sentences are hedged (may / could / potentially).`);
    return out;
  }

  function writeSummary(cur, prev, cmp) {
    const out = [];
    const dir = cmp.deltas.score > 0 ? 'improved' : 'deteriorated';
    const sig = cmp.bootstrap
      ? (cmp.bootstrap.significant ? 'a statistically meaningful change' : 'within the normal noise range')
      : 'too few sentences to test significance';
    if (Math.abs(cmp.deltas.score) < 3) out.push(`Tone is essentially unchanged versus the prior document (${fmt(cmp.deltas.score, 0)} pts; ${sig}).`);
    else out.push(`Tone ${dir} by ${Math.abs(cmp.deltas.score)} pts (${prev.score} → ${cur.score}), ${sig}.`);

    const negNew = cmp.appeared.filter((x) => x.total < 0).slice(0, 3);
    const posNew = cmp.appeared.filter((x) => x.total > 0).slice(0, 3);
    const posGone = cmp.disappeared.filter((x) => x.total > 0).slice(0, 3);
    const negGone = cmp.disappeared.filter((x) => x.total < 0).slice(0, 3);
    for (const f of cmp.changed.filter((x) => x.flipped).slice(0, 2)) {
      out.push(f.curTotal < 0
        ? `${quote(f.label)} flipped from positive to negative or negated (${fmt(f.prevTotal, 1)} → ${fmt(f.curTotal, 1)}).`
        : `${quote(f.label)} flipped from negative to positive (${fmt(f.prevTotal, 1)} → ${fmt(f.curTotal, 1)}).`);
    }
    if (negNew.length) out.push(`New negative language: ${negNew.map((x) => quote(x.label)).join(', ')}.`);
    if (posGone.length) out.push(`Positive language that disappeared: ${posGone.map((x) => quote(x.label)).join(', ')}.`);
    if (posNew.length) out.push(`New positive language: ${posNew.map((x) => quote(x.label)).join(', ')}.`);
    if (negGone.length) out.push(`Negative language no longer present: ${negGone.map((x) => quote(x.label)).join(', ')}.`);
    const up = cmp.changed.filter((c) => !c.flipped && c.ratio > 1).slice(0, 2);
    for (const c of up) out.push(`${quote(c.label)} mentioned more often (${c.prevCount} → ${c.curCount}).`);

    if (Math.abs(cmp.deltas.forward) >= 0.15 && cur.forward.words > 150 && prev.forward.words > 150) {
      out.push(`Forward-looking tone ${cmp.deltas.forward > 0 ? 'improved' : 'weakened'} (${fmt(cmp.deltas.forward)} net tone), which is the part most relevant to estimates.`);
    }
    if (cmp.deltas.uncertainty >= 3) out.push(`Uncertainty language rose (${fmt(cmp.deltas.uncertainty, 1)} words per 1,000).`);
    if (cmp.similarity < 0.6) out.push(`Language changed substantially from the prior document (similarity ${Math.round(cmp.similarity * 100)}%). Large rewrites are worth reading closely.`);
    return out;
  }

  root.SentimentEngine = {
    analyze, compare, loadWordLists, describeSingle,
    _internals: { stem, tokenize, splitSentences, scoreSentence, detectDocType, extractMDA, parseTranscript },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.SentimentEngine;
})(typeof window !== 'undefined' ? window : globalThis);
