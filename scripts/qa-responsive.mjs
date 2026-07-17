import puppeteer from 'puppeteer';

const baseUrl = process.env.QA_URL || 'http://127.0.0.1:3000';
const widths = [1440, 768, 390, 375];
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const results = [];
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

for (const width of widths) {
  const page = await browser.newPage();
  const browserMessages = [];
  const failedResponses = [];
  page.on('console', (message) => {
    if (message.type() === 'warning' || message.type() === 'error') browserMessages.push({ type: message.type(), text: message.text() });
  });
  page.on('pageerror', (error) => browserMessages.push({ type: 'pageerror', text: error.message }));
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() });
  });
  await page.setViewport({ width, height: width < 500 ? 844 : 900, deviceScaleFactor: 1 });
  await page.goto(baseUrl, { waitUntil: 'networkidle0' });
  const baseline = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    selectedTab: document.querySelector('[role="tab"][aria-selected="true"]')?.textContent.trim()
  }));
  const views = {};
  for (const label of ['Organic Meta', 'Paid Meta', 'Google Display', 'Executive intelligence']) {
    const clicked = await page.evaluate((text) => {
      const button = [...document.querySelectorAll('[role="tab"]')].find((item) => item.textContent.includes(text));
      if (!button) return false;
      button.click();
      return true;
    }, label);
    assert(clicked, `${width}px: missing tab ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 120));
    if (label === 'Organic Meta' || label === 'Paid Meta') {
      const imageCount = await page.evaluate(() => document.images.length);
      for (let imageIndex = 0; imageIndex < imageCount; imageIndex += 1) {
        await page.evaluate((index) => document.images[index]?.scrollIntoView({ block: 'center' }), imageIndex);
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
    }
    views[label] = await page.evaluate(() => ({
      selected: document.querySelector('[role="tab"][aria-selected="true"]')?.textContent.trim(),
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      demoVisible: Boolean([...document.querySelectorAll('*')].find((item) => item.textContent?.trim() === 'SAMPLE MODEL · MAY–JUNE 2026')),
      paidTotals: [...document.querySelectorAll('.paid-metrics strong')].map((item) => item.textContent.trim()),
      images: (() => { const images = [...document.images]; return { count: images.length, loaded: images.filter((image) => image.complete && image.naturalWidth > 0).length }; })(),
      sections: {
        organicKpis: Boolean(document.querySelector('.lift-grid')),
        organicCreative: Boolean(document.querySelector('.organic-grid')),
        paidKpis: Boolean(document.querySelector('.paid-metrics')),
        paidCreative: Boolean(document.querySelector('.creative-grid')),
        googleModule: Boolean(document.querySelector('.google-module'))
      }
    }));
    const view = views[label];
    assert(view.selected?.startsWith(label), `${width}px: selected tab '${view.selected}' does not match '${label}'`);
    assert(view.demoVisible === (label === 'Google Display'), `${width}px ${label}: demo marker visibility incorrect`);
    assert((view.paidTotals.length > 0) === (label === 'Paid Meta' || label === 'Executive intelligence'), `${width}px ${label}: paid totals boundary incorrect`);
    if (label === 'Organic Meta') assert(view.sections.organicKpis && view.sections.organicCreative && !view.sections.paidKpis && !view.sections.googleModule, `${width}px: Organic view sections incorrect`);
    if (label === 'Paid Meta') assert(view.sections.paidKpis && view.sections.paidCreative && !view.sections.organicKpis && !view.sections.googleModule, `${width}px: Paid view sections incorrect`);
    if (label === 'Google Display') assert(view.sections.googleModule && !view.sections.organicKpis && !view.sections.paidKpis, `${width}px: Google view sections incorrect`);
    if (label === 'Executive intelligence') assert(view.sections.organicKpis && view.sections.organicCreative && view.sections.paidKpis && view.sections.paidCreative && !view.sections.googleModule, `${width}px: Executive view sections incorrect`);
  }
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise((resolve) => setTimeout(resolve, 500));
  const imageState = await page.evaluate(() => {
    const images = [...document.images].filter((image) => image.getBoundingClientRect().bottom > -120);
    return { count: images.length, loaded: images.filter((image) => image.complete && image.naturalWidth > 0).length };
  });
  const nonBenignResponses = failedResponses.filter((response) => !response.url.endsWith('/favicon.ico'));
  const nonBenignMessages = browserMessages.filter((message) => !(message.type === 'error' && message.text.includes('status of 404') && failedResponses.some((response) => response.url.endsWith('/favicon.ico'))));
  assert(nonBenignMessages.length === 0 && nonBenignResponses.length === 0, `${width}px: browser warnings/errors: ${JSON.stringify({ nonBenignMessages, nonBenignResponses })}`);
  results.push({ width, baseline, views, imageState, browserMessages: nonBenignMessages, benignInfra: failedResponses.filter((response) => response.url.endsWith('/favicon.ico')) });
  await page.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
if (results.some((result) => result.baseline.scrollWidth !== result.baseline.clientWidth || Object.values(result.views).some((view) => view.scrollWidth !== view.clientWidth))) process.exitCode = 1;
if (results.some((result) => result.views['Organic Meta'].images.loaded !== result.views['Organic Meta'].images.count || result.views['Paid Meta'].images.loaded !== result.views['Paid Meta'].images.count)) process.exitCode = 1;
if (results.some((result) => result.views['Google Display'].paidTotals.length !== 0)) process.exitCode = 1;
if (failures.length) {
  console.error(JSON.stringify({ failures }, null, 2));
  process.exitCode = 1;
}
