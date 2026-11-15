(()=>{'use strict';
  const stage=document.getElementById('stage'),canvas=document.getElementById('depth-canvas'),status=document.getElementById('viewer-status');
  if(!stage||!canvas||!status)return;
  const range=document.getElementById('depth-strength'),output=document.getElementById('depth-value');
  const reset=document.getElementById('reset-view'),original=document.getElementById('show-original');
  const autoButton=document.getElementById('auto-drift'),tiltButton=document.getElementById('phone-tilt');
  const reduceMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const strictDepth16=stage.dataset.depthFormat==='png16';
  const defaultStrength=Number(stage.dataset.defaultStrength||85);
  const maxX=Number(stage.dataset.maxShiftX||.055),maxY=Number(stage.dataset.maxShiftY||.035);
  const limit=(n,min,max)=>Math.max(min,Math.min(max,n));
  const image=(src)=>new Promise((resolve,reject)=>{const im=new Image();im.decoding='async';im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('Unable to load exhibit image'));im.src=src;});
  let gl,program,uniforms={},raf=0,ready=false,auto=false,tilt=false,originalView=false,down=false;
  let targetX=0,targetY=0,shiftX=0,shiftY=0,start=performance.now();
  let orientationHandler=null;

  const vertex1=`attribute vec2 aPosition;varying vec2 uv;void main(){uv=(aPosition+1.0)*0.5;gl_Position=vec4(aPosition,0.0,1.0);}`;
  const fragment1=`precision highp float;varying vec2 uv;uniform sampler2D uPhoto;uniform sampler2D uDepth;uniform vec2 uShift;uniform float uStrength;uniform int uOriginal;
void main(){if(uOriginal==1){gl_FragColor=texture2D(uPhoto,uv);return;}vec2 base=(uv-.5)/1.19+.5;vec2 pos=base;for(int i=0;i<6;i++){float depth=pow(max(texture2D(uDepth,clamp(pos,vec2(.001),vec2(.999))).r,0.0),0.88);pos=base-uShift*uStrength*depth;}gl_FragColor=texture2D(uPhoto,clamp(pos,vec2(.001),vec2(.999)));}`;
  const vertex2=`#version 300 es
in vec2 aPosition;out vec2 uv;void main(){uv=(aPosition+1.0)*0.5;gl_Position=vec4(aPosition,0.0,1.0);}`;
  const fragment2=`#version 300 es
precision highp float;precision highp usampler2D;in vec2 uv;uniform sampler2D uPhoto;uniform usampler2D uDepth;uniform vec2 uShift;uniform float uStrength;uniform int uOriginal;out vec4 outColor;
float depthAt(vec2 coord){ivec2 size=textureSize(uDepth,0);vec2 pixel=clamp(coord,vec2(0.0),vec2(1.0))*vec2(size)-.5;ivec2 p0=clamp(ivec2(floor(pixel)),ivec2(0),size-1);ivec2 p1=min(p0+1,size-1);vec2 f=fract(pixel);float a=float(texelFetch(uDepth,p0,0).r);float b=float(texelFetch(uDepth,ivec2(p1.x,p0.y),0).r);float c=float(texelFetch(uDepth,ivec2(p0.x,p1.y),0).r);float d=float(texelFetch(uDepth,p1,0).r);return mix(mix(a,b,f.x),mix(c,d,f.x),f.y)/65535.0;}
void main(){if(uOriginal==1){outColor=texture(uPhoto,uv);return;}vec2 base=(uv-.5)/1.19+.5;vec2 pos=base;for(int i=0;i<6;i++){float depth=pow(max(depthAt(pos),0.0),0.88);pos=base-uShift*uStrength*depth;}outColor=texture(uPhoto,clamp(pos,vec2(.001),vec2(.999)));}`;

  function compile(type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader)||'Shader compilation failed');return shader;}
  function setTextureSampling(){gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);}
  function imageTexture(img,index){const tex=gl.createTexture();gl.activeTexture(gl.TEXTURE0+index);gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);setTextureSampling();return tex;}
  function depth16Texture(depth,index){const tex=gl.createTexture();gl.activeTexture(gl.TEXTURE0+index);gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.R16UI,depth.width,depth.height,0,gl.RED_INTEGER,gl.UNSIGNED_SHORT,depth.pixels);if(gl.getError()!==gl.NO_ERROR)throw new Error('Native 16-bit integer depth texture upload failed');if(gl.getTexLevelParameter(gl.TEXTURE_2D,0,gl.TEXTURE_INTERNAL_FORMAT)!==gl.R16UI)throw new Error('Browser did not retain the R16UI depth texture');gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);return tex;}
  function readU32(data,offset){return(data[offset]*0x1000000)+(data[offset+1]<<16)+(data[offset+2]<<8)+data[offset+3];}
  function paeth(a,b,c){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;}

  async function decodePng16(src){
    if(typeof DecompressionStream==='undefined')throw new Error('This browser cannot decode native 16-bit PNG depth');
    const response=await fetch(src,{credentials:'same-origin'});if(!response.ok)throw new Error('Unable to load 16-bit depth map');
    const data=new Uint8Array(await response.arrayBuffer()),signature=[137,80,78,71,13,10,26,10];
    if(signature.some((value,index)=>data[index]!==value))throw new Error('Depth map is not a PNG');
    let width=0,height=0,bitDepth=0,colorType=0,compression=0,filterMethod=0,interlace=0,offset=8;const idat=[];
    while(offset+12<=data.length){const length=readU32(data,offset),type=String.fromCharCode(...data.subarray(offset+4,offset+8)),startChunk=offset+8,endChunk=startChunk+length;if(endChunk+4>data.length)throw new Error('Truncated depth PNG');const chunk=data.subarray(startChunk,endChunk);if(type==='IHDR'){width=readU32(chunk,0);height=readU32(chunk,4);bitDepth=chunk[8];colorType=chunk[9];compression=chunk[10];filterMethod=chunk[11];interlace=chunk[12];}else if(type==='IDAT')idat.push(chunk);offset=endChunk+4;if(type==='IEND')break;}
    if(!width||!height||bitDepth!==16||colorType!==0||compression!==0||filterMethod!==0||interlace!==0)throw new Error('Depth must be a non-interlaced 16-bit grayscale PNG');
    const compressedLength=idat.reduce((sum,chunk)=>sum+chunk.length,0),compressed=new Uint8Array(compressedLength);let cursor=0;for(const chunk of idat){compressed.set(chunk,cursor);cursor+=chunk.length;}
    const decompressed=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer();
    const raw=new Uint8Array(decompressed),stride=width*2,expected=(stride+1)*height;if(raw.length!==expected)throw new Error('Unexpected 16-bit PNG scanline size');
    const recon=new Uint8Array(stride*height);cursor=0;
    for(let y=0;y<height;y++){const rowFilter=raw[cursor++];for(let x=0;x<stride;x++){const value=raw[cursor++],index=y*stride+x,left=x>=2?recon[index-2]:0,up=y?recon[index-stride]:0,upLeft=y&&x>=2?recon[index-stride-2]:0;let result;if(rowFilter===0)result=value;else if(rowFilter===1)result=value+left;else if(rowFilter===2)result=value+up;else if(rowFilter===3)result=value+Math.floor((left+up)/2);else if(rowFilter===4)result=value+paeth(left,up,upLeft);else throw new Error('Unsupported PNG row filter');recon[index]=result&255;}}
    // Typed-array uploads ignore UNPACK_FLIP_Y_WEBGL. Reverse rows so depth and poster align.
    const pixels=new Uint16Array(width*height);for(let y=0;y<height;y++){const targetRow=height-1-y;for(let x=0;x<width;x++){const source=(y*width+x)*2;pixels[targetRow*width+x]=recon[source]*256+recon[source+1];}}
    return{width,height,pixels};
  }

  function setStatus(message){status.textContent=message;}
  function stop(){if(raf)cancelAnimationFrame(raf);raf=0;}
  function fail(message){ready=false;stop();stage.classList.remove('is-ready');setStatus(message);canvas.style.display='none';}
  function requestFrame(){if(ready&&!raf&&!document.hidden)raf=requestAnimationFrame(draw);}
  function draw(now){raf=0;if(!ready||document.hidden)return;const time=(now-start)/1000;if(auto){targetX=Math.min(maxX,.028)*Math.sin(time*.9);targetY=Math.min(maxY,.016)*Math.sin(time*.73+.4);}shiftX+=(targetX-shiftX)*.18;shiftY+=(targetY-shiftY)*.18;const dpr=Math.min(window.devicePixelRatio||1,2),width=Math.max(1,Math.round(stage.clientWidth*dpr)),height=Math.max(1,Math.round(stage.clientHeight*dpr));if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;gl.viewport(0,0,width,height);}gl.uniform2f(uniforms.uShift,shiftX,shiftY);gl.uniform1f(uniforms.uStrength,Number(range.value)/100);gl.uniform1i(uniforms.uOriginal,originalView?1:0);gl.drawArrays(gl.TRIANGLES,0,6);if(auto||tilt||down||Math.abs(shiftX-targetX)+Math.abs(shiftY-targetY)>.0001)requestFrame();}
  function setAuto(enabled){auto=enabled&&!reduceMotion;autoButton.setAttribute('aria-pressed',String(auto));autoButton.textContent='Auto drift: '+(auto?'On':'Off');if(!auto&&!down&&!tilt){targetX=0;targetY=0;}requestFrame();}
  function setTilt(enabled){tilt=enabled;tiltButton.setAttribute('aria-pressed',String(enabled));tiltButton.textContent='Phone tilt: '+(enabled?'On':'Off');if(!enabled&&orientationHandler){window.removeEventListener('deviceorientation',orientationHandler);orientationHandler=null;targetX=0;targetY=0;}requestFrame();}
  async function enableTilt(){if(tilt){setTilt(false);setStatus('Phone tilt disabled. Drag to explore.');return;}try{if(typeof DeviceOrientationEvent==='undefined')throw new Error('Phone tilt unavailable');if(typeof DeviceOrientationEvent.requestPermission==='function'){const permission=await DeviceOrientationEvent.requestPermission();if(permission!=='granted')throw new Error('Motion permission not granted');}setAuto(false);setTilt(true);orientationHandler=e=>{if(!tilt||down||typeof e.gamma!=='number'||typeof e.beta!=='number')return;targetX=limit(e.gamma/700,-maxX,maxX);targetY=limit((e.beta-45)/1000,-maxY,maxY);requestFrame();};window.addEventListener('deviceorientation',orientationHandler);setStatus('Phone tilt enabled. Tilt gently, or drag to explore.');}catch(error){setTilt(false);setStatus('Phone tilt unavailable or blocked. Finger drag still works.');}}
  async function initialize(){
    try{
      const [photo,depth]=await Promise.all([image(stage.dataset.photo),strictDepth16?decodePng16(stage.dataset.depth):image(stage.dataset.depth)]);
      const depthWidth=strictDepth16?depth.width:depth.naturalWidth,depthHeight=strictDepth16?depth.height:depth.naturalHeight;
      if(photo.naturalWidth!==depthWidth||photo.naturalHeight!==depthHeight){const aspectPhoto=photo.naturalWidth/photo.naturalHeight,aspectDepth=depthWidth/depthHeight;if(Math.abs(aspectPhoto-aspectDepth)>.01)throw new Error('Poster/depth aspect ratio mismatch');}
      gl=canvas.getContext(strictDepth16?'webgl2':'webgl',{alpha:false,antialias:false,powerPreference:'low-power'});if(!gl)throw new Error(strictDepth16?'WebGL 2 is required for native 16-bit depth':'WebGL unavailable');
      program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,strictDepth16?vertex2:vertex1));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,strictDepth16?fragment2:fragment1));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'Shader link failed');gl.useProgram(program);
      const verts=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,verts);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const pos=gl.getAttribLocation(program,'aPosition');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
      imageTexture(photo,0);strictDepth16?depth16Texture(depth,1):imageTexture(depth,1);for(const name of ['uPhoto','uDepth','uShift','uStrength','uOriginal'])uniforms[name]=gl.getUniformLocation(program,name);gl.uniform1i(uniforms.uPhoto,0);gl.uniform1i(uniforms.uDepth,1);
      canvas.style.display='block';ready=true;stage.classList.add('is-ready');setStatus(strictDepth16?'Native 16-bit depth ready. Drag or move your mouse gently to explore.':'3D depth ready. Drag on mobile or move your mouse to explore.');requestFrame();
    }catch(error){console.error('AMR Living Gallery:',error);fail(strictDepth16?'Showing the complete original poster. Native 16-bit interactive depth is unavailable on this device.':'Showing the original artwork. Interactive depth is unavailable on this device.');}
  }
  const setPointer=e=>{const r=stage.getBoundingClientRect();targetX=limit(((e.clientX-r.left)/r.width-.5)*maxX*2,-maxX,maxX);targetY=limit(((e.clientY-r.top)/r.height-.5)*maxY*2,-maxY,maxY);requestFrame();};
  stage.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;down=true;setAuto(false);if(tilt)setTilt(false);stage.setPointerCapture(e.pointerId);setPointer(e);});stage.addEventListener('pointermove',e=>{if(down||e.pointerType==='mouse'&&!auto&&!tilt)setPointer(e);});stage.addEventListener('pointerup',()=>{down=false;requestFrame();});stage.addEventListener('pointercancel',()=>{down=false;requestFrame();});stage.addEventListener('pointerleave',()=>{if(!down&&!auto&&!tilt){targetX=0;targetY=0;requestFrame();}});
  reset.addEventListener('click',()=>{setAuto(false);if(tilt)setTilt(false);originalView=false;original.setAttribute('aria-pressed','false');original.textContent='Original image';range.value=String(defaultStrength);output.value=defaultStrength+'%';targetX=0;targetY=0;requestFrame();setStatus('View reset. Drag to explore the 3D scene.');});original.addEventListener('click',()=>{originalView=!originalView;original.setAttribute('aria-pressed',String(originalView));original.textContent=originalView?'Back to 3D':'Original image';requestFrame();setStatus(originalView?'Original unmodified artwork.':'Interactive depth view.');});autoButton.addEventListener('click',()=>{if(tilt)setTilt(false);setAuto(!auto);setStatus(auto?'Slow cinematic drift enabled.':'Drag or move mouse to explore.');});range.addEventListener('input',()=>{output.value=range.value+'%';requestFrame();});
  if(typeof window.DeviceOrientationEvent!=='undefined'){tiltButton.hidden=false;tiltButton.addEventListener('click',enableTilt);}document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else requestFrame();});canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();fail('Graphics paused; showing original artwork.');});canvas.addEventListener('webglcontextrestored',initialize);window.addEventListener('resize',requestFrame,{passive:true});
  range.value=String(defaultStrength);output.value=defaultStrength+'%';initialize();
})();
