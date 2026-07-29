class UnpaidPage {
  constructor(page) {
    this.page = page;
  }

  async selectNthFilter(index, label) {
    await this.page.evaluate(({ idx, lbl }) => {
      const containers = document.querySelectorAll('.chosen-container-single-nosearch');
      const container = containers[idx];
      if (!container) throw new Error(`Filter container #${idx} not found`);

      const select = container.previousElementSibling;
      if (!select || select.tagName !== 'SELECT') throw new Error(`Filter select #${idx} not found`);

      const option = Array.from(select.options).find(o => o.text.trim().toLowerCase() === lbl.toLowerCase());
      if (!option) throw new Error(`Option "${lbl}" not found. Available: ${JSON.stringify(Array.from(select.options).map(o => o.text.trim()))}`);

      select.value = option.value;
      select.dispatchEvent(new CustomEvent('chosen:updated', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }, { idx: index, lbl: label });
    await this.page.waitForTimeout(1000);
  }

  async selectCommissionFilter(label) {
    await this.selectNthFilter(0, label);
  }

  async selectPeriodFilter(label) {
    await this.selectNthFilter(1, label);
  }

  async clickSearch() {
    await this.page.locator('button.load:has-text("Искать")').click();
    await this.page.waitForTimeout(70000);
  }

  async clickSearchFast() {
    await this.page.locator('button.load:has-text("Искать")').click();
    await this.page.waitForTimeout(10000);
  }

  async hasResults() {
    const rows = await this.page.locator('#claims tr').count();
    const noData = await this.page.locator('div.resultset').innerText().catch(() => '');
    if (noData.includes('Нет данных')) return false;
    return rows > 0;
  }

  async getClaimNumbers() {
    return await this.page.evaluate(() => {
      const rows = document.querySelectorAll('#claims tr');
      return Array.from(rows).map(tr => tr.getAttribute('data-claim')).filter(Boolean);
    });
  }

  async enterClaimNumber(number) {
    await this.page.locator('#claim_unpaid > div.controls.container > table > tbody > tr:nth-child(2) > td:nth-child(3) > input').fill(String(number));
    await this.page.waitForTimeout(500);
  }
}

module.exports = UnpaidPage;
