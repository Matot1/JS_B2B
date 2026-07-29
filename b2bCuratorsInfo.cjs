const { chromium } = require('playwright');
require('dotenv').config();
const { sendMattermost } = require('./notify.cjs');
const LoginPage = require('./object/loginPage.cjs');
const CuratorsPage = require('./object/curatorsPage.cjs');

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

    await page.goto('https://b2b.fstravel.com/partner_curator', { waitUntil: 'networkidle', timeout: 60000 });

    const curators = new CuratorsPage(page);

    const results = [];
    console.log('Тест "Информация о кураторах" запущен');

    const blocks = [
      'Обращения по пакетам на чартерных или блочных перелетах, по наземному обслуживанию, массовые направления',
      'Обращения по пакетам на регулярных рейсах (GDS) с вылетом из Москвы, по индивидуальному бронированию, а также пакетам, забронированным через раздел "Конструктор" (SL-пакеты), круизы',
      'Для вылетов из Москвы',
      'Для вылетов из регионов',
      'Кураторы агентств, участвующих в партнерских программах FUN&SUN',
      'Кураторы Gold Club (sales8@fstravel.com)',
      'Кураторы сетевых агентств (sales7@fstravel.com)',
      'Кураторы Silver Club (silverclub@fstravel.com)',
      'Кураторы независимых агентств (sales3@fstravel.com)',
      'Обращения по пакетам PPEMIUM',
    ];

    for (const block of blocks) {
      await curators.clickBlock(block);
      const msg = `✅ Блок "${block}" нажат`;
      console.log(msg);
      results.push(msg);
    }

    await page.goto('https://b2b.fstravel.com/agreement', { waitUntil: 'networkidle', timeout: 60000 });
    console.log('✅ Переход на страницу agreement');

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.locator('a.link.print.dog', { hasText: 'копия' }).click(),
    ]);
    const filePath = await download.path();
    console.log(`✅ Файл скачан: ${filePath}`);

    try {
      require('fs').unlinkSync(filePath);
      console.log(`✅ Файл удалён: ${filePath}`);
    } catch (e) {
      console.log(`❌ Не удалось удалить файл: ${e.message}`);
    }

    const reportMsg = [
      'Отчет теста "Информация о кураторах и печать договора"',
      '✅  Информация о кураторах содержится и отображается корректно.',
      '✅  Договор присутствует и загружается',
    ].join('\n');
    console.log(reportMsg);
    await sendMattermost(reportMsg);

    console.log('Браузер остаётся открытым на 20 секунд для проверки.');
    await page.waitForTimeout(20000).catch(() => {});
    await browser.close().catch(() => {});
  } catch (err) {
    console.error('Ошибка:', err.message);
    await sendMattermost(`Отчет теста "Информация о кураторах и печать договора"\nОшибка: ${err.message}`);
    if (typeof page !== 'undefined') await browser.close().catch(() => {});
  }
})();
