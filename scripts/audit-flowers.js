#!/usr/bin/env node
'use strict';
/*
 * Audits the flower candidate pool and its Japanese aliases.
 * Run alongside scripts/audit-species.js and scripts/audit-ja-aliases.js,
 * which keep guarding the untouched 6,000-name aquatic pool.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const data = path.join(root, 'data');
const expected = Number(process.argv[2] || 5000);
const expectedWild = Number(process.argv[3] || 4909);
const expectedGarden = Number(process.argv[4] || 91);

const speciesFiles = fs.readdirSync(data).filter((file) => /^flower-species-.*\.js$/.test(file)).sort();
assert(speciesFiles.length > 0, 'no flower species files found');

const context = { window: {} };
vm.createContext(context);
for (const file of speciesFiles) {
  // A syntax error in any data file throws here, which is the JS-syntax check.
  vm.runInContext(fs.readFileSync(path.join(data, file), 'utf8'), context, { filename: file });
}

const candidates = context.window.FLOWER_SPECIES;
assert(Array.isArray(candidates), 'window.FLOWER_SPECIES is not an array');

const normalize = (name) => name.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('en-US');
const japanese = /[ぁ-んァ-ヶ一-龠]/u;
const placeholder = /(?:^|\s)(?:sp|spp|cf|aff|var|subsp|ssp|nov|indet|unknown|todo|tbd|placeholder|undefined|null)\.?(?:\s|$)/iu;
const speciesShape = /^[A-Z][a-z]+ [a-z][a-z-]{2,}$/u;
const hybridShape = /^(?:× [A-Z][a-z]+ [a-z][a-z-]{2,}|[A-Z][a-z]+ × [a-z][a-z-]{2,})$/u;

const errors = [];
const fail = (condition, message) => { if (!condition) errors.push(message); };

fail(candidates.length === expected, `flower candidate total: expected ${expected}, got ${candidates.length}`);
fail(candidates.every((name) => typeof name === 'string' && name.trim().length > 0),
  `empty candidate names: ${candidates.filter((name) => typeof name !== 'string' || !name.trim()).length}`);

const exactDuplicates = candidates.length - new Set(candidates).size;
fail(exactDuplicates === 0, `exact duplicates: ${exactDuplicates}`);
const normalizedDuplicates = candidates.length - new Set(candidates.map(normalize)).size;
fail(normalizedDuplicates === 0, `normalized duplicates: ${normalizedDuplicates}`);

const placeholders = candidates.filter((name) => placeholder.test(name) || /[?"']/u.test(name) || /\d/u.test(name));
fail(placeholders.length === 0, `placeholder / undetermined names: ${placeholders.length} (${placeholders.slice(0, 5).join(', ')})`);

const malformed = candidates.filter((name) => !speciesShape.test(name) && !hybridShape.test(name));
fail(malformed.length === 0, `names that are neither a binomial nor a named nothotaxon: ${malformed.length} (${malformed.slice(0, 5).join(', ')})`);

const wild = candidates.filter((name) => speciesShape.test(name));
const garden = candidates.filter((name) => hybridShape.test(name));
fail(wild.length + garden.length === candidates.length, 'wild + garden split does not cover the pool');
fail(wild.length === expectedWild, `wild species: expected ${expectedWild}, got ${wild.length}`);
// The garden segment is a fixed, name-by-name list. Any drift means it was
// padded out with other hybrids instead of staying the curated set.
fail(garden.length === expectedGarden, `garden hybrid taxa: expected ${expectedGarden}, got ${garden.length}`);

// The garden segment must not be padded with near-identical names from one
// genus, so both the plain name and the genus load are checked.
const gardenDuplicates = garden.length - new Set(garden.map(normalize)).size;
fail(gardenDuplicates === 0, `duplicate garden hybrid names: ${gardenDuplicates}`);
const gardenGenera = new Map();
for (const name of garden) {
  const genus = name.replace(/^× /u, '').split(' ')[0];
  gardenGenera.set(genus, (gardenGenera.get(genus) || 0) + 1);
}
const overloaded = [...gardenGenera.entries()].filter(([, count]) => count > 6);
fail(overloaded.length === 0, `garden genera over the 6-name cap: ${overloaded.map(([g, c]) => `${g}=${c}`).join(', ')}`);

const aliasCode = fs.readFileSync(path.join(data, 'flower-ja-names.js'), 'utf8');
const before = JSON.stringify(candidates);
vm.runInContext(aliasCode, context, { filename: 'flower-ja-names.js' });
fail(JSON.stringify(candidates) === before, 'candidate data mutated while loading aliases');

const aliases = context.window.FLOWER_JA_NAMES || {};
const sources = JSON.parse(fs.readFileSync(path.join(data, 'flower-ja-sources.json'), 'utf8'));
const pool = new Set(candidates);
const aliasEntries = Object.entries(aliases);

const outsidePool = aliasEntries.filter(([key]) => !pool.has(key));
fail(outsidePool.length === 0, `alias keys outside the candidate pool: ${outsidePool.length} (${outsidePool.slice(0, 5).map(([k]) => k).join(', ')})`);
const emptyValues = aliasEntries.filter(([, value]) => !value || !String(value).trim());
fail(emptyValues.length === 0, `empty alias values: ${emptyValues.length}`);
const nonJapanese = aliasEntries.filter(([, value]) => !japanese.test(String(value)));
fail(nonJapanese.length === 0, `aliases that contain no Japanese characters: ${nonJapanese.length} (${nonJapanese.slice(0, 5).map(([k]) => k).join(', ')})`);
const unsourced = aliasEntries.filter(([key]) => !sources[key] || !sources[key].entry || !sources[key].source);
fail(unsourced.length === 0, `aliases with no provenance record: ${unsourced.length}`);
fail(Object.keys(sources).length === aliasEntries.length,
  `provenance coverage: ${Object.keys(sources).length} records for ${aliasEntries.length} aliases`);

const aliasValues = aliasEntries.map(([, value]) => String(value));
const ambiguousAliases = aliasValues.length - new Set(aliasValues).size;
fail(ambiguousAliases === 0, `Japanese names shared by more than one candidate: ${ambiguousAliases}`);

const literalKeys = [...aliasCode.matchAll(/^\s*"([^"]+)":/gmu)].map((match) => match[1]);
fail(literalKeys.length === new Set(literalKeys).size, 'duplicate literal keys in flower-ja-names.js');
fail(literalKeys.length === aliasEntries.length, `alias literal count ${literalKeys.length} != loaded count ${aliasEntries.length}`);

const localized = candidates.filter((name) => japanese.test(name) || aliases[name]);
fail(localized.length >= 10, `Japanese-only pool too small to draw from: ${localized.length}`);

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(JSON.stringify({
  flower_candidates: candidates.length,
  wild_species: wild.length,
  garden_hybrid_taxa: garden.length,
  garden_genera: gardenGenera.size,
  empty_names: 0,
  exact_duplicates: 0,
  normalized_duplicates: 0,
  placeholders: 0,
  undetermined_species: 0,
  garden_duplicate_names: 0,
  japanese_aliases: aliasEntries.length,
  alias_keys_outside_pool: 0,
  empty_alias_values: 0,
  duplicate_alias_keys: 0,
  ambiguous_alias_values: 0,
  alias_source_coverage: `${Object.keys(sources).length}/${aliasEntries.length}`,
  japanese_only_pool: localized.length,
  js_syntax_errors: 0,
}, null, 2));
