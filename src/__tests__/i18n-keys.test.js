/* Every translation key a screen asks for must exist.
 *
 * `makeT` falls back to returning the key itself when it is missing, so a typo
 * does not throw — it ships, and the user reads `serverSlw` on a card. These
 * files use ES module syntax and the test runner is plain CommonJS `node`, so
 * the check is made against the source text rather than by importing.
 *
 * `node src/__tests__/i18n-keys.test.js`
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log('  ok   ' + n); }
                      catch (e) { fail++; console.log('  FAIL ' + n + '\n       ' + e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || 'expected truthy'); };

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

// The keys `i18n.js` actually defines, read from the `S` table.
function definedKeys() {
  const source = read('src/i18n.js');
  const table = source.slice(source.indexOf('const S = {'), source.indexOf('const CAT = {'));
  const keys = new Set();
  const pattern = /(?:^|[\s{,])([A-Za-z][A-Za-z0-9_]*)\s*:\s*\[/g;
  let match;
  while ((match = pattern.exec(table)) !== null) keys.add(match[1]);
  return keys;
}

// Literal t('…') lookups in a file. Dynamic ones — t(apiErrorKey(e)),
// t(Suggestions.headingFor(mode)) — cannot be read this way and are covered
// separately below.
function requestedKeys(relative) {
  const found = new Set();
  const pattern = /\bt\(\s*'([^']+)'/g;
  let match;
  while ((match = pattern.exec(read(relative))) !== null) found.add(match[1]);
  return found;
}

const SCREENS = [
  'app/(tabs)/index.js',
  'app/(tabs)/mutfak.js',
  'src/SuggestionCard.js',
  'src/suggestions.js',
];

const defined = definedKeys();

console.log('\ntranslation keys');
t('i18n.js defines a sane number of keys', () => {
  ok(defined.size > 60, `only found ${defined.size} keys — the parser is wrong`);
  ok(defined.has('perPerson') && defined.has('cook'), 'known keys are missing');
});

SCREENS.forEach((file) => {
  t(`every key ${file} asks for exists`, () => {
    const missing = [...requestedKeys(file)].filter((key) => !defined.has(key));
    ok(missing.length === 0, `missing from i18n.js: ${missing.join(', ')}`);
  });
});

t('the keys apiErrorKey can return all exist', () => {
  const source = read('src/api.js');
  const body = source.slice(source.indexOf('export function apiErrorKey'));
  const returned = [...body.slice(0, body.indexOf('}')).matchAll(/return\s+'([^']+)'/g)]
    .map((match) => match[1]);
  ok(returned.length >= 3, `found only ${returned.length} branches`);
  const missing = returned.filter((key) => !defined.has(key));
  ok(missing.length === 0, `missing from i18n.js: ${missing.join(', ')}`);
});

t('the mode headings map to real keys', () => {
  const source = read('src/suggestions.js');
  const table = source.slice(source.indexOf('var MODE_HEADING'), source.indexOf('function headingFor'));
  const values = [...table.matchAll(/:\s*'([^']+)'/g)].map((match) => match[1]);
  ok(values.length === 3, `expected three modes, found ${values.length}`);
  const missing = values.filter((key) => !defined.has(key));
  ok(missing.length === 0, `missing from i18n.js: ${missing.join(', ')}`);
});

t('no screen still carries an inline Turkish string in a t() position', () => {
  // Not exhaustive — a reminder, not a gate. Bu Akşam was rewritten to keep
  // every literal in i18n.js; this catches a regression in that one file.
  const source = read('app/(tabs)/index.js');
  const turkish = source.match(/'[^']*[çğıöşüÇĞİÖŞÜ][^']*'/g) || [];
  const allowed = turkish.filter((s) => !/[a-z]{4}/i.test(s));
  ok(turkish.length === allowed.length,
     `inline Turkish left in index.js: ${turkish.slice(0, 3).join(' | ')}`);
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
