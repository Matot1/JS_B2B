const { chromium } = require('playwright');
require('dotenv').config();
const { sendMattermost } = require('./notify.cjs');
const LoginPage = require('./object/loginPage.cjs');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
  });
  const page = await context.newPage();

  const containers = page.locator('.chosen-container');
  const results = [];

  async function currentFirstRowText() {
    const firstRow = page.locator('.resultset table tbody tr').first();
    if ((await firstRow.count()) === 0) return '';
    return (await firstRow.innerText()).trim();
  }

  async function assertResults(label, prevFirstRow) {
    const rows = page.locator('.resultset table tbody tr');
    const noData = page.locator('div.resultset').filter({ hasText: 'Нет данных' });
    const started = Date.now();

    while (Date.now() - started < 15000) {
      const rowCount = await rows.count();
      const firstRow = rowCount > 0 ? (await rows.first().innerText()).trim() : '';
      if (rowCount > 0) {
        if (prevFirstRow === undefined || firstRow !== prevFirstRow) {
          const msg = `${label}: найдено строк: ${rowCount}`;
          results.push(msg);
          console.log(`✅ ${msg}`);
          return;
        }
      }
      if (await noData.isVisible()) {
        const msg = `${label}: нет данных (уточните параметры поиска)`;
        results.push(msg);
        console.log(`✅ ${msg}`);
        return;
      }
      await page.waitForTimeout(500);
    }

    throw new Error(`${label}: не появилась ни таблица результатов, ни надпись "Нет данных"`);
  }

  async function selectChosenOption(containerIndex, text) {
    const container = containers.nth(containerIndex);
    await container.locator('.chosen-single').click();
    await page.waitForTimeout(500);
    const option = container.locator('.active-result').filter({ hasText: text });
    await option.first().waitFor({ state: 'visible', timeout: 10000 });
    await option.first().click();
    await page.waitForTimeout(2000);
  }

  async function selectRandomHotel(prevHotel) {
    const hotelChosen = containers.nth(3);
    await hotelChosen.locator('.chosen-single').click();
    await page.waitForTimeout(500);
    const hotelOptions = await hotelChosen.locator('.active-result').allTextContents();
    let available = hotelOptions.map((h) => h.trim()).filter((h) => h && h !== '----');
    if (available.length === 0) throw new Error('Нет доступных гостиниц для выбора');
    if (prevHotel) {
      const different = available.filter((h) => h !== prevHotel);
      if (different.length > 0) available = different;
    }
    const randomHotel = available[Math.floor(Math.random() * available.length)];
    const option = hotelChosen.locator('.active-result').filter({ hasText: randomHotel });
    await option.first().click();
    await page.waitForTimeout(1500);
    return randomHotel;
  }

  try {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(process.env.LOGIN, process.env.PASSWORD);

    await page.goto('https://b2b.fstravel.com/hotel_stopsale', { waitUntil: 'networkidle', timeout: 60000 });

    await selectChosenOption(0, 'Москва');
    await selectChosenOption(1, 'ОАЭ');
    await selectChosenOption(2, 'Абу-Даби');

    await page.locator('button:has-text("Искать")').click();
    await page.waitForTimeout(3000);

    await assertResults('Шаг 1: Страна ОАЭ, Город Абу-Даби');

    await selectChosenOption(0, 'Санкт-Петербург');
    await selectChosenOption(1, 'Египет');
    await selectChosenOption(2, 'Шарм-эль-Шейх');

    const hotel1 = await selectRandomHotel();
    console.log(`✅ Блок 2: выбрана гостиница ${hotel1}`);
    const prev1 = await currentFirstRowText();
    await page.locator('button:has-text("Искать")').click();
    await page.waitForTimeout(3000);
    await assertResults(`Шаг 2: Страна Египет, Город Шарм-эль-Шейх, Гостиница ${hotel1}`, prev1);

    const hotel2 = await selectRandomHotel(hotel1);
    console.log(`✅ Блок 2: выбрана гостиница ${hotel2}`);
    const prev2 = await currentFirstRowText();
    await page.locator('button:has-text("Искать")').click();
    await page.waitForTimeout(3000);
    await assertResults(`Шаг 3: Страна Египет, Город Шарм-эль-Шейх, Гостиница ${hotel2}`, prev2);

    const reportMsg = ['Отчет теста "Остановка продаж в гостиницах"', ...results].join('\n');
    console.log(reportMsg);
    await sendMattermost(reportMsg);

    await browser.close();
  } catch (err) {
    console.error('Ошибка:', err.message);
    await sendMattermost(`Отчет теста "Остановка продаж в гостиницах"\nОшибка: ${err.message}`);
    if (typeof page !== 'undefined') await browser.close();
  }
})();
