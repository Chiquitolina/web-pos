import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasAuditAccess, setupAuditAccess, verifyAuditAccess } from '../src/app/core/audit-access';
function storage(){const map=new Map<string,string>();return {map,getItem:(key:string)=>map.get(key)??null,setItem:(key:string,value:string)=>{map.set(key,value);}};}
test('acceso privado configura clave salada, verifica y persiste sin guardar clave en texto plano',async()=>{
 const s=storage();assert.equal(hasAuditAccess(s,'branch'),false);await setupAuditAccess(s,'branch','831472','831472');assert.equal(hasAuditAccess(s,'branch'),true);const saved=JSON.parse([...s.map.values()][0]);assert.deepEqual(Object.keys(saved).sort(),['digest','salt','version']);assert.equal(saved.digest.length,64);assert.equal(saved.salt.length,32);assert.equal(await verifyAuditAccess(s,'branch','831472'),true);assert.equal(await verifyAuditAccess(s,'branch','831473'),false);assert.equal(await verifyAuditAccess(s,'branch','bad'),false);await assert.rejects(setupAuditAccess(s,'branch','654321','654321'),/ya tiene/);assert.equal(await verifyAuditAccess(s,'branch','831472'),true);
});
test('claves inválidas, repetición distinta y configuración dañada no permiten ingresar ni reemplazarla',async()=>{
 const s=storage();for(const pin of ['12345','x'.repeat(129)])await assert.rejects(setupAuditAccess(s,'branch',pin,pin),/6 a 128/);await assert.rejects(setupAuditAccess(s,'branch','123456','123457'),/no coinciden/);assert.equal(s.map.size,0);assert.equal(await verifyAuditAccess(s,'branch','mermeladacasco'),true);assert.equal(await verifyAuditAccess(s,'branch','123456'),false);s.setItem('branch:price-audit-access','bad JSON');assert.equal(hasAuditAccess(s,'branch'),true);await assert.rejects(verifyAuditAccess(s,'branch','123456'),/no es válida/);await assert.rejects(setupAuditAccess(s,'branch','123456','123456'),/ya tiene/);
});
test('cada base/navegador tiene su configuración y cada clave usa una sal diferente',async()=>{
 const s=storage();await setupAuditAccess(s,'a','123456','123456');await setupAuditAccess(s,'b','123456','123456');const a=JSON.parse(s.getItem('a:price-audit-access')!),b=JSON.parse(s.getItem('b:price-audit-access')!);assert.notEqual(a.salt,b.salt);assert.notEqual(a.digest,b.digest);assert.equal(hasAuditAccess(storage(),'a'),false);assert.equal(await verifyAuditAccess(s,'b','123456'),true);
});

test('contraseña predeterminada funciona sin configuración previa y distingue mayúsculas',async()=>{const s=storage();assert.equal(await verifyAuditAccess(s,'branch','mermeladacasco'),true);assert.equal(await verifyAuditAccess(s,'branch','Mermeladacasco'),false);assert.equal(await verifyAuditAccess(s,'branch','incorrecta'),false);assert.equal(s.map.size,0);});
