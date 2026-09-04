/* ============================================================================
 * Sofra — API client.
 *
 * Every call goes through `request`, which gives it a deadline and turns the
 * failure into something a screen can act on. Without a deadline React Native
 * waits about a minute and then reports `TypeError: Network request failed` —
 * the same message a phone with no signal produces. A Kiler screen showed
 * "Tarif önerileri yüklenemedi" with no way to retry, and the request had in
 * fact never reached the server.
 *
 * `error.kind` is the useful part:
 *   'timeout' — we gave up waiting; the server may be slow or unreachable
 *   'offline' — the request could not be sent at all
 *   'http'    — the server answered, and refused
 * ==========================================================================*/
export const API_URL = "http://129.121.89.248:8000";

// `/recipes/tonight` measures about 6.5s on the server for twenty recipes, so
// the recipe deadline has to leave room for a slow phone network on top of it.
export const TIMEOUT = {
  quick: 15000,     // searches, ingredient lists, a single recipe
  recipes: 30000,   // the ranked endpoints, which query the whole library
  market: 35000,    // live price collection, which scrapes
};

function apiError(kind, message, status) {
  const error = new Error(message);
  error.kind = kind;
  if (status != null) error.status = status;
  return error;
}

/**
 * Which message belongs to this failure.
 * Returns an `i18n.js` key so no screen has to know about `error.kind`.
 */
export function apiErrorKey(error) {
  if (error && error.kind === 'timeout') return 'serverSlow';
  if (error && error.kind === 'offline') return 'noConnection';
  return 'serverError';
}

async function request(path, options) {
  const opts = options || {};
  const timeout = opts.timeout || TIMEOUT.quick;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: opts.method || 'GET',
      headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    // An aborted fetch and a dead network raise the same error. Only our own
    // timer knows which of the two actually happened.
    throw controller.signal.aborted
      ? apiError('timeout', `${path} gave up after ${timeout}ms`)
      : apiError('offline', `${path} could not be reached: ${e.message}`);
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    throw apiError('http', `${path} failed: ${response.status}`, response.status);
  }
  try {
    return await response.json();
  } catch (e) {
    throw apiError('http', `${path} returned a body that is not JSON`, response.status);
  }
}

function dietParams(params, { diet, glutenFree, lactoseFree, lowGlycemic, maxMinutes }) {
  if (diet && diet !== "standard") params.set("diet", diet);
  if (glutenFree) params.set("gluten_free", "true");
  if (lactoseFree) params.set("lactose_free", "true");
  if (lowGlycemic) params.set("low_glycemic", "true");
  if (maxMinutes != null) params.set("max_minutes", String(maxMinutes));
  return params;
}

export async function searchRecipes(
  query,
  limit = 30,
  diet = null,
  glutenFree = false,
  lactoseFree = false,
  lowGlycemic = false,
  maxMinutes = null
) {
  const params = dietParams(
    new URLSearchParams({ q: query, limit: String(limit) }),
    { diet, glutenFree, lactoseFree, lowGlycemic, maxMinutes }
  );
  return request(`/recipes/search?${params.toString()}`);
}

export async function getRecipe(id) {
  return request(`/recipes/${id}`);
}

export async function getCategories() {
  return request('/categories');
}

export async function getRandomRecipes(limit = 10) {
  return request(`/recipes/random?limit=${limit}`);
}

export async function getRecipes({
  limit = 30,
  offset = 0,
  category = null,
  diet = null,
  glutenFree = false,
  lactoseFree = false,
  lowGlycemic = false,
  maxMinutes = null,
} = {}) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (category) params.set("category", category);
  dietParams(params, { diet, glutenFree, lactoseFree, lowGlycemic, maxMinutes });
  return request(`/recipes?${params.toString()}`, { timeout: TIMEOUT.recipes });
}

export async function getKilerIngredients(query = "", limit = 50) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (query.trim()) params.set("q", query.trim());
  return request(`/kiler/ingredients?${params.toString()}`);
}

export async function getRecipesByKiler(kilerIds, limit = 30) {
  return request('/recipes/by-kiler', {
    method: 'POST',
    timeout: TIMEOUT.recipes,
    body: { kiler_ids: kilerIds, limit },
  });
}

export async function getSeasonalRecipes({
  month,
  region,
  city,
  limit = 3,
  timeBudget = null,
  diet = null,
  glutenFree = false,
  lactoseFree = false,
  lowGlycemic = false,
}) {
  return request('/recipes/seasonal', {
    method: 'POST',
    timeout: TIMEOUT.recipes,
    body: {
      month,
      region,
      city,
      limit,
      time_budget: timeBudget,
      diet,
      gluten_free: glutenFree,
      lactose_free: lactoseFree,
      low_glycemic: lowGlycemic,
    },
  });
}

export async function getTonightRecipes(
  kilerIds,
  {
    limit = 30,
    timeBudget = null,
    city = 'İstanbul',
    meatless = false,
    diet = null,
    glutenFree = false,
    lactoseFree = false,
    lowGlycemic = false,
  } = {}
) {
  const body = {
    kiler_ids: kilerIds,
    limit,
    city,
    meatless,
    diet,
    gluten_free: glutenFree,
    lactose_free: lactoseFree,
    low_glycemic: lowGlycemic,
  };
  if (timeBudget != null) body.time_budget = timeBudget;
  return request('/recipes/tonight', {
    method: 'POST',
    timeout: TIMEOUT.recipes,
    body,
  });
}

export async function getMarketPrices(city, items) {
  return request('/market/prices', {
    method: 'POST',
    timeout: TIMEOUT.market,
    body: { city, items },
  });
}
