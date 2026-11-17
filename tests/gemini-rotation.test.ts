import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultGeminiModels,geminiModels,geminiThinkingLevel,rotateGemini} from '../src/lib/gemini-rotation';

test('uses the first configured model and maps quick and deep thinking levels',async()=>{
 const seen:string[]=[];const result=await rotateGemini({models:['gemini-3.5-flash-lite','gemini-3.1-flash-lite'],signal:new AbortController().signal,deadlineMs:1000,run:async(model)=>{seen.push(model);return 'done';}});
 assert.deepEqual(seen,['gemini-3.5-flash-lite']);assert.deepEqual(result,{value:'done',model:'gemini-3.5-flash-lite'});assert.equal(geminiThinkingLevel(false),'low');assert.equal(geminiThinkingLevel(true),'medium');
});
test('changes model after a 429 without resetting an attempt that emitted no text',async()=>{
 const seen:string[]=[];let resets=0;const result=await rotateGemini({models:['gemini-3.5-flash-lite','gemini-3.1-flash-lite'],signal:new AbortController().signal,deadlineMs:1000,onReset:()=>resets++,run:async(model)=>{seen.push(model);if(seen.length===1)throw {status:429,message:'per minute'};return 'complete';}});
 assert.equal(result.model,'gemini-3.1-flash-lite');assert.deepEqual(seen,['gemini-3.5-flash-lite','gemini-3.1-flash-lite']);assert.equal(resets,0);
});
test('exhausting all eligible models returns the final quota failure',async()=>{
 const seen:string[]=[];await assert.rejects(()=>rotateGemini({models:['gemini-3.6-flash','gemini-3-flash-preview'],signal:new AbortController().signal,deadlineMs:1000,run:async(model)=>{seen.push(model);throw {status:429};}}),error=>error===undefined?false:(error as {status:number}).status===429);assert.deepEqual(seen,['gemini-3.6-flash','gemini-3-flash-preview']);
});
test('authentication errors do not change model',async()=>{const seen:string[]=[];await assert.rejects(()=>rotateGemini({models:['gemini-3.5-flash-lite','gemini-3.1-flash-lite'],signal:new AbortController().signal,deadlineMs:1000,run:async(model)=>{seen.push(model);throw {status:401};}}));assert.deepEqual(seen,['gemini-3.5-flash-lite']);});
test('cancellation does not start the next model',async()=>{const controller=new AbortController();const seen:string[]=[];await assert.rejects(()=>rotateGemini({models:['gemini-3.5-flash-lite','gemini-3.1-flash-lite'],signal:controller.signal,deadlineMs:1000,run:async(model)=>{seen.push(model);controller.abort();throw new DOMException('Aborted','AbortError');}}));assert.deepEqual(seen,['gemini-3.5-flash-lite']);});
test('a stream failure after a visible partial response resets before the succeeding model',async()=>{
 const events:string[]=[];let count=0;const result=await rotateGemini({models:['gemini-3.5-flash-lite','gemini-3.1-flash-lite'],signal:new AbortController().signal,deadlineMs:1000,onReset:()=>events.push('reset'),run:async(model,_remaining,delta)=>{events.push(model);if(++count===1){events.push('partial');delta();throw {code:'STREAM_INCOMPLETE'};}return 'final';}});
 assert.equal(result.model,'gemini-3.1-flash-lite');assert.deepEqual(events,['gemini-3.5-flash-lite','partial','reset','gemini-3.1-flash-lite']);
});
test('daily quota does not retry the same model and configuration is ordered and unique',async()=>{
 let waits=0;await assert.rejects(()=>rotateGemini({models:['gemini-3.8-flash'],signal:new AbortController().signal,deadlineMs:1000,wait:async()=>{waits++;},run:async()=>{const error=Object.assign(new Error('Requests per day exhausted'),{status:429,retryAfter:1});throw error;}}));assert.equal(waits,0);
 assert.deepEqual(geminiModels({GEMINI_MODELS:'gemini-3.1-flash-lite, gemini-3.1-flash-lite,gemini-2.5-flash-lite'}),['gemini-3.1-flash-lite','gemini-2.5-flash-lite']);assert.deepEqual(geminiModels({}),[...defaultGeminiModels]);assert.throws(()=>geminiModels({GEMINI_MODELS:'gemini-2.5-flash'}),/GEMINI_MODELS_INVALID/);
});
test('minute limit waits once when it fits the shared deadline',async()=>{const seen:string[]=[];let waits=0;const result=await rotateGemini({models:['gemini-3.5-flash-lite'],signal:new AbortController().signal,deadlineMs:1000,wait:async()=>{waits++;},run:async(model)=>{seen.push(model);if(seen.length===1)throw {status:429,retryAfter:0.01,message:'requests per minute'};return 'done';}});assert.equal(result.model,'gemini-3.5-flash-lite');assert.equal(waits,1);assert.deepEqual(seen,['gemini-3.5-flash-lite','gemini-3.5-flash-lite']);});
test('retry-after cannot loop after its single minute-limit wait',async()=>{const seen:string[]=[];let waits=0;await assert.rejects(()=>rotateGemini({models:['gemini-3.5-flash-lite'],signal:new AbortController().signal,deadlineMs:1000,wait:async()=>{waits++;},run:async(model)=>{seen.push(model);throw {status:429,retryAfter:0.01,message:'per minute'};}}));assert.equal(waits,1);assert.equal(seen.length,2);});
test('daily suppression requires a provider renewal time and does not leak indefinitely',async()=>{let calls=0;for(let i=0;i<2;i++)await assert.rejects(()=>rotateGemini({models:['gemini-3.6-flash'],signal:new AbortController().signal,deadlineMs:1000,run:async()=>{calls++;throw {status:429,message:'daily quota exhausted'};}}));assert.equal(calls,2);});
