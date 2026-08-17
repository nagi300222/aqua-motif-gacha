const fs = require('fs');
const vm = require('vm');

const expected = Number(process.argv[2] || 6000);
const files = fs.readdirSync('data').filter(name => /^species-.*\.js$/.test(name)).sort();
const context = { window: {} };
vm.createContext(context);
for (const file of files) {
  vm.runInContext(fs.readFileSync(`data/${file}`, 'utf8'), context, { filename: file });
}

const names = context.window.AQUA_SPECIES;
const normalize = name => name.normalize('NFKC').trim().toLowerCase();
const keys = names.map(normalize);
const forbidden = names.filter(name => /(?:^|\s)(?:sp|spp|cf|aff)\.(?:\s|$)|\?/iu.test(name));
const errors = [];
if (names.length !== expected) errors.push(`expected ${expected}, got ${names.length}`);
if (names.length > 6000) errors.push(`target exceeded: ${names.length}`);
if (keys.some(key => !key)) errors.push('empty names found');
if (new Set(keys).size !== keys.length) errors.push('normalized duplicates found');
if (forbidden.length) errors.push(`forbidden taxonomic qualifiers: ${forbidden.length}`);

for (let run = 0; run < 10000; run += 1) {
  const indexes = Array.from({ length: names.length }, (_, index) => index);
  for (let index = 0; index < 10; index += 1) {
    const swap = index + Math.floor(Math.random() * (indexes.length - index));
    [indexes[index], indexes[swap]] = [indexes[swap], indexes[index]];
  }
  const draw = indexes.slice(0, 10).map(index => names[index]);
  if (new Set(draw).size !== 10) errors.push(`duplicate in draw ${run + 1}`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`species audit passed: ${names.length} names, 0 forbidden qualifiers, 0 duplicates, 10000 draws`);
