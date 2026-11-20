// 本地导演脚本。只读取用户实际操作的 Chrome 标签页画面与声音。
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { recordShots } from './shots.mjs';

const options = process.argv.slice(2);
const sample = options.includes('--sample');
const destination = options.find(arg => !arg.startsWith('--'));
if (!destination) throw new Error('请传入本地交付目录，可选 --sample 录制校准小样');
const folder = path.resolve(destination);
await fs.mkdir(folder, {recursive:true});
const server = process.env.RECORD_URL ? null : await preview({preview:{host:'127.0.0.1',port:0,open:false}});
const site = process.env.RECORD_URL || 'http://127.0.0.1:' + server.httpServer.address().port;
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'chrome', headless:true, ignoreDefaultArgs:['--mute-audio'],
  args:['--auto-accept-this-tab-capture','--auto-select-tab-capture-source-by-title=韩熙载夜宴图',
    '--allow-http-screen-capture','--enable-gpu','--disable-backgrounding-occluded-windows',
    '--window-size=1920,1080']
});
try {
  const ctx = await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:2,acceptDownloads:true});
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', err => console.error('网页错误', err.message));
  await page.goto(site);
  await page.locator('#app[data-ready="true"]').waitFor();
  await page.evaluate(() => document.fonts.ready);
  const selector = id => '[data-do="' + id + '"]:visible';
  await page.locator(selector('settings')).first().click();
  await page.locator(selector('quality-精细')).first().click();
  await page.locator(selector('close')).first().click();
  await page.addScriptTag({path:fileURLToPath(new URL('./overlay.js',import.meta.url))});
  // 选择当前标签页需要一次真实的用户手势。
  await page.locator('#capture-authorize').click();
  await page.waitForFunction(() => window.film.ready || window.film.error);
  const error = await page.evaluate(() => window.film.error);
  if (error) throw new Error(error);
  await page.waitForTimeout(600);
  await page.evaluate(() => window.film.start());
  const wait = ms => page.waitForTimeout(ms);
  const mark = (kind, label, copy='') => page.evaluate(
    ({kind,label,copy}) => window.film.mark(kind,label,copy), {kind,label,copy});
  let last = {x:960, y:460};
  async function move(x,y) {
    const n = 13, start = last;
    for(let i=1;i<=n;i++){
      const p=i/n, u=p*p*(3-2*p);
      await page.mouse.move(start.x+(x-start.x)*u,start.y+(y-start.y)*u);
      await wait(16);
    }
    last={x,y};
  }
  async function clickLocator(locator, label) {
    await locator.waitFor({state:'visible'});
    await locator.scrollIntoViewIfNeeded();
    let r=await locator.boundingBox();
    if(!r)throw new Error('无法定位 '+label);
    await move(r.x+r.width/2,r.y+r.height/2);
    await locator.click({timeout:10000});
    await mark('操作',label);
  }
  const click = async (id,label=id) => clickLocator(page.locator(selector(id)).first(),label);
  const shot = async (label, copy) => {
    const t=await mark('镜头',label,copy);
    console.log(t.toFixed(1)+' 秒 · '+label);
  };
  const pulse = async () => {
    await page.evaluate(() => window.film.sync());
    await wait(900);
  };
  await wait(250);
  await pulse();
  await pulse();
  await mark('剪辑','正片起点');
  if (sample) {
    await shot('录制校准','从同一标签页采集全画面和立体声');
    await click('audio','开启空间声');
    await wait(2000);
    await click('chapter-1','听乐至观舞');
    await wait(2200);
  } else {
    await recordShots({page,click,clickLocator,move,mark,shot,wait,folder});
  }
  await mark('剪辑','正片终点');
  await pulse();
  const raw = path.join(folder, sample?'校准小样-原始.mp4':'浏览器原始实录.mp4');
  const download = page.waitForEvent('download',{timeout:120000});
  const meta = await page.evaluate(() => window.film.stop());
  await (await download).saveAs(raw);
  meta.浏览器 = browser.version();
  meta.网址 = site.replace(/127\.0\.0\.1:\d+/,'127.0.0.1');
  // 本地随机端口与机器路径不进入交付记录。
  await fs.writeFile(path.join(folder,sample?'小样事件.json':'实录事件.json'),JSON.stringify(meta,null,2));
  console.log(raw, {轨道:meta.轨道,浏览器:meta.浏览器,帧:meta.采集});
} finally {
  await browser.close();
  await server?.close();
}
