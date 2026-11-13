import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withinDeadline,DeadlineError} from '../src/lib/deadline';
test('deadline rejects even when provider ignores AbortSignal',async()=>{let aborted=false;const start=Date.now();await assert.rejects(()=>withinDeadline(()=>new Promise(()=>{}),25,new AbortController().signal,()=>{aborted=true;}),DeadlineError);assert.ok(aborted);assert.ok(Date.now()-start<1000);});
test('completed work is returned normally',async()=>{assert.equal(await withinDeadline(async()=>42,1000,new AbortController().signal),42);});
test('already canceled requests never start work',async()=>{const c=new AbortController();c.abort();let called=false;await assert.rejects(()=>withinDeadline(async()=>{called=true;},100,c.signal));assert.equal(called,false);});
test('late provider rejection is handled after timeout',async()=>{await assert.rejects(()=>withinDeadline(()=>new Promise((_,reject)=>setTimeout(()=>reject(Error('late')),40)),10,new AbortController().signal),DeadlineError);await new Promise(r=>setTimeout(r,60));});
