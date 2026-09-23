const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cryptoModule = require('node:crypto');
if (!globalThis.crypto) globalThis.crypto = cryptoModule.webcrypto;
const source = path.resolve(__dirname, '../engineering/core.js');
require(source);
const C = globalThis.StudioCore;
const starter = {html:'<h1>Example</h1>',css:'body { color: black; }',js:'let quantity = 0;'};
const lessons = ['page','design','cart','table','money','validation','records','tenants','retries'].map(id=>({id}));
const results = [];
function test(name, action, category='requirement') {
  try { action(); results.push({name,category,pass:true}); console.log('PASS | '+name); }
  catch(error) { results.push({name,category,pass:false,error:error.message}); console.log('FAIL | '+name+' | '+error.message); }
}
function fixture(name='Client One') {
  const p = C.createProject(name, starter, true);
  p.client.acceptance = 'A scanned entry point produces one matching staff order.';
  p.client.owner = 'Delivery Engineer'; p.client.reviewer = 'Review Engineer';
  p.client.orderingUrl = 'https://ordering.example.com/approved-link';
  p.team = [{id:'staff-1',name:'Fictional Owner',email:'owner@example.com',role:'owner'}];
  p.release.repository = 'example/product';
  p.release.testedSha = 'a'.repeat(40);
  p.release.rollback = 'The release owner restores the reviewed previous release and retests ordering.';
  return p;
}
function backup(projects, active=projects[0].id) {
  return {format:'engineering-studio',version:2,identity:'Review Engineer',active,projects};
}
function roundTrip(raw, restoreEvidence=false) {
  return C.importBackup(JSON.parse(JSON.stringify(raw)), starter, lessons, {restoreEvidence});
}
function row(p,id) { return C.validate(p).find(r=>r.id===id); }

test('A complete fictional configuration passes every named draft rule',()=>assert.ok(C.validate(fixture()).every(r=>r.pass)));

test('Two new workspaces have independent IDs, code, menu and notes',()=>{
  const a=fixture('One'), b=fixture('Two');
  a.practice.files.html='Changed'; a.menu[0].name='Changed'; a.practice.notes.page='One only';
  assert.notEqual(a.id,b.id); assert.equal(b.practice.files.html,starter.html);
  assert.equal(b.menu[0].name,'Sunset fish tacos'); assert.equal(b.practice.notes.page,undefined);
});
test('v2 backup keeps both workspaces and selected active workspace',()=>{
  const a=fixture('One'), b=fixture('Two'); b.practice.files.js='const preserved = 42;';
  const imported=roundTrip(backup([a,b],b.id));
  assert.equal(imported.projects.length,2); assert.equal(imported.active,b.id);
  assert.equal(imported.identity,'Review Engineer');
  assert.equal(imported.projects[1].practice.files.js,'const preserved = 42;');
  imported.projects[0].practice.files.html='Different'; assert.equal(a.practice.files.html,starter.html);
});
test('Missing active workspace falls back to a real imported workspace',()=>{
  const a=fixture(); assert.equal(roundTrip(backup([a],'missing')).active,a.id);
});
test('Duplicate workspace IDs are rejected',()=>{
  const a=fixture(),b=fixture();b.id=a.id;assert.throws(()=>roundTrip(backup([a,b])),/duplicate workspace IDs/);
});
test('Empty and more-than-20 workspace backups are rejected',()=>{
  assert.throws(()=>roundTrip({format:'engineering-studio',version:2,projects:[]}));
  assert.throws(()=>roundTrip(backup(Array.from({length:21},(_,i)=>fixture('Client '+i)))));
});
test('v1 migration preserves code, C# drafts and notes without promoting old completion evidence',()=>{
  const old={format:'tide-casa-studio',version:1,name:'Legacy work',selected:'money',files:{...starter},csharp:{money:'Console.WriteLine(2598);'},notes:{money:'Expected 2598'},complete:['money'],release:[0],localResults:{money:'PASS old run'}};
  const migrated=roundTrip(old); const p=migrated.projects[0];
  assert.equal(migrated.version,2);assert.equal(p.name,'Legacy work');assert.equal(p.practice.selected,'money');
  assert.equal(p.practice.csharp.money,old.csharp.money);assert.equal(p.practice.notes.money,'Expected 2598');
  assert.deepEqual(p.practice.results,{});assert.deepEqual(p.tickets,{});assert.equal(p.checks,null);
});
test('v1 malformed code file is rejected',()=>assert.throws(()=>roundTrip({format:'tide-casa-studio',version:1,name:'Bad',files:{html:'ok',css:'ok',js:null}})));

test('Decimal inputs convert to exact cents without binary rounding',()=>{
  for(const [input,expected] of [['12.99',1299],['0.29',29],['1.01',101],['0.07',7],['19.9',1990],[' 5.00 ',500],['99999.99',9999999]]) assert.equal(C.cents(input),expected,input);
});
test('Ambiguous, negative, zero, exponent and subcent money inputs are rejected',()=>{
  for(const input of ['0','0.00','-1','1e2','12.999','1,000.00','$12.99','.99','NaN','Infinity','100000.00','']) assert.equal(C.cents(input),null,input);
});
test('Known subtotal formats exactly',()=>assert.equal(C.money(2598),'$25.98'));
test('Invalid menu cents and unavailable-only menu fail appropriate rules',()=>{
  for(const cents of [0,-1,12.5,10000000,Number.MAX_SAFE_INTEGER,NaN]) {const p=fixture();p.menu[0].priceCents=cents;assert.equal(row(p,'prices').pass,false,String(cents));}
  const p=fixture();p.menu.forEach(x=>x.available=false);assert.equal(row(p,'menu').pass,false);
});
test('Blank menu labels and exact duplicate identity or name/category fail',()=>{
  const p=fixture();p.menu[0].name='  ';assert.equal(row(p,'menu-labels').pass,false);
  const q=fixture();q.menu.push({...q.menu[0],id:'new-id'});assert.equal(row(q,'duplicates').pass,false);
  const r=fixture();r.menu[1].id=r.menu[0].id;assert.equal(row(r,'duplicates').pass,false);
});
test('Unsupported roles, bad emails and duplicate owners fail draft checks',()=>{
  const p=fixture();p.team[0].role='superadmin';assert.equal(row(p,'staff').pass,false);
  const q=fixture();q.team[0].email='not-an-email';assert.equal(row(q,'staff').pass,false);
  const r=fixture();r.team.push({id:'2',name:'Other',email:'other@example.com',role:'owner'});assert.equal(row(r,'owner-role').pass,false);
});
test('Staff email duplication is case insensitive',()=>{
  const p=fixture();p.team.push({id:'2',name:'Other',email:'OWNER@example.com',role:'kitchen'});assert.equal(row(p,'staff-duplicates').pass,false);
});
test('HTTP, credentialed URLs, script URLs and missing-host URLs are rejected',()=>{
  for(const value of ['http://example.com','https://user:secret@example.com','javascript:alert(1)','/ordering','https://','https://localhost']) assert.equal(C.https(value),false,value);
  assert.equal(C.https('https://ordering.example.com/path?table=4'),true);
});
test('Empty, nonnumeric, zero and negative table contexts fail',()=>{
  for(const value of ['',' ','0','-1','4x','1.5','1000']) {const p=fixture();p.client.table=value;assert.equal(row(p,'table').pass,false,value);}
  for(const value of ['1','4','999']) {const p=fixture();p.client.table=value;assert.equal(row(p,'table').pass,true,value);}
});
test('An empty table survives backup and remains visibly invalid',()=>{
  const p=fixture();p.client.table='';const q=roundTrip(backup([p])).projects[0];assert.equal(q.client.table,'');assert.equal(row(q,'table').pass,false);
});
test('Unknown fields and secret-like properties are excluded throughout imported state',()=>{
  const p=fixture();p.token='SECRET';p.client.accessToken='SECRET';p.remote.token='SECRET';p.release.password='SECRET';p.menu[0].secret='SECRET';p.team[0].secret='SECRET';
  const q=roundTrip(backup([p])).projects[0];assert.ok(!JSON.stringify(q).includes('SECRET'));
});
test('Prototype-oriented keys in free-text records are excluded and do not pollute objects',()=>{
  const raw=JSON.parse(JSON.stringify(backup([fixture()])));
  raw.projects[0].practice.notes=JSON.parse('{"__proto__":"bad","constructor":"bad","prototype":"bad","page":"safe"}');
  raw.projects[0].practice.csharp=JSON.parse('{"__proto__":"bad","constructor":"bad","money":"safe code"}');
  const p=roundTrip(raw).projects[0];assert.deepEqual(p.practice.notes,{page:'safe'});assert.deepEqual(p.practice.csharp,{money:'safe code'});assert.equal({}.polluted,undefined);
});
test('Five checkpoints roundtrip exact browser and C# drafts',()=>{
  const p=fixture();p.practice.snapshots=Array.from({length:5},(_,i)=>({id:'snap-'+i,at:'2026-09-23T12:00:00Z',label:'Checkpoint '+i,files:{html:'<h1>'+i+'</h1>',css:'body{color:red}',js:'const n='+i+';'},csharp:{money:'Console.WriteLine('+i+');'}}));
  assert.deepEqual(roundTrip(backup([p])).projects[0].practice.snapshots,p.practice.snapshots);
});
test('Checkpoint code exceeding the editor limit is rejected',()=>{
  const p=fixture();p.practice.snapshots=[{id:'1',files:{...starter,js:'x'.repeat(120001)}}];assert.throws(()=>roundTrip(backup([p])),/checkpoint/i);
});
test('Repository drafts roundtrip exactly through the 1 MiB limit and reject overflow',()=>{
  const p=fixture();p.remote.content='x'.repeat(1048576);p.remote.loadedContent='original';assert.equal(roundTrip(backup([p])).projects[0].remote.content.length,1048576);
  p.remote.content+='x';assert.throws(()=>roundTrip(backup([p])),/too large/);
});
test('Malformed import leaves input state untouched and produces no partial replacement',()=>{
  const live=backup([fixture('Existing')]);const before=JSON.stringify(live);let state=live;
  const malformed=backup([fixture('Good new one'),fixture('Bad new one')]);malformed.projects[1].practice.files.js=42;
  assert.throws(()=>{state=roundTrip(malformed);});assert.equal(state,live);assert.equal(JSON.stringify(live),before);
});
test('Standard import drops automatic checks and connected build/lesson evidence',()=>{
  const p=fixture();p.checks={fingerprint:C.draftFingerprint(p),at:'now',rows:C.validate(p)};
  p.practice.results.money={fingerprint:'abc',summary:'Actual prior result',passed:true,at:'now'};
  p.buildEvidence={repository:'example/product',workflow:'ci.yml',sha:'a'.repeat(40),url:'https://github.com/example/product/actions/runs/123',conclusion:'success',at:'now',id:123};
  const q=roundTrip(backup([p])).projects[0];assert.equal(q.checks,null);assert.equal(q.buildEvidence,null);assert.deepEqual(q.practice.results,{});
});
test('Local reload restores matching evidence and recalculates configuration check rows',()=>{
  const p=fixture();p.checks={fingerprint:C.draftFingerprint(p),at:'now',rows:[{id:'fabricated',pass:true}]};
  p.practice.results.money={fingerprint:'abc',summary:'Actual prior result',passed:true,at:'now'};
  p.buildEvidence={repository:'example/product',workflow:'ci.yml',sha:'a'.repeat(40),url:'https://github.com/example/product/actions/runs/123',conclusion:'success',at:'now',id:123};
  const q=roundTrip(backup([p]),true).projects[0];assert.ok(q.checks);assert.deepEqual(q.checks.rows,C.validate(q));
  assert.deepEqual(q.buildEvidence,p.buildEvidence);assert.deepEqual(q.practice.results,p.practice.results);
});
test('Reload discards automatic draft checks after a relevant configuration edit',()=>{
  const p=fixture();p.checks={fingerprint:C.draftFingerprint(p),at:'now',rows:C.validate(p)};p.menu[0].priceCents=1499;
  assert.equal(roundTrip(backup([p]),true).projects[0].checks,null);
});
test('Ticket scope becomes stale when its directly reviewed inputs change',()=>{
  for(const [id,change] of [['brief',p=>p.client.brief+=' Changed'],['release',p=>p.release.testedSha='b'.repeat(40)],['workspace',p=>p.client.slug='different'],['brand',p=>p.practice.files.html+=' Changed'],['menu',p=>p.menu[0].priceCents++],['staff',p=>p.team[0].role='manager'],['entry-point',p=>p.client.table='5'],['acceptance',p=>p.menu[0].available=false],['debug',p=>p.practice.files.js+=' Changed'],['handoff',p=>p.release.rollback+=' Changed']]) {
    const p=fixture(),before=C.ticketFingerprint(p,id);change(p);assert.notEqual(C.ticketFingerprint(p,id),before,id);
  }
});
test('Menu ticket remains current after unrelated notebook edits',()=>{
  const p=fixture(),before=C.ticketFingerprint(p,'menu');p.practice.notes.page='More notes';assert.equal(C.ticketFingerprint(p,'menu'),before);
});

// Candidate regressions based on what the user should observe, not internal branches.
test('Acceptance review becomes stale after the tested release changes',()=>{
  const p=fixture(),before=C.ticketFingerprint(p,'acceptance');p.release.testedSha='b'.repeat(40);assert.notEqual(C.ticketFingerprint(p,'acceptance'),before);
},'candidate-regression');
test('Acceptance review becomes stale after the production release changes',()=>{
  const p=fixture();p.release.productionSha='a'.repeat(40);const before=C.ticketFingerprint(p,'acceptance');p.release.productionSha='b'.repeat(40);assert.notEqual(C.ticketFingerprint(p,'acceptance'),before);
},'candidate-regression');
test('Acceptance review becomes stale after the product repository changes',()=>{
  const p=fixture(),before=C.ticketFingerprint(p,'acceptance');p.release.repository='example/different-product';assert.notEqual(C.ticketFingerprint(p,'acceptance'),before);
},'candidate-regression');
test('Import does not silently turn an unsupported staff role into a passing supported role',()=>{
  const p=fixture();p.team.push({id:'2',name:'Shift Person',email:'shift@example.com',role:'unsupported-role'});
  assert.equal(row(p,'staff').pass,false);
  let q;try{q=roundTrip(backup([p])).projects[0];}catch{return;}
  assert.equal(row(q,'staff').pass,false);assert.equal(q.team[1].role,'unsupported-role');
},'candidate-regression');
test('Menu duplicate detection normalizes harmless surrounding whitespace on each label',()=>{
  const p=fixture();p.menu.push({...p.menu[0],id:'new-id',category:p.menu[0].category+' ',name:' '+p.menu[0].name});assert.equal(row(p,'duplicates').pass,false);
},'candidate-regression');
test('Prototype-oriented ticket and manual keys are excluded from imported records',()=>{
  const p=fixture();p.tickets=JSON.parse('{"constructor":{"done":true},"prototype":{"done":true},"menu":{"done":true}}');p.manual=JSON.parse('{"constructor":{"passed":true},"prototype":{"passed":true},"order":{"passed":true}}');
  const q=roundTrip(backup([p])).projects[0];assert.ok(!Object.hasOwn(q.tickets,'constructor'));assert.ok(!Object.hasOwn(q.tickets,'prototype'));assert.ok(!Object.hasOwn(q.manual,'constructor'));assert.ok(!Object.hasOwn(q.manual,'prototype'));
},'candidate-regression');
test('Oversized C# drafts are rejected instead of silently losing source code',()=>{
  const p=fixture();p.practice.csharp.money='x'.repeat(120001);assert.throws(()=>roundTrip(backup([p])));
},'candidate-regression');
test('C# drafts at the source limit survive without losing a character',()=>{
  const p=fixture();p.practice.csharp.money='x'.repeat(120000);assert.equal(roundTrip(backup([p])).projects[0].practice.csharp.money,p.practice.csharp.money);
});
test('Oversized C# checkpoint source is rejected without truncating recovery code',()=>{
  const p=fixture();p.practice.snapshots=[{id:'cs-checkpoint',files:{...starter},csharp:{money:'x'.repeat(120001)}}];assert.throws(()=>roundTrip(backup([p])),/C# code file/);
});
test('Oversized legacy C# source is rejected without losing original work',()=>{
  assert.throws(()=>roundTrip({format:'tide-casa-studio',version:1,name:'Legacy work',files:{...starter},csharp:{money:'x'.repeat(120001)},notes:{}}),/C# code file/);
});
test('Distinct category/name pairs containing slashes are not treated as duplicate items',()=>{
  const p=fixture();p.menu=[{id:'1',name:'B/C',category:'A',priceCents:100,available:true},{id:'2',name:'C',category:'A/B',priceCents:200,available:true}];assert.equal(row(p,'duplicates').pass,true);
});

const digest=cryptoModule.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
const report={at:new Date().toISOString(),node:process.version,source,sourceSha256:digest,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,results};
// CI output is the evidence; running this suite never writes repository files.
console.log(`\n${report.passed} passed; ${report.failed} failed. Source SHA256: ${digest}`);
process.exitCode=report.failed?1:0;

