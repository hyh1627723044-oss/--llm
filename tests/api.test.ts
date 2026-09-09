import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileRequest } from '../server/llm';
test('missing key uses explicit local mode',async()=>{
 const p=await compileRequest({kind:'strategy',text:'优先攻击后排',role:'assassin'},{apiKey:''});
 assert.equal(p.source,'local');assert.equal(p.strategy?.target,'ranged');
});
test('DeepSeek receives server-controlled model and non-thinking JSON request',async()=>{
 let payload:any;
 const fetchImpl=async(_url:any,init:any)=>{payload=JSON.parse(init.body);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({kind:'upgrade',role:'guard',upgrade:'power',summary:'攻击力 +20%'})}}]}),{status:200});};
 const p=await compileRequest({kind:'upgrade',text:'变强一点',role:'guard'},{apiKey:'test',fetchImpl:fetchImpl as typeof fetch});
 assert.equal(p.source,'deepseek');assert.equal(p.upgrade,'power');assert.equal(payload.model,'deepseek-v4-flash');assert.equal(payload.thinking.type,'disabled');assert.equal(payload.response_format.type,'json_object');
});
test('invalid model output cannot invent abilities or redirect the chosen character',async()=>{
 const fetchImpl=async()=>new Response(JSON.stringify({choices:[{message:{content:'{"kind":"upgrade","role":"archer","upgrade":"power","summary":"x"}'}}]}));
 await assert.rejects(()=>compileRequest({kind:'upgrade',text:'攻击',role:'guard'},{apiKey:'test',fetchImpl:fetchImpl as typeof fetch}),/角色/);
});
test('model service failure is visible and never silently falls back to local',async()=>{
 await assert.rejects(()=>compileRequest({kind:'strategy',text:'攻击',role:'guard'},{apiKey:'test',fetchImpl:(async()=>new Response('private vendor details',{status:429})) as typeof fetch}),/429/);
});
test('request boundary rejects invalid kinds and large text',async()=>{
 await assert.rejects(()=>compileRequest({kind:'execute',text:'x',role:'guard'},{apiKey:''}));
 await assert.rejects(()=>compileRequest({kind:'strategy',text:'x'.repeat(601),role:'guard'},{apiKey:''}));
});
