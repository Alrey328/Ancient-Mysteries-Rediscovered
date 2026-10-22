(function(){
  const video=document.querySelector('video.player');
  const outbound=document.querySelector('a[href="../../"]');
  const params=new URLSearchParams(location.search);
  const campaign={source:params.get('utm_source')||'direct',medium:params.get('utm_medium')||'none',campaign:params.get('utm_campaign')||'enuk_pilot'};
  // Configure a privacy-reviewed first-party collection endpoint before launch.
  // No network events are sent until explicitly configured.
  const endpoint=window.AMR_ANALYTICS_ENDPOINT||'';
  function track(event,extra={}){
    if(!endpoint)return;
    const data={event,release:'enuk',...campaign,...extra};
    const body=JSON.stringify(data);
    if(navigator.sendBeacon){navigator.sendBeacon(endpoint,new Blob([body],{type:'application/json'}));}
    else fetch(endpoint,{method:'POST',body,headers:{'Content-Type':'application/json'},keepalive:true,credentials:'omit'}).catch(()=>{});
  }
  track('page_view');
  if(video){
    video.addEventListener('play',()=>track('video_play'));
    let quartiles=new Set();
    video.addEventListener('timeupdate',()=>{
      if(!video.duration||!Number.isFinite(video.duration))return;
      const p=video.currentTime/video.duration;
      for(const q of [0.25,0.5,0.75])if(p>=q&&!quartiles.has(q)){quartiles.add(q);track('video_progress',{quartile:q*100});}
    });
    video.addEventListener('ended',()=>track('video_complete'));
    video.addEventListener('error',()=>track('video_error',{code:video.error?.code||0}));
  }
  outbound?.addEventListener('click',()=>track('explore_more'));
  document.getElementById('share')?.addEventListener('click',()=>track('share_intent'));
})();