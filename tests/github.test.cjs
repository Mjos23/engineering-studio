const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const file = path.resolve(__dirname, '../engineering/github.js');
const SHA = 'a'.repeat(40), NEXT = 'b'.repeat(40);
function response(body, status = 200, headers = {}) {
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers });
}
function client(replies = []) {
  const calls = [];
  const context = { window: {}, TextEncoder, TextDecoder, atob, btoa, URL, URLSearchParams,
    AbortController, setTimeout, clearTimeout,
    fetch: async (url, options) => {
      calls.push({ url, options });
      const next = replies.shift();
      if (typeof next === 'function') return next(url, options);
      if (!next) throw new Error('Unexpected request');
      return next;
    } };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), context);
  const Class = context.window.StudioGitHub;
  return { Class, github: new Class({ token: 'github_pat_test', repository: 'our-team/product' }), calls };
}
const meta = () => response({ full_name: 'our-team/product', default_branch: 'main' });

test('rejects repository URLs and traversal without requests', () => {
  const { Class, calls } = client();
  for (const repository of ['https://evil.test/a', '../x', 'team/repo/contents', 'team/.', 'team/repo?x=1']) {
    assert.throws(() => new Class({ token: 'token', repository }), /repository/i);
  }
  assert.equal(calls.length, 0);
});
test('checks identity and repository without storing an enumerable token', async () => {
  const { github, calls } = client([response({ login: 'engineer' }), meta()]);
  assert.deepEqual(JSON.parse(JSON.stringify(await github.check())), {
    login: 'engineer', repository: 'our-team/product', defaultBranch: 'main'
  });
  assert.equal(JSON.stringify(github).includes('github_pat_test'), false);
  assert.ok(calls.every(c => c.url.startsWith('https://api.github.com/')));
  assert.ok(calls.every(c => c.options.credentials === 'omit' && c.options.redirect === 'error'));
});
test('loads Unicode source using UTF-8 and encodes path and branch independently', async () => {
  const content = 'Console.WriteLine("Café 🍋");';
  const { github, calls } = client([response({ type: 'file', sha: SHA, encoding: 'base64', content: Buffer.from(content).toString('base64') })]);
  const result = await github.loadFile('src/Café.cs', 'work/menu');
  assert.equal(result.content, content);
  assert.ok(calls[0].url.includes('src/Caf%C3%A9.cs?ref=work%2Fmenu'));
  await assert.rejects(github.loadFile('../secret', 'work/menu'), /path/i);
  await assert.rejects(github.loadFile('src/test.cs', 'bad..branch'), /branch|reference/i);
});
test('default branch edits are refused after a fresh repository check', async () => {
  const { github, calls } = client([meta()]);
  await assert.rejects(github.saveFile({ path: 'Program.cs', ref: 'main', content: 'x', sha: SHA, message: 'Fix' }), /default branch/i);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, 'GET');
});
test('saving includes the expected blob SHA and preserves UTF-8', async () => {
  const { github, calls } = client([meta(), response({ content: { sha: NEXT }, commit: { sha: NEXT } })]);
  const result = await github.saveFile({ path: 'Program.cs', ref: 'work/menu', content: 'é 🥣', sha: SHA, message: 'Fix total' });
  const body = JSON.parse(calls[1].options.body);
  assert.equal(body.sha, SHA);
  assert.equal(body.branch, 'work/menu');
  assert.equal(Buffer.from(body.content, 'base64').toString('utf8'), 'é 🥣');
  assert.equal(result.commitSha, NEXT);
  assert.equal(result.url, 'https://github.com/our-team/product/commit/' + NEXT);
});
test('conflict reports actionable failure and never leaks response text or credentials', async () => {
  const { github } = client([meta(), response({ message: 'github_pat_test secret <script>x</script>' }, 409)]);
  await assert.rejects(github.saveFile({ path: 'Program.cs', ref: 'work/menu', content: 'x', sha: SHA, message: 'Fix' }), error => {
    assert.match(error.message, /409.*changed|changed.*409/i);
    assert.equal(error.message.includes('github_pat_test'), false);
    assert.equal(error.message.includes('<script>'), false);
    return true;
  });
});
test('disconnection erases access and blocks subsequent calls', async () => {
  const { github, calls } = client();
  github.disconnect();
  await assert.rejects(github.branches(), /connect|session/i);
  assert.equal(calls.length, 0);
});
test('branch creation uses an exact commit and rejects reference injection', async () => {
  const { github, calls } = client([meta(), response({ ref: 'refs/heads/work/menu', object: { sha: SHA } }, 201)]);
  await github.createBranch({ name: 'work/menu', sha: SHA });
  assert.deepEqual(JSON.parse(calls[1].options.body), { ref: 'refs/heads/work/menu', sha: SHA });
  await assert.rejects(github.createBranch({ name: 'refs/heads/main', sha: SHA }), /branch|reference/i);
});
test('run search filters by exact full commit when supplied', async () => {
  const { github, calls } = client([response({ workflow_runs: [{ id: 12, name: 'Build', status: 'completed', conclusion: 'success', head_sha: SHA, head_branch: 'work/menu', created_at: '2026-09-23T00:00:00Z', path: '.github/workflows/product-ci.yml' }] })]);
  const runs = await github.runs(SHA);
  assert.ok(calls[0].url.includes('head_sha=' + SHA));
  assert.equal(runs[0].sha, SHA);
  assert.equal(runs[0].status, 'completed');
  assert.equal(runs[0].workflow, '.github/workflows/product-ci.yml');
});
test('dispatch is queued rather than a successful check, with exact run ID when returned', async () => {
  const { github, calls } = client([response({ workflow_run_id: 123, html_url: 'https://evil.test' })]);
  const result = await github.dispatch({ workflow: 'studio-csharp.yml', ref: 'work/menu', inputs: { source: btoa('x'), expected: btoa('ok'), lesson: 'money', request_id: 'request-123' } });
  assert.equal(result.queued, true);
  assert.equal(result.id, 123);
  assert.equal(result.url, 'https://github.com/our-team/product/actions/runs/123');
  assert.equal(result.conclusion, undefined);
  assert.equal(JSON.parse(calls[0].options.body).ref, 'work/menu');
});
test('dispatch handles a legacy no-content response and rejects oversized payload before sending', async () => {
  const { github, calls } = client([response(null, 204)]);
  assert.equal((await github.dispatch({ workflow: 'build.yml', ref: 'work/menu', inputs: {} })).id, null);
  await assert.rejects(github.dispatch({ workflow: 'studio-csharp.yml', ref: 'work/menu', inputs: { source: 'x'.repeat(66000) } }), /65|payload|large/i);
  assert.equal(calls.length, 1);
});
test('job details identify failed steps, preserve real conclusions and use safe URLs', async () => {
  const { github } = client([
    response({ id: 12, name: 'Build', status: 'completed', conclusion: 'failure', head_sha: SHA, head_branch: 'work/menu', html_url: 'https://evil.test', path: '.github/workflows/product-ci.yml' }),
    response({ total_count: 1, jobs: [{ id: 3, name: 'Practice', status: 'completed', conclusion: 'failure', steps: [{ name: 'Compile C#', status: 'completed', conclusion: 'failure', number: 2 }] }] })
  ]);
  const run = await github.run(12);
  assert.equal(run.conclusion, 'failure');
  assert.equal(run.sha, SHA);
  assert.equal(run.workflow, '.github/workflows/product-ci.yml');
  assert.match(run.failures[0], /Practice.*Compile C#.*failure/);
  assert.equal(run.url, 'https://github.com/our-team/product/actions/runs/12');
  assert.equal(run.jobs[0].steps[0].conclusion, 'failure');
});
test('rate limits include a retry delay without echoing response data', async () => {
  const { github } = client([response({ message: 'secret' }, 429, { 'Retry-After': '30' })]);
  await assert.rejects(github.branches(), /429.*30|30.*429/);
});
test('aborting a session interrupts pending operations', async () => {
  const { github } = client([(_url, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted'))))]);
  const pending = github.branches();
  github.disconnect();
  await assert.rejects(pending, /session|disconnect/i);
});
test('file browser resolves a branch once and lists only editable source candidates', async () => {
  const blob = (path, size = 30, mode = '100644') => ({ path, type: 'blob', mode, size });
  const { github, calls } = client([
    response({ commit: { sha: SHA, commit: { tree: { sha: NEXT } } } }),
    response({ truncated: false, tree: [
      blob('src/Program.cs'), blob('README.md'), blob('src/Café.razor'), blob('.github/workflows/build.yml'),
      blob('wwwroot/logo.png'), blob('src/bin/Release/app.dll'), blob('obj/Debug/file.cs'),
      blob('node_modules/library/index.js'), blob('.git/config'), blob('dist/bundle.js'),
      blob('archive.zip'), blob('large.txt', 1024 * 1024 + 1), blob('link.cs', 10, '120000'),
      { path: 'src', type: 'tree', mode: '040000' }, { path: 'vendor/lib', type: 'commit', mode: '160000' }
    ] })
  ]);
  const files = await github.listFiles('work/menu');
  assert.deepEqual(Array.from(files, f => f.path).sort(), ['.github/workflows/build.yml', 'README.md', 'src/Café.razor', 'src/Program.cs'].sort());
  assert.equal(files.find(f => f.path === 'src/Program.cs').size, 30);
  assert.match(calls[0].url, /\/branches\/work%2Fmenu$/);
  assert.match(calls[1].url, new RegExp('/git/trees/' + NEXT + '\\?recursive=1$'));
  assert.ok(calls.every(call => call.options.method === 'GET'));
});
test('file browser resolves immutable commit refs and refuses truncated lists', async () => {
  const { github, calls } = client([
    response({ sha: SHA, tree: { sha: NEXT } }),
    response({ truncated: true, tree: [{ path: 'only-part.cs', type: 'blob', size: 2, mode: '100644' }] })
  ]);
  await assert.rejects(github.listFiles(SHA), /truncated|incomplete|too large/i);
  assert.match(calls[0].url, new RegExp('/git/commits/' + SHA + '$'));
});
test('file browser rejects malformed references and paths', async () => {
  const { github, calls } = client([
    response({ commit: { sha: SHA, commit: { tree: { sha: NEXT } } } }),
    response({ truncated: false, tree: [{ path: '../secret.cs', type: 'blob', size: 2, mode: '100644' }] })
  ]);
  await assert.rejects(github.listFiles('../escape'), /branch/i);
  assert.equal(calls.length, 0);
  await assert.rejects(github.listFiles('main'), /path/i);
});
test('diagnostics only read validated check IDs in this repository and normalize text', async () => {
  const { github, calls } = client([
    response({ jobs: [
      { check_run_url: 'https://api.github.com/repos/our-team/product/check-runs/456' },
      { check_run_url: 'https://api.github.com/repos/our-team/product/check-runs/456' },
      { check_run_url: 'https://evil.test/repos/our-team/product/check-runs/999' },
      { check_run_url: 'https://api.github.com/repos/other/repo/check-runs/999' },
      { check_run_url: 'https://api.github.com/repos/our-team/product/check-runs/789?redirect=evil' }
    ] }),
    response([{ path: 'Program.cs', start_line: 4, end_line: 5, annotation_level: 'failure',
      title: 'C# compile error', message: "CS1002: ; expected\nConsole.WriteLine(\"Café\")" }])
  ]);
  const diagnostics = await github.annotations(123);
  assert.equal(calls.length, 2);
  assert.match(calls[1].url, /\/check-runs\/456\/annotations\?per_page=100$/);
  assert.deepEqual(JSON.parse(JSON.stringify(diagnostics)), [{ path: 'Program.cs', startLine: 4, endLine: 5,
    level: 'failure', title: 'C# compile error', message: "CS1002: ; expected\nConsole.WriteLine(\"Café\")" }]);
});
test('diagnostics limits result count and message length', async () => {
  const { github, calls } = client([
    response({ jobs: [ { check_run_url: 'https://api.github.com/repos/our-team/product/check-runs/1' },
      { check_run_url: 'https://api.github.com/repos/our-team/product/check-runs/2' } ] }),
    response(Array.from({ length: 120 }, () => ({ path: '', message: 'x'.repeat(7000), annotation_level: 'warning', title: 'warning' })))
  ]);
  const diagnostics = await github.annotations(123);
  assert.equal(diagnostics.length, 100);
  assert.equal(diagnostics[0].message.length, 5000);
  assert.equal(diagnostics[0].startLine, null);
  assert.equal(calls.length, 2);
});
test('diagnostics explain missing Checks read permission without affecting run status methods', async () => {
  const { github } = client([
    response({ jobs: [{ check_run_url: 'https://api.github.com/repos/our-team/product/check-runs/1' }] }),
    response({ message: 'not accessible' }, 403)
  ]);
  await assert.rejects(github.annotations(123), error => {
    assert.equal(error.status, 403);
    assert.match(error.message, /Checks.*read.*permission/i);
    return true;
  });
});
