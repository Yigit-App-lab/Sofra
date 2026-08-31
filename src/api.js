export const API_URL = "http://129.121.89.248:8000";

export async function searchRecipes(
  query,
  limit = 30,
  diet = null,
  glutenFree = false,
  lactoseFree = false,
  lowGlycemic = false
) {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
  });

  if (diet && diet !== "standard") {
    params.set("diet", diet);
  }

  if (glutenFree) {
    params.set("gluten_free", "true");
  }

  if (lactoseFree) {
    params.set("lactose_free", "true");
  }

  if (lowGlycemic) {
    params.set("low_glycemic", "true");
  }

  const response = await fetch(
    `${API_URL}/recipes/search?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(`Recipe search failed: ${response.status}`);
  }

  return response.json();
}

export async function getRecipe(id) {
  const response = await fetch(`${API_URL}/recipes/${id}`);

  if (!response.ok) {
    throw new Error(`Recipe request failed: ${response.status}`);
  }

  return response.json();
}

export async function getCategories() {
  const response = await fetch(`${API_URL}/categories`);

  if (!response.ok) {
    throw new Error(`Category request failed: ${response.status}`);
  }

  return response.json();
}

export async function getRandomRecipes(limit = 10) {
  const response = await fetch(
    `${API_URL}/recipes/random?limit=${limit}`
  );

  if (!response.ok) {
    throw new Error(`Random recipe request failed: ${response.status}`);
  }

  return response.json();
}

export async function getRecipes({
  limit = 30,
  offset = 0,
  category = null,
  diet = null,
  glutenFree = false,
  lactoseFree = false,
  lowGlycemic = false,
} = {}) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  if (category) {
    params.set("category", category);
  }

  if (diet && diet !== "standard") {
    params.set("diet", diet);
  }

  if (glutenFree) {
    params.set("gluten_free", "true");
  }

  if (lactoseFree) {
    params.set("lactose_free", "true");
  }

  if (lowGlycemic) {
    params.set("low_glycemic", "true");
  }

  const response = await fetch(`${API_URL}/recipes?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Recipe catalogue request failed: ${response.status}`);
  }

  return response.json();
}

export async function getKilerIngredients(query = "", limit = 50) {
  const params = new URLSearchParams({
    limit: String(limit),
  });

  if (query.trim()) {
    params.set("q", query.trim());
  }

  const response = await fetch(
    `${API_URL}/kiler/ingredients?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(`Kiler request failed: ${response.status}`);
  }

  return response.json();
}

export async function getRecipesByKiler(kilerIds, limit = 30) {
  const response = await fetch(`${API_URL}/recipes/by-kiler`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      kiler_ids: kilerIds,
      limit,
    }),
  });

  if (!response.ok) {
    throw new Error(`Kiler recipe request failed: ${response.status}`);
  }

  return response.json();
}

export async function getTonightRecipes(
  kilerIds,
  {
    limit = 30,
    timeBudget = null,
  } = {}
) {
  const body = {
    kiler_ids: kilerIds,
    limit,
  };

  if (timeBudget != null) {
    body.time_budget = timeBudget;
  }

  const response = await fetch(`${API_URL}/recipes/tonight`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Tonight recipe request failed: ${response.status}`);
  }

  return response.json();
}
