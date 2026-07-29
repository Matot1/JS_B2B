class CuratorsPage {
  constructor(page) {
    this.page = page;
  }

  async clickBlock(text) {
    const block = this.page.getByText(text, { exact: false });
    await block.click();
    await this.page.waitForTimeout(500);
  }
}

module.exports = CuratorsPage;
