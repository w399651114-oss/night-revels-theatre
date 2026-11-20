// 所有交互经过网站公开按钮、鼠标与键盘。时间边界从真实点击记录读取。
import path from 'node:path';
import fs from 'node:fs/promises';

export async function recordShots({page,click,clickLocator,move,mark,shot,wait,folder}){
  const visible = css => page.locator(css + ':visible').first();
  const chapter = title => page.waitForFunction(t => document.querySelector('#scene-title').textContent === t, title);
  const listen = page.locator('.spot:visible').filter({hasText:'琵琶'}).first();
  await shot('听乐','开卷从右向左。点击琵琶乐伎，走近听一遍。');
  await wait(1400);
  await click('audio','打开网页空间声');
  await wait(1400);
  await clickLocator(listen,'琵琶乐伎');
  await wait(1800);
  await click('approach','走近看看');
  await wait(3000);
  await shot('原卷对照','从人物题签回到原卷，用框线比对琵琶与人物轮廓。');
  await clickLocator(listen,'近看后再选琵琶乐伎');
  await wait(800);
  await click('scroll','在原卷定位乐伎');
  await page.locator('.scroll-reader[data-mode="object"]').waitFor();
  await wait(2600);
  await clickLocator(visible('[data-scroll-gap]'),'原卷定位清吹与散宴的素绢');
  await shot('留白','原卷中的一段素绢，在实验中展开为 2.60 米的可行走间隙。');
  await wait(2850);
  await click('close','返回折屏');
  await click('chapter-1','定位观舞');
  await chapter('观舞');
  await shot('观舞','绕过实体屏端，看击鼓与舞步怎样相应。');
  await wait(3300);
  await click('chapter-2','定位暂歇');
  await chapter('暂歇');
  await shot('暂歇','驻足榻前。后退，重新找回净手的人与侍女。');
  await wait(1350);
  await page.keyboard.down('ArrowRight');await wait(460);await page.keyboard.up('ArrowRight');
  await wait(1200);
  await click('chapter-3','定位清吹');await chapter('清吹');
  await shot('清吹','五位乐伎并坐。走到下一幕，换一个位置听。');
  await wait(3200);
  await click('chapter-4','定位散宴');await chapter('散宴');
  await shot('散宴','宾主分成几组。画上同一人物在不同段落反复出现。');
  await wait(3000);
  await click('evidence','打开三层证据');
  await shot('三层证据','从当前参数和题诗，向下核对原画局部。');
  await wait(1400);
  const panel=await visible('.panel-body').boundingBox();
  await move(panel.x+panel.width*.47,panel.y+panel.height*.78);
  await page.mouse.wheel(0,590);await wait(2100);
  await click('close','收起证据面板');
  await click('experiment','进入声场对照');
  await shot('对照条件','各版本共用路线与乐句起点。“听到了”等为演示点击。请戴耳机。');
  await wait(2000);
  const trials = [
    {n:0,v:'甲',name:'别殿遥闻',desc:'过屏前已有鼓声，留意舞者初次出现的时刻。'},
    {n:0,v:'乙',name:'过屏方启',desc:'屏前听琵琶；舞者露出时，第一下鼓点进入。'},
    {n:1,v:'甲',name:'余音越界',desc:'经过 20.95 米，管声随距离渐弱。'},
    {n:1,v:'乙',name:'凤箫吹断／留白静默',desc:'在相同的留白入口，听管声收止。'},
  ];
  for(const t of trials){
    const k='切片'+['一','二'][t.n]+' · '+t.v;
    await click('slice-'+t.n,'选'+k.split(' · ')[0]);
    await click('version-'+t.v,t.name);
    await shot(k+'｜'+t.name,t.desc);
    await wait(1800);
    await click('replay','启动'+k);
    await mark('试听起点',k);
    await page.locator('#trial-bar:visible').waitFor();
    if(t.n===0){
      await wait(t.v==='甲'?800:2600);
      await click('heard','演示自报：听到了');
      await wait(t.v==='甲'?1750:300);
      await click('seen','演示自报：看到了');
    } else {
      await wait(5000);
      if(t.v==='甲') await click('heard','演示自报：听到了');
      else await click('quiet','演示自报：声止了');
    }
    await page.locator('#drawer[data-type="experiment"]:visible').waitFor();
    await mark('试听终点',k);
    await wait(700);
  }
  await shot('知觉记录','前四回合的自报为演示点击。逐次日志保留位置、时刻和条件。');
  await wait(1600);
  const downloaded=page.waitForEvent('download');
  await click('export-log','浏览器下载四次实验日志');
  const log=path.join(folder,'演示点击-四回合逐次实验记录.json');
  await (await downloaded).saveAs(log);
  const logData=JSON.parse(await fs.readFile(log,'utf8'));
  if(!JSON.stringify(logData).includes('自报'))throw Error('演示日志缺少自报事件');
  await wait(1200);
  await click('close','收起声场面板');
  // 同源真实网页置入窄视口，保留外层 4K 标签页，跨视口回放不会降低像素数。
  await shot('窄屏体验','同一页面的 390 × 844 视口，以鼠标代点触屏控件。');
  await page.evaluate(()=>window.film.mobile());
  const mobile=page.frameLocator('#film-mobile iframe');
  await mobile.locator('#app[data-ready="true"]').waitFor({timeout:60000});
  await page.evaluate(()=>window.film.trackMobile());
  const target=id=>mobile.locator('[data-do="'+id+'"]:visible').first();
  await clickLocator(target('experiment'),'窄屏打开声场面板');
  await wait(1300);
  await clickLocator(target('replay'),'窄屏启动试听，面板自动收起');
  await mobile.locator('#trial-bar:visible').waitFor();
  await wait(800);
  await clickLocator(target('hold-trial'),'窄屏试听驻足');
  await wait(900);
  await clickLocator(target('replay'),'窄屏结束演示回合');
  await clickLocator(target('close'),'窄屏收起面板');
  await wait(900);
  const key=target('forward'), r=await key.boundingBox();
  if(r){
    await move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await wait(1600);await page.mouse.up();
    await mark('操作','窄屏按住行进键，松开驻足');
  }
  await wait(1200);
  await page.evaluate(()=>document.querySelector('#film-mobile').remove());
  await click('chapter-0','回到听乐');
  await chapter('听乐');
  await shot('回到听乐','可回退、换位、再听。屏位、层深、拟音与动作时间均为实验推定。');
  await wait(3200);
}
