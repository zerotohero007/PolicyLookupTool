(function () {
  'use strict';
  const policy = window.POLICY;
  const faqs = policy.faqs;
  const sourceEntries = (window.POLICY_TEXT_INDEX || {}).entries || [];
  const input = document.getElementById('question');
  const form = document.getElementById('search-form');
  const suggestions = document.getElementById('suggestions');
  const answerArea = document.getElementById('answer-area');
  const categoryRow = document.getElementById('category-row');
  const hotList = document.getElementById('hot-list');
  const quickHot = document.getElementById('quick-hot');
  const modeQa = document.getElementById('mode-qa');
  const modeOriginal = document.getElementById('mode-original');
  const dateLabel = '2026 年 12 月 1 日';
  const obsolete = [/长期出差申请单/, /每[两2]个?月.*往返/, /协议酒店/, /住宿.*统筹/, /加班申请单/, /加班补贴/, /报销凭证粘贴纸/];
  let category = '全部';
  let mode = 'qa';

  function norm(s) { return String(s || '').toLowerCase().replace(/[\s，。？！,.?!：:、（）()·—–\-“”‘’"'；;\/\\\[\]{}]/g, ''); }
  function isObsolete(q) { return obsolete.some(re => re.test(q)); }
  function score(faq, query) {
    const q = norm(query), title = norm(faq.question);
    if (!q) return 0;
    if (q === title) return 100;
    let value = q.length >= 5 && title.includes(q) ? 24 : 0;
    for (const term of faq.terms) {
      const t = norm(term);
      if (q.includes(t)) value += 8 + Math.min(t.length, 7);
    }
    return value;
  }
  function search(query) {
    if (isObsolete(query)) return [];
    return faqs.map(faq => ({ faq, score: score(faq, query) }))
      .filter(item => item.score >= 10)
      .sort((a,b) => b.score - a.score || (a.faq.hot || 99) - (b.faq.hot || 99));
  }
  function sourceTerms(query) {
    const terms = [];
    const aliases = {'人资':'人力资源部','人资部':'人力资源部','餐补':'伙食补助','住宿上限':'住宿费限额'};
    for (const part of String(query || '').split(/[\s，、,；;\/]+/)) {
      const word = norm(part).replace(/^(请问|查询|查一下|关于)/, '');
      const core = word.replace(/(?:负责什么|职责是什么|差旅费?标准|有什么规定|有哪些|怎么办|怎么报|多少钱|是多少|是什么|职责|标准|规定|流程|要求)$/, '');
      const chosen = aliases[core] || (core.length >= 2 ? core : word);
      if (chosen.length >= 2 && !terms.includes(chosen)) terms.push(chosen);
    }
    return terms;
  }
  function searchOriginal(query) {
    const terms = sourceTerms(query);
    if (!terms.length) return [];
    const exact = norm(query);
    const hits = [];
    sourceEntries.forEach(entry => {
      const lines = entry.lines || [];
      const full = lines.map(norm).join('');
      if (!terms.every(term => full.includes(term))) return;
      lines.forEach((line, index) => {
        const normalized = norm(line);
        const found = terms.filter(term => normalized.includes(term));
        if (!found.length) return;
        let value = found.length * 18 + (normalized.includes(exact) ? 90 : 0);
        if (normalized.length <= terms.join('').length + 8) value += 20;
        if (/标准|上限|限额/.test(query) && /标准|限额/.test(lines.slice(0, 8).join(''))) value += 8;
        hits.push({entry, index, score: value});
      });
    });
    return hits.sort((a,b) => b.score - a.score || (a.entry.page || 99) - (b.entry.page || 99));
  }
  function elt(tag, cls, value) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (value !== undefined) e.textContent = value;
    return e;
  }
  function sourceLink(cite, label) {
    const a = elt('a','',label || '查看依据 ↗');
    a.href = cite.source === 'guide' ? `${policy.guideSource}#${cite.anchor}` : `${policy.source}#page=${cite.page || 1}`;
    a.target = '_blank'; a.rel = 'noopener';
    return a;
  }
  function appendHighlighted(parent, value, terms) {
    const escaped = terms.filter(Boolean).map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (!escaped.length) { parent.textContent = value; return; }
    const pattern = new RegExp(escaped.sort((a,b) => b.length - a.length).join('|'), 'gi');
    let start = 0, match;
    while ((match = pattern.exec(value))) {
      parent.append(document.createTextNode(value.slice(start, match.index)), elt('mark','',match[0]));
      start = pattern.lastIndex;
    }
    parent.append(document.createTextNode(value.slice(start)));
  }
  function sourceExcerpt(hit, terms) {
    const lines = hit.entry.lines;
    let focus = lines[hit.index];
    if (focus.length > 300) {
      const index = Math.max(0, ...terms.map(term => focus.toLowerCase().indexOf(term.toLowerCase())));
      focus = `${index > 65 ? '…' : ''}${focus.slice(Math.max(0,index - 65), index + 235)}${index + 235 < focus.length ? '…' : ''}`;
    }
    const before = lines.slice(Math.max(0,hit.index - 1),hit.index).join(' ').slice(-95);
    const after = lines.slice(hit.index + 1,hit.index + 4).join(' ').slice(0,150);
    return [before,focus,after].filter(Boolean).join(' ');
  }
  function renderOriginal(hits, query) {
    const section = elt('section','original-results');
    section.append(elt('div','result-label',`原文关键词  /  ${hits.length} 处命中`));
    if(isObsolete(query))section.append(elt('p','original-old-note','该词涉及已删除的旧规定。下列原文命中仅供定位，不能作为现行报销结论。'));
    section.append(elt('p','original-note','仅按脱敏文件文字定位，不自动判断条款是否适用。制度 PDF 为图片式文件，检索文字由 OCR 生成，请打开原页核对。'));
    const list = elt('div','original-list');
    section.append(list);
    const terms = sourceTerms(query);
    let shown = 0;
    function addMore() {
      hits.slice(shown, shown + 8).forEach(hit => {
        const entry = hit.entry;
        const row = elt('article','original-hit');
        const head = elt('div','original-hit-head');
        const label = entry.source === 'guide' ? `填报指引 · ${entry.title}` : `制度原文 · PDF 第 ${entry.page} 页`;
        const cite = entry.source === 'guide' ? {source:'guide',anchor:entry.anchor} : {page:entry.page};
        head.append(elt('strong','',label),sourceLink(cite,'打开原文 ↗'));
        row.append(head);
        const excerpt = elt('p','original-excerpt');
        appendHighlighted(excerpt,sourceExcerpt(hit,terms),terms);
        row.append(excerpt);list.append(row);
      });
      shown = Math.min(shown + 8,hits.length);
      more.hidden = shown >= hits.length;
    }
    const more = elt('button','original-more','显示更多原文命中');
    more.type = 'button';more.onclick = addMore;section.append(more);
    addMore();answerArea.append(section);
  }
  function renderOriginalEmpty() {
    answerArea.replaceChildren();
    answerArea.append(elt('div','result-label','原文关键词  /  无命中'));
    const card = elt('div','answer-card fallback');
    card.append(elt('h3','','未在脱敏文件中找到该关键词'),elt('p','','请改用制度原文中的关键名词，或减少关键词后重试。检索范围仅为脱敏制度 PDF 和脱敏填报指引摘录；PDF 图片文字可能存在 OCR 识别误差。'));
    const row = elt('div','source-row');
    row.append(sourceLink({page:1},'查看脱敏制度 ↗'),sourceLink({source:'guide',anchor:'lodging'},'查看脱敏指引 ↗'));
    card.append(row);answerArea.append(card);
  }
  function renderHot() {
    hotList.replaceChildren();
    const pool = category === '全部' ? faqs.filter(f => f.hot).sort((a,b)=>a.hot-b.hot) : faqs.filter(f => f.category === category);
    pool.forEach((faq,index) => {
      const b=elt('button','hot-item');b.type='button';
      b.append(elt('span','hot-rank',String(index+1).padStart(2,'0')),elt('span','hot-question',faq.question),elt('span','hot-arrow','↗'));
      b.onclick=()=>ask(faq.question,faq);hotList.append(b);
    });
  }
  function renderQuickHot() {
    quickHot.replaceChildren();
    faqs.filter(f=>f.hot && f.hot<=4).sort((a,b)=>a.hot-b.hot).forEach(faq=>{
      const b=elt('button','',faq.question);b.type='button';b.onclick=()=>ask(faq.question,faq);quickHot.append(b);
    });
  }
  function renderCategories() {
    categoryRow.replaceChildren();
    ['全部',...new Set(faqs.map(f=>f.category))].forEach(name=>{
      const b=elt('button',name===category?'active':'',name);b.type='button';
      b.onclick=()=>{category=name;renderCategories();renderHot();};categoryRow.append(b);
    });
  }
  function renderSuggestions(query) {
    if (mode === 'original') { suggestions.hidden=true;input.setAttribute('aria-expanded','false');return; }
    const matches=search(query).slice(0,5);suggestions.replaceChildren();
    if (!query.trim() || !matches.length) { suggestions.hidden=true;input.setAttribute('aria-expanded','false');return; }
    matches.forEach(({faq})=>{
      const b=elt('button','suggestion');b.type='button';b.setAttribute('role','option');
      b.append(elt('span','',faq.question),elt('small','',faq.category));b.onclick=()=>ask(faq.question,faq);suggestions.append(b);
    });
    suggestions.hidden=false;input.setAttribute('aria-expanded','true');
  }
  function renderRelated(matches,selectedId) {
    const related=matches.filter(x=>x.faq.id!==selectedId).slice(0,3);
    if (!related.length) return;
    const box=elt('div','related');box.append(elt('div','related-title','相关问题'));
    const list=elt('div','related-list');
    related.forEach(({faq})=>{const b=elt('button','',faq.question);b.type='button';b.onclick=()=>ask(faq.question,faq);list.append(b);});
    box.append(list);answerArea.append(box);
  }
  function renderAnswer(faq,matches) {
    answerArea.replaceChildren();answerArea.append(elt('div','result-label','QUERY RESULT  /  已找到依据'));
    const card=elt('article','answer-card');
    const head=elt('div','answer-head');head.append(elt('span','pill',faq.category),elt('h3','',faq.question));card.append(head);
    const summary=elt('div','answer-block');summary.append(elt('p','block-title','简明结论'),elt('p','answer-text',faq.answer));card.append(summary);
    const evidence=elt('div','answer-block');evidence.append(elt('p','block-title','所依据的制度条款或填报指引'));
    faq.cites.forEach(cite=>{
      const row=elt('div','cite'), top=elt('div','cite-top');
      const name=cite.source==='guide'?`填报指引 · ${cite.clause}`:/^(附录|封面)/.test(cite.clause)?cite.clause:`第 ${cite.clause} 条`;
      const location=cite.source==='guide'?'脱敏摘录':`PDF 第 ${cite.page} 页`;
      top.append(elt('span','',`${name} · ${location}`),sourceLink(cite,cite.source==='guide'?'查看指引摘录 ↗':'查看原文 ↗'));
      row.append(top,elt('p','',cite.quote));evidence.append(row);
    });card.append(evidence);
    const bottom=elt('div','answer-block source-row');
    const d=elt('span','');d.append('制度实施日期：',elt('strong','',dateLabel));
    bottom.append(d,sourceLink(faq.cites[0],faq.cites[0].source==='guide'?'打开指引摘录 ↗':'打开脱敏制度原文 ↗'));
    card.append(bottom);answerArea.append(card);renderRelated(matches,faq.id);
  }
  function renderFallback(matches,query) {
    answerArea.replaceChildren();answerArea.append(elt('div','result-label','QUERY RESULT  /  依据不足'));
    const card=elt('div','answer-card fallback');
    const message=isObsolete(query)
      ? '该问题涉及审核对比表中已删除的旧条款，或发布版正文与附录、指引表述不一致。本问答不沿用旧结论。请核对现行正文，必要时向财务部确认。'
      : '现有制度与指引没有足够信息直接回答该问题。请补充出差地点、人员类别、时间或具体费用类型，或查看脱敏原文核对；这里不会推测报销结论。';
    card.append(elt('h3','','暂未找到明确依据'),elt('p','',message));
    const row=elt('div','source-row');row.append(elt('span','',`制度实施日期：${dateLabel}`),sourceLink({page:1},'查看制度原文 ↗'));
    card.append(row);answerArea.append(card);
    renderRelated(matches.length?matches:faqs.filter(f=>f.hot).slice(0,3).map(faq=>({faq})), '');
  }
  function show(query,direct,scroll) {
    input.value=query;suggestions.hidden=true;input.setAttribute('aria-expanded','false');
    const matches=search(query);
    const original=searchOriginal(query);
    if (mode === 'original') {
      if (original.length) { answerArea.replaceChildren();renderOriginal(original,query); }
      else renderOriginalEmpty();
    } else {
      if (isObsolete(query)) renderFallback([],query);
      else if (direct) renderAnswer(direct,matches);
      else if(matches.length && (matches[0].score>=15 || (matches.length===1 && matches[0].score>=10))) renderAnswer(matches[0].faq,matches);
      else if(original.length) {
        answerArea.replaceChildren();
        answerArea.append(elt('div','result-label','QUERY RESULT  /  原文定位'));
        answerArea.append(elt('p','original-intro','未匹配到已核对的问答结论。以下是脱敏原文命中，请打开原页核对适用条件。'));
      } else renderFallback(matches,query);
      if (original.length && !isObsolete(query)) renderOriginal(original,query);
    }
    if (scroll) answerArea.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function updateMode() {
    modeQa.classList.toggle('active',mode==='qa');
    modeOriginal.classList.toggle('active',mode==='original');
    modeQa.setAttribute('aria-pressed',String(mode==='qa'));
    modeOriginal.setAttribute('aria-pressed',String(mode==='original'));
    input.placeholder=mode==='original'?'例如：办公室、住宿限额、退票费':'例如：出差伙食补助每天多少钱？';
  }
  function setMode(next) {
    mode=next;updateMode();suggestions.hidden=true;
    const query=input.value.trim();
    if(query) {
      show(query,null,false);
      const url=new URL(window.location.href);
      if(mode==='original')url.searchParams.set('mode','original');else url.searchParams.delete('mode');
      history.replaceState({},'',url);
    }
  }
  function ask(query,direct) {
    if(direct){mode='qa';updateMode();}
    show(query,direct,true);
    const url=new URL(window.location.href);url.searchParams.set('q',query);
    if(mode==='original')url.searchParams.set('mode','original');else url.searchParams.delete('mode');
    history.replaceState({},'',url);
  }
  modeQa.addEventListener('click',()=>setMode('qa'));
  modeOriginal.addEventListener('click',()=>setMode('original'));
  input.addEventListener('input',()=>renderSuggestions(input.value));
  input.addEventListener('focus',()=>renderSuggestions(input.value));
  document.addEventListener('click',e=>{if(!form.contains(e.target)){suggestions.hidden=true;input.setAttribute('aria-expanded','false');}});
  form.addEventListener('submit',e=>{e.preventDefault();if(input.value.trim())ask(input.value.trim());});
  renderCategories();renderHot();renderQuickHot();
  const params=new URLSearchParams(window.location.search);
  if(params.get('mode')==='original')mode='original';
  updateMode();
  const initial=params.get('q');
  if(initial) show(initial,null,false);
  window.PolicySearch={search,searchOriginal,sourceTerms,score,isObsolete};
})();
