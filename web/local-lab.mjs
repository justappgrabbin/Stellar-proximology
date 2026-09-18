import { calculateHumanDesign, activeChannels } from './lab/pure-synthia/state-space/human-design.js';
import { CLAIM_STATUS } from './lab/pure-synthia/state-space/claim-status.js';
import { HypothesisRegistry, Hypothesis } from './lab/pure-synthia/experiments/hypothesis-registry.js';
import { UniversalExecutionBridge } from './lab/pure-synthia/integration/universal-execution-bridge.js';
import ResonanceNetwork from './lab/pure-synthia/engine/resonance-network.js';
import { buildHopfieldNetwork, gateToPattern, settle, identifyAttractor } from './neural/hopfieldAttractor.js';
import { inferHumanDesignGNN, TRAINING_METADATA } from './neural-hd/humanDesignGNN.mjs';

const STORE='stellar.proximology.lab.v1';
let state=(()=>{try{return JSON.parse(localStorage.getItem(STORE)||'null')||{charts:[],runs:[],claims:[],network:null}}catch{return{charts:[],runs:[],claims:[],network:null}}})();
const save=()=>localStorage.setItem(STORE,JSON.stringify(state));
const claims=new HypothesisRegistry();
const resonance=new ResonanceNetwork();
const execution=new UniversalExecutionBridge({remember:true});
let address=state.charts.at(-1)?.address||'P? · D? · G? · L? · C? · T? · B? · ?°?′?″ · A? · Z? · H?';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const parse=v=>{if(v&&typeof v==='object')return v;try{return JSON.parse(String(v||'{}'))}catch{return{ok:false,error:String(v||'invalid')}}};
const b64=bytes=>{let x='';for(let i=0;i<bytes.length;i+=32768)x+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(x)};
const safe=s=>String(s||'artifact').replace(/[^A-Za-z0-9._()+ -]/g,'_').slice(0,120)||'artifact';

function record(kind,payload){
  const row={id:kind+'-'+Date.now().toString(36),kind,at:new Date().toISOString(),...payload};
  if(kind==='chart')state.charts.push(row);
  if(kind==='run')state.runs.push(row);
  if(kind==='claim')state.claims.push(row);
  save();return row;
}

function formatAddress(p={}){
  const arc=Math.round((Number(p.longitude)||0)*3600);
  return ['P'+(p.planet||'Sun'),'DBeing','G'+(p.gate??'?'),'L'+(p.line??'?'),'C'+(p.color??'?'),'T'+(p.tone??'?'),'B'+(p.base??'?'),(p.degree??'?')+'°'+(p.minute??'?')+'′'+(p.second??'?')+'″','A'+arc,'Z'+(p.zodiac??'?'),'H?'].join(' · ');
}

function hopfield(bytes){
  let h=2166136261;for(let i=0;i<Math.min(bytes.length,8192);i++){h^=bytes[i];h=Math.imul(h,16777619)}
  const g=((h>>>0)%64)+1,w=n=>((n-1)%64+64)%64+1,stored=[g,w(g+7),w(g+13),w(g+29),w(g+43)];
  const net=buildHopfieldNetwork(stored),noisy=[...gateToPattern(g)];
  if(noisy.length)noisy[(g+bytes.length)%noisy.length]*=-1;
  const r=settle(net,noisy);
  return {network:'Hopfield',dimensions:net.dimensions,storedGates:stored,seedGate:g,attractor:identifyAttractor(net,r.finalState),iterations:r.iterations,energyTrace:r.energyTrace};
}

function addStyle(){
  const s=document.createElement('style');
  s.textContent=':root{--bg:#08070b!important;--panel:#15111b!important;--panel-2:#1c1624!important;--line:#32253e!important;--text:#f5f0f7!important;--muted:#a695ad!important;--accent:#e9b84a!important}body{background:radial-gradient(circle at 16% 12%,rgba(227,72,167,.11),transparent 28%),radial-gradient(circle at 82% 18%,rgba(233,184,74,.08),transparent 26%),radial-gradient(circle at 50% 88%,rgba(79,207,155,.08),transparent 32%),#08070b!important}header h1{color:#e348a7!important}.spg{display:grid;grid-template-columns:repeat(12,1fr);gap:12px}.spc{grid-column:span 6;background:linear-gradient(180deg,rgba(29,22,37,.95),rgba(19,15,25,.96));border:1px solid var(--line);border-radius:18px;padding:16px}.spw{grid-column:span 12}.spf{display:grid;gap:5px;margin:8px 0}.spf label{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}.spi,.spa{width:100%;background:#0d0a11;border:1px solid var(--line);color:var(--text);border-radius:11px;padding:10px}.spa{min-height:80px}.spb{border:1px solid var(--line);background:#1c1624;color:var(--text);padding:9px 12px;border-radius:11px;cursor:pointer}.spb.primary{background:linear-gradient(135deg,#b63785,#7a3fc4);border-color:transparent}.spp{display:inline-flex;padding:4px 8px;border-radius:999px;border:1px solid var(--line);font:10px ui-monospace,monospace;color:var(--muted);margin:2px}.spcode{white-space:pre-wrap;max-height:360px;overflow:auto;background:#0a080d;border:1px solid var(--line);border-radius:12px;padding:10px;font:10px ui-monospace,monospace}.spaddr{font:11px ui-monospace,monospace;color:#ffd77d;overflow-wrap:anywhere}.spmark{position:fixed;right:12px;bottom:12px;z-index:90;max-width:68vw;padding:5px 9px;border-radius:999px;background:rgba(8,7,11,.78);border:1px solid rgba(255,255,255,.08);font:9px ui-monospace,monospace;color:#a695ad;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}.spnote{color:var(--muted);font-size:12px;line-height:1.45}.sptabs{display:flex;gap:6px;overflow:auto;margin:10px 0}.sptabs button.active{border-color:#e348a7;color:#fff}.sppane{display:none}.sppane.active{display:block}@media(max-width:760px){.spc{grid-column:span 12}}';
  document.head.append(s);
}

function mount(){
  document.title='Stellar Proximology';
  const h=document.querySelector('header h1');if(h)h.innerHTML='STELLAR <span class="sovereign">PROXIMOLOGY</span>';
  const hp=document.querySelector('header p');if(hp)hp.textContent='self-contained state space · experiments · claims · findings';
  const main=document.querySelector('main')||document.body;
  const sec=document.createElement('section');sec.id='stellar';sec.className='panel';
  sec.innerHTML='<div><div style="display:flex;justify-content:space-between;gap:10px"><div><div class="mono" style="color:#e9b84a;font-size:10px;letter-spacing:.14em">STELLAR PROXIMOLOGY</div><h2 style="font-size:18px;color:#f5f0f7;border:0;margin:5px 0">State-space laboratory</h2><div class="spaddr" id="spAddress">'+esc(address)+'</div></div><div><span class="spp">LOCAL</span><span class="spp">NO LLM</span><span class="spp">KLEIN</span><span class="spp">GNN</span></div></div><div class="sptabs"><button class="spb active" data-sp="chart">Chart</button><button class="spb" data-sp="lab">Experiments</button><button class="spb" data-sp="claims">Claims</button><button class="spb" data-sp="network">Network</button></div><div id="sp-chart" class="sppane active"></div><div id="sp-lab" class="sppane"></div><div id="sp-claims" class="sppane"></div><div id="sp-network" class="sppane"></div></div>';
  main.prepend(sec);
  const mark=document.createElement('div');mark.className='spmark';mark.id='spMark';mark.textContent=address;document.body.append(mark);
  sec.querySelectorAll('[data-sp]').forEach(b=>b.addEventListener('click',()=>{sec.querySelectorAll('[data-sp]').forEach(x=>x.classList.toggle('active',x===b));sec.querySelectorAll('.sppane').forEach(x=>x.classList.toggle('active',x.id==='sp-'+b.dataset.sp))}));
}

function chartPane(){
  const root=document.querySelector('#sp-chart');
  root.innerHTML='<div class="spg"><div class="spc"><h3>Human Design calculation</h3><p class="spnote">Existing deterministic donor engine. No account, server, or language model call.</p><div class="spf"><label>Birth date</label><input id="bd" class="spi" type="date"></div><div class="spf"><label>Birth time</label><input id="bt" class="spi" type="time"></div><button id="chartRun" class="spb primary">Calculate locally</button></div><div class="spc"><h3>Neural field</h3><div id="gnn" class="spnote">GraphSAGE activates after a chart calculation.</div></div><div class="spc spw"><pre id="chartOut" class="spcode">'+esc(state.charts.length?JSON.stringify(state.charts.at(-1),null,2):'No chart calculated yet.')+'</pre></div></div>';
  root.querySelector('#chartRun').addEventListener('click',()=>{const d=root.querySelector('#bd').value,t=root.querySelector('#bt').value;if(!d||!t)return;try{const chart=calculateHumanDesign(d,t,null),p=chart.placements?.find(x=>x.planet==='Sun')||chart.placements?.[0]||{};address=formatAddress(p);const rows=[...(chart.placements||[]).map(x=>({planet:x.planet,stream:'body',gate:x.gate,line:x.line})),...(chart.designPlacements||[]).map(x=>({planet:x.planet,stream:'design',gate:x.gate,line:x.line}))];const g=inferHumanDesignGNN(rows);const result=record('chart',{address,chart:{type:chart.type,strategy:chart.strategy,authority:chart.authority,profile:chart.profile,placements:chart.placements,designPlacements:chart.designPlacements,channels:activeChannels(chart)},neural:{model:'GraphSAGE-3-layer',training:TRAINING_METADATA,inference:g},evidenceStatus:CLAIM_STATUS.DERIVED});document.querySelector('#spAddress').textContent=address;document.querySelector('#spMark').textContent=address;root.querySelector('#gnn').textContent='heart '+Math.round(g.heart*100)+'% · mind '+Math.round(g.mind*100)+'% · spleen '+Math.round(g.spleen*100)+'% · model inference, not empirical promotion';root.querySelector('#chartOut').textContent=JSON.stringify(result,null,2)}catch(e){root.querySelector('#chartOut').textContent='Calculation failed safely: '+e.message}});
}

function labPane(){
  const root=document.querySelector('#sp-lab');
  root.innerHTML='<div class="spg"><div class="spc"><h3>Artifact experiment</h3><p class="spnote">Every selected file is ingested and classified. Compatible formats execute locally. Unsupported execution is a recorded failure, never a fake success.</p><div class="spf"><label>Artifact</label><input id="af" class="spi" type="file"></div><button id="runFile" class="spb primary">Run experiment</button><div id="runStatus" class="spnote" style="margin-top:8px"></div></div><div class="spc"><h3>Experiment loop</h3><span class="spp">STATE</span><span class="spp">KLEIN</span><span class="spp">EXECUTION</span><span class="spp">HOPFIELD</span><span class="spp">EVIDENCE</span></div><div class="spc spw"><pre id="runOut" class="spcode">'+esc(state.runs.length?JSON.stringify(state.runs.at(-1),null,2):'No experiment has run yet.')+'</pre></div></div>';
  root.querySelector('#runFile').addEventListener('click',async()=>{const file=root.querySelector('#af').files?.[0];if(!file)return;const status=root.querySelector('#runStatus'),out=root.querySelector('#runOut');status.textContent='Running locally…';try{const bytes=new Uint8Array(await file.arrayBuffer()),text=/\.(?:txt|md|csv|json|xml|ya?ml|html?|css|js|mjs|cjs|ts|tsx|jsx|py|pyw|sh|sql)$/i.test(file.name)?new TextDecoder().decode(bytes):'',artifact={name:file.name,originalName:file.name,content:text,bytes};let ex;if(globalThis.SynthiaAndroid?.writeWorkspaceBase64&&globalThis.SynthiaAndroid?.runWorkspaceFile){const rel='experiments/'+Date.now()+'-'+safe(file.name),w=parse(globalThis.SynthiaAndroid.writeWorkspaceBase64(rel,b64(bytes)));if(!w.ok)throw new Error(w.error||'write failed');globalThis.SynthiaAndroid.linuxPrepare?.();const native=parse(globalThis.SynthiaAndroid.runWorkspaceFile(rel));ex={path:'embedded-linux',...native};if(!native.ok){const fallback=await execution.execute(artifact,{source:'stellar-proximology'});ex={path:'embedded-linux+state-space-fallback',native,fallback,ok:Boolean(fallback?.ok||fallback?.result?.ok)}}}else ex=await execution.execute(artifact,{source:'stellar-proximology'});const result=record('run',{address,artifact:{name:file.name,size:file.size,type:file.type||'application/octet-stream'},execution:ex,neural:hopfield(bytes),claimStatus:CLAIM_STATUS.DERIVED});status.textContent=ex?.ok?'Execution completed and evidence recorded.':'Bounded failure recorded as evidence.';out.textContent=JSON.stringify(result,null,2)}catch(e){status.textContent='Failed safely: '+e.message;out.textContent=e.stack||e.message}});
}

function claimsPane(){
  const root=document.querySelector('#sp-claims'),core=claims.list().map(h=>({id:h.id,claim:h.claim,status:h.status,metric:h.metric,threshold:h.threshold}));
  root.innerHTML='<div class="spg"><div class="spc"><h3>Register project hypothesis</h3><div class="spf"><label>Claim</label><textarea id="ct" class="spa"></textarea></div><div class="spf"><label>Null hypothesis</label><textarea id="nt" class="spa"></textarea></div><button id="claimSave" class="spb primary">Register</button><p class="spnote">Claims start as '+esc(CLAIM_STATUS.PROJECT_HYPOTHESIS)+'. They do not promote themselves.</p></div><div class="spc"><h3>Evidence classes</h3>'+Object.values(CLAIM_STATUS).map(x=>'<span class="spp">'+esc(x)+'</span>').join('')+'</div><div class="spc spw"><h3>Core hypotheses</h3><pre class="spcode">'+esc(JSON.stringify(core,null,2))+'</pre></div><div class="spc spw"><h3>Local claims</h3><pre class="spcode">'+esc(JSON.stringify(state.claims,null,2))+'</pre></div></div>';
  root.querySelector('#claimSave').addEventListener('click',()=>{const c=root.querySelector('#ct').value.trim(),n=root.querySelector('#nt').value.trim();if(!c)return;const id='SP-'+String(state.claims.length+1).padStart(4,'0'),h=new Hypothesis({id,claim:c,nullHypothesis:n||'No measurable difference from control.',metric:'pending',test:'pending',threshold:1,status:'hypothesized'});claims.register(h);record('claim',{address,id,statement:c,nullHypothesis:h.nullHypothesis,status:CLAIM_STATUS.PROJECT_HYPOTHESIS});claimsPane()});
}

function networkPane(){
  const root=document.querySelector('#sp-network');
  root.innerHTML='<div class="spg"><div class="spc"><h3>Ontological network</h3><p class="spnote">Nodes are addresses, never personal names.</p><div class="spf"><label>Address A</label><input id="na" class="spi" value="'+esc(address)+'"></div><div class="spf"><label>Address B</label><input id="nb" class="spi" placeholder="P… · D… · G…"></div><div class="spf"><label>Observed outcome (-1 to 1)</label><input id="ns" class="spi" type="number" min="-1" max="1" step="0.05" value="0"></div><button id="netSave" class="spb primary">Record relation</button></div><div class="spc"><h3>Network state</h3><div id="netSummary" class="spnote"></div></div><div class="spc spw"><pre id="netOut" class="spcode"></pre></div></div>';
  const refresh=()=>{const x=resonance.snapshot();root.querySelector('#netSummary').textContent=x.nodes.length+' address nodes · '+x.edges.length+' edges · '+x.events.length+' observations';root.querySelector('#netOut').textContent=JSON.stringify(x,null,2)};
  root.querySelector('#netSave').addEventListener('click',()=>{const a=root.querySelector('#na').value.trim(),b=root.querySelector('#nb').value.trim(),score=Number(root.querySelector('#ns').value);if(!a||!b)return;resonance.addNode(a,{kind:'ontological-address'});resonance.addNode(b,{kind:'ontological-address'});resonance.connect(a,b,{weight:0});resonance.observe({a,b,outcome:score,type:'observed-relation',verified:true,evidence:{source:'local-lab'}});state.network=resonance.snapshot();save();refresh()});refresh();
}

addStyle();mount();chartPane();labPane();claimsPane();networkPane();
globalThis.StellarProximology={get state(){return structuredClone(state)},claims,resonance,execution};
