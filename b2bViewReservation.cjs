const { chromium } = require('playwright');
require('dotenv').config();
const { sendMattermost } = require('./notify.cjs');
const LoginPage = require('./object/loginPage.cjs');
const ViewReservationPage = require('./object/viewReservationPage.cjs');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
  });
  const page = await context.newPage();
  let currentStep = '';
  const results = [];

  try {
    currentStep = 'Авторизация';
    const login = new LoginPage(page);
    await login.goto();
    await login.login(process.env.LOGIN, process.env.PASSWORD);

    currentStep = 'Переход на страницу заявок';
    const view = new ViewReservationPage(page);
    await view.goto();

    const statusFilters = ['Актуальные', 'Не подтвержденные', 'Отменённые', 'Предварительные', 'Все'];
    for (const filter of statusFilters) {
      currentStep = `Выбор фильтра "${filter}"`;
      await view.selectFilter(filter);

      currentStep = `Поиск заявок "${filter}"`;
      await view.clickSearch();

      await view.hasResults();
    }

    const paymentStatuses = ['Не оплачена', 'Оплачена', 'С переплатой', 'С просроченной оплатой', 'Частичная оплата'];
    for (const status of paymentStatuses) {
      currentStep = `Выбор статуса оплаты "${status}"`;
      await view.selectPaymentFilter(status);

      currentStep = `Поиск заявок со статусом "${status}"`;
      await view.clickSearch();

      await view.hasResults();
    }

    currentStep = 'Сброс фильтра оплаты';
    await view.selectPaymentFilter('---');

    const countries = ['Египет', 'Турция', 'ОАЭ'];
    for (const country of countries) {
      currentStep = `Выбор страны "${country}"`;
      await view.selectCountryFilter(country);

      currentStep = `Поиск заявок по стране "${country}"`;
      await view.clickSearch();

      await view.hasResults();
    }
    await view.selectCountryFilter('---');
    results.push('✅ Фильтры по статусам заявки, оплаты и странам Египет, Турция, ОАЭ работают.');

    const managers = await view.getManagerOptions();
    const shuffled = managers.sort(() => Math.random() - 0.5).slice(0, 3);
    for (const manager of shuffled) {
      currentStep = `Выбор менеджера "${manager}"`;
      await view.selectManagerFilter(manager);

      currentStep = `Поиск заявок менеджера "${manager}"`;
      await view.clickSearch();

      await view.hasResults();
    }
    results.push(`✅ Фильтры по менеджерам ${shuffled.join(', ')} работают (выбраны рандомно).`);
    await view.selectManagerFilter('---');

    const operators = await view.getOperatorOptions();
    const shuffledOps = operators.sort(() => Math.random() - 0.5).slice(0, 3);
    for (const op of shuffledOps) {
      currentStep = `Выбор оператора "${op}"`;
      await view.selectOperatorFilter(op);

      currentStep = `Поиск заявок оператора "${op}"`;
      await view.clickSearch();

      await view.hasResults();
    }
    results.push(`✅ Фильтры по операторам ${shuffledOps.join(', ')} работают (выбраны рандомно).`);

    currentStep = 'Сброс фильтра оператора';
    await view.selectOperatorFilter('---');

    currentStep = 'Поиск для получения номера заявки';
    await view.clickSearch();

    const claimNumber = await view.getFirstClaimNumber();
    if (claimNumber) {
      currentStep = 'Ввод номера заявки';
      await view.enterClaimNumber(claimNumber);

      currentStep = 'Поиск по номеру заявки';
      await view.clickSearch();

      await view.hasResults();
      results.push(`✅ Поиск по номеру заявки ${claimNumber} выполнен.`);
    } else {
      results.push('⚠️ Номер заявки не найден.');
    }

    currentStep = 'Очистка номера заявки';
    await view.clearClaimNumber();

    currentStep = 'Установка даты заезда';
    await view.setCheckinDate('01.07.2026');

    await view.clickSearch();
    await view.hasResults();

    currentStep = 'Очистка даты заезда с';
    await view.clearCheckinDate();

    currentStep = 'Установка даты заезда по';
    await view.setCheckinEndDate('13.07.2026');

    await view.clickSearch();
    await view.hasResults();

    currentStep = 'Очистка даты заезда по';
    await view.clearCheckinEndDate();

    currentStep = 'Установка даты создания с';
    await view.setCreationDate('10.07.2026');

    await view.clickSearch();
    await view.hasResults();

    currentStep = 'Очистка даты создания с';
    await view.clearCreationDate();

    currentStep = 'Установка даты создания по';
    await view.setCreationEndDate('13.07.2026');

    await view.clickSearch();
    await view.hasResults();
    results.push('✅ Поиск по датам заезда и создания выполнен.');

    currentStep = 'Очистка даты создания по';
    await view.clearCreationEndDate();

    const surnames = ['SYSOEV', 'GAVRILOV', 'SAFONOVA'];
    for (const surname of surnames) {
      currentStep = `Поиск по фамилии "${surname}"`;
      await view.fillTouristSurname(surname);

      await view.clickSearch();
      await view.hasResults();
    }
    results.push('✅ Поиск по фамилиям SYSOEV, GAVRILOV, SAFONOVA выполнен.');

    await browser.close();
  } catch (err) {
    results.push(`❌ Ошибка на шаге "${currentStep}": ${err.message}`);
    if (typeof page !== 'undefined') await page.waitForTimeout(300000);
  }

  console.log('РЕЗУЛЬТАТЫ ПОИСКА:');
  results.forEach(r => console.log(r));

  await sendMattermost(`Отчет теста "Просмотр заявок"\n${results.join('\n')}`);
})();
