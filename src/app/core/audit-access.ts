type Credential={version:1;salt:string;digest:string};
const iterations=210000;
const defaultCredential:Credential={version:1,salt:'e53a9c23d7c41d699ad8f49e2e3c0b17',digest:'b12b5dd8c1c5498849d2fca90dc3f7a1ed89d6d0f4417a2043ea46d90f0bd1a2'};
const key=(dbName:string)=>dbName+':price-audit-access';
const validPin=(pin:string)=>typeof pin==='string'&&pin.length>=6&&pin.length<=128;
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
function credential(storage:Pick<Storage,'getItem'>,dbName:string):Credential|null {
 const raw=storage.getItem(key(dbName));if(raw===null)return null;
 try{const data=JSON.parse(raw);if(data.version===1&&/^[a-f0-9]{32}$/.test(data.salt)&&/^[a-f0-9]{64}$/.test(data.digest))return data;}catch{}
 throw Error('La configuración del acceso privado no es válida.');
}
async function digest(pin:string,salt:string):Promise<string> {
 if(!globalThis.crypto?.subtle)throw Error('El acceso privado necesita HTTPS o localhost.');
 const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);
 const bytes=Uint8Array.from(salt.match(/../g)!,part=>parseInt(part,16));
 return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:bytes,iterations,hash:'SHA-256'},material,256)));
}
export function hasAuditAccess(storage:Pick<Storage,'getItem'>,dbName:string):boolean {return storage.getItem(key(dbName))!==null;}
export async function setupAuditAccess(storage:Pick<Storage,'getItem'|'setItem'>,dbName:string,pin:string,repeat:string):Promise<void> {
 if(!validPin(pin))throw Error('Usá una clave de 6 a 128 caracteres.');if(pin!==repeat)throw Error('Las claves no coinciden.');
 if(hasAuditAccess(storage,dbName))throw Error('Este navegador ya tiene una clave configurada.');
 const salt=hex(crypto.getRandomValues(new Uint8Array(16))),value:Credential={version:1,salt,digest:await digest(pin,salt)};
 if(hasAuditAccess(storage,dbName))throw Error('La clave se configuró desde otra pestaña. Volvé a ingresar.');
 storage.setItem(key(dbName),JSON.stringify(value));
}
export async function verifyAuditAccess(storage:Pick<Storage,'getItem'>,dbName:string,pin:string):Promise<boolean> {
 const saved=credential(storage,dbName)??defaultCredential;if(!validPin(pin))return false;
 const value=await digest(pin,saved.salt);let difference=0;for(let i=0;i<value.length;i++)difference|=value.charCodeAt(i)^saved.digest.charCodeAt(i);return difference===0;
}
