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

  // -------------------------------------------------------------- recipe text
  //
  // The bundled library keeps titles in `titles.tr` / `titles.en`; the API
  // returns a single `title`. Both reach the same helpers so that one
  // normalisation rule serves all three suggestion methods.

  function recipeTitle(recipe, english) {
    if (!recipe) return '';
    if (recipe.titles) return recipe.titles[english ? 'en' : 'tr'] || recipe.titles.tr || '';
    return recipe.title || '';
  }

  // Source titles advertise videos Sofra cannot show, and repeat filler that
  // makes two identical dishes look different. Both are stripped before any
  // comparison. The API strips the same words in `clean_recipe_title`.
  var TITLE_NOISE = {
    videolu: 1, videosu: 1, resimli: 1, tarif: 1, tarifi: 1, tarifleri: 1,
    nasil: 1, yapilir: 1, kolay: 1, pratik: 1, nefis: 1, enfes: 1, efsane: 1,
    ev: 1, evde: 1, usulu: 1, orjinal: 1, gercek: 1, en: 1, ve: 1, ile: 1,
    // Generic dish words carry no identity: 'Taze fasulye' and 'Taze fasulye
    // yemeği' are one dish, and 'yemeği' must never be read as the head noun.
    yemek: 1, yemegi: 1, yemekleri: 1
  };

  /** Fold Turkish case/diacritics so 'Şehriyeli Pilav' and 'sehriyeli pilav' match. */
  function foldTurkish(text) {
    return String(text == null ? '' : text)
      .replace(/[İI]/g, 'i').replace(/ı/g, 'i')
      .replace(/[Şş]/g, 's').replace(/[Ğğ]/g, 'g').replace(/[Çç]/g, 'c')
      .replace(/[Üü]/g, 'u').replace(/[Öö]/g, 'o')
      .toLowerCase();
  }

  /** "Videolu Fırın Makarna Tarifi" -> "firin makarna" (sorted, noise dropped). */
  function normalizeTitleKey(text) {
    var folded = foldTurkish(text).replace(/[^a-z0-9]+/g, ' ').trim();
    if (!folded) return '';
    var parts = folded.split(' '), out = [];
    for (var i = 0; i < parts.length; i++) {
      var token = parts[i];
      // Single letters are source debris; a single digit ('Kek 2') is not.
      if (!token || TITLE_NOISE[token]) continue;
      if (token.length < 2 && !/^[0-9]$/.test(token)) continue;
      if (out.indexOf(token) === -1) out.push(token);
    }
    out.sort();
    return out.join(' ');
  }

  function namedInTitle(item, titleKey) {
    var name = normalizeTitleKey((item.names && item.names.tr) || item.id);
    if (!name) return false;
    var words = name.split(' ');
    for (var i = 0; i < words.length; i++) {
      if (words[i].length >= 4 && titleKey.indexOf(words[i]) !== -1) return true;
    }
    return false;
  }

  function titleSimilarity(a, b) {
    var x = a ? a.split(' ') : [], y = b ? b.split(' ') : [];
    if (!x.length || !y.length) return 0;
    var shared = 0;
    for (var i = 0; i < x.length; i++) if (y.indexOf(x[i]) !== -1) shared++;
    return shared / (x.length + y.length - shared);
  }

  /**
   * The head noun — the word that says what the dish *is*.
   *
   * Turkish puts it last, so 'Zeytinyağlı taze fasulye' and 'Etli taze fasulye'
   * both answer 'fasulye'. Noise and generic dish words are skipped from the
   * right, which is why 'Taze fasulye yemeği' answers 'fasulye' too. The API
   * reads titles the same way in `title_head_word`.
   */
  function titleHeadWord(text) {
    var folded = foldTurkish(text).replace(/[^a-z0-9]+/g, ' ').trim();
    if (!folded) return '';
    var parts = folded.split(' ');
    for (var i = parts.length - 1; i >= 0; i--) {
      var token = parts[i];
      if (!token || TITLE_NOISE[token]) continue;
      if (token.length < 2 && !/^[0-9]$/.test(token)) continue;
      return token;
    }
    return '';
  }

  /**
   * Let at most `max` dishes of the same family into one answer.
   *
   * Reported from the Kiler list: four taze fasulye dishes in twenty. They are
   * not duplicates — zeytinyağlı, etli and fırında green beans are three
   * different dinners — so collapsing them by title would be wrong, and any
   * rule strong enough to merge them would also merge mercimek and domates
   * çorbası. Capping the family keeps the best of them and gives the rest of
   * the list back to other food.
   *
   * Entries are expected in ranked order; the first `max` of each family stay.
   */
  function capByHeadNoun(items, titleOf, max) {
    var limit = max > 0 ? max : 1;
    var seen = {}, kept = [];
    for (var i = 0; i < items.length; i++) {
      var head = titleHeadWord(titleOf ? titleOf(items[i]) : items[i]);
      if (head) {
        var used = seen[head] || 0;
        if (used >= limit) continue;
        seen[head] = used + 1;
      }
      kept.push(items[i]);
    }
    return kept;
  }

  /** Is every word of the shorter title also in the longer one? */
  function titleContains(a, b) {
    var x = a ? a.split(' ') : [], y = b ? b.split(' ') : [];
    if (!x.length || !y.length) return false;
    var short = x.length <= y.length ? x : y;
    var long = x.length <= y.length ? y : x;
    for (var i = 0; i < short.length; i++) {
      if (long.indexOf(short[i]) === -1) return false;
    }
    return true;
  }

  /**
   * Collapse the same dish appearing several times.
   *
   * The API library holds many near-identical imports ("Fırında Tavuk",
   * "Fırında Tavuk Tarifi", "Fırında Tavuk Nasıl Yapılır"), and three of them in
   * a three-card answer reads as a broken app. Entries are expected in ranked
   * order; the first of each family survives.
   *
   * Containment is the rule that earns its keep: the common import pattern is a
   * bare dish name plus the same name with a modifier in front ("Mayonez",
   * "Ev Yapımı Mayonez", "Sarımsaklı Mayonez"), and word-overlap scoring rates
   * those as only half similar because the shared word is one of two. Category
   * is deliberately not consulted — the same dish arrives under several
   * categories, which is how the duplicates survived the first attempt.
   *
   * @param items   any array
   * @param titleOf reads a display title from an entry
   */
  var DUPLICATE_SIMILARITY = 0.7;

  function dropNearDuplicates(items, titleOf) {
    var kept = [], keys = [];
    for (var i = 0; i < items.length; i++) {
      var key = normalizeTitleKey(titleOf ? titleOf(items[i]) : items[i]);
      var duplicate = false;
      for (var j = 0; j < keys.length; j++) {
        if (!key || !keys[j]) continue;
        if (keys[j] === key
            || titleContains(keys[j], key)
            || titleSimilarity(keys[j], key) >= DUPLICATE_SIMILARITY) {
          duplicate = true; break;
        }
      }
      if (duplicate) continue;
      keys.push(key);
      kept.push(items[i]);
    }
    return kept;
  }

  // ----------------------------------------------------- feedback the cook gave
  //
  // `PROJECT_BRIEF.md`: "Bana göre değil should suppress unsuitable future
  // recommendations and remain reversible from the profile." It was suppressing
  // nothing. In the bundled ranker a rejected dish only lost at most 0.22 of
  // score, so it could still lead; the two API methods never saw the profile at
  // all, because the cooked and rejected history lives on the device. These
  // helpers are the shared vocabulary, applied to both sources in
  // `dropRejected` below.
  //
  // Profile keys differ by source: a bundled recipe is stored under its own id,
  // an API recipe under 'api:<id>' (see `apiRecipeForLearning` in store.js).

  var COOLDOWN_DAYS = 7;

  /**
   * Did the cook say this dish is not for them?
   *
   * Only an explicit "Bana göre değil" counts. `profile.skips` also counts
   * "Bu akşam olmaz", which means not tonight rather than never, and stays a
   * scoring penalty instead of a hard exclusion.
   */
  function isRejected(profile, key) {
    if (!profile || key == null) return false;
    var feedback = profile.feedback && profile.feedback[key];
    return Boolean(feedback && (feedback.disliked || feedback.event === 'disliked'));
  }

  /** Days since it was last cooked, or null if never. */
  function daysSinceCooked(profile, key, day) {
    if (!profile || !profile.cooked || key == null || day == null) return null;
    var last = profile.cooked[key];
    if (last == null) return null;
    var ago = day - Number(last);
    return isFinite(ago) ? ago : null;
  }

  function cookedRecently(profile, key, day, withinDays) {
    var ago = daysSinceCooked(profile, key, day);
    var window = withinDays == null ? COOLDOWN_DAYS : withinDays;
    return ago != null && ago >= 0 && ago <= window;
  }

  /**
   * Remove what the cook has rejected, and what they cooked in the last few
   * days, from a list of suggestions.
   *
   * A rejection is absolute: they said no, so it never comes back until they
   * undo it in the profile. A cooldown is not — nobody wants an empty screen
   * because they cooked well this week — so when `atLeast` is given, the most
   * recently cooked entries are put back until that many suggestions remain.
   *
   * @param items    any array, in ranked order
   * @param keyOf    reads the profile key from an entry
   * @param profile  state.profile
   * @param day      integer day number, as `today()` produces
   * @param options  { withinDays, atLeast }
   */
  function dropRejected(items, keyOf, profile, day, options) {
    var opts = options || {};
    var kept = [], cooling = [], i;
    for (i = 0; i < items.length; i++) {
      var key = keyOf ? keyOf(items[i]) : items[i];
      if (isRejected(profile, key)) continue;
      if (cookedRecently(profile, key, day, opts.withinDays)) {
        cooling.push({ item: items[i], ago: daysSinceCooked(profile, key, day) });
        continue;
      }
      kept.push(items[i]);
    }
    if (opts.atLeast && kept.length < opts.atLeast && cooling.length) {
      // Longest ago first: the least recently cooked is the least tiresome.
      cooling.sort(function (a, b) { return b.ago - a.ago; });
      for (i = 0; i < cooling.length && kept.length < opts.atLeast; i++) {
        kept.push(cooling[i].item);
      }
    }
    return kept;
  }

  // ------------------------------------------------------- dietary filtering
  //
  // The API filters on precomputed recipe columns (`is_vegan`, `is_vegetarian`,
  // `is_low_glycemic`) and on `contains_gluten` / `contains_lactose` in
  // `kiler_ingredients`. The bundled library carries the same facts as
  // per-ingredient flags in `ingredients.json`, and this is the only place that
  // reads them — so a filter can never mean one thing in one screen and
  // something else in another. Optional ingredients count: an allergen the cook
  // may add is still an allergen in the dish.

  function dietaryFlags(recipe, byId) {
    var gluten = false, lactose = false, highGlycemic = false;
    var meat = false, animal = false;
    var ings = recipe.ingredients || [];
    for (var i = 0; i < ings.length; i++) {
      var item = byId ? byId[ings[i].id] : null;
      if (!item) continue;
      if (item.gluten) gluten = true;
      if (item.lactose) lactose = true;
      if (item.highGlycemic) highGlycemic = true;
      if (item.meat) meat = true;
      if (item.animalProduct) animal = true;
    }
    if (recipe.meatGrams > 0) meat = true;
    return {
      gluten: gluten,
      lactose: lactose,
      lowGlycemic: !highGlycemic,
      meat: meat,
      vegetarian: !meat,
      vegan: !meat && !animal
    };
  }

  // ------------------------------------------------------------------- cost

  // Cost confidence, kept identical to backend/recipe_costs.py so that the
  // bundled library and the API publish or withhold a price for the same
  // reasons. A dish whose protein or headline ingredient could not be priced
  // shows no number at all: a plausible-looking 12 TL chicken dinner is worse
  // than admitting the estimate is unavailable.
  var COVERAGE_MIN = 0.70;
  var MIN_TOTAL = 0.05;
  var COST_RELEVANT_KIND = { protein: 1, sut: 1, tahil: 1, sebze: 1, meyve: 1 };
  var WATER_IDS = { su: 1, ilik_su: 1, sicak_su: 1, soguk_su: 1, kaynar_su: 1 };

  /**
   * What does this recipe cost, and where does the money go?
   * Returns total TRY, per-portion TRY, and a line-by-line breakdown sorted
   * most-expensive-first — because "the kıyma is 78% of this meal" is the single
   * most useful thing the app can tell someone cooking to a budget.
   *
   * `coverage` / `trusted` / `unavailableReason` mirror the API's
   * `cost_coverage` / `cost_per_portion` / `cost_unavailable_reason`, so a
   * screen can apply one rule to a local and an API suggestion alike.
   */
  function costOf(recipe, ctx) {
    var lines = [], total = 0, eligible = 0, priced = 0;
    var missingIngredients = [], missingProtein = false, missingNamed = false;
    var titleKey = normalizeTitleKey(recipeTitle(recipe));
    for (var i = 0; i < recipe.ingredients.length; i++) {
      var ri = recipe.ingredients[i];
      if (ri.optional) continue;
      if (WATER_IDS[ri.id]) continue;
      var item = ctx.byId[ri.id];
      if (!item) {
        // A measured ingredient the catalogue does not know still belongs in the
        // denominator. Ignoring it used to produce a misleading 100% coverage.
        eligible++;
        missingIngredients.push(ri.id);
        continue;
      }
      var units = unitsConsumed(ri, item);
      if (!(units > 0)) {
        if (COST_RELEVANT_KIND[item.kind]) {
          eligible++;
          missingIngredients.push(ri.id);
          if (titleKey && namedInTitle(item, titleKey)) missingNamed = true;
        }
        if (item.kind === 'protein') missingProtein = true;
        continue;
      }
      eligible++;
      var livePrice = livePriceFor(item, ctx.priceOverrides);
      var price = unitPrice(item, ctx.region, ctx.month, ctx.regions, ctx.priceOverrides);
      if (!(price > 0)) {
        missingIngredients.push(ri.id);
        if (item.kind === 'protein') missingProtein = true;
        continue;
      }
      priced++;
      var cost = units * price;
      total += cost;
      lines.push({
        id: ri.id, cost: cost, units: units, unitPrice: price,
        state: stateOf(item, ctx.region, ctx.month, ctx.regions),
        source: livePrice != null ? 'marketfiyati.org.tr' : item.source, kind: item.kind
      });
    }
    lines.sort(function (a, b) { return b.cost - a.cost; });
    var servings = recipe.servings || 2;
    var coverage = eligible ? priced / eligible : 0;
    var trusted = priced > 0 && total >= MIN_TOTAL && coverage >= COVERAGE_MIN
      && !missingProtein && !missingNamed;
    var reason = null;
    if (!trusted) {
      if (missingProtein) reason = 'missing_required_protein';
      else if (missingNamed) reason = 'missing_required_ingredient';
      else if (!priced) reason = 'no_priced_ingredients';
      else if (coverage < COVERAGE_MIN) reason = 'coverage_under_70_percent';
      else reason = 'total_below_minimum';
    }
    return {
      total: total,
      perPortion: total / servings,
      servings: servings,
      lines: lines,
      coverage: coverage,
      trusted: trusted,
      unavailableReason: reason,
      missingIngredients: missingIngredients,
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

  /**
   * Does the dish use a protein the cook already has?
   *
   * `matched_protein_count` is the API's first sort key for `Kilerimden seç`:
   * someone who ticked chicken wants the chicken used, not a lentil soup that
   * happens to match more of the spice rack. The bundled ranker gets the same
   * priority as an additive bonus, so a cook with no protein in the pantry is
   * unaffected.
   */
  var PROTEIN_BONUS = 0.06;

  function pantryProteinFit(recipe, ctx) {
    var have = 0, used = 0, id;
    for (id in ctx.pantrySet) {
      if (!ctx.pantrySet[id]) continue;
      var owned = ctx.byId[id];
      if (owned && owned.kind === 'protein') have++;
    }
    if (!have) return { have: 0, used: 0, score: 0 };
    for (var i = 0; i < recipe.ingredients.length; i++) {
      var ri = recipe.ingredients[i];
      if (ri.optional) continue;
      var item = ctx.byId[ri.id];
      if (item && item.kind === 'protein' && ctx.pantrySet[ri.id]) used++;
    }
    return { have: have, used: used, score: used ? 1 : 0 };
  }

  /**
   * How much recipe is actually there — the tie-breaker.
   *
   * Imported libraries carry both a four-line sketch and a full write-up of the
   * same dish. When nothing else separates them, the cook is better served by
   * the detailed one.
   */
  function detailScore(recipe) {
    var ingredients = recipe.ingredients ? recipe.ingredients.length : 0;
    var steps = recipe.steps ? recipe.steps.length : 0;
    var prose = 0;
    for (var i = 0; i < steps; i++) prose += String(recipe.steps[i] || '').length;
    return ingredients * 2 + steps * 3 + prose / 200;
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

  /**
   * Every filter the profile can set, applied in one place.
   *
   * `Benim için seç` used to ignore gluten, lactose, low-glycemic and the
   * vegan/vegetarian choice entirely — those were sent to the API and so only
   * shaped the other two methods. A coeliac asking for a dinner idea was served
   * börek. All four now gate the bundled library too.
   */
  function passesFilters(recipe, ctx) {
    var diet = ctx.diet && ctx.diet !== 'standard' ? ctx.diet : null;
    if (ctx.meatless || diet || ctx.glutenFree || ctx.lactoseFree || ctx.lowGlycemic) {
      var flags = dietaryFlags(recipe, ctx.byId);
      if (ctx.meatless && !flags.vegetarian) return false;
      if (diet === 'vegan' && !flags.vegan) return false;
      if (diet === 'vegetarian' && !flags.vegetarian) return false;
      if (ctx.glutenFree && flags.gluten) return false;
      if (ctx.lactoseFree && flags.lactose) return false;
      if (ctx.lowGlycemic && !flags.lowGlycemic) return false;
    }
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
      var pp = pantryProteinFit(r, ctx);
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
      base += PROTEIN_BONUS * pp.score;                  // use the meat they already bought
      parts.protein = pp.score;
      var penalty = repetitionPenalty(r, ctx.profile, ctx.day);
      parts.penalty = penalty;
      out.push({
        recipe: r, cost: c.cost, parts: parts, missing: pf.missing,
        availability: c.availability,
        // Reported for parity with the API's matched_count / matched_protein_count.
        matched: matchedCount(r, ctx),
        matchedProtein: pp.used,
        detail: detailScore(r),
        total: Math.max(0, Math.min(1, base - penalty))
      });
    }
    applyTieBreaks(out);
    out.sort(function (a, b) { return b.total - a.total; });
    if (ctx.dedupe !== false) {
      out = dropNearDuplicates(out, function (s) { return recipeTitle(s.recipe); });
    }
    rotateBand(out, ctx.day);
    return limit ? out.slice(0, limit) : out;
  }

  function matchedCount(recipe, ctx) {
    var have = 0;
    for (var i = 0; i < recipe.ingredients.length; i++) {
      var ri = recipe.ingredients[i];
      if (ri.optional) continue;
      if (ctx.pantrySet && ctx.pantrySet[ri.id]) have++;
    }
    return have;
  }

  /**
   * The API's tie-break chain, folded into the score as a hair of weight.
   *
   * `/recipes/tonight` breaks ties by matched protein, then fewer missing
   * ingredients, then more of the kitchen used, then the fuller recipe. The
   * bundled ranker now agrees — but as a term small enough that it can only
   * decide dishes the weighted score could not separate, never overturn a
   * genuinely better one. An epsilon comparator was tried first and rejected:
   * it is not transitive, so the sort itself became unpredictable.
   */
  var TIEBREAK = 0.004;

  function applyTieBreaks(out) {
    var maxMissing = 1, maxMatched = 1, maxDetail = 1, maxProtein = 1, i;
    for (i = 0; i < out.length; i++) {
      maxMissing = Math.max(maxMissing, out[i].missing.length);
      maxMatched = Math.max(maxMatched, out[i].matched);
      maxDetail = Math.max(maxDetail, out[i].detail);
      maxProtein = Math.max(maxProtein, out[i].matchedProtein);
    }
    for (i = 0; i < out.length; i++) {
      var s = out[i];
      var rank = 0.50 * (s.matchedProtein / maxProtein)
               + 0.25 * (1 - s.missing.length / maxMissing)
               + 0.15 * (s.matched / maxMatched)
               + 0.10 * (s.detail / maxDetail);
      s.parts.tiebreak = rank;
      s.total = Math.max(0, Math.min(1, s.total + TIEBREAK * rank));
    }
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
    COVERAGE_MIN: COVERAGE_MIN, PROTEIN_BONUS: PROTEIN_BONUS,
    recipeTitle: recipeTitle, normalizeTitleKey: normalizeTitleKey,
    titleSimilarity: titleSimilarity, titleContains: titleContains,
    titleHeadWord: titleHeadWord, capByHeadNoun: capByHeadNoun,
    dropNearDuplicates: dropNearDuplicates,
    dietaryFlags: dietaryFlags, pantryProteinFit: pantryProteinFit,
    COOLDOWN_DAYS: COOLDOWN_DAYS, isRejected: isRejected,
    daysSinceCooked: daysSinceCooked, cookedRecently: cookedRecently,
    dropRejected: dropRejected,
    detailScore: detailScore, matchedCount: matchedCount,
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
