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
    // 1. 彻底移除所有 script 标签，包括 Vite 注入的代理脚本和 HMR 脚本
    const scripts = Array.from(document.querySelectorAll('script'));
    scripts.forEach(s => s.remove());

    // 2. 将代码块恢复为纯文本（移除高亮 span），防止二次污染
    const codeBlocks = document.querySelectorAll('.dsl-code-block');
    codeBlocks.forEach(block => {
      const rawText = block.innerText || block.textContent;
      block.innerHTML = rawText; 
    });

    // 3. 修复样式链接为相对路径
    const links = document.querySelectorAll('link[rel="stylesheet"]');
    links.forEach(l => {
      if (l.href.includes('styles.css')) {
        l.setAttribute('href', './src/styles.css');
      }
    });
  });

  let content = await page.content();
  
  // 4. 在 </body> 结束前重新插入原始的 vanilla 脚本 (使用绝对路径或相对路径)
  // 这样在开发模式下依然能正常运行交互逻辑，且不会有代理冲突
  const scriptTag = '<script type="module" src="/drum_notation/src/docsVanilla.ts"></script>';
  content = content.replace('</body>', `${scriptTag}\n</body>`);

  // 修复换行符转义问题
  const cleanContent = content.replace(/\\n/g, '\n');
  
  fs.writeFileSync(outputPath, cleanContent);
  console.log(`Saved pre-rendered page to ${outputPath}`);
  
  await browser.close();
}

async function run() {
  const port = 5270;
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
