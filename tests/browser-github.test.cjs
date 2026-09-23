/* Browser regressions against current source. All GitHub traffic is intercepted. */
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '../engineering');
const entry = process.env.STUDIO_TEST_URL || pathToFileURL(path.join(root, 'index.html')).href;
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const data = { practice: read('practice.json'), csharp: read('csharp-lessons.json'), guide: read('delivery-guide.json') };
const SHA = 'a'.repeat(40);
const TOKEN = 'github_pat_mock_session_not_a_real_credential';
const headers = {
  'content-type': 'application/json', 'access-control-allow-origin': '*',
  'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,OPTIONS'
};

async function fixture(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const requests = [], errors = [], pending = new Map(), awaited = new Map();
  let deferPath = null;
  page.on('pageerror', error => errors.push(error.message));
  await context.addInitScript(value => { window.STUDIO_DATA = value; }, data);
  await context.route('https://**', route => route.abort());
  await context.route('https://api.github.com/**', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method();
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers });
    requests.push({ method, path: url.pathname, body: request.postDataJSON() });
    const reply = body => route.fulfill({ status: 200, headers, body: JSON.stringify(body) });
    if (method === 'GET' && url.pathname === '/user') return reply({ login: 'fixture-engineer' });
    const match = url.pathname.match(/^\/repos\/([^/]+\/[^/]+)(.*)$/);
    if (!match) return route.fulfill({ status: 404, headers, body: '{}' });
    const [, repository, suffix] = match;
    if (method === 'GET' && suffix === '') return reply({ full_name: repository, default_branch: 'main' });
    if (method === 'PUT' && suffix.startsWith('/contents/')) return reply({
      content: { sha: 'b'.repeat(40) },
      commit: { sha: 'c'.repeat(40), html_url: `https://github.com/${repository}/commit/${'c'.repeat(40)}` }
    });
    if (method === 'GET' && suffix.startsWith('/contents/')) {
      const file = decodeURIComponent(suffix.slice('/contents/'.length));
      const contents = file === 'Program.cs' ? 'Original source' : 'Replacement source';
      const payload = { type: 'file', path: file, sha: SHA, size: Buffer.byteLength(contents), encoding: 'base64', content: Buffer.from(contents).toString('base64') };
      if (file === deferPath) {
        return new Promise(resolve => {
          pending.set(file, async () => { await reply(payload); resolve(); });
          awaited.get(file)?.();
        });
      }
      return reply(payload);
    }
    if (method === 'POST' && suffix === '/actions/workflows/studio-csharp.yml/dispatches') return reply({ workflow_run_id: 101 });
    if (method === 'GET' && suffix === '/actions/runs/101') return reply({
      id: 101, name: 'Studio C# practice', display_title: 'Studio C# money', path: '.github/workflows/studio-csharp.yml',
      status: 'completed', conclusion: 'success', head_sha: SHA, head_branch: 'main',
      created_at: '2026-09-23T12:00:00Z', event: 'workflow_dispatch', workflow_id: 1
    });
    if (method === 'GET' && suffix === '/actions/runs/101/jobs') return reply({ total_count: 1, jobs: [{
      id: 201, name: 'Compile and check the lesson', status: 'completed', conclusion: 'success',
      steps: [{ number: 1, name: 'Compile, run and compare', status: 'completed', conclusion: 'success' }]
    }] });
    return route.fulfill({ status: 404, headers, body: JSON.stringify({ message: 'No fixture for this endpoint' }) });
  });
  await page.goto(entry);
  await page.getByRole('heading', { name: 'Your delivery path' }).waitFor();
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('engineering-studio-v2')));
  const saved = () => page.waitForFunction(() => document.querySelector('#save-state').textContent === 'Saved in this browser');
  const connect = async repository => {
    await page.locator('#connect-button').click();
    await page.locator('#connect-form [name=repository]').fill(repository);
    await page.locator('#connect-form [name=token]').fill(TOKEN);
    await page.getByRole('button', { name: 'Connect repository', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('#modal').open && document.querySelector('#connect-button').textContent.includes('connected'));
  };
  const repositoryView = async () => {
    await page.getByRole('link', { name: 'Build room', exact: true }).click();
    await page.getByRole('button', { name: 'Product repository', exact: true }).click();
  };
  const loadOriginal = async () => {
    await page.locator('#repo-branch').fill('work/menu');
    await page.locator('#repo-path').fill('Program.cs');
    await page.getByRole('button', { name: 'Load file', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#code').value === 'Original source');
  };
  return {
    page, requests, errors, state, saved, connect, repositoryView, loadOriginal,
    defer(file) { deferPath = file; return new Promise(resolve => awaited.set(file, resolve)); },
    async release(file) { assert.ok(pending.has(file), 'fixture must have a pending request'); await pending.get(file)(); },
    async close() {
      const persisted = await page.evaluate(() => localStorage.getItem('engineering-studio-v2'));
      assert.ok(!persisted?.includes(TOKEN), 'connection token must never appear in saved state');
      assert.deepEqual(errors, [], 'page should have no uncaught errors');
      await context.close();
    }
  };
}

(async () => {
  const browser = await chromium.launch({ channel: process.env.STUDIO_BROWSER_CHANNEL || 'chrome', headless: true });
  const results = [];
  const scenario = async (name, action) => {
    const f = await fixture(browser);
    try { await action(f); await f.close(); results.push(name); console.log('PASS ' + name); }
    catch (error) { console.error('FAIL ' + name); await f.page.context().close(); throw error; }
  };
  try {
    await scenario('pending file load preserves edits made before its response', async f => {
      await f.connect('team/product-a'); await f.repositoryView(); await f.loadOriginal();
      const pending = f.defer('Other.cs');
      await f.page.locator('#repo-path').fill('Other.cs');
      await f.page.getByRole('button', { name: 'Load file', exact: true }).click();
      await pending;
      const correction = 'Keep this correction typed during the pending load';
      await f.page.locator('#code').fill(correction); await f.saved();
      await f.release('Other.cs');
      await f.page.waitForFunction(() => document.querySelector('#notice').textContent.includes('draft changed while the file was loading'));
      assert.equal(await f.page.locator('#code').inputValue(), correction);
      const project = (await f.state()).projects[0];
      assert.equal(project.remote.content, correction);
      assert.equal(project.remote.path, 'Program.cs');
      assert.equal(project.remote.loadedContent, 'Original source');
    });

    await scenario('practice connection preserves the chosen product release repository', async f => {
      await f.page.getByRole('link', { name: 'Release desk', exact: true }).click();
      await f.page.locator('#release-repository').fill('team/client-product'); await f.saved();
      await f.connect('team/engineering-studio');
      assert.equal(await f.page.locator('#release-repository').inputValue(), 'team/client-product');
      assert.equal((await f.state()).projects[0].release.repository, 'team/client-product');
      assert.ok(f.requests.some(request => request.path === '/repos/team/engineering-studio'));
    });

    await scenario('C# results stay with their requested lesson', async f => {
      await f.connect('team/engineering-studio');
      await f.page.getByRole('link', { name: 'Build room', exact: true }).click();
      await f.page.locator('#lesson-select').selectOption('money');
      await f.page.locator('[data-action=run-csharp]').click();
      await f.page.getByRole('button', { name: 'Send build request', exact: true }).click();
      await f.page.waitForFunction(() => document.querySelector('#console').textContent.includes('accepted the request'));
      const dispatch = f.requests.find(request => request.method === 'POST');
      assert.equal(dispatch.body.inputs.lesson, 'money');
      assert.equal(dispatch.body.ref, 'main');
      assert.equal((await f.state()).projects[0].practice.results.money, undefined, 'enqueue must not create a passed result');
      await f.page.locator('#lesson-select').selectOption('validation');
      await f.page.locator('[data-action=refresh-run]').click();
      await f.page.waitForFunction(() => document.querySelector('#notice').textContent.includes('money lesson'));
      assert.ok(!(await f.page.locator('#console').textContent()).includes('compiled, ran'));
      assert.ok(!f.requests.some(request => request.path.endsWith('/actions/runs/101')), 'wrong lesson must not read/attach the run');
      assert.equal((await f.state()).projects[0].practice.results.validation, undefined);
      await f.page.locator('#lesson-select').selectOption('money');
      await f.page.locator('[data-action=refresh-run]').click();
      await f.page.waitForFunction(() => document.querySelector('#console').textContent.includes('compiled, ran'));
      assert.equal((await f.state()).projects[0].practice.results.money.passed, true);
      assert.equal((await f.state()).projects[0].practice.results.validation, undefined);
    });

    await scenario('a loaded draft cannot be committed through another repository connection', async f => {
      await f.connect('team/product-a'); await f.repositoryView(); await f.loadOriginal();
      await f.page.locator('#code').fill('Draft owned by repository A'); await f.saved();
      await f.connect('team/product-b');
      await f.page.getByRole('button', { name: 'Save commit to work branch', exact: true }).click();
      await f.page.waitForFunction(() => document.querySelector('#notice').textContent.includes('different repository'));
      assert.equal(await f.page.locator('#modal').evaluate(node => node.open), false, 'cross-repository commit must not open confirmation');
      assert.ok(!f.requests.some(request => request.method === 'PUT'), 'cross-repository save must not reach the API');
      const project = (await f.state()).projects[0];
      assert.equal(project.remote.repository, 'team/product-a');
      assert.equal(project.remote.content, 'Draft owned by repository A');
      assert.equal(project.remote.loadedContent, 'Original source');
    });

    await scenario('new files require a work branch and review before their first commit', async f => {
      await f.connect('team/product-a'); await f.repositoryView();
      await f.page.getByRole('button', { name: 'New file', exact: true }).click();
      await f.page.locator('#new-file-form [name=branch]').fill('main');
      await f.page.locator('#new-file-form [name=path]').fill('src/MenuPrice.cs');
      await f.page.locator('#new-file-form [name=template]').selectOption('class');
      await f.page.getByRole('button', { name: 'Create local file draft', exact: true }).click();
      assert.match(await f.page.locator('#new-file-error').textContent(), /default branch is protected/);
      assert.equal((await f.state()).projects[0].remote.path, '');
      assert.ok(!f.requests.some(request => request.method === 'PUT'), 'default branch draft must not write remotely');

      await f.page.locator('#new-file-form [name=branch]').fill('work/menu-price');
      await f.page.getByRole('button', { name: 'Create local file draft', exact: true }).click();
      await f.page.waitForFunction(() => !document.querySelector('#modal').open);
      assert.match(await f.page.locator('#code').inputValue(), /public sealed class NewFeature/);
      const source = 'namespace ExampleProduct;\n\npublic sealed class MenuPrice\n{\n    public int Cents { get; init; } = 1299;\n}\n';
      await f.page.locator('#code').fill(source); await f.saved();
      assert.ok(!f.requests.some(request => request.method === 'PUT'), 'creating and editing a draft must stay local');

      await f.page.getByRole('button', { name: 'Save commit to work branch', exact: true }).click();
      await f.page.getByRole('heading', { name: 'Review this commit before saving.', exact: true }).waitFor();
      assert.equal(await f.page.locator('#modal details pre').textContent(), source);
      await f.page.locator('#commit-form [name=message]').fill('Add menu price in integer cents');
      assert.ok(!f.requests.some(request => request.method === 'PUT'), 'review must precede the remote write');
      await f.page.getByRole('button', { name: 'Save this commit', exact: true }).click();
      await f.page.waitForFunction(() => !document.querySelector('#modal').open);
      const writes = f.requests.filter(request => request.method === 'PUT');
      assert.equal(writes.length, 1);
      assert.equal(writes[0].path, '/repos/team/product-a/contents/src/MenuPrice.cs');
      assert.equal(writes[0].body.branch, 'work/menu-price');
      assert.equal(writes[0].body.message, 'Add menu price in integer cents');
      assert.equal(Buffer.from(writes[0].body.content, 'base64').toString('utf8'), source);
      assert.equal(Object.hasOwn(writes[0].body, 'sha'), false, 'first commit must omit SHA so an existing file cannot be overwritten');
      const remote = (await f.state()).projects[0].remote;
      assert.equal(remote.sha, 'b'.repeat(40));
      assert.equal(remote.commitSha, 'c'.repeat(40));
      assert.equal(remote.loadedContent, source);
    });
    if (process.env.STUDIO_TEST_REPORT) fs.writeFileSync(process.env.STUDIO_TEST_REPORT, JSON.stringify({ passed: results.length, scenarios: results, mockedGitHub: true, sourceEntry: entry }, null, 2));
    console.log(JSON.stringify({ passed: results.length, scenarios: results, mockedGitHub: true }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

