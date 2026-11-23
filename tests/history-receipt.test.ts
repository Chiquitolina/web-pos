import 'fake-indexeddb/auto';
import { IDBObjectStore, IDBIndex } from 'fake-indexeddb';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyData, Sale } from '../src/app/core/models';
import { PosDatabase } from '../src/app/core/indexed-db';
import { closeSession, validateData } from '../src/app/core/domain';
import { summarizeSales } from '../src/app/core/weeks';
import { receiptView, receiptDate, validVatRate } from '../src/app/core/receipt';
import { saveProduct } from '../src/app/core/catalog';
import { dayBounds } from '../src/app/core/history';
function fixture(){
 const d=emptyData();d.sessions=[{id:'old',openedAt:'2026-10-08T15:00:00.000Z',opening:0,movements:[]},{id:'live',openedAt:'2026-10-09T15:00:00.000Z',opening:0,movements:[]}];
 const sale=(number:number,sessionId:string,at:string,cancelled=false):Sale=>({id:'sale'+number,number,sessionId,at,items:[{productId:'p0',name:'Bombón <Escocés>',category:'Granel',quantity:2,unitPrice:100000,subtotal:200000,vatRate:21}],total:200000,payment:'CASH',received:200000,change:0,...(cancelled?{cancellation:{at:'2026-10-10T04:00:00.000Z',reason:'Error'}}:{})});
 d.sales=[sale(1,'old','2026-10-09T02:59:59.999Z'),sale(2,'old','2026-10-09T03:00:00.000Z'),sale(3,'live','2026-10-09T22:00:00.000Z',true),sale(4,'live','2026-10-10T02:59:59.999Z'),sale(5,'live','2026-10-10T03:00:00.000Z')];
 d.sessions[0].closing=closeSession(d,d.sessions[0],0,undefined,'2026-10-09T12:00:00.000Z');return d;
}
test('historial por día usa medianoche argentina, ambos turnos y totales sin anuladas',async()=>{
 const db=await PosDatabase.open(crypto.randomUUID());await db.restore(fixture());assert.deepEqual(dayBounds('2026-10-09'),['2026-10-09T03:00:00.000Z','2026-10-10T03:00:00.000Z']);
 const result=await db.queryHistory({kind:'day',date:'2026-10-09'},1);assert.deepEqual(result.rows.map(s=>s.number),[4,3,2]);assert.deepEqual(result.totals,{salesCount:2,cancelledCount:1,total:400000});assert.equal(result.totalRows,3);
 assert.deepEqual((await db.queryHistory({kind:'day',date:'2026-10-10'},1)).rows.map(s=>s.number),[5]);await assert.rejects(db.queryHistory({kind:'day',date:'2026-02-30'},1),/Fecha inválida/);db.close();
});
test('turno actual y seleccionado no mezclan ventas; consulta de día usa índice',async()=>{
 const db=await PosDatabase.open(crypto.randomUUID());await db.restore(fixture());
 assert.deepEqual((await db.queryHistory({kind:'current'},1)).rows.map(s=>s.number),[5,4,3]);assert.deepEqual((await db.queryHistory({kind:'session',sessionId:'old'},1)).rows.map(s=>s.number),[2,1]);
 const reads:string[]=[],indexes:string[]=[];const get=IDBObjectStore.prototype.getAll,idx=IDBIndex.prototype.getAll;
 IDBObjectStore.prototype.getAll=function(...a:any[]){reads.push(this.name);return get.apply(this,a as any);};IDBIndex.prototype.getAll=function(...a:any[]){indexes.push(this.name);return idx.apply(this,a as any);};
 try{await db.queryHistory({kind:'day',date:'2026-10-09'},1);assert.ok(!reads.includes('sales'));assert.deepEqual(indexes,['byAt']);}finally{IDBObjectStore.prototype.getAll=get;IDBIndex.prototype.getAll=idx;}db.close();
});
test('sin turno abierto no muestra el anterior; cambia a nueva caja y mantiene historial general',async()=>{
 const db=await PosDatabase.open(crypto.randomUUID()),d=fixture();d.sessions[1].closing=closeSession(d,d.sessions[1],0,undefined,'2026-10-10T05:00:00.000Z');await db.restore(d);
 assert.equal((await db.queryHistory({kind:'current'},1)).totalRows,0);await db.update(d=>d.sessions.push({id:'new',openedAt:'2026-10-10T06:00:00.000Z',opening:0,movements:[]}));assert.equal((await db.queryHistory({kind:'current'},1)).totalRows,0);assert.equal((await db.queryHistory({kind:'all'},1)).totalRows,5);db.close();
});
test('páginas y totales corresponden a todas las ventas del turno elegido',async()=>{
 const db=await PosDatabase.open(crypto.randomUUID()),d=fixture();for(let n=6;n<=65;n++)d.sales.push({...structuredClone(d.sales[4]),id:'sale'+n,number:n});await db.restore(d);
 const page1=await db.queryHistory({kind:'session',sessionId:'live'},1),page3=await db.queryHistory({kind:'session',sessionId:'live'},3);
 assert.equal(page1.rows.length,25);assert.equal(page1.rows[0].number,65);assert.equal(page1.totalRows,63);assert.equal(page1.pages,3);assert.equal(page3.rows.length,13);assert.deepEqual(page1.totals,page3.totals);assert.equal(page1.totals.total,62*200000);assert.equal((await db.queryHistory({kind:'session',sessionId:'live'},99)).page,3);db.close();
});
test('ticket usa pedido, fecha, IDs, nombres y precios históricos de cada venta',()=>{
 const s=fixture().sales[0],before=structuredClone(s),r=receiptView(s,'GRIDO OROÑO','America/Argentina/Buenos_Aires');
 assert.equal(r.orderNumber,1);assert.equal(r.id,s.id);assert.equal(r.sessionId,'old');assert.equal(r.date,'08/10/2026 23:59:59');assert.equal(r.payment,'EFECTIVO');assert.equal(r.items[0].name,'Bombón <Escocés>');assert.equal(r.items[0].quantity,'2,00');assert.equal(r.items[0].vat,'21,00');assert.equal(r.items[0].price,'1000,00');assert.equal(r.items[0].amount,'2000,00');assert.equal(r.total,'2000,00');assert.deepEqual(s,before);
 const other={...s,id:'otro-id',number:800,payment:'MP' as const,at:'2026-10-10T03:00:00.000Z'};const second=receiptView(other,'Otra sucursal','America/Argentina/Buenos_Aires');assert.equal(second.orderNumber,800);assert.equal(second.storeName,'Otra sucursal');assert.equal(second.payment,'MERCADO PAGO');assert.equal(second.date,'10/10/2026 00:00:00');
});
test('IVA opcional no se inventa ni modifica precio; se conserva en backup y snapshot',()=>{
 const d=fixture();delete d.sales[0].items[0].vatRate;assert.equal(receiptView(d.sales[0],'Local','UTC').items[0].vat,'—');
 saveProduct(d,'p0',{name:'Nuevo',gridoName:'Código',category:'Granel',price:12345,vatRate:10.5});assert.equal(d.products[0].price,12345);assert.equal(d.products[0].vatRate,10.5);assert.equal(d.sales[1].items[0].vatRate,21);assert.deepEqual(validateData(d),d);
 saveProduct(d,'p0',{name:'Nuevo',gridoName:'Código',category:'Granel',price:12345,vatRate:null});assert.equal(d.products[0].vatRate,undefined);
 for(const rate of [-1,101,NaN,Infinity,2.001]){assert.equal(validVatRate(rate),false);assert.throws(()=>saveProduct(d,'p0',{name:'N',gridoName:'G',category:'Granel',price:1,vatRate:rate}));}
 d.sales[1].items[0].vatRate=-21;assert.throws(()=>validateData(d),/Detalle inválido/);assert.equal(receiptDate('2026-10-10T03:00:00.000Z','America/Argentina/Buenos_Aires'),'10/10/2026 00:00:00');
});
test('resumen del turno abierto concilia productos, medios de pago y anulaciones sin cierre',()=>{
 const d=fixture();assert.equal(d.sessions[1].closing,undefined);const report=summarizeSales(d.sales.filter(s=>s.sessionId==='live'));assert.equal(report.salesCount,2);assert.equal(report.total,400000);assert.equal(report.quantity,4);assert.equal(report.payments.CASH,400000);assert.equal(report.products[0].quantity,4);assert.equal(d.sessions[1].closing,undefined);
});
