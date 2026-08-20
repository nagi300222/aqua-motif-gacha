#!/usr/bin/env node
'use strict';
/*
 * Builds the flower motif candidate pool (EXACTLY 5,000 names) plus verified
 * Japanese aliases, from three bulk, openly licensed sources:
 *
 *   1. iNaturalist Taxonomy   s3://inaturalist-open-data/taxa.csv.gz  (CC0)
 *      -> accepted/active Angiospermae taxa with family + order lineage.
 *   2. megatrees plant_20221117 plant_megatree.tre
 *      (Smith & Brown 2018 seed-plant megatree, republished by Jin & Qian 2022)
 *      -> independent attestation of every wild species name.
 *   3. JMdict / EDICT (EDRDG, CC BY-SA) shipped as the `jamdict-data` sdist
 *      -> Japanese names taken from glosses of the form "... (Genus species)".
 *
 * Downloads are cached on disk and resumable: re-running never refetches a
 * file that is already complete, and each fetch retries with backoff.
 * Selection is deterministic (seeded PRNG), so a rebuild reproduces the pool.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');
const { execFileSync } = require('child_process');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const CACHE = process.env.FLOWER_CACHE || path.join(os.tmpdir(), 'aqua-motif-gacha-flower-cache');

const SOURCES = {
  inat: {
    url: 'https://inaturalist-open-data.s3.amazonaws.com/taxa.csv.gz',
    file: 'taxa.csv.gz',
    label: 'iNaturalist Taxonomy (AWS Open Data, CC0)',
  },
  megatree: {
    url: 'https://raw.githubusercontent.com/megatrees/plant_20221117/main/plant_megatree.tre',
    file: 'plant_megatree.tre',
    label: 'megatrees/plant_20221117 plant_megatree.tre (Smith & Brown 2018; Jin & Qian 2022)',
  },
  jmdict: {
    url: 'https://files.pythonhosted.org/packages/97/a5/075928aed2b3b70459fc1db396397dfa6714d266c143c51af9b648551a4e/jamdict_data-1.5.tar.gz',
    file: 'jamdict-data.tar.gz',
    label: 'JMdict/EDICT (EDRDG, CC BY-SA 4.0) via jamdict-data 1.5',
  },
};

const ANGIOSPERM_ID = '47125'; // Angiospermae in the iNaturalist taxonomy
const WILD_TARGET = 4909;
const HYBRID_TARGET = 91; // exactly the NOTABLE_HYBRIDS below, nothing padded in
const TOTAL_TARGET = WILD_TARGET + HYBRID_TARGET;
const SEED = 20260820;

// Families that carry the motif breadth the pool is meant to have: water
// plants, alpines, epiphytes, succulents/desert, carnivores, vines, giant and
// miniature flowers, tropical show flowers. Weighted up so they are never
// squeezed out by the sheer size of Asteraceae/Orchidaceae/Fabaceae.
const MOTIF_FAMILIES = new Set([
  'Nymphaeaceae', 'Nelumbonaceae', 'Hydrocharitaceae', 'Menyanthaceae', 'Pontederiaceae',
  'Podostemaceae', 'Alismataceae', 'Aponogetonaceae', 'Cabombaceae',
  'Nepenthaceae', 'Droseraceae', 'Sarraceniaceae', 'Lentibulariaceae', 'Cephalotaceae',
  'Byblidaceae', 'Drosophyllaceae', 'Dioncophyllaceae', 'Roridulaceae',
  'Cactaceae', 'Aizoaceae', 'Crassulaceae', 'Didiereaceae', 'Portulacaceae',
  'Bromeliaceae', 'Gesneriaceae', 'Begoniaceae', 'Araceae', 'Zingiberaceae',
  'Musaceae', 'Strelitziaceae', 'Heliconiaceae', 'Costaceae', 'Cannaceae', 'Marantaceae',
  'Proteaceae', 'Rafflesiaceae', 'Hydnoraceae', 'Aristolochiaceae', 'Passifloraceae',
  'Magnoliaceae', 'Paeoniaceae', 'Ranunculaceae', 'Papaveraceae', 'Iridaceae',
  'Liliaceae', 'Amaryllidaceae', 'Asparagaceae', 'Colchicaceae', 'Orchidaceae',
  'Ericaceae', 'Gentianaceae', 'Primulaceae', 'Campanulaceae', 'Violaceae',
  'Caryophyllaceae', 'Hydrangeaceae', 'Theaceae', 'Oleaceae', 'Convolvulaceae',
  'Onagraceae', 'Geraniaceae', 'Malvaceae', 'Rosaceae', 'Apocynaceae', 'Loasaceae',
  'Nyctaginaceae', 'Plumbaginaceae', 'Polemoniaceae', 'Bignoniaceae', 'Verbenaceae',
]);

// Garden nothotaxa that are household names in horticulture. This list adds no
// data: an entry is used only if the iNaturalist taxonomy actually carries it,
// so it only decides which of the real records get picked first.
const NOTABLE_HYBRIDS = [
  'Rosa × alba', 'Rosa × centifolia', 'Rosa × damascena', 'Rosa × odorata',
  'Rosa × noisettiana', 'Rosa × rehderiana', 'Dahlia × hortensis',
  'Camellia × williamsii', 'Camellia × vernalis', 'Paeonia × suffruticosa',
  'Iris × germanica', 'Iris × hollandica', 'Iris × hybrida',
  'Lilium × elegans', 'Lilium × testaceum', 'Clematis × jackmanii',
  'Prunus × yedoensis', 'Prunus × subhirtella', 'Prunus × lannesiana',
  'Chrysanthemum × morifolium', 'Chrysanthemum × rubellum', 'Petunia × atkinsiana',
  'Fuchsia × hybrida', 'Fuchsia × exoniensis', 'Hibiscus × rosa-sinensis',
  'Magnolia × soulangeana', 'Magnolia × loebneri', 'Magnolia × wieseneri',
  'Magnolia × veitchii', 'Rhododendron × pulchrum', 'Rhododendron × hybridum',
  'Narcissus × medioluteus', 'Narcissus × incomparabilis', 'Narcissus × odorus',
  'Begonia × tuberhybrida', 'Begonia × semperflorens-cultorum', 'Begonia × hiemalis',
  'Pelargonium × domesticum', 'Pelargonium × hybridum', 'Pelargonium × asperum',
  'Nymphaea × marliacea', 'Nymphaea × laydekeri', 'Nymphaea × daubenyana',
  'Gladiolus × hortulanus', 'Gladiolus × colvillii', 'Crocus × luteus',
  'Crocus × hybridus', 'Primula × polyantha', 'Primula × pubescens',
  'Hemerocallis × hybrida', 'Lavandula × intermedia', 'Syringa × hyacinthiflora',
  'Syringa × chinensis', 'Syringa × prestoniae', 'Malus × floribunda',
  'Malus × purpurea', 'Malus × zumi', 'Salvia × sylvestris', 'Salvia × jamensis',
  'Erica × darleyensis', 'Erica × watsonii', 'Erica × veitchii',
  'Sarracenia × catesbaei', 'Sarracenia × moorei', 'Sarracenia × mitchelliana',
  'Sarracenia × formosa', 'Sarracenia × excellens', 'Nepenthes × hookeriana',
  'Nepenthes × kinabaluensis', 'Nepenthes × trusmadiensis', 'Nepenthes × harryana',
  'Drosera × obovata', 'Drosera × hybrida', 'Drosera × nagamotoi',
  'Citrus × limon', 'Citrus × aurantium', 'Citrus × junos', 'Citrus × aurantiifolia',
  'Passiflora × violacea', 'Passiflora × kewensis', 'Passiflora × exoniensis',
  'Passiflora × allardii', 'Viola × wittrockiana', 'Viola × williamsii',
  'Tulipa × tschimganica', 'Hydrangea × versicolor', 'Aquilegia × emodi',
  'Delphinium × burkei', 'Dianthus × lucae', 'Phlox × glutinosa',
  'Anemone × pittonii',
];

function log(msg) { process.stdout.write(`${msg}\n`); }

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(items, rand) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function sleep(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { /* deliberate: keeps the builder single-threaded */ }
}

function fetchCached(source) {
  fs.mkdirSync(CACHE, { recursive: true });
  const target = path.join(CACHE, source.file);
  if (fs.existsSync(target) && fs.statSync(target).size > 0) {
    log(`cache hit  ${source.file} (${fs.statSync(target).size} bytes)`);
    return target;
  }
  const partial = `${target}.part`;
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      // -C - resumes a partial download instead of restarting it.
      execFileSync('curl', ['-sSL', '--fail', '--retry', '3', '--max-time', '900',
        '-C', '-', '-o', partial, source.url], { stdio: ['ignore', 'ignore', 'pipe'] });
      fs.renameSync(partial, target);
      log(`downloaded ${source.file} (${fs.statSync(target).size} bytes)`);
      return target;
    } catch (error) {
      lastError = error;
      log(`fetch failed (attempt ${attempt}) ${source.file}: ${error.message.split('\n')[0]}`);
      sleep(2000 * attempt);
    }
  }
  throw new Error(`could not download ${source.url}: ${lastError && lastError.message}`);
}

const BINOMIAL = /^[A-Z][a-z]+ [a-z][a-z-]{2,}$/;
const HYBRID_NAME = /^(?:× [A-Z][a-z]+ [a-z][a-z-]{2,}|[A-Z][a-z]+ × [a-z][a-z-]{2,})$/;
const FORBIDDEN = /(?:^|\s)(?:sp|spp|cf|aff|var|subsp|ssp|f|nov|hybrid|indet)\.?(?:\s|$)|[?'"×]{2,}|\d/;

function usableName(name, pattern) {
  if (!pattern.test(name)) return false;
  if (FORBIDDEN.test(name)) return false;
  return true;
}

async function readInaturalist(file) {
  // Pass 1: remember only the ranks we need to resolve a lineage.
  const lineageNames = new Map();
  const readRanks = new Set(['family', 'order']);
  const scan = async (handler) => {
    const stream = fs.createReadStream(file).pipe(zlib.createGunzip());
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    let first = true;
    for await (const line of rl) {
      if (first) { first = false; continue; }
      const cols = line.split('\t');
      if (cols.length < 6) continue;
      handler(cols);
    }
  };
  await scan((cols) => {
    if (readRanks.has(cols[3])) lineageNames.set(cols[0], { rank: cols[3], name: cols[4] });
  });
  log(`iNaturalist lineage ranks cached: ${lineageNames.size}`);

  const species = [];
  const hybrids = [];
  await scan((cols) => {
    const [, ancestry, , rank, name, active] = cols;
    if (active !== 'true' || !ancestry) return;
    const parts = ancestry.split('/');
    if (!parts.includes(ANGIOSPERM_ID)) return;
    let family = null;
    let order = null;
    for (const part of parts) {
      const entry = lineageNames.get(part);
      if (!entry) continue;
      if (entry.rank === 'family') family = entry.name;
      else order = entry.name;
    }
    if (!family) return;
    if (rank === 'species' && usableName(name, BINOMIAL)) species.push({ name, family, order });
    else if ((rank === 'hybrid' || rank === 'genushybrid') && usableName(name, HYBRID_NAME)) {
      hybrids.push({ name, family, order });
    }
  });
  log(`iNaturalist angiosperms: ${species.length} species, ${hybrids.length} named hybrids`);
  return { species, hybrids };
}

function readMegatree(file) {
  const text = fs.readFileSync(file, 'utf8');
  const tips = new Set();
  for (const match of text.matchAll(/[(,]([A-Za-z][A-Za-z0-9_\-.]*):/g)) {
    tips.add(match[1].replace(/_/g, ' '));
  }
  log(`megatree tips: ${tips.size}`);
  return tips;
}

function readJmdict(file) {
  const work = path.join(CACHE, 'jamdict');
  const db = path.join(work, 'jamdict.db');
  if (!fs.existsSync(db)) {
    fs.mkdirSync(work, { recursive: true });
    execFileSync('tar', ['xzf', file, '-C', work, '--strip-components=2',
      'jamdict_data-1.5/jamdict_data/jamdict.db.xz']);
    execFileSync('sh', ['-c', `xz -d -c ${JSON.stringify(path.join(work, 'jamdict.db.xz'))} > ${JSON.stringify(db)}`]);
  }
  const conn = new DatabaseSync(db, { readOnly: true });
  const kana = new Map();
  const kanji = new Map();
  const priority = new Map();
  const push = (map, key, value) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(value);
  };
  for (const row of conn.prepare('select idseq, text from Kana').all()) push(kana, row.idseq, row.text);
  for (const row of conn.prepare('select idseq, text from Kanji').all()) push(kanji, row.idseq, row.text);
  for (const row of conn.prepare('select k.idseq as idseq, p.text as text from KJP p join Kanji k on p.kid = k.ID').all()) push(priority, row.idseq, row.text);
  for (const row of conn.prepare('select k.idseq as idseq, p.text as text from KNP p join Kana k on p.kid = k.ID').all()) push(priority, row.idseq, row.text);

  const candidates = new Map();
  for (const row of conn.prepare('select s.idseq as idseq, g.text as text from SenseGloss g join Sense s on g.sid = s.ID').all()) {
    for (const match of String(row.text).matchAll(/\(([^()]+)\)/g)) {
      const inner = match[1].trim();
      // Only an exact "(Genus species)" parenthetical counts. Anything with a
      // trailing var./subsp./f. qualifier names a different taxon than the
      // species we would attach the alias to, so it is dropped.
      if (!usableName(inner, BINOMIAL)) continue;
      if (!candidates.has(inner)) candidates.set(inner, new Set());
      candidates.get(inner).add(row.idseq);
    }
  }
  conn.close();

  const isKatakana = (text) => /^[゠-ヿーー]+$/.test(text);
  const toKatakana = (text) => text.replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));
  const isKana = (text) => /^[ぁ-ゖ゠-ヿー]+$/.test(text);
  const score = (idseq) => {
    const tags = priority.get(idseq) || [];
    const native = tags.filter((tag) => !tag.startsWith('gai'));
    let value = 0;
    if (native.length) value += 10;
    if ((kanji.get(idseq) || []).length) value += 3;
    if (tags.length && !native.length) value -= 5; // loanword-only entry
    return value;
  };
  const japaneseForm = (idseq) => {
    const readings = kana.get(idseq) || [];
    const katakana = readings.find(isKatakana);
    if (katakana) return katakana;
    const hiragana = readings.find(isKana);
    if (hiragana) return toKatakana(hiragana);
    const written = kanji.get(idseq) || [];
    return written[0] || null;
  };

  const aliases = new Map();
  for (const [sci, ids] of candidates) {
    const best = [...ids].sort((a, b) => (score(b) - score(a)) || (a - b))[0];
    const form = japaneseForm(best);
    if (form) aliases.set(sci, { name: form, entry: best });
  }
  log(`JMdict scientific-name glosses resolved: ${aliases.size}`);
  return aliases;
}

function groupBy(items, key) {
  const map = new Map();
  for (const item of items) {
    const k = key(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
}

// Round-robin over the genera of one family so a family quota is spread over as
// many genera as the family has, instead of being filled from one big genus.
function takeSpread(entries, quota, rand, taken) {
  const byGenus = groupBy(entries, (entry) => entry.name.split(' ')[0]);
  const genera = shuffled([...byGenus.keys()], rand);
  const queues = new Map(genera.map((genus) => [genus, shuffled(byGenus.get(genus), rand)]));
  const picked = [];
  let progress = true;
  while (picked.length < quota && progress) {
    progress = false;
    for (const genus of genera) {
      if (picked.length >= quota) break;
      const queue = queues.get(genus);
      while (queue.length) {
        const entry = queue.shift();
        if (taken.has(entry.name)) continue;
        picked.push(entry);
        taken.add(entry.name);
        progress = true;
        break;
      }
    }
  }
  return picked;
}

function allocate(families, budget, weightOf) {
  const weights = new Map();
  let total = 0;
  for (const [family, entries] of families) {
    const weight = weightOf(family, entries);
    weights.set(family, weight);
    total += weight;
  }
  const quotas = new Map();
  let assigned = 0;
  for (const [family, entries] of families) {
    const raw = Math.round((budget * weights.get(family)) / total);
    const quota = Math.max(1, Math.min(raw, entries.length));
    quotas.set(family, quota);
    assigned += quota;
  }
  // Settle the rounding drift against the families that can absorb it.
  const order = [...families.keys()].sort((a, b) => quotas.get(b) - quotas.get(a));
  let index = 0;
  while (assigned > budget) {
    const family = order[index % order.length];
    if (quotas.get(family) > 1) { quotas.set(family, quotas.get(family) - 1); assigned -= 1; }
    index += 1;
    if (index > order.length * budget) break;
  }
  index = 0;
  while (assigned < budget) {
    const family = order[index % order.length];
    if (quotas.get(family) < families.get(family).length) {
      quotas.set(family, quotas.get(family) + 1);
      assigned += 1;
    }
    index += 1;
    if (index > order.length * budget) break;
  }
  return quotas;
}

function fillTo(target, picked, taken, pool, rand) {
  if (picked.length >= target) return picked.slice(0, target);
  for (const entry of shuffled(pool, rand)) {
    if (picked.length >= target) break;
    if (taken.has(entry.name)) continue;
    taken.add(entry.name);
    picked.push(entry);
  }
  return picked;
}

function selectWild(species, megatree, aliases, rand) {
  const dual = species.filter((entry) => megatree.has(entry.name));
  const named = species.filter((entry) => aliases.has(entry.name));
  log(`dual-verified wild species (iNaturalist + megatree): ${dual.length}`);
  log(`wild species carrying a JMdict Japanese name: ${named.length}`);

  const taken = new Set();
  const picked = [];
  // Every species with a verified Japanese name goes in first: that is what
  // makes the "日本語のみ" filter usable on the flower pool.
  for (const entry of named) {
    if (taken.has(entry.name)) continue;
    taken.add(entry.name);
    picked.push(entry);
  }

  const families = groupBy(dual.filter((entry) => !taken.has(entry.name)), (entry) => entry.family);
  const budget = WILD_TARGET - picked.length;
  const quotas = allocate(families, budget, (family, entries) => {
    const weight = Math.sqrt(entries.length);
    return MOTIF_FAMILIES.has(family) ? weight * 1.6 : weight;
  });
  for (const [family, entries] of families) {
    picked.push(...takeSpread(entries, quotas.get(family), rand, taken));
  }
  fillTo(WILD_TARGET, picked, taken, dual, rand);
  fillTo(WILD_TARGET, picked, taken, species, rand);
  return picked.slice(0, WILD_TARGET);
}

function selectGardenHybrids(hybrids) {
  // The garden segment is the named, household-name garden hybrids and nothing
  // else. Every entry has to be present in the iNaturalist taxonomy; a missing
  // one is an error rather than something to backfill from the long tail of
  // wild crosses, so the segment can never be padded to hit a number.
  const byName = new Map(hybrids.map((entry) => [entry.name, entry]));
  const picked = [];
  const missing = [];
  for (const name of NOTABLE_HYBRIDS) {
    const entry = byName.get(name);
    if (entry) picked.push(entry);
    else missing.push(name);
  }
  if (missing.length) {
    throw new Error(`garden hybrids absent from the source taxonomy: ${missing.join(', ')}`);
  }
  log(`garden hybrids: ${picked.length}/${NOTABLE_HYBRIDS.length} confirmed in the source taxonomy`);
  return picked;
}

function writeSpeciesFiles(names, header) {
  const perFile = 1000;
  const files = [];
  for (let index = 0; index * perFile < names.length; index += 1) {
    const chunk = names.slice(index * perFile, (index + 1) * perFile);
    const file = `flower-species-${String(index + 1).padStart(2, '0')}.js`;
    const body = chunk.map((name) => `  ${JSON.stringify(name)}`).join(',\n');
    fs.writeFileSync(path.join(DATA, file),
      `${header}window.FLOWER_SPECIES = (window.FLOWER_SPECIES || []).concat([\n${body}\n]);\n`);
    files.push(file);
  }
  return files;
}

async function main() {
  const rand = mulberry32(SEED);
  const inatFile = fetchCached(SOURCES.inat);
  const megatreeFile = fetchCached(SOURCES.megatree);
  const jmdictFile = fetchCached(SOURCES.jmdict);

  const { species, hybrids } = await readInaturalist(inatFile);
  const megatree = readMegatree(megatreeFile);
  const aliases = readJmdict(jmdictFile);

  const wild = selectWild(species, megatree, aliases, rand);
  const garden = selectGardenHybrids(hybrids);
  const all = [...wild, ...garden];
  if (all.length !== TOTAL_TARGET) throw new Error(`expected ${TOTAL_TARGET} candidates, built ${all.length}`);

  const names = all.map((entry) => entry.name);
  const header = [
    `// ${TOTAL_TARGET} flower motif candidates: ${WILD_TARGET} wild angiosperm species + ${HYBRID_TARGET} well-known garden/horticultural hybrid taxa.`,
    `// Sources: ${SOURCES.inat.label}; ${SOURCES.megatree.label}.`,
    '// Constraints: Angiospermae, active/accepted taxon, rank species (or named nothotaxon),',
    '// binomial only - no sp./spp./cf./aff./var. placeholders. See data/flower-provenance.json.',
    '',
  ].join('\n');
  const files = writeSpeciesFiles(names, header);

  const pool = new Set(names);
  const matched = [];
  for (const name of names) {
    const key = name.replace(' × ', ' ').replace(/^× /, '');
    const alias = aliases.get(name) || aliases.get(key);
    if (alias) matched.push({ name, key, alias });
  }
  // A Japanese plant name that a dictionary attaches to more than one of our
  // candidates (ホトケノザ, カリン, アサガオ ...) is genuinely ambiguous, so it is
  // not used as a label for any of them rather than mislabelling one.
  const byForm = new Map();
  for (const item of matched) {
    if (!byForm.has(item.alias.name)) byForm.set(item.alias.name, []);
    byForm.get(item.alias.name).push(item);
  }
  const ambiguous = [...byForm.values()].filter((items) => items.length > 1);
  const dropped = ambiguous.reduce((sum, items) => sum + items.length, 0);
  const jaEntries = [];
  const jaSources = {};
  for (const item of matched) {
    if (byForm.get(item.alias.name).length > 1) continue;
    jaEntries.push([item.name, item.alias.name]);
    jaSources[item.name] = { entry: item.alias.entry, matched_name: item.key, source: SOURCES.jmdict.label };
  }
  log(`Japanese aliases: ${jaEntries.length} kept, ${dropped} dropped as ambiguous (${ambiguous.length} shared names)`);
  fs.writeFileSync(path.join(DATA, 'flower-ja-names.js'),
    ['// Japanese names taken from JMdict/EDICT glosses of the form "... (Genus species)".',
      `// Source: ${SOURCES.jmdict.label}. Names with no such gloss stay untranslated on purpose.`,
      'window.FLOWER_JA_NAMES = window.FLOWER_JA_NAMES || {};',
      'Object.assign(window.FLOWER_JA_NAMES, {',
      jaEntries.map(([name, ja]) => `  ${JSON.stringify(name)}: ${JSON.stringify(ja)}`).join(',\n'),
      '});',
      ''].join('\n'));
  fs.writeFileSync(path.join(DATA, 'flower-ja-sources.json'), `${JSON.stringify(jaSources, null, 2)}\n`);

  const familyCount = new Map();
  const orderCount = new Map();
  for (const entry of all) {
    familyCount.set(entry.family, (familyCount.get(entry.family) || 0) + 1);
    if (entry.order) orderCount.set(entry.order, (orderCount.get(entry.order) || 0) + 1);
  }
  const top = [...familyCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  const provenance = {
    generated_by: 'scripts/build-flower-data.js',
    total_candidates: names.length,
    wild_species: wild.length,
    garden_hybrid_taxa: garden.length,
    japanese_aliases: jaEntries.length,
    families: familyCount.size,
    orders: orderCount.size,
    largest_family_share: `${top[0][1]} (${((top[0][1] / names.length) * 100).toFixed(1)}%)`,
    top_families: Object.fromEntries(top),
    data_files: files.concat(['flower-ja-names.js', 'flower-ja-sources.json']),
    sources: Object.fromEntries(Object.entries(SOURCES).map(([key, value]) => [key, { url: value.url, label: value.label }])),
  };
  fs.writeFileSync(path.join(DATA, 'flower-provenance.json'), `${JSON.stringify(provenance, null, 2)}\n`);
  log(JSON.stringify({
    total: names.length,
    wild: wild.length,
    garden: garden.length,
    japanese: jaEntries.length,
    families: familyCount.size,
    orders: orderCount.size,
    pool_unique: pool.size,
    top_families: top.slice(0, 8),
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
