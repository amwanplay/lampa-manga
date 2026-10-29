/**
 * LampaManga Omnivorous Core Plugin v10.0
 * Поддержка 8 балансеров: MangaLib, ReManga, Desu, MangaDex, ReadManga/Usagi, Senkuro, MangaBuff/WaManga, Mangalun
 */
(function () {
  'use strict';

  const PLUGIN_VERSION = '10.0.0';

  const SOURCES = [
    { id: 'mangalib',  short: 'MangaLib',  name: 'MangaLib (CDNLibs)' },
    { id: 'remanga',   short: 'ReManga',   name: 'ReManga' },
    { id: 'desu',      short: 'Desu',      name: 'Desu.win / Desu.me' },
    { id: 'mangadex',  short: 'MangaDex',  name: 'MangaDex (RU/EN)' },
    { id: 'readmanga', short: 'ReadManga', name: 'ReadManga / Usagi' },
    { id: 'wamanga',   short: 'WaManga',   name: 'MangaBuff / WaManga' },
    { id: 'senkuro',   short: 'Senkuro',   name: 'Senkuro' },
    { id: 'mangalun',  short: 'Mangalun',  name: 'Mangalun CDN' }
  ];

  const TITLE_ALIASES = {
    'поднятие уровня в одиночку': ['Я один повышаю уровень', 'Solo Leveling', 'Ore dake Level Up na Ken', 'Na Honjaman Level Up'],
    'я один повышаю уровень': ['Поднятие уровня в одиночку', 'Solo Leveling'],
    'расхититель гробниц': ['Король расхитителей гробниц', 'Великий расхититель гробниц', 'Tomb Raider King', 'Dogulwang'],
    'всеведущий читатель': ['Точка зрения всеведущего читателя', 'Omniscient Reader', "Omniscient Reader's Viewpoint", 'Jeonjijeok Dokja Sijeom'],
    'начало после конца': ['Сильнейший король: что же ты будешь делать во второй жизни?', 'The Beginning After the End', 'TBATE'],
    'синяя тюрьма: блю лок': ['Блю Лок', 'Синяя тюрьма', 'Blue Lock'],
    'блю лок': ['Синяя тюрьма: Блю Лок', 'Синяя тюрьма', 'Blue Lock'],
    'магическая битва': ['Jujutsu Kaisen', 'Sorcery Fight'],
    'человек-бензопила': ['Человек бензопила', 'Chainsaw Man'],
    'ван пис': ['Большой куш', 'One Piece'],
    'большой куш': ['Ван Пис', 'One Piece'],
    'башня бога': ['Tower of God', 'Sin-ui Tap'],
    'возвращение героя уровня катастрофы': ['Возвращение героя катастрофы', 'The Return of the Disaster-Class Hero'],
    'ранкер, который живёт второй раз': ['Ранкер который живет второй раз', 'Second Life Ranker'],
    'легенда о северном клинке': ['Клинок северного ветра', 'Legend of the Northern Blade'],
    'восхождение в тени': ['Восхождение в тени!', 'The Eminence in Shadow', 'Kage no Jitsuryokusha ni Naritakute']
  };

  function normStr(s) {
    return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]/gi, '');
  }

  function stripSubtitles(s) {
    return String(s || '')
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\([^\)]*\)/g, ' ')
      .replace(/\b(манхва|манга|маньхуа|новелла|ранобэ|вебтун|webtoon|novel|light novel|часть\s*\d+|сезон\s*\d+|part\s*\d+|season\s*\d+)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokenize(s) {
    return stripSubtitles(s)
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^a-zа-я0-9\s]/gi, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2);
  }

  function translitRuToSlug(str) {
    const map = {
      а:'a', б:'b', в:'v', г:'g', д:'d', е:'e', ё:'yo', ж:'zh', з:'z', и:'i', й:'y',
      к:'k', л:'l', м:'m', н:'n', о:'o', п:'p', р:'r', с:'s', т:'t', у:'u', ф:'f',
      х:'h', ц:'c', ч:'ch', ш:'sh', щ:'shch', ъ:'', ы:'y', ь:'', э:'e', ю:'yu', я:'ya'
    };
    return String(str || '').toLowerCase().split('').map(ch => (map[ch] !== undefined ? map[ch] : ch)).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function buildSearchQueries(manga) {
    const rawList = [
      manga.title,
      stripSubtitles(manga.title),
      manga.engTitle,
      manga.origTitle,
      manga.romajiTitle,
      ...(Array.isArray(manga.synonyms) ? manga.synonyms : []),
      ...(Array.isArray(manga.otherNames) ? manga.otherNames : [])
    ];
    const lowerTitle = String(manga.title || '').toLowerCase().replace(/ё/g, 'е').trim();
    for (const [k, aliases] of Object.entries(TITLE_ALIASES)) {
      if (lowerTitle.includes(k) || k.includes(lowerTitle)) rawList.push(...aliases);
    }
    if (manga.title && manga.title.includes(':')) {
      manga.title.split(':').forEach(p => { if (p.trim().length >= 4) rawList.push(p.trim()); });
    }
    const seen = new Set();
    const out = [];
    for (const item of rawList) {
      const clean = String(item || '').trim();
      if (!clean || clean.length < 2 || !/[a-zа-я0-9]/i.test(clean)) continue;
      const key = normStr(clean);
      if (key.length < 2 || seen.has(key)) continue;
      seen.add(key);
      out.push(clean);
    }
    return out.slice(0, 6);
  }

  function scoreCandidate(manga, candidateNames, candYear, isNovelCandidate = false) {
    const wantNovel = /ранобэ|новелла|novel/i.test(manga.kind || '') || /novel/i.test(manga.rawKind || '');
    if (isNovelCandidate && !wantNovel) return 0;

    const targetStrings = buildSearchQueries(manga);
    const targetNorms = targetStrings.map(normStr).filter(Boolean);
    const targetStripped = targetStrings.map(s => normStr(stripSubtitles(s))).filter(Boolean);
    const targetTokenSets = targetStrings.map(tokenize).filter(arr => arr.length > 0);
    const candStrings = (candidateNames || []).map(s => String(s || '').trim()).filter(Boolean);
    if (!candStrings.length) return 0;

    for (const cs of candStrings) {
      if (!wantNovel && /\((новелла|ранобэ|novel|light novel)\)/i.test(cs)) return 0;
    }

    let bestScore = 0;
    for (const cand of candStrings) {
      const cn = normStr(cand);
      const cnStripped = normStr(stripSubtitles(cand));
      if (!cn) continue;

      for (const tn of targetNorms) {
        if (cn === tn) bestScore = Math.max(bestScore, 100);
        else if (cn.length >= 5 && tn.length >= 5 && (cn.includes(tn) || tn.includes(cn))) {
          const ratio = Math.min(cn.length, tn.length) / Math.max(cn.length, tn.length);
          if (ratio >= 0.5) bestScore = Math.max(bestScore, Math.round(78 + ratio * 16));
        }
      }
      for (const tsn of targetStripped) {
        if (cnStripped && tsn && cnStripped === tsn) bestScore = Math.max(bestScore, 95);
      }

      const cTokens = tokenize(cand);
      if (cTokens.length > 0) {
        for (const tTokens of targetTokenSets) {
          const setA = new Set(tTokens);
          const setB = new Set(cTokens);
          let inter = 0;
          for (const w of setA) {
            if (setB.has(w)) inter++;
            else {
              for (const wb of setB) {
                if (w.length >= 4 && wb.length >= 4 && (w.startsWith(wb) || wb.startsWith(w))) {
                  inter += 0.85;
                  break;
                }
              }
            }
          }
          const dice = (2 * inter) / (setA.size + setB.size);
          if (dice >= 0.55) bestScore = Math.max(bestScore, Math.round(55 + dice * 38));
        }
      }
    }

    if (bestScore > 0 && manga.year && candYear) {
      const y1 = parseInt(manga.year, 10);
      const y2 = parseInt(String(candYear).slice(0, 4), 10);
      if (!isNaN(y1) && !isNaN(y2)) {
        if (Math.abs(y1 - y2) <= 1) bestScore = Math.min(100, bestScore + 5);
        else if (Math.abs(y1 - y2) >= 5 && bestScore < 92) bestScore -= 12;
      }
    }
    return bestScore;
  }

  function pickBestMatch(manga, items, extractor) {
    let bestItem = null;
    let bestScore = 0;
    for (let i = 0; i < items.length; i++) {
      const info = extractor(items[i]);
      let sc = scoreCandidate(manga, info.names, info.year, info.isNovel);
      if (sc >= 50 && i === 0) sc += 4;
      if (sc > bestScore) { bestScore = sc; bestItem = items[i]; }
    }
    return bestScore >= 54 ? bestItem : null;
  }

  function deduplicateChapters(chapters) {
    const map = new Map();
    for (const ch of chapters) {
      const key = `${ch.volume}_${ch.number}`;
      if (!map.has(key)) map.set(key, ch);
    }
    return Array.from(map.values()).sort((a, b) => {
      const vA = parseFloat(a.volume) || 1;
      const vB = parseFloat(b.volume) || 1;
      if (vA !== vB) return vA - vB;
      const nA = parseFloat(String(a.number).replace(/[^0-9.-]/g, '')) || 0;
      const nB = parseFloat(String(b.number).replace(/[^0-9.-]/g, '')) || 0;
      return nA - nB;
    });
  }

  function formatDateRu(rawDate) {
    if (!rawDate) return '';
    try {
      const d = typeof rawDate === 'number' ? new Date(rawDate < 1e12 ? rawDate * 1000 : rawDate) : new Date(rawDate);
      return isNaN(d.getTime()) ? String(rawDate).slice(0, 10) : d.toLocaleDateString('ru-RU');
    } catch (e) { return ''; }
  }

  // --- СЕТЕВОЕ ЯДРО С ЖЁСТКИМ ТАЙМАУТОМ ТЕЛА ОТВЕТА И ПАРАЛЛЕЛЬНОЙ ГОНКОЙ ПРОКСИ ---
  const NetCore = {
    cache: new Map(),

    async fetchRawText(url, opts = {}, timeoutMs = 4000) {
      const controller = new AbortController();
      let timer = null;
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
          try { controller.abort(); } catch (e) {}
          reject(new Error('Timeout ' + timeoutMs + 'ms'));
        }, timeoutMs);
      });
      try {
        return await Promise.race([
          (async () => {
            const res = await fetch(url, { ...opts, signal: controller.signal });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const text = await res.text();
            if (!text || text.length < 2) throw new Error('Empty body');
            return text;
          })(),
          timeoutPromise
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    },

    buildProxyAttemptList(targetUrl, isJson = true) {
      const enc = encodeURIComponent(targetUrl);
      const proxies = [
        { url: `https://corsproxy.io/?url=${enc}`, unwrap: t => t },
        { url: `https://api.allorigins.win/get?url=${enc}`, unwrap: t => JSON.parse(t).contents },
        { url: `https://api.codetabs.com/v1/proxy?quest=${enc}`, unwrap: t => t },
        { url: `https://allorigins.hexlet.app/get?url=${enc}`, unwrap: t => JSON.parse(t).contents },
        { url: `https://api.allorigins.win/raw?url=${enc}`, unwrap: t => t }
      ];
      return proxies.map(p => async () => {
        const raw = await this.fetchRawText(p.url, {}, 4200);
        const unwrapped = p.unwrap(raw);
        if (!unwrapped || unwrapped.includes('Attention Required! | Cloudflare') || unwrapped.includes('Just a moment...')) {
          throw new Error('Cloudflare challenge');
        }
        return isJson ? JSON.parse(unwrapped) : unwrapped;
      });
    },

    async fetchJson(url, opts = {}, { tryDirect = true, timeoutMs = 3800, useCache = true } = {}) {
      const cacheKey = 'JSON:' + url + ':' + JSON.stringify(opts.body || '');
      if (useCache && this.cache.has(cacheKey)) return this.cache.get(cacheKey);

      if (tryDirect) {
        try {
          const txt = await this.fetchRawText(url, opts, timeoutMs);
          const data = JSON.parse(txt);
          if (data) {
            if (useCache) this.cache.set(cacheKey, data);
            return data;
          }
        } catch (e) {}
      }

      if (!opts.method || opts.method.toUpperCase() === 'GET') {
        const data = await Promise.any(this.buildProxyAttemptList(url, true).map(fn => fn()));
        if (useCache) this.cache.set(cacheKey, data);
        return data;
      } else {
        const postProxies = [`https://corsproxy.io/?url=${encodeURIComponent(url)}`, `https://cors.eu.org/${url}`];
        const data = await Promise.any(postProxies.map(async pUrl => JSON.parse(await this.fetchRawText(pUrl, opts, timeoutMs))));
        if (useCache) this.cache.set(cacheKey, data);
        return data;
      }
    },

    async fetchHtml(url, { tryDirect = false, timeoutMs = 4500 } = {}) {
      const cacheKey = 'HTML:' + url;
      if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
      if (tryDirect) {
        try {
          const txt = await this.fetchRawText(url, {}, timeoutMs);
          if (txt && txt.length > 100 && !txt.includes('Just a moment...')) {
            this.cache.set(cacheKey, txt);
            return txt;
          }
        } catch (e) {}
      }
      const html = await Promise.any(this.buildProxyAttemptList(url, false).map(fn => fn()));
      this.cache.set(cacheKey, html);
      return html;
    }
  };

  function withDeadline(promise, ms, fallbackVal = null) {
    let timer = null;
    return Promise.race([
      promise,
      new Promise(resolve => { timer = setTimeout(() => resolve(fallbackVal), ms); })
    ]).finally(() => { if (timer) clearTimeout(timer); });
  }

  // 1. MANGALIB
  async function probeMangaLib(manga) {
    const queries = buildSearchQueries(manga);
    const hosts = ['https://api.cdnlibs.org', 'https://api.lib.social'];
    let matched = null;

    for (const q of queries.slice(0, 3)) {
      if (matched) break;
      for (const host of hosts) {
        try {
          const json = await NetCore.fetchJson(`${host}/api/manga?q=${encodeURIComponent(q)}&site_id[]=1`, {}, { tryDirect: true, timeoutMs: 3500 });
          const list = (json && Array.isArray(json.data)) ? json.data : [];
          const best = pickBestMatch(manga, list, it => ({
            names: [it.rus_name, it.name, it.eng_name, ...(Array.isArray(it.otherNames) ? it.otherNames : [])],
            year: it.releaseDate,
            isNovel: it.type && (it.type.id === 4 || it.type.id === 5 || /новелла|ранобэ/i.test(it.type.label || ''))
          }));
          if (best) { matched = best; break; }
        } catch (e) {}
      }
    }
    if (!matched) return null;
    const slugUrl = matched.slug_url || (matched.id && matched.slug ? `${matched.id}--${matched.slug}` : matched.slug);
    if (!slugUrl) return null;

    let chData = null;
    for (const host of hosts) {
      try {
        const res = await NetCore.fetchJson(`${host}/api/manga/${slugUrl}/chapters`, {}, { tryDirect: true, timeoutMs: 4200 });
        if (res && Array.isArray(res.data) && res.data.length) { chData = res.data; break; }
      } catch (e) {}
    }
    if (!chData || !chData.length) return null;

    const teamsMap = new Map();
    const chapters = chData.map(item => {
      const vol = String(item.volume ?? '1');
      const num = String(item.number ?? '1');
      const branches = Array.isArray(item.branches) && item.branches.length ? item.branches : [{}];
      const pb = branches[0] || {};
      const branchId = pb.branch_id ? String(pb.branch_id) : '';
      const teamName = Array.isArray(pb.teams) ? pb.teams.map(t => t.name).filter(Boolean).join(', ') : '';
      for (const b of branches) {
        const bId = b.branch_id ? String(b.branch_id) : '';
        const tName = (Array.isArray(b.teams) && b.teams.map(t => t.name).filter(Boolean).join(', ')) || (bId ? `Ветка #${bId}` : '');
        if (bId && tName && !teamsMap.has(bId)) teamsMap.set(bId, { id: bId, name: tName });
      }
      return {
        id: `mangalib:${slugUrl}:v${vol}:c${num}`,
        source: 'mangalib',
        slugUrl,
        volume: vol,
        number: num,
        name: item.name || '',
        branchId,
        teamName,
        date: formatDateRu(pb.created_at)
      };
    });

    const sorted = deduplicateChapters(chapters);
    return sorted.length ? { id: 'mangalib', name: `MangaLib (${sorted.length} гл.)`, chapters: sorted, teams: Array.from(teamsMap.values()) } : null;
  }

  async function getMangaLibPages(ch, activeBranch) {
    const hosts = ['https://api.cdnlibs.org', 'https://api.lib.social'];
    const branchParam = (activeBranch && activeBranch !== 'all')
      ? `&branch_id=${encodeURIComponent(activeBranch)}`
      : (ch.branchId ? `&branch_id=${encodeURIComponent(ch.branchId)}` : '');
    for (const host of hosts) {
      try {
        const json = await NetCore.fetchJson(`${host}/api/manga/${ch.slugUrl}/chapter?number=${encodeURIComponent(ch.number)}&volume=${encodeURIComponent(ch.volume)}${branchParam}`, {}, { tryDirect: true, timeoutMs: 5000 });
        const pages = json && json.data && Array.isArray(json.data.pages) ? json.data.pages : [];
        if (pages.length) return pages.map(p => p.url || p.image || p.src).filter(Boolean);
      } catch (e) {}
    }
    throw new Error('Не удалось загрузить страницы с MangaLib');
  }

  // 2. REMANGA
  async function probeReManga(manga) {
    const queries = buildSearchQueries(manga);
    let matchedDir = '';
    for (const q of queries.slice(0, 3)) {
      if (matchedDir) break;
      for (const base of ['https://api.remanga.org/api/search/?count=15&query=', 'https://api.remanga.org/api/v2/search/?count=15&query=']) {
        try {
          const json = await NetCore.fetchJson(base + encodeURIComponent(q), {}, { tryDirect: true, timeoutMs: 3500 });
          const list = (json && (json.content || json.results || json.data)) || [];
          const best = pickBestMatch(manga, Array.isArray(list) ? list : [], it => ({
            names: [it.main_name, it.secondary_name, it.another_name, it.rus_name, it.en_name],
            year: it.issue_year,
            isNovel: /новелла|ранобэ/i.test(it.type || '')
          }));
          if (best && best.dir) { matchedDir = best.dir; break; }
        } catch (e) {}
      }
    }
    if (!matchedDir) return null;

    let branches = [];
    for (const ep of [`https://api.remanga.org/api/titles/${matchedDir}/`, `https://api.remanga.org/api/v2/titles/${matchedDir}/`]) {
      try {
        const det = await NetCore.fetchJson(ep, {}, { tryDirect: true, timeoutMs: 3800 });
        const content = (det && (det.content || det.data || det)) || {};
        if (Array.isArray(content.branches) && content.branches.length) { branches = content.branches; break; }
      } catch (e) {}
    }
    if (!branches.length) return null;
    branches.sort((a, b) => (b.count || b.total_chapters || 0) - (a.count || a.total_chapters || 0));
    const branchId = branches[0].id;

    let rawChapters = [];
    for (const chUrl of [
      `https://api.remanga.org/api/titles/chapters/?branch_id=${branchId}&user_data=0`,
      `https://api.remanga.org/api/titles/chapters/?branch_id=${branchId}&ordering=-index&count=1000&page=1`
    ]) {
      try {
        const chJson = await NetCore.fetchJson(chUrl, {}, { tryDirect: true, timeoutMs: 4200 });
        const arr = (chJson && (chJson.content || chJson.results || chJson.data)) || [];
        if (Array.isArray(arr) && arr.length) { rawChapters = arr; break; }
      } catch (e) {}
    }
    if (!rawChapters.length) return null;

    const free = rawChapters.filter(c => !c.is_paid || c.is_bought);
    const usable = free.length ? free : rawChapters;
    const sorted = deduplicateChapters(usable.map(c => ({
      id: `remanga:${c.id}`,
      source: 'remanga',
      remangaId: String(c.id),
      volume: String(c.tome ?? '1'),
      number: String(c.chapter ?? '1'),
      name: c.name || '',
      teamName: Array.isArray(c.publishers) ? c.publishers.map(p => p.name).filter(Boolean).join(', ') : '',
      date: formatDateRu(c.upload_date || c.pub_date)
    })));
    return sorted.length ? { id: 'remanga', name: `ReManga (${sorted.length} гл.)`, chapters: sorted, teams: [] } : null;
  }

  async function getReMangaPages(ch) {
    for (const url of [`https://api.remanga.org/api/titles/chapters/${ch.remangaId}/`, `https://api.remanga.org/api/v2/titles/chapters/${ch.remangaId}/`]) {
      try {
        const json = await NetCore.fetchJson(url, {}, { tryDirect: true, timeoutMs: 5000 });
        const content = (json && (json.content || json.data || json)) || {};
        const flat = (Array.isArray(content.pages) ? content.pages.flat(3) : [])
          .map(p => (typeof p === 'string' ? p : (p && (p.link || p.url || p.img || p.src))))
          .filter(Boolean);
        if (flat.length) return flat;
      } catch (e) {}
    }
    throw new Error('Страницы главы на ReManga недоступны');
  }

  // 3. DESU
  async function probeDesu(manga) {
    const queries = buildSearchQueries(manga);
    const hosts = ['https://desu.win', 'https://x.desu.win', 'https://desu.me'];
    let matchedId = null;
    let workingHost = hosts[0];

    for (const q of queries.slice(0, 3)) {
      if (matchedId) break;
      for (const host of hosts) {
        try {
          const json = await NetCore.fetchJson(`${host}/manga/api/?limit=15&search=${encodeURIComponent(q)}`, {}, { tryDirect: true, timeoutMs: 3500 });
          const list = (json && json.response) || [];
          const best = pickBestMatch(manga, Array.isArray(list) ? list : [], it => ({
            names: [it.russian, it.name],
            year: it.aired_on,
            isNovel: it.kind === 'novel' || it.kind === 'light_novel'
          }));
          if (best && best.id) { matchedId = best.id; workingHost = host; break; }
        } catch (e) {}
      }
    }
    if (!matchedId) return null;

    const detJson = await NetCore.fetchJson(`${workingHost}/manga/api/${matchedId}`, {}, { tryDirect: true, timeoutMs: 4200 });
    const chList = detJson && detJson.response && detJson.response.chapters && detJson.response.chapters.list;
    if (!Array.isArray(chList) || !chList.length) return null;

    const sorted = deduplicateChapters(chList.map(c => ({
      id: `desu:${matchedId}:${c.id}`,
      source: 'desu',
      desuMangaId: String(matchedId),
      desuChapterId: String(c.id),
      desuHost: workingHost,
      volume: String(c.vol ?? '1'),
      number: String(c.ch ?? '1'),
      name: c.title || '',
      teamName: 'Desu',
      date: formatDateRu(c.date)
    })));
    return sorted.length ? { id: 'desu', name: `Desu (${sorted.length} гл.)`, chapters: sorted, teams: [] } : null;
  }

  async function getDesuPages(ch) {
    for (const host of [ch.desuHost || 'https://desu.win', 'https://desu.win', 'https://desu.me']) {
      try {
        const json = await NetCore.fetchJson(`${host}/manga/api/${ch.desuMangaId}/chapter/${ch.desuChapterId}`, {}, { tryDirect: true, timeoutMs: 5000 });
        const list = json && json.response && json.response.pages && json.response.pages.list;
        if (Array.isArray(list) && list.length) return list.map(p => p.img || p.url).filter(Boolean);
      } catch (e) {}
    }
    throw new Error('Не удалось получить страницы с Desu');
  }

  // 4. MANGADEX
  async function probeMangaDex(manga) {
    const queries = Array.from(new Set([manga.engTitle, manga.romajiTitle, manga.origTitle, ...buildSearchQueries(manga)].filter(s => s && s.trim().length >= 2)));
    let matchedMdId = '';
    const ratingParams = '&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic';

    for (const q of queries.slice(0, 4)) {
      if (matchedMdId) break;
      try {
        const json = await NetCore.fetchJson(`https://api.mangadex.org/manga?title=${encodeURIComponent(q)}&limit=15${ratingParams}`, {}, { tryDirect: true, timeoutMs: 3600 });
        const list = (json && json.data) || [];
        const best = pickBestMatch(manga, Array.isArray(list) ? list : [], it => {
          const attrs = it.attributes || {};
          const names = [];
          if (attrs.title) names.push(...Object.values(attrs.title));
          if (Array.isArray(attrs.altTitles)) attrs.altTitles.forEach(alt => alt && names.push(...Object.values(alt)));
          return { names, year: attrs.year, isNovel: false };
        });
        if (best && best.id) { matchedMdId = best.id; break; }
      } catch (e) {}
    }
    if (!matchedMdId) return null;

    const feedUrl = `https://api.mangadex.org/manga/${matchedMdId}/feed?limit=500&offset=0&translatedLanguage[]=ru&translatedLanguage[]=en${ratingParams}&includes[]=scanlation_group&order[volume]=asc&order[chapter]=asc`;
    const feedJson = await NetCore.fetchJson(feedUrl, {}, { tryDirect: true, timeoutMs: 4500 });
    let items = ((feedJson && feedJson.data) || []).filter(ch => {
      const a = ch.attributes || {};
      return !(a.externalUrl && (!a.pages || a.pages === 0));
    });
    if (!items.length) return null;

    const ruItems = items.filter(ch => ch.attributes && ch.attributes.translatedLanguage === 'ru');
    const chosen = ruItems.length ? ruItems : items.filter(ch => ch.attributes && ch.attributes.translatedLanguage === 'en');

    const sorted = deduplicateChapters(chosen.map(ch => {
      const a = ch.attributes || {};
      const groupRel = (ch.relationships || []).find(r => r.type === 'scanlation_group' && r.attributes);
      return {
        id: `mangadex:${ch.id}`,
        source: 'mangadex',
        mdChapterId: ch.id,
        volume: String(a.volume || '1'),
        number: String(a.chapter || '1'),
        name: (a.translatedLanguage === 'en' ? '[EN] ' : '') + (a.title || ''),
        teamName: groupRel ? groupRel.attributes.name : (a.translatedLanguage || 'RU').toUpperCase(),
        date: formatDateRu(a.publishAt || a.createdAt)
      };
    }));
    return sorted.length ? { id: 'mangadex', name: `MangaDex ${ruItems.length ? 'RU' : 'EN'} (${sorted.length} гл.)`, chapters: sorted, teams: [] } : null;
  }

  async function getMangaDexPages(ch) {
    const json = await NetCore.fetchJson(`https://api.mangadex.org/at-home/server/${ch.mdChapterId}`, {}, { tryDirect: true, timeoutMs: 5000, useCache: false });
    if (!json || !json.baseUrl || !json.chapter) throw new Error('Ошибка MangaDex At-Home');
    const hasFull = Array.isArray(json.chapter.data) && json.chapter.data.length;
    const files = hasFull ? json.chapter.data : (json.chapter.dataSaver || []);
    return files.map(f => `${json.baseUrl}/${hasFull ? 'data' : 'data-saver'}/${json.chapter.hash}/${f}`);
  }

  // 5. READMANGA / USAGI / MINTMANGA
  async function probeReadManga(manga) {
    const queries = buildSearchQueries(manga);
    const hosts = ['https://web.usagi.one', 'https://readmanga.live', 'https://mintmanga.live'];
    let matchedSlug = '';
    let matchedHost = hosts[0];

    for (const q of queries.slice(0, 3)) {
      if (matchedSlug) break;
      for (const host of hosts) {
        try {
          const json = await NetCore.fetchJson(`${host}/search/suggestion?query=${encodeURIComponent(q)}`, {}, { tryDirect: false, timeoutMs: 4000 });
          const sugs = ((json && json.suggestions) || []).filter(s => s && s.link && !s.link.startsWith('http'));
          const best = pickBestMatch(manga, sugs, it => ({
            names: [it.value, ...(Array.isArray(it.names) ? it.names : [])],
            year: '',
            isNovel: false
          }));
          if (best && best.link) { matchedSlug = best.link.replace(/^\/+|\/+$/g, ''); matchedHost = host; break; }
        } catch (e) {}
      }
    }
    if (!matchedSlug) return null;

    const html = await NetCore.fetchHtml(`${matchedHost}/${matchedSlug}?mtr=1`, { tryDirect: false, timeoutMs: 4500 });
    const chapters = [];
    const esc = matchedSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`href=["']\\/${esc}\\/vol([^\\/\\"']+)\\/([^\\"'\\?#]+)[^\\"']*["'][^>]*>([\\s\\S]*?)<\\/a>`, 'gi');
    let m;
    while ((m = re.exec(html)) !== null) {
      const rawTitle = m[3].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const cleanName = rawTitle.replace(/^.*?\d+\s*[-—:]?\s*\d*\s*/, '').trim();
      chapters.push({
        id: `readmanga:${matchedSlug}:v${m[1]}:c${m[2]}`,
        source: 'readmanga',
        rmHost: matchedHost,
        rmSlug: matchedSlug,
        volume: String(m[1]),
        number: String(m[2]),
        name: cleanName !== rawTitle ? cleanName : '',
        teamName: 'ReadManga',
        date: ''
      });
    }
    const sorted = deduplicateChapters(chapters);
    return sorted.length ? { id: 'readmanga', name: `ReadManga (${sorted.length} гл.)`, chapters: sorted, teams: [] } : null;
  }

  async function getReadMangaPages(ch) {
    const hosts = Array.from(new Set([ch.rmHost || 'https://web.usagi.one', 'https://web.usagi.one', 'https://readmanga.live', 'https://mintmanga.live']));
    for (const host of hosts) {
      try {
        const html = await NetCore.fetchHtml(`${host}/${ch.rmSlug}/vol${ch.volume}/${ch.number}?mtr=1`, { tryDirect: false, timeoutMs: 5500 });
        const initMatch = html.match(/rm_h\.(?:readerInit|readerDoInit|init)\s*\(([\s\S]*?)\)\s*;/);
        if (!initMatch) continue;
        const arrMatch = initMatch[1].match(/\[\s*\[[\s\S]*?\]\s*\]/);
        if (!arrMatch) continue;
        const tuples = JSON.parse(arrMatch[0].replace(/'/g, '"'));
        const pages = (Array.isArray(tuples) ? tuples : []).map(t => {
          if (!Array.isArray(t)) return '';
          const [p0 = '', p1 = '', p2 = ''] = t.map(x => String(x || ''));
          if (p1.startsWith('http') || p1.startsWith('//')) return (p1.startsWith('//') ? 'https:' + p1 : p1) + p0 + p2;
          if (p0.startsWith('http') || p0.startsWith('//')) return (p0.startsWith('//') ? 'https:' + p0 : p0) + p1 + p2;
          return p1 + p0 + p2;
        }).filter(Boolean);
        if (pages.length) return pages;
      } catch (e) {}
    }
    throw new Error('Не удалось извлечь страницы с ReadManga / Usagi');
  }

  // 6. WAMANGA / MANGABUFF
  async function probeWaManga(manga) {
    const queries = buildSearchQueries(manga);
    for (const q of queries.slice(0, 2)) {
      try {
        const sugJson = await NetCore.fetchJson(`https://mangabuff.ru/search/suggestions?q=${encodeURIComponent(q)}`, {}, { tryDirect: false, timeoutMs: 3800 });
        const list = Array.isArray(sugJson) ? sugJson : (sugJson && sugJson.data) || [];
        const best = pickBestMatch(manga, list, it => ({ names: [it.name, it.other_names], year: '', isNovel: false }));
        if (best && best.slug) {
          const html = await NetCore.fetchHtml(`https://mangabuff.ru/manga/${best.slug}`, { tryDirect: false, timeoutMs: 4500 });
          const re = /href=["'](?:https?:\/\/mangabuff\.ru)?\/manga\/([^\/\\"']+)\/(\d+)\/([\d.]+)["']/gi;
          const chapters = [];
          let m;
          while ((m = re.exec(html)) !== null) {
            chapters.push({
              id: `mangabuff:${m[1]}:v${m[2]}:c${m[3]}`,
              source: 'wamanga',
              provider: 'mangabuff',
              mbSlug: m[1],
              volume: String(m[2]),
              number: String(m[3]),
              name: '',
              teamName: 'MangaBuff',
              date: ''
            });
          }
          const sorted = deduplicateChapters(chapters);
          if (sorted.length) return { id: 'wamanga', name: `MangaBuff (${sorted.length} гл.)`, chapters: sorted, teams: [] };
        }
      } catch (e) {}
    }
    return null;
  }

  async function getWaMangaPages(ch) {
    if (ch.provider === 'mangabuff' && ch.mbSlug) {
      const html = await NetCore.fetchHtml(`https://mangabuff.ru/manga/${ch.mbSlug}/${ch.volume}/${ch.number}`, { tryDirect: false, timeoutMs: 5500 });
      const pages = [];
      const re = /class=["'][^"']*reader__item[^"']*["'][^>]*>\s*<img[^>]+(?:data-src|src)=["']([^"']+)["']/gi;
      let m;
      while ((m = re.exec(html)) !== null) {
        const u = m[1].startsWith('//') ? 'https:' + m[1] : (m[1].startsWith('/') ? 'https://mangabuff.ru' + m[1] : m[1]);
        pages.push(u);
      }
      if (!pages.length) {
        const re2 = /<img[^>]+data-src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi;
        while ((m = re2.exec(html)) !== null) pages.push(m[1]);
      }
      if (pages.length) return pages;
    }
    throw new Error('Не удалось получить страницы с MangaBuff / WaManga');
  }

  // 7. SENKURO
  async function probeSenkuro(manga) {
    const queries = buildSearchQueries(manga);
    const gqlQuery = `
      query($q: String!) {
        mangaTachiyomiSearch(query: $q) {
          mangas { id slug title { ru en romaji } }
        }
      }
    `;
    let matchedSlug = '';
    for (const q of queries.slice(0, 2)) {
      if (matchedSlug) break;
      try {
        const res = await NetCore.fetchJson('https://api.senkuro.com/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: gqlQuery, variables: { q } })
        }, { tryDirect: true, timeoutMs: 3600 });
        const list = (res && res.data && res.data.mangaTachiyomiSearch && res.data.mangaTachiyomiSearch.mangas) || [];
        const best = pickBestMatch(manga, list, it => ({
          names: it.title ? [it.title.ru, it.title.en, it.title.romaji] : [],
          year: '',
          isNovel: false
        }));
        if (best && best.slug) { matchedSlug = best.slug; break; }
      } catch (e) {}
    }
    if (!matchedSlug) return null;

    const chQuery = `
      query($slug: String!) {
        mangaTachiyomiChapters(slug: $slug) {
          chapters { id slug volume number name createdAt }
        }
      }
    `;
    const chRes = await NetCore.fetchJson('https://api.senkuro.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: chQuery, variables: { slug: matchedSlug } })
    }, { tryDirect: true, timeoutMs: 4200 });

    const rawCh = (chRes && chRes.data && chRes.data.mangaTachiyomiChapters && chRes.data.mangaTachiyomiChapters.chapters) || [];
    if (!rawCh.length) return null;

    const sorted = deduplicateChapters(rawCh.map(c => ({
      id: `senkuro:${matchedSlug}:${c.slug || c.id}`,
      source: 'senkuro',
      senkuroChapterSlug: c.slug || c.id,
      volume: String(c.volume || '1'),
      number: String(c.number || '1'),
      name: c.name || '',
      teamName: 'Senkuro',
      date: formatDateRu(c.createdAt)
    })));
    return sorted.length ? { id: 'senkuro', name: `Senkuro (${sorted.length} гл.)`, chapters: sorted, teams: [] } : null;
  }

  async function getSenkuroPages(ch) {
    const q = `
      query($slug: String!) {
        mangaTachiyomiChapterPages(slug: $slug) {
          pages { url }
        }
      }
    `;
    const res = await NetCore.fetchJson('https://api.senkuro.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q, variables: { slug: ch.senkuroChapterSlug } })
    }, { tryDirect: true, timeoutMs: 5000 });
    const pages = (res && res.data && res.data.mangaTachiyomiChapterPages && res.data.mangaTachiyomiChapterPages.pages) || [];
    if (pages.length) return pages.map(p => p.url).filter(Boolean);
    throw new Error('Не удалось загрузить страницы с Senkuro');
  }

  // 8. MANGALUN CDN
  async function probeMangalun(manga) {
    const slugCandidates = Array.from(new Set([
      translitRuToSlug(manga.title),
      translitRuToSlug(stripSubtitles(manga.title)),
      translitRuToSlug(manga.engTitle || '')
    ].filter(s => s && s.length >= 3)));

    for (const slug of slugCandidates.slice(0, 2)) {
      try {
        const html = await NetCore.fetchHtml(`https://mangalun.to/manga/${slug}`, { tryDirect: false, timeoutMs: 3800 });
        if (!html || html.includes('404')) continue;
        const mIdMatch = html.match(/cdn\.mangalun\.to\/manga\/(\d+)\//i);
        const mId = mIdMatch ? mIdMatch[1] : '';
        const chCount = manga.shikiChapters && manga.shikiChapters > 0 ? manga.shikiChapters : 50;
        const chapters = [];
        for (let i = 1; i <= chCount; i++) {
          chapters.push({
            id: `mangalun:${slug}:${i}`,
            source: 'mangalun',
            mangalunSlug: slug,
            mangalunId: mId,
            volume: '1',
            number: String(i),
            name: '',
            teamName: 'Mangalun',
            autoHideTail: true,
            date: ''
          });
        }
        return { id: 'mangalun', name: `Mangalun (${chapters.length} гл.)`, chapters, teams: [] };
      } catch (e) {}
    }
    return null;
  }

  async function getMangalunPages(ch) {
    const pages = [];
    for (let i = 1; i <= 45; i++) {
      const p3 = String(i).padStart(3, '0');
      if (ch.mangalunId) {
        pages.push(`https://cdn.mangalun.to/manga/${ch.mangalunId}/fix-20261027/${ch.number}/${p3}.webp`);
      } else {
        pages.push(`https://cdn.mangalun.to/manga/${ch.mangalunSlug}/${ch.number}/${p3}.webp`);
      }
    }
    return pages;
  }

  // --- РЕЕСТР И ПОТОКОВАЯ ЗАГРУЗКА БАЛАНСЕРОВ ---
  const PROBERS = {
    mangalib: probeMangaLib,
    remanga: probeReManga,
    desu: probeDesu,
    mangadex: probeMangaDex,
    readmanga: probeReadManga,
    wamanga: probeWaManga,
    senkuro: probeSenkuro,
    mangalun: probeMangalun
  };

  const balancerCache = new Map();

  function sortBalancers(list, preferredSource) {
    return list.slice().sort((a, b) => {
      if (preferredSource && preferredSource !== 'auto') {
        if (a.id === preferredSource) return -1;
        if (b.id === preferredSource) return 1;
      }
      return (b.chapters ? b.chapters.length : 0) - (a.chapters ? a.chapters.length : 0);
    });
  }

  const PluginObject = {
    id: 'lampa_omnivorous_v10',
    name: `Omnivorous Core v${PLUGIN_VERSION} (8 балансеров)`,
    version: PLUGIN_VERSION,
    sources: SOURCES,

    async loadSingleBalancer(sourceId, manga) {
      const fn = PROBERS[sourceId];
      if (!fn) return null;
      return await withDeadline(fn(manga), 7500, null);
    },

    async loadBalancersStreaming(manga, preferredSource = 'auto', callbacks = {}, forceRefresh = false) {
      const cacheKey = manga.id || manga.title;
      if (!forceRefresh && balancerCache.has(cacheKey)) {
        const cached = sortBalancers(balancerCache.get(cacheKey), preferredSource);
        if (callbacks.onUpdate) callbacks.onUpdate(cached, false);
        if (callbacks.onComplete) callbacks.onComplete(cached);
        return cached;
      }

      const found = [];
      const sourceIds = Object.keys(PROBERS);
      let completedCount = 0;

      const tasks = sourceIds.map(async (sId) => {
        try {
          const res = await withDeadline(PROBERS[sId](manga), 7000, null);
          if (res && Array.isArray(res.chapters) && res.chapters.length > 0) {
            found.push(res);
          }
        } catch (e) {}
        completedCount++;
        const stillLoading = completedCount < sourceIds.length;
        if (callbacks.onUpdate) {
          callbacks.onUpdate(sortBalancers(found, preferredSource), stillLoading);
        }
      });

      await withDeadline(Promise.allSettled(tasks), 8000, null);
      const finalSorted = sortBalancers(found, preferredSource);
      if (finalSorted.length > 0) {
        balancerCache.set(cacheKey, finalSorted);
      }
      if (callbacks.onComplete) {
        callbacks.onComplete(finalSorted);
      }
      return finalSorted;
    },

    async getDetailsAndBalancers(compositeId, preferredSource, mangaDetails) {
      const balancers = await this.loadBalancersStreaming(mangaDetails, preferredSource, {});
      return { details: mangaDetails, balancers };
    },

    async getChapterPages(ch, activeBranch = 'all') {
      if (!ch) throw new Error('Глава не выбрана');
      switch (ch.source) {
        case 'mangalib':  return await getMangaLibPages(ch, activeBranch);
        case 'remanga':   return await getReMangaPages(ch);
        case 'desu':      return await getDesuPages(ch);
        case 'mangadex':  return await getMangaDexPages(ch);
        case 'readmanga': return await getReadMangaPages(ch);
        case 'wamanga':   return await getWaMangaPages(ch);
        case 'senkuro':   return await getSenkuroPages(ch);
        case 'mangalun':  return await getMangalunPages(ch);
        default:          throw new Error('Неизвестный источник главы: ' + ch.source);
      }
    }
  };

  if (window.LampaManga && typeof window.LampaManga.registerPlugin === 'function') {
    window.LampaManga.registerPlugin(PluginObject);
  } else {
    window.__PendingLampaMangaPlugin = PluginObject;
  }
})();