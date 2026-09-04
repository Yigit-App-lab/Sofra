/* Plain-node tests for the Turkish cost engine.  `node tr/engine/test.js` */
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
const near = (a, b, tol, m) => { if (Math.abs(a - b) > tol)
  throw new Error(`${m || ''} expected ~${b} (±${tol}), got ${a.toFixed(3)}`); };

const ctx = (over = {}) => Object.assign({
  byId, regions: reg.regions, region: 'marmara', month: 8,
  pantrySet: {}, profile: E.emptyProfile(), timeBudget: 60, skill: 1, day: 1000
}, over);

console.log('\nseasonality states');
t('okra is peak in August, out of season in January', () => {
  eq(E.stateOf(byId.bamya, 'marmara', 8, reg.regions).key, 'peak');
  eq(E.stateOf(byId.bamya, 'marmara', 1, reg.regions).key, 'off');
});
t('leek is peak in January, out of season in July', () => {
  eq(E.stateOf(byId.pirasa, 'marmara', 1, reg.regions).key, 'peak');
  eq(E.stateOf(byId.pirasa, 'marmara', 7, reg.regions).key, 'off');
});
t('greenhouse tomato is never "out of season" — it is pricey instead', () => {
  eq(E.stateOf(byId.domates, 'marmara', 8, reg.regions).key, 'peak');
  eq(E.stateOf(byId.domates, 'marmara', 2, reg.regions).key, 'winter');
});
t('storage crops read as cheap all year', () => {
  eq(E.stateOf(byId.patates, 'marmara', 4, reg.regions).key, 'stored');
  eq(E.stateOf(byId.sogan, 'marmara', 2, reg.regions).key, 'stored');
});
t('pantry staples have no season', () => {
  eq(E.stateOf(byId.pirinc, 'marmara', 5, reg.regions).key, 'pantry');
  eq(E.stateOf(byId.kirmizi_mercimek, 'marmara', 11, reg.regions).key, 'pantry');
});
t('a winter window that wraps the new year works', () => {
  ['lahana_beyaz', 'pirasa', 'kereviz'].forEach(id => {
    eq(E.stateOf(byId[id], 'marmara', 1, reg.regions).key, 'peak', id + ' in January:');
    eq(E.stateOf(byId[id], 'marmara', 12, reg.regions).key, 'peak', id + ' in December:');
  });
});
t('the Mediterranean runs ahead of Marmara', () => {
  // Aubergine starts in June in Marmara, so late May should already be peak in Antalya.
  eq(E.stateOf(byId.patlican, 'akdeniz', 5, reg.regions).key, 'peak');
  ok(E.stateOf(byId.patlican, 'marmara', 5, reg.regions).key !== 'peak');
});
t('every month has produce at its peak in every region', () => {
  Object.keys(reg.regions).forEach(r => {
    for (let m = 1; m <= 12; m++) {
      const n = E.marketNow(ing.items, ctx({ region: r, month: m }))
                 .filter(x => x.state.key === 'peak').length;
      ok(n >= 4, `${r} month ${m} had only ${n} peak items`);
    }
  });
});

console.log('\nthe price model');
t('a live market observation overrides the seasonal estimate', () => {
  const seasonal = E.unitPrice(byId.domates, 'marmara', 1, reg.regions);
  const live = E.unitPrice(byId.domates, 'marmara', 1, reg.regions, {
    domates: { average: 42.5, unit: 'kg' }
  });
  eq(live, 42.5);
  ok(live !== seasonal);
});
t('the tomato winter premium matches the government series', () => {
  // TEPGE 2024 producer prices: 11.91 TL/kg July vs 21.28 February = ratio 1.787
  const jul = E.unitPrice(byId.domates, 'marmara', 7, reg.regions);
  const feb = E.unitPrice(byId.domates, 'marmara', 2, reg.regions);
  near(feb / jul, 1.787, 0.05, 'Feb/Jul ratio:');
});
t('an August observation is not discounted twice', () => {
  // Tomato was observed at 60 TL/kg in August, its peak month. Asking for August
  // must return 60, not 60 x 0.75.
  near(E.unitPrice(byId.domates, 'marmara', 8, reg.regions), 60, 0.01);
});
t('out-of-season produce costs about three times its in-season price', () => {
  const aug = E.unitPrice(byId.bamya, 'marmara', 8, reg.regions);
  const jan = E.unitPrice(byId.bamya, 'marmara', 1, reg.regions);
  near(jan / aug, 3.14, 0.1, 'okra Jan/Aug:');
});
t('pantry staples cost the same every month', () => {
  const p = m => E.unitPrice(byId.kirmizi_mercimek, 'marmara', m, reg.regions);
  for (let m = 1; m <= 12; m++) near(p(m), 49.5, 0.001, 'month ' + m + ':');
});
t('storage crops barely move', () => {
  const lo = Math.min(...[...Array(12)].map((_, i) =>
    E.unitPrice(byId.patates, 'marmara', i + 1, reg.regions)));
  const hi = Math.max(...[...Array(12)].map((_, i) =>
    E.unitPrice(byId.patates, 'marmara', i + 1, reg.regions)));
  ok(hi / lo < 1.25, `potato spread was ${(hi / lo).toFixed(2)}x`);
});

console.log('\nunit conversion');
t('grams convert against a per-kilo price', () => {
  near(E.unitsConsumed({ qty: 250, unit: 'g' }, byId.kirmizi_mercimek), 0.25, 1e-9);
});
t('a yemek kaşığı is 15 g', () => {
  near(E.unitsConsumed({ qty: 2, unit: 'yk' }, byId.salca_domates), 0.03, 1e-9);
});
t('a su bardağı is 200 g', () => {
  near(E.unitsConsumed({ qty: 1, unit: 'sb' }, byId.pirinc), 0.2, 1e-9);
});
t('adet-priced items are counted, not weighed', () => {
  eq(E.unitsConsumed({ qty: 4, unit: 'adet' }, byId.yumurta), 4);
  eq(E.unitsConsumed({ qty: 1, unit: 'adet' }, byId.karnabahar), 1);
});
t('demet-priced herbs handle half bunches', () => {
  near(E.unitsConsumed({ qty: 0.5, unit: 'demet' }, byId.maydanoz), 0.5, 1e-9);
});
t('every recipe line uses a unit the engine knows', () => {
  const known = { g:1, ml:1, yk:1, ck:1, tk:1, sb:1, cb:1, adet:1, demet:1, dilim:1 };
  rec.recipes.forEach(r => r.ingredients.forEach(i =>
    ok(known[i.unit], `${r.id} -> ${i.id} uses unknown unit "${i.unit}"`)));
});
t('no recipe line silently costs nothing', () => {
  const c = ctx();
  rec.recipes.forEach(r => {
    r.ingredients.filter(i => !i.optional).forEach(i => {
      ok(E.unitsConsumed(i, byId[i.id]) > 0, `${r.id} -> ${i.id} converted to zero units`);
    });
  });
});

console.log('\ncost');
t('lentil soup lands in the right ballpark for August 2026', () => {
  const c = E.costOf(recById.mercimek_corbasi, ctx());
  ok(c.perPortion > 5 && c.perPortion < 15, 'was ' + c.perPortion.toFixed(2) + ' TL/portion');
});
t('the cheapest dishes are the store-cupboard ones', () => {
  const all = E.recommend(rec.recipes, ctx()).sort((a, b) => a.cost.perPortion - b.cost.perPortion);
  ok(all[0].cost.perPortion < 7, 'cheapest was ' + all[0].cost.perPortion.toFixed(1) + ' TL');
  // Flour, pulses and pasta — the tiers that do not depend on the season at all.
  const pantryLed = ['corba', 'hamur', 'pilav_makarna', 'bakliyat'];
  const top6 = all.slice(0, 6).filter(x => pantryLed.includes(x.recipe.category)).length;
  ok(top6 >= 5, `only ${top6}/6 of the cheapest dishes were pantry-led`);
});
t('mince dominates the top of the price range', () => {
  const all = E.recommend(rec.recipes, ctx());
  const dearest = all.sort((a, b) => b.cost.perPortion - a.cost.perPortion).slice(0, 4);
  ok(dearest.filter(x => x.recipe.meatGrams > 0).length >= 3,
     'only ' + dearest.filter(x => x.recipe.meatGrams > 0).length + ' of the dearest 4 had meat');
});
t('out-of-season dishes are not offered at absurd prices', () => {
  // Artichoke is an April-June vegetable. In August the app must not offer it.
  const aug = E.recommend(rec.recipes, ctx({ month: 8 }));
  ok(!aug.some(s => s.recipe.id === 'zeytinyagli_enginar'), 'artichoke offered in August');
  ok(aug.every(s => s.cost.perPortion < 120),
     'something cost ' + Math.max(...aug.map(s => s.cost.perPortion)).toFixed(0) + ' TL/portion');
  const may = E.recommend(rec.recipes, ctx({ month: 5 }));
  ok(may.some(s => s.recipe.id === 'zeytinyagli_enginar'), 'artichoke missing in May');
});
t('gating names the blocking ingredient and when it returns', () => {
  const a = E.availability(recById.zeytinyagli_bamya, ctx({ month: 1 }));
  eq(a.available, false);
  ok(a.blockers.includes('bamya'));
  eq(a.nextMonth, 6);            // okra is Jul-Sep, so shoulder starts in June
});
t('a slice of bread is a fraction of a loaf, not a loaf', () => {
  const c = E.costOf(recById.bayat_ekmek_mantisi, ctx());
  ok(c.perPortion < 20, 'stale-bread dish cost ' + c.perPortion.toFixed(1) + ' TL/portion');
});
t('comingSoon lists what is nearly back, soonest first', () => {
  const soon = E.comingSoon(rec.recipes, ctx({ month: 3 }), 6);
  ok(soon.length > 0);
  for (let i = 1; i < soon.length; i++) ok(soon[i].monthsAway >= soon[i - 1].monthsAway);
});
t('every month still offers plenty to cook', () => {
  for (let m = 1; m <= 12; m++) {
    const n = E.recommend(rec.recipes, ctx({ month: m })).length;
    ok(n >= 35, `month ${m} only offered ${n} dishes`);
  }
});
t('the engine names the ingredient driving the bill', () => {
  const c = E.costOf(recById.karniyarik, ctx());
  eq(c.driver.id, 'kiyma');
  ok(c.driverShare > 0.5, 'mince share was only ' + (c.driverShare * 100).toFixed(0) + '%');
});
t('per-portion is total divided by servings', () => {
  const r = recById.kapuska, c = E.costOf(r, ctx());
  near(c.perPortion, c.total / r.servings, 1e-9);
});
t('optional ingredients are excluded from the cost', () => {
  const r = recById.menemen;
  const withOpt = r.ingredients.length;
  const counted = E.costOf(r, ctx()).lines.length;
  ok(counted < withOpt, 'optional lines were counted');
});
t('the same dish costs more out of season', () => {
  const aug = E.costOf(recById.zeytinyagli_bamya, ctx({ month: 8 })).perPortion;
  const jan = E.costOf(recById.zeytinyagli_bamya, ctx({ month: 1 })).perPortion;
  ok(jan > aug * 1.8, `okra dish: Aug ${aug.toFixed(1)} vs Jan ${jan.toFixed(1)}`);
});
t('a winter dish is cheaper in winter', () => {
  const jan = E.costOf(recById.zeytinyagli_pirasa, ctx({ month: 1 })).perPortion;
  const jul = E.costOf(recById.zeytinyagli_pirasa, ctx({ month: 7 })).perPortion;
  ok(jan < jul, `leek dish: Jan ${jan.toFixed(1)} vs Jul ${jul.toFixed(1)}`);
});
t('costByMonth returns twelve numbers and a real spread', () => {
  const m = E.costByMonth(recById.imam_bayildi, ctx());
  eq(m.length, 12);
  ok(Math.max(...m) / Math.min(...m) > 1.3, 'aubergine dish barely moved across the year');
});
t('cost confidence is reported', () => {
  const c = E.costOf(recById.mercimek_corbasi, ctx());
  ok(c.estimatedShare >= 0 && c.estimatedShare <= 1);
  ok(c.estimatedShare < 0.35, 'too much of this dish rests on estimates: ' +
     (c.estimatedShare * 100).toFixed(0) + '%');
});

console.log('\nranking');
t('the cheapest dishes rise to the top with an empty kitchen', () => {
  const top = E.recommend(rec.recipes, ctx(), 8);
  const avg = top.reduce((s, x) => s + x.cost.perPortion, 0) / top.length;
  const all = E.recommend(rec.recipes, ctx());
  const allAvg = all.reduce((s, x) => s + x.cost.perPortion, 0) / all.length;
  ok(avg < allAvg * 0.7, `top-8 averaged ${avg.toFixed(1)} vs library ${allAvg.toFixed(1)}`);
});
t('a budget cap is a hard filter', () => {
  const out = E.recommend(rec.recipes, ctx({ maxPerPortion: 15 }));
  ok(out.length > 3, 'only ' + out.length + ' dishes under 15 TL');
  ok(out.every(s => s.cost.perPortion <= 15));
});
t('the meatless filter removes every meat dish', () => {
  const out = E.recommend(rec.recipes, ctx({ meatless: true }));
  ok(out.every(s => s.recipe.meatGrams === 0));
  ok(out.length >= 35, 'meatless left only ' + out.length);   // gating removes winter dishes in August
});
t('the month changes the answer', () => {
  const jan = E.recommend(rec.recipes, ctx({ month: 1 }), 8).map(s => s.recipe.id);
  const aug = E.recommend(rec.recipes, ctx({ month: 8 }), 8).map(s => s.recipe.id);
  ok(jan.filter(x => aug.includes(x)).length <= 5,
     'January and August agreed too much: ' + jan.filter(x => aug.includes(x)).length + '/8');
});
t('what is in the kitchen changes the answer', () => {
  const a = E.recommend(rec.recipes, ctx({ pantrySet: { patlican:1, kiyma:1, sogan:1, domates:1 } }), 5);
  const b = E.recommend(rec.recipes, ctx({ pantrySet: { kirmizi_mercimek:1, sogan:1, havuc:1 } }), 5);
  ok(a[0].recipe.id !== b[0].recipe.id, 'pantry had no effect on the top pick');
});
t('a tight time budget favours faster food', () => {
  const quick = E.recommend(rec.recipes, ctx({ timeBudget: 20 }), 6);
  const avg = quick.reduce((s, r) => s + r.recipe.minutes, 0) / quick.length;
  ok(avg < 32, 'average cook time on a 20-minute budget was ' + avg.toFixed(0));
});
t('every score lands in 0..1', () => {
  E.recommend(rec.recipes, ctx()).forEach(s =>
    ok(s.total >= 0 && s.total <= 1, s.recipe.id + ' scored ' + s.total));
});
t('ranking is stable for identical input', () => {
  const a = E.recommend(rec.recipes, ctx(), 10).map(s => s.recipe.id).join();
  const b = E.recommend(rec.recipes, ctx(), 10).map(s => s.recipe.id).join();
  eq(a, b);
});
t('a maxMinutes filter is respected', () => {
  const out = E.recommend(rec.recipes, ctx({ maxMinutes: 25 }));
  ok(out.length > 5 && out.every(s => s.recipe.minutes <= 25));
});

console.log('\nlearning');
t('liking a legume dish raises other legume dishes', () => {
  const c = ctx();
  const before = E.recommend(rec.recipes, c).find(s => s.recipe.id === 'nohut_yemegi').parts.taste;
  E.learn(c.profile, recById.etsiz_kuru_fasulye, 'liked', 1000, byId);
  const after = E.recommend(rec.recipes, c).find(s => s.recipe.id === 'nohut_yemegi').parts.taste;
  ok(after > before, `taste did not rise: ${before.toFixed(3)} -> ${after.toFixed(3)}`);
});
t('disliking lowers similar dishes', () => {
  const c = ctx();
  const before = E.recommend(rec.recipes, c).find(s => s.recipe.id === 'nohut_yemegi').parts.taste;
  E.learn(c.profile, recById.etsiz_kuru_fasulye, 'disliked', 1000, byId);
  ok(E.recommend(rec.recipes, c).find(s => s.recipe.id === 'nohut_yemegi').parts.taste < before);
});
t('only cooked feedback enters cooking history', () => {
  const p = E.emptyProfile();
  E.learn(p, recById.kisir, 'liked', 1000, byId);
  ok(p.cooked.kisir == null, 'liked was recorded as cooked');
  eq(p.liked.kisir, 1000);
  E.learn(p, recById.kisir, 'disliked', 1001, byId);
  ok(p.cooked.kisir == null, 'disliked was recorded as cooked');
  ok(p.liked.kisir == null, 'disliked recipe stayed in liked list');
  E.learn(p, recById.kisir, 'cooked', 1002, byId);
  eq(p.cooked.kisir, 1002);
});
t('learning does not leak into unrelated categories', () => {
  const c = ctx();
  const before = E.recommend(rec.recipes, c).find(s => s.recipe.id === 'cilbir').parts.taste;
  E.learn(c.profile, recById.etsiz_kuru_fasulye, 'liked', 1000, byId);
  const after = E.recommend(rec.recipes, c).find(s => s.recipe.id === 'cilbir').parts.taste;
  ok(Math.abs(after - before) < 0.06, `leaked: ${before.toFixed(3)} -> ${after.toFixed(3)}`);
});
t('the first signal moves more than the tenth', () => {
  const p = E.emptyProfile();
  E.learn(p, recById.kisir, 'liked', 1, byId);
  const first = p.cuisines.pilav_makarna.w - 0.5;
  for (let i = 0; i < 9; i++) E.learn(p, recById.kisir, 'liked', 1, byId);
  const prev = p.cuisines.pilav_makarna.w;
  E.learn(p, recById.kisir, 'liked', 1, byId);
  ok(p.cuisines.pilav_makarna.w - prev < first, 'learning rate did not decay');
});
t('weights stay bounded under 200 identical signals', () => {
  const p = E.emptyProfile();
  for (let i = 0; i < 200; i++) E.learn(p, recById.kisir, 'liked', 1, byId);
  ok(p.cuisines.pilav_makarna.w <= 1 && p.cuisines.pilav_makarna.w >= 0);
});
t('cooking something pushes it down tomorrow', () => {
  const c = ctx();
  const before = E.recommend(rec.recipes, c).find(s => s.recipe.id === 'menemen').total;
  E.learn(c.profile, recById.menemen, 'cooked', 1000, byId);
  const after = E.recommend(rec.recipes, ctx({ profile: c.profile, day: 1001 }))
                 .find(s => s.recipe.id === 'menemen').total;
  ok(after < before, 'no repetition penalty');
});
t('the penalty fades after a month', () => {
  const c = ctx();
  E.learn(c.profile, recById.menemen, 'cooked', 1000, byId);
  eq(E.recommend(rec.recipes, ctx({ profile: c.profile, day: 1040 }))
      .find(s => s.recipe.id === 'menemen').parts.penalty, 0);
});

console.log('\nshopping list');
t('the list totals up and excludes what you already have', () => {
  const c = ctx({ pantrySet: { sogan: 1, tuz: 1, aycicek_yagi: 1 } });
  const list = E.shoppingList(E.recommend(rec.recipes, c, 3), c);
  ok(list.length > 0);
  ok(!list.some(x => ['sogan', 'tuz', 'aycicek_yagi'].includes(x.id)));
  const sum = list.reduce((s, x) => s + x.cost, 0);
  near(list.total, sum, 1e-6);
});
t('quantities are merged when a dish repeats an ingredient', () => {
  const c = ctx();
  const three = E.recommend(rec.recipes, c, 3);
  const list = E.shoppingList(three, c);
  const multi = list.filter(x => x.forRecipes.length > 1);
  ok(list.every(x => x.units > 0));
  ok(multi.length === 0 || multi.every(x => x.units > 0));
});
t('the market list is ordered by how cheap things are versus normal', () => {
  const m = E.marketNow(ing.items, ctx());
  for (let i = 1; i < m.length; i++) ok(m[i].factor >= m[i - 1].factor, 'not sorted at ' + i);
  ok(m[0].factor <= 0.9, 'nothing was actually cheap');
});

console.log('\ndata integrity');
t('every recipe ingredient exists', () => {
  rec.recipes.forEach(r => r.ingredients.forEach(i =>
    ok(byId[i.id], `${r.id} -> ${i.id}`)));
});
t('every hero ingredient is used in its own recipe', () => {
  rec.recipes.forEach(r => ok(r.ingredients.some(i => i.id === r.hero),
    `${r.id} hero "${r.hero}" not in ingredients`));
});
t('every recipe has Turkish and English titles', () => {
  rec.recipes.forEach(r => ['tr', 'en'].forEach(l =>
    ok(r.titles[l] && r.titles[l].length, `${r.id}.${l}`)));
});
t('every ingredient has Turkish and English names', () => {
  ing.items.forEach(i => ['tr', 'en'].forEach(l =>
    ok(i.names[l] && i.names[l].length, `${i.id}.${l}`)));
});
t('every recipe has at least four steps and a sane time', () => {
  rec.recipes.forEach(r => {
    ok(r.steps.length >= 4, `${r.id} has ${r.steps.length} steps`);
    ok(r.minutes >= 10 && r.minutes <= 120, `${r.id} minutes=${r.minutes}`);
    ok(r.servings >= 2 && r.servings <= 8, `${r.id} servings=${r.servings}`);
  });
});
t('every non-pantry ingredient has a season window', () => {
  ing.items.filter(i => i.cls !== 'kiler').forEach(i => {
    ok(i.season, i.id + ' has no season');
    ok(i.season.start >= 1 && i.season.start <= 12, i.id + ' start');
    ok(i.season.end >= 1 && i.season.end <= 12, i.id + ' end');
  });
});
t('every price carries a source and an observation month', () => {
  ing.items.forEach(i => {
    ok(i.price > 0, i.id + ' price');
    ok(['pazar', 'market', 'hal', 'tahmin'].includes(i.source), i.id + ' source=' + i.source);
    ok(i.priceMonth >= 1 && i.priceMonth <= 12, i.id + ' priceMonth');
  });
});
t('every province maps to a real region', () => {
  reg.cities.forEach(c => ok(reg.regions[c.region], c.name + ' -> ' + c.region));
});
t('the meatGrams flag agrees with the ingredient list', () => {
  const meat = ['kiyma', 'kusbasi', 'kuzu', 'tavuk_but', 'tavuk_gogus', 'sucuk', 'ton_baligi'];
  rec.recipes.forEach(r => {
    const has = r.ingredients.some(i => !i.optional && meat.includes(i.id));
    eq(has, r.meatGrams > 0, `${r.id}: meatGrams=${r.meatGrams} but hasMeat=${has}`);
  });
});
t('every dish is affordable to somebody — none is absurd', () => {
  const c = ctx();
  rec.recipes.forEach(r => {
    const p = E.costOf(r, c).perPortion;
    ok(p > 1 && p < 250, `${r.id} costs ${p.toFixed(1)} TL/portion`);
  });
});

t('the evening list leads with proper main courses', () => {
  for (let d = 1000; d < 1012; d++) {
    const top = E.recommend(rec.recipes, ctx({ day: d }), 3);
    ok(top.filter(x => x.recipe.main).length >= 2,
       `day ${d}: only ${top.filter(x => x.recipe.main).length}/3 of the top were main courses`);
  }
});
t('sides and egg dishes are still in the library', () => {
  const all = E.recommend(rec.recipes, ctx()).map(s => s.recipe.id);
  ['menemen', 'kisir', 'humus'].forEach(id => ok(all.includes(id), id + ' was filtered out entirely'));
});

console.log('\nvariety');
t('the top pick changes from day to day with an empty kitchen', () => {
  const seen = new Set();
  for (let d = 1000; d < 1014; d++) seen.add(E.recommend(rec.recipes, ctx({ day: d }), 1)[0].recipe.id);
  ok(seen.size >= 4, `only ${seen.size} different top picks across 14 days`);
});
t('and with a well-stocked kitchen too — the fourteen-dinners bug', () => {
  const pantry = { sogan:1, patates:1, salca_domates:1, aycicek_yagi:1, tuz:1, karabiber:1,
                   un:1, pirinc:1, makarna:1, seker:1, yumurta:1, kirmizi_mercimek:1 };
  const seen = new Set();
  for (let d = 1000; d < 1014; d++) {
    seen.add(E.recommend(rec.recipes, ctx({ day: d, pantrySet: pantry }), 1)[0].recipe.id);
  }
  ok(seen.size >= 4, `only ${seen.size} different top picks across 14 days with a full pantry`);
});
t('rotation never promotes a dish from outside the leading band', () => {
  const byScore = E.recommend(rec.recipes, ctx({ day: 1 }));
  const floor = byScore[Math.min(E.BAND, byScore.length) - 1].total;
  for (let d = 1000; d < 1020; d++) {
    const first = E.recommend(rec.recipes, ctx({ day: d }), 1)[0];
    ok(first.total >= floor - 1e-9,
       `day ${d} promoted ${first.recipe.id} at ${first.total.toFixed(3)} below band floor ${floor.toFixed(3)}`);
  }
});
t('but it is stable within the same day', () => {
  const a = E.recommend(rec.recipes, ctx({ day: 1000 }), 5).map(s => s.recipe.id).join();
  const b = E.recommend(rec.recipes, ctx({ day: 1000 }), 5).map(s => s.recipe.id).join();
  eq(a, b);
});
t('rotation does not override cost — a fortnight of picks stays cheap', () => {
  let sum = 0;
  for (let d = 1000; d < 1014; d++) sum += E.recommend(rec.recipes, ctx({ day: d }), 1)[0].cost.perPortion;
  const avg = sum / 14;
  ok(avg < 22, 'average top pick was ' + avg.toFixed(1) + ' TL/portion');
});
t('a real pantry beats rotation on every single day', () => {
  // The property that matters is not "one named dish appears" — it is that the
  // suggestions consistently use the food that is already in the kitchen.
  const pantry = { patlican:1, kiyma:1, sogan:1, domates:1, biber_sivri:1,
                   salca_domates:1, aycicek_yagi:1, tuz:1, karabiber:1 };
  for (let d = 1000; d < 1014; d++) {
    const top = E.recommend(rec.recipes, ctx({ day: d, pantrySet: pantry }), 5);
    const avgUseUp = top.reduce((s, x) => s + x.parts.useUp, 0) / top.length;
    const avgPantry = top.reduce((s, x) => s + x.parts.pantry, 0) / top.length;
    ok(avgUseUp > 0.45, `day ${d}: top-5 use-up only ${avgUseUp.toFixed(2)}`);
    ok(avgPantry > 0.7, `day ${d}: top-5 pantry coverage only ${avgPantry.toFixed(2)}`);
  }
});
t('the suggestions stay cheap even while chasing the pantry', () => {
  const pantry = { patlican:1, kiyma:1, sogan:1, domates:1, biber_sivri:1, tuz:1 };
  for (let d = 1000; d < 1010; d++) {
    const top = E.recommend(rec.recipes, ctx({ day: d, pantrySet: pantry }), 5);
    const avg = top.reduce((s, x) => s + x.cost.perPortion, 0) / top.length;
    ok(avg < 32, `day ${d}: top-5 averaged ${avg.toFixed(1)} TL/portion`);
  }
});

t('perishables in the kitchen pull matching dishes up', () => {
  const base = ctx({ pantrySet: { tuz: 1, aycicek_yagi: 1 } });
  const withVeg = ctx({ pantrySet: { tuz: 1, aycicek_yagi: 1, patlican: 1, domates: 1, biber_sivri: 1 } });
  const rank = (c, id) => E.recommend(rec.recipes, c).findIndex(s => s.recipe.id === id);
  ok(rank(withVeg, 'saksuka') < rank(base, 'saksuka'),
     'aubergine in the fridge did not raise şakşuka');
});
t('an empty kitchen gives a neutral use-up score, not a zero', () => {
  eq(E.useUpScore(recById.menemen, ctx({ pantrySet: {} })), 0.5);
});
t('use-up never overrides an out-of-season gate', () => {
  const c = ctx({ month: 1, pantrySet: { bamya: 1, domates: 1, sogan: 1 } });
  ok(!E.recommend(rec.recipes, c).some(s => s.recipe.id === 'zeytinyagli_bamya'));
});

/* ---------------------------------------------------------------------------
 * Aligning the three suggestion methods
 *
 * "Benim için seç" reads the bundled library through this engine, while
 * "Mevsime göre seç" and "Kilerimden seç" read the database through the API.
 * The tests below pin the behaviour that has to be identical in both.
 * -------------------------------------------------------------------------*/

console.log('\ndietary filters');
t('a gluten-free request never returns a dish with flour, bread or pasta', () => {
  const out = E.recommend(rec.recipes, ctx({ glutenFree: true, includeOffSeason: true }));
  ok(out.length > 0, 'no gluten-free dishes at all');
  out.forEach(s => {
    ok(!E.dietaryFlags(s.recipe, byId).gluten, `${s.recipe.id} contains gluten`);
  });
});
t('a lactose-free request never returns yoghurt, cheese or butter', () => {
  const out = E.recommend(rec.recipes, ctx({ lactoseFree: true, includeOffSeason: true }));
  ok(out.length > 0, 'no lactose-free dishes at all');
  out.forEach(s => {
    ok(!E.dietaryFlags(s.recipe, byId).lactose, `${s.recipe.id} contains lactose`);
  });
});
t('a low-glycemic request never returns rice, potato, sugar or white flour', () => {
  const out = E.recommend(rec.recipes, ctx({ lowGlycemic: true, includeOffSeason: true }));
  ok(out.length > 0, 'no low-glycemic dishes at all');
  out.forEach(s => {
    ok(E.dietaryFlags(s.recipe, byId).lowGlycemic, `${s.recipe.id} is not low-glycemic`);
  });
});
t('vegan excludes eggs, dairy and honey; vegetarian keeps them', () => {
  const vegan = E.recommend(rec.recipes, ctx({ diet: 'vegan', includeOffSeason: true }));
  const vegetarian = E.recommend(rec.recipes, ctx({ diet: 'vegetarian', includeOffSeason: true }));
  ok(vegan.length > 0 && vegetarian.length > vegan.length,
     `vegan ${vegan.length}, vegetarian ${vegetarian.length}`);
  vegan.forEach(s => ok(E.dietaryFlags(s.recipe, byId).vegan, `${s.recipe.id} is not vegan`));
  vegetarian.forEach(s => ok(E.dietaryFlags(s.recipe, byId).vegetarian, `${s.recipe.id} has meat`));
});
t('meatless means what the API means by it — fish is not vegetarian', () => {
  const out = E.recommend(rec.recipes, ctx({ meatless: true, includeOffSeason: true }));
  out.forEach(s => {
    s.recipe.ingredients.forEach(ri => {
      ok(!(byId[ri.id] || {}).meat, `${s.recipe.id} contains ${ri.id}`);
    });
  });
});
t('a filter that matches nothing returns an empty list, not a wrong dinner', () => {
  eq(E.recommend(rec.recipes, ctx({ maxMinutes: 1 })).length, 0);
});

console.log('\ncost confidence');
t('a well-mapped recipe reports full coverage and a trusted price', () => {
  const c = E.costOf(recById.menemen, ctx());
  eq(c.coverage, 1);
  eq(c.trusted, true);
  eq(c.unavailableReason, null);
});
t('an unpriceable protein withholds the price instead of guessing', () => {
  const broken = JSON.parse(JSON.stringify(recById.izmir_kofte));
  broken.ingredients.forEach(ri => { if (ri.id === 'kiyma') ri.qty = 0; });
  const c = E.costOf(broken, ctx());
  eq(c.trusted, false);
  eq(c.unavailableReason, 'missing_required_protein');
});
t('an ingredient the catalogue does not know lowers coverage', () => {
  const broken = JSON.parse(JSON.stringify(recById.menemen));
  broken.ingredients.push({ id: 'gizli_malzeme', qty: 200, unit: 'g' });
  const c = E.costOf(broken, ctx());
  ok(c.coverage < 1, `coverage stayed at ${c.coverage}`);
  ok(c.missingIngredients.indexOf('gizli_malzeme') !== -1, 'unmapped id not reported');
});
t('the coverage threshold is the one the API publishes on', () => {
  eq(E.COVERAGE_MIN, 0.70);
});

console.log('\npantry protein priority');
t('mince in the kitchen lifts the dishes that use it', () => {
  const base = { tuz: 1, aycicek_yagi: 1, sogan: 1 };
  const withMince = Object.assign({}, base, { kiyma: 1 });
  const rank = (pantry, id) =>
    E.recommend(rec.recipes, ctx({ pantrySet: pantry })).findIndex(s => s.recipe.id === id);
  ['biber_dolmasi', 'karniyarik', 'patates_musakka'].forEach(id => {
    ok(rank(withMince, id) < rank(base, id), `${id} did not rise with kıyma in the kitchen`);
  });
});
t('a kitchen with no protein is unaffected by the protein bonus', () => {
  const pantry = { tuz: 1, aycicek_yagi: 1, sogan: 1 };
  E.recommend(rec.recipes, ctx({ pantrySet: pantry })).forEach(s => {
    eq(s.parts.protein, 0, `${s.recipe.id} claimed a protein match`);
  });
});
t('the protein bonus cannot outweigh an out-of-season gate', () => {
  const c = ctx({ month: 1, pantrySet: { kiyma: 1, bamya: 1 } });
  ok(!E.recommend(rec.recipes, c).some(s => s.recipe.id === 'zeytinyagli_bamya'));
});

console.log('\nduplicate suppression');
t('source noise and word order do not make two titles different', () => {
  eq(E.normalizeTitleKey('Videolu Fırında Tavuk Tarifi'),
     E.normalizeTitleKey('Fırında Tavuk Nasıl Yapılır'));
});
t('Turkish case folding survives a title comparison', () => {
  eq(E.normalizeTitleKey('ŞEHRİYELİ PİLAV'), E.normalizeTitleKey('şehriyeli pilav'));
});
t('near-identical imports collapse to the first one ranked', () => {
  const rows = [
    { title: 'Fırında Tavuk' },
    { title: 'Fırında Tavuk Tarifi' },
    { title: 'Fırında Tavuk Nasıl Yapılır (Videolu)' },
    { title: 'Fırında Sebzeli Tavuk' },
    { title: 'Mercimek Çorbası' },
  ];
  const kept = E.dropNearDuplicates(rows, r => r.title);
  eq(kept.length, 2);
  eq(kept[0].title, 'Fırında Tavuk');
  eq(kept[1].title, 'Mercimek Çorbası');
});
t('a bare dish name is absorbed by the same name with a modifier', () => {
  // Reported from Kilerimden seç: three mayonnaises in one three-card answer.
  // Word overlap alone rated these half similar, because the shared word is
  // one of two, so containment decides it instead.
  //
  // 'Ev yapımı mayonez' and 'Sarımsaklı mayonez' are two different sauces and
  // survive on purpose: collapsing them would need a rule that also collapsed
  // mercimek and domates çorbası. What removes a condiment from a dinner list
  // is dinner suitability, not deduplication — see NOT_A_MEAL_HEADS in
  // backend/recipe_api.py, which drops all three before they are ranked.
  const rows = [
    { title: 'Ev Yapımı Mayonez' },
    { title: 'Mayonez' },
    { title: 'Sarımsaklı Mayonez' },
    { title: 'Mayonezli Tavuk Salatası' },
  ];
  const kept = E.dropNearDuplicates(rows, r => r.title).map(r => r.title);
  eq(kept.length, 3);
  ok(kept.indexOf('Mayonez') === -1, 'the bare title was not absorbed');
  eq(kept[0], 'Ev Yapımı Mayonez');
});
t('duplicates are caught across categories, not only inside one', () => {
  // The same import arrives filed under several categories, which is how the
  // mayonnaise trio survived a category-scoped comparison.
  const rows = [
    { title: 'Mayonez', category: 'sos' },
    { title: 'Mayonez Tarifi', category: 'kahvaltilik' },
  ];
  eq(E.dropNearDuplicates(rows, r => r.title).length, 1);
});
t('two soups that share only their head noun stay separate', () => {
  const rows = [
    { title: 'Mercimek Çorbası' },
    { title: 'Domates Çorbası' },
    { title: 'Tarhana Çorbası' },
  ];
  eq(E.dropNearDuplicates(rows, r => r.title).length, 3);
});
t('containment is symmetric', () => {
  ok(E.titleContains(E.normalizeTitleKey('Mayonez'), E.normalizeTitleKey('Sarımsaklı Mayonez')));
  ok(E.titleContains(E.normalizeTitleKey('Sarımsaklı Mayonez'), E.normalizeTitleKey('Mayonez')));
  ok(!E.titleContains(E.normalizeTitleKey('Mercimek Çorbası'), E.normalizeTitleKey('Domates Çorbası')));
});
t('two genuinely different dishes are never collapsed', () => {
  const out = E.recommend(rec.recipes, ctx({ includeOffSeason: true }));
  const ids = new Set(out.map(s => s.recipe.id));
  eq(ids.size, out.length);
  ok(out.length > 40, `only ${out.length} dishes survived deduplication`);
});
t('deduplication can be switched off for auditing', () => {
  const on = E.recommend(rec.recipes, ctx({ includeOffSeason: true })).length;
  const off = E.recommend(rec.recipes, ctx({ includeOffSeason: true, dedupe: false })).length;
  ok(off >= on, `${off} without dedupe, ${on} with`);
});

console.log('\ntie-breaking');
t('the fuller recipe wins when nothing else separates two dishes', () => {
  const thin = { id: 'thin', titles: { tr: 'Bir yemek' }, category: 'test', minutes: 20,
    difficulty: 1, servings: 2, tags: [], hero: 'sogan', meatGrams: 0,
    main: true, steps: ['Pişir.'],
    ingredients: [{ id: 'sogan', qty: 100, unit: 'g' }, { id: 'tuz', qty: 5, unit: 'g' }] };
  const full = JSON.parse(JSON.stringify(thin));
  full.id = 'full';
  full.titles.tr = 'Başka bir yemek';
  full.steps = ['Soğanı doğrayın.', 'Yağda kavurun.', 'Tuz ekleyin.', 'On dakika pişirin.'];
  ok(E.detailScore(full) > E.detailScore(thin), 'detail score did not separate them');
  const out = E.recommend([thin, full], ctx({ day: 7 }));
  eq(out[0].recipe.id, 'full');
});
t('a tie-break can never overturn a materially better dish', () => {
  // Below the rotating band the list is in pure score order: the tie-break is
  // a fraction of a point and cannot reorder dishes the ranker separated.
  const out = E.recommend(rec.recipes, ctx({ includeOffSeason: true, dedupe: false }));
  for (let i = E.BAND + 1; i < out.length; i++) {
    ok(out[i - 1].total >= out[i].total - 1e-9,
       `position ${i} is out of order: ${out[i - 1].total} then ${out[i].total}`);
  }
  ok(E.PROTEIN_BONUS < E.WEIGHTS.cost, 'the protein bonus outweighs the cost signal');
});

console.log('\nfamilies of the same dish');
t('four recipes titled exactly the same are one dish', () => {
  // Reported from the Kiler list: the library holds four separate recipes all
  // titled "Taze Fasulye", differing only in category and cooking time.
  const rows = [
    { title: 'Taze Fasulye', category: 'Sebze', total_minutes: 35 },
    { title: 'Semizotu Yemeği', category: 'Semizotlu Tarifler', total_minutes: 30 },
    { title: 'Taze Fasulye', category: 'Zeytinyağlı', total_minutes: 45 },
    { title: 'Taze Fasulye', category: 'Sebze', total_minutes: 40 },
    { title: 'Taze Fasulye', category: 'Zeytinyağlı', total_minutes: 40 },
  ];
  const kept = E.dropNearDuplicates(rows, r => r.title);
  eq(kept.length, 2);
  eq(kept[0].total_minutes, 35, 'the first-ranked one should survive:');
  eq(kept[1].title, 'Semizotu Yemeği');
});
t('a generic dish word carries no identity', () => {
  eq(E.normalizeTitleKey('Taze Fasulye'), E.normalizeTitleKey('Taze Fasulye Yemeği'));
  eq(E.normalizeTitleKey('Semizotu Yemeği'), 'semizotu');
});
t('the head noun is the word that says what the dish is', () => {
  eq(E.titleHeadWord('Zeytinyağlı Taze Fasulye'), 'fasulye');
  eq(E.titleHeadWord('Etli Taze Fasulye'), 'fasulye');
  eq(E.titleHeadWord('Taze Fasulye Yemeği'), 'fasulye');   // 'yemeği' skipped
  eq(E.titleHeadWord('Taze Fasulye Salatası'), 'salatasi'); // a salad, not beans
  eq(E.titleHeadWord('Mercimek Çorbası'), 'corbasi');
  eq(E.titleHeadWord('Fırında Tavuk Tarifi'), 'tavuk');     // 'tarifi' skipped
  eq(E.titleHeadWord(''), '');
  eq(E.titleHeadWord(null), '');
});
t('a family is capped, not merged', () => {
  // These are three different dinners. The cap keeps the best ones and gives
  // the rest of the list back to other food; merging them would be wrong.
  const rows = [
    { title: 'Zeytinyağlı Taze Fasulye' },
    { title: 'Etli Taze Fasulye' },
    { title: 'Fırında Taze Fasulye' },
    { title: 'Mercimek Çorbası' },
  ];
  const kept = E.capByHeadNoun(rows, r => r.title, 2).map(r => r.title);
  eq(kept.length, 3);
  eq(kept[0], 'Zeytinyağlı Taze Fasulye');
  eq(kept[1], 'Etli Taze Fasulye');
  eq(kept[2], 'Mercimek Çorbası');
});
t('the cap keeps ranked order and defaults to one', () => {
  const rows = ['Mercimek Çorbası', 'Domates Çorbası', 'Karnıyarık']
    .map(title => ({ title }));
  eq(E.capByHeadNoun(rows, r => r.title, 1).map(r => r.title).join('|'),
     'Mercimek Çorbası|Karnıyarık');
  eq(E.capByHeadNoun(rows, r => r.title, 0).length, 2, 'zero should mean one');
});
t('a title with no readable head noun is never dropped by the cap', () => {
  const rows = [{ title: '' }, { title: '   ' }, { title: 'Tarifi' }];
  eq(E.capByHeadNoun(rows, r => r.title, 1).length, 3);
});
t('capping the bundled library leaves a usable spread of dinners', () => {
  const out = E.recommend(rec.recipes, ctx({ includeOffSeason: true }));
  const capped = E.capByHeadNoun(out, s => E.recipeTitle(s.recipe), 2);
  ok(capped.length > 30, `only ${capped.length} dishes survived the cap`);
  const heads = {};
  capped.forEach(s => {
    const head = E.titleHeadWord(E.recipeTitle(s.recipe));
    if (head) heads[head] = (heads[head] || 0) + 1;
  });
  Object.keys(heads).forEach(head => {
    ok(heads[head] <= 2, `${heads[head]} dishes share the head noun ${head}`);
  });
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
