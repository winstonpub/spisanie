const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createCatalogServer, SPREADSHEET_ID } = require('./catalog-server.cjs');

function operation(sku = '00000999', gid = 0, suffix = 'one') {
  return { spreadsheetId: SPREADSHEET_ID, gid, sku, operationId: `catalog-operation-${suffix}` };
}

test('A, B and C are saved in the same appended row, preserving other data', () => {
  const server = createCatalogServer({ 0: [['old', 'code', 'name'], [], ['', 'orphan'], ['', '', '', 'keep D']] });
  const op = operation();
  const begin = server.post({ ...op, cmd: 'product.begin' });
  assert.equal(begin.ok, true);
  assert.equal(begin.row, 4);
  assert.deepEqual(server.sheets.get(0).data[3], ['00000999', '', '', 'keep D']);
  const barcode = server.post({ ...op, cmd: 'product.barcode', barcode: '0001234567895' });
  assert.equal(barcode.row, 4);
  assert.equal(barcode.product.barcode, '0001234567895');
  const complete = server.post({ ...op, cmd: 'product.name', name: '=literal product text' });
  assert.equal(complete.status, 'complete');
  assert.equal(complete.version, 3);
  assert.deepEqual(server.sheets.get(0).data[3], ['00000999', '0001234567895', '=literal product text', 'keep D']);
  assert.equal(server.sheets.get(0).formats.get('4:1'), '@');
  assert.equal(server.sheets.get(0).formats.get('4:2'), '@');
  assert.deepEqual(server.sheets.get(0).data[0], ['old', 'code', 'name']);
  assert.equal(server.sheets.get(1557440748).getLastRow(), 1);
});

test('retries and completed duplicate SKUs never append duplicate rows', () => {
  const server = createCatalogServer();
  const op = operation();
  for (let i = 0; i < 2; i++) assert.equal(server.post({ ...op, cmd: 'product.begin' }).row, 2);
  for (let i = 0; i < 2; i++) assert.equal(server.post({ ...op, cmd: 'product.barcode', barcode: 'ABC123' }).ok, true);
  for (let i = 0; i < 2; i++) assert.equal(server.post({ ...op, cmd: 'product.name', name: 'New item' }).status, 'complete');
  const duplicate = server.post({ ...operation('00000999', 0, 'two'), cmd: 'product.begin' });
  assert.equal(duplicate.exists, true);
  assert.equal(duplicate.row, 2);
  assert.equal(server.sheets.get(0).getLastRow(), 2);
});

test('joinery commands target the joinery catalog, not the write-off list', () => {
  const server = createCatalogServer();
  const op = operation('JOIN-NEW', 1557440748);
  assert.equal(server.post({ ...op, cmd: 'product.begin' }).row, 2);
  server.post({ ...op, cmd: 'product.barcode', barcode: 'ABC123' });
  assert.equal(server.post({ ...op, cmd: 'product.name', name: 'Joinery item' }).ok, true);
  assert.deepEqual(server.sheets.get(1557440748).data[1], ['JOIN-NEW', 'ABC123', 'Joinery item']);
  assert.equal(server.sheets.get(0).getLastRow(), 1);
  assert.equal(server.sheets.get(317840889).getLastRow(), 0);
});

test('cancel removes only the owned incomplete A:C row and is repeatable', () => {
  const server = createCatalogServer();
  const op = operation();
  server.post({ ...op, cmd: 'product.begin' });
  server.post({ ...op, cmd: 'product.barcode', barcode: 'ABC' });
  server.sheets.get(0).data[1][3] = 'unrelated cell';
  assert.equal(server.post({ ...op, cmd: 'product.cancel' }).status, 'cancelled');
  assert.equal(server.post({ ...op, cmd: 'product.cancel' }).status, 'cancelled');
  assert.deepEqual(server.sheets.get(0).data[1], ['', '', '', 'unrelated cell']);
  assert.equal(server.post({ ...op, cmd: 'product.begin' }).ok, false);
  const other = operation('never-created', 0, 'cancel-first');
  server.post({ ...other, cmd: 'product.cancel' });
  assert.equal(server.post({ ...other, cmd: 'product.begin' }).ok, false);
});

test('cancel cannot remove completed items or drafts edited by someone else', () => {
  const server = createCatalogServer();
  const op = operation();
  server.post({ ...op, cmd: 'product.begin' });
  server.sheets.get(0).data[1][2] = 'manual edit';
  assert.equal(server.post({ ...op, cmd: 'product.cancel' }).ok, false);
  assert.equal(server.sheets.get(0).data[1][2], 'manual edit');
  const complete = operation('another-item', 0, 'complete');
  server.post({ ...complete, cmd: 'product.begin' });
  server.post({ ...complete, cmd: 'product.barcode', barcode: 'ABC' });
  server.post({ ...complete, cmd: 'product.name', name: 'Completed item' });
  assert.equal(server.post({ ...complete, cmd: 'product.cancel' }).status, 'complete');
  assert.equal(server.sheets.get(0).data[2][2], 'Completed item');
});

test('SKU lookup still locates the correct row after sorting', () => {
  const server = createCatalogServer();
  const op = operation();
  server.post({ ...op, cmd: 'product.begin' });
  server.sheets.get(0).data.reverse();
  const response = server.post({ ...op, cmd: 'product.barcode', barcode: 'ABC' });
  assert.equal(response.row, 1);
  assert.equal(server.sheets.get(0).data[0][1], 'ABC');
  assert.equal(server.sheets.get(0).data[1][1], '4620747181525');
});

test('invalid input, foreign targets and duplicate unfinished SKUs are rejected', () => {
  const server = createCatalogServer();
  const op = operation();
  assert.equal(server.post({ ...op, cmd: 'product.name', name: 'Early' }).ok, false);
  assert.equal(server.post({ ...op, cmd: 'product.begin', spreadsheetId: 'not-authorized' }).ok, false);
  assert.equal(server.post({ ...op, cmd: 'product.begin', gid: 1410594629 }).ok, false);
  assert.equal(server.post({ ...op, cmd: 'product.begin', sku: '  ' }).ok, false);
  assert.equal(server.post({ ...op, cmd: 'product.begin', operationId: 'short' }).ok, false);
  server.post({ ...op, cmd: 'product.begin' });
  assert.equal(server.post({ ...operation('00000999', 0, 'other'), cmd: 'product.begin' }).ok, false);
  assert.equal(server.post({ ...op, cmd: 'product.barcode', barcode: ' ' }).ok, false);
  assert.equal(server.post({ ...op, cmd: 'product.name', name: 'too early' }).ok, false);
});

test('legacy log and clear work, and cannot clear a product catalog', () => {
  const server = createCatalogServer();
  const original = JSON.stringify(server.sheets.get(0).data);
  assert.equal(server.post({ cmd: 'clear', gid: 0 }).ok, false);
  assert.equal(server.post({ cmd: 'log', gid: 1557440748, rows: [] }).ok, false);
  const result = server.post({ cmd: 'log', gid: 1410594629, rows: [{ sku: '12707791', qty: '5' }] });
  assert.equal(result.ok, true);
  assert.equal(result.version, 3);
  assert.equal(result.count, 1);
  assert.equal(server.post({ cmd: 'clear', gid: 1410594629 }).ok, true);
  assert.equal(JSON.stringify(server.sheets.get(0).data), original);
});

test('formulas returning empty text still reserve their rows', () => {
  const server = createCatalogServer({ 0: [] });
  server.sheets.get(0).formulas[2] = ['', '=IF(TRUE,"","")', ''];
  const result = server.post({ ...operation(), cmd: 'product.begin' });
  assert.equal(result.row, 4);
});