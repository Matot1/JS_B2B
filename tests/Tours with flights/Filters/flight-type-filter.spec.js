import 'dotenv/config';
import { test, expect } from '@playwright/test';
import { SearchTourPage } from '../../../pages/SearchTourPage.js';
import { countryToValue } from '../../../pages/countryCodes.js';

test.describe('Фильтр "Авиаперелет"', () => {

  test('Чартер/блочная перевозка — нет "GDS" в столбцах "Тип цены" и "Тур"', async ({ page }) => {
    const searchPage = new SearchTourPage(page);

    await searchPage.gotoWithFilters(countryToValue['Турция'], null, null, '1');
    await page.waitForTimeout(3000);

    await searchPage.clickSearch();
    await page.waitForTimeout(3000);

    try {
      await searchPage.waitForResults();
    } catch {
      test.skip(true, 'Нет туров для чартерных рейсов в Турцию');
      return;
    }

    await page.waitForTimeout(3000);

    const rowCount = await searchPage.getResultRowCount();

    if (rowCount === 0) {
      test.skip(true, 'Нет туров для чартерных рейсов в Турцию');
      return;
    }

    const rowData = await page.evaluate(() => {
      const rows = document.querySelectorAll('tr[data-state]');
      return Array.from(rows).map(r => {
        const typePrice = r.querySelector('td.type_price');
        const tour = r.querySelector('td.tour');

        let tourText = '';
        if (tour) {
          for (const n of tour.childNodes) {
            if (n.nodeType === 3) {
              const t = n.textContent.trim();
              if (t) { tourText = t; break; }
            }
          }
        }

        const priceText = typePrice?.textContent?.trim()?.toLowerCase() || '';

        return { tourText, priceText };
      });
    });

    expect(rowData.length).toBeGreaterThan(0);

    for (const row of rowData) {
      expect(row.priceText).not.toContain('gds');
      expect(row.tourText.toLowerCase()).not.toContain('gds');
    }
  });

  test('GDS — присутствует "GDS" в столбцах "Тип цены" и "Тур"', async ({ page }) => {
    const searchPage = new SearchTourPage(page);

    await searchPage.gotoWithFilters(countryToValue['Турция'], null, null, '2');
    await page.waitForTimeout(3000);

    await searchPage.clickSearch();
    await page.waitForTimeout(3000);

    try {
      await searchPage.waitForResults();
    } catch {
      test.skip(true, 'Нет туров для GDS в Турцию');
      return;
    }

    await page.waitForTimeout(3000);

    const rowCount = await searchPage.getResultRowCount();

    if (rowCount === 0) {
      test.skip(true, 'Нет туров для GDS в Турцию');
      return;
    }

    const rowData = await page.evaluate(() => {
      const rows = document.querySelectorAll('tr[data-state]');
      return Array.from(rows).map(r => {
        const typePrice = r.querySelector('td.type_price');
        const tour = r.querySelector('td.tour');

        let tourText = '';
        if (tour) {
          for (const n of tour.childNodes) {
            if (n.nodeType === 3) {
              const t = n.textContent.trim();
              if (t) { tourText = t; break; }
            }
          }
        }

        const priceText = typePrice?.textContent?.trim()?.toLowerCase() || '';

        return { tourText, priceText };
      });
    });

    expect(rowData.length).toBeGreaterThan(0);

    for (const row of rowData) {
      expect(row.priceText).toContain('gds');
      expect(row.tourText.toLowerCase()).toContain('gds');
    }
  });

});
