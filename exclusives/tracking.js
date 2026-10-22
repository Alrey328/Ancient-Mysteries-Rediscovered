(function(){
  const video=document.querySelector('video.player');
  const outbound=document.querySelector('a[href="../../"]');
  const seen=new Set();
  function track(name){
    // GoatCounter's supported custom-event API uses path-based events.
    // It is intentionally not a JSON POST to the /count endpoint.
    if(typeof window.goatcounter?.count!=='function')return;
    window.goatcounter.count({path:'events/enuk/'+name,title:'Enuk: '+name,event:true});
  }
  if(video){
    video.addEventListener('play',()=>{if(!seen.has('play')){seen.add('play');track('play');}});
    video.addEventListener('timeupdate',()=>{
      if(!Number.isFinite(video.duration)||video.duration<=0)return;
      const progress=video.currentTime/video.duration;
      for(const q of [25,50,75]){
        const key='progress-'+q;
        if(progress>=q/100&&!seen.has(key)){seen.add(key);track(key);}
      }
    });
    video.addEventListener('ended',()=>track('complete'));
    video.addEventListener('error',()=>track('error'));
  }
  outbound?.addEventListener('click',()=>track('explore-more'));
  document.getElementById('share')?.addEventListener('click',()=>track('share-intent'));
})();