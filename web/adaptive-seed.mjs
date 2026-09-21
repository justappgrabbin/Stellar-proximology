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
    paperArtifacts: [],
    generatedData: {},
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

function normalizeState(value){
  const base=initialState(), out={...base,...value};
  out.seedApps={...base.seedApps,...(value?.seedApps||{})};
  out.mechanisms={...base.mechanisms,...(value?.mechanisms||{})};
  out.permissions={...base.permissions,...(value?.permissions||{})};
  out.plugins={...base.plugins,...(value?.plugins||{})};
  out.market={...base.market,...(value?.market||{})};
  out.revenuePool={...base.revenuePool,...(value?.revenuePool||{})};
  out.knowledge={...base.knowledge,...(value?.knowledge||{})};
  out.paperDocs=Array.isArray(value?.paperDocs)?value.paperDocs:[];
  out.paperArtifacts=Array.isArray(value?.paperArtifacts)?value.paperArtifacts:[];
  out.generatedData=value?.generatedData&&typeof value.generatedData==='object'?value.generatedData:{};
  return out;
}

let state = normalizeState(load());
const runtimeAdapters = new Map();
const BUILTIN_BEHAVIORS = {
  market: new Set(['commerce']),
  'marketing-planner': new Set(['plan-campaigns','measure-response'])
};

function resonanceGraph(){ return globalThis.StellarProximology?.resonance || null; }

function registerAdapter(key, adapter) {
  if (!key || !adapter || typeof adapter !== 'object') throw new Error('adapter-required');
  runtimeAdapters.set(String(key), adapter);
  emit('adapter.registered', {key:String(key), runtimeOnly:true});
  return true;
}

function setPluginActive(key, active=true) {
  const plugin = state.plugins[key];
  if (!plugin) throw new Error('plugin-not-found');
  if (active && !runtimeAdapters.has(key)) throw new Error('plugin-adapter-not-registered');
  plugin.active = Boolean(active);
  emit('plugin.activation.changed', {key, active:plugin.active});
  return clone(plugin);
}


function stableHash(value){
  const source=String(value??'');
  let h1=0x811c9dc5,h2=0x9e3779b9;
  for(let i=0;i<source.length;i++){
    const n=source.charCodeAt(i);
    h1=Math.imul(h1^n,16777619)>>>0;
    h2=Math.imul(h2^(n+i),2246822519)>>>0;
  }
  return h1.toString(16).padStart(8,'0')+h2.toString(16).padStart(8,'0');
}

function downloadText(name,text,type='text/plain'){
  const blob=new Blob([String(text??'')],{type});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=String(name||'artifact.txt');a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function growthExists(key){
  return state.pages.some(x=>x.active&&x.key===key) ||
    state.proposals.some(x=>x.status!=='rolled_back'&&x.spec?.key===key);
}

function maybeAutoPropose(text,source){
  const spec=classifyNeed(text);
  if(spec.key.startsWith('custom-')||growthExists(spec.key))return null;
  const p=propose(text,source);
  buildSandbox(p.id);
  emit('growth.auto_proposed',{proposalId:p.id,source,key:spec.key,activation:'still-user-controlled'});
  return p;
}

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

  const existing=state.pages.find(x=>x.active&&x.key===p.spec.key);
  const dependencies=(p.spec.dependencies||[]).filter(key =>
    state.mechanisms[key]?.active || state.pages.some(x=>x.active&&x.key===key)
  );
  const mode=existing?'extend':dependencies.length?'compose':'grow';

  p.sandbox = {
    builtAt:now(),
    mode,
    targetPageId:existing?.id||null,
    manifest:{
      id:p.id,key:p.spec.key,title:p.spec.title,kind:p.spec.kind,
      dependencies:[...(p.spec.dependencies||[])],
      resolvedDependencies:dependencies,
      behavior:[...(p.spec.behavior||[])],
      permissions:[...(p.spec.permissions||[])],
      activation:'user-controlled',
      mutationPolicy:'derive-never-delete'
    }
  };
  if (p.status === 'proposed') p.status = 'sandboxed';
  emit('growth.sandboxed', {proposalId:p.id, mode, manifest:clone(p.sandbox.manifest)});
  return clone(p);
}

function approveAndActivate(proposalId) {
  const p = state.proposals.find(x => x.id === proposalId);
  if (!p) throw new Error('proposal-not-found');
  if (!p.sandbox) buildSandbox(proposalId);
  p.status = 'active';
  p.approvedAt = p.approvedAt || now();
  p.activatedAt = now();

  const builtin = BUILTIN_BEHAVIORS[p.spec.key] || new Set();
  const adapter = runtimeAdapters.get(p.spec.key);
  const wiredBehaviors = [];
  const pendingBehaviors = [];

  for (const behavior of p.spec.behavior || []) {
    const implemented = builtin.has(behavior) || Boolean(adapter?.behaviors?.includes?.(behavior));
    if (implemented) {
      wiredBehaviors.push(behavior);
      if (!state.behaviorRules.some(r => r.proposalId === p.id && r.behavior === behavior)) {
        state.behaviorRules.push({id:uid('rule'),proposalId:p.id,behavior,active:true,activatedAt:now(),implementation:builtin.has(behavior)?'builtin':'adapter'});
      }
    } else {
      pendingBehaviors.push(behavior);
    }
  }

  if (adapter?.activate) {
    const result = adapter.activate({proposal:clone(p), state:getState()});
    emit('adapter.activated', {key:p.spec.key, proposalId:p.id, result:result ?? null});
  }

  if (p.spec.visible) {
    const existing = p.sandbox?.targetPageId ? state.pages.find(x=>x.id===p.sandbox.targetPageId) : null;
    if (existing) {
      existing.extensions=existing.extensions||[];
      existing.extensions.push({proposalId:p.id,at:now(),need:p.need,wiredBehaviors,pendingBehaviors});
      existing.updatedAt=now();
    } else if (!state.pages.some(x => x.proposalId === p.id)) {
      const pageId=uid('page');
      state.pages.push({
        id:pageId,proposalId:p.id,key:p.spec.key,title:p.spec.title,
        createdAt:now(),updatedAt:now(),active:true,origin:'auto-builder',need:p.need,
        implementation:(builtin.size || adapter)?'wired-capability':'generated-workspace',
        wiredBehaviors,pendingBehaviors,extensions:[]
      });
      state.generatedData[pageId]=state.generatedData[pageId]||[];
    }
  }

  emit('growth.activated', {proposalId:p.id,userApproved:true,spec:clone(p.spec),wiredBehaviors,pendingBehaviors});
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

function createPaperArtifact({title,purpose,content='',parentId=null,kind='document'}) {
  const parent=parentId?state.paperArtifacts.find(x=>x.id===parentId):null;
  const createdAt=now();
  const body=String(content||'');
  const identity='paper-'+stableHash([title,purpose,body,parent?.identity||'',kind].join('\n'));
  const artifact={
    id:uid('paper'),identity,parentId:parent?.id||null,kind,
    title:String(title||'Untitled'),purpose:String(purpose||''),content:body,
    createdAt,immutable:true,lineageDepth:parent?(parent.lineageDepth||0)+1:0,
    status:'draft'
  };
  state.paperArtifacts.push(artifact);
  state.paperDocs.push({id:artifact.id,title:artifact.title,purpose:artifact.purpose,content:artifact.content,createdAt,updatedAt:createdAt,identity});
  use('paper',{artifactId:artifact.id,identity});
  emit('paper.artifact.created',{artifactId:artifact.id,identity,parentId:artifact.parentId,title:artifact.title,purpose:artifact.purpose});
  maybeAutoPropose(artifact.purpose||artifact.title,'paper-observation');
  render();
  return clone(artifact);
}

function createPaperDoc(input){ return createPaperArtifact(input); }

function derivePaperArtifact(parentId,changes={}) {
  const parent=state.paperArtifacts.find(x=>x.id===parentId);
  if(!parent)throw new Error('paper-parent-not-found');
  return createPaperArtifact({
    title:changes.title??parent.title,
    purpose:changes.purpose??parent.purpose,
    content:changes.content??parent.content,
    kind:changes.kind??parent.kind,
    parentId
  });
}

function paperToGrowth(docId) {
  const doc=state.paperArtifacts.find(x=>x.id===docId)||state.paperDocs.find(x=>x.id===docId);
  if (!doc) throw new Error('paper-doc-not-found');
  const existing=state.proposals.find(x=>x.status!=='rolled_back'&&x.source==='paper'&&x.paperArtifactId===docId);
  if(existing)return clone(existing);
  const p=propose(doc.purpose||doc.title,'paper');
  const live=state.proposals.find(x=>x.id===p.id);if(live)live.paperArtifactId=docId;
  return clone(live||p);
}

function exportPaperArtifact(docId,format='html'){
  const doc=state.paperArtifacts.find(x=>x.id===docId)||state.paperDocs.find(x=>x.id===docId);
  if(!doc)throw new Error('paper-doc-not-found');
  if(format==='json'){
    downloadText((doc.title||'paper').replace(/[^a-z0-9_-]+/gi,'-')+'.json',JSON.stringify(doc,null,2),'application/json');
    return true;
  }
  const html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(doc.title)+'</title></head><body><main><h1>'+esc(doc.title)+'</h1><p>'+esc(doc.purpose)+'</p><pre style="white-space:pre-wrap">'+esc(doc.content)+'</pre></main></body></html>';
  downloadText((doc.title||'paper').replace(/[^a-z0-9_-]+/gi,'-')+'.html',html,'text/html');
  emit('paper.exported',{artifactId:doc.id,format:'html'});
  return true;
}

async function executePaperArtifact(docId){
  const doc=state.paperArtifacts.find(x=>x.id===docId)||state.paperDocs.find(x=>x.id===docId);
  if(!doc)throw new Error('paper-doc-not-found');
  const execution=globalThis.StellarProximology?.execution;
  if(!execution?.execute)throw new Error('paper-execution-bridge-unavailable');
  const result=await execution.execute({name:(doc.title||'paper')+'.html',originalName:(doc.title||'paper')+'.html',content:doc.content,bytes:new TextEncoder().encode(doc.content)},{source:'adaptive-paper',paperId:doc.id});
  state.knowledge.outcomes.push({kind:'paper-execution',artifactId:doc.id,result,at:now()});
  emit('paper.executed',{artifactId:doc.id,ok:Boolean(result?.ok||result?.result?.ok)});
  render();
  return clone(result);
}

function postSocial({author='local',text}) {
  const value = String(text || '').trim();
  if (!value) throw new Error('post-required');
  const post = {id:uid('post'),author,text:value,at:now(),feedback:{}};
  state.socialPosts.unshift(post);
  try {
    const graph=resonanceGraph();
    if(graph){
      const authorNode='social-author:'+author, postNode='social-post:'+post.id;
      graph.addNode(authorNode,{kind:'social-author'});
      graph.addNode(postNode,{kind:'social-post',text:value.slice(0,240)});
      graph.connect(authorNode,postNode,{weight:1});
      graph.observe({a:authorNode,b:postNode,outcome:1,type:'social-post',verified:true,evidence:{source:'adaptive-seed',postId:post.id}});
    }
  } catch(error) {
    emit('social.resonance-write-failed',{postId:post.id,error:String(error?.message||error)});
  }
  use('social', {postId:post.id});
  emit('social.posted', {postId:post.id,author});
  maybeAutoPropose(value,'social-observation');
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
  try {
    const graph=resonanceGraph();
    if(graph && post){
      const actorNode='social-author:'+actor, postNode='social-post:'+post.id;
      graph.addNode(actorNode,{kind:'social-author'});
      graph.addNode(postNode,{kind:'social-post'});
      graph.connect(actorNode,postNode,{weight:0});
      graph.observe({a:actorNode,b:postNode,outcome:1,type:'typed-feedback:'+type,verified:true,evidence:{source:'adaptive-seed',feedbackId:row.id}});
    }
  } catch(error) {
    emit('feedback.resonance-write-failed',{feedbackId:row.id,error:String(error?.message||error)});
  }
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


function wordSet(value){
  return new Set(String(value||'').toLowerCase().match(/[a-z0-9]+/g)?.filter(x=>x.length>2) || []);
}

function similarity(a,b){
  const A=wordSet(a), B=wordSet(b);
  if(!A.size||!B.size)return 0;
  let hit=0; for(const x of A) if(B.has(x)) hit++;
  return hit / new Set([...A,...B]).size;
}

function findMarketMatches(){
  const out=[];
  const hdPlugin=state.plugins['hd-matcher'];
  const hdAdapter=hdPlugin?.active ? runtimeAdapters.get('hd-matcher') : null;
  for(const request of state.market.requests.filter(x=>x.status==='open')){
    for(const offer of state.market.offers.filter(x=>x.status==='open')){
      if(request.currency!==offer.currency)continue;
      if(request.budget!==null&&offer.price!==null&&offer.price>request.budget)continue;
      const textScore=similarity(request.title+' '+request.description,offer.title+' '+offer.description);
      const feedbackScore=Math.min(1,(state.knowledge.signals['feedback:completed']||0)/10);
      let hdScore=null;
      if(hdAdapter?.score){
        try{hdScore=Number(hdAdapter.score({offer:clone(offer),request:clone(request),state:getState()}));}
        catch(error){emit('market.hd-score-failed',{offerId:offer.id,requestId:request.id,error:String(error?.message||error)});}
      }
      const score=Math.max(0,Math.min(1,textScore*0.8+feedbackScore*0.2+(Number.isFinite(hdScore)?Math.max(-.2,Math.min(.2,hdScore*.2)):0)));
      out.push({id:uid('match'),offerId:offer.id,requestId:request.id,score:Number(score.toFixed(4)),signals:{text:textScore,typedFeedback:feedbackScore,hd:hdScore},createdAt:now(),status:'candidate'});
    }
  }
  state.market.matches=out.sort((a,b)=>b.score-a.score);
  emit('market.matches.updated',{count:out.length,hdActive:Boolean(hdAdapter)});
  render();
  return clone(state.market.matches);
}

function createAgreement(offerId,requestId,terms={}){
  const offer=state.market.offers.find(x=>x.id===offerId), request=state.market.requests.find(x=>x.id===requestId);
  if(!offer||!request)throw new Error('offer-or-request-not-found');
  const agreement={id:uid('agreement'),offerId,requestId,terms:clone(terms),status:'active',createdAt:now(),userApproved:true};
  state.market.agreements.push(agreement);
  offer.status='matched';request.status='matched';
  emit('market.agreement.created',{agreementId:agreement.id,offerId,requestId,userApproved:true});
  render();
  return clone(agreement);
}

function fulfillAgreement(agreementId,evidence=''){
  const agreement=state.market.agreements.find(x=>x.id===agreementId);
  if(!agreement)throw new Error('agreement-not-found');
  agreement.status='fulfilled';
  agreement.fulfilledAt=now();
  const fulfillment={id:uid('fulfillment'),agreementId,evidence:String(evidence||''),at:agreement.fulfilledAt};
  const receipt={id:uid('receipt'),agreementId,fulfillmentId:fulfillment.id,at:agreement.fulfilledAt,kind:'market-fulfillment'};
  state.market.fulfillments.push(fulfillment);
  state.market.receipts.push(receipt);
  emit('market.fulfilled',{agreementId,fulfillmentId:fulfillment.id,receiptId:receipt.id});
  render();
  return {fulfillment:clone(fulfillment),receipt:clone(receipt)};
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
  const previous=state.knowledge.outcomes.filter(x=>x.kind==='campaign-plan'&&x.plan?.results?.length);
  const learned=previous.length?previous.slice(-3).map(x=>x.plan.learnedRecommendation).filter(Boolean):[];
  const plan = {
    id:uid('campaign-plan'),createdAt:now(),status:'draft-only',
    goal:String(goal||'Reach the right people'),audience:String(audience||''),offer:String(offer||''),channels:[...channels],
    steps:['Define one measurable outcome.','Create one message variant per selected channel.','Publish only after user approval.','Record reach, interaction, leads, bookings or sales as separate outcomes.','Compare outcomes and revise the next plan.'],
    learnedFromPrior:learned,
    results:[],
    learnedRecommendation:null,
    permissionsRequired:['publishExternal','spendMoney']
  };
  state.knowledge.outcomes.push({kind:'campaign-plan',plan});
  emit('business.campaign.planned', {plan:clone(plan),learnedFromPrior:learned});
  return clone(plan);
}

function recordCampaignOutcome(planId,metrics={}){
  const holder=state.knowledge.outcomes.find(x=>x.kind==='campaign-plan'&&x.plan?.id===planId);
  if(!holder)throw new Error('campaign-plan-not-found');
  const num=key=>Math.max(0,Number(metrics[key])||0);
  const impressions=num('impressions'),clicks=num('clicks'),leads=num('leads'),sales=num('sales'),revenue=num('revenue');
  const result={
    id:uid('campaign-result'),at:now(),impressions,clicks,leads,sales,revenue,
    ctr:impressions?clicks/impressions:0,
    leadRate:clicks?leads/clicks:0,
    closeRate:leads?sales/leads:0,
    revenuePerSale:sales?revenue/sales:0
  };
  let recommendation='Keep testing small variants and compare measured outcomes.';
  if(impressions>=50&&result.ctr<0.02)recommendation='Revise the message or creative before increasing reach.';
  else if(clicks>=10&&result.leadRate<0.05)recommendation='The message gets attention; revise the offer or destination for clearer intent.';
  else if(leads>=5&&result.closeRate<0.10)recommendation='Interest exists; improve follow-up, trust signals, pricing clarity, or fulfillment explanation.';
  else if(sales>0)recommendation='This path produced sales. Preserve the winning message and test one controlled variation at a time.';
  holder.plan.results.push(result);
  holder.plan.learnedRecommendation=recommendation;
  state.knowledge.signals['campaign:measured']=(state.knowledge.signals['campaign:measured']||0)+1;
  emit('business.campaign.measured',{planId,result:clone(result),recommendation});
  render();
  return {result:clone(result),recommendation};
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

function addGeneratedRecord(pageId,{title,details='',status='active'}){
  const page=state.pages.find(x=>x.id===pageId&&x.active);
  if(!page)throw new Error('generated-page-not-found');
  const row={id:uid('record'),title:String(title||'Untitled'),details:String(details||''),status:String(status||'active'),at:now()};
  state.generatedData[pageId]=state.generatedData[pageId]||[];
  state.generatedData[pageId].push(row);
  emit('generated.record.created',{pageId,recordId:row.id,key:page.key});
  render();
  return clone(row);
}

function renderGenericWorkspace(root,page){
  const rows=state.generatedData[page.id]||[];
  root.innerHTML='<div class="seedgrid"><div class="seedcard"><h3>'+esc(page.title)+'</h3><p class="seedmuted">'+esc(page.need)+'</p><input id="genericTitle" class="seedinput" placeholder="Record title"><textarea id="genericDetails" class="seedarea" placeholder="Details"></textarea><button id="genericAdd" class="seedaction seedprimary">Add record</button></div><div class="seedcard"><h3>Implementation state</h3><div class="seedmono">'+esc(JSON.stringify({implementation:page.implementation,wiredBehaviors:page.wiredBehaviors,pendingBehaviors:page.pendingBehaviors,extensions:page.extensions||[]},null,2))+'</div></div><div class="seedcard seedwide" id="genericRows"></div></div>';
  root.querySelector('#genericAdd').onclick=()=>addGeneratedRecord(page.id,{title:root.querySelector('#genericTitle').value,details:root.querySelector('#genericDetails').value});
  const list=root.querySelector('#genericRows');
  if(!rows.length)list.innerHTML='<p class="seedmuted">Workspace is active. No records yet.</p>';
  for(const row of rows.slice().reverse()){const div=document.createElement('div');div.className='seeditem';div.innerHTML='<b>'+esc(row.title)+'</b> <span class="seedpill">'+esc(row.status)+'</span><div>'+esc(row.details)+'</div>';list.append(div);}
}

function renderSocial(root){
  root.innerHTML='<div class="seedgrid"><div class="seedcard"><h3>Social</h3><p class="seedmuted">Typed interaction feeds learning. HD matching is intentionally not active yet.</p><textarea class="seedarea" id="socialText" placeholder="Share an idea, need, result, or opportunity"></textarea><button class="seedaction seedprimary" id="socialPost">Post locally</button></div><div class="seedcard"><h3>Signals</h3><div class="seedmono">'+esc(JSON.stringify(state.knowledge.signals,null,2))+'</div></div><div class="seedcard seedwide" id="socialFeed"></div></div>';
  root.querySelector('#socialPost').onclick=()=>{const input=root.querySelector('#socialText');if(!input.value.trim())return;postSocial({text:input.value});input.value='';};
  const feed=root.querySelector('#socialFeed');if(!state.socialPosts.length)feed.innerHTML='<p class="seedmuted">No posts yet.</p>';
  for(const post of state.socialPosts.slice(0,20)){const row=document.createElement('div');row.className='seeditem';row.innerHTML='<div>'+esc(post.text)+'</div><div class="seedmuted">'+esc(post.at)+'</div><div class="feedback"></div>';const f=row.querySelector('.feedback');for(const type of FEEDBACK_TYPES)f.append(button('+'+type.replace('_',' ')+' '+(post.feedback[type]||''),()=>feedback(post.id,type)));feed.append(row);}
}

function renderPaper(root){
  root.innerHTML='<div class="seedgrid"><div class="seedcard"><h3>Paper</h3><p class="seedmuted">Every save creates a new immutable artifact. Originals are preserved.</p><input id="paperTitle" class="seedinput" placeholder="Title"><input id="paperPurpose" class="seedinput" placeholder="What should this become or accomplish?"><textarea id="paperContent" class="seedarea" placeholder="Notes, HTML, code, requirements, rough idea"></textarea><button id="paperSave" class="seedaction seedprimary">Create Paper</button></div><div class="seedcard"><h3>Paper runtime</h3><span class="seedpill">immutable revisions</span><span class="seedpill">lineage</span><span class="seedpill">execute</span><span class="seedpill">export</span><span class="seedpill">Builder handoff</span><p class="seedmuted">Paper uses the existing Stellar execution bridge rather than inventing a second executor.</p></div><div class="seedcard seedwide" id="paperList"></div></div>';
  root.querySelector('#paperSave').onclick=()=>createPaperArtifact({title:root.querySelector('#paperTitle').value,purpose:root.querySelector('#paperPurpose').value,content:root.querySelector('#paperContent').value});
  const list=root.querySelector('#paperList'),docs=state.paperArtifacts.length?state.paperArtifacts:state.paperDocs;
  if(!docs.length)list.innerHTML='<p class="seedmuted">No Paper artifacts yet.</p>';
  for(const doc of docs.slice().reverse().slice(0,30)){
    const row=document.createElement('div');row.className='seeditem';
    row.innerHTML='<b>'+esc(doc.title)+'</b> <span class="seedpill">'+esc(doc.identity||doc.id)+'</span><div class="seedmuted">'+esc(doc.purpose)+' · lineage '+esc(doc.lineageDepth||0)+'</div>';
    row.append(button('Derive',()=>derivePaperArtifact(doc.id,{title:doc.title+' v'+((doc.lineageDepth||0)+2)})));
    row.append(button('Ask Builder',()=>{const p=paperToGrowth(doc.id);buildSandbox(p.id);render();},'seedprimary'));
    row.append(button('Run',()=>executePaperArtifact(doc.id).catch(error=>emit('paper.execution-failed',{artifactId:doc.id,error:String(error?.message||error)}))));
    row.append(button('Export HTML',()=>exportPaperArtifact(doc.id,'html')));
    row.append(button('Export JSON',()=>exportPaperArtifact(doc.id,'json')));
    list.append(row);
  }
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
  const active=state.pages.filter(x=>x.active);
  if(!active.length){root.innerHTML='<p class="seedmuted">Nothing generated is active yet.</p>';return;}
  root.innerHTML='';
  for(const page of active){
    const card=document.createElement('div');card.className='seeditem';
    const pending=(page.pendingBehaviors||[]);
    card.innerHTML='<b>'+esc(page.title)+'</b> <span class="seedpill">'+esc(page.key)+'</span><span class="seedpill">'+esc(page.implementation||'generated-workspace')+'</span><div class="seedmuted">Grown from: '+esc(page.need)+'</div>'+(pending.length?'<div class="seedmuted">Behavior still unwired: '+esc(pending.join(', '))+'</div>':'');
    if(page.key==='market'||page.key==='store')card.append(button('Open market workspace',()=>openApp('market')));
    else if(page.key==='marketing-planner')card.append(button('Open planning workspace',()=>openApp('business')));
    else card.append(button('Open workspace',()=>openApp('generated:'+page.id)));
    root.append(card);
  }
}

function renderMarket(root){
  root.innerHTML='<div class="seedgrid"><div class="seedcard"><h3>Offer</h3><input id="offerTitle" class="seedinput" placeholder="What are you offering?"><input id="offerPrice" class="seedinput" type="number" step="0.01" placeholder="Price, optional"><button id="offerAdd" class="seedaction seedprimary">Add offer</button></div><div class="seedcard"><h3>Request</h3><input id="requestTitle" class="seedinput" placeholder="What do you need?"><input id="requestBudget" class="seedinput" type="number" step="0.01" placeholder="Budget, optional"><button id="requestAdd" class="seedaction seedprimary">Add request</button></div><div class="seedcard seedwide"><h3>Market core</h3><p class="seedmuted">Matching uses ordinary evidence now. The HD matcher socket exists but remains disabled until the canonical HD system is introduced.</p><button id="findMatches" class="seedaction">Find matches</button><div id="matchList"></div></div><div class="seedcard seedwide"><h3>Agreements</h3><div id="agreementList"></div></div><div class="seedcard seedwide"><h3>Revenue pool</h3><input id="revenueAmount" class="seedinput" type="number" min="0" step="0.01" placeholder="Platform revenue to record"><button id="revenueAdd" class="seedaction">Record unallocated revenue</button><div class="seedmono" id="revenueState"></div></div></div>';
  root.querySelector('#offerAdd').onclick=()=>addOffer({title:root.querySelector('#offerTitle').value,price:root.querySelector('#offerPrice').value===''?null:Number(root.querySelector('#offerPrice').value)});
  root.querySelector('#requestAdd').onclick=()=>addRequest({title:root.querySelector('#requestTitle').value,budget:root.querySelector('#requestBudget').value===''?null:Number(root.querySelector('#requestBudget').value)});
  root.querySelector('#findMatches').onclick=()=>findMarketMatches();
  root.querySelector('#revenueAdd').onclick=()=>{const value=Number(root.querySelector('#revenueAmount').value);if(Number.isFinite(value)&&value>=0)recordRevenue(value);};

  const matches=root.querySelector('#matchList');
  if(!state.market.matches.length)matches.innerHTML='<p class="seedmuted">No candidate matches calculated yet.</p>';
  for(const m of state.market.matches.slice(0,20)){
    const offer=state.market.offers.find(x=>x.id===m.offerId), request=state.market.requests.find(x=>x.id===m.requestId);
    const row=document.createElement('div');row.className='seeditem';row.innerHTML='<b>'+esc(offer?.title||m.offerId)+' ↔ '+esc(request?.title||m.requestId)+'</b><div class="seedmuted">score '+m.score+' · HD '+(m.signals.hd===null?'inactive':esc(m.signals.hd))+'</div>';
    row.append(button('Create agreement',()=>createAgreement(m.offerId,m.requestId,{matchScore:m.score}),'seedprimary'));
    matches.append(row);
  }
  const agreements=root.querySelector('#agreementList');
  if(!state.market.agreements.length)agreements.innerHTML='<p class="seedmuted">No agreements yet.</p>';
  for(const a of state.market.agreements.slice().reverse()){
    const row=document.createElement('div');row.className='seeditem';row.innerHTML='<b>'+esc(a.id)+'</b> <span class="seedpill">'+esc(a.status)+'</span>';
    if(a.status==='active')row.append(button('Mark fulfilled',()=>fulfillAgreement(a.id)));
    agreements.append(row);
  }
  root.querySelector('#revenueState').textContent=JSON.stringify(state.revenuePool,null,2);
}

function renderBusiness(root){
  const plans=state.knowledge.outcomes.filter(x=>x.kind==='campaign-plan').map(x=>x.plan);
  root.innerHTML='<div class="seedgrid"><div class="seedcard"><h3>Marketing Planner</h3><input id="planGoal" class="seedinput" placeholder="Goal"><input id="planAudience" class="seedinput" placeholder="Audience"><input id="planOffer" class="seedinput" placeholder="Offer"><input id="planChannels" class="seedinput" placeholder="Channels, comma separated"><button id="makePlan" class="seedaction seedprimary">Create internal plan</button></div><div class="seedcard"><h3>Authority boundary</h3><p class="seedmuted">Planning and measurement happen locally. Publishing, messaging people, changing prices, committing appointments, and spending money remain separate permissioned actions.</p></div><div class="seedcard seedwide" id="campaignList"></div></div>';
  root.querySelector('#makePlan').onclick=()=>planCampaign({goal:root.querySelector('#planGoal').value,audience:root.querySelector('#planAudience').value,offer:root.querySelector('#planOffer').value,channels:root.querySelector('#planChannels').value.split(',').map(x=>x.trim()).filter(Boolean)});
  const list=root.querySelector('#campaignList');
  if(!plans.length)list.innerHTML='<p class="seedmuted">No campaign plans yet.</p>';
  for(const plan of plans.slice().reverse()){
    const row=document.createElement('div');row.className='seeditem';
    row.innerHTML='<b>'+esc(plan.goal)+'</b> <span class="seedpill">'+esc(plan.status)+'</span><div class="seedmuted">'+esc(plan.audience)+' · '+esc(plan.offer)+'</div><div class="seedmuted">'+esc(plan.learnedRecommendation||'No measured outcome yet.')+'</div><div class="campaign-measure"></div>';
    const form=row.querySelector('.campaign-measure');
    for(const key of ['impressions','clicks','leads','sales','revenue']){const input=document.createElement('input');input.className='seedinput';input.type='number';input.min='0';input.step=key==='revenue'?'0.01':'1';input.placeholder=key;input.dataset.metric=key;form.append(input);}
    form.append(button('Record outcome',()=>{const metrics={};form.querySelectorAll('[data-metric]').forEach(input=>metrics[input.dataset.metric]=input.value);recordCampaignOutcome(plan.id,metrics);},'seedprimary'));
    list.append(row);
  }
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
  if(name==='social')renderSocial(root);else if(name==='paper')renderPaper(root);else if(name==='builder')renderBuilder(root);else if(name==='market')renderMarket(root);else if(name==='business')renderBusiness(root);else if(name.startsWith('generated:')){const page=state.pages.find(x=>x.id===name.slice(10));if(page)renderGenericWorkspace(root,page);}
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
  globalThis.addEventListener('stellar-lab-event',event=>{
    const row=clone(event.detail||{});
    state.knowledge.outcomes.push({kind:'lab-evidence',row,at:now()});
    state.knowledge.signals['lab:'+String(row.kind||'event')]=(state.knowledge.signals['lab:'+String(row.kind||'event')]||0)+1;
    emit('lab.evidence.observed',{labEventId:row.id||null,kind:row.kind||'event'});
  });
  globalThis.addEventListener('stellar-ingest-event',event=>{
    const row=clone(event.detail||{});
    if(row.type==='capsule.ingest.completed'){
      state.knowledge.outcomes.push({kind:'system-capsule',capsuleId:row.capsuleId,summary:row.summary,at:now()});
      state.knowledge.signals['ingest:systems']=(state.knowledge.signals['ingest:systems']||0)+1;
      emit('ingest.system.observed',{capsuleId:row.capsuleId,summary:row.summary||null});
    }else if(row.type==='capsule.integration.changed'&&row.installed){
      state.knowledge.signals['ingest:integrated']=(state.knowledge.signals['ingest:integrated']||0)+1;
      emit('ingest.system.integrated',{capsuleId:row.capsuleId,target:row.target||null});
    }
  });
  refreshOptionalButtons();
  openApp('social');
}

globalThis.StellarAdaptive={get state(){return getState();},propose,buildSandbox,approveAndActivate,rollback,scanGaps,createPaperDoc,createPaperArtifact,derivePaperArtifact,paperToGrowth,exportPaperArtifact,executePaperArtifact,addGeneratedRecord,postSocial,feedback,addOffer,addRequest,findMarketMatches,createAgreement,fulfillAgreement,recordRevenue,setAllocationRule,allocateRevenue,planCampaign,recordCampaignOutcome,registerAdapter,setPluginActive,getState,resetAdaptiveOnly,feedbackTypes:[...FEEDBACK_TYPES]};

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
