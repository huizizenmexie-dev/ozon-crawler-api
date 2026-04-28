const express = require('express');
const { chromium } = require('playwright');

const app = express();
const PORT = process.env.PORT || 8080;

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/crawl', async (req, res) => {
  const { url } = req.query;
  
  if (!url || !url.includes('ozon.ru')) {
    return res.status(400).json({ error: '需要提供有效的 ozon.ru 链接' });
  }
  
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    await page.setDefaultTimeout(30000);
    
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    
    if (response.status() !== 200) {
      await browser.close();
      return res.json({ error: 'HTTP ' + response.status(), url });
    }
    
    await page.waitForTimeout(2000);
    
    let title = '';
    try { title = await page.locator('h1').first().innerText(); } catch (e) {}
    
    let price = '';
    try { price = await page.locator('[data-widget="webPrice"] span').first().innerText(); } catch (e) {}
    
    let mainImage = '';
    try {
      const imgs = await page.locator('img[src*="cdn1.ozone.ru"]').all();
      if (imgs.length > 0) mainImage = await imgs[0].getAttribute('src');
    } catch (e) {}
    
    let brand = '';
    try { brand = await page.locator('[data-widget="webBrand"] a').first().innerText(); } catch (e) {}
    
    await browser.close();
    
    return res.json({ url, title, price, main_image: mainImage, brand, success: true });
    
  } catch (error) {
    if (browser) await browser.close();
    return res.json({ error: error.message, url });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Ozon Crawler running on port ' + PORT);
});
