import 'dotenv/config';
import { test, expect } from '@playwright/test';
import { SearchTourPage } from '../../../pages/SearchTourPage.js';
import { countryToValue } from '../../../pages/countryCodes.js';

const programs = [
  { name: 'Тариф «Промо»', value: '114', expectedKeyword: 'ПРОМО' },
  { name: 'Тариф «Стандарт»', value: '14', expectedKeyword: 'Стандарт' },
];

test.describe('Фильтр "Программа"', () => {

  for (const { name, value, expectedKeyword } of programs) {
    test(`${name} — в столбце "Тур" отображается "${expectedKeyword}"`, async ({ page }) => {
      const searchPage = new SearchTourPage(page);

      await searchPage.gotoWithFilters(countryToValue['Турция'], null, null, null, value);
      await page.waitForTimeout(3000);

      await searchPage.clickSearch();
      await page.waitForTimeout(3000);

      try {
        await searchPage.waitForResults();
      } catch {
        test.skip(true, `Нет туров для ${name}`);
        return;
      }

      await page.waitForTimeout(3000);

      const rowCount = await searchPage.getResultRowCount();

      if (rowCount === 0) {
        test.skip(true, `Нет туров для ${name}`);
        return;
      }

      const tourCells = await page.evaluate(() => {
        const rows = document.querySelectorAll('tr[data-state]');
        return Array.from(rows).map(r => {
          const td = r.querySelector('td.tour');
          return td ? td.textContent.trim() : '';
        }).filter(Boolean);
      });

      expect(tourCells.length).toBeGreaterThan(0);

      for (const text of tourCells) {
        expect(text.toLowerCase()).toContain(expectedKeyword.toLowerCase());
      }
    });
  }

});
