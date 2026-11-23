import 'fake-indexeddb/auto';
import { IDBObjectStore } from 'fake-indexeddb';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PosDatabase } from '../src/app/core/indexed-db';
import { MetricsFilter } from '../src/app/core/metrics';
import { Data, Sale, emptyData } from '../src/app/core/models';
import { closeSession } from '../src/app/core/domain';
import { cancelSale } from '../src/app/core/cancellations';
const TZ='America/Argentina/Buenos_Aires',NOW='2026-11-15T22:00:00Z';
const filter=(extra:Partial<MetricsFilter>={}):MetricsFilter=>({from:'',to:'',category:'',presentation:'all',search:'',weekday:null,hourFrom:0,hourTo:24,...extra});
function fixture(count=3):Data {const d=emptyData();d.sessions=[{id:'old',openedAt:'2026-10-05T12:00:00Z',opening:0,movements:[]}];for(let n=1;n<=count;n++){const item={productId:'p0',name:'Bocha',category:'Granel',quantity:2,unitPrice:350000,subtotal:700000};const s:Sale={id:'s'+n,number:n,sessionId:'old',at:'2026-10-06T12:00:00Z',items:[item],total:700000,payment:'CASH',received:700000,change:0};d.sales.push(s);}d.sessions[0].closing=closeSession(d,d.sessions[0],count*700000,undefined,'2026-10-07T12:00:00Z');d.sessions.push({id:'new',openedAt:'2026-11-15T12:00:00Z',opening:0,movements:[]});return d;}
const name=()=>`metrics-${crypto.randomUUID()}`;

test('métricas lee 5.000 ventas cerradas fuera del caché y no usa getAll de ventas ni escribe registros',async()=>{
 const db=await PosDatabase.open(name());await db.restore(fixture(5000));assert.equal((await db.view()).data.sales.length,0);const before=await db.exportData(),meta=(await db.view()).meta;
 const reads:string[]=[],writes:string[]=[],proto=IDBObjectStore.prototype,originalGetAll=proto.getAll,originalPut=proto.put,originalAdd=proto.add,originalDelete=proto.delete,originalClear=proto.clear;
 proto.getAll=function(...args:any[]){reads.push(this.name);return originalGetAll.apply(this,args as any);};proto.put=function(...args:any[]){writes.push(this.name);return originalPut.apply(this,args as any);};proto.add=function(...args:any[]){writes.push(this.name);return originalAdd.apply(this,args as any);};proto.delete=function(...args:any[]){writes.push(this.name);return originalDelete.apply(this,args as any);};proto.clear=function(){writes.push(this.name);return originalClear.call(this);};
 try{const result=await db.queryMetrics(filter(),TZ,NOW);assert.equal(result.report.quantity,10000);assert.equal(result.report.uniqueProducts,1);assert.equal(result.revision,meta.revision);assert.equal(reads.includes('sales'),false);assert.deepEqual(writes,[]);}finally{proto.getAll=originalGetAll;proto.put=originalPut;proto.add=originalAdd;proto.delete=originalDelete;proto.clear=originalClear;}
 assert.deepEqual(await db.exportData(),before);assert.deepEqual((await db.view()).meta,meta);db.close();
});
test('anulación posterior desde otra conexión se descuenta sin cambiar el cierre original',async()=>{
 const dbName=name(),a=await PosDatabase.open(dbName),b=await PosDatabase.open(dbName);await a.restore(fixture());const original=(await a.exportData()).sessions[0].closing;
 assert.equal((await a.queryMetrics(filter(),TZ,NOW)).report.quantity,6);await b.update(d=>cancelSale(d,'s1','Error','2026-11-15T15:00:00Z'),{saleId:'s1'});const r=await a.queryMetrics(filter(),TZ,NOW);assert.equal(r.report.quantity,4);assert.deepEqual((await b.exportData()).sessions[0].closing,original);a.close();b.close();
});
test('abortar una consulta no guarda parciales y permite volver a consultar',async()=>{
 const db=await PosDatabase.open(name());await db.restore(fixture(200));const before=(await db.view()).meta;
 const early=new AbortController();early.abort();await assert.rejects(db.queryMetrics(filter(),TZ,NOW,early.signal),{name:'AbortError'});
 const running=new AbortController(),promise=db.queryMetrics(filter(),TZ,NOW,running.signal);setTimeout(()=>running.abort(),0);await assert.rejects(promise,{name:'AbortError'});
 assert.equal((await db.queryMetrics(filter(),TZ,NOW)).report.quantity,400);assert.deepEqual((await db.view()).meta,before);db.close();
});
test('consultas simultáneas de categorías/períodos conservan resultados independientes y las fechas inválidas no escriben',async()=>{
 const db=await PosDatabase.open(name());await db.restore(fixture());const before=await db.exportData();const [all,other,range]=await Promise.all([db.queryMetrics(filter(),TZ,NOW),db.queryMetrics(filter({category:'Envasados'}),TZ,NOW),db.queryMetrics(filter({from:'2026-11-01',to:'2026-11-15'}),TZ,NOW)]);
 assert.equal(all.report.quantity,6);assert.equal(other.report.quantity,0);assert.equal(range.report.quantity,0);await assert.rejects(db.queryMetrics(filter({from:'2026-02-30',to:'2026-03-01'}),TZ,NOW));assert.deepEqual(await db.exportData(),before);db.close();
});
