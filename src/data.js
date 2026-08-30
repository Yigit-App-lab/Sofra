// The whole content library, bundled into the app binary. No network call, no API
// key, works with no signal at the market. Move to expo-sqlite past ~500 recipes.
import ingredients from '../assets/data/ingredients.json';
import recipes from '../assets/data/recipes.json';
import regions from '../assets/data/regions.json';

export const ING = ingredients.items;
export const REC = recipes.recipes;
export const REGIONS = regions.regions;
export const CITIES = regions.cities;

export const byId = {};
ING.forEach((i) => { byId[i.id] = i; });
export const recById = {};
REC.forEach((r) => { recById[r.id] = r; });

export function cityRec(name) {
  return CITIES.find((c) => c.name === name) || CITIES.find((c) => c.name === 'İstanbul');
}
