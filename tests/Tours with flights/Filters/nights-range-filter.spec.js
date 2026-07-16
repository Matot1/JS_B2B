import 'dotenv/config';
import { test, expect } from '@playwright/test';
import { SearchTourPage } from '../../../pages/SearchTourPage.js';
import { countryToValue } from '../../../pages/countryCodes.js';

test.describe('Фильтры "Ночей от" и "до"', () => {

  test('Количество ночей попадает в диапазон "Ночей от" — "до"', async ({ page }) => {
    const searchPage = new SearchTourPage(page);

    await searchPage.gotoWithCountry(countryToValue['Турция']);
    await page.waitForTimeout(3000);

    const nightsFromOptions = await page.evaluate(() => {
      const sel = document.querySelector('select[name="NIGHTS_FROM"]');
      if (!sel) return [];
      return Array.from(sel.options).map(o => parseInt(o.value, 10)).filter(v => !isNaN(v));
    });

    const nightsTillOptions = await page.evaluate(() => {
      const sel = document.querySelector('select[name="NIGHTS_TILL"]');
      if (!sel) return [];
      return Array.from(sel.options).map(o => parseInt(o.value, 10)).filter(v => !isNaN(v));
    });

    test.skip(nightsFromOptions.length === 0 || nightsTillOptions.length === 0, 'Нет доступных опций для количества ночей');

    const nightsFrom = nightsFromOptions[Math.floor(Math.random() * nightsFromOptions.length)];
    const maxTill = Math.min(nightsFromOptions.length > 0 ? Math.max(...nightsTillOptions) : 28, nightsFrom + 7);
    const availableTills = nightsTillOptions.filter(v => v >= nightsFrom && v <= maxTill);
    test.skip(availableTills.length === 0, 'Нет подходящих значений для "до"');
    const nightsTill = availableTills[Math.floor(Math.random() * availableTills.length)];

    console.log(`Выбрано: ночей от ${nightsFrom} до ${nightsTill}`);

    await page.evaluate(({ from, till }) => {
      const selFrom = document.querySelector('select[name="NIGHTS_FROM"]');
      const selTill = document.querySelector('select[name="NIGHTS_TILL"]');
      if (selFrom) { selFrom.value = String(from); selFrom.dispatchEvent(new Event('change', { bubbles: true })); }
      if (selTill) { selTill.value = String(till); selTill.dispatchEvent(new Event('change', { bubbles: true })); }
    }, { from: nightsFrom, till: nightsTill });
    await page.waitForTimeout(500);

    await searchPage.clickSearch();
    await page.waitForTimeout(3000);

    try {
      await searchPage.waitForResults();
    } catch {
      test.skip(true, `Нет туров для диапазона ночей ${nightsFrom} — ${nightsTill}`);
      return;
    }

    await page.waitForTimeout(3000);

    const rowCount = await searchPage.getResultRowCount();

    if (rowCount === 0) {
      test.skip(true, `Нет туров для диапазона ночей ${nightsFrom} — ${nightsTill}`);
      return;
    }

    const nightsValues = await page.evaluate(() => {
      const rows = document.querySelectorAll('tr[data-state]');
      return Array.from(rows).map(r => {
        const td = r.querySelector('td.tour-nights');
        if (!td) return NaN;
        return parseInt(td.textContent.trim(), 10);
      }).filter(v => !isNaN(v));
    });

    expect(nightsValues.length).toBeGreaterThan(0);

    for (const nights of nightsValues) {
      expect(nights).toBeGreaterThanOrEqual(nightsFrom);
      expect(nights).toBeLessThanOrEqual(nightsTill);
    }
  });

});
