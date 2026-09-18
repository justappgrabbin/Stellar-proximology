import { UniversalExecutionBridge } from './lab/pure-synthia/integration/universal-execution-bridge.js';
import { CLAIM_STATUS } from './lab/pure-synthia/state-space/claim-status.js';
import { buildHopfieldNetwork, gateToPattern, settle, identifyAttractor } from './neural/hopfieldAttractor.js';

const executor = new UniversalExecutionBridge({ remember: true });
let selectedFile = null;
let lastResult = null;

const textExtensions = /\.(?:txt|md|csv|json|xml|ya?ml|html?|css|js|mjs|cjs|ts|tsx|jsx|py|pyw|sh|sql)$/i;
const safeName = (name='artifact') => String(name).replace(/[^A-Za-z0-9._()+ -]/g,'_').slice(0,120) || 'artifact';

function parseBridge(value){
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(String(value || '{}')); } catch { return {ok:false,error:String(value||'bridge-result-invalid')}; }
}

function bytesToBase64(bytes){
  let binary='';
  const step=0x8000;
  for(let i=0;i<bytes.length;i+=step) binary += String.fromCharCode(...bytes.subarray(i,i+step));
  return btoa(binary);
}

function gateFromBytes(bytes){
  let h=2166136261;
  const limit=Math.min(bytes.length,4096);
  for(let i=0;i<limit;i++){ h^=bytes[i]; h=Math.imul(h,16777619); }
  return ((h>>>0)%64)+1;
}

function neuralObservation(bytes){
  const gate=gateFromBytes(bytes);
  const wrap=n=>((n-1)%64+64)%64+1;
  const stored=[gate,wrap(gate+7),wrap(gate+13),wrap(gate+29),wrap(gate+43)];
  const net=buildHopfieldNetwork(stored);
  const noisy=[...gateToPattern(gate)];
  if(noisy.length) noisy[(gate+bytes.length)%noisy.length]*=-1;
  const result=settle(net,noisy);
  return {
    network:'Hopfield',
    dimensions:net.dimensions,
    storedGates:stored,
    seedGate:gate,
    attractor:identifyAttractor(net,result.finalState),
    iterations:result.iterations,
    energyTrace:result.energyTrace
  };
}

function emit(type,data,evidence){
  try { return globalThis.Stellar?.emit?.(type,data,{evidence}); } catch { return null; }
}

function runtimeAddress(){
  try {
    const db=globalThis.Stellar?.db;
    return db?.participant?.name || 'ADDRESS · UNRESOLVED';
  } catch { return 'ADDRESS · UNRESOLVED'; }
}

function ensureWatermark(){
  if(document.querySelector('#stellarWatermark')) return;
  const mark=document.createElement('div');
  mark.id='stellarWatermark';
  mark.style.cssText='position:fixed;right:12px;bottom:86px;z-index:45;max-width:64vw;padding:5px 8px;border-radius:999px;background:rgba(8,7,11,.72);border:1px solid rgba(255,255,255,.08);backdrop-filter:blur(12px);font:9px ui-monospace,monospace;letter-spacing:.04em;color:#a695ad;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none';
  document.body.append(mark);
  const update=()=>{mark.textContent=runtimeAddress()};
  update();
  setInterval(update,1500);
}

function panelHtml(){
  const bridge = typeof globalThis.SynthiaAndroid !== 'undefined';
  return `
  <div class="card section span-12 sp-local-lab">
    <div class="row" style="justify-content:space-between">
      <div><span class="eyebrow">LOCAL STATE-SPACE LAB</span><h2 style="margin-top:6px">Execute · observe · record</h2></div>
      <span class="pill">${bridge?'embedded Linux':'browser chamber'}</span>
    </div>
    <p class="muted">Files stay local. The artifact is addressed, passed through the existing execution grammar, observed by the neural attractor, and recorded as evidence. A run never promotes its own claim to empirically supported.</p>
    <div class="toolchips" style="margin-bottom:10px">
      <span class="chip">STATE SPACE</span><span class="chip">KLEIN</span><span class="chip">HOPFIELD</span><span class="chip">CLAIMS</span><span class="chip">MCP-BOUNDARY</span>
    </div>
    <div class="two">
      <div class="field"><label>Artifact</label><input class="input" id="spRunFile" type="file" /></div>
      <div class="field"><label>Execution</label><button class="btn primary" id="spRunNow" disabled>Run locally</button></div>
    </div>
    <div id="spRunStatus" class="muted" style="margin-top:9px">No artifact selected.</div>
    <pre id="spRunOutput" class="codebox" style="display:none;margin-top:10px"></pre>
  </div>`;
}

function installPanel(){
  const research=document.querySelector('#panel-research .grid');
  if(!research || research.querySelector('.sp-local-lab')) return;
  research.insertAdjacentHTML('beforeend',panelHtml());
  const input=document.querySelector('#spRunFile');
  const button=document.querySelector('#spRunNow');
  const status=document.querySelector('#spRunStatus');
  const output=document.querySelector('#spRunOutput');
  input?.addEventListener('change',()=>{
    selectedFile=input.files?.[0]||null;
    if(button) button.disabled=!selectedFile;
    if(status) status.textContent=selectedFile ? `${selectedFile.name} · ${selectedFile.size.toLocaleString()} bytes` : 'No artifact selected.';
  });
  button?.addEventListener('click',async()=>{
    if(!selectedFile) return;
    button.disabled=true;
    status.textContent='Executing inside the local state space…';
    output.style.display='none';
    try{
      const bytes=new Uint8Array(await selectedFile.arrayBuffer());
      const text=textExtensions.test(selectedFile.name) ? new TextDecoder().decode(bytes) : '';
      const artifact={name:selectedFile.name,originalName:selectedFile.name,content:text,bytes};
      let run=null;

      if(globalThis.SynthiaAndroid?.writeWorkspaceBase64 && globalThis.SynthiaAndroid?.runWorkspaceFile){
        const relative=`lab/${Date.now()}-${safeName(selectedFile.name)}`;
        const written=parseBridge(globalThis.SynthiaAndroid.writeWorkspaceBase64(relative,bytesToBase64(bytes)));
        if(!written.ok) throw new Error(written.error||'workspace-write-failed');
        parseBridge(globalThis.SynthiaAndroid.linuxPrepare?.());
        run=parseBridge(globalThis.SynthiaAndroid.runWorkspaceFile(relative));
        run.path='embedded-proot-linux';
        if(!run.ok){
          const browser=await executor.execute(artifact,{source:'stellar-local-lab'});
          run={native:run,browser,path:browser?.path||'local-fallback',ok:Boolean(browser?.ok||browser?.result?.ok)};
        }
      }else{
        run=await executor.execute(artifact,{source:'stellar-local-lab'});
      }

      let stateIngest=null;
      try{
        stateIngest=globalThis.Stellar?.synthia?.ingestUploadArtifact?.({
          name:selectedFile.name,type:selectedFile.type,size:selectedFile.size,text,
          sourceId:`local:${selectedFile.name}:${selectedFile.size}`
        })||null;
      }catch(error){ stateIngest={ok:false,error:error.message}; }

      const neural=neuralObservation(bytes);
      const record={
        artifact:{name:selectedFile.name,size:selectedFile.size,type:selectedFile.type||'application/octet-stream'},
        execution:run,
        neural,
        stateIngest,
        claimStatus:CLAIM_STATUS.DERIVED
      };
      lastResult=record;
      emit('FILE_EXECUTION_RECORDED',record,{
        source:'local-execution',
        claimStatus:CLAIM_STATUS.DERIVED,
        neural:'Hopfield',
        executionPath:run?.path||null
      });
      status.textContent=run?.ok?'Execution completed and recorded.':'Execution returned a bounded failure and was recorded.';
      output.textContent=JSON.stringify(record,null,2);
      output.style.display='block';
    }catch(error){
      lastResult={ok:false,error:error.message};
      emit('FILE_EXECUTION_FAILED',{name:selectedFile.name,error:error.message},{source:'local-execution'});
      status.textContent='Execution failed safely: '+error.message;
      output.textContent=JSON.stringify(lastResult,null,2);
      output.style.display='block';
    }finally{
      button.disabled=false;
    }
  });
}

const observer=new MutationObserver(()=>{installPanel();ensureWatermark();});
observer.observe(document.documentElement,{subtree:true,childList:true});
installPanel();
ensureWatermark();

globalThis.StellarLocalLab={
  executor,
  get lastResult(){return structuredClone(lastResult);}
};
