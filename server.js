const express = require('express');
const { chromium } = require('playwright');

const app = express();
const PORT = process.env.PORT || 8080;

// 模拟真人随机延迟
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      hasTouch: false,
      isMobile: false,
      locale: 'ru-RU',
      timezoneId: 'Europe/Moscow',
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    const page = await context.newPage();
    
    // 注入脚本隐藏自动化特征
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    await page.setDefaultTimeout(45000);
    
    // 方案1：Warmup 预热 - 先访问首页
    console.log('Warming up...');
    await page.goto('https://www.ozon.ru/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(Math.floor(Math.random() * 2000) + 1000);

    // 访问目标 URL
    console.log(`Navigating to: ${url}`);
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    
    if (response.status() !== 200) {
      console.log(`Failed with status: ${response.status()}`);
      await browser.close();
      return res.json({ error: 'HTTP ' + response.status(), url });
    }
    
    await delay(2000);
    
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
    console.error('Error during crawl:', error.message);
    if (browser) await browser.close();
    return res.json({ error: error.message, url });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Ozon Crawler with Anti-Detection running on port ' + PORT);
});
