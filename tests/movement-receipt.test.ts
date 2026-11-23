import 'fake-indexeddb/auto';
import { IDBObjectStore } from 'fake-indexeddb';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyData, Movement, Session } from '../src/app/core/models';
import { closeSession, validateData } from '../src/app/core/domain';
import { recordCashMovement, movementReceiptView } from '../src/app/core/movement-receipt';
import { PosDatabase } from '../src/app/core/indexed-db';
const zone='America/Argentina/Buenos_Aires';
const movement=(type:Movement['type']='OUT'):Movement=>({id:'mov-1',at:'2026-11-14T02:15:35.000Z',type,amount:123456,reason:'  Retiro encargado  '});
const session=():Session=>({id:'turno-original',openedAt:'2026-11-13T12:00:00.000Z',opening:500000,movements:[]});
const fixture=()=>({...emptyData(),sessions:[session()]});

test('comprobante de retiro usa monto, motivo, turno, ID y fecha argentina originales sin alterar datos',()=>{
 const d=fixture(),input=movement(),saved=recordCashMovement(d,'turno-original',input),before=structuredClone(d),r=movementReceiptView(d.sessions[0],saved.id,'GRIDO',zone);
 assert.equal(r.title,'RETIRO DE EFECTIVO');assert.equal(r.amount,123456);assert.equal(r.date,'13/11/2026 23:15:35');assert.equal(r.reason,'Retiro encargado');assert.equal(r.sessionId,'turno-original');assert.equal(r.id,'mov-1');assert.equal(r.number,1);assert.equal(r.storeName,'GRIDO');assert.equal(r.signatureLabel,'Recibió');assert.equal(input.reason,'  Retiro encargado  ');assert.deepEqual(d,before);assert.doesNotThrow(()=>validateData(d));
});
test('ingreso tiene título y firma propios; cada comprobante identifica su posición dentro del turno',()=>{
 const d=fixture();recordCashMovement(d,'turno-original',movement());const next={...movement('IN'),id:'mov-2',reason:'Cambio para caja',amount:1,at:'2026-11-14T03:01:00Z'};recordCashMovement(d,'turno-original',next);
 const r=movementReceiptView(d.sessions[0],'mov-2','Sucursal de prueba',zone);assert.equal(r.title,'INGRESO DE EFECTIVO');assert.equal(r.signatureLabel,'Entregó');assert.equal(r.date,'14/11/2026 00:01:00');assert.equal(r.amount,1);assert.equal(r.number,2);assert.equal(r.reason,'Cambio para caja');assert.equal(r.storeName,'Sucursal de prueba');
});
test('reimpresión conserva los datos del movimiento aunque se agreguen otros y se cierre el turno',()=>{
 const d=fixture();recordCashMovement(d,'turno-original',movement());const first=movementReceiptView(d.sessions[0],'mov-1','GRIDO',zone);recordCashMovement(d,'turno-original',{...movement('IN'),id:'mov-2',amount:10000,reason:'Nuevo ingreso'});d.sessions[0].closing=closeSession(d,d.sessions[0],386544,undefined,'2026-11-14T04:00:00Z');const before=structuredClone(d);
 assert.deepEqual(movementReceiptView(d.sessions[0],'mov-1','GRIDO',zone),first);assert.deepEqual(d,before);assert.throws(()=>movementReceiptView(session(),'mov-1','GRIDO',zone),/no encontrado/);
});
test('no admite registros inválidos, duplicados, caja inexistente o ya cerrada',()=>{
 const d=fixture(),before=structuredClone(d);for(const patch of [{amount:0},{amount:-1},{amount:1.5},{amount:Infinity},{amount:Number.MAX_SAFE_INTEGER+1},{type:'CARD'},{id:''},{at:'fecha inválida'},{reason:'  '}]){assert.throws(()=>recordCashMovement(d,'turno-original',{...movement(),...patch} as Movement));assert.deepEqual(d,before);}
 assert.throws(()=>recordCashMovement(d,'otro-turno',movement()),/Abrí caja/);recordCashMovement(d,'turno-original',movement());assert.throws(()=>recordCashMovement(d,'turno-original',movement()),/ya fue registrado/);d.sessions[0].closing=closeSession(d,d.sessions[0],376544,undefined,'2026-11-14T04:00:00Z');assert.throws(()=>recordCashMovement(d,'turno-original',{...movement(),id:'nuevo'}),/Abrí caja/);assert.equal(d.sessions[0].movements.length,1);
});
test('movimiento persistido cambia efectivo esperado una sola vez y conserva ventas, auditoría y numeración',async()=>{
 const db=await PosDatabase.open(crypto.randomUUID());try{await db.restore(fixture());const before=await db.exportData(),meta=(await db.view()).meta;await db.update(d=>{recordCashMovement(d,'turno-original',movement());});const full=await db.exportData(),view=await db.view(),snapshot=structuredClone(full);
 assert.equal(closeSession(full,full.sessions[0],0).expected,376544);for(let n=0;n<3;n++)movementReceiptView(view.data.sessions[0],'mov-1','GRIDO',zone);assert.deepEqual(await db.exportData(),snapshot);assert.deepEqual(full.sales,before.sales);assert.deepEqual(full.priceAudit,before.priceAudit);assert.equal(view.meta.nextSaleNumber,meta.nextSaleNumber);assert.equal(view.meta.total,meta.total);assert.equal(view.meta.salesCount,meta.salesCount);assert.equal(full.sessions[0].movements.length,1);
 }finally{db.close();}
});
test('fallo de escritura revierte el movimiento; un comprobante nunca necesita un segundo registro',async()=>{
 const db=await PosDatabase.open(crypto.randomUUID());try{await db.restore(fixture());const before=await db.exportData(),put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args:any[]){if(this.name==='meta')throw Error('Error de escritura simulado');return put.apply(this,args as any);};try{await assert.rejects(db.update(d=>{recordCashMovement(d,'turno-original',movement());}),/simulado/);}finally{IDBObjectStore.prototype.put=put;}assert.deepEqual(await db.exportData(),before);
 await assert.rejects(db.update(d=>{recordCashMovement(d,'turno-original',movement());movementReceiptView(d.sessions[0],'mov-1','GRIDO','Zona/Invalida');}));assert.deepEqual(await db.exportData(),before);
 }finally{db.close();}
});
test('dos pestañas conservan ambos movimientos y el efectivo concilia sin contar operaciones como ventas',async()=>{
 const name=crypto.randomUUID(),a=await PosDatabase.open(name),b=await PosDatabase.open(name);try{await a.restore(fixture());await Promise.all([a.update(d=>{recordCashMovement(d,'turno-original',movement());}),b.update(d=>{recordCashMovement(d,'turno-original',{...movement('IN'),id:'mov-2',amount:50000,reason:'Cambio'});})]);const saved=await a.exportData();assert.equal(saved.sessions[0].movements.length,2);assert.equal(closeSession(saved,saved.sessions[0],0).expected,426544);assert.equal((await a.view()).meta.nextSaleNumber,1);assert.deepEqual(saved.sales,[]);
 }finally{a.close();b.close();}
});
test('respaldo y restauración conservan movimientos y sus comprobantes sin cambiar el formato de datos',async()=>{
 const a=await PosDatabase.open(crypto.randomUUID()),b=await PosDatabase.open(crypto.randomUUID());try{const d=fixture();recordCashMovement(d,'turno-original',movement('IN'));d.sessions[0].closing=closeSession(d,d.sessions[0],623456,undefined,'2026-11-14T04:00:00Z');await a.restore(d);const full=await a.exportData();await b.restore(full);const restored=await b.exportData();assert.equal(restored.version,1);assert.deepEqual(restored.sessions,full.sessions);assert.deepEqual(movementReceiptView(restored.sessions[0],'mov-1','GRIDO',zone),movementReceiptView(full.sessions[0],'mov-1','GRIDO',zone));assert.doesNotThrow(()=>validateData(restored));
 }finally{a.close();b.close();}
});
