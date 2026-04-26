import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';

async function prerender(url, outputPath) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  console.log(`Prerendering ${url}...`);
  await page.goto(url, { waitUntil: 'networkidle' });
  
  // 等待渲染完成
  await page.waitForSelector('.staff-preview', { timeout: 15000 });
  await page.waitForTimeout(2000);

  // 在保存前进行“脱水”处理
  await page.evaluate(() => {
    // 1. 移除所有 Vite 注入的调试脚本和 HMR 脚本
    const scripts = Array.from(document.querySelectorAll('script'));
    scripts.forEach(s => {
      if (s.src.includes('@vite') || s.src.includes('@react-refresh') || s.textContent?.includes('injectIntoGlobalHook')) {
        s.remove();
      }
    });

    // 2. 将代码块恢复为纯文本（移除高亮 span），防止二次污染
    const codeBlocks = document.querySelectorAll('.dsl-code-block');
    codeBlocks.forEach(block => {
      // 关键：保留原始换行符，移除所有 HTML 标签
      const rawText = block.innerText || block.textContent;
      block.innerHTML = rawText; 
    });

    // 3. 修复样式链接为相对路径 (针对 GitHub Pages)
    const links = document.querySelectorAll('link[rel="stylesheet"]');
    links.forEach(l => {
      if (l.href.includes('styles.css')) {
        l.setAttribute('href', './src/styles.css');
      }
    });
  });

  const content = await page.content();
  // 移除残留的 Vite 占位符字符串
  const cleanContent = content.replace(/\\n/g, '\n');
  
  fs.writeFileSync(outputPath, cleanContent);
  console.log(`Saved pre-rendered page to ${outputPath}`);
  
  await browser.close();
}

async function run() {
  const port = 5260;
  const devServer = spawn('npm', ['run', 'dev', '--', '--port', port.toString()], {
    stdio: 'ignore',
    detached: true
  });

  await new Promise(r => setTimeout(r, 5000));

  try {
    await prerender(`http://localhost:${port}/drum_notation/docs.html`, 'docs.html');
    await prerender(`http://localhost:${port}/drum_notation/docs_zh.html`, 'docs_zh.html');
    console.log('PRERENDER SUCCESSFUL');
  } catch (e) {
    console.error('Prerender failed:', e);
  } finally {
    process.kill(-devServer.pid);
  }
}

run();
