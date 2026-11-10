(function () {
  'use strict';
  const policy = window.POLICY;
  const faqs = policy.faqs;
  const input = document.getElementById('question');
  const form = document.getElementById('search-form');
  const suggestions = document.getElementById('suggestions');
  const answerArea = document.getElementById('answer-area');
  const categoryRow = document.getElementById('category-row');
  const hotList = document.getElementById('hot-list');
  const quickHot = document.getElementById('quick-hot');
  let category = '全部';

  function norm(s) { return String(s || '').toLowerCase().replace(/[\s，。？！,.?!：:、（）()·—-]/g, ''); }
  function score(faq, query) {
    const q = norm(query);
    if (!q) return 0;
    const title = norm(faq.question);
    if (q === title) return 100;
    let value = 0;
    if (q.length >= 5 && title.includes(q)) value += 24;
    for (const term of faq.terms) {
      const t = norm(term);
      if (q.includes(t)) value += 8 + Math.min(t.length, 7);
    }
    return value;
  }
  function search(query) {
    return faqs.map(faq => ({ faq, score: score(faq, query) }))
      .filter(item => item.score >= 10)
      .sort((a, b) => b.score - a.score || (a.faq.hot || 99) - (b.faq.hot || 99));
  }
  function elt(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function sourceLink(page, label) {
    const a = elt('a', '', label || `打开第 ${page} 页原文 ↗`);
    a.href = `${policy.source}#page=${page}`;
    a.target = '_blank'; a.rel = 'noopener';
    return a;
  }
  function renderHot() {
    hotList.replaceChildren();
    const pool = category === '全部' ? faqs.filter(f => f.hot).sort((a,b) => a.hot-b.hot) : faqs.filter(f => f.category === category);
    pool.forEach((faq, index) => {
      const b = elt('button','hot-item'); b.type='button';
      b.append(elt('span','hot-rank',String(index+1).padStart(2,'0')),
        elt('span','hot-question',faq.question), elt('span','hot-arrow','↗'));
      b.onclick = () => ask(faq.question, faq);
      hotList.append(b);
    });
  }
  function renderQuickHot() {
    quickHot.replaceChildren();
    faqs.filter(f => f.hot && f.hot <= 4).sort((a,b)=>a.hot-b.hot).forEach(faq=>{
      const b=elt('button','',faq.question);b.type='button';b.onclick=()=>ask(faq.question,faq);quickHot.append(b);
    });
  }
  function renderCategories() {
    const names = ['全部',...new Set(faqs.map(f => f.category))];
    categoryRow.replaceChildren();
    names.forEach(name => {
      const b=elt('button',name === category ? 'active' : '',name); b.type='button';
      b.onclick=()=>{category=name;renderCategories();renderHot();}; categoryRow.append(b);
    });
  }
  function renderSuggestions(query) {
    const results = search(query).slice(0,5);
    suggestions.replaceChildren();
    if (!query.trim() || !results.length) { suggestions.hidden=true; input.setAttribute('aria-expanded','false'); return; }
    results.forEach(({faq})=>{
      const b=elt('button','suggestion');b.type='button';b.setAttribute('role','option');
      b.append(elt('span','',faq.question),elt('small','',faq.category));
      b.onclick=()=>ask(faq.question,faq);suggestions.append(b);
    });
    suggestions.hidden=false;input.setAttribute('aria-expanded','true');
  }
  function renderRelated(matches, selectedId) {
    const related = matches.filter(x => x.faq.id !== selectedId).slice(0,3);
    if (!related.length) return;
    const box=elt('div','related');box.append(elt('div','related-title','相关问题'));
    const list=elt('div','related-list');
    related.forEach(({faq})=>{const b=elt('button','',faq.question);b.type='button';b.onclick=()=>ask(faq.question,faq);list.append(b);});
    box.append(list);answerArea.append(box);
  }
  function renderAnswer(faq, matches) {
    answerArea.replaceChildren();
    answerArea.append(elt('div','result-label','QUERY RESULT  /  已找到依据'));
    const card=elt('article','answer-card');
    const head=elt('div','answer-head');head.append(elt('span','pill',faq.category),elt('h3','',faq.question));card.append(head);
    const summary=elt('div','answer-block');summary.append(elt('p','block-title','简明结论'),elt('p','answer-text',faq.answer));card.append(summary);
    const evidence=elt('div','answer-block');evidence.append(elt('p','block-title','所依据的制度条款'));
    faq.cites.forEach(cite=>{const row=elt('div','cite');const top=elt('div','cite-top');const label=/^(附录|封面)/.test(cite.clause)?cite.clause:`第 ${cite.clause} 条`;top.append(elt('span','',`${label} · PDF 第 ${cite.page} 页`),sourceLink(cite.page,'查看原文 ↗'));row.append(top,elt('p','',cite.quote));evidence.append(row);});card.append(evidence);
    const bottom=elt('div','answer-block source-row');
    const date=elt('span','');date.append('生效日期：',elt('strong','', '2026 年 7 月 10 日'));
    bottom.append(date,sourceLink(faq.cites[0].page,'打开脱敏制度原文 ↗'));card.append(bottom);
    answerArea.append(card);renderRelated(matches,faq.id);
  }
  function renderFallback(matches) {
    answerArea.replaceChildren();
    answerArea.append(elt('div','result-label','QUERY RESULT  /  依据不足'));
    const card=elt('div','answer-card fallback');
    card.append(elt('h3','','暂未找到明确依据'),elt('p','','这份制度没有足够信息直接回答该问题。请补充出差地点、人员类别、时间或具体费用类型，或查看脱敏原文核对；这里不会推测报销结论。'));
    const row=elt('div','source-row');row.append(elt('span','','生效日期：2026 年 7 月 10 日'),sourceLink(1,'查看制度原文 ↗'));card.append(row);answerArea.append(card);
    const related=matches.length ? matches : faqs.filter(f=>f.hot).slice(0,3).map(faq=>({faq}));
    renderRelated(related,'');
  }
  function ask(query, direct) {
    input.value=query;
    suggestions.hidden=true;input.setAttribute('aria-expanded','false');
    const matches=search(query);
    if (direct) renderAnswer(direct,matches);
    else if (matches.length && (matches[0].score >= 15 || (matches.length === 1 && matches[0].score >= 10))) renderAnswer(matches[0].faq,matches);
    else renderFallback(matches);
    const url=new URL(window.location.href);url.searchParams.set('q',query);history.replaceState({},'',url);
    answerArea.scrollIntoView({behavior:'smooth',block:'start'});
  }
  input.addEventListener('input',()=>renderSuggestions(input.value));
  input.addEventListener('focus',()=>renderSuggestions(input.value));
  document.addEventListener('click',e=>{if(!form.contains(e.target)){suggestions.hidden=true;input.setAttribute('aria-expanded','false');}});
  form.addEventListener('submit',e=>{e.preventDefault();if(input.value.trim())ask(input.value.trim());});
  renderCategories();renderHot();renderQuickHot();
  const initial=new URLSearchParams(window.location.search).get('q');
  if(initial) { input.value=initial; const matches=search(initial); if(matches.length && matches[0].score>=15)renderAnswer(matches[0].faq,matches); else renderFallback(matches); }
  window.PolicySearch={search,score};
})();
