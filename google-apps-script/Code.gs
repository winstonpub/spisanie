const SHEET_ID = '1lPe5aSe2SG9ZXDTF7hKNlqAU9dS34IgJXwteSZVGsZ4';

// Листы, в которые запись ЗАПРЕЩЕНА: справочники товаров и лист настроек.
// Во все остальные листы этой таблицы сайт может писать.
const PROTECTED_GIDS = [
  0,          // Стройка — справочник товаров
  1557440748, // Столярка — справочник товаров
  37870238,   // Настройки — URL скрипта
];

// Only these catalog sheets accept new products. Add other trusted targets here.
const PRODUCT_CATALOGS = {
  [SHEET_ID]: [0, 1557440748],
};
const DRAFT_PREFIX = 'product-draft:';

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const body = JSON.parse((e.postData && e.postData.contents) || '{}');
    if (typeof body.cmd === 'string' && body.cmd.indexOf('product.') === 0) {
      return jsonResponse(handleProductCommand(body));
    }
    const gid = Number(body.gid);

    if (!Number.isFinite(gid)) {
      return jsonResponse({ ok: false, error: 'Не указан gid листа', version: 2 });
    }
    if (PROTECTED_GIDS.indexOf(gid) !== -1 || (PRODUCT_CATALOGS[SHEET_ID] || []).indexOf(gid) !== -1) {
      return jsonResponse({ ok: false, error: 'Запись в этот лист не разрешена', version: 2 });
    }

    const sheet = SpreadsheetApp.openById(SHEET_ID)
      .getSheets()
      .filter((item) => item.getSheetId() === gid)[0];

    if (!sheet) return jsonResponse({ ok: false, error: 'Лист не найден', version: 2 });

    if (body.cmd === 'log') {
      // rows — актуальный формат сайта. skus/quantities оставлены для совместимости.
      const rows = Array.isArray(body.rows)
        ? body.rows
        : (Array.isArray(body.skus)
            ? body.skus.map((sku, index) => ({
                sku: sku,
                qty: (body.quantities || [])[index] || '',
              }))
            : []);

      const values = rows
        .map((row) => [String(row.sku == null ? '' : row.sku), String(row.qty == null ? '' : row.qty)])
        .filter((row) => row[0] !== '' || row[1] !== '');

      clearColumnsAB(sheet);
      if (values.length) {
        // Столбец A — артикул, столбец B — количество.
        sheet.getRange(1, 1, values.length, 2).setValues(values);
      }
      return jsonResponse({ ok: true, count: values.length, version: 2 });
    }

    if (body.cmd === 'clear') {
      clearColumnsAB(sheet);
      return jsonResponse({ ok: true, count: 0, version: 2 });
    }

    return jsonResponse({ ok: false, error: 'Неизвестная команда', version: 2 });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err), version: 2 });
  } finally {
    try {
      lock.releaseLock();
    } catch (ignored) {}
  }
}

function clearColumnsAB(sheet) {
  const lastRow = Math.max(sheet.getLastRow(), 1);
  sheet.getRange(1, 1, lastRow, 2).clearContent();
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(Object.assign({}, data, { version: 3 })))
    .setMimeType(ContentService.MimeType.JSON);
}

function productText(value, label, maxLength) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Введите ' + label);
  const text = value.trim();
  if (text.length > maxLength || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) {
    throw new Error('Недопустимое значение: ' + label);
  }
  return text;
}

function skuKey(value) {
  return String(value).trim().replace(/\s+/g, '').toLowerCase();
}

function readCatalog(sheet) {
  const height = sheet.getLastRow();
  if (!height) return { values: [], lastRow: 0 };
  const range = sheet.getRange(1, 1, height, 3);
  const values = range.getDisplayValues();
  const formulas = range.getFormulas();
  let lastRow = height;
  // Empty cells in B/C do not change the row associated with an SKU.
  while (lastRow > 0 && !values[lastRow - 1].some(Boolean) && !formulas[lastRow - 1].some(Boolean)) {
    lastRow--;
  }
  return { values: values, lastRow: lastRow };
}

function findProductRow(values, sku) {
  const matches = [];
  values.forEach((row, index) => {
    if (skuKey(row[0]) === skuKey(sku)) matches.push(index + 1);
  });
  if (matches.length > 1) throw new Error('В базе несколько строк с этим артикулом. Проверьте таблицу.');
  return matches[0] || 0;
}

function productAt(values, row) {
  const value = values[row - 1] || ['', '', ''];
  return { sku: value[0], barcode: value[1], name: value[2] };
}

function productReply(body, row, product, status, exists) {
  return {
    ok: true,
    catalogVersion: 1,
    operationId: body.operationId,
    spreadsheetId: body.spreadsheetId,
    gid: Number(body.gid),
    row: row,
    product: product,
    status: status,
    exists: !!exists,
  };
}

function saveDraft(properties, key, draft) {
  properties.setProperty(key, JSON.stringify(Object.assign({}, draft, { updatedAt: Date.now() })));
}

function pruneDraftReceipts(properties) {
  const receipts = properties.getProperties();
  Object.keys(receipts).forEach((key) => {
    if (key.indexOf(DRAFT_PREFIX) !== 0) return;
    try {
      const draft = JSON.parse(receipts[key]);
      if (draft.status !== 'draft' && Date.now() - draft.updatedAt > 7 * 86400000) {
        properties.deleteProperty(key);
      }
    } catch (ignored) {}
  });
}

function writeProductText(sheet, row, column, value) {
  // Rich text preserves leading zeroes and never executes user input as a formula.
  sheet.getRange(row, column).setNumberFormat('@')
    .setRichTextValue(SpreadsheetApp.newRichTextValue().setText(value).build());
}

function handleProductCommand(body) {
  const commands = ['product.begin', 'product.barcode', 'product.name', 'product.cancel'];
  if (commands.indexOf(body.cmd) === -1) throw new Error('Неизвестная команда товара');
  const spreadsheetId = String(body.spreadsheetId || '');
  const gid = Number(body.gid);
  const permitted = PRODUCT_CATALOGS[spreadsheetId];
  if (!permitted || body.gid === '' || body.gid == null || !Number.isInteger(gid) || permitted.indexOf(gid) === -1) {
    throw new Error('Эта база товаров не разрешена в PRODUCT_CATALOGS. Проверьте настройки Apps Script.');
  }
  if (typeof body.operationId !== 'string' || !/^[a-zA-Z0-9-]{16,100}$/.test(body.operationId)) {
    throw new Error('Некорректный идентификатор операции');
  }
  const sku = productText(body.sku, 'артикул', 128);
  const properties = PropertiesService.getScriptProperties();
  const key = DRAFT_PREFIX + body.operationId;
  const raw = properties.getProperty(key);
  let draft = raw ? JSON.parse(raw) : null;
  if (draft && (draft.spreadsheetId !== spreadsheetId || draft.gid !== gid || draft.sku !== sku)) {
    throw new Error('Операция относится к другому товару');
  }
  if (draft && draft.status === 'cancelled') {
    if (body.cmd === 'product.cancel') return productReply(body, 0, { sku: sku, barcode: '', name: '' }, 'cancelled');
    throw new Error('Добавление отменено. Откройте форму заново.');
  }
  const sheet = SpreadsheetApp.openById(spreadsheetId).getSheets().filter((item) => item.getSheetId() === gid)[0];
  if (!sheet) throw new Error('База товаров не найдена');
  const catalog = readCatalog(sheet);
  let row = findProductRow(catalog.values, sku);
  let product = productAt(catalog.values, row);

  if (body.cmd === 'product.begin') {
    if (row && !draft) {
      if (product.barcode && product.name) return productReply(body, row, product, 'complete', true);
      throw new Error('Этот артикул уже есть в базе, но строка заполнена не полностью. Завершите её в Google Таблице.');
    }
    if (!draft) {
      pruneDraftReceipts(properties);
      draft = { spreadsheetId: spreadsheetId, gid: gid, sku: sku, barcode: '', name: '', status: 'draft' };
      saveDraft(properties, key, draft);
    }
    if (!row) {
      if (draft.status !== 'draft' || draft.barcode || draft.name) throw new Error('Строка товара была удалена. Проверьте базу.');
      row = catalog.lastRow + 1;
      if (row > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), row - sheet.getMaxRows());
      writeProductText(sheet, row, 1, sku);
      SpreadsheetApp.flush();
      product = { sku: sku, barcode: '', name: '' };
    }
    return productReply(body, row, product, draft.status);
  }

  if (body.cmd === 'product.cancel' && !draft) {
    // A receipt prevents a delayed begin request from recreating a cancelled draft.
    saveDraft(properties, key, { spreadsheetId: spreadsheetId, gid: gid, sku: sku, status: 'cancelled' });
    return productReply(body, 0, { sku: sku, barcode: '', name: '' }, 'cancelled');
  }
  if (!draft) throw new Error('Сначала добавьте артикул');
  if (draft.status === 'complete') return productReply(body, row, product, 'complete');
  if (body.cmd === 'product.cancel') {
    if (row) {
      if (product.sku !== draft.sku || product.barcode !== draft.barcode || product.name !== draft.name) {
        throw new Error('Черновик изменён другим пользователем. Автоматическая отмена невозможна, проверьте строку в таблице.');
      }
      // Do not delete a sheet row or shift unrelated columns.
      sheet.getRange(row, 1, 1, 3).clearContent();
      SpreadsheetApp.flush();
    }
    saveDraft(properties, key, Object.assign({}, draft, { status: 'cancelled' }));
    return productReply(body, row, { sku: sku, barcode: '', name: '' }, 'cancelled');
  }
  if (!row) throw new Error('Строка товара была удалена. Проверьте базу.');
  if (product.sku !== draft.sku) throw new Error('Артикул в строке изменился. Проверьте базу.');

  if (body.cmd === 'product.barcode') {
    const barcode = productText(body.barcode, 'штрихкод', 128);
    if (!/^[\x20-\x7e]+$/.test(barcode)) throw new Error('Штрихкод должен содержать цифры или латинские символы');
    if ((product.barcode && product.barcode !== barcode) || product.name) {
      throw new Error('Штрихкод или наименование уже изменены. Проверьте строку товара.');
    }
    writeProductText(sheet, row, 2, barcode);
    SpreadsheetApp.flush();
    draft.barcode = barcode;
    saveDraft(properties, key, draft);
    return productReply(body, row, { sku: sku, barcode: barcode, name: '' }, 'draft');
  }

  const name = productText(body.name, 'наименование', 2000);
  if (!draft.barcode || product.barcode !== draft.barcode || (product.name && product.name !== name)) {
    throw new Error('Данные товара изменились или штрихкод ещё не сохранён');
  }
  writeProductText(sheet, row, 3, name);
  SpreadsheetApp.flush();
  draft.name = name;
  draft.status = 'complete';
  saveDraft(properties, key, draft);
  return productReply(body, row, { sku: sku, barcode: draft.barcode, name: name }, 'complete');
}
