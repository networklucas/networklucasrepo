export function geminiKeyState(key:string|undefined):'missing'|'invalid'|'ready'{
 if(!key?.trim())return 'missing';
 // Validate only header-safe token syntax. Google validates authenticity.
 // Auth keys can contain punctuation and have a different length than legacy keys.
 return /^[A-Za-z0-9._~+/=-]+$/.test(key.trim())?'ready':'invalid';
}
