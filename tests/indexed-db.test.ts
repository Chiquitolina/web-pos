import 'fake-indexeddb/auto';
import { IDBObjectStore } from 'fake-indexeddb';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PosDatabase } from '../src/app/core/indexed-db';
import { Data, Sale, emptyData } from '../src/app/core/models';
import { closeSession, netSessionClosing, validateData } from '../src/app/core/domain';
import { beginWeek, finishWeek, summarizeSales, weekReport } from '../src/app/core/weeks';
import { cancelSale } from '../src/app/core/cancellations';
import { saveProduct, renameCategory } from '../src/app/core/catalog';
import { weeklyCsv } from '../src/app/core/weekly-csv';
const name=()=>`test-${crypto.randomUUID()}`;
const req=<T>(r:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
const done=(tx:IDBTransaction)=>new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});
function sale(number:number,extra:Partial<Sale>={}):Sale {return {id:'s'+number,number,sessionId:'cash',at:'2026-10-06T12:00:00.000Z',items:[{productId:'p0',name:'Bocha',category:'Granel',gridoName:'Cucurucho Grido',categoryGridoName:'Helados',quantity:2,unitPrice:350000,subtotal:700000}],total:700000,payment:'CASH',received:700000,change:0,...extra};}
function fixture(count=3):Data {const d=emptyData();d.sessions.push({id:'cash',openedAt:'2026-10-05T12:00:00.000Z',opening:100000,movements:[]});for(let n=1;n<=count;n++)d.sales.push(sale(n));return d;}
async function legacy(dbName:string,data:unknown){const r=indexedDB.open(dbName,1);r.onupgradeneeded=()=>r.result.createObjectStore('state');const db=await req(r);const tx=db.transaction('state','readwrite');tx.objectStore('state').put(data,'data');await done(tx);db.close();}

test('migra V1 atómicamente con categorías, Grido, conteos, anulaciones y cierres',async()=>{
 const dbName=name(),d=fixture();beginWeek(d,'w1','2026-10-05','2026-10-07T12:00:00Z');
 cancelSale(d,'s2','Error previo','2026-10-07T13:00:00Z');d.sessions[0].closing=closeSession(d,d.sessions[0],1500000,undefined,'2026-10-07T14:00:00Z');finishWeek(d,'w1','w2','2026-10-07T15:00:00Z');cancelSale(d,'s1','Reintegro posterior','2026-10-07T16:00:00Z');
 await legacy(dbName,d);const db=await PosDatabase.open(dbName);assert.deepEqual(await db.exportData(),d);
 const view=await db.view();assert.equal(view.meta.salesCount,1);assert.equal(view.meta.cancelledCount,2);assert.equal(view.meta.total,700000);assert.equal(view.meta.nextSaleNumber,4);assert.deepEqual(view.data.sales.map(s=>s.id),['s1','s2']);
 assert.equal(weekReport(view.data,view.data.weeks[0]).total,700000);assert.equal(netSessionClosing(view.data,view.data.sessions[0]).total,700000);
 const raw=await req(indexedDB.open(dbName,4));assert.equal(raw.objectStoreNames.contains('state'),false);assert.deepEqual([...raw.objectStoreNames],['categories','meta','priceAudit','productFamilies','products','sales','sessions','weeks']);assert.deepEqual([...raw.transaction('sales').objectStore('sales').indexNames],['byAt','byCancellationAt','byNumber','bySession','byWeek']);raw.close();db.close();
});
test('respaldo V1 sin categorías ni semanas se normaliza una sola vez',async()=>{
 const dbName=name(),d=fixture();delete (d as any).categories;delete d.categoryDetails;delete (d as any).weeks;delete d.sales[0].items[0].category;
 await legacy(dbName,d);const db=await PosDatabase.open(dbName);assert.deepEqual(await db.exportData(),validateData(d));db.close();const reopened=await PosDatabase.open(dbName);assert.deepEqual(await reopened.exportData(),validateData(d));reopened.close();
});
test('migración fallida conserva el documento original y la versión 1',async()=>{
 const dbName=name(),d=fixture();d.sales[0].total=12;await legacy(dbName,d);await assert.rejects(PosDatabase.open(dbName),/Total inválido/);
 const db=await req(indexedDB.open(dbName,1));assert.deepEqual([...db.objectStoreNames],['state']);assert.deepEqual(await req(db.transaction('state').objectStore('state').get('data')),d);db.close();
});
test('paginación recorre 25 registros por página en orden de ticket; incluye anuladas',async()=>{
 const db=await PosDatabase.open(name()),d=fixture(63);cancelSale(d,'s62','Prueba','2026-10-07T12:00:00Z');await db.restore(d);
 assert.deepEqual((await db.history(1)).map(s=>s.number),Array.from({length:25},(_,n)=>63-n));assert.ok((await db.history(1))[1].cancellation);
 assert.deepEqual((await db.history(2)).map(s=>s.number),Array.from({length:25},(_,n)=>38-n));assert.equal((await db.history(3)).length,13);assert.equal((await db.history(4)).length,0);await assert.rejects(db.history(0),/Página inválida/);db.close();
});
test('10.000 ventas históricas: vista no carga vigentes cerradas y cobrar solo escribe venta y meta',async()=>{
 const db=await PosDatabase.open(name()),d=fixture(10000);d.sessions[0].closing=closeSession(d,d.sessions[0],7000100000,undefined,'2026-10-07T12:00:00Z');d.sessions.push({id:'new',openedAt:'2026-10-08T12:00:00Z',opening:0,movements:[]});await db.restore(d);
 assert.equal((await db.view()).data.sales.length,0);
 const reads:string[]=[],writes:string[]=[];const originalGetAll=IDBObjectStore.prototype.getAll,originalPut=IDBObjectStore.prototype.put,originalAdd=IDBObjectStore.prototype.add;
 IDBObjectStore.prototype.getAll=function(...args:any[]){reads.push(this.name);return originalGetAll.apply(this,args as any);};
 IDBObjectStore.prototype.put=function(...args:any[]){writes.push(this.name);return originalPut.apply(this,args as any);};
 IDBObjectStore.prototype.add=function(...args:any[]){writes.push(this.name);return originalAdd.apply(this,args as any);};
 try{const view=await db.update((data,context)=>{assert.equal(data.sales.length,0);data.sales.push(sale(context.nextSaleNumber,{sessionId:'new',at:'2026-10-08T13:00:00Z'}));});assert.equal(view.meta.salesCount,10001);assert.equal(view.meta.total,7000700000);assert.ok(!reads.includes('sales'));assert.deepEqual(writes.sort(),['meta','sales']);}finally{IDBObjectStore.prototype.getAll=originalGetAll;IDBObjectStore.prototype.put=originalPut;IDBObjectStore.prototype.add=originalAdd;db.close();}
});
test('dos conexiones cobran en simultáneo sin repetir números ni perder cambios',async()=>{
 const dbName=name(),a=await PosDatabase.open(dbName),b=await PosDatabase.open(dbName);await a.restore(fixture(0));
 await Promise.all(Array.from({length:20},(_,n)=>(n%2?a:b).update((d,c)=>d.sales.push(sale(c.nextSaleNumber)))));
 const full=await a.exportData();assert.equal(full.sales.length,20);assert.deepEqual(full.sales.map(s=>s.number),Array.from({length:20},(_,i)=>i+1));assert.equal((await b.view()).meta.total,14000000);
 await Promise.all([a.update(d=>saveProduct(d,'p0',{name:'Nuevo',gridoName:'Código',category:'Granel',price:100})),b.update(d=>renameCategory(d,'c1','Envasados nuevos','CodEnv'))]);
 assert.equal((await a.exportData()).products[0].name,'Nuevo');assert.ok((await a.exportData()).categories.includes('Envasados nuevos'));a.close();b.close();
});
test('excepción en una operación revierte cambios y contadores',async()=>{
 const db=await PosDatabase.open(name());await db.restore(fixture());const before=await db.exportData(),meta=(await db.view()).meta;
 await assert.rejects(db.update(d=>{d.products[0].name='No guardar';d.sales.push(sale(4));throw Error('Falló');}),/Falló/);assert.deepEqual(await db.exportData(),before);assert.deepEqual((await db.view()).meta,meta);
 // A duplicate entity ID triggers an IndexedDB error after other writes were queued.
 await assert.rejects(db.update((d,c)=>{d.products[0].name='No guardar';d.sales.push(sale(c.nextSaleNumber,{id:'s1'}));}));assert.deepEqual(await db.exportData(),before);db.close();
});
test('inicio/cierre semanal y cierre de caja leen ventas del índice correspondiente',async()=>{
 const db=await PosDatabase.open(name());await db.restore(fixture(30));await db.update(d=>beginWeek(d,'w1','2026-10-05','2026-10-07T12:00:00Z'),{fromDate:'2026-10-05T03:00:00.000Z'});
 assert.equal((await db.view()).meta.unassignedCount,0);await db.update(d=>{d.sessions[0].closing=closeSession(d,d.sessions[0],2100010000,undefined,'2026-10-07T14:00:00Z');},{sessionId:'cash'});
 await db.update(d=>{finishWeek(d,'w1','w2','2026-10-07T15:00:00Z');},{weekId:'w1'});
 assert.equal((await db.view()).data.sales.length,0);await db.update(d=>cancelSale(d,'s1','Posterior','2026-10-07T16:00:00Z'),{saleId:'s1'});
 const full=await db.exportData(),view=await db.view();assert.deepEqual(validateData(full),full);assert.deepEqual(weekReport(view.data,view.data.weeks[0]),summarizeSales(full.sales));assert.equal(netSessionClosing(view.data,view.data.sessions[0]).total,20300000);assert.ok(weeklyCsv(view.data.weeks[0],view.data).includes('Posterior'));db.close();
});
test('exporta todas las páginas y restaura íntegro; rechaza respaldo inválido y caja abierta',async()=>{
 const db=await PosDatabase.open(name()),d=fixture(56);d.sessions[0].closing=closeSession(d,d.sessions[0],0,undefined,'2026-10-07T14:00:00Z');await db.restore(d);const original=await db.exportData();assert.deepEqual({...original,priceAudit:undefined},{...d,priceAudit:undefined});
 const bad=structuredClone(d);bad.sales[0].total=1;await assert.rejects(db.restore(bad));assert.deepEqual(await db.exportData(),original);
 await db.restore(fixture(0));await assert.rejects(db.restore(d),/Cerrá caja/);assert.equal((await db.exportData()).sales.length,0);db.close();
});
test('totales de cierre con caché parcial concilian anulaciones antes y después, varios medios/categorías',()=>{
 const d=fixture(6);d.sales[1].payment='MP';d.sales[2].payment='CARD';d.sales[3].items.push({productId:'p5',name:'Bombón',category:'Envasados',quantity:1,unitPrice:100,subtotal:100});d.sales[3].total+=100;d.sales[3].received+=100;
 beginWeek(d,'w1','2026-10-05','2026-10-07T12:00:00Z');cancelSale(d,'s5','Antes','2026-10-07T13:00:00Z');d.sessions[0].closing=closeSession(d,d.sessions[0],0,undefined,'2026-10-07T14:00:00Z');finishWeek(d,'w1','w2','2026-10-07T15:00:00Z');
 for(const id of ['s1','s2','s4'])cancelSale(d,id,'Después','2026-10-07T16:00:00Z');
 const partial={...d,sales:d.sales.filter(s=>s.cancellation)};assert.deepEqual(weekReport(partial,d.weeks[0]),summarizeSales(d.sales));const expected=closeSession(d,{...d.sessions[0],closing:undefined},0);
 const actual=netSessionClosing(partial,d.sessions[0]);for(const key of ['total','salesCount','expected','difference','payments','products'] as const)assert.deepEqual(actual[key],expected[key]);assert.deepEqual(validateData(d),d);
});

test('cierra conexiones antiguas cuando otra pestaña solicita una versión nueva',async()=>{
 const dbName=name();let notified=false;const db=await PosDatabase.open(dbName,undefined,()=>{notified=true;});
 const r=indexedDB.open(dbName,5);const newer=await req(r);assert.ok(notified);newer.close();db.close();
});
