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

  try {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(process.env.LOGIN, process.env.PASSWORD);

    await page.goto('https://b2b.fstravel.com/hotel_stopsale', { waitUntil: 'networkidle', timeout: 60000 });

    const containers = page.locator('.chosen-container');
    const exclude = ['Андорра', 'Армения', 'Болгария', 'Венгрия', 'Камбоджа', 'Киргизия', 'Марокко', 'Португалия', 'Сербия', 'Южная Корея', 'Япония'];
    const selectedCountries = [];
    const selectedCities = [];
    const selectedHotels = [];

    for (let i = 0; i < 3; i++) {
      await containers.nth(0).locator('.chosen-single').click();
      await page.waitForTimeout(300);
      await containers.nth(0).locator('.active-result:has-text("Москва")').click();
      await page.waitForTimeout(2000);

      await containers.nth(1).locator('.chosen-single').click();
      await page.waitForTimeout(500);
      const countryOptions = await containers.nth(1).locator('.active-result').allTextContents();
      const filtered = countryOptions.filter(c => !exclude.includes(c.trim()));
      const randomCountry = filtered[Math.floor(Math.random() * filtered.length)];
      selectedCountries.push(randomCountry.trim());
      await containers.nth(1).locator(`.active-result:has-text("${randomCountry}")`).click();
      console.log(`✅ Попытка ${i + 1}: страна ${randomCountry}`);
      await page.waitForTimeout(2000);

      await containers.nth(2).locator('.chosen-single').click();
      await page.waitForTimeout(500);
      const cityOptions = await containers.nth(2).locator('.active-result').allTextContents();
      const filteredCities = cityOptions.filter(c => c.trim() !== '----');
      const randomCity = filteredCities[Math.floor(Math.random() * filteredCities.length)];
      const cityOption = containers.nth(2).locator('.active-result').filter({ hasText: new RegExp(`^${randomCity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) });
      await cityOption.click();
      selectedCities.push(randomCity.trim());
      console.log(`✅ Попытка ${i + 1}: город ${randomCity}`);
      await page.waitForTimeout(2000);

      await page.locator('button:has-text("Искать")').click();
      await page.waitForTimeout(5000);
      console.log(`✅ Попытка ${i + 1}: поиск выполнен`);
    }

    for (let i = 0; i < 3; i++) {
      await containers.nth(0).locator('.chosen-single').click();
      await page.waitForTimeout(300);
      await containers.nth(0).locator('.active-result:has-text("Москва")').click();
      await page.waitForTimeout(2000);

      await containers.nth(1).locator('.chosen-single').click();
      await page.waitForTimeout(500);
      const countryOptions = await containers.nth(1).locator('.active-result').allTextContents();
      const filtered = countryOptions.filter(c => !exclude.includes(c.trim()));
      const randomCountry = filtered[Math.floor(Math.random() * filtered.length)];
      await containers.nth(1).locator(`.active-result:has-text("${randomCountry}")`).click();
      console.log(`✅ Фильтр гостиница, попытка ${i + 1}: страна ${randomCountry}`);
      await page.waitForTimeout(2000);

      await containers.nth(2).locator('.chosen-single').click();
      await page.waitForTimeout(500);
      const cityOptions = await containers.nth(2).locator('.active-result').allTextContents();
      const randomCity = cityOptions[Math.floor(Math.random() * cityOptions.length)];
      const cityOption = containers.nth(2).locator('.active-result').filter({ hasText: new RegExp(`^${randomCity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) });
      await cityOption.click();
      console.log(`✅ Фильтр гостиница, попытка ${i + 1}: город ${randomCity}`);
      await page.waitForTimeout(2000);

      await containers.nth(3).locator('.chosen-single').click();
      await page.waitForTimeout(500);
      const hotelChosen = containers.nth(3);
      if (await hotelChosen.locator('.chosen-single').count() > 0) {
        await hotelChosen.locator('.chosen-single').click();
        await page.waitForTimeout(500);
        const hotelOptions = await hotelChosen.locator('.active-result').allTextContents();
        const filteredHotels = hotelOptions.filter(h => h.trim() !== '----');
        if (filteredHotels.length > 0) {
          const randomHotel = filteredHotels[Math.floor(Math.random() * filteredHotels.length)];
          await page.evaluate((hotelText) => {
            const container = document.querySelectorAll('.chosen-container')[3];
            if (!container) return;
            const items = container.querySelectorAll('.active-result');
            for (const item of items) {
              if (item.textContent.trim() === hotelText.trim()) {
                item.click();
                break;
              }
            }
          }, randomHotel);
          selectedHotels.push(randomHotel.trim());
          console.log(`✅ Фильтр гостиница, попытка ${i + 1}: отель ${randomHotel}`);
        } else {
          console.log(`⚠️ Фильтр гостиница, попытка ${i + 1}: нет доступных отелей`);
        }
      } else {
        console.log(`⚠️ Фильтр гостиница, попытка ${i + 1}: фильтр отсутствует`);
      }
      await page.waitForTimeout(2000);

      await page.locator('button:has-text("Искать")').click();
      await page.waitForTimeout(5000);
      console.log(`✅ Фильтр гостиница, попытка ${i + 1}: поиск выполнен`);
    }

    await page.goto('https://b2b.fstravel.com/hotel_stopsale', { waitUntil: 'networkidle', timeout: 60000 });
    await page.locator('.chosen-container').first().locator('.chosen-single').waitFor({ state: 'visible', timeout: 15000 });

    const fixedCountries = ['Египет', 'Турция', 'Таиланд'];
    for (const country of fixedCountries) {
      await containers.nth(0).locator('.chosen-single').click();
      await page.waitForTimeout(300);
      await containers.nth(0).locator('.active-result:has-text("Москва")').click();
      await page.waitForTimeout(2000);

      await containers.nth(1).locator('.chosen-single').click();
      await page.waitForTimeout(500);
      await containers.nth(1).locator(`.active-result:has-text("${country}")`).click();
      await page.waitForTimeout(2000);

      await containers.nth(2).locator('.chosen-single').click();
      await page.waitForTimeout(500);
      const cityOptions = await containers.nth(2).locator('.active-result').allTextContents();
      const filteredCities = cityOptions.filter(c => c.trim() !== '----');
      const randomCity = filteredCities[Math.floor(Math.random() * filteredCities.length)];
      const cityOption = containers.nth(2).locator('.active-result').filter({ hasText: new RegExp(`^${randomCity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) });
      await cityOption.click();
      await page.waitForTimeout(2000);

      await page.locator('button:has-text("Искать")').click();
      await page.waitForTimeout(5000);
    }

    const reportMsg = [
      'Отчет теста "Остановка продаж в гостиницах"',
      `✅ Выполнен поиск по фильтру Страна со странами (${selectedCountries.join(', ')}) (выбраны рандомно)`,
      `✅ Выполнен поиск по фильтру Город (${selectedCities.join(', ')}) (выбрано рандомно)`,
      `✅ Выполнен поиск по фильтру Гостиница (${selectedHotels.join(', ')}) (выбрано рандомно)`,
    ].join('\n');
    console.log(reportMsg);
    await sendMattermost(reportMsg);

    await browser.close();
  } catch (err) {
    console.error('Ошибка:', err.message);
    if (typeof page !== 'undefined') await browser.close();
  }
})();
