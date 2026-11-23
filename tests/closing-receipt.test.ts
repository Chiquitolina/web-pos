import 'fake-indexeddb/auto';
import { IDBObjectStore, IDBIndex } from 'fake-indexeddb';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyData, Sale } from '../src/app/core/models';
import { closeSession } from '../src/app/core/domain';
import { cancelSale } from '../src/app/core/cancellations';
import { closingReceiptView } from '../src/app/core/closing-receipt';
import { PosDatabase } from '../src/app/core/indexed-db';
const zone='America/Argentina/Buenos_Aires';
function fixture(){
 const d=emptyData();d.sessions=[{id:'turno-auditado',openedAt:'2026-11-10T22:00:00Z',opening:200000,movements:[{id:'m1',at:'2026-11-10T23:00:00Z',type:'IN',amount:100000,reason:'Cambio para caja'},{id:'m2',at:'2026-11-11T00:00:00Z',type:'OUT',amount:150000,reason:'Retiro encargado'},{id:'m3',at:'2026-11-11T02:00:00Z',type:'OUT',amount:50000,reason:'Pago de insumos'}]}];
 const sale=(number:number,payment:Sale['payment'],id:string,name:string,quantity:number,unitPrice:number):Sale=>({id:'s'+number,number,sessionId:'turno-auditado',at:'2026-11-10T23:30:00Z',payment,received:quantity*unitPrice,change:0,total:quantity*unitPrice,items:[{productId:id,name,category:'Helados',quantity,unitPrice,subtotal:quantity*unitPrice}]});
 d.sales=[sale(10,'CASH','p0','Helado 2 bochas',2,250000),sale(11,'MP','p0','Helado 2 bochas',1,200000),sale(12,'CARD','p5','Postre',1,150000),sale(13,'CASH','p0','Helado anulado',1,125000),sale(14,'CARD','p5','Postre',1,175000)];
 cancelSale(d,'s13','Pedido duplicado','2026-11-11T03:00:00Z');d.sessions[0].closing=closeSession(d,d.sessions[0],590000,undefined,'2026-11-11T04:00:00Z');return d;
}
test('ticket de cierre concilia pedidos, pagos, productos y caja; fechas cruzan medianoche argentina',()=>{
 const d=fixture(),before=structuredClone(d),r=closingReceiptView(d.sessions[0],d.sales,'GRIDO',zone,'2026-11-11T04:01:00Z');
 assert.equal(r.storeName,'GRIDO');assert.equal(r.sessionId,'turno-auditado');assert.equal(r.openedAt,'10/11/2026 19:00:00');assert.equal(r.closedAt,'11/11/2026 01:00:00');assert.equal(r.printedAt,'11/11/2026 01:01:00');assert.equal(r.duration,'6 h 0 min');
 assert.equal(r.orders,5);assert.equal(r.firstOrder,10);assert.equal(r.lastOrder,14);assert.equal(r.validOrders,4);assert.equal(r.cancelledOrders,1);assert.equal(r.cancelledAmount,125000);assert.equal(r.grossTotal,1150000);assert.equal(r.total,1025000);assert.equal(r.average,256250);assert.equal(r.quantity,5);
 assert.deepEqual(r.payments.map(p=>[p.method,p.orders,p.total]),[['CASH',1,500000],['CARD',2,325000],['MP',1,200000]]);assert.equal(r.payments.reduce((n,p)=>n+p.total,0),r.total);
 assert.equal(r.products.find(p=>p.id==='p0')!.quantity,3);assert.equal(r.products.find(p=>p.id==='p0')!.total,700000);assert.equal(r.products.reduce((n,p)=>n+p.total,0),r.total);
 assert.equal(r.incoming,100000);assert.equal(r.outgoing,200000);assert.equal(r.expected,600000);assert.equal(r.counted,590000);assert.equal(r.difference,-10000);assert.equal(r.movements[1].reason,'Retiro encargado');assert.equal(r.cancelled[0].number,13);assert.equal(r.cancelled[0].reason,'Pedido duplicado');assert.deepEqual(d,before);
});
test('anulaciones posteriores se informan aparte y conservan ventas y efectivo originales',()=>{
 const d=fixture(),snapshot=structuredClone(d.sessions[0].closing);cancelSale(d,'s14','Devolución posterior','2026-11-11T05:00:00Z');const r=closingReceiptView(d.sessions[0],d.sales,'GRIDO',zone);
 assert.equal(r.validOrders,4);assert.equal(r.total,1025000);assert.equal(r.cancelledOrders,1);assert.equal(r.laterCancellations.length,1);assert.equal(r.laterCancellations[0].number,14);assert.equal(r.laterAmount,175000);assert.equal(r.currentTotal,850000);assert.equal(r.currentOrders,3);assert.equal(r.counted,590000);assert.equal(r.difference,-10000);assert.deepEqual(d.sessions[0].closing,snapshot);
});
test('turno sin ventas imprime ceros reales y no inventa números de pedidos',()=>{
 const d=emptyData();d.sessions=[{id:'empty',openedAt:'2026-11-10T12:00:00Z',opening:0,movements:[]}];d.sessions[0].closing=closeSession(d,d.sessions[0],0,undefined,'2026-11-10T12:01:00Z');const r=closingReceiptView(d.sessions[0],[], 'Otra sucursal',zone);
 assert.equal(r.orders,0);assert.equal(r.firstOrder,null);assert.equal(r.lastOrder,null);assert.equal(r.average,0);assert.equal(r.total,0);assert.deepEqual(r.products,[]);assert.deepEqual(r.cancelled,[]);assert.deepEqual(r.movements,[]);assert.equal(r.payments.reduce((n,p)=>n+p.orders,0),0);
});
test('ignora ventas de otros turnos y rechaza datos incompletos de la caché y cajas abiertas',()=>{
 const d=fixture(),foreign={...structuredClone(d.sales[0]),id:'foreign',sessionId:'another',number:900};const r=closingReceiptView(d.sessions[0],[...d.sales,foreign],'GRIDO',zone);assert.equal(r.orders,5);assert.equal(r.lastOrder,14);assert.throws(()=>closingReceiptView(d.sessions[0],d.sales.slice(1),'GRIDO',zone),/conciliar/);assert.throws(()=>closingReceiptView({...d.sessions[0],closing:undefined},d.sales,'GRIDO',zone),/no está cerrado/);
});
test('reimpresión lee turno completo por índice sin cargar todas las ventas ni modificar datos',async()=>{
 const d=fixture();cancelSale(d,'s14','Posterior','2026-11-11T05:00:00Z');const db=await PosDatabase.open(crypto.randomUUID());await db.restore(d);const before=await db.exportData(),meta=(await db.view()).meta;assert.equal((await db.view()).data.sales.length,2);
 const reads:string[]=[],indexes:string[]=[],original=IDBObjectStore.prototype.getAll,idx=IDBIndex.prototype.getAll;IDBObjectStore.prototype.getAll=function(...args:any[]){reads.push(this.name);return original.apply(this,args as any);};IDBIndex.prototype.getAll=function(...args:any[]){indexes.push(this.name);return idx.apply(this,args as any);};
 try{const detail=await db.sessionDetails('turno-auditado');assert.equal(detail.sales.length,5);assert.equal(closingReceiptView(detail.session,detail.sales,'GRIDO',zone).total,1025000);assert.ok(!reads.includes('sales'));assert.deepEqual(indexes,['bySession']);}finally{IDBObjectStore.prototype.getAll=original;IDBIndex.prototype.getAll=idx;}
 assert.deepEqual(await db.exportData(),before);assert.deepEqual((await db.view()).meta,meta);await assert.rejects(db.sessionDetails('missing'),/no encontrado/);db.close();
});
