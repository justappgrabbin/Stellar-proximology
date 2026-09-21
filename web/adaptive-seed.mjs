const STORE = 'stellar.adaptive.seed.v1';
const RECEIPT_PREFIX = 'adaptive/receipts/';
const FEEDBACK_TYPES = ['resonates','useful','supported','collaborated','purchased','completed','built_on'];
const SEED_APPS = ['social','lab','paper','builder'];

const uid = prefix => prefix + '-' + (globalThis.crypto?.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2)));
const now = () => new Date().toISOString();
const clone = value => JSON.parse(JSON.stringify(value));
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function initialState() {
  return {
    version: 1,
    createdAt: now(),
    seedApps: Object.fromEntries(SEED_APPS.map(name => [name, {name, visible:true, active:true, uses:0}])),
    mechanisms: {
      'market-core': {
        key:'market-core', present:true, active:true, visible:false,
        primitives:['offer','request','match','agreement','fulfillment','receipt','feedback','contribution','revenue-pool'],
        matchingSignals:['demonstrated-skill','availability','project-history','typed-feedback'],
        pluginSockets:['hd-matcher']
      },
      'typed-feedback': {key:'typed-feedback', present:true, active:true, visible:false, types:[...FEEDBACK_TYPES]},
      'revenue-pool': {key:'revenue-pool', present:true, active:true, visible:false}
    },
    permissions: {
      activateBehavior:'ask',
      publishExternal:'ask',
      spendMoney:'ask',
      messagePeople:'ask',
      changePrice:'ask',
      commitAppointment:'ask'
    },
    plugins: {
      'hd-matcher': {status:'reserved', active:false, note:'Socket only. Activate when canonical HD matching rules are introduced.'}
    },
    proposals: [],
    pages: [],
    behaviorRules: [],
    paperDocs: [],
    socialPosts: [],
    interactions: [],
    market: {offers:[], requests:[], matches:[], agreements:[], fulfillments:[], receipts:[]},
    revenuePool: {currency:'USD', gross:0, unallocated:0, allocations:{}, allocationRule:null, entries:[]},
    knowledge: {signals:{}, preferences:{}, outcomes:[]},
    events: []
  };
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    return saved && saved.version === 1 ? saved : initialState();
  } catch {
    return initialState();
  }
}

let state = load();

function persist() {
  localStorage.setItem(STORE, JSON.stringify(state));
}

function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function persistReceipt(event) {
  try {
    if (!globalThis.SynthiaAndroid?.writeWorkspaceBase64) return;
    const path = RECEIPT_PREFIX + event.at.replace(/[:.]/g,'-') + '-' + event.id + '.json';
    globalThis.SynthiaAndroid.writeWorkspaceBase64(path, toBase64(JSON.stringify(event, null, 2)));
  } catch {}
}

function emit(type, payload={}) {
  const event = {id:uid('evt'), type, at:now(), ...payload};
  state.events.push(event);
  if (state.events.length > 1500) state.events = state.events.slice(-1500);
  persist();
  persistReceipt(event);
  globalThis.dispatchEvent(new CustomEvent('stellar-adaptive-event', {detail:clone(event)}));
  return event;
}

function use(app, detail={}) {
  if (state.seedApps[app]) state.seedApps[app].uses++;
  const key = 'use:' + app;
  state.knowledge.signals[key] = (state.knowledge.signals[key] || 0) + 1;
  emit('usage', {app, detail});
}

function classifyNeed(text) {
  const source = String(text || '').trim();
  const s = source.toLowerCase();
  const has = (...words) => words.some(w => s.includes(w));
  if (has('sell','market','buyer','buy','trade','offer','customer purchase')) return {key:'market',title:'Market',kind:'structural',visible:true,behavior:['commerce'],dependencies:['market-core']};
  if (has('appointment','booking','schedule','calendar')) return {key:'scheduling',title:'Scheduling',kind:'structural',visible:true,behavior:['appointments'],permissions:['commitAppointment']};
  if (has('advertis','marketing','campaign','promotion','promote')) return {key:'marketing-planner',title:'Marketing Planner',kind:'hybrid',visible:true,behavior:['plan-campaigns','measure-response'],permissions:['publishExternal','spendMoney']};
  if (has('customer','follow up','follow-up','replies','reply')) return {key:'customer-care',title:'Customer Care',kind:'behavioral',visible:true,behavior:['draft-responses','track-followups'],permissions:['messagePeople']};
  if (has('analytics','attribution','conversion','measure sales')) return {key:'analytics',title:'Outcome Analytics',kind:'structural',visible:true,behavior:['attribution','outcome-learning']};
  if (has('world','simulation','room','spatial','digital twin')) return {key:'world',title:'World / Simulation',kind:'structural',visible:true,behavior:['world-projection'],dependencies:['state-space']};
  if (has('crm','contacts','leads')) return {key:'crm',title:'Relationships / CRM',kind:'structural',visible:true,behavior:['relationship-tracking']};
  if (has('store','shop','catalog')) return {key:'store',title:'Store',kind:'structural',visible:true,behavior:['catalog','checkout'],dependencies:['market-core']};
  if (has('collaborat','team','circle','group')) return {key:'circles',title:'Circles',kind:'structural',visible:true,behavior:['group-coordination','typed-feedback']};
  return {key:'custom-' + uid('cap').slice(-8),title:'New Capability',kind:'structural',visible:true,behavior:['user-defined']};
}

function propose(need, source='user') {
  const text = String(need || '').trim();
  if (!text) throw new Error('need-required');
  const spec = classifyNeed(text);
  const proposal = {id:uid('proposal'),createdAt:now(),source,need:text,status:'proposed',spec,sandbox:null,approvedAt:null,activatedAt:null,rolledBackAt:null};
  state.proposals.push(proposal);
  emit('growth.proposed', {proposalId:proposal.id, need:text, spec:clone(spec)});
  return clone(proposal);
}

function buildSandbox(proposalId) {
  const p = state.proposals.find(x => x.id === proposalId);
  if (!p) throw new Error('proposal-not-found');
  if (p.status === 'rolled_back') throw new Error('proposal-rolled-back');
  p.sandbox = {builtAt:now(),manifest:{id:p.id,key:p.spec.key,title:p.spec.title,kind:p.spec.kind,dependencies:[...(p.spec.dependencies||[])],behavior:[...(p.spec.behavior||[])],permissions:[...(p.spec.permissions||[])],activation:'user-controlled'}};
  if (p.status === 'proposed') p.status = 'sandboxed';
  emit('growth.sandboxed', {proposalId:p.id, manifest:clone(p.sandbox.manifest)});
  return clone(p);
}

function approveAndActivate(proposalId) {
  const p = state.proposals.find(x => x.id === proposalId);
  if (!p) throw new Error('proposal-not-found');
  if (!p.sandbox) buildSandbox(proposalId);
  p.status = 'active';
  p.approvedAt = p.approvedAt || now();
  p.activatedAt = now();
  if (p.spec.visible && !state.pages.some(x => x.proposalId === p.id)) {
    state.pages.push({id:uid('page'),proposalId:p.id,key:p.spec.key,title:p.spec.title,createdAt:now(),active:true,origin:'auto-builder',need:p.need});
  }
  for (const behavior of p.spec.behavior || []) {
    if (!state.behaviorRules.some(r => r.proposalId === p.id && r.behavior === behavior)) state.behaviorRules.push({id:uid('rule'),proposalId:p.id,behavior,active:true,activatedAt:now()});
  }
  emit('growth.activated', {proposalId:p.id, userApproved:true, spec:clone(p.spec)});
  render();
  return clone(p);
}

function rollback(proposalId) {
  const p = state.proposals.find(x => x.id === proposalId);
  if (!p) throw new Error('proposal-not-found');
  p.status = 'rolled_back';
  p.rolledBackAt = now();
  for (const page of state.pages.filter(x => x.proposalId === p.id)) page.active = false;
  for (const rule of state.behaviorRules.filter(x => x.proposalId === p.id)) rule.active = false;
  emit('growth.rolled_back', {proposalId:p.id, preserved:true});
  render();
  return clone(p);
}

function createPaperDoc({title,purpose,content=''}) {
  const doc = {id:uid('paper'),title:String(title||'Untitled'),purpose:String(purpose||''),content:String(content||''),createdAt:now(),updatedAt:now()};
  state.paperDocs.push(doc);
  use('paper', {docId:doc.id});
  emit('paper.created', {docId:doc.id,title:doc.title,purpose:doc.purpose});
  render();
  return clone(doc);
}

function paperToGrowth(docId) {
  const doc = state.paperDocs.find(x => x.id === docId);
  if (!doc) throw new Error('paper-doc-not-found');
  return propose(doc.purpose || doc.title, 'paper');
}

function postSocial({author='local',text}) {
  const value = String(text || '').trim();
  if (!value) throw new Error('post-required');
  const post = {id:uid('post'),author,text:value,at:now(),feedback:{}};
  state.socialPosts.unshift(post);
  use('social', {postId:post.id});
  emit('social.posted', {postId:post.id,author});
  render();
  return clone(post);
}

function feedback(targetId,type,actor='local') {
  if (!FEEDBACK_TYPES.includes(type)) throw new Error('feedback-type-invalid');
  const row = {id:uid('feedback'),targetId,type,actor,at:now()};
  state.interactions.push(row);
  const post = state.socialPosts.find(x => x.id === targetId);
  if (post) post.feedback[type] = (post.feedback[type] || 0) + 1;
  state.knowledge.signals['feedback:' + type] = (state.knowledge.signals['feedback:' + type] || 0) + 1;
  emit('feedback.recorded', {targetId,feedbackType:type,actor});
  render();
  return clone(row);
}

function addOffer({owner='local',title,description='',price=null,currency='USD',availability='available'}) {
  const offer = {id:uid('offer'),owner,title:String(title||'Offer'),description:String(description||''),price:price===null?null:Number(price),currency,availability,at:now(),status:'open'};
  state.market.offers.push(offer);
  emit('market.offer.created', {offerId:offer.id,owner,title:offer.title});
  render();
  return clone(offer);
}

function addRequest({owner='local',title,description='',budget=null,currency='USD'}) {
  const request = {id:uid('request'),owner,title:String(title||'Request'),description:String(description||''),budget:budget===null?null:Number(budget),currency,at:now(),status:'open'};
  state.market.requests.push(request);
  emit('market.request.created', {requestId:request.id,owner,title:request.title});
  render();
  return clone(request);
}

function recordRevenue(amount,source='market',currency='USD') {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) throw new Error('invalid-revenue');
  if (state.revenuePool.currency !== currency && state.revenuePool.gross > 0) throw new Error('mixed-currency-not-supported');
  state.revenuePool.currency = currency;
  state.revenuePool.gross += value;
  state.revenuePool.unallocated += value;
  const entry = {id:uid('revenue'),amount:value,source,currency,at:now(),allocated:false};
  state.revenuePool.entries.push(entry);
  emit('revenue.received', {entryId:entry.id,amount:value,source,currency,allocation:'unallocated'});
  render();
  return clone(entry);
}

function setAllocationRule(rule) {
  const entries = Object.entries(rule || {}).filter(([,v]) => Number(v) > 0);
  const total = entries.reduce((n,[,v]) => n + Number(v), 0);
  if (Math.abs(total - 1) > 0.000001) throw new Error('allocation-rule-must-total-1');
  state.revenuePool.allocationRule = Object.fromEntries(entries.map(([k,v]) => [k,Number(v)]));
  emit('revenue.rule.set', {rule:clone(state.revenuePool.allocationRule)});
  return clone(state.revenuePool.allocationRule);
}

function allocateRevenue() {
  const rule = state.revenuePool.allocationRule;
  if (!rule) throw new Error('allocation-rule-not-set');
  const amount = state.revenuePool.unallocated;
  for (const [bucket,ratio] of Object.entries(rule)) state.revenuePool.allocations[bucket]=(state.revenuePool.allocations[bucket]||0)+amount*ratio;
  state.revenuePool.unallocated=0;
  for (const entry of state.revenuePool.entries) entry.allocated=true;
  emit('revenue.allocated', {amount,rule:clone(rule),allocations:clone(state.revenuePool.allocations)});
  render();
  return clone(state.revenuePool);
}

function planCampaign({goal,audience='',offer='',channels=[]}) {
  const plan = {id:uid('campaign-plan'),createdAt:now(),status:'draft-only',goal:String(goal||'Reach the right people'),audience:String(audience||''),offer:String(offer||''),channels:[...channels],steps:['Define one measurable outcome.','Create one message variant per selected channel.','Publish only after user approval.','Record reach, interaction, leads, bookings or sales as separate outcomes.','Compare outcomes and revise the next plan.'],permissionsRequired:['publishExternal','spendMoney']};
  state.knowledge.outcomes.push({kind:'campaign-plan',plan});
  emit('business.campaign.planned', {plan:clone(plan)});
  return clone(plan);
}

function scanGaps() {
  const suggestions=[];
  const posts=state.socialPosts.length, offers=state.market.offers.length, requests=state.market.requests.length;
  const completed=state.interactions.filter(x=>x.type==='completed').length;
  if ((offers+requests)>0&&!state.pages.some(p=>p.active&&p.key==='market')) suggestions.push('Grow a Market page for current offers and requests.');
  if (posts>=3&&!state.pages.some(p=>p.active&&p.key==='analytics')) suggestions.push('Add outcome analytics so social activity can be tied to useful results.');
  if (completed>=2&&!state.pages.some(p=>p.active&&p.key==='circles')) suggestions.push('Grow Circles for recurring collaborators and shared projects.');
  if (state.revenuePool.gross>0&&!state.revenuePool.allocationRule) suggestions.push('Define a revenue allocation rule before distributing the future-product pool.');
  emit('growth.gap_scan', {suggestions});
  return suggestions;
}

function getState(){return clone(state);}
function resetAdaptiveOnly(){state=initialState();persist();emit('adaptive.reset',{scope:'adaptive-seed-only'});render();}

function ensureStyles(){
  if(document.getElementById('adaptive-seed-style'))return;
  const style=document.createElement('style');
  style.id='adaptive-seed-style';
  style.textContent='#stellar-seed{margin:12px 0;padding:14px;border:1px solid #3b2a48;border-radius:18px;background:linear-gradient(180deg,rgba(27,19,34,.96),rgba(12,9,16,.98));color:#f6eff9}#stellar-seed h2,#stellar-seed h3{margin:.3rem 0}.seedbar{display:flex;gap:7px;overflow:auto;margin:10px 0}.seedbtn{border:1px solid #4a3359;background:#1d1525;color:#eadff0;padding:9px 12px;border-radius:12px;white-space:nowrap}.seedbtn.active{border-color:#e348a7;background:#3a1730}.seedgrid{display:grid;grid-template-columns:repeat(12,1fr);gap:10px}.seedcard{grid-column:span 6;border:1px solid #35263f;background:#100c15;border-radius:14px;padding:12px}.seedwide{grid-column:span 12}.seedinput,.seedarea{width:100%;box-sizing:border-box;border:1px solid #3b2a48;background:#09070c;color:#f6eff9;border-radius:10px;padding:9px;margin:5px 0}.seedarea{min-height:80px}.seedaction{border:1px solid #553664;background:#2a1934;color:white;padding:8px 10px;border-radius:10px;margin:4px 4px 4px 0}.seedprimary{background:linear-gradient(135deg,#b63785,#7044be);border-color:transparent}.seedmuted{font-size:12px;color:#aa98b4}.seedmono{font:11px ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere}.seedpill{display:inline-block;border:1px solid #3b2a48;border-radius:999px;padding:3px 7px;margin:2px;font-size:10px;color:#bdaac7}.seeditem{border-top:1px solid #2b2032;padding:9px 0}.seedgood{color:#7ce7b7}@media(max-width:760px){.seedcard{grid-column:span 12}}';
  document.head.append(style);
}

function button(label,onclick,cls=''){const b=document.createElement('button');b.className='seedaction '+cls;b.textContent=label;b.onclick=onclick;return b;}

function renderSocial(root){
  root.innerHTML='<div class="seedgrid"><div class="seedcard"><h3>Social</h3><p class="seedmuted">Typed interaction feeds learning. HD matching is intentionally not active yet.</p><textarea class="seedarea" id="socialText" placeholder="Share an idea, need, result, or opportunity"></textarea><button class="seedaction seedprimary" id="socialPost">Post locally</button></div><div class="seedcard"><h3>Signals</h3><div class="seedmono">'+esc(JSON.stringify(state.knowledge.signals,null,2))+'</div></div><div class="seedcard seedwide" id="socialFeed"></div></div>';
  root.querySelector('#socialPost').onclick=()=>{const input=root.querySelector('#socialText');if(!input.value.trim())return;postSocial({text:input.value});input.value='';};
  const feed=root.querySelector('#socialFeed');if(!state.socialPosts.length)feed.innerHTML='<p class="seedmuted">No posts yet.</p>';
  for(const post of state.socialPosts.slice(0,20)){const row=document.createElement('div');row.className='seeditem';row.innerHTML='<div>'+esc(post.text)+'</div><div class="seedmuted">'+esc(post.at)+'</div><div class="feedback"></div>';const f=row.querySelector('.feedback');for(const type of FEEDBACK_TYPES)f.append(button('+'+type.replace('_',' ')+' '+(post.feedback[type]||''),()=>feedback(post.id,type)));feed.append(row);}
}

function renderPaper(root){
  root.innerHTML='<div class="seedgrid"><div class="seedcard"><h3>Paper</h3><input id="paperTitle" class="seedinput" placeholder="Title"><input id="paperPurpose" class="seedinput" placeholder="What should this become or accomplish?"><textarea id="paperContent" class="seedarea" placeholder="Notes, copy, requirements, rough idea"></textarea><button id="paperSave" class="seedaction seedprimary">Save artifact</button></div><div class="seedcard"><h3>Rule</h3><p class="seedmuted">Paper creates artifacts. Builder decides whether an artifact needs a new capability. Existing capabilities are extended before new ones are grown.</p></div><div class="seedcard seedwide" id="paperList"></div></div>';
  root.querySelector('#paperSave').onclick=()=>createPaperDoc({title:root.querySelector('#paperTitle').value,purpose:root.querySelector('#paperPurpose').value,content:root.querySelector('#paperContent').value});
  const list=root.querySelector('#paperList');if(!state.paperDocs.length)list.innerHTML='<p class="seedmuted">No Paper artifacts yet.</p>';
  for(const doc of state.paperDocs.slice().reverse().slice(0,20)){const row=document.createElement('div');row.className='seeditem';row.innerHTML='<b>'+esc(doc.title)+'</b><div class="seedmuted">'+esc(doc.purpose)+'</div>';row.append(button('Ask Builder',()=>{const p=paperToGrowth(doc.id);buildSandbox(p.id);render();}));list.append(row);}
}

function renderBuilder(root){
  root.innerHTML='<div class="seedgrid"><div class="seedcard"><h3>Auto Builder</h3><p class="seedmuted">Describe a gap. The system may build a sandbox automatically, but activation remains user-controlled.</p><textarea id="builderNeed" class="seedarea" placeholder="What are you trying to do that the system cannot do well yet?"></textarea><button id="builderPropose" class="seedaction seedprimary">Analyze + build sandbox</button><button id="gapScan" class="seedaction">Scan observed gaps</button><pre id="gapOut" class="seedmono"></pre></div><div class="seedcard"><h3>Growth rules</h3><span class="seedpill">extend first</span><span class="seedpill">compose second</span><span class="seedpill">grow third</span><span class="seedpill">sandbox before activation</span><span class="seedpill">receipt every change</span><span class="seedpill">rollback preserves history</span><p class="seedmuted">Worlds, stores, schedulers, marketing and other pages are optional growth, not seed requirements.</p></div><div class="seedcard seedwide" id="proposalList"></div><div class="seedcard seedwide"><h3>Active generated pages</h3><div id="generatedPages"></div></div></div>';
  root.querySelector('#builderPropose').onclick=()=>{const value=root.querySelector('#builderNeed').value.trim();if(!value)return;const p=propose(value);buildSandbox(p.id);render();};
  root.querySelector('#gapScan').onclick=()=>root.querySelector('#gapOut').textContent=scanGaps().join('\n')||'No structural gap inferred from current local evidence.';
  const list=root.querySelector('#proposalList');
  for(const p of state.proposals.slice().reverse().slice(0,30)){const row=document.createElement('div');row.className='seeditem';row.innerHTML='<b>'+esc(p.spec.title)+'</b> <span class="seedpill">'+esc(p.status)+'</span><div>'+esc(p.need)+'</div><div class="seedmuted">'+esc(p.spec.kind)+' · '+esc((p.spec.behavior||[]).join(', '))+'</div>';if(!p.sandbox)row.append(button('Build sandbox',()=>{buildSandbox(p.id);render();}));if(p.status!=='active'&&p.status!=='rolled_back')row.append(button('Approve + activate',()=>approveAndActivate(p.id),'seedprimary'));if(p.status==='active')row.append(button('Rollback',()=>rollback(p.id)));list.append(row);}
  renderGenerated(root.querySelector('#generatedPages'));
}

function renderGenerated(root){
  const active=state.pages.filter(x=>x.active);if(!active.length){root.innerHTML='<p class="seedmuted">Nothing generated is active yet.</p>';return;}root.innerHTML='';
  for(const page of active){const card=document.createElement('div');card.className='seeditem';card.innerHTML='<b>'+esc(page.title)+'</b> <span class="seedpill">'+esc(page.key)+'</span><div class="seedmuted">Grown from: '+esc(page.need)+'</div>';if(page.key==='market'||page.key==='store')card.append(button('Open market workspace',()=>openApp('market')));else if(page.key==='marketing-planner')card.append(button('Open planning workspace',()=>openApp('business')));root.append(card);}
}

function renderMarket(root){
  root.innerHTML='<div class="seedgrid"><div class="seedcard"><h3>Offer</h3><input id="offerTitle" class="seedinput" placeholder="What are you offering?"><input id="offerPrice" class="seedinput" type="number" step="0.01" placeholder="Price, optional"><button id="offerAdd" class="seedaction seedprimary">Add offer</button></div><div class="seedcard"><h3>Request</h3><input id="requestTitle" class="seedinput" placeholder="What do you need?"><input id="requestBudget" class="seedinput" type="number" step="0.01" placeholder="Budget, optional"><button id="requestAdd" class="seedaction seedprimary">Add request</button></div><div class="seedcard seedwide"><h3>Market core</h3><p class="seedmuted">Matching uses ordinary evidence now. The HD matcher socket exists but remains disabled until the canonical HD system is introduced.</p><pre class="seedmono">'+esc(JSON.stringify({offers:state.market.offers,requests:state.market.requests,hdMatcher:state.plugins['hd-matcher']},null,2))+'</pre></div><div class="seedcard seedwide"><h3>Revenue pool</h3><div class="seedmono">'+esc(JSON.stringify(state.revenuePool,null,2))+'</div></div></div>';
  root.querySelector('#offerAdd').onclick=()=>addOffer({title:root.querySelector('#offerTitle').value,price:root.querySelector('#offerPrice').value===''?null:Number(root.querySelector('#offerPrice').value)});
  root.querySelector('#requestAdd').onclick=()=>addRequest({title:root.querySelector('#requestTitle').value,budget:root.querySelector('#requestBudget').value===''?null:Number(root.querySelector('#requestBudget').value)});
}

function renderBusiness(root){
  root.innerHTML='<div class="seedgrid"><div class="seedcard"><h3>Marketing Planner</h3><input id="planGoal" class="seedinput" placeholder="Goal"><input id="planAudience" class="seedinput" placeholder="Audience"><input id="planOffer" class="seedinput" placeholder="Offer"><button id="makePlan" class="seedaction seedprimary">Create internal plan</button></div><div class="seedcard"><h3>Authority boundary</h3><p class="seedmuted">Planning can happen locally. Publishing, messaging people, changing prices, committing appointments, and spending money remain separate permissioned actions.</p></div><div class="seedcard seedwide"><pre id="planOut" class="seedmono"></pre></div></div>';
  root.querySelector('#makePlan').onclick=()=>{root.querySelector('#planOut').textContent=JSON.stringify(planCampaign({goal:root.querySelector('#planGoal').value,audience:root.querySelector('#planAudience').value,offer:root.querySelector('#planOffer').value}),null,2);};
}

function refreshOptionalButtons(){
  const section=document.querySelector('#stellar-seed');if(!section)return;
  const market=state.pages.some(p=>p.active&&(p.key==='market'||p.key==='store'));
  const business=state.pages.some(p=>p.active&&p.key==='marketing-planner');
  section.querySelector('#marketBtn').hidden=!market;
  section.querySelector('#businessBtn').hidden=!business;
}

function openApp(name,track=true){
  const root=document.querySelector('#seed-body');if(!root)return;
  document.querySelectorAll('.seedbtn').forEach(b=>b.classList.toggle('active',b.dataset.app===name));
  if(name==='lab'){document.querySelector('#stellar [data-sp="lab"]')?.click();document.querySelector('#stellar')?.scrollIntoView({behavior:'smooth'});use('lab');return;}
  root.dataset.app=name;
  if(name==='social')renderSocial(root);else if(name==='paper')renderPaper(root);else if(name==='builder')renderBuilder(root);else if(name==='market')renderMarket(root);else if(name==='business')renderBusiness(root);
  if(track&&SEED_APPS.includes(name))use(name,{opened:name});
}

function render(){const shell=document.querySelector('#stellar-seed');if(!shell)return;refreshOptionalButtons();const current=document.querySelector('#seed-body')?.dataset.app||'social';openApp(current,false);}

function mount(){
  ensureStyles();
  const main=document.querySelector('main')||document.body;
  const section=document.createElement('section');
  section.id='stellar-seed';
  section.innerHTML='<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><div class="seedmono" style="color:#e9b84a">STELLAR SEED</div><h2>Adaptive lab + business starter</h2><div class="seedmuted">Starts small. Learns from use. Builds sandboxes. The user controls activation.</div></div><div><span class="seedpill seedgood">LOCAL</span><span class="seedpill">RECEIPTS</span><span class="seedpill">ROLLBACK</span></div></div><div class="seedbar"><button class="seedbtn active" data-app="social">Social</button><button class="seedbtn" data-app="lab">Lab</button><button class="seedbtn" data-app="paper">Paper</button><button class="seedbtn" data-app="builder">Builder</button><button class="seedbtn" data-app="market" id="marketBtn" hidden>Market</button><button class="seedbtn" data-app="business" id="businessBtn" hidden>Marketing</button></div><div id="seed-body" data-app="social"></div>';
  main.prepend(section);
  section.querySelectorAll('.seedbtn').forEach(b=>b.onclick=()=>openApp(b.dataset.app));
  globalThis.addEventListener('stellar-adaptive-event',refreshOptionalButtons);
  refreshOptionalButtons();
  openApp('social');
}

globalThis.StellarAdaptive={get state(){return getState();},propose,buildSandbox,approveAndActivate,rollback,scanGaps,createPaperDoc,paperToGrowth,postSocial,feedback,addOffer,addRequest,recordRevenue,setAllocationRule,allocateRevenue,planCampaign,getState,resetAdaptiveOnly,feedbackTypes:[...FEEDBACK_TYPES]};

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
