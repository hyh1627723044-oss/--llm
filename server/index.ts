import http from 'node:http';
import {existsSync,createReadStream,statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileRequest} from './llm';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const env=path.join(root,'.env');if(existsSync(env))process.loadEnvFile(env);
const apiKey=process.env.DEEPSEEK_API_KEY?.trim()||'';
const model=process.env.DEEPSEEK_MODEL||'deepseek-v4-flash';
const production=process.argv.includes('--production');
const vite=production?null:await (await import('vite')).createServer({root,server:{middlewareMode:true},appType:'spa'});
const requests=new Map<string,{count:number;until:number}>();
const json=(res:http.ServerResponse,status:number,value:unknown)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url||'/', 'http://localhost');
 if(url.pathname==='/api/status'){json(res,200,{mode:apiKey?'deepseek':'local',model:apiKey?model:null});return;}
 if(url.pathname==='/api/compile'){
  if(req.method!=='POST'){json(res,405,{error:'请使用 POST'});return;}
  if(req.headers.origin){try {if(new URL(req.headers.origin).host!==req.headers.host){json(res,403,{error:'请求来源不匹配'});return;}}catch{json(res,403,{error:'请求来源无效'});return;}}
  if(!req.headers['content-type']?.includes('application/json')){json(res,415,{error:'需要 JSON 请求'});return;}
  const now=Date.now(),address=req.socket.remoteAddress||'local';
  for(const [key,value] of requests)if(value.until<now)requests.delete(key);
  const record=requests.get(address)||{count:0,until:now+60000};record.count++;requests.set(address,record);
  if(record.count>30){json(res,429,{error:'请求较频繁，请一分钟后再试。'});return;}
  try {let raw='';for await(const chunk of req){raw+=chunk.toString();if(Buffer.byteLength(raw)>8192){json(res,413,{error:'输入过长'});return;}}
   const result=await compileRequest(JSON.parse(raw),{apiKey,model});json(res,200,result);
  }catch(error){json(res,400,{error:error instanceof SyntaxError?'JSON 格式错误':error instanceof Error?error.message:'生成失败，请重试。'});}return;
 }
 if(url.pathname.startsWith('/api/')){json(res,404,{error:'接口不存在'});return;}
 if(vite){vite.middlewares(req,res);return;}
 let pathname:string;try{pathname=decodeURIComponent(url.pathname);}catch{res.writeHead(400);res.end();return;}
 const dist=path.join(root,'dist');let file=path.resolve(dist,'.'+pathname);
 if(!file.startsWith(dist+path.sep)&&file!==dist){res.writeHead(403);res.end();return;}
 if(!existsSync(file)||!statSync(file).isFile()){if(path.extname(pathname)){res.writeHead(404);res.end();return;}file=path.join(dist,'index.html');}
 if(!existsSync(file)){res.writeHead(503);res.end('Run npm run build first.');return;}
 const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'};
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});createReadStream(file).pipe(res);
});
const port=Number(process.env.PORT||4173);
const host=process.env.HOST||'127.0.0.1';
server.listen(port,host,()=>console.log(`Tactic Weaver: http://${host}:${port} (${apiKey?'DeepSeek':'local demo'})`));
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
