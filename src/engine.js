/* ============================================================================
 * Sofra — Turkish cost engine.
 *
 * The product is one number: what does this dinner cost per person, tonight,
 * where you live. Everything else exists to make that number trustworthy.
 *
 * Pure functions, no framework, no I/O — so the same file runs in the browser
 * prototype, in the React Native app, and under `node` for tests.
 * ==========================================================================*/
(function (root) {
  'use strict';

  // ----------------------------------------------------- price / season model
  //
  // Calibrated against TEPGE's 2024 tomato producer series: 11.91 TL/kg in July
  // against 21.28 in February, a ratio of 1.79. The `sera` factors below give
  // 1.35 / 0.75 = 1.80. Greenhouses guarantee availability, never affordability,
  // and that gap is the entire reason this app exists.

  var FACTOR = {
    kiler:    { peak: 1.00, shoulder: 1.00, off: 1.00, winter: 1.00 },
    depo:     { peak: 0.90, shoulder: 1.00, off: 1.05, winter: 1.05 },
    sera:     { peak: 0.75, shoulder: 1.00, off: 1.00, winter: 1.35 },
    seasonal: { peak: 0.70, shoulder: 1.00, off: 2.20, winter: 2.20 }
  };

  // Dec–Apr: when greenhouse produce carries its premium.
  var WINTER = { 12: 1, 1: 1, 2: 1, 3: 1, 4: 1 };

  var STATE = {
    PEAK:     { key: 'peak',     tr: 'Tam mevsimi',     en: 'Peak season',    tone: 'good' },
    SHOULDER: { key: 'shoulder', tr: 'Mevsimine yakın', en: 'Near season',    tone: 'ok'   },
    STORED:   { key: 'stored',   tr: 'Her zaman uygun', en: 'Cheap all year', tone: 'good' },
    WINTER:   { key: 'winter',   tr: 'Serada, pahalı',  en: 'Greenhouse, pricey', tone: 'bad' },
    OFF:      { key: 'off',      tr: 'Mevsimi değil',   en: 'Out of season',  tone: 'bad'  },
    PANTRY:   { key: 'pantry',   tr: 'Kiler',           en: 'Pantry',         tone: 'ok'   }
  };

  function wrap(m) { return ((m - 1) % 12 + 12) % 12 + 1; }

  function inWindow(m, start, end) {
    if (start <= end) return m >= start && m <= end;
    return m >= start || m <= end;                       // windows that cross the new year
  }

  /**
   * What state is this ingredient in, in this region, this month?
   * @param item     ingredient record
   * @param region   region key, e.g. 'marmara'
   * @param month    1..12
   * @param regions  the `regions` map from regions.json
   */
  function stateOf(item, region, month, regions) {
    if (!item) return null;
    if (item.cls === 'kiler') return STATE.PANTRY;

    var meta = (regions && regions[region]) || { shift: 0, pad: 1 };
    var s = item.season || { start: 1, end: 12 };
    var start = wrap(s.start + meta.shift), end = wrap(s.end + meta.shift);
    var isPeak = inWindow(month, start, end);

    if (item.cls === 'depo') return isPeak ? STATE.PEAK : STATE.STORED;

    if (item.cls === 'sera') {
      if (isPeak) return STATE.PEAK;
      if (WINTER[month]) return STATE.WINTER;
      return STATE.SHOULDER;
    }

    // seasonal: the hard-gated tier, where "in season" genuinely means cheap
    if (isPeak) return STATE.PEAK;
    var pad = meta.pad;
    if (pad > 0 && inWindow(month, wrap(start - pad), wrap(end + pad))) return STATE.SHOULDER;
    return STATE.OFF;
  }

  function factorFor(item, region, month, regions) {
    var st = stateOf(item, region, month, regions);
    if (!st) return 1;
    var f = FACTOR[item.cls] || FACTOR.kiler;
    if (st === STATE.PEAK) return f.peak;
    if (st === STATE.SHOULDER) return f.shoulder;
    if (st === STATE.WINTER) return f.winter;
    if (st === STATE.STORED) return f.off;
    if (st === STATE.OFF) return f.off;
    return 1;
  }

  /**
   * Price per the ingredient's own unit (kg / L / adet / demet) in a given month.
   * The stored price is an observation from a known month, so we normalise to an
   * annual average first — otherwise a tomato recorded at its August low would be
   * discounted twice when the app is asked about August.
   */
  function livePriceFor(item, priceOverrides) {
    var observed = priceOverrides && item && priceOverrides[item.id];
    if (typeof observed === 'number') return observed > 0 ? observed : null;
    if (!observed || observed.unit !== item.unit) return null;
    var value = Number(observed.average);
    return isFinite(value) && value > 0 ? value : null;
  }

  function unitPrice(item, region, month, regions, priceOverrides) {
    if (!item) return 0;
    var live = livePriceFor(item, priceOverrides);
    if (live != null) return live;
    var observedFactor = factorFor(item, region, item.priceMonth || month, regions) || 1;
    var annualAverage = item.price / observedFactor;
    return annualAverage * factorFor(item, region, month, regions);
  }

  // -------------------------------------------------------- unit conversion
  //
  // Turkish home cooking measures in su bardağı and yemek kaşığı, not grams, so
  // the recipes are written that way and converted here. One place to be wrong.

  var MEASURE = {                  // -> grams (or ml, treated 1:1 for these)
    g: 1, ml: 1,
    yk: 15,          // yemek kaşığı  (tablespoon)
    ck: 5,           // çay kaşığı    (teaspoon)
    tk: 7,           // tatlı kaşığı  (dessert spoon)
    sb: 200,         // su bardağı    (water glass)
    cb: 100,         // çay bardağı   (tea glass)
    adet: null, demet: null, dilim: null
  };

  var DILIM_GRAMS = 30;            // one slice of bread, roughly

  /** Convert a recipe line into the number of price-units it consumes. */
  function unitsConsumed(line, item) {
    if (!item) return 0;
    var u = line.unit, q = line.qty;

    if (item.unit === 'adet' || item.unit === 'demet') {
      // A loaf is priced whole but cooked in slices, so eight slices of bread is
      // 0.4 of a loaf, not eight loaves. Anything without a slice count is counted.
      if (u === 'dilim' && item.slicesPerUnit) return q / item.slicesPerUnit;
      return q;
    }

    var grams;
    if (u === 'adet' || u === 'demet') grams = q * (item.gramsPerUnit || 100);
    else if (u === 'dilim') grams = q * DILIM_GRAMS;
    else {
      var per = MEASURE[u];
      if (per == null) return 0;
      grams = q * per;
    }
    return grams / 1000;                                          // kg or L
  }

  // ------------------------------------------------------------------- cost

  /**
   * What does this recipe cost, and where does the money go?
   * Returns total TRY, per-portion TRY, and a line-by-line breakdown sorted
   * most-expensive-first — because "the kıyma is 78% of this meal" is the single
   * most useful thing the app can tell someone cooking to a budget.
   */
  function costOf(recipe, ctx) {
    var lines = [], total = 0;
    for (var i = 0; i < recipe.ingredients.length; i++) {
      var ri = recipe.ingredients[i];
      if (ri.optional) continue;
      var item = ctx.byId[ri.id];
      if (!item) continue;
      var units = unitsConsumed(ri, item);
      var livePrice = livePriceFor(item, ctx.priceOverrides);
      var price = unitPrice(item, ctx.region, ctx.month, ctx.regions, ctx.priceOverrides);
      var cost = units * price;
      total += cost;
      lines.push({
        id: ri.id, cost: cost, units: units, unitPrice: price,
        state: stateOf(item, ctx.region, ctx.month, ctx.regions),
        source: livePrice != null ? 'marketfiyati.org.tr' : item.source, kind: item.kind
      });
    }
    lines.sort(function (a, b) { return b.cost - a.cost; });
    var servings = recipe.servings || 4;
    return {
      total: total,
      perPortion: total / servings,
      lines: lines,
      // How much of the bill one ingredient is. Drives "expensive because…".
      driver: lines.length ? lines[0] : null,
      driverShare: total > 0 && lines.length ? lines[0].cost / total : 0,
      // Confidence: what share of the cost rests on estimated rather than observed prices.
      estimatedShare: total > 0
        ? lines.reduce(function (s, l) { return s + (l.source === 'tahmin' ? l.cost : 0); }, 0) / total
        : 0
    };
  }

  /** Same dish, every month of the year. Powers the "when is this cheapest?" chart. */
  function costByMonth(recipe, ctx) {
    var out = [];
    for (var m = 1; m <= 12; m++) {
      out.push(costOf(recipe, Object.assign({}, ctx, { month: m })).perPortion);
    }
    return out;
  }

  // ---------------------------------------------------------- taste profile

  function emptyProfile() {
    return { cuisines: {}, ingredients: {}, tags: {}, cooked: {}, liked: {}, skips: {},
      feedback: {}, apiRecipes: {}, events: 0 };
  }

  function w(bucket, key) { var e = bucket[key]; return e ? e.w : 0.5; }

  function nudge(bucket, key, target) {
    var e = bucket[key] || (bucket[key] = { w: 0.5, n: 0 });
    var lr = Math.max(0.10, 0.55 / (1 + e.n));      // first signal moves a lot, twentieth barely
    e.w = Math.min(1, Math.max(0, e.w + lr * (target - e.w)));
    e.n += 1;
  }

  function signatureIngredients(recipe, byId) {
    var keep = { sebze: 1, meyve: 1, bakliyat: 1, protein: 1, yesillik: 1 };
    var out = [];
    for (var i = 0; i < recipe.ingredients.length; i++) {
      var it = byId[recipe.ingredients[i].id];
      if (it && keep[it.kind]) out.push(it.id);
    }
    if (recipe.hero && out.indexOf(recipe.hero) === -1) out.push(recipe.hero);
    return out;
  }

  var TARGET = { liked: 1.0, cooked: 0.72, disliked: 0.0, skipped: 0.34 };

  function learn(profile, recipe, event, day, byId) {
    var target = TARGET[event];
    if (target == null) return profile;
    nudge(profile.cuisines, recipe.category, target);
    var sig = signatureIngredients(recipe, byId);
    for (var i = 0; i < sig.length; i++) nudge(profile.ingredients, sig[i], target);
    for (var j = 0; j < recipe.tags.length; j++) nudge(profile.tags, recipe.tags[j], target);
    if (event === 'skipped' || event === 'disliked') {
      profile.skips[recipe.id] = (profile.skips[recipe.id] || 0) + 1;
      if (event === 'disliked' && profile.liked) delete profile.liked[recipe.id];
    } else if (event === 'liked') {
      profile.liked = profile.liked || {};
      profile.liked[recipe.id] = day;
    } else if (event === 'cooked') {
      profile.cooked[recipe.id] = day;
    }
    profile.events += 1;
    return profile;
  }

  function tasteScore(recipe, profile, byId) {
    var cat = w(profile.cuisines, recipe.category);
    var sig = signatureIngredients(recipe, byId), sum = 0;
    for (var i = 0; i < sig.length; i++) sum += w(profile.ingredients, sig[i]);
    var ings = sig.length ? sum / sig.length : 0.5;
    var tsum = 0;
    for (var j = 0; j < recipe.tags.length; j++) tsum += w(profile.tags, recipe.tags[j]);
    var tags = recipe.tags.length ? tsum / recipe.tags.length : 0.5;
    return 0.45 * cat + 0.35 * ings + 0.20 * tags;
  }

  // ---------------------------------------------------------------- scoring

  var WEIGHTS = {
    cost: 0.25,      // the product — still the single largest signal
    pantry: 0.20,    // strongest predictor of actually cooking it tonight
    season: 0.16,    // flavour, and a second read on price
    taste: 0.14,     // grows to dominate after ~20 interactions
    useUp: 0.10,     // the aubergine in your fridge is money already spent
    main: 0.10,      // a family dinner is not scrambled eggs, however cheap
    time: 0.04,
    effort: 0.01
  };                 // weights sum to 1.00, so a score reads as a percentage

  var BAND = 12;     // how many leaders the daily rotation may reorder

  var PERISHABLE = { sebze: 1, meyve: 1, yesillik: 1, protein: 1, sut: 1 };

  /**
   * How much of the food already going soft in your kitchen does this dish use?
   *
   * Without this the app is technically right and practically useless: told that
   * you have aubergine and mince in the fridge, a pure cost ranker still suggests
   * a 5 TL noodle soup and lets 60 TL of vegetables spoil. Money wasted is money
   * spent, so using perishables up is part of cooking cheaply.
   */
  function useUpScore(recipe, ctx) {
    var mine = [], k;
    for (k in ctx.pantrySet) {
      if (!ctx.pantrySet[k]) continue;
      var it = ctx.byId[k];
      if (it && PERISHABLE[it.kind]) mine.push(k);
    }
    if (!mine.length) return 0.5;                        // nothing to rescue: neutral
    var used = 0;
    for (var i = 0; i < recipe.ingredients.length; i++) {
      if (mine.indexOf(recipe.ingredients[i].id) !== -1) used++;
    }
    return Math.min(1, used / Math.min(3, mine.length));  // three rescued is a full mark
  }

  /**
   * A stable per-day number in [0,1) for a given recipe.
   *
   * Used to rotate the leaders, not to score them — see `rotateBand`. Seeded on
   * the day, so the answer holds still within a day, changes across days, and
   * stays fully deterministic for the tests.
   */
  function dailyJitter(recipeId, day) {
    var h = 2166136261;
    var key = recipeId + '|' + day;
    for (var i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return (h % 1000) / 1000;
  }

  function pantryFit(recipe, pantrySet, byId) {
    var have = 0, need = 0, missing = [], burden = 0;
    for (var i = 0; i < recipe.ingredients.length; i++) {
      var ri = recipe.ingredients[i];
      if (ri.optional) continue;
      need++;
      if (pantrySet[ri.id]) { have++; continue; }
      var it = byId[ri.id];
      missing.push(ri.id);
      var kind = it ? it.kind : 'kiler';
      burden += (kind === 'baharat') ? 0.2 : (ri.id === recipe.hero) ? 1.25 : 1.0;
    }
    return {
      coverage: need ? have / need : 1,
      missing: missing,
      shopBurden: Math.min(1, burden / 4)
    };
  }

  /** Hero-weighted seasonality of the dish. */
  function seasonScore(recipe, ctx) {
    var SC = { peak: 1, shoulder: 0.7, stored: 0.8, pantry: 0.75, winter: 0.3, off: 0.1 };
    var total = 0, weight = 0;
    for (var i = 0; i < recipe.ingredients.length; i++) {
      var ri = recipe.ingredients[i], it = ctx.byId[ri.id];
      if (!it || it.cls === 'kiler') continue;
      var st = stateOf(it, ctx.region, ctx.month, ctx.regions);
      var wt = (ri.id === recipe.hero) ? 3 : 1;
      total += SC[st.key] * wt; weight += wt;
    }
    return weight ? total / weight : 0.75;                 // all-pantry dish: neutral-good
  }

  function timeFit(recipe, budget) {
    if (!budget) return 0.7;
    if (recipe.minutes <= budget) return 1;
    return Math.max(0, 1 - ((recipe.minutes - budget) / budget) * 1.3);
  }

  function effortFit(recipe, skill) {
    return Math.max(0, 1 - Math.abs(recipe.difficulty - skill) * 0.28);
  }

  function repetitionPenalty(recipe, profile, day) {
    var last = profile.cooked[recipe.id], pen = 0;
    if (last != null) {
      var ago = day - last;
      if (ago <= 2) pen += 0.55;
      else if (ago <= 6) pen += 0.34;
      else if (ago <= 13) pen += 0.16;
      else if (ago <= 25) pen += 0.06;
    }
    pen += Math.min(0.22, (profile.skips[recipe.id] || 0) * 0.11);
    return pen;
  }

  /**
   * Can this dish actually be cooked this month, where you are?
   *
   * A dish is out of season when any non-optional ingredient in the hard-gated
   * `seasonal` tier is unavailable. Greenhouse and storage produce never gates a
   * dish — it only makes it dearer, which the cost model already handles.
   *
   * Returns { available, blockers[], nextMonth }.
   */
  function availability(recipe, ctx) {
    var blockers = [];
    for (var i = 0; i < recipe.ingredients.length; i++) {
      var ri = recipe.ingredients[i];
      if (ri.optional) continue;
      var it = ctx.byId[ri.id];
      if (!it || it.cls !== 'seasonal') continue;
      if (stateOf(it, ctx.region, ctx.month, ctx.regions) === STATE.OFF) blockers.push(ri.id);
    }
    if (!blockers.length) return { available: true, blockers: [], nextMonth: null };

    // When does the worst blocker come back? Drives "bamya temmuzda gelir".
    var soonest = null;
    for (var k = 1; k <= 12; k++) {
      var m = wrap(ctx.month + k), allOk = true;
      for (var j = 0; j < blockers.length; j++) {
        var item = ctx.byId[blockers[j]];
        if (stateOf(item, ctx.region, m, ctx.regions) === STATE.OFF) { allOk = false; break; }
      }
      if (allOk) { soonest = m; break; }
    }
    return { available: false, blockers: blockers, nextMonth: soonest };
  }

  function passesFilters(recipe, ctx) {
    if (ctx.meatless && recipe.meatGrams > 0) return false;
    if (ctx.maxMinutes && recipe.minutes > ctx.maxMinutes) return false;
    if (ctx.mealType && recipe.tags.indexOf(ctx.mealType) === -1) return false;
    if (ctx.exclude && ctx.exclude.length) {
      for (var i = 0; i < ctx.exclude.length; i++) {
        for (var j = 0; j < recipe.ingredients.length; j++) {
          if (recipe.ingredients[j].id === ctx.exclude[i]) return false;
        }
      }
    }
    return true;
  }

  /**
   * Rank the whole library.
   *
   * The cost band is computed from the candidate set rather than hard-coded, so
   * the ranking keeps working through Turkish food inflation without anyone
   * editing a constant. At ~37% annual food inflation, a hard-coded "cheap means
   * under 20 TL" would be wrong within a year.
   */
  function recommend(recipes, ctx, limit) {
    var candidates = [], i;
    for (i = 0; i < recipes.length; i++) {
      if (!passesFilters(recipes[i], ctx)) continue;
      var avail = availability(recipes[i], ctx);
      if (!avail.available && !ctx.includeOffSeason) continue;
      var cost = costOf(recipes[i], ctx);
      if (ctx.maxPerPortion && cost.perPortion > ctx.maxPerPortion) continue;
      candidates.push({ recipe: recipes[i], cost: cost, availability: avail });
    }
    if (!candidates.length) return [];

    var lo = Infinity, hi = -Infinity;
    for (i = 0; i < candidates.length; i++) {
      lo = Math.min(lo, candidates[i].cost.perPortion);
      hi = Math.max(hi, candidates[i].cost.perPortion);
    }
    var span = Math.max(1e-6, hi - lo);

    var out = [];
    for (i = 0; i < candidates.length; i++) {
      var c = candidates[i], r = c.recipe;
      // Compress the cheap end: below roughly a third of the range everything reads
      // as "cheap", and the penalty bites on the genuinely expensive dishes.
      var norm = (c.cost.perPortion - lo) / span;
      var costScore = 1 - Math.pow(norm, 1.5);
      var pf = pantryFit(r, ctx.pantrySet, ctx.byId);
      var parts = {
        cost: costScore,
        pantry: pf.coverage,
        season: seasonScore(r, ctx),
        taste: tasteScore(r, ctx.profile, ctx.byId),
        time: timeFit(r, ctx.timeBudget),
        effort: effortFit(r, ctx.skill || 1),
        useUp: useUpScore(r, ctx),
        // Sides and breakfast dishes stay in the library and stay searchable —
        // they just do not lead the evening list.
        main: r.main ? 1 : 0.3
      };
      var base = 0;
      for (var k in WEIGHTS) base += WEIGHTS[k] * parts[k];
      base -= WEIGHTS.pantry * 0.4 * pf.shopBurden;      // buying a lot is friction, not cost
      var penalty = repetitionPenalty(r, ctx.profile, ctx.day);
      parts.penalty = penalty;
      out.push({
        recipe: r, cost: c.cost, parts: parts, missing: pf.missing,
        availability: c.availability,
        total: Math.max(0, Math.min(1, base - penalty))
      });
    }
    out.sort(function (a, b) { return b.total - a.total; });
    rotateBand(out, ctx.day);
    return limit ? out.slice(0, limit) : out;
  }

  /**
   * Reorder only the leaders, only by as much as they are actually tied.
   *
   * A flat rotation weight cannot dislodge a dish that is genuinely half a point
   * ahead, so with a well-stocked kitchen the app served the same dinner fourteen
   * evenings running. Scaling the shuffle to the spread across the top few fixes
   * that from both ends: where the leaders are close the order changes daily, and
   * where one dish is clearly best it stays first.
   */
  function rotateBand(out, day) {
    if (out.length < 3) return;
    var n = Math.min(BAND, out.length);
    var spread = out[0].total - out[n - 1].total;
    var amp = Math.max(0.015, spread * 1.5);       // a floor, so near-ties still move
    var head = out.slice(0, n);
    head.forEach(function (x) {
      x.rotation = dailyJitter(x.recipe.id, day);
      x.sortKey = x.total + x.rotation * amp;
    });
    head.sort(function (a, b) { return b.sortKey - a.sortKey; });
    for (var i = 0; i < n; i++) out[i] = head[i];
  }

  /** Everything worth buying right now, cheapest-relative-to-normal first. */
  function marketNow(items, ctx) {
    var out = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.cls === 'kiler') continue;
      var st = stateOf(it, ctx.region, ctx.month, ctx.regions);
      out.push({
        item: it, state: st,
        price: unitPrice(it, ctx.region, ctx.month, ctx.regions, ctx.priceOverrides),
        factor: factorFor(it, ctx.region, ctx.month, ctx.regions)
      });
    }
    out.sort(function (a, b) {
      if (a.factor !== b.factor) return a.factor - b.factor;
      return a.item.names.tr.localeCompare(b.item.names.tr, 'tr');
    });
    return out;
  }

  /** Shopping list for a set of chosen dishes, with a running total. */
  function shoppingList(scored, ctx) {
    var map = {};
    scored.forEach(function (s) {
      s.recipe.ingredients.forEach(function (ri) {
        if (ri.optional || ctx.pantrySet[ri.id]) return;
        var item = ctx.byId[ri.id];
        if (!item) return;
        var e = map[ri.id] || (map[ri.id] = {
          id: ri.id, units: 0, unit: item.unit, kind: item.kind, forRecipes: []
        });
        e.units += unitsConsumed(ri, item);
        e.forRecipes.push(s.recipe.id);
      });
    });
    var list = Object.keys(map).map(function (k) {
      var e = map[k], item = ctx.byId[k];
      e.unitPrice = unitPrice(item, ctx.region, ctx.month, ctx.regions, ctx.priceOverrides);
      e.cost = e.units * e.unitPrice;
      e.state = stateOf(item, ctx.region, ctx.month, ctx.regions);
      return e;
    });
    list.sort(function (a, b) { return b.cost - a.cost; });
    list.total = list.reduce(function (s, x) { return s + x.cost; }, 0);
    return list;
  }

  /** Dishes that are out of season now but come back soonest. */
  function comingSoon(recipes, ctx, limit) {
    var out = [];
    for (var i = 0; i < recipes.length; i++) {
      var a = availability(recipes[i], ctx);
      if (a.available) continue;
      var gap = a.nextMonth == null ? 99 : ((a.nextMonth - ctx.month + 12) % 12) || 12;
      out.push({ recipe: recipes[i], nextMonth: a.nextMonth, monthsAway: gap, blockers: a.blockers });
    }
    out.sort(function (a, b) { return a.monthsAway - b.monthsAway; });
    return limit ? out.slice(0, limit) : out;
  }

  var api = {
    STATE: STATE, FACTOR: FACTOR, WEIGHTS: WEIGHTS, MEASURE: MEASURE, BAND: BAND,
    stateOf: stateOf, factorFor: factorFor, livePriceFor: livePriceFor, unitPrice: unitPrice, dailyJitter: dailyJitter,
    unitsConsumed: unitsConsumed, costOf: costOf, costByMonth: costByMonth,
    emptyProfile: emptyProfile, learn: learn, tasteScore: tasteScore,
    signatureIngredients: signatureIngredients, pantryFit: pantryFit,
    seasonScore: seasonScore, useUpScore: useUpScore, passesFilters: passesFilters,
    availability: availability, comingSoon: comingSoon,
    recommend: recommend, rotateBand: rotateBand, marketNow: marketNow, shoppingList: shoppingList
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SofraEngine = api;
})(typeof self !== 'undefined' ? self : this);
