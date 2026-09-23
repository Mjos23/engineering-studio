/* Dependency-free GitHub connector. Credentials live only in this page's memory. */
(function () {
  'use strict';
  const API = 'https://api.github.com';
  const MAX_FILE_BYTES = 1024 * 1024;
  const FULL_SHA = /^[a-f0-9]{40}$/i;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8', { fatal: true });

  function repositoryName(value) {
    if (typeof value !== 'string' || value.length > 180 ||
        !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9_.-]{1,100}$/.test(value) ||
        ['.', '..'].includes(value.split('/')[1])) {
      throw new Error('Enter a repository as owner/repository, without a URL.');
    }
    return value;
  }
  function branchName(value) {
    if (typeof value !== 'string' || !value || value.length > 240 || value === '@' ||
        /[\x00-\x20\x7f~^:?*\[\\]/.test(value) || value.includes('..') || value.includes('@{') ||
        value.startsWith('-') || value.startsWith('refs/') || value.endsWith('.') ||
        value.split('/').some(part => !part || part.startsWith('.') || part.endsWith('.lock'))) {
      throw new Error('Use a valid branch name such as work/menu-totals.');
    }
    return value;
  }
  function reference(value) { return FULL_SHA.test(value) ? value : branchName(value); }
  function filePath(value) {
    if (typeof value !== 'string' || !value || value.length > 1000 ||
        /[\x00-\x1f\x7f\\]/.test(value) || value.split('/').some(part => !part || part === '.' || part === '..')) {
      throw new Error('Use a file path inside the repository, such as src/Program.cs.');
    }
    return value.split('/').map(encodeURIComponent).join('/');
  }
  function fullSha(value) {
    if (typeof value !== 'string' || !FULL_SHA.test(value)) throw new Error('Choose a full 40-character commit or file SHA.');
    return value;
  }
  function numericId(value) {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Choose a valid GitHub run ID.');
    return id;
  }
  function encodeText(value) {
    const bytes = encoder.encode(value);
    if (bytes.length > MAX_FILE_BYTES) throw new Error('This editor accepts text files up to 1 MB.');
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
  }
  function decodeText(value) {
    try {
      const binary = atob(value.replace(/\s/g, ''));
      if (binary.length > MAX_FILE_BYTES) throw new Error('size');
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      const result = decoder.decode(bytes);
      if (result.includes('\u0000')) throw new Error('binary');
      return result;
    } catch (_) { throw new Error('The selected file is not a supported UTF-8 text file under 1 MB.'); }
  }
  function safeText(value, max = 300) {
    return typeof value === 'string' ? value.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').slice(0, max) : '';
  }

  class StudioGitHub {
    #token;
    #repository;
    #controllers = new Set();
    #defaultBranch = null;

    constructor({ token, repository } = {}) {
      this.#repository = repositoryName(repository);
      if (typeof token !== 'string' || !token.trim() || /\s/.test(token.trim()) || token.length > 500) {
        throw new Error('Enter your GitHub fine-grained token for this browser session.');
      }
      this.#token = token.trim();
    }
    get repository() { return this.#repository; }
    get defaultBranch() { return this.#defaultBranch; }
    disconnect() {
      this.#token = '';
      this.#defaultBranch = null;
      for (const controller of this.#controllers) controller.abort();
      this.#controllers.clear();
    }
    #repoPath(suffix = '') {
      return '/repos/' + this.#repository.split('/').map(encodeURIComponent).join('/') + suffix;
    }
    #webPath(suffix) { return 'https://github.com/' + this.#repository.split('/').map(encodeURIComponent).join('/') + suffix; }
    async #request(path, method = 'GET', payload) {
      if (!this.#token) throw new Error('This GitHub session is disconnected. Connect again to continue.');
      const controller = new AbortController();
      this.#controllers.add(controller);
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 25000);
      try {
        const response = await fetch(API + path, {
          method,
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: 'Bearer ' + this.#token,
            'X-GitHub-Api-Version': '2026-03-10',
            ...(payload === undefined ? {} : { 'Content-Type': 'application/json' })
          },
          ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
          credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer',
          signal: controller.signal
        });
        if (!this.#token) throw new Error('This GitHub session is disconnected.');
        if (!response.ok) {
          const status = response.status;
          let detail;
          if (status === 429 || (status === 403 && (response.headers.get('x-ratelimit-remaining') === '0' || response.headers.get('retry-after')))) {
            const wait = Number(response.headers.get('retry-after'));
            detail = 'GitHub has paused requests to protect its rate limit.' + (wait > 0 && wait < 86400 ? ' Wait ' + Math.ceil(wait) + ' seconds before retrying.' : ' Wait before refreshing again.');
          } else {
            detail = ({
              401: 'The token is invalid or expired. Connect with a new token.',
              403: 'Access was denied. Check repository access, token permissions, organization approval, and Actions allowance.',
              404: 'The repository, file, branch, or workflow was not found, or this token cannot access it.',
              409: 'The file or branch changed. Reload it and compare your draft before saving again.',
              422: 'GitHub rejected these values. Check the branch, file SHA, workflow inputs, and whether the name already exists.'
            })[status] || (status >= 500 ? 'GitHub is temporarily unavailable. Try again later.' : 'GitHub could not complete this request.');
          }
          const error = new Error('GitHub HTTP ' + status + ': ' + detail);
          error.status = status;
          throw error;
        }
        if (response.status === 204) return null;
        try { return await response.json(); }
        catch (_) { throw new Error('GitHub returned an unreadable response. Refresh and try again.'); }
      } catch (error) {
        if (!this.#token) throw new Error('This GitHub session is disconnected. Connect again to continue.');
        if (timedOut) throw new Error('GitHub did not respond in time. Check your connection and refresh before retrying a save.');
        if (error.status || /^GitHub returned/.test(error.message)) throw error;
        throw new Error('Could not reach GitHub. Check your internet connection and browser access; refresh before retrying a save.');
      } finally {
        clearTimeout(timer);
        this.#controllers.delete(controller);
      }
    }
    async #metadata() {
      const repo = await this.#request(this.#repoPath());
      this.#defaultBranch = branchName(repo.default_branch);
      return repo;
    }
    async check() {
      const [user, repo] = await Promise.all([this.#request('/user'), this.#metadata()]);
      return { login: safeText(user.login, 80), repository: safeText(repo.full_name, 180) || this.#repository, defaultBranch: this.#defaultBranch };
    }
    async branches() {
      const results = [];
      for (let page = 1; page <= 20; page++) {
        const data = await this.#request(this.#repoPath('/branches?per_page=100&page=' + page));
        if (!Array.isArray(data)) throw new Error('GitHub did not return a branch list.');
        results.push(...data.map(branch => ({ name: safeText(branch.name, 240), sha: fullSha(branch.commit.sha) })));
        if (data.length < 100) return results;
      }
      throw new Error('This repository has too many branches for the studio browser. Archive old branches and try again.');
    }
    async listFiles(ref) {
      reference(ref);
      // Resolve the immutable tree first, so a moving branch cannot mix tree pages.
      let treeSha;
      if (FULL_SHA.test(ref)) {
        const commit = await this.#request(this.#repoPath('/git/commits/' + ref));
        treeSha = fullSha(commit.tree.sha);
      } else {
        const branch = await this.#request(this.#repoPath('/branches/' + encodeURIComponent(ref)));
        fullSha(branch.commit.sha);
        treeSha = fullSha(branch.commit.commit.tree.sha);
      }
      const data = await this.#request(this.#repoPath('/git/trees/' + treeSha + '?recursive=1'));
      if (!data || !Array.isArray(data.tree)) throw new Error('GitHub did not return a repository file list.');
      if (data.truncated) {
        throw new Error('GitHub returned a truncated file tree because this repository is too large. The browser list is incomplete; open a known file by its full path or browse the repository on GitHub.');
      }
      const skippedFolders = new Set(['.git', '.vs', '.idea', '.tools', '.next', '.nuxt', 'node_modules', 'bin', 'obj', 'dist', 'build', 'coverage', 'testresults', '__pycache__']);
      const binaryExtension = /\.(?:png|jpe?g|gif|webp|avif|ico|tiff?|bmp|pdf|zip|gz|tgz|tar|7z|rar|docx?|pptx?|xlsx?|woff2?|ttf|otf|eot|mp[34]|wav|ogg|webm|mov|avi|m4[av]|exe|dll|pdb|so|dylib|bin|dat|db|sqlite3?|bak|nupkg|snupkg|obj|class|pyc|wasm)$/i;
      const files = [];
      for (const item of data.tree) {
        if (item.type !== 'blob' || !['100644', '100755'].includes(item.mode)) continue;
        filePath(item.path);
        if (!Number.isSafeInteger(item.size) || item.size < 0 || item.size > MAX_FILE_BYTES) continue;
        if (item.path.split('/').slice(0, -1).some(part => skippedFolders.has(part.toLowerCase())) || binaryExtension.test(item.path)) continue;
        files.push({ path: item.path, size: item.size });
      }
      return files.sort((a, b) => a.path.localeCompare(b.path));
    }
    async loadFile(path, ref) {
      const encodedPath = filePath(path);
      reference(ref);
      const data = await this.#request(this.#repoPath('/contents/' + encodedPath + '?ref=' + encodeURIComponent(ref)));
      if (!data || data.type !== 'file' || data.encoding !== 'base64' || typeof data.content !== 'string' || data.size > MAX_FILE_BYTES) {
        throw new Error('Choose a UTF-8 text file under 1 MB, not a folder, linked file, or submodule.');
      }
      return { path, sha: fullSha(data.sha), content: decodeText(data.content) };
    }
    async saveFile({ path, ref, content, sha, message } = {}) {
      const encodedPath = filePath(path);
      branchName(ref);
      if (typeof content !== 'string') throw new Error('File contents must be plain text.');
      if (typeof message !== 'string' || !message.trim() || message.length > 500 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(message)) {
        throw new Error('Write a short commit message describing the change (up to 500 characters).');
      }
      if (sha !== null && sha !== undefined && sha !== '') fullSha(sha);
      const encoded = encodeText(content);
      // Refresh before every remote write: the repository's default may change during a session.
      await this.#metadata();
      if (ref === this.#defaultBranch) throw new Error('The default branch is protected in Studio. Create or select a work branch before saving.');
      const payload = { branch: ref, message: message.trim(), content: encoded };
      if (sha) payload.sha = sha;
      const data = await this.#request(this.#repoPath('/contents/' + encodedPath), 'PUT', payload);
      const commitSha = fullSha(data.commit.sha);
      return { sha: fullSha(data.content.sha), commitSha, url: this.#webPath('/commit/' + commitSha) };
    }
    async createBranch({ name, sha } = {}) {
      branchName(name);
      fullSha(sha);
      await this.#metadata();
      if (name === this.#defaultBranch) throw new Error('Choose a work branch name different from the default branch.');
      const data = await this.#request(this.#repoPath('/git/refs'), 'POST', { ref: 'refs/heads/' + name, sha });
      return { name, sha: fullSha(data.object.sha) };
    }
    #normalizeRun(data) {
      const id = numericId(data.id);
      return {
        id, name: safeText(data.name), title: safeText(data.display_title),
        status: safeText(data.status, 40), conclusion: data.conclusion === null ? null : safeText(data.conclusion, 40),
        sha: fullSha(data.head_sha), url: this.#webPath('/actions/runs/' + id),
        createdAt: safeText(data.created_at, 40), branch: safeText(data.head_branch, 240),
        event: safeText(data.event, 60), workflowId: Number(data.workflow_id) || null,
        workflow: safeText(data.path, 1000)
      };
    }
    async runs(ref) {
      reference(ref);
      const filter = FULL_SHA.test(ref) ? 'head_sha' : 'branch';
      const data = await this.#request(this.#repoPath('/actions/runs?per_page=100&' + filter + '=' + encodeURIComponent(ref)));
      if (!Array.isArray(data.workflow_runs)) throw new Error('GitHub did not return a workflow run list.');
      return data.workflow_runs.map(run => this.#normalizeRun(run));
    }
    async dispatch({ workflow, ref, inputs = {} } = {}) {
      branchName(ref);
      if (!(typeof workflow === 'string' || typeof workflow === 'number') ||
          !/^(?:[1-9][0-9]*|[A-Za-z0-9][A-Za-z0-9_.-]*\.ya?ml)$/.test(String(workflow))) {
        throw new Error('Use a workflow filename such as studio-csharp.yml.');
      }
      if (!inputs || Array.isArray(inputs) || typeof inputs !== 'object' || Object.keys(inputs).length > 25 ||
          Object.entries(inputs).some(([key, value]) => !/^[A-Za-z_][A-Za-z0-9_-]{0,99}$/.test(key) || typeof value !== 'string')) {
        throw new Error('Workflow inputs must contain up to 25 named text values.');
      }
      const payload = { ref, inputs };
      if (encoder.encode(JSON.stringify(payload)).length > 65000) {
        throw new Error('The workflow input payload is too large (65,000 bytes maximum). Shorten the lesson source or expected output.');
      }
      const submittedAt = new Date().toISOString();
      const data = await this.#request(this.#repoPath('/actions/workflows/' + encodeURIComponent(workflow) + '/dispatches'), 'POST', payload);
      const id = data && data.workflow_run_id ? numericId(data.workflow_run_id) : null;
      return { queued: true, id, url: this.#webPath(id ? '/actions/runs/' + id : '/actions'), submittedAt };
    }
    async annotations(runId) {
      const id = numericId(runId);
      const jobs = await this.#request(this.#repoPath('/actions/runs/' + id + '/jobs?filter=latest&per_page=100'));
      if (!Array.isArray(jobs.jobs)) throw new Error('GitHub did not return job details for diagnostics.');
      const prefix = this.#repoPath('/check-runs/').toLowerCase();
      const checks = new Set();
      // Never follow a response URL: validate its repository and extract only the numeric ID.
      for (const job of jobs.jobs.slice(0, 100)) {
        if (typeof job.check_run_url !== 'string') continue;
        try {
          const url = new URL(job.check_run_url);
          if (url.origin !== API || url.username || url.password || url.search || url.hash ||
              !url.pathname.toLowerCase().startsWith(prefix)) continue;
          const suffix = url.pathname.slice(prefix.length);
          if (!/^[1-9][0-9]*$/.test(suffix)) continue;
          checks.add(numericId(suffix));
        } catch (_) { /* A malformed response link must not become an authenticated request. */ }
      }
      const result = [];
      for (const checkId of checks) {
        let annotations;
        try {
          annotations = await this.#request(this.#repoPath('/check-runs/' + checkId + '/annotations?per_page=100'));
        } catch (error) {
          if (error.status === 403 && !/rate limit/i.test(error.message)) {
            const permissionError = new Error('GitHub HTTP 403: Checks read permission is needed to show compiler diagnostics inside Studio. Update the fine-grained token and connect again.');
            permissionError.status = 403;
            throw permissionError;
          }
          throw error;
        }
        if (!Array.isArray(annotations)) throw new Error('GitHub did not return compiler diagnostics.');
        for (const item of annotations) {
          if (!item || typeof item !== 'object') continue;
          const startLine = Number.isSafeInteger(item.start_line) && item.start_line > 0 ? item.start_line : null;
          const endLine = Number.isSafeInteger(item.end_line) && item.end_line >= (startLine || 1) ? item.end_line : startLine;
          result.push({
            path: safeText(item.path, 1000), startLine, endLine,
            level: ['notice', 'warning', 'failure'].includes(item.annotation_level) ? item.annotation_level : 'notice',
            message: safeText(item.message, 5000), title: safeText(item.title, 255)
          });
          if (result.length === 100) return result;
        }
      }
      return result;
    }
    async run(id) {
      id = numericId(id);
      const data = await this.#request(this.#repoPath('/actions/runs/' + id));
      const result = this.#normalizeRun(data);
      result.jobs = [];
      result.failures = [];
      for (let page = 1; page <= 20; page++) {
        const jobs = await this.#request(this.#repoPath('/actions/runs/' + id + '/jobs?filter=latest&per_page=100&page=' + page));
        if (!Array.isArray(jobs.jobs)) throw new Error('GitHub did not return job details.');
        for (const job of jobs.jobs) {
          const normalized = {
            id: numericId(job.id), name: safeText(job.name), status: safeText(job.status, 40),
            conclusion: job.conclusion === null ? null : safeText(job.conclusion, 40),
            steps: (Array.isArray(job.steps) ? job.steps : []).map(step => ({
              number: Number(step.number), name: safeText(step.name), status: safeText(step.status, 40),
              conclusion: step.conclusion === null ? null : safeText(step.conclusion, 40)
            }))
          };
          result.jobs.push(normalized);
          const failures = normalized.steps.filter(step => ['failure', 'cancelled', 'timed_out', 'action_required'].includes(step.conclusion));
          for (const step of failures) result.failures.push(normalized.name + ' — ' + step.name + ': ' + step.conclusion.replace(/_/g, ' '));
          if (!failures.length && ['failure', 'cancelled', 'timed_out', 'action_required'].includes(normalized.conclusion)) {
            result.failures.push(normalized.name + ': ' + normalized.conclusion.replace(/_/g, ' '));
          }
        }
        if (jobs.jobs.length < 100) return result;
      }
      throw new Error('This run has too many jobs to show in Studio. Open the run on GitHub for full results.');
    }
  }
  window.StudioGitHub = StudioGitHub;
}());
