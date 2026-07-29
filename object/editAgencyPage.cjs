class EditAgencyPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('https://b2b.fstravel.com/edit_agency', { waitUntil: 'networkidle', timeout: 60000 });
  }

  async countEditableFields() {
    return await this.page.evaluate(() => {
      const fields = document.querySelectorAll('input, select, textarea');
      let editable = 0;
      fields.forEach(f => {
        if (!f.disabled && f.type !== 'hidden') editable++;
      });
      return editable;
    });
  }

  async getAllFields() {
    return await this.page.evaluate(() => {
      const fields = document.querySelectorAll('input, select, textarea');
      const result = [];
      fields.forEach((f, i) => {
        if (f.type === 'hidden') return;
        const label = f.closest('tr')?.querySelector('td:first-child')?.innerText?.trim()
          || f.name || f.id || f.placeholder || 'без названия';
        result.push({ index: i, label, disabled: f.disabled, type: f.tagName.toLowerCase() + (f.type ? `[${f.type}]` : '') });
      });
      return result;
    });
  }

  async getFieldValue(index) {
    return await this.page.evaluate((i) => {
      const f = document.querySelectorAll('input, select, textarea')[i];
      if (!f) return null;
      if (f.type === 'checkbox') return f.checked;
      if (f.tagName === 'SELECT') return f.options[f.selectedIndex]?.value || '';
      return f.value;
    }, index);
  }

  async setFieldValue(index, value) {
    const type = await this.getFieldType(index);
    const locator = this.page.locator('input, select, textarea').nth(index);
    if (type === 'checkbox') {
      await locator.setChecked(value);
    } else if (type === 'select') {
      await locator.selectOption(value);
    } else {
      await locator.click();
      await locator.press('End');
      const len = String(value).length;
      for (let i = 0; i < Math.min(50, len + 10); i++) await locator.press('Backspace');
      await locator.pressSequentially(String(value), { delay: 20 });
      await locator.press('Tab');
    }
    await this.page.waitForTimeout(300);
  }

  async getFieldInfo(index) {
    return await this.page.evaluate((i) => {
      const f = document.querySelectorAll('input, select, textarea')[i];
      if (!f) return null;
      const rect = f.getBoundingClientRect();
      return {
        tag: f.tagName,
        type: f.type,
        name: f.name,
        id: f.id,
        className: f.className,
        disabled: f.disabled,
        readOnly: f.readOnly,
        value: f.value,
        visible: rect.width > 0 && rect.height > 0 && f.offsetParent !== null,
        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
      };
    }, index);
  }

  async verifyFieldValue(index) {
    return await this.page.evaluate((i) => {
      const f = document.querySelectorAll('input, select, textarea')[i];
      if (!f) return null;
      if (f.type === 'checkbox') return f.checked;
      return f.value;
    }, index);
  }

  async getFieldType(index) {
    return await this.page.evaluate((i) => {
      const f = document.querySelectorAll('input, select, textarea')[i];
      if (!f) return null;
      if (f.type === 'checkbox') return 'checkbox';
      if (f.tagName === 'SELECT') return 'select';
      if (f.type === 'date') return 'date';
      if (f.type === 'number' || f.className.includes('num') || f.className.includes('numeric') || f.className.includes('phone')) return 'number';
      const label = f.closest('tr')?.querySelector('td:first-child')?.innerText?.trim() || '';
      const numKeywords = ['телефон', 'кпп', 'огрн', 'инн', 'индекс', 'бак', 'бик', 'окпо', 'оквэд', 'расчетн', 'номер', 'ндс'];
      if (numKeywords.some(k => label.toLowerCase().includes(k))) return 'number';
      if (label.toLowerCase().includes('дата')) return 'date';
      if (label.toLowerCase().includes('e-mail') || label.toLowerCase().includes('email') || label.toLowerCase().includes('почт')) return 'email';
      if (label.toLowerCase().includes('сайт') || label.toLowerCase().includes('url')) return 'url';
      return 'text';
    }, index);
  }

  async clickOutside() {
    await this.page.locator('body').click({ position: { x: 10, y: 10 } });
    await this.page.waitForTimeout(500);
  }

  async clickSave() {
    await this.page.evaluate(() => {
      const btn = document.querySelector('input[name="save"]');
      if (btn) btn.click();
    });
    await this.page.waitForTimeout(3000);
  }

  async isSaveSuccessful() {
    const url = this.page.url();
    return url.includes('success=1');
  }

  async getPageText() {
    return await this.page.evaluate(() => document.body.innerText.substring(0, 2000));
  }

  async getCurrentUrl() {
    return this.page.url();
  }

  async getSaveButton() {
    return await this.page.evaluate(() => {
      const btns = document.querySelectorAll('input[type="submit"], button[type="submit"]');
      return [...btns].map(b => ({ tag: b.tagName, type: b.type, value: b.value || b.innerText, name: b.name, id: b.id }));
    });
  }

  async getCurrentCity() {
    return await this.page.evaluate(() => {
      const rows = document.querySelectorAll('table tr');
      for (const row of rows) {
        const label = row.querySelector('td:first-child')?.innerText?.trim();
        if (label === 'Город') {
          const sel = row.querySelector('select');
          if (sel && sel.options.length > 1) return sel.options[sel.selectedIndex]?.text || '';
          const inp = row.querySelector('input');
          if (inp) return inp.value;
        }
      }
      return '';
    });
  }

  async getCityOptions() {
    return await this.page.evaluate(() => {
      const rows = document.querySelectorAll('table tr');
      for (const row of rows) {
        const label = row.querySelector('td:first-child')?.innerText?.trim();
        if (label === 'Город') {
          const select = row.querySelector('select');
          if (select && select.options.length > 1) {
            return [...select.options].map(o => ({ value: o.value, text: o.text }));
          }
        }
      }
      return [];
    });
  }

  async selectCity(value) {
    await this.page.evaluate((val) => {
      const rows = document.querySelectorAll('table tr');
      for (const row of rows) {
        const label = row.querySelector('td:first-child')?.innerText?.trim();
        if (label === 'Город') {
          const sel = row.querySelector('select');
          if (sel && sel.options.length > 1) {
            const nativeSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
            nativeSetter.call(sel, val);
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            sel.dispatchEvent(new Event('input', { bubbles: true }));
          }
          break;
        }
      }
    }, value);
    await this.page.waitForTimeout(2000);
  }

  async getDisabledFields() {
    return await this.page.evaluate(() => {
      const fields = document.querySelectorAll('input, select, textarea');
      const disabled = [];
      fields.forEach(f => {
        if (f.disabled) {
          const label = f.closest('tr')?.querySelector('td:first-child')?.innerText?.trim()
            || f.name || f.id || f.placeholder || 'без названия';
          disabled.push(label);
        }
      });
      return disabled;
    });
  }
}

module.exports = EditAgencyPage;
