const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { createCatalogServer, SPREADSHEET_ID } = require('./catalog-server.cjs');

const BASE = process.env.TEST_URL || 'http://localhost:4173';
const SCRIPT = 'https://script.google.com/macros/s/LOCAL_TEST_DEPLOYMENT/exec';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const csv = (rows) => rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');

async function scenario(browser, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const server = createCatalogServer(options.seed);
  const snapshots = new Map([...server.sheets].map(([gid, sheet]) => [gid, csv(sheet.data)]));
  let dropBegin = !!options.dropBegin;
  let dropName = !!options.dropName;
  let failName = !!options.failName;
  let cancelError = !!options.cancelError;
  const external = [];
  await context.addInitScript((config) => {
    localStorage.setItem('barcode-app:settings:v1', JSON.stringify({ active: 'construction', ...config }));
  }, options.settings || {});
  // No request made by these tests can modify a real Google Sheet.
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === BASE) return route.continue();
    if (url.hostname === 'docs.google.com') {
      const gid = Number(url.searchParams.get('gid'));
      if (options.catalogDelay && (gid === 0 || gid === 1557440748)) await delay(options.catalogDelay);
      const body = gid === 37870238 ? SCRIPT : gid === 1410594629 || gid === 317840889
        ? options.initialRows || ''
        : options.staleExports ? snapshots.get(gid) ?? '' : csv(server.sheets.get(gid)?.data || []);
      return route.fulfill({ status: 200, contentType: 'text/csv', body, headers: { 'access-control-allow-origin': '*' } });
    }
    if (url.hostname === 'script.google.com') {
      const payload = request.postDataJSON();
      if (options.oldScript && payload.cmd.startsWith('product.')) {
        return route.fulfill({ status: 200, json: { ok: false, error: 'Неизвестная команда', version: 2 } });
      }
      if (failName && payload.cmd === 'product.name') {
        failName = false;
        return route.fulfill({ status: 200, json: { ok: false, error: 'Permission denied for protected cell', version: 3 } });
      }
      if (cancelError && payload.cmd === 'product.cancel') {
        cancelError = false;
        return route.abort();
      }
      const result = server.post(payload);
      if (dropBegin && payload.cmd === 'product.begin') {
        dropBegin = false;
        return route.abort();
      }
      if (dropName && payload.cmd === 'product.name') {
        dropName = false;
        return route.abort();
      }
      return route.fulfill({ status: 200, json: result, headers: { 'access-control-allow-origin': '*' } });
    }
    external.push(request.url());
    return route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${BASE}/#/construction`, { waitUntil: 'networkidle' });
  return { context, page, server, errors, external };
}

async function offer(page, sku, useEnter = false) {
  const input = page.getByLabel('Артикул, строка 1', { exact: true });
  await input.fill(sku);
  if (useEnter) await input.press('Enter');
  const dialog = page.locator('.new-product-dialog');
  await dialog.waitFor({ state: 'visible' });
  assert.match(await dialog.innerText(), /Данного артикула нет в базе/);
  assert.match(await dialog.innerText(), /Добавить новый\?/);
  return dialog;
}

async function begin(page, sku) {
  const dialog = await offer(page, sku, true);
  await dialog.getByRole('button', { name: 'Добавить', exact: true }).click();
  await dialog.getByLabel('Штрихкод', { exact: true }).waitFor();
  return dialog;
}

async function barcode(dialog, value = '0001234567895') {
  await dialog.getByLabel('Штрихкод', { exact: true }).fill(value);
  await dialog.getByRole('button', { name: 'Подтвердить', exact: true }).click();
  await dialog.getByLabel('Наименование', { exact: true }).waitFor();
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream'] });
  try {
    {
      const { page, context, server, errors } = await scenario(browser, { staleExports: true });
      await page.getByLabel('Артикул, строка 1', { exact: true }).fill('12707791');
      await page.waitForTimeout(1200);
      assert.equal(await page.locator('.new-product-dialog').count(), 0);
      const dialog = await offer(page, '000NEW01');
      assert.equal(server.calls.filter((call) => call.cmd.startsWith('product.')).length, 0);
      await dialog.getByRole('button', { name: 'Добавить', exact: true }).click();
      await dialog.getByLabel('Штрихкод', { exact: true }).waitFor();
      assert.deepEqual(server.sheets.get(0).data[1], ['000NEW01']);
      await barcode(dialog);
      assert.deepEqual(server.sheets.get(0).data[1], ['000NEW01', '0001234567895']);
      await dialog.getByLabel('Наименование', { exact: true }).fill('New product after barcode');
      await dialog.getByRole('button', { name: 'Подтвердить', exact: true }).click();
      await dialog.waitFor({ state: 'detached' });
      await page.waitForTimeout(650);
      assert.deepEqual(server.sheets.get(0).data[1], ['000NEW01', '0001234567895', 'New product after barcode']);
      assert.match(await page.locator('.main-entry-table tbody tr').first().innerText(), /New product after barcode/);
      assert.equal(await page.locator('.main-entry-table tbody tr').first().locator('svg.max-w-full').count(), 1);
      await page.locator('nav a[href="#/joinery"]').click();
      await page.locator('nav a[href="#/construction"]').click();
      await page.waitForTimeout(500);
      assert.match(await page.locator('.main-entry-table tbody tr').first().innerText(), /New product after barcode/);
      assert.equal(server.calls.filter((call) => call.cmd === 'product.begin').length, 1);
      assert.deepEqual(errors, []);
      await context.close();
      console.log('PASS known/missing SKU, staged save, leading zeroes, immediate display with stale CSV');
    }

    {
      const { page, context, server } = await scenario(browser);
      const dialog = await offer(page, 'CANCEL-OFFER');
      await dialog.getByRole('button', { name: 'Закрыть', exact: true }).click();
      await page.waitForTimeout(1200);
      assert.equal(await dialog.count(), 0);
      assert.equal(server.calls.filter((call) => call.cmd.startsWith('product.')).length, 0);
      await page.getByRole('button', { name: 'Добавить в базу', exact: true }).click();
      await dialog.getByRole('button', { name: 'Добавить', exact: true }).click();
      await dialog.getByLabel('Штрихкод', { exact: true }).waitFor();
      await barcode(dialog, 'CANCEL-CODE');
      await dialog.getByRole('button', { name: 'Закрыть', exact: true }).click();
      await dialog.waitFor({ state: 'detached' });
      assert.deepEqual(server.sheets.get(0).data[1], ['', '', '']);
      await context.close();
      console.log('PASS cancellation before writes and after barcode, manual reopen');
    }

    {
      const { page, context, server } = await scenario(browser, { dropBegin: true, failName: true });
      const dialog = await offer(page, 'RETRY-ITEM', true);
      await dialog.getByRole('button', { name: 'Добавить', exact: true }).click();
      await dialog.getByRole('alert').waitFor();
      assert.match(await dialog.getByRole('alert').innerText(), /подтверждение/);
      await dialog.getByRole('button', { name: 'Добавить', exact: true }).click();
      await dialog.getByLabel('Штрихкод', { exact: true }).waitFor();
      const starts = server.calls.filter((call) => call.cmd === 'product.begin');
      assert.equal(starts.length, 2);
      assert.equal(starts[0].operationId, starts[1].operationId);
      await barcode(dialog);
      await dialog.getByLabel('Наименование', { exact: true }).fill('Retry-safe item');
      await dialog.getByRole('button', { name: 'Подтвердить', exact: true }).click();
      await dialog.getByRole('alert').waitFor();
      assert.equal(await dialog.getByLabel('Наименование', { exact: true }).inputValue(), 'Retry-safe item');
      await dialog.getByRole('button', { name: 'Подтвердить', exact: true }).click();
      await dialog.waitFor({ state: 'detached' });
      assert.equal(server.sheets.get(0).getLastRow(), 2);
      await context.close();
      console.log('PASS lost reply and retry without duplicates, server error does not advance step');
    }

    {
      const { page, context, server } = await scenario(browser, { oldScript: true });
      const dialog = await offer(page, 'OLD-SCRIPT', true);
      await dialog.getByRole('button', { name: 'Добавить', exact: true }).click();
      await dialog.getByRole('alert').waitFor();
      assert.match(await dialog.getByRole('alert').innerText(), /Обновите Apps Script/);
      assert.equal(server.sheets.get(0).getLastRow(), 1);
      await context.close();
      console.log('PASS old deployment reports required update, no fake success');
    }

    {
      const { page, context, server, errors } = await scenario(browser);
      await page.locator('nav a[href="#/joinery"]').click();
      await page.waitForTimeout(500);
      const dialog = await begin(page, 'MOBILE-NEW');
      for (const width of [320, 375, 430]) {
        await page.setViewportSize({ width, height: 812 });
        const rect = await dialog.boundingBox();
        assert.ok(rect.x >= 0 && rect.x + rect.width <= width + 1, `dialog fits ${width}px`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      }
      await page.screenshot({ path: '/tmp/spisanie-tests/mobile-product.png', fullPage: true });
      await page.addScriptTag({ path: path.join(process.cwd(), 'node_modules/jsbarcode/dist/JsBarcode.all.min.js') });
      await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext('2d');
        const code = document.createElement('canvas');
        JsBarcode(code, '4620747181525', { format: 'EAN13', width: 4, height: 180, margin: 20 });
        const paint = () => {
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1280, 720);
          ctx.drawImage(code, (1280 - code.width) / 2, (720 - code.height) / 2);
        };
        paint();
        window.__cameraStream = canvas.captureStream(20);
        setInterval(paint, 100);
        Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => window.__cameraStream });
      });
      await dialog.getByRole('button', { name: 'Открыть камеру', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.new-product-dialog input')?.value === '4620747181525');
      assert.equal(await dialog.getByLabel('Штрихкод', { exact: true }).inputValue(), '4620747181525');
      assert.equal(await page.evaluate(() => window.__cameraStream.getTracks().every((track) => track.readyState === 'ended')), true);
      await barcode(dialog, '4620747181525');
      await dialog.getByLabel('Наименование', { exact: true }).fill('Joinery scanned item');
      await dialog.getByRole('button', { name: 'Подтвердить', exact: true }).click();
      await dialog.waitFor({ state: 'detached' });
      assert.deepEqual(server.sheets.get(1557440748).data[1], ['MOBILE-NEW', '4620747181525', 'Joinery scanned item']);
      assert.equal(server.sheets.get(0).getLastRow(), 1);
      await page.emulateMedia({ media: 'print' });
      assert.equal(await page.locator('.print-document').isVisible(), true);
      assert.match(await page.locator('.print-document').innerText(), /Joinery scanned item/);
      assert.deepEqual(errors, []);
      await context.close();
      console.log('PASS mobile layout, real ZXing decode from virtual camera, joinery target, print data');
    }

    {
      const { page, context, server } = await scenario(browser, {
        settings: { links: { construction: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit?gid=1557440748` } },
      });
      const dialog = await begin(page, 'LINKED-CATALOG');
      const request = server.calls.find((call) => call.cmd === 'product.begin');
      assert.equal(request.gid, 1557440748);
      assert.equal(request.spreadsheetId, SPREADSHEET_ID);
      await dialog.getByRole('button', { name: 'Закрыть', exact: true }).click();
      await dialog.waitFor({ state: 'detached' });
      await context.close();
      console.log('PASS current configured catalog URL determines the write target');
    }

    {
      const { page, context, server } = await scenario(browser, { initialRows: 'RESTORED-MISSING,3' });
      await page.waitForTimeout(1300);
      assert.equal(await page.locator('.new-product-dialog').count(), 0);
      assert.equal(server.calls.filter((call) => call.cmd.startsWith('product.')).length, 0);
      await context.close();
      console.log('PASS initial restoration does not open dialogs or write catalog entries');
    }

    {
      const { page, context, server } = await scenario(browser, { cancelError: true });
      const dialog = await begin(page, 'CANCEL-RETRY');
      await dialog.getByRole('button', { name: 'Закрыть', exact: true }).click();
      await dialog.getByRole('alert').waitFor();
      assert.match(await dialog.getByRole('alert').innerText(), /Не удалось подтвердить отмену/);
      assert.equal(server.sheets.get(0).data[1][0], 'CANCEL-RETRY');
      await dialog.getByRole('button', { name: 'Закрыть', exact: true }).click();
      await dialog.waitFor({ state: 'detached' });
      assert.deepEqual(server.sheets.get(0).data[1], ['', '', '']);
      await context.close();
      console.log('PASS failed cancellation remains visible and can be retried safely');
    }

    {
      const { page, context, server } = await scenario(browser);
      const dialog = await offer(page, 'RACE-EXISTING', true);
      server.sheets.get(0).data.push(['RACE-EXISTING', '0001234567895', 'Added by someone else']);
      await dialog.getByRole('button', { name: 'Добавить', exact: true }).click();
      await dialog.waitFor({ state: 'detached' });
      assert.equal(server.sheets.get(0).getLastRow(), 2);
      assert.match(await page.locator('.main-entry-table tbody tr').first().innerText(), /Added by someone else/);
      await context.close();
      console.log('PASS an existing server-side product is reused rather than overwritten');
    }

    {
      const { page, context } = await scenario(browser, { catalogDelay: 1500 });
      await page.locator('nav a[href="#/joinery"]').click();
      await page.getByLabel('Артикул, строка 1', { exact: true }).fill('89435511');
      await page.waitForTimeout(900);
      assert.equal(await page.locator('.new-product-dialog').count(), 0);
      await page.waitForTimeout(1800);
      assert.equal(await page.locator('.new-product-dialog').count(), 0);
      assert.match(await page.locator('.main-entry-table tbody tr').first().innerText(), /Existing joinery item/);
      await context.close();
      console.log('PASS lookup waits for the correct catalog and does not prompt while loading');
    }

    {
      const { page, context, server } = await scenario(browser, { dropName: true });
      const dialog = await begin(page, 'FINAL-REPLY-LOST');
      await barcode(dialog);
      await dialog.getByLabel('Наименование', { exact: true }).fill('Saved despite lost reply');
      await dialog.getByRole('button', { name: 'Подтвердить', exact: true }).click();
      await dialog.getByRole('alert').waitFor();
      assert.equal(server.sheets.get(0).data[1][2], 'Saved despite lost reply');
      await dialog.getByRole('button', { name: 'Закрыть', exact: true }).click();
      await dialog.waitFor({ state: 'detached' });
      assert.equal(server.sheets.get(0).data[1][2], 'Saved despite lost reply');
      assert.match(await page.locator('.main-entry-table tbody tr').first().innerText(), /Saved despite lost reply/);
      await context.close();
      console.log('PASS lost final acknowledgement cannot delete a completed product');
    }
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });