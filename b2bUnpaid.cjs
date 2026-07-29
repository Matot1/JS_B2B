const { chromium } = require('playwright');
require('dotenv').config();
const { sendMattermost } = require('./notify.cjs');
const LoginPage = require('./object/loginPage.cjs');
const UnpaidPage = require('./object/unpaidPage.cjs');

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

    await page.goto('https://b2b.fstravel.com/claim_unpaid', { waitUntil: 'networkidle', timeout: 60000 });

    const unpaid = new UnpaidPage(page);
    const results = [];
    await unpaid.clickSearch();
    const emptyFound = await unpaid.hasResults();
    const emptyMsg = emptyFound ? '✅ Поиск без фильтров успешен.' : '✅ Поиск без фильтров: заявок нет.';
    console.log(emptyMsg);
    results.push(emptyMsg);

    await unpaid.selectCommissionFilter('за раннее бронирование');
    await unpaid.clickSearch();
    const commissionFound = await unpaid.hasResults();
    const commissionMsg = commissionFound ? '✅ Поиск по комиссии успешен.' : '✅ Поиск по комиссии: заявок нет.';
    console.log(commissionMsg);
    results.push(commissionMsg);

    await unpaid.selectCommissionFilter('---');

    const periods = ['В ближайшее время', 'просрочена оплата'];
    for (const period of periods) {
      await unpaid.selectPeriodFilter(period);
      await unpaid.clickSearch();
      const found = await unpaid.hasResults();
      const periodMsg = found ? `✅ Поиск по "${period}" успешен.` : `✅ Поиск по "${period}": заявок нет.`;
      console.log(periodMsg);
      results.push(periodMsg);
    }

    await unpaid.selectPeriodFilter('---');

    const claims = await unpaid.getClaimNumbers();
    if (claims.length > 0) {
      const randomClaim = claims[Math.floor(Math.random() * claims.length)];
      await unpaid.enterClaimNumber(randomClaim);
      await unpaid.clickSearchFast();
      const claimFound = await unpaid.hasResults();
      const claimMsg = claimFound ? `✅ Поиск по заявке ${randomClaim} успешен.` : `✅ Поиск по заявке ${randomClaim}: заявок нет.`;
      console.log(claimMsg);
      results.push(claimMsg);
    }

    const reportMsg = `Отчет теста "Поиск неоплаченных заявок"\n${results.join('\n')}`;
    console.log(reportMsg);
    await sendMattermost(reportMsg);

    await browser.close();
  } catch (err) {
    console.error('Ошибка:', err.message);
    await sendMattermost(`Отчет теста "Поиск неоплаченных заявок"\nОшибка: ${err.message}`);
    if (typeof page !== 'undefined') await browser.close();
  }
})();
