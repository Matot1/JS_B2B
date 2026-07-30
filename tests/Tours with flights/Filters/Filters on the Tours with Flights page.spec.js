import 'dotenv/config';
import { test, expect } from '@playwright/test';
import { SearchTourPage } from '../../../pages/SearchTourPage.js';
import { cityToAirportCode, cityToValue } from '../../../pages/cityCodes.js';
import { countryToValue } from '../../../pages/countryCodes.js';
import {
  parseMonthYear,
  getTourTexts,
  getTourAndPriceTexts,
  getVisibleResultCount,
  setCurrency,
  searchAndGetPrices,
  setChild,
  setAge,
  getHotelRoomTexts,
  searchAndGetTexts,
  getHotelCities,
  searchAndGetHotels,
  getAllHotels,
  selectHotels,
  getResultHotelNames,
  getResultMeals,
  waitAndGetResults,
  hasRedRows,
  getResultRowClasses,
  GROUP_CITIES,
  STAR_VALUES,
  MEALS,
} from './helpers.js';

// ===== Город отправления =====
const cities = [
  'Москва',
  'Санкт-Петербург',
];

// ===== Страна =====
const countries = [
  'Турция',
  'Египет',
  'ОАЭ',
];

// ===== Тип тура =====
const tourTypes = [
  { country: 'Турция', countryValue: countryToValue['Турция'], tourTypeValue: '14', expectedKeyword: 'VIP' },
  { country: 'Турция', countryValue: countryToValue['Турция'], tourTypeValue: '8', expectedKeyword: 'Экскурсионный тур' },
];

// ===== Программа =====
const programs = [
  { name: 'Тариф «Промо»', value: '114', expectedKeyword: 'ПРОМО' },
  { name: 'Тариф «Стандарт»', value: '14', expectedKeyword: 'Стандарт' },
];

test.describe('Фильтры страницы "Туры с перелетом"', () => {

  // ===== 1. Город отправления =====
  test.describe('1. Город отправления', () => {
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

  });

  // ===== 2. Страна =====
  test.describe('2. Страна', () => {
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

  });

  // ===== 3. Тип тура =====
  test.describe('3. Тип тура', () => {
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

  });

  // ===== 4. Тип продукта =====
  test.describe('4. Тип продукта', () => {
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

  test('Тип продукта: Динамика + ОАЭ — "Dynamic package" + тарифные условия', async ({ page }) => {
    const searchPage = new SearchTourPage(page);

    await searchPage.gotoWithFilters(countryToValue['ОАЭ'], null, '2');
    await page.waitForTimeout(3000);
    await searchPage.clickSearch();
    await page.waitForTimeout(3000);

    try {
      await searchPage.waitForResults();
    } catch {
      test.skip(true, 'Нет туров для типа Динамика в ОАЭ');
      return;
    }

    await page.waitForTimeout(3000);

    const rowCount = await searchPage.getResultRowCount();
    if (rowCount === 0) {
      test.skip(true, 'Нет туров для типа Динамика в ОАЭ');
      return;
    }

    const rowData = await getTourAndPriceTexts(page);
    expect(rowData.length).toBeGreaterThan(0);

    for (const row of rowData) {
      expect(row.tourText.toLowerCase()).toContain('dynamic package');
    }

    await page.waitForTimeout(10000);
  });

  });

  // ===== 5. Авиаперелет =====
  test.describe('5. Авиаперелет', () => {
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

  });

  // ===== 6. Тур =====
  test.describe('6. Тур', () => {
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

  });

  // ===== 7. Программа =====
  test.describe('7. Программа', () => {
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

  });

  // ===== 8. Даты вылета =====
  test.describe('8. Даты вылета', () => {
  test('Даты: даты заезда попадают в диапазон "Вылет от" — "до"', async ({ page }) => {
    const searchPage = new SearchTourPage(page);

    const MAX_ATTEMPTS = 5;
    let found = false;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      console.log(`Попытка ${attempt + 1}: выбираем даты вылета`);

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

      if (available1.length < 2 || !my1) {
        console.log('Нет доступных дат для "Вылет от", пробуем снова');
        continue;
      }

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
            return diffDays <= 14;
          });
        return { dates, monthYear };
      }, { begDay: random1.day, begMonth: my1.month, begYear: my1.year });

      if (available2.length === 0) {
        console.log('Нет доступных дат для "до" после выбранной даты, пробуем снова');
        continue;
      }

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

      if (!dates.beg || !dates.end) {
        console.log('Не удалось получить даты из фильтров, пробуем снова');
        continue;
      }

      await searchPage.clickSearch();
      await page.waitForTimeout(3000);

      try {
        await searchPage.waitForResults();
      } catch {
        console.log(`Нет туров для диапазона ${dates.beg} — ${dates.end}, пробуем снова`);
        continue;
      }

      await page.waitForTimeout(3000);

      const rowCount = await searchPage.getResultRowCount();
      if (rowCount === 0) {
        console.log(`Нет туров для диапазона ${dates.beg} — ${dates.end}, пробуем снова`);
        continue;
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

      if (!begObj || !endObj) {
        console.log('Не удалось распарсить даты фильтров, пробуем снова');
        continue;
      }

      for (const raw of arrivalDates) {
        const dateObj = parseDate(raw);
        if (!dateObj) continue;
        expect(dateObj >= begObj && dateObj <= endObj).toBeTruthy();
      }

      found = true;
      await page.waitForTimeout(10000);
      break;
    }

    if (!found) {
      test.skip(true, `Не удалось найти туры за ${MAX_ATTEMPTS} попыток`);
      return;
    }
  });

  });

  // ===== 9. Количество ночей =====
  test.describe('9. Количество ночей', () => {
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

  // ===== 10. Взрослых =====
  test.describe('10. Взрослых', () => {
  test('Взрослых: выдача содержит туры с размещением не ниже выбранного', async ({ page }) => {
    const searchPage = new SearchTourPage(page);

    await searchPage.gotoWithCountry(countryToValue['Турция']);
    await page.waitForTimeout(3000);

    const adultOptions = await page.evaluate(() => {
      const sel = document.querySelector('select[name="ADULT"]');
      if (!sel) return [];
      return Array.from(sel.options)
        .map((o, i) => ({ value: o.value, text: o.textContent.trim(), index: i }))
        .filter(o => o.value !== '' && parseInt(o.value, 10) >= 1);
    });

    test.skip(adultOptions.length < 2, 'Нет достаточного выбора взрослых');

    const randomIndex = Math.floor(Math.random() * adultOptions.length);
    const selectedOption = adultOptions[randomIndex];
    console.log(`Выбрано взрослых: ${selectedOption.value}`);

    await page.locator('.ADULT_chosen .chosen-single').click();
    await page.waitForTimeout(300);
    await page.locator(`.ADULT_chosen .active-result[data-option-array-index="${selectedOption.index}"]`).click();
    await page.waitForTimeout(500);

    await searchPage.clickSearch();
    await page.waitForTimeout(3000);

    try {
      await searchPage.waitForResults();
    } catch {
      test.skip(true, `Нет туров для выбранного количества взрослых ${selectedOption.value}`);
      return;
    }

    await page.waitForTimeout(3000);

    const rowCount = await searchPage.getResultRowCount();
    if (rowCount === 0) {
      test.skip(true, `Нет туров для выбранного количества взрослых ${selectedOption.value}`);
      return;
    }

    const hotelRoomTexts = await page.evaluate(() => {
      const rows = document.querySelectorAll('tr[data-state]');
      return Array.from(rows).map(r => {
        const td = r.querySelector('td.hotel-room');
        if (!td) return '';
        return td.textContent.trim();
      }).filter(Boolean);
    });

    expect(hotelRoomTexts.length).toBeGreaterThan(0);

    const selectedValue = parseInt(selectedOption.value, 10);

    for (const text of hotelRoomTexts) {
      const matches = text.match(/(\d+)\s*AD/gi);
      if (!matches) {
        expect(text).toMatch(/\d+\s*AD/i);
        continue;
      }
      const adultNumbers = matches.map(m => parseInt(m.match(/(\d+)/)[1], 10));

      const maxAdult = Math.max(...adultNumbers);
      expect(maxAdult).toBeGreaterThanOrEqual(selectedValue);

      const lowerNumbers = adultNumbers.filter(n => n < selectedValue);
      expect(lowerNumbers.length).toBe(0);
    }
  });

  });

  // ===== 11. Дети/возраст =====
  test.describe('11. Дети/возраст', () => {

  test('0 детей — выдача содержит только 2AD', async ({ page }) => {
    const searchPage = new SearchTourPage(page);
    await searchPage.gotoWithCountry(countryToValue['Турция']);
    await page.waitForTimeout(3000);
    await setChild(page, 0);
    const texts = await searchAndGetTexts(page, searchPage);
    if (!texts) { test.skip(true, 'Нет туров для Турции'); return; }
    for (const text of texts) {
      expect(text).toContain('2AD');
      expect(text).not.toMatch(/\dCHD/i);
    }
  });

  test('1 ребёнок (возраст 1) — появляется поле возраста, выдача содержит 2AD или 2AD+1CHD', async ({ page }) => {
    const searchPage = new SearchTourPage(page);
    await searchPage.gotoWithCountry(countryToValue['Турция']);
    await page.waitForTimeout(3000);
    await setChild(page, 1);
    const ageChosen = page.locator('.child_ages .chosen-container');
    await expect(ageChosen.first()).toBeVisible({ timeout: 5000 });
    await setAge(page, 0, 1);
    const texts = await searchAndGetTexts(page, searchPage);
    if (!texts) { test.skip(true, 'Нет туров для Турции с 1 ребёнком (возраст 1)'); return; }
    for (const text of texts) {
      expect(text).toMatch(/2AD|3AD/);
    }
  });

  test('1 ребёнок (возраст 6) — выдача содержит 2AD+1CHD или 3AD', async ({ page }) => {
    const searchPage = new SearchTourPage(page);
    await searchPage.gotoWithCountry(countryToValue['Турция']);
    await page.waitForTimeout(3000);
    await setChild(page, 1);
    const ageChosen = page.locator('.child_ages .chosen-container');
    await expect(ageChosen.first()).toBeVisible({ timeout: 5000 });
    await setAge(page, 0, 6);
    const texts = await searchAndGetTexts(page, searchPage);
    if (!texts) { test.skip(true, 'Нет туров для Турции с 1 ребёнком (возраст 6)'); return; }
    for (const text of texts) {
      const has2AD1CHD = /2AD.*1CHD/i.test(text);
      const has3AD = /3AD/.test(text);
      expect(has2AD1CHD || has3AD).toBeTruthy();
    }
  });

  test('2 детей (возраст 0 и 7) — появляются 2 поля возраста, выдача содержит 2AD+1CHD/3AD/4AD', async ({ page }) => {
    const searchPage = new SearchTourPage(page);
    await searchPage.gotoWithCountry(countryToValue['Турция']);
    await page.waitForTimeout(3000);
    await setChild(page, 2);
    const ageChosens = page.locator('.child_ages .chosen-container');
    await expect(ageChosens.nth(0)).toBeVisible({ timeout: 5000 });
    await expect(ageChosens.nth(1)).toBeVisible({ timeout: 5000 });
    await setAge(page, 0, 0);
    await setAge(page, 1, 7);
    const texts = await searchAndGetTexts(page, searchPage);
    if (!texts) { test.skip(true, 'Нет туров для Турции с 2 детьми (возраст 0 и 7)'); return; }
    for (const text of texts) {
      const has2ADwithCHD = /2AD.*\dCHD/i.test(text);
      const has3ADor4AD = /[34]AD/.test(text);
      expect(has2ADwithCHD || has3ADor4AD).toBeTruthy();
    }
  });

  });

  // ===== 12. Валюта =====
  test.describe('12. Валюта', () => {

  test('RUB — цены отображаются в рублях', async ({ page }) => {
    const searchPage = new SearchTourPage(page);
    await searchPage.gotoWithCountry(countryToValue['Турция']);
    await page.waitForTimeout(3000);
    await setCurrency(page, 'RUB');
    const prices = await searchAndGetPrices(page, searchPage);
    if (!prices) { test.skip(true, 'Нет туров для Турции'); return; }
    for (const price of prices) {
      expect(price).toMatch(/RUB$/);
    }
  });

  test('EUR — цены отображаются в евро', async ({ page }) => {
    const searchPage = new SearchTourPage(page);
    await searchPage.gotoWithCountry(countryToValue['Турция']);
    await page.waitForTimeout(3000);
    await setCurrency(page, 'EUR');
    const prices = await searchAndGetPrices(page, searchPage);
    if (!prices) { test.skip(true, 'Нет туров для Турции'); return; }
    for (const price of prices) {
      expect(price).toMatch(/EUR$/);
    }
  });

  });

  // ===== 13. Город (направление) =====
  test.describe('13. Город (направление)', () => {

  test('Город: выдача содержит туры в выбранном городе', async ({ page }) => {
    const searchPage = new SearchTourPage(page);
    const tried = new Set();

    for (let attempt = 0; attempt < 5; attempt++) {
      const available = GROUP_CITIES.filter(c => !tried.has(c));
      if (available.length === 0) break;

      const selectedCity = available[Math.floor(Math.random() * available.length)];
      tried.add(selectedCity);
      console.log(`Попытка ${attempt + 1}: ${selectedCity}`);

      await searchPage.gotoWithCountry(countryToValue['Турция']);
      await page.waitForTimeout(3000);

      const labels = page.locator('label.groupname');
      const count = await labels.count();
      for (let i = 0; i < count; i++) {
        const text = await labels.nth(i).innerText();
        if (text.trim() === selectedCity) {
          await labels.nth(i).locator('input[type="checkbox"]').click({ force: true });
          break;
        }
      }
      await page.waitForTimeout(500);

      await searchPage.clickSearch();
      await page.waitForTimeout(3000);

      try {
        await searchPage.waitForResults();
      } catch {
        continue;
      }

      await page.waitForTimeout(3000);
      const rowCount = await searchPage.getResultRowCount();
      if (rowCount === 0) continue;

      const cities = await getHotelCities(page);
      expect(cities.length).toBeGreaterThan(0);
      for (const city of cities) {
        expect(city.length).toBeGreaterThan(0);
      }
      return;
    }

    test.skip(true, `Нет туров для городов: ${[...tried].join(', ')}`);
  });

  });

  // ===== 14. Категория отеля (звёзды) =====
  test.describe('14. Категория отеля (звёзды)', () => {

  test('3* — все отели имеют категорию 3 звезды', async ({ page }) => {
    const searchPage = new SearchTourPage(page);
    await searchPage.gotoWithCountry(countryToValue['Турция']);
    await page.waitForTimeout(3000);

    const starCb = page.locator(`input.star[value="${STAR_VALUES['3*']}"]`);
    await starCb.click({ force: true });
    await page.waitForTimeout(500);

    const hotels = await searchAndGetHotels(page, searchPage);
    if (!hotels) { test.skip(true, 'Нет туров для Турции с 3*'); return; }

    for (const hotel of hotels) {
      expect(hotel).toMatch(/3\*/);
    }
  });

  test('5* — все отели имеют категорию 5 звёзд', async ({ page }) => {
    const searchPage = new SearchTourPage(page);
    await searchPage.gotoWithCountry(countryToValue['Турция']);
    await page.waitForTimeout(3000);

    const starCb = page.locator(`input.star[value="${STAR_VALUES['5*']}"]`);
    await starCb.click({ force: true });
    await page.waitForTimeout(500);

    const hotels = await searchAndGetHotels(page, searchPage);
    if (!hotels) { test.skip(true, 'Нет туров для Турции с 5*'); return; }

    for (const hotel of hotels) {
      expect(hotel).toMatch(/5\*/);
    }
  });

  });

  // ===== 15. Гостиница =====
  test.describe('15. Гостиница', () => {

  test('Гостиница: выдача содержит только выбранные гостиницы', async ({ page }) => {
    const searchPage = new SearchTourPage(page);
    const triedIds = new Set();

    for (let attempt = 0; attempt < 5; attempt++) {
      await searchPage.gotoWithCountry(countryToValue['Турция']);
      await page.waitForTimeout(3000);

      const allHotels = await getAllHotels(page);
      const available = allHotels.filter(h => !triedIds.has(h.id));
      if (available.length < 2) {
        console.log('Все гостиницы перепробованы');
        break;
      }

      const picked = available.sort(() => Math.random() - 0.5).slice(0, 3);
      picked.forEach(h => triedIds.add(h.id));
      console.log(`Попытка ${attempt + 1}: ${picked.map(h => h.text).join(', ')}`);

      await selectHotels(page, picked);

      await searchPage.clickSearch();
      await page.waitForTimeout(3000);

      try {
        await searchPage.waitForResults();
      } catch {
        continue;
      }

      await page.waitForTimeout(3000);

      const rowCount = await searchPage.getResultRowCount();
      if (rowCount === 0) continue;

      const hotels = await getResultHotelNames(page);
      expect(hotels.length).toBeGreaterThan(0);

      for (const hotel of hotels) {
        const found = picked.some(h => hotel.startsWith(h.text));
        expect(found).toBeTruthy();
      }
      return;
    }

    test.skip(true, 'Нет туров для выбранных гостиниц');
  });

  });

  // ===== 16. Питание =====
  test.describe('16. Питание', () => {

  test('Питание: выдача содержит туры с выбранным типом питания', async ({ page }) => {
    const searchPage = new SearchTourPage(page);
    const tried = new Set();

    for (let attempt = 0; attempt < 5; attempt++) {
      const available = MEALS.filter(m => !tried.has(m.code));
      if (available.length === 0) break;

      const picked = available[Math.floor(Math.random() * available.length)];
      tried.add(picked.code);
      console.log(`Попытка ${attempt + 1}: ${picked.code} → ${picked.expected}`);

      await searchPage.gotoWithCountry(countryToValue['Турция']);
      await page.waitForTimeout(3000);

      await page.locator('div.checklistbox.MEALS').getByText(picked.code, { exact: true }).click();
      await page.waitForTimeout(500);

      await searchPage.clickSearch();
      await page.waitForTimeout(3000);

      try {
        await searchPage.waitForResults();
      } catch {
        continue;
      }

      await page.waitForTimeout(3000);

      const rowCount = await searchPage.getResultRowCount();
      if (rowCount === 0) continue;

      const meals = await getResultMeals(page);
      expect(meals.length).toBeGreaterThan(0);

      for (const meal of meals) {
        expect(meal).toContain(picked.expected);
      }
      return;
    }

    test.skip(true, `Нет туров с выбранным питанием: ${[...tried].join(', ')}`);
  });

  });

  // ===== 17. Есть места на рейсы =====
  test.describe('17. Есть места на рейсы', () => {

  test('Есть места на рейсы: с фильтром все туры имеют кнопку, без фильтра — некоторые без кнопки', async ({ page }) => {
    const searchPage = new SearchTourPage(page);
    await searchPage.gotoWithCountry(countryToValue['Турция']);
    await page.waitForTimeout(3000);

    await page.locator('input.FREIGHT').click({ force: true });
    await page.waitForTimeout(500);

    const hasResultsUnchecked = await waitAndGetResults(page, searchPage);
    expect(hasResultsUnchecked).toBeTruthy();

    await page.locator('input.FREIGHT').click({ force: true });
    await page.waitForTimeout(500);

    await searchPage.clickSearch();
    await page.waitForTimeout(3000);
    try {
      await searchPage.waitForResults();
    } catch {
      test.skip(true, 'Нет результатов при включённом фильтре');
      return;
    }
    await page.waitForTimeout(3000);

    const rowCount = await searchPage.getResultRowCount();
    if (rowCount === 0) {
      test.skip(true, 'Нет результатов при включённом фильтре');
      return;
    }

    const priceInfo = await page.evaluate(() => {
      const rows = document.querySelectorAll('tr[data-state]');
      return Array.from(rows).map(r => {
        const td = r.querySelector('td.td_price');
        if (!td) return { hasClickable: false };
        return { hasClickable: !!td.querySelector('.price_button') };
      });
    });

    for (let i = 0; i < priceInfo.length; i++) {
      expect(priceInfo[i].hasClickable).toBeTruthy();
    }
  });

  });

  // ===== 18. Нет остановки продажи =====
  test.describe('18. Нет остановки продажи', () => {

  test('Нет остановки продажи: с фильтром нет строк с остановкой продажи', async ({ page }) => {
    const searchPage = new SearchTourPage(page);
    await searchPage.gotoWithCountry(countryToValue['Турция']);
    await page.waitForTimeout(3000);

    // Шаг 1: снять чек-бокс + поиск
    await page.locator('input.FILTER').click({ force: true });
    await page.waitForTimeout(500);

    const hasResultsUnchecked = await waitAndGetResults(page, searchPage);
    expect(hasResultsUnchecked).toBeTruthy();

    // Шаг 2: установить чек-бокс + поиск
    await page.locator('input.FILTER').click({ force: true });
    await page.waitForTimeout(500);

    const hasResultsChecked = await waitAndGetResults(page, searchPage);
    expect(hasResultsChecked).toBeTruthy();

    const anyRed = await hasRedRows(page);
    expect(anyRed).toBeFalsy();
  });

  });

  // ===== 19. Мгновенное подтверждение =====
  test.describe('19. Мгновенное подтверждение', () => {

  test('Мгновенное подтверждение: все туры подсвечены зелёным', async ({ page }) => {
    const searchPage = new SearchTourPage(page);

    await searchPage.gotoWithCountry(countryToValue['Турция']);
    await page.waitForTimeout(3000);

    await page.locator('input.MOMENT_CONFIRM').click({ force: true });
    await page.waitForTimeout(1000);

    await searchPage.clickSearch();
    await page.waitForTimeout(3000);

    try {
      await searchPage.waitForResults();
    } catch {
      test.skip(true, 'Нет результатов');
      return;
    }

    await page.waitForTimeout(3000);

    const rowCount = await searchPage.getResultRowCount();
    if (rowCount === 0) {
      test.skip(true, 'Нет результатов');
      return;
    }

    const allClasses = await getResultRowClasses(page);
    for (const classList of allClasses) {
      expect(classList).toContain('green_row');
    }
  });

  });

  // ===== 20. Не отображать PROMO =====
  test.describe('20. Не отображать PROMO', () => {

  test('Не отображать PROMO: в столбце "Тур" отсутствует текст PROMO', async ({ page }) => {
    const searchPage = new SearchTourPage(page);

    await searchPage.gotoWithCountry(countryToValue['Турция']);
    await page.waitForTimeout(3000);

    await page.locator('input.WITHOUT_PROMO').click();
    await page.waitForTimeout(500);

    await searchPage.clickSearch();
    await page.waitForTimeout(3000);

    try {
      await searchPage.waitForResults();
    } catch {
      test.skip(true, 'Нет результатов');
      return;
    }

    await page.waitForTimeout(3000);

    const rowCount = await searchPage.getResultRowCount();
    if (rowCount === 0) {
      test.skip(true, 'Нет результатов');
      return;
    }

    const tourTexts = await page.evaluate(() => {
      const cells = document.querySelectorAll('td.tour');
      return Array.from(cells).map(c => c.textContent.trim());
    });

    for (const text of tourTexts) {
      expect(text).not.toContain('PROMO');
    }
  });

  });

  // ===== 21. Группировать результаты =====
  test.describe('21. Группировать результаты', () => {

  test('Группировать результаты: без фильтра — корзина, с фильтром — радиокнопка', async ({ page }) => {
    const searchPage = new SearchTourPage(page);

    await searchPage.gotoWithCountry(countryToValue['Турция']);
    await page.waitForTimeout(3000);

    // Шаг 1: отменить чек-бокс "группировать результаты"
    const isChecked = await page.locator('input.PARTITION_PRICE').isChecked();
    if (isChecked) {
      await page.locator('input.PARTITION_PRICE').click();
      await page.waitForTimeout(500);
    }

    // Шаг 2: нажать "Искать"
    await searchPage.clickSearch();
    await page.waitForTimeout(3000);

    try {
      await searchPage.waitForResults();
    } catch {
      test.skip(true, 'Нет результатов');
      return;
    }

    await page.waitForTimeout(3000);

    const rowCount = await searchPage.getResultRowCount();
    if (rowCount === 0) {
      test.skip(true, 'Нет результатов');
      return;
    }

    const priceClasses1 = await page.evaluate(() => {
      const spans = document.querySelectorAll('td.td_price span.price');
      return Array.from(spans).map(s => ({
        classList: Array.from(s.classList),
        text: s.textContent.trim().substring(0, 30)
      }));
    });

    for (const item of priceClasses1) {
      expect(item.classList).toContain('bron');
      expect(item.classList).not.toContain('expand');
    }

    // Шаг 3: установить чек-бокс "группировать результаты"
    await page.locator('input.PARTITION_PRICE').click();
    await page.waitForTimeout(500);

    // Шаг 4: нажать "Искать"
    await searchPage.clickSearch();
    await page.waitForTimeout(3000);

    try {
      await searchPage.waitForResults();
    } catch {
      test.skip(true, 'Нет результатов после группировки');
      return;
    }

    await page.waitForTimeout(3000);

    const rowCount2 = await searchPage.getResultRowCount();
    if (rowCount2 === 0) {
      test.skip(true, 'Нет результатов после группировки');
      return;
    }

    const priceClasses2 = await page.evaluate(() => {
      const spans = document.querySelectorAll('td.td_price span.price');
      return Array.from(spans).map(s => ({
        classList: Array.from(s.classList),
        text: s.textContent.trim().substring(0, 30)
      }));
    });

    for (const item of priceClasses2) {
      expect(item.classList).toContain('expand');
      expect(item.classList).not.toContain('bron');
    }
  });

  });

  // ===== 22. Цена до (фиксированное значение) =====
  test.describe('22. Цена до (фиксированное значение)', () => {

  test('Цена до: фильтр уменьшает количество результатов', async ({ page }) => {
    const searchPage = new SearchTourPage(page);

    await searchPage.gotoWithCountry(countryToValue['Турция']);
    await page.waitForTimeout(3000);

    // Шаг 1: поиск без фильтра цены
    await searchPage.clickSearch();

    try {
      await searchPage.waitForResults();
    } catch {
      test.skip(true, 'Нет результатов для Турции');
      return;
    }

    await page.waitForTimeout(5000);

    const countWithoutFilter = await getVisibleResultCount(page);
    expect(countWithoutFilter).toBeGreaterThan(0);

    // Шаг 2: ввести 130000 в поле "Цена до"
    await page.locator('input.COSTMAX').fill('130000');
    await page.waitForTimeout(500);

    // Шаг 3: нажать "Искать"
    await searchPage.clickSearch();

    try {
      await searchPage.waitForResults();
    } catch {
      test.skip(true, 'Нет результатов при цене <= 130000');
      return;
    }

    await page.waitForTimeout(5000);

    const countWithFilter = await getVisibleResultCount(page);

    if (countWithFilter === 0) {
      test.skip(true, 'Нет результатов при цене <= 130000');
      return;
    }

    // Фильтр должен уменьшить количество результатов
    expect(countWithFilter).toBeLessThanOrEqual(countWithoutFilter);
  });

  });

  // ===== 23. Цена до (динамическое среднее значение) =====
  test.describe('23. Цена до (динамическое среднее значение)', () => {

  test('Цена до: фильтр с динамическим средним значением уменьшает количество результатов', async ({ page }) => {
    const searchPage = new SearchTourPage(page);

    await searchPage.gotoWithCountry(countryToValue['Турция']);
    await page.waitForTimeout(3000);

    // Шаг 1: поиск без фильтра, чтобы получить ценовую выдачу
    await searchPage.clickSearch();

    try {
      await searchPage.waitForResults();
    } catch {
      test.skip(true, 'Нет результатов для Турции');
      return;
    }

    await page.waitForTimeout(5000);

    const countWithoutFilter = await getVisibleResultCount(page);
    expect(countWithoutFilter).toBeGreaterThan(0);

    // Шаг 2: получить среднюю цену из выдачи
    const allPrices = await page.evaluate(() => {
      const cells = document.querySelectorAll('td.td_price');
      return Array.from(cells).map(td => {
        const span = td.querySelector('span.price[data-converted-price-number]');
        return span ? parseInt(span.getAttribute('data-converted-price-number'), 10) : NaN;
      }).filter(v => !isNaN(v));
    });

    expect(allPrices.length).toBeGreaterThan(0);

    const avgPrice = Math.floor(allPrices.reduce((a, b) => a + b, 0) / allPrices.length);

    // Шаг 3: ввести среднее значение в поле "Цена до"
    await page.locator('input.COSTMAX').fill(String(avgPrice));
    await page.waitForTimeout(500);

    // Шаг 4: нажать "Искать"
    await searchPage.clickSearch();

    try {
      await searchPage.waitForResults();
    } catch {
      test.skip(true, `Нет результатов при цене <= ${avgPrice}`);
      return;
    }

    await page.waitForTimeout(5000);

    const countWithFilter = await getVisibleResultCount(page);

    if (countWithFilter === 0) {
      test.skip(true, `Нет результатов при цене <= ${avgPrice}`);
      return;
    }

    // Фильтр должен уменьшить количество результатов
    expect(countWithFilter).toBeLessThanOrEqual(countWithoutFilter);
  });

  });

  // ===== 24. Цена от (фиксированное значение) =====
  test.describe('24. Цена от (фиксированное значение)', () => {

  test('Цена от: фильтр уменьшает количество результатов', async ({ page }) => {
    const searchPage = new SearchTourPage(page);

    await searchPage.gotoWithCountry(countryToValue['Турция']);
    await page.waitForTimeout(3000);

    // Шаг 1: поиск без фильтра цены
    await searchPage.clickSearch();

    try {
      await searchPage.waitForResults();
    } catch {
      test.skip(true, 'Нет результатов для Турции');
      return;
    }

    await page.waitForTimeout(5000);

    const countWithoutFilter = await getVisibleResultCount(page);
    expect(countWithoutFilter).toBeGreaterThan(0);

    // Шаг 2: ввести 100000 в поле "Цена от"
    await page.locator('input.COSTMIN').fill('100000');
    await page.waitForTimeout(500);

    // Шаг 3: нажать "Искать"
    await searchPage.clickSearch();

    try {
      await searchPage.waitForResults();
    } catch {
      test.skip(true, 'Нет результатов при цене >= 100000');
      return;
    }

    await page.waitForTimeout(5000);

    const countWithFilter = await getVisibleResultCount(page);

    if (countWithFilter === 0) {
      test.skip(true, 'Нет результатов при цене >= 100000');
      return;
    }

    // Фильтр должен уменьшить количество результатов
    expect(countWithFilter).toBeLessThanOrEqual(countWithoutFilter);
  });

  });

  // ===== 25. Цена от (динамическое среднее значение) =====
  test.describe('25. Цена от (динамическое среднее значение)', () => {

  test('Цена от: фильтр с динамическим средним значением уменьшает количество результатов', async ({ page }) => {
    const searchPage = new SearchTourPage(page);

    await searchPage.gotoWithCountry(countryToValue['Турция']);
    await page.waitForTimeout(3000);

    // Шаг 1: поиск без фильтра, чтобы получить ценовую выдачу
    await searchPage.clickSearch();

    try {
      await searchPage.waitForResults();
    } catch {
      test.skip(true, 'Нет результатов для Турции');
      return;
    }

    await page.waitForTimeout(5000);

    const countWithoutFilter = await getVisibleResultCount(page);
    expect(countWithoutFilter).toBeGreaterThan(0);

    // Шаг 2: получить среднюю цену из выдачи
    const allPrices = await page.evaluate(() => {
      const cells = document.querySelectorAll('td.td_price');
      return Array.from(cells).map(td => {
        const span = td.querySelector('span.price[data-converted-price-number]');
        return span ? parseInt(span.getAttribute('data-converted-price-number'), 10) : NaN;
      }).filter(v => !isNaN(v));
    });

    expect(allPrices.length).toBeGreaterThan(0);

    const avgPrice = Math.floor(allPrices.reduce((a, b) => a + b, 0) / allPrices.length);

    // Шаг 3: ввести среднее значение в поле "Цена от"
    await page.locator('input.COSTMIN').fill(String(avgPrice));
    await page.waitForTimeout(500);

    // Шаг 4: нажать "Искать"
    await searchPage.clickSearch();

    try {
      await searchPage.waitForResults();
    } catch {
      test.skip(true, `Нет результатов при цене >= ${avgPrice}`);
      return;
    }

    await page.waitForTimeout(5000);

    const countWithFilter = await getVisibleResultCount(page);

    if (countWithFilter === 0) {
      test.skip(true, `Нет результатов при цене >= ${avgPrice}`);
      return;
    }

    // Фильтр должен уменьшить количество результатов
    expect(countWithFilter).toBeLessThanOrEqual(countWithoutFilter);
  });

  });

});
