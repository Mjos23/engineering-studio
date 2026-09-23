/* Pure workspace rules shared by the interface and regression checks. */
(() => {
  'use strict';
  const text = (value, max = 8000) => typeof value === 'string' ? value.slice(0, max) : '';
  const uid = () => crypto.randomUUID();
  const clone = value => JSON.parse(JSON.stringify(value));
  function https(value) {
    try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && !!u.hostname && u.hostname.includes('.'); }
    catch { return false; }
  }
  const repository = value => /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}$/.test(value) && !value.endsWith('/..') && !value.endsWith('/.');
  const sha = value => /^[a-f0-9]{40}$/i.test(value);
  function money(value) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value / 100); }
  function cents(value) {
    if (!/^\d{1,5}(\.\d{1,2})?$/.test(String(value).trim())) return null;
    const [whole, fraction = ''] = String(value).trim().split('.');
    const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    return Number.isSafeInteger(result) && result > 0 ? result : null;
  }
  // A UI freshness marker, never a signature, authentication or release certification.
  function fingerprint(value) {
    const s = JSON.stringify(value); let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return (h >>> 0).toString(16) + ':' + s.length;
  }
  function createProject(name, starter, demo = false) {
    return {
      id: uid(), name: name || 'Untitled workspace', created: new Date().toISOString(),
      client: { name: demo ? 'Harbor & Lime' : '', slug: demo ? 'harbor-and-lime' : '', contact: '', owner: '', reviewer: '', location: demo ? 'St. Pete Beach, Florida' : '', currency: 'USD', color: '#244b3e', brief: demo ? 'Launch a mobile ordering experience: a tested release, a restaurant workspace, an approved menu, staff access, and an ordering entry point.' : '', acceptance: '', orderingUrl: '', table: '4', adminUrl: '' },
      menu: demo ? [{ id: uid(), name: 'Sunset fish tacos', category: 'From the kitchen', priceCents: 1299, available: true, description: 'Grilled fish, lime slaw, warm tortillas.', allergens: 'Fish, wheat' }, { id: uid(), name: 'Crispy lime potatoes', category: 'From the kitchen', priceCents: 650, available: true, description: 'Sea salt, fresh lime, herb dip.', allergens: 'Milk' }, { id: uid(), name: 'House lemonade', category: 'Something refreshing', priceCents: 450, available: true, description: 'Lemon, cane sugar, sparkling water.', allergens: '' }] : [],
      team: [], tickets: {}, manual: {},
      release: { repository: '', branch: 'main', workflow: '', testedSha: '', productionSha: '', buildUrl: '', deploymentUrl: '', rollback: '', reviewer: '', notes: '' },
      practice: { selected: 'page', file: 'html', files: clone(starter), csharp: {}, notes: {}, results: {}, snapshots: [] },
      remote: { repository: '', path: '', branch: '', sha: '', commitSha: '', content: '', loadedContent: '' },
      checks: null, buildEvidence: null, activity: []
    };
  }
  function validate(p) {
    const rows = [], add = (id, title, pass, detail) => rows.push({ id, title, pass: !!pass, detail });
    add('name', 'Restaurant identity', p.client.name.trim().length >= 2, 'Use the client-approved restaurant name.');
    add('slug', 'Stable workspace slug', /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.client.slug) && p.client.slug.length <= 60, 'Lowercase words separated by hyphens; uniqueness must be checked in the real admin system.');
    add('brief', 'Scope and acceptance agreed', p.client.brief.trim().length >= 20 && p.client.acceptance.trim().length >= 20, 'Describe the delivery and the observable result the client will accept.');
    add('people', 'Delivery owner and reviewer', !!p.client.owner.trim() && !!p.client.reviewer.trim() && p.client.owner.trim().toLowerCase() !== p.client.reviewer.trim().toLowerCase(), 'Record a delivery owner and a different reviewer. These are names, not permissions.');
    add('menu', 'At least one available item', p.menu.some(item => item.available), 'A customer needs an available item to order.');
    add('prices', 'Prices use positive whole cents', p.menu.length > 0 && p.menu.every(item => Number.isInteger(item.priceCents) && item.priceCents > 0 && item.priceCents <= 9999999), 'For example, $12.99 is stored as 1299 cents. Currency for this first-client template is USD.');
    add('menu-labels', 'Menu names and categories', p.menu.length > 0 && p.menu.every(item => item.name.trim() && item.category.trim()), 'Each item needs a readable name and category.');
    add('duplicates', 'Distinct menu items', p.menu.length > 0 && new Set(p.menu.map(item => item.id)).size === p.menu.length && new Set(p.menu.map(item => JSON.stringify([item.category.trim().toLowerCase(),item.name.trim().toLowerCase()]))).size === p.menu.length, 'Repeated item names in the same category can confuse ordering.');
    add('staff', 'Staff access plan', p.team.length > 0 && p.team.every(person => person.name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(person.email) && ['owner', 'manager', 'kitchen'].includes(person.role)), 'These are proposed accounts. Nothing sends invitations or grants live access.');
    add('staff-duplicates', 'Unique staff email addresses', p.team.length > 0 && new Set(p.team.map(person => person.email.trim().toLowerCase())).size === p.team.length, 'Each proposed account should appear once.');
    add('owner-role', 'Exactly one designated owner', p.team.filter(person => person.role === 'owner').length === 1, 'Name a responsible owner. Map these role intentions to the product’s actual supported permissions.');
    add('ordering', 'HTTPS ordering destination', https(p.client.orderingUrl), 'Paste the real approved customer link. The studio cannot infer the live restaurant route.');
    add('table', 'Known table context', /^\d{1,3}$/.test(p.client.table) && Number(p.client.table) > 0, 'Record the table you will use for the phone acceptance test; it must exist in the client setup.');
    add('repository', 'Product repository identified', repository(p.release.repository), 'Use owner/repository for the product being delivered, not a different client’s repository.');
    add('sha', 'Exact tested revision recorded', sha(p.release.testedSha), 'A full 40-character commit identifies the code under review. Recording it alone does not verify its tests.');
    add('rollback', 'Recovery plan written', p.release.rollback.trim().length >= 20, 'Record the previous release, recovery owner and how to verify rollback.');
    return rows;
  }
  function draftFingerprint(p) { return fingerprint({ client: p.client, menu: p.menu, team: p.team, release: p.release }); }
  function ticketFingerprint(p, id) {
    const scopes = { brief: [p.client.brief, p.client.acceptance, p.client.contact, p.client.owner, p.client.reviewer], release: p.release, workspace: [p.client.name,p.client.slug,p.client.location], brand: [p.client.color,p.practice.files.html,p.practice.files.css], menu: p.menu, staff: p.team, 'entry-point': [p.client.orderingUrl,p.client.table], acceptance: [p.client,p.menu,p.team,p.manual,p.release.repository,p.release.testedSha,p.release.productionSha], debug: [p.practice.files,p.practice.csharp], handoff: [p.client,p.menu,p.team,p.release,p.manual] };
    return fingerprint(scopes[id] || [p.client,p.menu,p.team]);
  }
  function recordStrings(value, max, allowedKeys, rejectOversize = false) {
    const result = {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
    for (const key of allowedKeys || Object.keys(value).slice(0, 100)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      if (typeof value[key] === 'string') {
        if (rejectOversize && value[key].length > max) throw Error('A C# code file is too large to import without data loss.');
        result[key] = text(value[key], max);
      }
    }
    return result;
  }
  function importProject(raw, starter, lessons, restoreEvidence = false) {
    if (!raw || typeof raw !== 'object' || typeof raw.name !== 'string') throw Error('The backup is missing a workspace name.');
    const p = createProject(text(raw.name,80), starter);
    p.id = typeof raw.id === 'string' && /^[A-Za-z0-9-]{1,80}$/.test(raw.id) ? raw.id : uid();
    p.created = text(raw.created,40) || p.created;
    for (const key of Object.keys(p.client)) if (typeof raw.client?.[key] === 'string') p.client[key] = text(raw.client[key], key === 'brief' || key === 'acceptance' ? 8000 : 1000);
    p.client.currency = 'USD';
    if (!/^#[a-f\d]{6}$/i.test(p.client.color)) p.client.color = '#244b3e';
    if(Array.isArray(raw.menu)&&raw.menu.length>300)throw Error('This workspace exceeds 300 menu items. Import was stopped without discarding any items.');
    if(Array.isArray(raw.team)&&raw.team.length>100)throw Error('This workspace exceeds 100 staff entries. Import was stopped without discarding anyone.');
    p.menu = (Array.isArray(raw.menu) ? raw.menu : []).map(item => ({ id: text(item.id,80) || uid(), name: text(item.name,120), category: text(item.category,80), priceCents: Number.isInteger(item.priceCents) ? item.priceCents : 0, available: item.available === true, description: text(item.description,1000), allergens: text(item.allergens,500) }));
    p.team = (Array.isArray(raw.team) ? raw.team : []).slice(0,100).map(person => ({ id: text(person.id,80) || uid(), name: text(person.name,100), email: text(person.email,254), role: text(person.role,100) }));
    for (const key of Object.keys(p.release)) if (typeof raw.release?.[key] === 'string') p.release[key] = text(raw.release[key],8000);
    for (const key of ['html','css','js']) { if (typeof raw.practice?.files?.[key] !== 'string' || raw.practice.files[key].length > 120000) throw Error('Each browser code file must be text under 120,000 characters.'); p.practice.files[key] = raw.practice.files[key]; }
    p.practice.csharp = recordStrings(raw.practice?.csharp,120000,lessons.map(l=>l.id),true);
    p.practice.notes = recordStrings(raw.practice?.notes,8000);
    p.practice.selected = lessons.some(l=>l.id===raw.practice?.selected) ? raw.practice.selected : 'page';
    p.practice.file = ['html','css','js','cs'].includes(raw.practice?.file) ? raw.practice.file : 'html';
    p.practice.snapshots = (Array.isArray(raw.practice?.snapshots) ? raw.practice.snapshots : []).slice(0,5).map(snapshot => {
      const files = {};
      for (const key of ['html','css','js']) {
        if(typeof snapshot.files?.[key] !== 'string' || snapshot.files[key].length>120000) throw Error('A checkpoint contains an invalid code file.');
        files[key] = snapshot.files[key];
      }
      return {id:text(snapshot.id,80)||uid(),at:text(snapshot.at,40),label:text(snapshot.label,100),files,csharp:recordStrings(snapshot.csharp,120000,lessons.map(l=>l.id),true)};
    });
    if(restoreEvidence) {
      for(const l of lessons) { const result=raw.practice?.results?.[l.id]; if(result&&typeof result==='object')p.practice.results[l.id]={fingerprint:text(result.fingerprint,80),summary:text(result.summary,1000),passed:result.passed===true,at:text(result.at,40)}; }
    }
    for (const [id, ticket] of Object.entries(raw.tickets || {}).slice(0,50)) {
      if (!/^[a-z-]{1,40}$/.test(id) || ['__proto__','constructor','prototype'].includes(id) || !ticket || typeof ticket !== 'object') continue;
      p.tickets[id] = { note: text(ticket.note), owner: text(ticket.owner,100), checked: Array.isArray(ticket.checked) ? ticket.checked.filter(x=>Number.isInteger(x)&&x>=0&&x<50) : [], done: !!ticket.done, at: text(ticket.at,40), fingerprint: text(ticket.fingerprint,80) };
    }
    for (const [id, result] of Object.entries(raw.manual || {}).slice(0,30)) {
      if (!/^[a-z-]{1,40}$/.test(id) || ['__proto__','constructor','prototype'].includes(id) || !result || typeof result !== 'object') continue;
      p.manual[id] = { passed: result.passed === true, note: text(result.note), at: text(result.at,40), fingerprint: text(result.fingerprint,80) };
    }
    // Imported build/check evidence is intentionally rechecked; tokens and unknown fields are discarded.
    for (const key of Object.keys(p.remote)) {
      const limit=key.includes('ontent')?1048576:1000;
      if(typeof raw.remote?.[key]==='string'&&raw.remote[key].length>limit)throw Error('A repository draft is too large to import without data loss.');
      p.remote[key]=text(raw.remote?.[key],limit);
    }
    if(restoreEvidence && raw.checks?.fingerprint===draftFingerprint(p))p.checks={fingerprint:draftFingerprint(p),at:text(raw.checks.at,40),rows:validate(p)};
    if(restoreEvidence && raw.buildEvidence && repository(raw.buildEvidence.repository) && sha(raw.buildEvidence.sha) && /^https:\/\/github\.com\//.test(raw.buildEvidence.url||''))p.buildEvidence={repository:raw.buildEvidence.repository,workflow:text(raw.buildEvidence.workflow,200),sha:raw.buildEvidence.sha,url:text(raw.buildEvidence.url,1000),conclusion:text(raw.buildEvidence.conclusion,40),at:text(raw.buildEvidence.at,40),id:Number(raw.buildEvidence.id)||0};
    p.activity = (Array.isArray(raw.activity)?raw.activity:[]).slice(0,40).map(x=>({at:text(x.at,40),text:text(x.text,300)}));
    return p;
  }
  function importBackup(raw, starter, lessons, options={}) {
    if (raw?.format === 'tide-casa-studio' && raw.version === 1) {
      const p = createProject(text(raw.name,80) || 'Recovered practice',starter);
      p.practice.files = {};
      for (const key of ['html','css','js']) { if (typeof raw.files?.[key] !== 'string' || raw.files[key].length > 120000) throw Error('Invalid legacy code files.'); p.practice.files[key] = raw.files[key]; }
      p.practice.csharp = recordStrings(raw.csharp,120000,lessons.map(l=>l.id),true); p.practice.notes = recordStrings(raw.notes,8000); p.practice.selected = lessons.some(l=>l.id===raw.selected)?raw.selected:'page';
      p.activity = [{at:new Date().toISOString(),text:'Imported original studio draft. Prior completion marks remain in the original backup; new checks need a fresh run.'}];
      return {format:'engineering-studio',version:2,active:p.id,identity:'',projects:[p]};
    }
    if (raw?.format !== 'engineering-studio' || raw.version !== 2 || !Array.isArray(raw.projects) || !raw.projects.length || raw.projects.length > 20) throw Error('Choose a Studio v2 or original Studio v1 JSON backup (up to 20 workspaces).');
    const projects = raw.projects.map(p=>importProject(p,starter,lessons,options.restoreEvidence===true));
    if (new Set(projects.map(p=>p.id)).size!==projects.length) throw Error('The backup contains duplicate workspace IDs.');
    return {format:'engineering-studio',version:2,active:projects.some(p=>p.id===raw.active)?raw.active:projects[0].id,identity:text(raw.identity,100),projects};
  }
  globalThis.StudioCore = {text,uid,clone,https,repository,sha,money,cents,fingerprint,createProject,validate,draftFingerprint,ticketFingerprint,importBackup};
})();
