/* Plain-node tests for the suggestion normaliser. `node src/__tests__/suggestions.test.js`
 *
 * The point of `suggestions.js` is that a card cannot tell which of the three
 * methods produced the dinner in front of it. These tests hold that line.
 */
const S = require('../suggestions.js');
const E = require('../engine.js');
const ing = require('../../assets/data/ingredients.json');
const rec = require('../../assets/data/recipes.json');
const reg = require('../../assets/data/regions.json');

const byId = {}; ing.items.forEach(i => byId[i.id] = i);
const recById = {}; rec.recipes.forEach(r => recById[r.id] = r);
let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log('  ok   ' + n); }
                      catch (e) { fail++; console.log('  FAIL ' + n + '\n       ' + e.message); } };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ''} expected ${b}, got ${a}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'expected truthy'); };

const ctx = (over = {}) => Object.assign({
  byId, regions: reg.regions, region: 'marmara', month: 8,
  pantrySet: {}, profile: E.emptyProfile(), timeBudget: 60, skill: 1, day: 1000
}, over);

// A stand-in for the i18n translator: returns the key so assertions can read it.
const tr = (key, a) => (a === undefined ? key : `${key}:${a}`);

const localScored = () => E.recommend(rec.recipes, ctx(), 1)[0];

const apiRow = (over = {}) => Object.assign({
  id: 4821,
  title: 'Fırında Tavuk (Videolu)',
  category: 'tavuk',
  total_minutes: 55,
  servings: 4,
  cost_total: 180.4,
  cost_per_portion: 45.1,
  cost_coverage: 0.92,
  cost_servings: 4,
  matched_count: 5,
  missing_count: 0,
  match_percent: 83.3,
}, over);

console.log('\none shape, whatever produced it');
t('a local and an API suggestion expose exactly the same fields', () => {
  const a = Object.keys(S.fromLocal(localScored(), {})).sort().join(',');
  const b = Object.keys(S.fromApi(apiRow(), {})).sort().join(',');
  eq(a, b, 'the two shapes have drifted apart:');
});
t('each suggestion knows where it came from and where it goes', () => {
  const local = S.fromLocal(localScored(), {});
  const api = S.fromApi(apiRow(), {});
  eq(local.source, 'local');
  eq(api.source, 'api');
  ok(local.route.indexOf('/tarif/') === 0, local.route);
  eq(api.route, '/api-tarif/4821');
  ok(local.key !== api.key, 'keys can collide between sources');
});
t('the English title is used when the app is in English', () => {
  const scored = localScored();
  eq(S.fromLocal(scored, { english: true }).title, scored.recipe.titles.en);
  eq(S.fromLocal(scored, {}).title, scored.recipe.titles.tr);
});

console.log('\nthe price is shown, or withheld, for the same reason');
t('an API row above the coverage threshold shows its price', () => {
  const s = S.fromApi(apiRow(), {});
  eq(s.costTrusted, true);
  eq(s.perPortion, 45.1);
  eq(s.servings, 4);
});
t('an API row below the coverage threshold shows no price', () => {
  const s = S.fromApi(apiRow({ cost_coverage: 0.5 }), {});
  eq(s.costTrusted, false);
});
t('an API row with no cost at all shows no price', () => {
  const s = S.fromApi(apiRow({
    cost_per_portion: null, cost_total: null, cost_coverage: 0,
    cost_unavailable_reason: 'missing_required_protein',
  }), {});
  eq(s.costTrusted, false);
  eq(s.costReason, 'missing_required_protein');
});
t('a local suggestion the engine cannot price shows no price either', () => {
  const broken = JSON.parse(JSON.stringify(recById.izmir_kofte));
  broken.ingredients.forEach(ri => { if (ri.id === 'kiyma') ri.qty = 0; });
  const s = S.fromLocal({ recipe: broken, cost: E.costOf(broken, ctx()), missing: [] }, {});
  eq(s.costTrusted, false);
  eq(s.costReason, 'missing_required_protein');
});
t('the two paths agree on the threshold', () => {
  eq(S.COVERAGE_MIN, E.COVERAGE_MIN);
});

console.log('\nlists');
t('normalize collapses repeated imports of the same dish', () => {
  const rows = [
    apiRow({ id: 1, title: 'Fırında Tavuk' }),
    apiRow({ id: 2, title: 'Fırında Tavuk Tarifi' }),
    apiRow({ id: 3, title: 'Fırında Tavuk Nasıl Yapılır' }),
    apiRow({ id: 4, title: 'Mercimek Çorbası', category: 'corba' }),
  ];
  const out = S.normalize(rows, { limit: 3 });
  eq(out.length, 2);
  eq(out[0].id, 1);
  eq(out[1].id, 4);
});
t('normalize honours the limit', () => {
  const rows = [1, 2, 3, 4, 5].map(n => apiRow({ id: n, title: `Yemek ${n}` }));
  eq(S.normalize(rows, { limit: 3 }).length, 3);
});
t('normalize accepts local and API entries side by side', () => {
  const out = S.normalize([localScored(), apiRow()], {});
  eq(out.length, 2);
  eq(out[0].source, 'local');
  eq(out[1].source, 'api');
});
t('a video claim never reaches the card', () => {
  const s = S.fromApi(apiRow(), {});
  ok(!/videolu/i.test(S.headingFor('kiler')), 'heading key is wrong');
  ok(/Videolu/.test(s.title) === true, 'the API cleans titles server-side; this row is raw');
  eq(E.normalizeTitleKey(s.title), 'firinda tavuk');
});

console.log('\nwhy this dish');
t('each method explains itself through the translator, not a literal', () => {
  const kiler = S.fromApi(apiRow(), {});
  eq(S.reasonFor(kiler, 'kiler', tr), 'matchedWith:5');
  eq(S.reasonFor(S.fromApi(apiRow({ seasonal_ingredients: 'Domates,Biber' }), {}), 'seasonal', tr),
     'seasonalIngredients: Domates, Biber');
  eq(S.reasonFor(kiler, 'random', tr), 'chosenForYou');
});
t('a seasonal row with no ingredient names still says something', () => {
  eq(S.reasonFor(S.fromApi(apiRow({ seasonal_ingredients: ' , ' }), {}), 'seasonal', tr),
     'inSeasonNow');
});
t('each method has its own heading', () => {
  eq(S.headingFor('random'), 'tonightChoice');
  eq(S.headingFor('seasonal'), 'seasonalChoice');
  eq(S.headingFor('kiler'), 'pantryChoice');
  eq(S.headingFor(undefined), 'tonightChoice');
});

console.log('\nvariety in one answer');
t('one dish per family by default, so three cards are three dinners', () => {
  const rows = [
    apiRow({ id: 1, title: 'Zeytinyağlı Taze Fasulye' }),
    apiRow({ id: 2, title: 'Etli Taze Fasulye' }),
    apiRow({ id: 3, title: 'Mercimek Çorbası' }),
    apiRow({ id: 4, title: 'Karnıyarık' }),
  ];
  eq(S.normalize(rows, { limit: 3 }).map(s => s.id).join(','), '1,3,4');
});
t('the cap gives way rather than answering with one card', () => {
  // Every candidate is a green bean dish. Variety is impossible, so the cap
  // is relaxed instead of shrinking the answer to a single suggestion.
  const rows = [
    apiRow({ id: 1, title: 'Zeytinyağlı Taze Fasulye' }),
    apiRow({ id: 2, title: 'Etli Taze Fasulye' }),
    apiRow({ id: 3, title: 'Fırında Taze Fasulye' }),
  ];
  eq(S.normalize(rows, { limit: 3, topUp: true }).length, 3);
  eq(S.normalize(rows, { limit: 3 }).length, 1, 'without topUp the cap holds:');
});
t('putting entries back preserves ranked order', () => {
  const rows = [
    apiRow({ id: 1, title: 'Mercimek Çorbası' }),
    apiRow({ id: 2, title: 'Domates Çorbası' }),
    apiRow({ id: 3, title: 'Tarhana Çorbası' }),
    apiRow({ id: 4, title: 'Karnıyarık' }),
  ];
  eq(S.normalize(rows, { limit: 3, topUp: true }).map(s => s.id).join(','), '1,2,4');
});
t('a long list caps the family instead of filling up on it', () => {
  const rows = [
    apiRow({ id: 1, title: 'Zeytinyağlı Taze Fasulye' }),
    apiRow({ id: 2, title: 'Etli Taze Fasulye' }),
    apiRow({ id: 3, title: 'Fırında Taze Fasulye' }),
    apiRow({ id: 4, title: 'Karnıyarık' }),
  ];
  eq(S.normalize(rows, { limit: 20, perFamily: 2 }).map(s => s.id).join(','), '1,2,4');
});
t('exact duplicates go before the cap is even considered', () => {
  const rows = [
    apiRow({ id: 1, title: 'Taze Fasulye' }),
    apiRow({ id: 2, title: 'Taze Fasulye' }),
    apiRow({ id: 3, title: 'Taze Fasulye Yemeği' }),
    apiRow({ id: 4, title: 'Karnıyarık' }),
  ];
  eq(S.normalize(rows, { limit: 20, perFamily: 2 }).map(s => s.id).join(','), '1,4');
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
