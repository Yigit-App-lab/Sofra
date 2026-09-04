import fs from 'node:fs/promises';
import path from 'node:path';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const inputPath = process.argv[2];
const outputPath = process.argv[3];
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
const sheet = workbook.worksheets.getItemAt(0);
const used = sheet.getUsedRange(true);
const values = used.values;
const headers = values[0].map(String);
const ix = Object.fromEntries(headers.map((name, index) => [name, index]));
const rows = values.slice(1);

const tr = value => String(value ?? '').toLocaleLowerCase('tr-TR');
const parsePeople = value => {
  const text = tr(value).trim();
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(?:kişi|kisi)/);
  if (match) return Number(match[1].replace(',', '.'));
  if (/^\d+(?:[.,]\d+)?$/.test(text)) return Number(text.replace(',', '.'));
  return null;
};
const addNote = (row, note) => {
  const old = String(row[ix.expert_note] ?? '').trim();
  if (!old) row[ix.expert_note] = note;
  else if (!old.includes(note)) row[ix.expert_note] = `${old} | ${note}`;
};
const markReview = (row, note) => {
  addNote(row, note);
  row[ix.review_status] = 'needs_review';
};

const servingsByRecipe = new Map();
for (const row of rows) {
  const id = String(row[ix.recipe_id]);
  const raw = row[ix.reviewed_servings];
  if (raw == null || raw === '') continue;
  const parsed = parsePeople(raw);
  if (!servingsByRecipe.has(id)) servingsByRecipe.set(id, new Set());
  if (parsed != null) servingsByRecipe.get(id).add(parsed);
}
const conflictingRecipes = new Set(
  [...servingsByRecipe.entries()].filter(([, counts]) => counts.size > 1).map(([id]) => id),
);

const safeFindings = new Map([
  ['15177|domates puresi', { quantity: 1, unit: 'su bardağı', evidence: 'Hazırlanış: “1 bardak domates püresi”' }],
  ['21423|sarimsak', { quantity: 2, unit: 'diş', evidence: 'Hazırlanış: “2 diş sarımsak”' }],
  ['2287|tereyag', { quantity: 2, unit: 'yemek kaşığı', evidence: 'Hazırlanış: “2 yemek kaşığı tereyağ”' }],
  ['2852|tereyagi', { quantity: 2, unit: 'yemek kaşığı', evidence: 'Hazırlanış: “2 yemek kaşığı tereyağı”' }],
  ['14199|tereyag', { quantity: 2, unit: 'yemek kaşığı', evidence: 'Hazırlanış: “2 yemek kaşığı tereyağ”' }],
  ['20310|tereyag', { quantity: 2, unit: 'yemek kaşığı', evidence: 'Hazırlanış: “2 yemek kaşığı tereyağ”' }],
  ['16462|pirinc', { quantity: 2, unit: 'kase', evidence: 'Özgün metin: “Pirinç (ben iki kase kullandım)”' }],
]);

let normalizedServings = 0;
let clearedServingConflicts = 0;
let sourceAmountsAdded = 0;
let flaggedRows = 0;

for (const row of rows) {
  const id = String(row[ix.recipe_id]);
  const parsed = parsePeople(row[ix.reviewed_servings]);
  const knownCounts = servingsByRecipe.get(id);

  if (conflictingRecipes.has(id)) {
    row[ix.reviewed_servings] = null;
    markReview(row, 'PORSİYON ÇELİŞKİSİ: Aynı tarif için farklı kişi sayıları girilmiş; uzman doğrulaması gerekli.');
    clearedServingConflicts += 1;
  } else if (knownCounts?.size === 1) {
    const normalized = [...knownCounts][0];
    if (row[ix.reviewed_servings] !== normalized) normalizedServings += 1;
    row[ix.reviewed_servings] = normalized;
  } else if (row[ix.reviewed_servings] != null && row[ix.reviewed_servings] !== '' && parsed == null) {
    row[ix.reviewed_servings] = null;
    markReview(row, 'PORSİYON DEĞİL: Girilen değer kişi sayısı yerine dilim/adet verimi gösteriyor.');
  }

  const ingredient = tr(row[ix.ingredient_name]);
  const unit = tr(row[ix.reviewed_unit]);
  const original = tr(row[ix.original_text]);
  const rawQuantity = row[ix.reviewed_quantity];
  const hasQuantity = rawQuantity != null && rawQuantity !== '';
  const quantity = Number(rawQuantity);
  const people = parsePeople(row[ix.reviewed_servings]);

  if (hasQuantity && Number.isFinite(quantity)) {
    if (ingredient.includes('yumurta') && unit.includes('adet') && quantity > 4) {
      markReview(row, 'YÜKSEK YUMURTA MİKTARI: Porsiyon/adet sayısından kopyalanmış olabilir.');
    }
    if (ingredient.includes('sucuk') && unit.includes('gram') && people === 1 && quantity > 150) {
      markReview(row, 'YÜKSEK SUCUK MİKTARI: Tek kişilik tarif için miktarı doğrulayın.');
    }
    if (/isteğe|istersen|arzuya|yeteri|biraz/.test(original)) {
      markReview(row, 'UZMAN TAHMİNİ: Özgün tarif miktarı isteğe bağlı veya belirsiz.');
    }
  }

  const ingredientKey = ingredient
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, ' ').trim();
  const found = safeFindings.get(`${id}|${ingredientKey}`);
  if (found && !hasQuantity) {
    row[ix.reviewed_quantity] = found.quantity;
    row[ix.reviewed_unit] = found.unit;
    addNote(row, `KAYNAKTAN BULUNDU — ${found.evidence}`);
    if (row[ix.review_status] !== 'needs_review') row[ix.review_status] = 'source_found';
    sourceAmountsAdded += 1;
  }

  if (id === '88') markReview(row, 'ADET BAŞINA MİKTAR: Toplam miktar için tarifin kaç adet çıkardığı doğrulanmalı.');
  if (id === '405') markReview(row, 'İÇERİK UYUŞMAZLIĞI: Limon ile limon suyu aynı miktar kabul edilmeden önce doğrulanmalı.');
  if (id === '642') markReview(row, 'ADET BAŞINA MİKTAR: Her pide için verilen miktar toplam pide sayısına göre hesaplanmalı.');
}

for (const row of rows) if (row[ix.review_status] === 'needs_review') flaggedRows += 1;

sheet.getRangeByIndexes(1, 0, rows.length, headers.length).values = rows;
sheet.getRange(`E2:E${rows.length + 1}`).format.numberFormat = '0.##';
sheet.getRange(`N2:N${rows.length + 1}`).format.numberFormat = '0.##';
sheet.getRange(`P2:P${rows.length + 1}`).format.wrapText = true;
sheet.getRange('P1').format.columnWidth = 55;
sheet.getRange('Q1').format.columnWidth = 16;

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await SpreadsheetFile.exportXlsx(workbook).then(blob => blob.save(outputPath));
console.log(JSON.stringify({
  outputPath,
  rows: rows.length,
  conflictingRecipes: conflictingRecipes.size,
  clearedServingConflicts,
  normalizedServings,
  sourceAmountsAdded,
  flaggedRows,
}, null, 2));
