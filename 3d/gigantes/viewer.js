(()=>{'use strict';
  const stage=document.getElementById('stage'),canvas=document.getElementById('depth-canvas'),status=document.getElementById('viewer-status');
  if(!stage||!canvas||!status)return;
  const range=document.getElementById('depth-strength'),output=document.getElementById('depth-value');
  const reset=document.getElementById('reset-view'),original=document.getElementById('show-original');
  const autoButton=document.getElementById('auto-drift'),tiltButton=document.getElementById('phone-tilt');
  const reduceMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const limit=(n,min,max)=>Math.max(min,Math.min(max,n));
  const image=(src)=>new Promise((resolve,reject)=>{const im=new Image();im.decoding='async';im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('Unable to load exhibit image'));im.src=src;});
  let gl,program,uniforms={},raf=0,ready=false,auto=false,tilt=false,originalView=false,down=false;
  let targetX=0,targetY=0,shiftX=0,shiftY=0,last=0,start=performance.now();
  let orientationHandler=null;
  const vertex=`attribute vec2 aPosition;varying vec2 uv;void main(){uv=(aPosition+1.0)*0.5;gl_Position=vec4(aPosition,0.0,1.0);}`;
  // Bright pixels in the WaveSpeed map represent the foreground.
  const fragment=`precision highp float;varying vec2 uv;uniform sampler2D uPhoto;uniform sampler2D uDepth;uniform vec2 uShift;uniform float uStrength;uniform int uOriginal;
void main(){if(uOriginal==1){gl_FragColor=texture2D(uPhoto,uv);return;}
  vec2 base=(uv-.5)/1.19+.5;vec2 pos=base;
  for(int i=0;i<6;i++){float depth=pow(max(texture2D(uDepth,clamp(pos,.0,1.0)).r,0.0),0.88);pos=base-uShift*uStrength*depth;}
  gl_FragColor=texture2D(uPhoto,clamp(pos,vec2(.001),vec2(.999)));}`;
  function compile(type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader)||'Shader compilation failed');return shader;}
  function texture(img,index){const tex=gl.createTexture();gl.activeTexture(gl.TEXTURE0+index);gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);return tex;}
  function setStatus(s){status.textContent=s;}
  function stop(){if(raf)cancelAnimationFrame(raf);raf=0;}
  function fail(message){ready=false;stop();stage.classList.remove('is-ready');setStatus(message);canvas.style.display='none';}
  function requestFrame(){if(ready&&!raf&&!document.hidden)raf=requestAnimationFrame(draw);}
  function draw(now){
    raf=0;if(!ready||document.hidden)return;
    const time=(now-start)/1000;
    if(auto){targetX=.028*Math.sin(time*.9);targetY=.016*Math.sin(time*.73+.4);}
    shiftX+=(targetX-shiftX)*.18;shiftY+=(targetY-shiftY)*.18;
    const dpr=Math.min(window.devicePixelRatio||1,2),width=Math.max(1,Math.round(stage.clientWidth*dpr)),height=Math.max(1,Math.round(stage.clientHeight*dpr));
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;gl.viewport(0,0,width,height);}
    gl.uniform2f(uniforms.uShift,shiftX,shiftY);
    gl.uniform1f(uniforms.uStrength,Number(range.value)/100);
    gl.uniform1i(uniforms.uOriginal,originalView?1:0);
    gl.drawArrays(gl.TRIANGLES,0,6);
    if(auto||tilt||down||Math.abs(shiftX-targetX)+Math.abs(shiftY-targetY)>.0001)requestFrame();
    last=now;
  }
  function setAuto(enabled){auto=enabled&&!reduceMotion;autoButton.setAttribute('aria-pressed',String(auto));autoButton.textContent='Auto drift: '+(auto?'On':'Off');if(!auto&&!down&&!tilt){targetX=0;targetY=0;}requestFrame();}
  function setTilt(enabled){tilt=enabled;tiltButton.setAttribute('aria-pressed',String(enabled));tiltButton.textContent='Phone tilt: '+(enabled?'On':'Off');if(!enabled&&orientationHandler){window.removeEventListener('deviceorientation',orientationHandler);orientationHandler=null;targetX=0;targetY=0;}requestFrame();}
  async function enableTilt(){
    if(tilt){setTilt(false);setStatus('Phone tilt disabled. Drag to explore.');return;}
    try{
      if(typeof DeviceOrientationEvent==='undefined')throw new Error('Phone tilt unavailable');
      if(typeof DeviceOrientationEvent.requestPermission==='function'){
        const permission=await DeviceOrientationEvent.requestPermission();
        if(permission!=='granted')throw new Error('Motion permission not granted');
      }
      setAuto(false);setTilt(true);
      orientationHandler=e=>{if(!tilt||down)return;if(typeof e.gamma!=='number'||typeof e.beta!=='number')return;targetX=limit(e.gamma/700,-.055,.055);targetY=limit((e.beta-45)/1000,-.035,.035);requestFrame();};
      window.addEventListener('deviceorientation',orientationHandler);
      setStatus('Phone tilt enabled. Tilt gently, or drag to explore.');
    }catch(err){setTilt(false);setStatus('Phone tilt unavailable or blocked. Finger drag still works.');}
  }
  async function initialize(){
    try{
      const [photo,depth]=await Promise.all([image(stage.dataset.photo),image(stage.dataset.depth)]);
      if(photo.naturalWidth!==depth.naturalWidth||photo.naturalHeight!==depth.naturalHeight){
        // Different source resolution is legitimate if both images have the same aspect ratio.
        const aspectPhoto=photo.naturalWidth/photo.naturalHeight,aspectDepth=depth.naturalWidth/depth.naturalHeight;
        if(Math.abs(aspectPhoto-aspectDepth)>.01)throw new Error('Poster/depth aspect ratio mismatch');
      }
      gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'low-power'});
      if(!gl)throw new Error('WebGL unavailable');
      program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'Shader link failed');
      gl.useProgram(program);
      const verts=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,verts);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      const pos=gl.getAttribLocation(program,'aPosition');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
      texture(photo,0);texture(depth,1);
      for(const name of ['uPhoto','uDepth','uShift','uStrength','uOriginal'])uniforms[name]=gl.getUniformLocation(program,name);
      gl.uniform1i(uniforms.uPhoto,0);gl.uniform1i(uniforms.uDepth,1);
      canvas.style.display='block';ready=true;stage.classList.add('is-ready');
      setStatus('3D depth ready. Drag on mobile or move your mouse to explore.');
      requestFrame();
    }catch(err){console.error('AMR Living Gallery:',err);fail('Showing the original artwork. Interactive depth is unavailable on this device.');}
  }
  const setPointer=(e)=>{const r=stage.getBoundingClientRect();targetX=limit(((e.clientX-r.left)/r.width-.5)*.12,-.055,.055);targetY=limit(((e.clientY-r.top)/r.height-.5)*.07,-.035,.035);requestFrame();};
  stage.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;down=true;setAuto(false);if(tilt)setTilt(false);stage.setPointerCapture(e.pointerId);setPointer(e);});
  stage.addEventListener('pointermove',e=>{if(down||e.pointerType==='mouse'&&!auto&&!tilt)setPointer(e);});
  stage.addEventListener('pointerup',()=>{down=false;requestFrame();});stage.addEventListener('pointercancel',()=>{down=false;requestFrame();});
  stage.addEventListener('pointerleave',()=>{if(!down&&!auto&&!tilt){targetX=0;targetY=0;requestFrame();}});
  reset.addEventListener('click',()=>{setAuto(false);if(tilt)setTilt(false);originalView=false;original.setAttribute('aria-pressed','false');original.textContent='Original image';range.value='85';output.value='85%';targetX=0;targetY=0;requestFrame();setStatus('View reset. Drag to explore the 3D scene.');});
  original.addEventListener('click',()=>{originalView=!originalView;original.setAttribute('aria-pressed',String(originalView));original.textContent=originalView?'Back to 3D':'Original image';requestFrame();setStatus(originalView?'Original unmodified artwork.':'Interactive depth view.');});
  autoButton.addEventListener('click',()=>{if(tilt)setTilt(false);setAuto(!auto);setStatus(auto?'Slow cinematic drift enabled.':'Drag or move mouse to explore.');});
  range.addEventListener('input',()=>{output.value=range.value+'%';requestFrame();});
  if(typeof window.DeviceOrientationEvent!=='undefined'){tiltButton.hidden=false;tiltButton.addEventListener('click',enableTilt);}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else requestFrame();});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fail('Graphics paused; showing original artwork.');});
  canvas.addEventListener('webglcontextrestored',initialize);
  window.addEventListener('resize',requestFrame,{passive:true});
  initialize();
})();