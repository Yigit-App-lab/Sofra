import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(process.argv[2]));
const sheet = workbook.worksheets.getItemAt(0);
const values = sheet.getUsedRange(true).values;
const headers = values[0].map(String);
const ix = Object.fromEntries(headers.map((name, index) => [name, index]));
const rows = values.slice(1);
const errors = [];
const sourceRows = [];
const conflictIds = new Set();
for (let i = 0; i < rows.length; i += 1) {
  const row = rows[i];
  for (let j = 0; j < row.length; j += 1) {
    if (typeof row[j] === 'string' && /^#(?:REF!|DIV\/0!|VALUE!|NAME\?|N\/A)$/.test(row[j])) {
      errors.push({ row: i + 2, column: j + 1, value: row[j] });
    }
  }
  if (row[ix.review_status] === 'source_found') sourceRows.push({
    row: i + 2, recipe_id: row[ix.recipe_id], ingredient: row[ix.ingredient_name],
    quantity: row[ix.reviewed_quantity], unit: row[ix.reviewed_unit], note: row[ix.expert_note],
  });
  if (String(row[ix.expert_note] ?? '').includes('PORSİYON ÇELİŞKİSİ')) conflictIds.add(row[ix.recipe_id]);
}
console.log(JSON.stringify({
  range: sheet.getUsedRange(true).address,
  formulaErrors: errors,
  sourceRows,
  conflictingRecipeCount: conflictIds.size,
  needsReviewCount: rows.filter(r => r[ix.review_status] === 'needs_review').length,
}, null, 2));
