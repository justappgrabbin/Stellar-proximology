import IntakeGate from './lab/pure-synthia/engine/intake.js';

const DB_NAME='stellar.deep.ingest.v1';
const DB_VERSION=1;
const CAPSULE_STORE='capsules';
const FILE_STORE='files';
const MAX_TEXT_BYTES=2*1024*1024;
const TEXT_EXT=new Set(['html','htm','css','js','mjs','cjs','ts','tsx','jsx','json','md','txt','csv','xml','yaml','yml','py','pyw','sh','sql','toml','ini','env','java','kt','rs','go','c','h','cpp','hpp','cs','php','rb','swift','vue','svelte']);
const intake=new IntakeGate();
const analyzers=new Map();
const integrators=new Map();

const now=()=>new Date().toISOString();
const clone=v=>JSON.parse(JSON.stringify(v));
const extOf=name=>{const m=String(name||'').toLowerCase().match(/\.([a-z0-9]+)$/);return m?m[1]:'';};
const cleanPath=p=>String(p||'').replace(/\\/g,'/').replace(/^\.?\//,'').replace(/\/+/g,'/');
const baseName=p=>cleanPath(p).split('/').pop()||'';
const dirName=p=>{const x=cleanPath(p);const i=x.lastIndexOf('/');return i<0?'':x.slice(0,i);};
const uid=p=>p+'-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2));

function emit(type,payload={}){
  const detail={id:uid('ingest-event'),type,at:now(),...payload};
  try{globalThis.dispatchEvent(new CustomEvent('stellar-ingest-event',{detail:clone(detail)}));}catch{}
  return detail;
}

function openDb(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(CAPSULE_STORE))db.createObjectStore(CAPSULE_STORE,{keyPath:'id'});
      if(!db.objectStoreNames.contains(FILE_STORE)){
        const s=db.createObjectStore(FILE_STORE,{keyPath:'key'});
        s.createIndex('capsuleId','capsuleId',{unique:false});
      }
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}

async function put(store,value){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(store,'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete=()=>{db.close();resolve(value);};
    tx.onerror=()=>{const e=tx.error;db.close();reject(e);};
  });
}

async function get(store,key){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(store,'readonly');
    const req=tx.objectStore(store).get(key);
    req.onsuccess=()=>{const v=req.result;db.close();resolve(v);};
    req.onerror=()=>{const e=req.error;db.close();reject(e);};
  });
}

async function getAll(store){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(store,'readonly');
    const req=tx.objectStore(store).getAll();
    req.onsuccess=()=>{const v=req.result||[];db.close();resolve(v);};
    req.onerror=()=>{const e=req.error;db.close();reject(e);};
  });
}

async function deleteCapsuleFiles(capsuleId){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(FILE_STORE,'readwrite');
    const store=tx.objectStore(FILE_STORE);
    const idx=store.index('capsuleId');
    const req=idx.openCursor(IDBKeyRange.only(capsuleId));
    req.onsuccess=()=>{
      const cursor=req.result;
      if(!cursor)return;
      cursor.delete();
      cursor.continue();
    };
    tx.oncomplete=()=>{db.close();resolve(true);};
    tx.onerror=()=>{const e=tx.error;db.close();reject(e);};
  });
}

async function sha256(bytes){
  try{
    const data=bytes instanceof ArrayBuffer?bytes:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
    const hash=await crypto.subtle.digest('SHA-256',data);
    return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
  }catch{
    let h=2166136261;
    const u=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
    for(const b of u){h^=b;h=Math.imul(h,16777619);}
    return 'fnv-'+(h>>>0).toString(16).padStart(8,'0');
  }
}

function isTextFile(file,path){
  const ext=extOf(path||file?.name);
  return TEXT_EXT.has(ext)||String(file?.type||'').startsWith('text/')||['application/json','application/xml','application/javascript'].includes(file?.type);
}

async function readText(file,path){
  if(!isTextFile(file,path)||file.size>MAX_TEXT_BYTES)return null;
  try{return await file.text();}catch{return null;}
}

function addDep(out,kind,value){
  const v=String(value||'').trim();
  if(!v||v.startsWith('data:')||v.startsWith('#'))return;
  if(!out.some(x=>x.kind===kind&&x.value===v))out.push({kind,value:v});
}

function dependenciesFor(path,text){
  const ext=extOf(path), out=[];
  if(!text)return out;
  if(['js','mjs','cjs','ts','tsx','jsx'].includes(ext)){
    for(const m of text.matchAll(/\b(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g))addDep(out,'module',m[1]);
    for(const m of text.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g))addDep(out,'module',m[1]);
    for(const m of text.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g))addDep(out,'module',m[1]);
  }else if(['html','htm'].includes(ext)){
    for(const m of text.matchAll(/\b(?:src|href)\s*=\s*['"]([^'"]+)['"]/gi))addDep(out,'asset',m[1]);
  }else if(ext==='css'){
    for(const m of text.matchAll(/(?:url\(|@import\s+)['"]?([^'")\s]+)['"]?/g))addDep(out,'asset',m[1]);
  }else if(['py','pyw'].includes(ext)){
    for(const m of text.matchAll(/^\s*import\s+([A-Za-z0-9_., ]+)/gm))for(const x of m[1].split(',').map(v=>v.trim()))addDep(out,'module',x.split(/\s+as\s+/)[0]);
    for(const m of text.matchAll(/^\s*from\s+([A-Za-z0-9_.]+)\s+import\s+/gm))addDep(out,'module',m[1]);
  }else if(baseName(path)==='package.json'){
    try{
      const p=JSON.parse(text);
      for(const [k,v] of Object.entries({...p.dependencies,...p.devDependencies,...p.peerDependencies}))addDep(out,'package',k+'@'+v);
      if(p.main)addDep(out,'entry',p.main);
      if(p.module)addDep(out,'entry',p.module);
      if(typeof p.bin==='string')addDep(out,'entry',p.bin);
      else if(p.bin&&typeof p.bin==='object')for(const v of Object.values(p.bin))addDep(out,'entry',v);
    }catch{}
  }
  return out;
}

function behaviorSignals(path,text){
  if(!text)return [];
  const rules=[
    ['network','fetch\\s*\\(|XMLHttpRequest|WebSocket\\s*\\(|EventSource\\s*\\('],
    ['local-storage','localStorage|sessionStorage|indexedDB'],
    ['filesystem','FileReader|showOpenFilePicker|showDirectoryPicker|writeWorkspace|readWorkspace|fs\\.'],
    ['worker','new\\s+Worker\\s*\\(|SharedWorker|serviceWorker'],
    ['dom-ui','document\\.|querySelector|createElement|innerHTML|customElements'],
    ['canvas','<canvas|canvas\\.getContext|getContext\\([\\'"](?:2d|webgl|webgl2)'],
    ['media','getUserMedia|AudioContext|<video|<audio'],
    ['location','geolocation|getCurrentPosition|watchPosition'],
    ['auth','oauth|login|signIn|sign-in|authentication|authorization'],
    ['payments','stripe|paypal|checkout|payment|billing'],
    ['database','supabase|firebase|postgres|sqlite|mysql|mongodb|prisma'],
    ['agent','agent|automata|automaton|planner|tool[_ -]?call|mcp'],
    ['graph','graph|node|edge|causal|dependency'],
    ['simulation','simulation|world|scene|physics|entity|ecs']
  ];
  return rules.filter(([,re])=>new RegExp(re,'i').test(text)).map(([name])=>name);
}

function publicIntakeView(raw){
  const analysis=raw?.analysis||{};
  const structure=raw?.P?.structure||null;
  return {
    kind:raw?.P?.kind||null,
    purpose:analysis.purpose||null,
    behavior:{
      operation:analysis.behavior?.operation||null,
      posProfile:analysis.behavior?.posProfile||{}
    },
    relationships:{
      tools:[...(analysis.relationships?.tools||[])]
    },
    concepts:[...(analysis.concepts||[])],
    structure:structure?{
      imports:[...(structure.imports||[])],
      exports:[...(structure.exports||[])],
      functions:[...(structure.functions||[])],
      keywords:[...(structure.keywords||[])]
    }:null
  };
}

function probableEntrypoint(path,text=''){
  const b=baseName(path).toLowerCase();
  let score=0,reasons=[];
  const hit=(n,r)=>{score+=n;reasons.push(r);};
  if(['index.html','main.html','app.html'].includes(b))hit(100,'web-entry-name');
  if(['main.js','main.mjs','index.js','index.mjs','app.js','server.js','main.ts','index.ts','app.ts','main.py','app.py','__main__.py'].includes(b))hit(70,'common-entry-name');
  if(['package.json','manifest.json','pyproject.toml','cargo.toml','go.mod'].includes(b))hit(45,'project-manifest');
  if(/<!doctype html|<html[\s>]/i.test(text))hit(30,'html-document');
  if(/\b(?:createRoot|new\s+Vue|new\s+App|listen\s*\(|if\s*\(\s*require\.main\s*===\s*module|if\s+__name__\s*==\s*['"]__main__['"])/.test(text))hit(35,'runtime-start-signal');
  return {score,reasons};
}

function resolveLocal(from,dep,paths){
  if(!dep||/^[a-z]+:/i.test(dep)||dep.startsWith('//')||(!dep.startsWith('.')&&!dep.startsWith('/')))return null;
  const root=dep.startsWith('/')?cleanPath(dep):cleanPath((dirName(from)?dirName(from)+'/':'')+dep);
  const candidates=[root,root+'.js',root+'.mjs',root+'.ts',root+'.tsx',root+'.jsx',root+'.json',root+'.css',root+'.html',root+'/index.js',root+'/index.mjs',root+'/index.ts',root+'/index.html'];
  return candidates.find(x=>paths.has(cleanPath(x)))||null;
}

function summarize(files,edges){
  const languages={}, behavior=new Set(), concepts=new Map(), purposes=[], externals=new Set();
  for(const f of files){
    const ext=extOf(f.path)||'binary';
    languages[ext]=(languages[ext]||0)+1;
    for(const b of f.behaviors||[])behavior.add(b);
    for(const c of f.analysis?.concepts||[])concepts.set(c,(concepts.get(c)||0)+1);
    if(f.analysis?.purpose)purposes.push(f.analysis.purpose);
    for(const d of f.dependencies||[])if(!d.localTarget)externals.add(d.value);
  }
  const topConcepts=[...concepts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,16).map(([x])=>x);
  const entries=files.filter(f=>f.entrypoint.score>0).sort((a,b)=>b.entrypoint.score-a.entrypoint.score).slice(0,8).map(f=>({path:f.path,score:f.entrypoint.score,reasons:f.entrypoint.reasons}));
  return {
    fileCount:files.length,
    totalBytes:files.reduce((n,f)=>n+f.size,0),
    languages,
    behaviors:[...behavior].sort(),
    concepts:topConcepts,
    purposeCandidates:[...new Set(purposes)].slice(0,10),
    entrypoints:entries,
    dependencyEdges:edges.length,
    externalDependencies:[...externals].slice(0,100),
    appShape:entries[0]?.path?.endsWith('.html')?'browser-app':
      files.some(f=>baseName(f.path)==='package.json')?'package-app':
      files.some(f=>['py','pyw'].includes(extOf(f.path)))?'python-system':
      files.length===1?'single-artifact':'multi-file-system'
  };
}

async function analyzeFile(file,path){
  const bytes=new Uint8Array(await file.arrayBuffer());
  const digest=await sha256(bytes);
  const text=await readText(file,path);
  const raw=intake.intake(text!==null?text:{path,size:file.size,type:file.type||'application/octet-stream',sha256:digest},{source:'system-capsule',path});
  const analysis=publicIntakeView(raw);
  const dependencies=dependenciesFor(path,text);
  const behaviors=behaviorSignals(path,text);
  const entrypoint=probableEntrypoint(path,text||'');
  return {
    path, name:baseName(path), size:file.size, mime:file.type||'application/octet-stream',
    sha256:digest, textAvailable:text!==null, analysis, dependencies, behaviors, entrypoint,
    privateIntake:raw
  };
}

async function preserveFile(capsuleId,file,path,descriptor){
  await put(FILE_STORE,{
    key:capsuleId+':'+path,
    capsuleId,path,blob:file,
    size:file.size,type:file.type||'application/octet-stream',
    sha256:descriptor.sha256,
    preservedAt:now()
  });
}

function inferGraph(files){
  const paths=new Set(files.map(f=>f.path));
  const edges=[];
  for(const f of files){
    for(const d of f.dependencies){
      const target=resolveLocal(f.path,d.value,paths);
      d.localTarget=target;
      edges.push({from:f.path,to:target||d.value,kind:d.kind,scope:target?'internal':'external'});
    }
  }
  return edges;
}

async function runAnalyzers(context){
  const results={};
  for(const [id,fn] of analyzers){
    try{results[id]=await fn(context);}
    catch(error){results[id]={ok:false,error:String(error?.message||error)};}
  }
  return results;
}

async function ingestFiles(fileList,{name='',source='user-import',tags=[]}={}){
  const input=Array.from(fileList||[]);
  if(!input.length)throw new Error('no-files-selected');
  const capsuleId=uid('capsule');
  const files=[];
  emit('capsule.ingest.started',{capsuleId,count:input.length});

  for(let i=0;i<input.length;i++){
    const file=input[i];
    const path=cleanPath(file.webkitRelativePath||file.relativePath||file.name||('file-'+i));
    const descriptor=await analyzeFile(file,path);
    await preserveFile(capsuleId,file,path,descriptor);
    files.push(descriptor);
    emit('capsule.file.analyzed',{capsuleId,path,index:i+1,total:input.length});
  }

  const edges=inferGraph(files);
  const summary=summarize(files,edges);
  const context={capsuleId,source,summary,files:files.map(f=>({...f,privateIntake:undefined})),edges:clone(edges)};
  const adapterResults=await runAnalyzers(context);

  const capsule={
    id:capsuleId,
    name:String(name||summary.entrypoints[0]?.path||input[0]?.name||'Imported System'),
    source,tags:[...tags],
    createdAt:now(),updatedAt:now(),
    status:'analyzed',
    preservation:{mode:'indexeddb-original-blobs',immutable:true,originalFileCount:files.length},
    summary,
    graph:{nodes:files.map(f=>({id:f.path,kind:'file',bytes:f.size,mime:f.mime,entryScore:f.entrypoint.score})),edges},
    files:files.map(f=>({
      path:f.path,name:f.name,size:f.size,mime:f.mime,sha256:f.sha256,
      textAvailable:f.textAvailable,analysis:f.analysis,dependencies:f.dependencies,
      behaviors:f.behaviors,entrypoint:f.entrypoint
    })),
    privateAnalysis:{
      intakeVersion:'stellar-intake-existing',
      fileIntake:files.map(f=>({path:f.path,intake:f.privateIntake})),
      adapterResults
    },
    integration:{
      installed:false,target:null,installedAt:null,
      runtimeProbe:{performed:false,result:null},
      adapterResults
    }
  };

  await put(CAPSULE_STORE,capsule);
  emit('capsule.ingest.completed',{capsuleId,summary:clone(summary)});
  return publicCapsule(capsule);
}

async function getCapsuleInternal(id){
  const c=await get(CAPSULE_STORE,id);
  if(!c)throw new Error('capsule-not-found');
  return c;
}

function publicCapsule(c){
  if(!c)return null;
  const out=clone(c);
  delete out.privateAnalysis;
  return out;
}

async function getCapsule(id){return publicCapsule(await getCapsuleInternal(id));}
async function listCapsules(){return (await getAll(CAPSULE_STORE)).map(publicCapsule).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));}

async function fileRecord(capsuleId,path){return get(FILE_STORE,capsuleId+':'+cleanPath(path));}

async function probeCapsule(id,{entryPath=null}={}){
  const c=await getCapsuleInternal(id);
  const entry=entryPath||c.summary.entrypoints?.[0]?.path;
  if(!entry)throw new Error('no-entrypoint-detected');
  const rec=await fileRecord(id,entry);
  if(!rec)throw new Error('entrypoint-original-missing');
  const execution=globalThis.StellarProximology?.execution;
  if(!execution?.execute)throw new Error('execution-bridge-unavailable');
  const bytes=new Uint8Array(await rec.blob.arrayBuffer());
  const text=isTextFile(rec.blob,entry)&&rec.size<=MAX_TEXT_BYTES?await rec.blob.text():'';
  emit('capsule.probe.started',{capsuleId:id,entryPath:entry});
  const result=await execution.execute({name:entry,originalName:entry,content:text,bytes},{source:'deep-ingest-probe',capsuleId:id});
  c.integration.runtimeProbe={performed:true,at:now(),entryPath:entry,result:clone(result)};
  c.updatedAt=now();
  await put(CAPSULE_STORE,c);
  emit('capsule.probe.completed',{capsuleId:id,entryPath:entry,ok:Boolean(result?.ok||result?.result?.ok)});
  return clone(c.integration.runtimeProbe);
}

async function integrateCapsule(id,{target='computer',options={}}={}){
  const c=await getCapsuleInternal(id);
  const adapter=integrators.get(target);
  let result={ok:true,mode:'registered-capsule',target};
  if(adapter)result=await adapter({capsule:publicCapsule(c),options,files:async()=>getCapsuleFiles(id)});
  c.integration.installed=Boolean(result?.ok!==false);
  c.integration.target=target;
  c.integration.installedAt=c.integration.installed?now():null;
  c.integration.result=result;
  c.status=c.integration.installed?'integrated':'analyzed';
  c.updatedAt=now();
  await put(CAPSULE_STORE,c);
  emit('capsule.integration.changed',{capsuleId:id,target,installed:c.integration.installed});
  return publicCapsule(c);
}

async function getCapsuleFiles(id){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(FILE_STORE,'readonly');
    const req=tx.objectStore(FILE_STORE).index('capsuleId').getAll(IDBKeyRange.only(id));
    req.onsuccess=()=>{const rows=req.result||[];db.close();resolve(rows);};
    req.onerror=()=>{const e=req.error;db.close();reject(e);};
  });
}

async function removeCapsule(id){
  await deleteCapsuleFiles(id);
  const db=await openDb();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(CAPSULE_STORE,'readwrite');
    tx.objectStore(CAPSULE_STORE).delete(id);
    tx.oncomplete=()=>{db.close();resolve();};
    tx.onerror=()=>{const e=tx.error;db.close();reject(e);};
  });
  emit('capsule.removed',{capsuleId:id});
  return true;
}

function registerAnalyzer(id,fn){
  if(!id||typeof fn!=='function')throw new Error('analyzer-required');
  analyzers.set(String(id),fn);
  emit('ingest.analyzer.registered',{id:String(id)});
  return true;
}

function registerIntegrator(id,fn){
  if(!id||typeof fn!=='function')throw new Error('integrator-required');
  integrators.set(String(id),fn);
  emit('ingest.integrator.registered',{id:String(id)});
  return true;
}

async function exportCapsule(id){
  const c=await getCapsuleInternal(id);
  const safe=String(c.name||c.id).replace(/[^a-z0-9_-]+/gi,'-');
  const blob=new Blob([JSON.stringify(publicCapsule(c),null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=safe+'.stellar-capsule.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  return true;
}

globalThis.StellarIngest={
  ingestFiles,getCapsule,listCapsules,probeCapsule,integrateCapsule,removeCapsule,
  getCapsuleFiles,exportCapsule,registerAnalyzer,registerIntegrator,
  limits:{maxTextBytes:MAX_TEXT_BYTES},
  version:'1.0.0'
};

emit('ingest.ready',{version:'1.0.0',stages:['preserve','decompose','analyze','relate','graph','capsule','optional-probe','integrate']});
