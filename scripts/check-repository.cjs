// Fail on missing documented resources, broken local links, or incomplete UI output.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const required = ['README.md','README.zh-CN.md','docs/architecture.md','docs/validation.md',
  'docs/images/overview.png','app/THIRD_PARTY_NOTICES.txt','package-lock.json',
  'app/index.html','app/bundle.js','app/styles.css','app/design.css','app/assets/icon.svg',
  'assets/icon.ico','assets/icon.png'];
for (const file of required) assert.ok(fs.existsSync(file), 'Missing resource: '+file);
for (const file of ['README.md','README.zh-CN.md','docs/architecture.md','docs/validation.md']) {
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(!/C:[\\/]Users[\\/]/i.test(text), 'Private absolute path in '+file);
  for (const match of text.matchAll(/!?\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    assert.ok(fs.existsSync(path.resolve(path.dirname(file), decodeURIComponent(target.split('#')[0]))), 'Broken link in '+file+': '+target);
  }
}
assert.ok(fs.statSync('app/bundle.js').size > 1000, 'UI bundle is empty');
assert.equal(fs.readFileSync('assets/icon.svg','utf8'), fs.readFileSync('app/assets/icon.svg','utf8'));
const pkg = JSON.parse(fs.readFileSync('package.json'));
const lock = JSON.parse(fs.readFileSync('package-lock.json'));
assert.equal(pkg.version, lock.packages[''].version);
for (const [name, range] of Object.entries(pkg.devDependencies)) {
  assert.equal(range, lock.packages[''].devDependencies[name]);
  assert.ok(lock.packages['node_modules/'+name].integrity, 'Missing integrity: '+name);
}
console.log('Repository resources, local documentation links and lockfile checks passed.');
