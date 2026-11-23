import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyData, Data } from '../src/app/core/models';
import { cancelSale, effectiveSale } from '../src/app/core/cancellations';
import { closeSession, validateData } from '../src/app/core/domain';
import { beginWeek, finishWeek, weekReport, activeWeek } from '../src/app/core/weeks';
import { weeklyCsv } from '../src/app/core/weekly-csv';
function fixture():Data {
 const d=emptyData();d.sessions.push({id:'cash',openedAt:'2026-10-05T12:00:00Z',opening:100000,movements:[]});
 for(const [n,payment] of (['CASH','MP','CARD'] as const).entries())d.sales.push({id:'s'+n,number:n+1,sessionId:'cash',at:'2026-10-06T12:00:00Z',payment,received:700000,change:0,total:700000,items:[{productId:'p0',name:'Bocha',category:'Granel',quantity:2,unitPrice:350000,subtotal:700000}]});
 beginWeek(d,'w1','2026-10-05','2026-10-07T12:00:00Z');return d;
}
test('anular efectivo descuenta caja y semana pero conserva ticket, detalle y motivo',()=>{
 const d=fixture(),original=structuredClone(d.sales[0]);assert.equal(closeSession(d,d.sessions[0],0).expected,800000);
 cancelSale(d,'s0',' Error de carga ','2026-10-07T13:00:00Z');assert.equal(d.sales.length,3);assert.equal(d.sales[0].number,original.number);assert.deepEqual(d.sales[0].items,original.items);assert.equal(d.sales[0].total,original.total);assert.equal(d.sales[0].cancellation!.reason,'Error de carga');assert.equal(effectiveSale(d.sales[0]),false);
 const cash=closeSession(d,d.sessions[0],100000);assert.equal(cash.expected,100000);assert.equal(cash.payments.CASH,0);assert.equal(cash.total,1400000);assert.equal(cash.salesCount,2);assert.equal(cash.products[0].quantity,4);
 const r=weekReport(d,d.weeks[0]);assert.equal(r.quantity,4);assert.equal(r.categories[0].quantity,4);assert.equal(r.total,1400000);assert.equal(r.days[0].salesCount,2);assert.doesNotThrow(()=>validateData(d));
});
test('anular MP o tarjeta descuenta su medio de pago sin afectar efectivo esperado',()=>{
 for(const id of ['s1','s2']){const d=fixture();const payment=d.sales.find(s=>s.id===id)!.payment;cancelSale(d,id,'Reversión','2026-10-07T13:00:00Z');const cash=closeSession(d,d.sessions[0],0);assert.equal(cash.expected,800000);assert.equal(cash.payments[payment],0);assert.equal(weekReport(d,d.weeks[0]).total,1400000);}
});
test('doble anulación, motivo vacío e ID desconocido no modifican datos',()=>{
 const d=fixture();const original=structuredClone(d);assert.throws(()=>cancelSale(d,'s0',' '));assert.throws(()=>cancelSale(d,'missing','Error'));assert.deepEqual(d,original);
 cancelSale(d,'s0','Error','2026-10-07T13:00:00Z');const once=structuredClone(d);assert.throws(()=>cancelSale(d,'s0','Otra vez'));assert.deepEqual(d,once);
});
test('anulación anterior al cierre guarda snapshot neto y backup conciliado',()=>{
 const d=fixture();cancelSale(d,'s0','Antes del cierre','2026-10-07T13:00:00Z');d.sessions[0].closing=closeSession(d,d.sessions[0],100000);const closed=finishWeek(d,'w1','w2','2026-10-07T14:00:00Z');
 assert.equal(d.sessions[0].closing.total,1400000);assert.equal(closed.closing!.report.total,1400000);assert.deepEqual(validateData(JSON.parse(JSON.stringify(d))),d);
});
test('anulación posterior conserva snapshots y conteo; neto y CSV se ajustan',()=>{
 const d=fixture();d.sessions[0].closing=closeSession(d,d.sessions[0],800000,undefined,'2026-10-07T14:00:00Z');const closed=finishWeek(d,'w1','w2','2026-10-07T15:00:00Z');const cashSnapshot=structuredClone(d.sessions[0].closing),weekSnapshot=structuredClone(closed.closing);
 cancelSale(d,'s0','Reintegro tardío','2026-10-07T16:00:00Z');assert.deepEqual(d.sessions[0].closing,cashSnapshot);assert.deepEqual(closed.closing,weekSnapshot);assert.equal(weekReport(d,closed).total,1400000);assert.equal(weekReport(d,activeWeek(d)!).total,0);
 const csv=weeklyCsv(closed,d);assert.ok(csv.includes('"ANULACION"'));assert.ok(csv.includes('"CIERRE_ORIGINAL"'));assert.ok(csv.includes('"Reintegro tardío"'));assert.ok(csv.includes('"14000,00"'));assert.ok(csv.includes('"21000,00"'));assert.deepEqual(validateData(JSON.parse(JSON.stringify(d))),d);
});
test('acciones en el mismo instante mantienen orden e importación consistente',()=>{
 const d=fixture();const at='2026-10-07T15:00:00.000Z';d.sessions[0].closing=closeSession(d,d.sessions[0],800000,undefined,at);finishWeek(d,'w1','w2',at);cancelSale(d,'s0','Mismo instante',at);
 assert.ok(Date.parse(d.sales[0].cancellation!.at)>Date.parse(at));assert.equal(effectiveSale(d.sales[0],at),true);assert.doesNotThrow(()=>validateData(d));
});
test('backups con anulaciones inválidas o cierre adulterado se rechazan',()=>{
 const d=fixture();cancelSale(d,'s0','Error','2026-10-07T13:00:00Z');d.sales[0].cancellation!.reason=' ';assert.throws(()=>validateData(d));d.sales[0].cancellation!.reason='Error';d.sales[0].cancellation!.at='2020-01-01';assert.throws(()=>validateData(d));
 const valid=fixture();valid.sessions[0].closing=closeSession(valid,valid.sessions[0],800000,undefined,'2026-10-07T14:00:00Z');cancelSale(valid,'s0','Error','2026-10-07T15:00:00Z');valid.sessions[0].closing.total=0;assert.throws(()=>validateData(valid));
});
