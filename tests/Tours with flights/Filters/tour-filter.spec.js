import 'dotenv/config';
import { test, expect } from '@playwright/test';
import { SearchTourPage } from '../../../pages/SearchTourPage.js';
import { countryToValue } from '../../../pages/countryCodes.js';

test.describe('Фильтр "Тур"', () => {

  test('Случайный тур — в столбце "Тур" только выбранный тур', async ({ page }) => {
    const searchPage = new SearchTourPage(page);

    await searchPage.gotoWithCountry(countryToValue['Турция']);
    await page.waitForTimeout(3000);

    const tours = await page.evaluate(() => {
      const select = document.querySelector('select[name="TOURINC"]');
      if (!select) return [];
      return Array.from(select.options)
        .filter(o => o.value !== '0')
        .map(o => ({ name: o.textContent.trim(), value: o.value }));
    });

    test.skip(tours.length === 0, 'Нет доступных туров для Турции');

    const randomIndex = Math.floor(Math.random() * tours.length);
    const selectedTour = tours[randomIndex];

    await searchPage.gotoWithFilters(countryToValue['Турция'], null, null, null, null, selectedTour.value);
    await page.waitForTimeout(3000);

    await searchPage.clickSearch();
    await page.waitForTimeout(3000);

    try {
      await searchPage.waitForResults();
    } catch {
      test.skip(true, `Нет туров для ${selectedTour.name}`);
      return;
    }

    await page.waitForTimeout(3000);

    const rowCount = await searchPage.getResultRowCount();

    if (rowCount === 0) {
      test.skip(true, `Нет туров для ${selectedTour.name}`);
      return;
    }

    const tourTexts = await page.evaluate(() => {
      const rows = document.querySelectorAll('tr[data-state]');
      return Array.from(rows).map(r => {
        const td = r.querySelector('td.tour');
        if (!td) return '';
        for (const n of td.childNodes) {
          if (n.nodeType === 3) {
            const t = n.textContent.trim();
            if (t) return t;
          }
        }
        return '';
      }).filter(Boolean);
    });

    expect(tourTexts.length).toBeGreaterThan(0);

    for (const text of tourTexts) {
      expect(text).toContain(selectedTour.name);
    }
  });

});
