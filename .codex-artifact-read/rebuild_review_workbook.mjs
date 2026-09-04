import fs from 'node:fs/promises';
import path from 'node:path';
import { FileBlob, SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const inputPath = process.argv[2];
const outputPath = process.argv[3];
const csvPath = process.argv[4];
const source = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
const sourceSheet = source.worksheets.getItemAt(0);
const values = sourceSheet.getUsedRange(true).values;
const headers = values[0].map(String);
const ix = Object.fromEntries(headers.map((name, index) => [name, index]));
const rows = values.slice(1);

const tr = value => String(value ?? '').toLocaleLowerCase('tr-TR');
const parsePeople = value => {
  const text = tr(value).trim();
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(?:kişi|kisi)/);
  if (match) return Number(match[1].replace(',', '.'));
  return /^\d+(?:[.,]\d+)?$/.test(text) ? Number(text.replace(',', '.')) : null;
};
const appendNote = (row, note) => {
  const old = String(row[ix.expert_note] ?? '').trim();
  row[ix.expert_note] = old && !old.includes(note) ? `${old} | ${note}` : (old || note);
};
const has = value => value != null && String(value).trim() !== '';

const servingsByRecipe = new Map();
const invalidServingRecipes = new Set();
for (const row of rows) {
  const id = String(row[ix.recipe_id]);
  const raw = row[ix.reviewed_servings];
  if (!has(raw)) continue;
  const parsed = parsePeople(raw);
  if (parsed == null) invalidServingRecipes.add(id);
  else {
    if (!servingsByRecipe.has(id)) servingsByRecipe.set(id, new Set());
    servingsByRecipe.get(id).add(parsed);
  }
}
const conflictingRecipes = new Set([
  ...[...servingsByRecipe.entries()].filter(([, counts]) => counts.size > 1).map(([id]) => id),
  ...invalidServingRecipes,
]);

const manualReviewRecipes = new Map([
  ['88', 'Toplam miktar, tarifin kaç adet ürün çıkardığına bağlı.'],
  ['405', 'Limon ile limon suyu miktarının eşdeğerliği doğrulanmalı.'],
  ['642', 'Her pide için verilen miktar, toplam pide sayısına çevrilmeli.'],
]);

const unresolved = [];
const accepted = [];
for (const originalRow of rows) {
  const row = [...originalRow];
  const id = String(row[ix.recipe_id]);
  const quantityReady = has(row[ix.reviewed_quantity]) && has(row[ix.reviewed_unit]);
  const needsReview = !quantityReady || conflictingRecipes.has(id) || manualReviewRecipes.has(id);

  if (conflictingRecipes.has(id)) {
    appendNote(row, invalidServingRecipes.has(id)
      ? 'KİŞİ SAYISI GEREKLİ: Girilen değer dilim/adet verimi gösteriyor.'
      : 'KİŞİ SAYISI KONTROLÜ: Aynı tarif için farklı kişi sayıları girilmiş.');
  }
  if (manualReviewRecipes.has(id)) appendNote(row, manualReviewRecipes.get(id));

  if (needsReview) {
    row[ix.review_status] = 'needs_review';
    unresolved.push(row);
  } else {
    const parsed = parsePeople(row[ix.reviewed_servings]);
    accepted.push({
      ingredient_rowid: row[ix.ingredient_rowid],
      recipe_id: row[ix.recipe_id],
      reviewed_quantity: row[ix.reviewed_quantity],
      reviewed_unit: row[ix.reviewed_unit],
      reviewed_servings: parsed ?? '',
      expert_note: row[ix.expert_note] ?? '',
    });
  }
}

const workbook = Workbook.create();
const sheet = workbook.worksheets.add('inceleme_gerekenler');
sheet.getRangeByIndexes(0, 0, unresolved.length + 1, headers.length).values = [headers, ...unresolved];
sheet.tables.add(`A1:Q${unresolved.length + 1}`, true, 'ReviewNeededTable');
sheet.freezePanes.freezeRows(1);
sheet.getRange('A1:Q1').format = {
  fill: '#6F4E37', font: { bold: true, color: '#FFFFFF' }, wrapText: true,
};
sheet.getRange(`A2:Q${unresolved.length + 1}`).format.verticalAlignment = 'top';
sheet.getRange(`J2:K${unresolved.length + 1}`).format.wrapText = true;
sheet.getRange(`P2:P${unresolved.length + 1}`).format.wrapText = true;
const widths = [18,10,28,12,15,14,22,18,25,42,52,14,12,16,14,42,16];
for (let col = 0; col < widths.length; col += 1) sheet.getCell(0, col).format.columnWidth = widths[col];
sheet.getRange(`D2:F${unresolved.length + 1}`).format.numberFormat = '0.##';
sheet.getRange(`L2:N${unresolved.length + 1}`).format.numberFormat = '0.##';

const escapeCsv = value => {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const csvHeaders = ['ingredient_rowid','recipe_id','reviewed_quantity','reviewed_unit','reviewed_servings','expert_note'];
const csv = [csvHeaders.join(','), ...accepted.map(row => csvHeaders.map(h => escapeCsv(row[h])).join(','))].join('\r\n');

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await SpreadsheetFile.exportXlsx(workbook).then(blob => blob.save(outputPath));
await fs.writeFile(csvPath, `\uFEFF${csv}`, 'utf8');
console.log(JSON.stringify({
  inputRows: rows.length,
  unresolvedRows: unresolved.length,
  acceptedRows: accepted.length,
  conflictingRecipeCount: conflictingRecipes.size,
  outputPath,
  csvPath,
}, null, 2));
