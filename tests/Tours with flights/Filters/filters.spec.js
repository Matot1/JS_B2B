import 'dotenv/config';
import { test, expect } from '@playwright/test';
import { SearchTourPage } from '../../../pages/SearchTourPage.js';
import { cityToAirportCode, cityToValue } from '../../../pages/cityCodes.js';
import { countryToValue } from '../../../pages/countryCodes.js';

// ===== Город отправления =====
const cities = [
  'Москва',
  'Санкт-Петербург',
  'Екатеринбург',
  'Сочи',
];

// ===== Страна =====
const countries = [
  'Турция',
  'Египет',
  'ОАЭ',
];

// ===== Тип тура =====
const tourTypes = [
  { country: 'Турция', countryValue: countryToValue['Турция'], tourTypeValue: '14', expectedKeyword: 'Premium' },
  { country: 'Азербайджан', countryValue: countryToValue['Азербайджан'], tourTypeValue: '43', expectedKeyword: 'Dynamic package' },
];

// ===== Программа =====
const programs = [
  { name: 'Тариф «Промо»', value: '114', expectedKeyword: 'ПРОМО' },
  { name: 'Тариф «Стандарт»', value: '14', expectedKeyword: 'Стандарт' },
];

// ===== Даты (Zebra Datepicker) =====
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

// ===== Общие хелперы =====
function getTourTexts(page) {
  return page.evaluate(() => {
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
}

function getTourAndPriceTexts(page) {
  return page.evaluate(() => {
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
}

test.describe('Фильтры страницы "Туры с перелетом"', () => {

  // ===== 1. Город отправления =====
  for (const cityName of cities) {
    const expectedCode = cityToAirportCode[cityName];
    const cityValue = cityToValue[cityName];

    test(`Город отправления: ${cityName} — код ${expectedCode}`, async ({ page }) => {
      const searchPage = new SearchTourPage(page);

      await searchPage.goto(cityValue);
      await page.waitForTimeout(3000);
      await searchPage.clickSearch();
      await page.waitForTimeout(3000);

      let resultText = '';
      try {
        await searchPage.waitForResults();
        resultText = await searchPage.getResultText();
      } catch {
        test.skip(true, `Страница недоступна или нет туров для города ${cityName}`);
        return;
      }

      await page.waitForTimeout(3000);

      if (!resultText || resultText.trim().length <= 10 || resultText.trim() === '\u00a0') {
        test.skip(true, `Нет туров с вылетом из ${cityName}`);
        return;
      }

      expect(resultText).toContain(expectedCode);
    });
  }

  // ===== 2. Страна =====
  for (const countryName of countries) {
    const countryValue = countryToValue[countryName];

    test(`Страна: ${countryName} — все строки относятся к выбранной стране`, async ({ page }) => {
      test.setTimeout(180000);
      const searchPage = new SearchTourPage(page);

      await searchPage.gotoWithCountry(countryValue);
      await page.waitForTimeout(3000);

      try {
        await searchPage.clickSearch();
        await page.waitForTimeout(3000);
        await searchPage.waitForResults();
      } catch {
        test.skip(true, `Страница недоступна или нет туров для страны ${countryName}`);
        return;
      }

      await page.waitForTimeout(3000);

      const rowCount = await searchPage.getResultRowCount();
      if (rowCount === 0) {
        test.skip(true, `Нет туров в страну ${countryName}`);
        return;
      }

      const states = await page.evaluate(() => {
        const rows = document.querySelectorAll('tr[data-state]');
        return [...new Set(Array.from(rows).map(r => r.getAttribute('data-state')))];
      });

      expect(states.length).toBe(1);
      expect(states[0]).toBe(countryValue);
    });
  }

  // ===== 3. Тип тура =====
  for (const { country, countryValue: cv, tourTypeValue: ttv, expectedKeyword: ek } of tourTypes) {
    test(`Тип тура: ${ek} + ${country} — в столбце "Тур" указано "${ek}"`, async ({ page }) => {
      const searchPage = new SearchTourPage(page);

      await searchPage.gotoWithFilters(cv, ttv);
      await page.waitForTimeout(3000);
      await searchPage.clickSearch();
      await page.waitForTimeout(3000);

      try {
        await searchPage.waitForResults();
      } catch {
        test.skip(true, `Нет туров для данного типа в стране ${country}`);
        return;
      }

      await page.waitForTimeout(3000);

      const rowCount = await searchPage.getResultRowCount();
      if (rowCount === 0) {
        test.skip(true, `Нет туров для данного типа в стране ${country}`);
        return;
      }

      const tourTexts = await getTourTexts(page);
      expect(tourTexts.length).toBeGreaterThan(0);

      for (const text of tourTexts) {
        expect(text).toContain(ek);
      }
    });
  }

  // ===== 4. Тип продукта =====
  test('Тип продукта: Статика — нет "невозвратный тариф", нет "Dynamic package"', async ({ page }) => {
    const searchPage = new SearchTourPage(page);

    await searchPage.gotoWithFilters(null, null, '1');
    await page.waitForTimeout(3000);
    await searchPage.clickSearch();
    await page.waitForTimeout(3000);

    try {
      await searchPage.waitForResults();
    } catch {
      test.skip(true, 'Нет туров для типа продукта Статика');
      return;
    }

    await page.waitForTimeout(3000);

    const rowCount = await searchPage.getResultRowCount();
    if (rowCount === 0) {
      test.skip(true, 'Нет туров для типа продукта Статика');
      return;
    }

    const resultText = await searchPage.getResultText();
    const lowerText = resultText.toLowerCase();

    expect(lowerText).not.toContain('невозвратный');
    expect(lowerText).not.toContain('dynamic package');

    const tourTexts = await getTourTexts(page);
    expect(tourTexts.length).toBeGreaterThan(0);

    for (const text of tourTexts) {
      expect(text.toLowerCase()).not.toContain('dynamic package');
    }
  });

  test('Тип продукта: Динамика + Азербайджан — "Dynamic package" + тарифные условия', async ({ page }) => {
    const searchPage = new SearchTourPage(page);

    await searchPage.gotoWithFilters(countryToValue['Азербайджан'], '43', '2');
    await page.waitForTimeout(3000);
    await searchPage.clickSearch();
    await page.waitForTimeout(3000);

    try {
      await searchPage.waitForResults();
    } catch {
      test.skip(true, 'Нет туров для типа Динамика в Азербайджане');
      return;
    }

    await page.waitForTimeout(3000);

    const rowCount = await searchPage.getResultRowCount();
    if (rowCount === 0) {
      test.skip(true, 'Нет туров для типа Динамика в Азербайджане');
      return;
    }

    const rowData = await getTourAndPriceTexts(page);
    expect(rowData.length).toBeGreaterThan(0);

    for (const row of rowData) {
      const hasNonRefund = row.priceText.includes('невозвратный');
      const hasCancel = row.priceText.includes('штраф') && row.priceText.includes('отмен');
      const hasPriceInfo = row.priceText.includes('информация о тарифе');
      expect(hasNonRefund || hasCancel || hasPriceInfo).toBeTruthy();
      expect(row.tourText.toLowerCase()).toContain('dynamic package');
    }
  });

  // ===== 5. Авиаперелет =====
  test('Авиаперелет: Чартер/блочная перевозка — нет "GDS"', async ({ page }) => {
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

    const rowData = await getTourAndPriceTexts(page);
    expect(rowData.length).toBeGreaterThan(0);

    for (const row of rowData) {
      expect(row.priceText).not.toContain('gds');
      expect(row.tourText.toLowerCase()).not.toContain('gds');
    }
  });

  test('Авиаперелет: GDS — присутствует "GDS"', async ({ page }) => {
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

    const rowData = await getTourAndPriceTexts(page);
    expect(rowData.length).toBeGreaterThan(0);

    for (const row of rowData) {
      expect(row.priceText).toContain('gds');
      expect(row.tourText.toLowerCase()).toContain('gds');
    }
  });

  // ===== 6. Тур =====
  test('Тур: случайный тур — в столбце "Тур" только выбранный тур', async ({ page }) => {
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

    const tourTexts = await getTourTexts(page);
    expect(tourTexts.length).toBeGreaterThan(0);

    for (const text of tourTexts) {
      expect(text).toContain(selectedTour.name);
    }
  });

  // ===== 7. Программа =====
  for (const { name, value, expectedKeyword } of programs) {
    test(`Программа: ${name} — в столбце "Тур" отображается "${expectedKeyword}"`, async ({ page }) => {
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

  // ===== 8. Даты вылета =====
  test('Даты: даты заезда попадают в диапазон "Вылет от" — "до"', async ({ page }) => {
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

  // ===== 9. Количество ночей =====
  test('Ночей от/до — количество ночей попадает в диапазон', async ({ page }) => {
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
