// Some restricted Windows workers cannot resolve the local passwd record.
// tsx uses it only to form a per-user IPC pipe name, so a stable local fallback is safe.
const os=require('node:os');
const original=os.userInfo;
os.userInfo=(options)=>{try{return original(options);}catch(error){if(error&&error.code==='ERR_SYSTEM_ERROR')return {username:process.env.USERNAME||'node',uid:-1,gid:-1,shell:null,homedir:process.cwd()};throw error;}};
