/* ============================================================================
 * Sofra — one shape for a dinner suggestion.
 *
 * "Bu akşam ne pişirelim?" offers three ways to answer the same question, and
 * they used to answer it in three different formats: the bundled ranker returns
 * a scored recipe with a local cost object, `/recipes/seasonal` and
 * `/recipes/tonight` return database rows with `cost_per_portion` and coverage.
 * Each was rendered by its own block of JSX, so the same dinner could show a
 * price in one method and a dash in another, with different labels either way.
 *
 * Everything is normalised here instead, and one card renders the result. Pure
 * functions and the same module style as `engine.js`, so this file runs under
 * `node` for the tests as well as in the app.
 * ==========================================================================*/
(function (root) {
  'use strict';

  var Engine = (typeof require === 'function')
    ? require('./engine')
    : root.SofraEngine;

  // The API publishes a cost only above this coverage; the bundled engine now
  // applies the same rule in `costOf`. Kept here as a guard for older API
  // responses that predate `cost_unavailable_reason`.
  var COVERAGE_MIN = Engine.COVERAGE_MIN || 0.70;

  function number(value) {
    var n = Number(value);
    return isFinite(n) ? n : null;
  }

  /** A suggestion produced by the bundled ranker (`Engine.recommend`). */
  function fromLocal(scored, options) {
    var opts = options || {};
    var recipe = scored.recipe;
    var cost = scored.cost || {};
    return {
      key: 'local:' + recipe.id,
      source: 'local',
      id: recipe.id,
      route: '/tarif/' + recipe.id,
      title: Engine.recipeTitle(recipe, opts.english),
      category: recipe.category || null,
      minutes: number(recipe.minutes),
      servings: cost.servings || recipe.servings || 2,
      costTrusted: cost.trusted !== false && number(cost.perPortion) != null,
      perPortion: number(cost.perPortion),
      total: number(cost.total),
      coverage: cost.coverage == null ? 1 : cost.coverage,
      costReason: cost.unavailableReason || null,
      matchedCount: scored.matched || 0,
      missingCount: scored.missing ? scored.missing.length : null,
      ready: scored.missing ? scored.missing.length === 0 : null,
      matchPercent: null,
      seasonalCount: null,
      seasonalIngredients: null,
      hero: recipe.hero || null,
      recipe: recipe
    };
  }

  /** A suggestion produced by `/recipes/seasonal` or `/recipes/tonight`. */
  function fromApi(row, options) {
    var opts = options || {};
    var perPortion = number(row.cost_per_portion);
    var coverage = row.cost_coverage == null ? 0 : Number(row.cost_coverage);
    var seasonal = row.seasonal_ingredients || null;
    if (typeof seasonal === 'string') seasonal = seasonal.split(',');
    if (seasonal) {
      seasonal = seasonal
        .map(function (name) { return String(name || '').trim(); })
        .filter(function (name) { return name.length > 0; });
    }
    return {
      key: 'api:' + row.id,
      source: 'api',
      id: row.id,
      route: '/api-tarif/' + row.id,
      title: Engine.recipeTitle(row, opts.english),
      category: row.category || null,
      minutes: number(row.total_minutes),
      servings: row.cost_servings || row.servings || 2,
      costTrusted: perPortion != null && coverage >= COVERAGE_MIN,
      perPortion: perPortion,
      total: number(row.cost_total),
      coverage: coverage,
      costReason: row.cost_unavailable_reason || null,
      matchedCount: row.matched_count == null ? 0 : row.matched_count,
      missingCount: row.missing_count == null ? null : row.missing_count,
      ready: row.missing_count == null ? null : row.missing_count === 0,
      matchPercent: number(row.match_percent),
      seasonalCount: row.seasonal_count == null ? null : row.seasonal_count,
      seasonalIngredients: seasonal,
      hero: null,
      recipe: row
    };
  }

  /**
   * Normalise, drop near-duplicates, and cut to `limit`.
   *
   * The API library holds several imports of the same dish, and three of them
   * in a three-card answer reads as a broken app. Local results are deduped by
   * `Engine.recommend`, but running it here as well is harmless and keeps the
   * rule in one place.
   */
  function normalize(items, options) {
    var opts = options || {};
    var list = [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      list.push(item && item.recipe && item.cost
        ? fromLocal(item, opts)
        : fromApi(item, opts));
    }
    list = Engine.dropNearDuplicates(list,
      function (s) { return s.title; },
      function (s) { return s.category; });
    return opts.limit ? list.slice(0, opts.limit) : list;
  }

  /**
   * The one line under the title that says why this dish was offered.
   * `t` is the translator from `i18n.js`; `mode` is 'random' | 'seasonal' | 'kiler'.
   * No literal Turkish or English lives in this file — same rule as the screens.
   */
  function reasonFor(suggestion, mode, t) {
    if (mode === 'seasonal') {
      var names = (suggestion.seasonalIngredients || []).slice(0, 4).join(', ');
      if (!names) return t('inSeasonNow');
      return t('seasonalIngredients') + ': ' + names;
    }
    if (mode === 'kiler') return t('matchedWith', suggestion.matchedCount || 0);
    return t('chosenForYou');
  }

  var MODE_HEADING = {
    random: 'tonightChoice',
    seasonal: 'seasonalChoice',
    kiler: 'pantryChoice'
  };

  function headingFor(mode) {
    return MODE_HEADING[mode] || MODE_HEADING.random;
  }

  var api = {
    COVERAGE_MIN: COVERAGE_MIN,
    fromLocal: fromLocal,
    fromApi: fromApi,
    normalize: normalize,
    reasonFor: reasonFor,
    headingFor: headingFor
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SofraSuggestions = api;
})(typeof self !== 'undefined' ? self : this);
