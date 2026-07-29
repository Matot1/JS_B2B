const { chromium } = require('playwright');
require('dotenv').config();
const { sendMattermost } = require('./notify.cjs');
const LoginPage = require('./object/loginPage.cjs');
const EditAgencyPage = require('./object/editAgencyPage.cjs');

function dedupeFields(allFields) {
  const groups = {};
  for (const f of allFields) {
    if (f.label === 'save') continue;
    if (!groups[f.label]) groups[f.label] = [];
    groups[f.label].push(f);
  }
  const result = [];
  for (const [, items] of Object.entries(groups)) {
    const hasSelect = items.some(i => i.type === 'select[select-one]');
    if (hasSelect) {
      const selectField = items.find(i => i.type === 'select[select-one]');
      result.push(selectField);
    } else {
      result.push(...items);
    }
  }
  return result;
}

function computeNewValue(type, currentValue) {
  if (type === 'checkbox') return !currentValue;
  if (type === 'number') return (currentValue || '') + '1';
  if (type === 'date') return '01.01.2025';
  if (type === 'select') return null;
  return (currentValue || '') + '_autotest';
}

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

    const edit = new EditAgencyPage(page);
    await edit.goto();

    const cityOptions = await edit.getCityOptions();
    const moscow = cityOptions.find(o => o.text.toLowerCase().includes('москв'));
    if (moscow) await edit.selectCity(moscow.value);

    const allFields = await edit.getAllFields();
    const deduped = dedupeFields(allFields);
    const editable = deduped.filter(f => !f.disabled);
    const textEditable = editable.filter(f => f.type !== 'select[select-one]');

    const randomField = textEditable[Math.floor(Math.random() * textEditable.length)];
    console.log('Выбрано поле:', randomField.label);

    const fieldType = await edit.getFieldType(randomField.index);
    const originalValue = await edit.getFieldValue(randomField.index);
    const newValue = computeNewValue(fieldType, originalValue);

    await edit.setFieldValue(randomField.index, newValue);
    await edit.clickOutside();
    await edit.clickSave();

    const saved = await edit.isSaveSuccessful();
    const saveMsg = saved
      ? `✅ Редактирование поля "${randomField.label}" успешно`
      : `❌ Ошибка при сохранении поля "${randomField.label}"`;
    console.log(saveMsg);

    await edit.setFieldValue(randomField.index, originalValue);
    await edit.clickOutside();
    await edit.clickSave();

    const restored = await edit.verifyFieldValue(randomField.index);
    const restoreMsg = restored === originalValue
      ? `✅ Поле возвращено в изначальное значение "${randomField.label}" успешно`
      : `❌ Ошибка при возврате поля "${randomField.label}"`;
    console.log(restoreMsg);

    const reportMsg = [
      'Отчет теста "Редактирование партнера":',
      `Редактируем поле: "${randomField.label}" (выбрано рандомно)`,
      saveMsg,
      restoreMsg,
    ].join('\n');
    await sendMattermost(reportMsg);

    await browser.close();
  } catch (err) {
    console.error('Ошибка:', err.message);
    await sendMattermost(`Отчет теста "Редактирование партнера":\nОшибка: ${err.message}`);
    if (typeof page !== 'undefined') await browser.close();
  }
})();
