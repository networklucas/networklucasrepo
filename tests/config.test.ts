import {test} from 'node:test';
import assert from 'node:assert/strict';
import {geminiKeyState} from '../src/lib/config';
test('Gemini configuration rejects code and accepts key-shaped values',()=>{
assert.equal(geminiKeyState(undefined),'missing');
assert.equal(geminiKeyState('import os\nfrom google import genai'),'invalid');
assert.equal(geminiKeyState('"example key"'),'invalid');
assert.equal(geminiKeyState('AIza'+'a'.repeat(35)),'ready');
});

test('Gemini accepts auth tokens without assuming legacy length or alphabet',()=>{assert.equal(geminiKeyState('AQ.'+'a'.repeat(260)+'_-/+='),'ready');assert.equal(geminiKeyState('  AQ.example-token/with+padding=  '),'ready');});
