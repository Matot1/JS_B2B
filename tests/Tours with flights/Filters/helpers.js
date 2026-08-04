export const monthNames = {
  'Январь': 0, 'Февраль': 1, 'Март': 2, 'Апрель': 3, 'Май': 4, 'Июнь': 5,
  'Июль': 6, 'Август': 7, 'Сентябрь': 8, 'Октябрь': 9, 'Ноябрь': 10, 'Декабрь': 11,
};

export function parseMonthYear(str) {
  const parts = str.replace(/[,]/g, '').trim().split(/\s+/);
  if (parts.length < 2) return null;
  const month = monthNames[parts[0]];
  const year = parseInt(parts[1], 10);
  if (isNaN(month) || isNaN(year)) return null;
  return { month, year };
}

export async function getTourTexts(page) {
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

export async function getTourAndPriceTexts(page) {
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

export async function getVisibleResultCount(page) {
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll('tr[data-state]'))
      .filter(tr => tr.getBoundingClientRect().height > 0).length;
  });
}

export async function setCurrency(page, value) {
  const optionIndex = value === 'RUB' ? 0 : 1;
  await page.locator('.CURRENCY_chosen .chosen-single').click();
  await page.waitForTimeout(300);
  await page.locator(`.CURRENCY_chosen .active-result[data-option-array-index="${optionIndex}"]`).click();
  await page.waitForTimeout(500);
}

export async function searchAndGetPrices(page, searchPage) {
  await searchPage.clickSearch();
  await page.waitForTimeout(3000);
  try {
    await searchPage.waitForResults();
  } catch {
    return null;
  }
  await page.waitForTimeout(3000);
  const rowCount = await searchPage.getResultRowCount();
  if (rowCount === 0) return null;
  return page.evaluate(() => {
    const rows = document.querySelectorAll('tr[data-state]');
    return Array.from(rows).map(r => {
      const td = r.querySelector('td.td_price');
      if (!td) return '';
      const span = td.querySelector('span');
      if (span) return span.textContent.trim();
      return td.textContent.trim();
    }).filter(Boolean);
  });
}

export async function setChild(page, value) {
  await page.locator('.CHILD_chosen .chosen-single').click();
  await page.waitForTimeout(300);
  await page.locator(`.CHILD_chosen .active-result[data-option-array-index="${value}"]`).click();
  await page.waitForTimeout(500);
}

export async function setAge(page, ageIndex, value) {
  const ageContainer = page.locator('.child_ages .chosen-container').nth(ageIndex);
  await ageContainer.locator('.chosen-single').click();
  await page.waitForTimeout(300);
  await ageContainer.locator(`.active-result[data-option-array-index="${value}"]`).click();
  await page.waitForTimeout(500);
}

export async function getHotelRoomTexts(page) {
  return page.evaluate(() => {
    const rows = document.querySelectorAll('tr[data-state]');
    return Array.from(rows).map(r => {
      const td = r.querySelector('td.hotel-room');
      if (!td) return '';
      return td.textContent.trim();
    }).filter(Boolean);
  });
}

export async function searchAndGetTexts(page, searchPage) {
  await searchPage.clickSearch();
  await page.waitForTimeout(3000);
  try {
    await searchPage.waitForResults();
  } catch {
    return null;
  }
  await page.waitForTimeout(3000);
  const rowCount = await searchPage.getResultRowCount();
  if (rowCount === 0) return null;
  return getHotelRoomTexts(page);
}

export const GROUP_CITIES = [
  'Аланья', 'Анталья', 'Белек', 'Бодрум',
  'Даламан', 'Кемер', 'Мармарис', 'Сиде',
  'Стамбул', 'Фетхие',
];

export async function getHotelCities(page) {
  return page.evaluate(() => {
    const rows = document.querySelectorAll('tr[data-state]');
    return Array.from(rows).map(r => {
      const td = r.querySelector('td.link-hotel');
      if (!td) return '';
      const match = td.textContent.trim().match(/\(([^)]+)\)/);
      return match ? match[1].trim() : '';
    }).filter(Boolean);
  });
}

export const STAR_VALUES = { '2*': '10002', '3*': '10003', '4*': '10004', '5*': '10005' };

export async function searchAndGetHotels(page, searchPage) {
  await searchPage.clickSearch();
  await page.waitForTimeout(3000);
  try {
    await searchPage.waitForResults();
  } catch {
    return null;
  }
  await page.waitForTimeout(3000);
  const rowCount = await searchPage.getResultRowCount();
  if (rowCount === 0) return null;
  return page.evaluate(() => {
    const rows = document.querySelectorAll('tr[data-state]');
    return Array.from(rows).map(r => {
      const td = r.querySelector('td.link-hotel');
      if (!td) return '';
      return td.textContent.trim();
    }).filter(Boolean);
  });
}

export async function getAllHotels(page) {
  await page.waitForFunction(() => {
    const labels = document.querySelectorAll('div.checklistbox.HOTELS label');
    let count = 0;
    for (const label of labels) {
      const cb = label.querySelector('input[type="checkbox"]');
      if (cb && cb.id.startsWith('hotel')) count++;
    }
    return count > 5;
  }, { timeout: 10000 }).catch(() => {});
  return page.evaluate(() => {
    const labels = document.querySelectorAll('div.checklistbox.HOTELS label');
    const result = [];
    for (const label of labels) {
      const cb = label.querySelector('input[type="checkbox"]');
      const text = label.textContent.trim();
      if (cb && text && cb.id.startsWith('hotel')) {
        result.push({ id: cb.id, text });
      }
    }
    return result;
  });
}

export async function selectHotels(page, hotels) {
  for (const hotel of hotels) {
    await page.locator(`#${hotel.id}`).click({ force: true });
    await page.waitForTimeout(300);
  }
}

export async function getResultHotelNames(page) {
  return page.evaluate(() => {
    const rows = document.querySelectorAll('tr[data-state]');
    return Array.from(rows).map(r => {
      const td = r.querySelector('td.link-hotel');
      if (!td) return '';
      return td.textContent.trim();
    }).filter(Boolean);
  });
}

export const MEALS = [
  { code: 'AI', expected: 'All Inclusive' },
  { code: 'BB', expected: 'Bed & Breakfast' },
  { code: 'FB', expected: 'Full Board' },
  { code: 'HB', expected: 'Half Board' },
  { code: 'RO', expected: 'Room Only' },
  { code: 'UAI', expected: 'Ultra All Inclusive' },
];

export async function getResultMeals(page) {
  return page.evaluate(() => {
    const rows = document.querySelectorAll('tr[data-state]');
    return Array.from(rows).map(r => {
      const td = r.querySelector('td.hotel-meals');
      if (!td) return '';
      return td.textContent.trim();
    }).filter(Boolean);
  });
}

export async function waitAndGetResults(page, searchPage) {
  await searchPage.clickSearch();
  await page.waitForTimeout(3000);
  try {
    await searchPage.waitForResults();
  } catch {
    return false;
  }
  await page.waitForTimeout(3000);
  const count = await searchPage.getResultRowCount();
  return count > 0;
}

export async function hasRedRows(page) {
  return page.evaluate(() => {
    const rows = document.querySelectorAll('tr[data-state]');
    return Array.from(rows).some(r => r.classList.contains('red_row'));
  });
}

export async function getResultRowClasses(page) {
  return page.evaluate(() => {
    const rows = document.querySelectorAll('tr[data-state]');
    return Array.from(rows).map(r => Array.from(r.classList));
  });
}
