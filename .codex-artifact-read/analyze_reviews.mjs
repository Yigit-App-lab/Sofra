import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(process.argv[2]));
const sheet = workbook.worksheets.getItemAt(0);
const values = sheet.getUsedRange(true).values;
const headers = values[0].map(String);
const ix = Object.fromEntries(headers.map((name, index) => [name, index]));
const rows = values.slice(1);

const tr = value => String(value || '').toLocaleLowerCase('tr-TR');
const people = value => {
  const text = tr(value);
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(?:kişi|kisi)/);
  if (match) return Number(match[1].replace(',', '.'));
  return /^\s*\d+(?:[.,]\d+)?\s*$/.test(text) ? Number(text.replace(',', '.')) : null;
};
const issues = [];
const servingsByRecipe = new Map();
for (let n = 0; n < rows.length; n += 1) {
  const r = rows[n];
  const row = n + 2;
  const reviewedServings = r[ix.reviewed_servings];
  const rawReviewedQuantity = r[ix.reviewed_quantity];
  const hasReviewedQuantity = rawReviewedQuantity != null && rawReviewedQuantity !== '';
  const reviewedQuantity = Number(rawReviewedQuantity);
  const ingredient = tr(r[ix.ingredient_name]);
  const unit = tr(r[ix.reviewed_unit]);
  const original = tr(r[ix.original_text]);
  const parsedPeople = people(reviewedServings);
  if (reviewedServings != null && parsedPeople == null) {
    issues.push({row, recipeId:r[ix.recipe_id], title:r[ix.recipe_title], field:'reviewed_servings', value:reviewedServings, issue:'Kişi sayısı açık değil'});
  }
  if (parsedPeople != null) {
    const id = String(r[ix.recipe_id]);
    const seen = servingsByRecipe.get(id);
    if (seen != null && seen !== parsedPeople) {
      issues.push({row, recipeId:r[ix.recipe_id], title:r[ix.recipe_title], field:'reviewed_servings', value:reviewedServings, issue:`Aynı tarifte farklı kişi sayısı (${seen} / ${parsedPeople})`});
    } else servingsByRecipe.set(id, parsedPeople);
  }
  if (hasReviewedQuantity && Number.isFinite(reviewedQuantity)) {
    if (ingredient.includes('yumurta') && unit.includes('adet') && reviewedQuantity > 4) {
      issues.push({row, recipeId:r[ix.recipe_id], title:r[ix.recipe_title], field:'reviewed_quantity', value:`${reviewedQuantity} ${unit}`, issue:'Yumurta miktarı yüksek; porsiyon sayısından kopyalanmış olabilir'});
    }
    if (ingredient.includes('sucuk') && unit.includes('gram') && parsedPeople === 1 && reviewedQuantity > 150) {
      issues.push({row, recipeId:r[ix.recipe_id], title:r[ix.recipe_title], field:'reviewed_quantity', value:`${reviewedQuantity} ${unit}`, issue:'Tek kişilik tarif için sucuk miktarı yüksek'});
    }
    if (/isteğe|istersen|arzuya|yeteri|biraz/.test(original)) {
      issues.push({row, recipeId:r[ix.recipe_id], title:r[ix.recipe_title], field:'reviewed_quantity', value:`${reviewedQuantity} ${unit}`, issue:'Özgün tarif miktarı isteğe bağlı/belirsiz; değer uzman tahmini olarak işaretlenmeli'});
    }
  }
}

const numberWords = '(?:\\d+(?:[.,/]\\d+)?|yarım|yarim|çeyrek|ceyrek|bir|iki|üç|uc|dört|dort|beş|bes|altı|alti)';
const units = '(?:adet|tane|gram|gr|kg|kilo|paket|dilim|diş|dis|kase|bardak|yemek kaşığı|yemek kasigi|çay kaşığı|cay kasigi)';
const candidates = [];
for (let n = 0; n < rows.length; n += 1) {
  const r = rows[n];
  if (r[ix.reviewed_quantity] != null) continue;
  const ingredient = tr(r[ix.ingredient_name]);
  const words = ingredient.split(/[^a-zçğıöşü]+/i).filter(w => w.length >= 4);
  const key = words.at(-1);
  if (!key) continue;
  const instructions = String(r[ix.instructions] || '').replace(/&\w+;/g, ' ');
  const pattern = new RegExp(`(${numberWords})\\s+(${units})\\s+(?:\\w+\\s+){0,3}${key}`, 'i');
  const match = instructions.match(pattern);
  if (!match) continue;
  const pos = match.index || 0;
  candidates.push({
    row:n + 2, recipeId:r[ix.recipe_id], title:r[ix.recipe_title], ingredient:r[ix.ingredient_name],
    proposedQuantity:match[1], proposedUnit:match[2], evidence:instructions.slice(Math.max(0, pos - 45), pos + match[0].length + 70).replace(/\s+/g, ' '),
  });
}

const issueTypes = {};
for (const item of issues) issueTypes[item.issue] = (issueTypes[item.issue] || 0) + 1;
const conflictingRecipes = [...new Map(
  issues.filter(item => item.issue.startsWith('Aynı tarifte farklı'))
    .map(item => [item.recipeId, {recipeId:item.recipeId, title:item.title}])
).values()];
console.log(JSON.stringify({issueCount:issues.length, issueTypes, conflictingRecipes, candidateCount:candidates.length}, null, 2));
console.log(JSON.stringify({issues, candidates}, null, 2));
