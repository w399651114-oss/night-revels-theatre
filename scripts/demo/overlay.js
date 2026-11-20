// 仅由本地录制工具注入。所有点按均由网页原控件处理。
(() => {
  const host=document.createElement('div');
  host.id='filming-layer';
  document.body.append(host);
  const root=host.attachShadow({mode:'open'});
  root.innerHTML=`<style>
  :host{all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647}
  #tip{position:absolute;top:86px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:15px;background:#1b201df2;color:#faf4e8;padding:12px 23px 12px 15px;border:1px solid #b89f6f;box-shadow:0 3px 12px #19140f35;border-radius:3px;font:17px/1.4 "PingFang SC",sans-serif;white-space:nowrap}
  #cue{font-weight:650;color:#f2d395;border-right:1px solid #8f805f;padding-right:14px}
  #cursor{position:absolute;left:0;top:0;width:28px;height:34px;filter:drop-shadow(0 2px 3px #0009);will-change:transform}
  #ripple{position:absolute;width:32px;height:32px;border:3px solid #ffd275;border-radius:50%;margin:-19px;opacity:0}
  #flash{position:absolute;left:8px;top:8px;width:50px;height:50px;background:white;display:none}
  [hidden]{display:none!important}
  </style><div id="tip" hidden><span id="cue"></span><span id="copy"></span></div>
  <svg id="cursor" viewBox="0 0 28 34" aria-hidden="true"><path d="M3 2 L23 18.6 L13.6 19.1 L18.7 29.0 L14.4 31 L9.5 20.9 L3 27 Z" fill="#fff9eb" stroke="#1e231f" stroke-width="2" stroke-linejoin="round"/></svg>
  <div id="ripple"></div><div id="flash"></div>`;
  const $=id=>root.getElementById(id), cursor=$('cursor');
  const events=[],frameSizes=new Map(), samples=[];
  let firstVideo=null,lastVideo=null,frameCount=0,videoTrack,audioTracks,rec,blobParts=[],recT=0,context,monitor,ripple;
  const film=window.film={ready:false,error:'', mark, start, stop, sync, mobile, trackMobile};
  const button=document.createElement('button');
  button.id='capture-authorize';
  button.textContent='授权录制此标签页';
  button.style.cssText='position:fixed;z-index:2147483646;top:200px;left:50%';
  document.body.append(button);
  const cursorPos=(x,y)=>cursor.style.transform='translate('+x+'px,'+y+'px)';
  cursorPos(960,460);
  document.addEventListener('pointermove', e=>cursorPos(e.clientX,e.clientY),{capture:true});
  document.addEventListener('pointerdown', e=>{
    if(!recT)return;
    cursorPos(e.clientX,e.clientY);
    const el=$('ripple');el.style.left=e.clientX+'px';el.style.top=e.clientY+'px';
    ripple?.cancel();
    ripple=el.animate([{opacity:1,transform:'scale(.45)'},{opacity:.8,offset:.5},{opacity:0,transform:'scale(1.9)'}],{duration:470});
    mark('按下',e.target.closest('[data-do]')?.dataset.do || e.target.closest('button')?.textContent || '画面');
  },{capture:true});
  function mark(kind,label,copy=''){
    const t=(performance.now()-recT)/1000;
    events.push({类别:kind,名称:label,时间:t,文案:copy});
    if(kind==='镜头'){
      $('tip').hidden=!label;
      $('cue').textContent=label;$('copy').textContent=copy;
    }
    if(kind==='剪辑'&&label==='正片终点')$('tip').hidden=true;
    return t;
  }
  button.onclick=async()=>{
    try{
      button.remove();
      const stream=await navigator.mediaDevices.getDisplayMedia({preferCurrentTab:true,
        video:{width:{ideal:3840,max:3840},height:{ideal:2160,max:2160},frameRate:{ideal:30,max:30}},
        audio:{channelCount:2,echoCancellation:false,noiseSuppression:false,autoGainControl:false,restrictOwnAudio:false,suppressLocalAudioPlayback:false}});
      [videoTrack]=stream.getVideoTracks();audioTracks=stream.getAudioTracks();
      if(!audioTracks.length)throw Error('此标签页没有音轨');
      videoTrack.contentHint='detail';
      const mt='video/mp4;codecs=avc1.640033,mp4a.40.2';
      if(!MediaRecorder.isTypeSupported(mt)) throw Error('需要支持原生 AVC/AAC 的 Chrome');
      rec=new MediaRecorder(stream,{mimeType:mt,videoBitsPerSecond:34000000,audioBitsPerSecond:256000});
      rec.ondataavailable=e=>{if(e.data.size)blobParts.push(e.data)};
      context=new AudioContext();await context.resume();
      monitor=document.createElement('video');monitor.srcObject=new MediaStream([videoTrack]);monitor.muted=true;
      await monitor.play();
      function frame(now,m){
        if(recT&&rec.state==='recording'){
          const trial=document.querySelector('#trial-bar');$('tip').style.top=trial&&!trial.hidden?'131px':'86px';
          firstVideo??=m.mediaTime;lastVideo=m.mediaTime;frameCount++;
          const size=m.width+'×'+m.height;frameSizes.set(size,(frameSizes.get(size)||0)+1);
          if(frameCount%15===1)samples.push([Number(((now-recT)/1000).toFixed(3)),m.presentedFrames]);
        }
        monitor.requestVideoFrameCallback(frame);
      }
      monitor.requestVideoFrameCallback(frame);
      film.ready=true;
    }catch(e){film.error=e.name+' '+e.message}
  };
  function mobile(){
    const box=document.createElement('section');
    box.id='film-mobile';
    box.style.cssText='position:fixed;inset:0;z-index:2147483644;background:#21251feb;display:flex;gap:75px;align-items:center;justify-content:center;color:#f4ebda;font-family:"PingFang SC",sans-serif';
    box.innerHTML='<iframe title="移动视口实录" style="width:390px;height:844px;border:1px solid #9b8a69;border-radius:3px;background:#222"></iframe><div style="max-width:560px"><div style="font-size:20px;color:#d6bd8c;letter-spacing:3px">同页响应式实录</div><h2 style="margin:12px 0 24px;font-family:serif;font-size:54px">在窄屏上驻足</h2><p style="font-size:21px;line-height:1.8">关闭面板后，折屏重新占据视野。<br>按住行进，松开即可停下。</p><small style="font-size:16px;color:#c4baa9">390 × 844 CSS 像素 · 桌面浏览器模拟视口</small></div>';
    document.body.append(box);
    box.querySelector('iframe').src=location.href;
  }
  function trackMobile(){
    const frame=document.querySelector('#film-mobile iframe'),child=frame.contentWindow;
    const coords=e=>{const r=frame.getBoundingClientRect();return [r.x+frame.clientLeft+e.clientX,r.y+frame.clientTop+e.clientY]};
    child.addEventListener('pointermove',e=>cursorPos(...coords(e)),true);
    child.addEventListener('pointerdown',e=>{
      const [x,y]=coords(e);cursorPos(x,y);
      const el=$('ripple');el.style.left=x+'px';el.style.top=y+'px';ripple?.cancel();
      ripple=el.animate([{opacity:1,transform:'scale(.45)'},{opacity:0,transform:'scale(1.9)'}],{duration:470});
    },true);
  }
  function start(){recT=performance.now();rec.start(1000)}
  // 标记在正片以外。在同一帧启动的白块与 2 kHz 短音用于测量同步偏差。
  async function sync(){
    await new Promise(resolve=>requestAnimationFrame(()=>{
      const t=context.currentTime, oscillator=context.createOscillator(), volume=context.createGain();
      oscillator.frequency.value=2000;volume.gain.value=.18;
      oscillator.connect(volume).connect(context.destination);
      oscillator.start(t);oscillator.stop(t+.15);
      $('flash').style.display='block';mark('校准','闪白／同步音');
      setTimeout(()=>{$('flash').style.display='none'},150);
      resolve();
    }));
  }
  async function stop(){
    const metadata={};
    await new Promise(resolve=>{rec.onstop=resolve;rec.stop()});
    const blob=new Blob(blobParts,{type:rec.mimeType});
    const link=document.createElement('a');link.download='浏览器实录.mp4';link.href=URL.createObjectURL(blob);link.click();
    metadata.轨道=[videoTrack,...audioTracks].map(t=>({种类:t.kind,设置:t.getSettings()}));
    for(const t of metadata.轨道){delete t.设置.deviceId;delete t.设置.groupId}
    metadata.采集={尺寸:Object.fromEntries(frameSizes),回调帧数:frameCount,首帧:firstVideo,末帧:lastVideo,帧时刻:samples};
    const c=document.querySelector('canvas'),gl=c.getContext('webgl2'),info=gl.getExtension('WEBGL_debug_renderer_info');
    metadata.屏幕={页面:[innerWidth,innerHeight],倍率:devicePixelRatio,图形:[c.width,c.height],绘图设备:gl.getParameter(info.UNMASKED_RENDERER_WEBGL)};
    metadata.事件=events;
    videoTrack.stop();audioTracks.forEach(t=>t.stop());await context.close();
    return metadata;
  }
})();
