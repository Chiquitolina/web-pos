import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyData, Data, Sale } from '../src/app/core/models';
import { beginWeek, finishWeek, activeWeek, weekReport, summarizeSales, localDate, startOfDate, mondayDate, migrateWeeks } from '../src/app/core/weeks';
import { weeklyCsv } from '../src/app/core/weekly-csv';
import { validateData } from '../src/app/core/domain';
function fixture():Data {
 const d=emptyData();d.sessions.push({id:'cash',openedAt:'2026-10-05T12:00:00Z',opening:0,movements:[]});
 d.sales=[{id:'s1',number:1,sessionId:'cash',at:'2026-10-06T02:00:00Z',payment:'CASH',received:2000000,change:450000,total:1550000,items:[{productId:'p0',name:'Bocha',category:'Granel',quantity:2,unitPrice:350000,subtotal:700000},{productId:'p5',name:'Bombón',category:'Envasados',quantity:1,unitPrice:850000,subtotal:850000}]},{id:'s2',number:2,sessionId:'cash',at:'2026-10-06T13:00:00Z',payment:'MP',received:400000,change:0,total:400000,items:[{productId:'p0',name:'Bocha',category:'Granel',quantity:1,unitPrice:400000,subtotal:400000}]}];return d;
}
test('acumulado concilia cantidades, facturación, categorías, pagos y días argentinos',()=>{
 const d=fixture();const w=beginWeek(d,'w1','2026-10-05','2026-10-07T15:00:00Z');const r=weekReport(d,w);
 assert.equal(r.salesCount,2);assert.equal(r.quantity,4);assert.equal(r.total,1950000);assert.deepEqual(r.payments,{CASH:1550000,MP:400000,CARD:0});
 assert.equal(r.products.find(p=>p.id==='p0')!.quantity,3);assert.equal(r.products.find(p=>p.id==='p0')!.total,1100000);
 assert.equal(r.products.reduce((n,p)=>n+p.total,0),r.total);assert.equal(r.categories.reduce((n,c)=>n+c.total,0),r.total);assert.equal(r.categories.find(c=>c.name==='Granel')!.salesCount,2);
 assert.deepEqual(r.days.map(d=>d.date),['2026-10-05','2026-10-06']);assert.equal(r.days.reduce((n,d)=>n+d.total,0),r.total);
});
test('cierre congela resumen, abre siguiente período y evita doble cierre y doble conteo',()=>{
 const d=fixture();beginWeek(d,'w1','2026-10-05','2026-10-07T15:00:00Z');const closed=finishWeek(d,'w1','w2','2026-10-07T16:00:00Z');const snapshot=structuredClone(closed.closing!.report);
 assert.equal(activeWeek(d)!.id,'w2');assert.equal(weekReport(d,activeWeek(d)!).total,0);assert.throws(()=>finishWeek(d,'w1','w3'));
 const sale=structuredClone(d.sales[1]);sale.id='s3';sale.number=3;sale.at='2026-10-07T16:00:00Z';sale.weekId='w2';d.sales.push(sale);
 d.products[0].price=999999;d.products[0].category='Envasados';assert.deepEqual(weekReport(d,closed),snapshot);assert.equal(weekReport(d,activeWeek(d)!).total,400000);
 assert.doesNotThrow(()=>validateData(d));
});
test('inicio respeta fecha elegida y no altera ventas anteriores ni los cierres diarios',()=>{
 const d=fixture();beginWeek(d,'w1','2026-10-06','2026-10-07T15:00:00Z');assert.equal(d.sales[0].weekId,undefined);assert.equal(d.sales[1].weekId,'w1');assert.equal(d.sessions[0].closing,undefined);
 assert.throws(()=>beginWeek(d,'w2','2026-10-06'));assert.throws(()=>beginWeek(emptyData(),'w','2026-10-09','2026-10-07T15:00:00Z'));
 assert.equal(mondayDate(new Date('2026-10-12T01:00:00Z')),'2026-10-05');assert.equal(localDate('2026-10-06T02:59:59Z'),'2026-10-05');assert.equal(startOfDate('2026-10-05'),'2026-10-05T03:00:00.000Z');assert.throws(()=>startOfDate('2026-02-30'));
});
test('backups preservan cierres y rechazan reportes semanales manipulados',()=>{
 const d=fixture();beginWeek(d,'w1','2026-10-05','2026-10-07T15:00:00Z');finishWeek(d,'w1','w2','2026-10-07T16:00:00Z');
 assert.deepEqual(validateData(JSON.parse(JSON.stringify(d))),d);d.weeks[0].closing!.report.total++;assert.throws(()=>validateData(d));
 const legacy:any=fixture();delete legacy.weeks;for(const s of legacy.sales)for(const i of s.items)delete i.category;
 const restored=validateData(legacy);assert.deepEqual(restored.weeks,[]);assert.equal(restored.sales[0].items[0].category,'Granel');
 const wrong:any=fixture();wrong.weeks={};assert.throws(()=>validateData(wrong));
});
test('CSV definitivo tiene todas las secciones, UTF8, escaping e importes en pesos',()=>{
 const d=fixture();d.sales[0].items[0].name='=SUM(A1); "Helado"';beginWeek(d,'w1','2026-10-05','2026-10-07T15:00:00Z');const closed=finishWeek(d,'w1','w2','2026-10-07T16:00:00Z');const csv=weeklyCsv(closed);
 assert.ok(csv.startsWith('\uFEFF'));for(const type of ['GENERAL','PAGO','PRODUCTO','CATEGORIA','DIA'])assert.ok(csv.includes('"'+type+'"'));
 assert.ok(csv.includes('"19500,00"'));assert.ok(csv.includes('"\'=SUM(A1); ""Helado"""'));assert.ok(csv.includes('"2026-10-05"'));assert.throws(()=>weeklyCsv(activeWeek(d)!));
});
test('semana sin ventas y categorización histórica no cambian con el catálogo',()=>{
 const d=emptyData();beginWeek(d,'w1','2026-10-05','2026-10-07T15:00:00Z');const closed=finishWeek(d,'w1','w2','2026-10-07T16:00:00Z');assert.equal(closed.closing!.report.total,0);assert.ok(weeklyCsv(closed));assert.doesNotThrow(()=>validateData(d));
 const old:any=fixture();delete old.sales[0].items[0].category;const migrated=migrateWeeks(old);migrated.products[0].category='Otra';assert.equal(migrated.sales[0].items[0].category,'Granel');
});
test('un ticket con varios productos de la misma categoría cuenta una vez en esa categoría',()=>{
 const sale=structuredClone(fixture().sales[0]);sale.items.push({...sale.items[0],productId:'other'});sale.total+=700000;const report=summarizeSales([sale]);assert.equal(report.categories.find(c=>c.name==='Granel')!.salesCount,1);assert.equal(report.quantity,5);assert.equal(report.total,2250000);
});
