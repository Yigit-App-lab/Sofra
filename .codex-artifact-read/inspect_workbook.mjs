import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const inputPath = process.argv[2];
const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);
const overview = await workbook.inspect({
  kind: 'workbook,sheet,table',
  maxChars: 8000,
  tableMaxRows: 8,
  tableMaxCols: 18,
  tableMaxCellChars: 160,
});
console.log(overview.ndjson);
const sheet = workbook.worksheets.getItemAt(0);
const used = sheet.getUsedRange(true);
console.log(JSON.stringify({ sheet: sheet.name, address: used.address, rows: used.rowCount, columns: used.columnCount }));
const sample = await workbook.inspect({
  kind: 'table',
  sheetId: sheet.name,
  range: used.address,
  include: 'values,formulas',
  tableMaxRows: 120,
  tableMaxCols: 18,
  tableMaxCellChars: 600,
  maxChars: 50000,
});
console.log(sample.ndjson);

const values = used.values;
const headers = values[0].map(String);
const ix = Object.fromEntries(headers.map((name, index) => [name, index]));
const rows = values.slice(1);
const filled = rows.filter(row =>
  row[ix.reviewed_quantity] != null || row[ix.reviewed_unit] != null ||
  row[ix.reviewed_servings] != null || row[ix.expert_note] != null ||
  (row[ix.review_status] != null && String(row[ix.review_status]).toLowerCase() !== 'pending')
);
console.log(JSON.stringify({
  totals: {
    dataRows: rows.length,
    reviewedRows: filled.length,
    reviewedQuantity: rows.filter(r => r[ix.reviewed_quantity] != null).length,
    reviewedServings: rows.filter(r => r[ix.reviewed_servings] != null).length,
    notes: rows.filter(r => r[ix.expert_note] != null).length,
    approved: rows.filter(r => String(r[ix.review_status] || '').toLowerCase() === 'approved').length,
  },
  filled: filled.map((r, n) => ({
    excelRow: rows.indexOf(r) + 2,
    recipeId: r[ix.recipe_id], title: r[ix.recipe_title], ingredient: r[ix.ingredient_name],
    original: r[ix.original_text], servings: r[ix.recipe_servings],
    reviewedServings: r[ix.reviewed_servings], quantity: r[ix.reviewed_quantity],
    unit: r[ix.reviewed_unit], note: r[ix.expert_note], status: r[ix.review_status],
  })),
}, null, 2));

const candidateRows = [];
for (let n = 0; n < rows.length; n += 1) {
  const r = rows[n];
  if (r[ix.reviewed_quantity] != null) continue;
  const ingredient = String(r[ix.ingredient_name] || '').toLocaleLowerCase('tr-TR');
  const base = ingredient.split(/[;,(/]/)[0].trim().split(/\s+/).filter(w => w.length >= 4).pop();
  const instructions = String(r[ix.instructions] || '');
  if (!base || !instructions.toLocaleLowerCase('tr-TR').includes(base)) continue;
  const lower = instructions.toLocaleLowerCase('tr-TR');
  const pos = lower.indexOf(base);
  const snippet = instructions.slice(Math.max(0, pos - 90), Math.min(instructions.length, pos + base.length + 110)).replace(/\s+/g, ' ');
  if (!/\b(?:\d+(?:[.,/]\d+)?|yarım|yarim|çeyrek|ceyrek|bir|iki|üç|uc|dört|dort)\b/i.test(snippet)) continue;
  candidateRows.push({ excelRow:n + 2, recipeId:r[ix.recipe_id], title:r[ix.recipe_title], ingredient:r[ix.ingredient_name], original:r[ix.original_text], snippet });
}
console.log(JSON.stringify({ instructionCandidates: candidateRows.slice(0, 120), candidateCount:candidateRows.length }, null, 2));
