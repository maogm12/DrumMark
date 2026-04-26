import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'fs';

async function prerender(url, outputPath) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  console.log(`Prerendering ${url}...`);
  await page.goto(url, { waitUntil: 'networkidle' });
  
  // 等待所有乐谱渲染完成 (判断依据是 .staff-preview 存在)
  await page.waitForSelector('.staff-preview', { timeout: 10000 });
  // 给一点额外时间确保 VexFlow 彻底画完
  await page.waitForTimeout(2000);

  // 移除客户端渲染脚本，防止重复运行
  await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script'));
    const docScript = scripts.find(s => s.src.includes('docsVanilla'));
    if (docScript) docScript.remove();
    
    // 同时也把那些原始的 dsl-code-block 隐藏或处理掉，保持页面干净
    // 甚至可以保留，只作为纯文本展示
  });

  const content = await page.content();
  fs.writeFileSync(outputPath, content);
  console.log(`Saved pre-rendered page to ${outputPath}`);
  
  await browser.close();
}

async function run() {
  const port = 5250;
  console.log('Starting dev server for prerendering...');
  const devServer = spawn('npm', ['run', 'dev', '--', '--port', port.toString()], {
    stdio: 'ignore',
    detached: true
  });

  // 等待服务器就绪
  await new Promise(r => setTimeout(r, 5000));

  try {
    await prerender(`http://localhost:${port}/drum_notation/docs.html`, 'docs.static.html');
    await prerender(`http://localhost:${port}/drum_notation/docs_zh.html`, 'docs_zh.static.html');
    
    // 覆盖原始文件 (或者您可以选择在构建流程中重命名)
    fs.copyFileSync('docs.static.html', 'docs.html');
    fs.copyFileSync('docs_zh.static.html', 'docs_zh.html');
    
    console.log('PRERENDER COMPLETE. HTML files updated with inline SVGs.');
  } catch (e) {
    console.error('Prerender failed:', e);
  } finally {
    process.kill(-devServer.pid);
  }
}

run();
