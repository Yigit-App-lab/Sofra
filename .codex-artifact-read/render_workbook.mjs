import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(process.argv[2]));
const sheet = workbook.worksheets.getItemAt(0);
const preview = await workbook.render({
  sheetName: sheet.name,
  range: process.argv[4] || 'A1:Q18',
  scale: 1,
  format: 'png',
});
await fs.writeFile(process.argv[3], new Uint8Array(await preview.arrayBuffer()));
