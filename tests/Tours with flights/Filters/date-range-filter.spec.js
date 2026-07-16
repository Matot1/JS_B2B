import 'dotenv/config';
import { test, expect } from '@playwright/test';
import { SearchTourPage } from '../../../pages/SearchTourPage.js';
import { countryToValue } from '../../../pages/countryCodes.js';

const monthNames = {
  'Январь': 0, 'Февраль': 1, 'Март': 2, 'Апрель': 3, 'Май': 4, 'Июнь': 5,
  'Июль': 6, 'Август': 7, 'Сентябрь': 8, 'Октябрь': 9, 'Ноябрь': 10, 'Декабрь': 11,
};

function parseMonthYear(str) {
  const parts = str.replace(/[,]/g, '').trim().split(/\s+/);
  if (parts.length < 2) return null;
  const month = monthNames[parts[0]];
  const year = parseInt(parts[1], 10);
  if (isNaN(month) || isNaN(year)) return null;
  return { month, year };
}

test.describe('Фильтры "Вылет от" и "до"', () => {

  test('Даты заезда попадают в диапазон "Вылет от" — "до"', async ({ page }) => {
    const searchPage = new SearchTourPage(page);

    await searchPage.gotoWithCountry(countryToValue['Турция']);
    await page.waitForTimeout(3000);

    await page.click('input[name="CHECKIN_BEG"]');
    await page.waitForTimeout(1000);

    const getVisibleDates = async () => {
      return page.evaluate(() => {
        const picker = document.querySelector('.Zebra_DatePicker.dp_visible');
        if (!picker) return { dates: [], monthYear: '' };
        const header = Array.from(picker.querySelectorAll('*'))
          .find(el => el.children.length === 0 && /[А-Яа-я]/.test(el.textContent) && /\d{4}/.test(el.textContent));
        const monthYear = header ? header.textContent.trim() : '';
        const tds = picker.querySelectorAll('table.dp_daypicker td');
        const dates = Array.from(tds)
          .filter(td => td.classList.contains('dp_highlight') && !td.classList.contains('dp_disabled'))
          .map(td => ({ day: parseInt(td.textContent.trim(), 10) }));
        return { dates, monthYear };
      });
    };

    const { dates: available1, monthYear: my1Str } = await getVisibleDates();
    const my1 = parseMonthYear(my1Str);

    test.skip(available1.length < 2 || !my1, 'Нет доступных дат для "Вылет от"');

    const random1 = available1[Math.floor(Math.random() * available1.length)];

    await page.evaluate((day) => {
      const picker = document.querySelector('.Zebra_DatePicker.dp_visible');
      const tds = picker.querySelectorAll('table.dp_daypicker td');
      for (const td of tds) {
        if (td.textContent.trim() === String(day) &&
            td.classList.contains('dp_highlight') &&
            !td.classList.contains('dp_disabled')) {
          td.click();
          break;
        }
      }
    }, random1.day);
    await page.waitForTimeout(500);

    await page.click('input[name="CHECKIN_END"]');
    await page.waitForTimeout(1000);

    const { dates: available2, monthYear: my2Str } = await page.evaluate(({ begDay, begMonth, begYear }) => {
      const picker = document.querySelector('.Zebra_DatePicker.dp_visible');
      if (!picker) return { dates: [], monthYear: '' };
      const monthNamesLocal = {
        'Январь': 0, 'Февраль': 1, 'Март': 2, 'Апрель': 3, 'Май': 4, 'Июнь': 5,
        'Июль': 6, 'Август': 7, 'Сентябрь': 8, 'Октябрь': 9, 'Ноябрь': 10, 'Декабрь': 11,
      };
      const header = Array.from(picker.querySelectorAll('*'))
        .find(el => el.children.length === 0 && /[А-Яа-я]/.test(el.textContent) && /\d{4}/.test(el.textContent));
      const monthYear = header ? header.textContent.trim() : '';
      const parts = monthYear.replace(/[,]/g, '').trim().split(/\s+/);
      const m = monthNamesLocal[parts[0]];
      const y = parseInt(parts[1], 10);
      const tds = picker.querySelectorAll('table.dp_daypicker td');
      const dates = Array.from(tds)
        .filter(td => td.classList.contains('dp_highlight') && !td.classList.contains('dp_disabled'))
        .map(td => ({ day: parseInt(td.textContent.trim(), 10), month: m, year: y }))
        .filter(d => {
          if (d.year < begYear) return false;
          if (d.year === begYear && d.month < begMonth) return false;
          if (d.year === begYear && d.month === begMonth && d.day <= begDay) return false;
          const begDate = new Date(begYear, begMonth, begDay);
          const dDate = new Date(d.year, d.month, d.day);
          const diffDays = (dDate - begDate) / (1000 * 60 * 60 * 24);
          return diffDays <= 7;
        });
      return { dates, monthYear };
    }, { begDay: random1.day, begMonth: my1.month, begYear: my1.year });

    test.skip(available2.length === 0, 'Нет доступных дат для "до" после выбранной даты');

    const random2 = available2[Math.floor(Math.random() * available2.length)];

    await page.evaluate((day) => {
      const picker = document.querySelector('.Zebra_DatePicker.dp_visible');
      const tds = picker.querySelectorAll('table.dp_daypicker td');
      for (const td of tds) {
        if (td.textContent.trim() === String(day) &&
            td.classList.contains('dp_highlight') &&
            !td.classList.contains('dp_disabled')) {
          td.click();
          break;
        }
      }
    }, random2.day);
    await page.waitForTimeout(500);

    const dates = await page.evaluate(() => {
      const beg = document.querySelector('input[name="CHECKIN_BEG"]');
      const end = document.querySelector('input[name="CHECKIN_END"]');
      return { beg: beg?.value, end: end?.value };
    });

    test.skip(!dates.beg || !dates.end, 'Не удалось получить даты из фильтров');

    await searchPage.clickSearch();
    await page.waitForTimeout(3000);

    try {
      await searchPage.waitForResults();
    } catch {
      test.skip(true, `Нет туров для диапазона ${dates.beg} — ${dates.end}`);
      return;
    }

    await page.waitForTimeout(3000);

    const rowCount = await searchPage.getResultRowCount();

    if (rowCount === 0) {
      test.skip(true, `Нет туров для диапазона ${dates.beg} — ${dates.end}`);
      return;
    }

    const arrivalDates = await page.evaluate(() => {
      const rows = document.querySelectorAll('tr[data-state]');
      return Array.from(rows).map(r => {
        const td = r.querySelector('td.arrival');
        if (!td) return '';
        return td.textContent.trim();
      }).filter(Boolean);
    });

    expect(arrivalDates.length).toBeGreaterThan(0);

    const parseDate = (str) => {
      const match = str.match(/(\d{2})\.(\d{2})\.(\d{4})/);
      if (!match) return null;
      return new Date(`${match[3]}-${match[2]}-${match[1]}`);
    };

    const begObj = parseDate(dates.beg);
    const endObj = parseDate(dates.end);

    test.skip(!begObj || !endObj, 'Не удалось распарсить даты фильтров');

    for (const raw of arrivalDates) {
      const dateObj = parseDate(raw);
      if (!dateObj) continue;
      expect(dateObj >= begObj && dateObj <= endObj).toBeTruthy();
    }
  });

});
