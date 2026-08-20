#!/usr/bin/env node
'use strict';
/*
 * Headless smoke test for the shipped page. It reads index.html, loads exactly
 * the scripts the page loads, in the same order, into a minimal DOM, and then
 * drives the real app.js: draws, the Japanese-only filter, category switching,
 * localStorage and the copy format.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((match) => match[1]);
assert(scripts.length > 3, 'no script tags found in index.html');

function elementIdsInHtml() {
  return [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
}

function makeElement(id) {
  const element = {
    id,
    className: '',
    textContent: '',
    value: '',
    checked: false,
    children: [],
    attributes: {},
    listeners: {},
    appendChild(child) { this.children.push(child); return child; },
    append(...nodes) { this.children.push(...nodes); },
    remove() {},
    select() {},
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null; },
    addEventListener(type, handler) { (this.listeners[type] = this.listeners[type] || []).push(handler); },
    fire(type) { for (const handler of this.listeners[type] || []) handler({ type }); },
  };
  // The page clears the result list with innerHTML = ''; mirror that here.
  Object.defineProperty(element, 'innerHTML', {
    get() { return element.children.map((child) => child.textContent).join(''); },
    set(value) { if (!value) element.children.length = 0; },
  });
  return element;
}

function makeStorage() {
  const map = new Map();
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
  };
}

function boot(storage) {
  const elements = new Map();
  for (const id of elementIdsInHtml()) elements.set(id, makeElement(id));
  for (const [id, element] of elements) {
    if (id === 'tab-aqua') element.attributes['data-category'] = 'aqua';
    if (id === 'tab-flower') element.attributes['data-category'] = 'flower';
  }
  const body = makeElement('body');
  const copied = [];
  const context = {
    window: {},
    document: {
      body,
      getElementById: (id) => elements.get(id) || null,
      createElement: () => makeElement(''),
    },
    localStorage: storage,
    navigator: { clipboard: { writeText: async (text) => { copied.push(text); } } },
    setTimeout: (fn) => { void fn; return 0; },
    console,
  };
  context.globalThis = context;
  vm.createContext(context);
  for (const src of scripts) {
    vm.runInContext(fs.readFileSync(path.join(root, src), 'utf8'), context, { filename: src });
  }
  return { context, elements, copied };
}

const results = [];
function check(name, fn) {
  fn();
  results.push(name);
}

const DRAWS = 100;

function drawSuite(label, app, storage, storageKey, pool, aliases) {
  const drawBtn = app.elements.get('draw');
  const list = app.elements.get('results');
  for (let run = 0; run < DRAWS; run += 1) {
    drawBtn.fire('click');
    const drawn = JSON.parse(storage.getItem(storageKey));
    assert.strictEqual(drawn.length, 10, `${label}: draw ${run + 1} stored ${drawn.length} names`);
    assert.strictEqual(new Set(drawn).size, 10, `${label}: draw ${run + 1} contains a duplicate`);
    for (const name of drawn) {
      assert(pool.has(name), `${label}: draw ${run + 1} produced an out-of-pool name "${name}"`);
    }
    assert.strictEqual(list.children.length, 10, `${label}: draw ${run + 1} rendered ${list.children.length} rows`);
    const rendered = list.children.map((li) => li.children[1].children[0].textContent);
    const expected = drawn.map((name) => (aliases[name] && aliases[name] !== name ? aliases[name] : name));
    assert.deepStrictEqual(rendered, expected, `${label}: draw ${run + 1} rendered the wrong names`);
  }
}

const storage = makeStorage();
const app = boot(storage);
const aqua = app.context.window.AQUA_SPECIES;
const aquaJa = app.context.window.AQUA_JA_NAMES;
const flower = app.context.window.FLOWER_SPECIES;
const flowerJa = app.context.window.FLOWER_JA_NAMES;
const isJapanese = (text) => /[ぁ-んァ-ヶ一-龠]/u.test(text);

check('aquatic pool is still 6,000 candidates', () => assert.strictEqual(aqua.length, 6000));
check('flower pool is exactly 5,000 candidates', () => assert.strictEqual(flower.length, 5000));

check('aquatic: 100 unfiltered draws of 10 unique in-pool names', () => {
  drawSuite('aqua', app, storage, 'aqua-last', new Set(aqua), aquaJa);
});

check('aquatic: candidate count shows 6,000', () => {
  assert.strictEqual(app.elements.get('count').textContent, (6000).toLocaleString('ja-JP'));
});

const jaOnly = app.elements.get('ja-only');
check('aquatic: 100 Japanese-only draws stay inside the localized pool', () => {
  jaOnly.checked = true;
  jaOnly.fire('change');
  const localized = aqua.filter((name) => isJapanese(name) || aquaJa[name]);
  assert(localized.length >= 10, 'aquatic localized pool is too small');
  assert.strictEqual(app.elements.get('count').textContent,
    `${localized.length.toLocaleString('ja-JP')} / ${(6000).toLocaleString('ja-JP')}`);
  drawSuite('aqua/ja', app, storage, 'aqua-last', new Set(localized), aquaJa);
});

check('switching to 花 swaps the pool, counts and title', () => {
  jaOnly.checked = false;
  jaOnly.fire('change');
  app.elements.get('tab-flower').fire('click');
  assert.strictEqual(app.elements.get('tab-flower').getAttribute('aria-selected'), 'true');
  assert.strictEqual(app.elements.get('tab-aqua').getAttribute('aria-selected'), 'false');
  assert.strictEqual(app.elements.get('count').textContent, (5000).toLocaleString('ja-JP'));
  assert.strictEqual(app.elements.get('title').textContent, '🌸 FLOWER MOTIF GACHA');
  const localized = flower.filter((name) => isJapanese(name) || flowerJa[name]);
  assert.strictEqual(app.elements.get('ja-count').textContent,
    `${localized.length.toLocaleString('ja-JP')} / ${(5000).toLocaleString('ja-JP')}`);
});

check('flower: 100 unfiltered draws of 10 unique in-pool names', () => {
  drawSuite('flower', app, storage, 'flower-last', new Set(flower), flowerJa);
});

check('flower: 100 Japanese-only draws stay inside the localized pool', () => {
  jaOnly.checked = true;
  jaOnly.fire('change');
  const localized = flower.filter((name) => isJapanese(name) || flowerJa[name]);
  assert(localized.length >= 10, 'flower localized pool is too small');
  assert.strictEqual(app.elements.get('count').textContent,
    `${localized.length.toLocaleString('ja-JP')} / ${(5000).toLocaleString('ja-JP')}`);
  drawSuite('flower/ja', app, storage, 'flower-last', new Set(localized), flowerJa);
  jaOnly.checked = false;
  jaOnly.fire('change');
});

check('each category keeps its own last result in localStorage', () => {
  const flowerLast = JSON.parse(storage.getItem('flower-last'));
  const aquaLast = JSON.parse(storage.getItem('aqua-last'));
  assert.strictEqual(flowerLast.length, 10);
  assert.strictEqual(aquaLast.length, 10);
  assert(flowerLast.every((name) => flower.includes(name)), 'flower-last leaked a non-flower name');
  assert(aquaLast.every((name) => aqua.includes(name)), 'aqua-last leaked a non-aquatic name');
  assert.strictEqual(storage.getItem('gacha-category'), 'flower');
});

check('reload restores the saved category and its own previous result', () => {
  const savedFlower = JSON.parse(storage.getItem('flower-last'));
  const reloaded = boot(storage);
  assert.strictEqual(reloaded.elements.get('title').textContent, '🌸 FLOWER MOTIF GACHA');
  const shown = reloaded.elements.get('results').children.map((li) => li.children[1].children[0].textContent);
  const expected = savedFlower.map((name) => (flowerJa[name] || name));
  assert.deepStrictEqual(shown, expected, 'saved flower result was not restored on reload');
  assert(reloaded.elements.get('previous').textContent.startsWith('前回: '));
});

check('switching back to 水生生物 restores the aquatic result, not the flower one', () => {
  const savedAqua = JSON.parse(storage.getItem('aqua-last'));
  app.elements.get('tab-aqua').fire('click');
  const shown = app.elements.get('results').children.map((li) => li.children[1].children[0].textContent);
  assert.deepStrictEqual(shown, savedAqua.map((name) => (aquaJa[name] || name)));
  assert.strictEqual(app.elements.get('count').textContent, (6000).toLocaleString('ja-JP'));
});

check('copy format keeps 1. 和名（学名） for aliased names and the bare name otherwise', () => {
  app.elements.get('tab-flower').fire('click');
  app.elements.get('draw').fire('click');
  app.elements.get('copy').fire('click');
  const text = app.copied[app.copied.length - 1];
  const lines = text.split('\n');
  assert.strictEqual(lines.length, 10);
  lines.forEach((line, index) => {
    const match = /^(\d+)\. (.+)$/.exec(line);
    assert(match, `copy line is not "N. name": ${line}`);
    assert.strictEqual(Number(match[1]), index + 1);
    const withAlias = /^(.+)（(.+)）$/.exec(match[2]);
    if (withAlias) {
      assert.strictEqual(flowerJa[withAlias[2]], withAlias[1], `copy line alias mismatch: ${line}`);
    } else {
      assert(flower.includes(match[2]), `copy line is not a flower candidate: ${line}`);
      assert(!flowerJa[match[2]], `copy line dropped a known alias: ${line}`);
    }
  });
});

check('a known aliased flower copies as 和名（学名）', () => {
  const sample = Object.keys(flowerJa).find((name) => flowerJa[name] && flowerJa[name] !== name);
  assert(sample, 'no aliased flower found');
  assert(isJapanese(flowerJa[sample]), `alias is not Japanese: ${sample}`);
});

console.log(`${results.length} checks passed:`);
for (const name of results) console.log(`  ok  ${name}`);
console.log(JSON.stringify({
  aquatic_candidates: aqua.length,
  flower_candidates: flower.length,
  draws_per_suite: DRAWS,
  suites: ['aqua', 'aqua/ja', 'flower', 'flower/ja'],
  total_draws: DRAWS * 4,
}, null, 2));
