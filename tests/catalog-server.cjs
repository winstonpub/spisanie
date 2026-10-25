const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SPREADSHEET_ID = '1lPe5aSe2SG9ZXDTF7hKNlqAU9dS34IgJXwteSZVGsZ4';

function makeSheet(gid, rows = []) {
  const sheet = {
    data: rows.map((row) => [...row]),
    formulas: [],
    formats: new Map(),
    maxRows: Math.max(rows.length, 10),
    getSheetId: () => gid,
    getLastRow() {
      let end = Math.max(this.data.length, this.formulas.length);
      while (end && !(this.data[end - 1] || []).some(Boolean) && !(this.formulas[end - 1] || []).some(Boolean)) end--;
      return end;
    },
    getMaxRows() { return this.maxRows; },
    insertRowsAfter(_, count) { this.maxRows += count; },
    getRange(row, column, height = 1, width = 1) {
      if (row < 1 || column < 1 || height < 1) throw new Error('Invalid range');
      const read = (source) => Array.from({ length: height }, (_, y) =>
        Array.from({ length: width }, (_, x) => String(source[row - 1 + y]?.[column - 1 + x] ?? '')));
      const write = (values) => {
        for (let y = 0; y < height; y++) {
          sheet.data[row - 1 + y] ??= [];
          for (let x = 0; x < width; x++) sheet.data[row - 1 + y][column - 1 + x] = values[y][x];
        }
      };
      return {
        getDisplayValues: () => read(sheet.data),
        getFormulas: () => read(sheet.formulas),
        setNumberFormat(value) { sheet.formats.set(`${row}:${column}`, value); return this; },
        setRichTextValue(value) { write([[value.text]]); return this; },
        setValues(values) { write(values); return this; },
        clearContent() { write(Array.from({ length: height }, () => Array(width).fill(''))); return this; },
      };
    },
  };
  return sheet;
}

function createCatalogServer(seed = {}) {
  const sheets = new Map([
    [0, makeSheet(0, seed[0] || [['12707791', '4620747181525', 'Existing construction item']])],
    [1557440748, makeSheet(1557440748, seed[1557440748] || [['89435511', '4650319731148', 'Existing joinery item']])],
    [1410594629, makeSheet(1410594629)],
    [317840889, makeSheet(317840889)],
    [37870238, makeSheet(37870238, [['https://script.google.com/macros/s/MOCK/exec']])],
  ]);
  const drafts = new Map();
  const calls = [];
  const context = vm.createContext({
    SpreadsheetApp: {
      openById(id) {
        if (id !== SPREADSHEET_ID) throw new Error('Unknown spreadsheet');
        return { getSheets: () => [...sheets.values()] };
      },
      newRichTextValue: () => ({
        text: '',
        setText(value) { this.text = value; return this; },
        build() { return { text: this.text }; },
      }),
      flush() {},
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => drafts.get(key) ?? null,
        setProperty: (key, value) => drafts.set(key, value),
        getProperties: () => Object.fromEntries(drafts),
        deleteProperty: (key) => drafts.delete(key),
      }),
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } }),
    },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../google-apps-script/Code.gs'), 'utf8'), context);
  return {
    sheets, drafts, calls,
    post(payload) {
      calls.push(payload);
      return JSON.parse(context.doPost({ postData: { contents: JSON.stringify(payload) } }).text);
    },
  };
}

module.exports = { createCatalogServer, SPREADSHEET_ID };