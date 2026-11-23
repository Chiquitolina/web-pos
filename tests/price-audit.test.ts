import 'fake-indexeddb/auto';
import { IDBObjectStore } from 'fake-indexeddb';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PosDatabase, metadata } from '../src/app/core/indexed-db';
import { emptyData, Data } from '../src/app/core/models';
import { saveProduct, deleteProduct } from '../src/app/core/catalog';
import { exportCatalog, importCatalog } from '../src/app/core/catalog-transfer';
import { validateData } from '../src/app/core/domain';
const name=()=>crypto.randomUUID();
const req=<T>(r:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
const done=(tx:IDBTransaction)=>new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});
function edit(d:Data,price:number){const p=d.products[0];saveProduct(d,p.id,{name:p.name,gridoName:p.gridoName??p.name,category:p.category,price});}
test('cambio directo guarda producto, precio anterior/nuevo y fecha en la misma transacción',async()=>{
 const db=await PosDatabase.open(name());try{const before=(await db.exportData()).products[0];await db.update(d=>edit(d,123400));const result=await db.queryPriceAudit(1);assert.equal(result.total,1);const row=result.rows[0];assert.equal(row.action,'PRICE_CHANGED');assert.equal(row.source,'PRODUCT_EDIT');assert.equal(row.productId,before.id);assert.equal(row.productName,before.name);assert.equal(row.previousPrice,before.price);assert.equal(row.newPrice,123400);assert.ok(Number.isFinite(Date.parse(row.at)));assert.equal((await db.exportData()).products[0].price,123400);const data=await db.exportData();assert.doesNotThrow(()=>validateData(data));
 }finally{db.close();}
});
test('guardar sin cambios no duplica; ediciones de nombre y gramaje conservan sus valores anteriores',async()=>{
 const db=await PosDatabase.open(name());try{await db.update(d=>{d.products[0].name='Nombre uno';});assert.equal((await db.queryPriceAudit(1)).total,1);await db.update(d=>edit(d,100));await db.update(d=>{d.products[0].name='Nombre dos';d.products[0].iceCreamGrams=160;d.products[0].iceCreamScoops=2;});await db.update(d=>edit(d,100));const r=await db.queryPriceAudit(1);assert.equal(r.total,3);assert.equal(r.rows[0].action,'PRODUCT_EDITED');assert.equal(r.rows[0].previousPrice,100);assert.equal(r.rows[0].newPrice,100);assert.deepEqual(r.rows[0].changes!.map(c=>c.field),['name','iceCreamGrams','iceCreamScoops']);assert.equal(r.rows[1].productName,'Nombre uno');}finally{db.close();}
});
test('altas/bajas y reemplazo de catálogo quedan registrados; reimportar igual no duplica',async()=>{
 const db=await PosDatabase.open(name());try{await db.update(d=>saveProduct(d,'new',{name:'Nuevo',gridoName:'NEW',category:'Granel',price:100}));await db.update(d=>deleteProduct(d,'new'));let rows=(await db.queryPriceAudit(1)).rows;assert.deepEqual(rows.map(r=>r.action),['PRODUCT_REMOVED','PRODUCT_ADDED']);
 const file=exportCatalog(await db.exportData());file.products[0].price=999;await db.update(d=>importCatalog(d,file),{priceSource:'CATALOG_IMPORT'});rows=(await db.queryPriceAudit(1)).rows;assert.equal(rows[0].source,'CATALOG_IMPORT');assert.equal(rows[0].newPrice,999);assert.equal(rows[0].previousPrice,350000);const count=rows.length;await db.update(d=>importCatalog(d,file),{priceSource:'CATALOG_IMPORT'});assert.equal((await db.queryPriceAudit(1)).total,count);
 }finally{db.close();}
});
test('dos conexiones conservan la cadena de precios con reloj igual o atrasado',async()=>{
 const dbName=name(),a=await PosDatabase.open(dbName),b=await PosDatabase.open(dbName);const now=Date.now;Date.now=()=>1000;
 try{await Promise.all([a.update(d=>edit(d,100)),b.update(d=>edit(d,200))]);Date.now=()=>0;await a.update(d=>edit(d,300));const rows=(await b.queryPriceAudit(1)).rows.reverse();assert.deepEqual(rows.map(r=>[r.previousPrice,r.newPrice]),[[350000,100],[100,200],[200,300]]);assert.ok(rows[0].at<rows[1].at&&rows[1].at<rows[2].at);}finally{Date.now=now;a.close();b.close();}
});
test('error de operación o de escritura del registro revierte también el precio',async()=>{
 const db=await PosDatabase.open(name());try{const before=await db.exportData();await assert.rejects(db.update(d=>{edit(d,1);throw Error('fallo');}));assert.deepEqual(await db.exportData(),before);
 const add=IDBObjectStore.prototype.add;IDBObjectStore.prototype.add=function(...args:any[]){if(this.name==='priceAudit')throw Error('fallo auditoría');return add.apply(this,args as any);};try{await assert.rejects(db.update(d=>edit(d,1)),/fallo auditoría/);}finally{IDBObjectStore.prototype.add=add;}assert.deepEqual(await db.exportData(),before);
 await assert.rejects(db.update(d=>{d.priceAudit=[];}),/no se puede editar/);assert.deepEqual(await db.exportData(),before);
 }finally{db.close();}
});
test('restaurar archivo antiguo conserva registros locales y registra reversión de precio y restauración',async()=>{
 const db=await PosDatabase.open(name());try{const old=await db.exportData();await db.update(d=>edit(d,100));const original=(await db.queryPriceAudit(1)).rows[0];await db.restore(old);const rows=(await db.queryPriceAudit(1)).rows;assert.equal(rows.length,3);assert.equal(rows[0].action,'BACKUP_RESTORED');assert.equal(rows[1].source,'BACKUP_RESTORE');assert.equal(rows[1].previousPrice,100);assert.equal(rows[1].newPrice,350000);assert.deepEqual(rows[2],original);assert.doesNotThrow(()=>validateData(old));assert.equal((await db.exportData()).products[0].price,350000);}finally{db.close();}
});
test('respaldo transporta auditoría, combina sin duplicados y rechaza alteración con mismo ID',async()=>{
 const a=await PosDatabase.open(name()),b=await PosDatabase.open(name());try{await a.update(d=>edit(d,123));const backup=await a.exportData();assert.equal(backup.priceAudit!.length,1);assert.deepEqual(validateData(backup),backup);await b.restore(backup);const after=await b.exportData();assert.ok(after.priceAudit!.some(r=>r.id===backup.priceAudit![0].id));await b.restore(backup);const twice=await b.exportData();assert.equal(twice.priceAudit!.filter(r=>r.id===backup.priceAudit![0].id).length,1);
 const bad=structuredClone(backup);bad.priceAudit![0].newPrice=124;bad.priceAudit![0].changes!.find(c=>c.field==='price')!.next=124;await assert.rejects(b.restore(bad),/mismo ID/);assert.deepEqual(await b.exportData(),twice);
 const invalid=structuredClone(backup);invalid.priceAudit![0].previousPrice=-1;invalid.priceAudit![0].changes!.find(c=>c.field==='price')!.previous=-1;await assert.rejects(b.restore(invalid),/inválido|inconsistentes/);assert.deepEqual(await b.exportData(),twice);
 }finally{a.close();b.close();}
});
test('migra base 2 a 4 sin alterar catálogo, caja, ventas, semanas ni metadatos',async()=>{
 const dbName=name(),data=emptyData();data.products[0].price=999;data.sessions.push({id:'cash',openedAt:'2026-10-12T12:00:00Z',opening:0,movements:[]});
 const opening=indexedDB.open(dbName,2);opening.onupgradeneeded=()=>{for(const n of ['meta','products','categories','sales','sessions','weeks'])opening.result.createObjectStore(n,{keyPath:n==='meta'?'key':'id'});const sales=opening.transaction!.objectStore('sales');for(const [index,key] of [['byNumber','number'],['bySession','sessionId'],['byWeek','weekId'],['byAt','at'],['byCancellationAt','cancellation.at']])sales.createIndex(index,key,{unique:index==='byNumber'});};const raw=await req(opening);const tx=raw.transaction([...raw.objectStoreNames],'readwrite');tx.objectStore('meta').put(metadata(data,7));for(const n of ['products','sales','sessions','weeks'] as const)for(const row of data[n])tx.objectStore(n).put(row);for(const c of data.categoryDetails!)tx.objectStore('categories').put(c);await done(tx);raw.close();
 const db=await PosDatabase.open(dbName);try{assert.deepEqual(await db.exportData(),data);assert.equal((await db.view()).meta.revision,7);assert.equal((await db.queryPriceAudit(1)).total,0);await db.update(d=>edit(d,100));assert.equal((await db.queryPriceAudit(1)).rows[0].previousPrice,999);}finally{db.close();}
});
test('paginación por fecha no carga el registro entero en las vistas de ventas',async()=>{
 const db=await PosDatabase.open(name());try{for(let n=1;n<=31;n++)await db.update(d=>edit(d,n));const one=await db.queryPriceAudit(1),two=await db.queryPriceAudit(2);assert.equal(one.total,31);assert.equal(one.pages,2);assert.equal(one.rows.length,25);assert.equal(two.rows.length,6);assert.equal(one.rows[0].newPrice,31);assert.equal(two.rows.at(-1)!.newPrice,1);assert.equal((await db.view()).data.priceAudit,undefined);await assert.rejects(db.queryPriceAudit(0),/Página/);}finally{db.close();}
});
