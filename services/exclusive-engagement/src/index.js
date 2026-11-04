// AMR Exclusives engagement service — Cloudflare Worker + D1.
// Deployment requires owner approval, D1 binding DB and secret VISITOR_HASH_SECRET.
// Anonymous counters are best-effort and are not a fraud-proof audience census.
const VIDEO_IDS = new Set(['enuk', 'laestrygonians']);
const ALLOWED_ORIGIN = 'https://ancientmysteriesrediscovered.com';
function json(data, status=200, origin='') {
  const headers = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin'};
  if (origin === ALLOWED_ORIGIN) {
    headers['Access-Control-Allow-Origin']=origin;
    headers['Access-Control-Allow-Methods']='GET, PUT, DELETE, POST, OPTIONS';
    headers['Access-Control-Allow-Headers']='Content-Type, Accept';
  }
  return new Response(JSON.stringify(data), {status,headers});
}
function validVisitor(value) { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
async function digest(secret, value) {
  const bytes = new TextEncoder().encode(secret);
  const key = await crypto.subtle.importKey('raw', bytes, {name:'HMAC',hash:'SHA-256'},false,['sign']);
  const sig = await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value));
  return Array.from(new Uint8Array(sig), b=>b.toString(16).padStart(2,'0')).join('');
}
async function totals(db, videoId) {
  const [likes,views] = await Promise.all([
    db.prepare('SELECT COUNT(*) AS total FROM likes WHERE video_id = ?').bind(videoId).first(),
    db.prepare('SELECT COUNT(*) AS total FROM qualified_views WHERE video_id = ?').bind(videoId).first()
  ]);
  return {likes:likes?.total??0,views:views?.total??0};
}
async function rateLimit(db, key, action, limit) {
  const window = Math.floor(Date.now()/60000);
  await db.prepare('INSERT INTO rate_events (visitor_hash,action,window_start,count) VALUES (?,?,?,1) ON CONFLICT(visitor_hash,action,window_start) DO UPDATE SET count=count+1').bind(key,action,window).run();
  const result=await db.prepare('SELECT count FROM rate_events WHERE visitor_hash=? AND action=? AND window_start=?').bind(key,action,window).first();
  return result.count <= limit;
}
export default {
  async fetch(request, env) {
    const origin=request.headers.get('Origin')||'';
    if (request.method==='OPTIONS') return origin===ALLOWED_ORIGIN ? new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, PUT, DELETE, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Accept','Vary':'Origin'}}) : json({error:'Origin denied'},403);
    if (!env.DB || !env.VISITOR_HASH_SECRET) return json({error:'Service not configured'},503,origin);
    const url=new URL(request.url);
    const match=url.pathname.match(/^\/videos\/([a-z0-9-]+)(?:\/(like|view))?\/?$/);
    if (!match || !VIDEO_IDS.has(match[1])) return json({error:'Unknown video'},404,origin);
    const videoId=match[1],action=match[2]||'';
    if (request.method==='GET' && !action) return json(await totals(env.DB,videoId),200,origin);
    if (origin!==ALLOWED_ORIGIN) return json({error:'Origin denied'},403);
    if (!((action==='like' && ['PUT','DELETE'].includes(request.method))||(action==='view' && request.method==='POST'))) return json({error:'Method not allowed'},405,origin);
    if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({error:'Expected JSON'},415,origin);
    if (Number(request.headers.get('Content-Length')||0)>2048) return json({error:'Payload too large'},413,origin);
    let body;try{body=await request.json();}catch{return json({error:'Invalid JSON'},400,origin);}
    if (!validVisitor(body?.visitorKey)) return json({error:'Invalid visitor key'},400,origin);
    if (action==='view' && body.qualifiedSeconds!==3) return json({error:'Invalid view threshold'},400,origin);
    const visitorHash=await digest(env.VISITOR_HASH_SECRET,body.visitorKey);
    const ip=request.headers.get('CF-Connecting-IP')||'unknown';
    const ipHash=await digest(env.VISITOR_HASH_SECRET,ip);
    if (!await rateLimit(env.DB,ipHash,action,action==='view'?25:30)) return json({error:'Rate limited'},429,origin);
    if (action==='like') {
      if (request.method==='PUT') await env.DB.prepare('INSERT OR IGNORE INTO likes(video_id,visitor_hash) VALUES (?,?)').bind(videoId,visitorHash).run();
      else await env.DB.prepare('DELETE FROM likes WHERE video_id=? AND visitor_hash=?').bind(videoId,visitorHash).run();
    } else {
      const day=new Date().toISOString().slice(0,10);
      await env.DB.prepare('INSERT OR IGNORE INTO qualified_views(video_id,visitor_hash,view_day) VALUES (?,?,?)').bind(videoId,visitorHash,day).run();
    }
    return json(await totals(env.DB,videoId),200,origin);
  }
};
