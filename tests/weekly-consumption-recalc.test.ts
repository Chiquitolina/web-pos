import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyData, Item } from '../src/app/core/models';
import { beginWeek, finishWeek, weekReport } from '../src/app/core/weeks';
import { weeklyConsumptionReport } from '../src/app/core/weekly-consumption-report';
import { iceCreamConsumption } from '../src/app/core/ice-cream';
import { weeklyCategoryGroups } from '../src/app/core/weekly-category-groups';
import { cancelSale } from '../src/app/core/cancellations';
import { validateData } from '../src/app/core/domain';
import { weeklyCsv } from '../src/app/core/weekly-csv';
import { PosDatabase } from '../src/app/core/indexed-db';
function fixture(){const d=emptyData();d.products[2].iceCreamGrams=240;d.products[2].iceCreamScoops=3;
 const items:Item[]=[4,10,3].map((quantity,i)=>({productId:'p'+i,name:'Cucurucho '+(i+1)+' bochas',category:'Helado x Bocha',categoryGridoName:'BOCHA',quantity,unitPrice:100,subtotal:quantity*100}));
 d.sessions=[{id:'cash',openedAt:'2026-10-12T12:00:00Z',opening:0,movements:[]}];d.sales=[{id:'s1',number:1,sessionId:'cash',at:'2026-10-13T12:00:00Z',payment:'CASH',items,total:1700,received:1700,change:0}];
 beginWeek(d,'w1','2026-10-12','2026-10-13T13:00:00Z');return d;
}
test('recalcula ventas previas como la captura: 33 bochas, 2640 g, con gramajes actuales',()=>{
 const d=fixture(),before=structuredClone(d),r=weeklyConsumptionReport(d,d.weeks[0]);
 assert.deepEqual(iceCreamConsumption(r.products),{scoops:33,grams:2640,configured:true,unconfiguredUnits:0});assert.equal(weeklyCategoryGroups(r)[0].recalculatedUnits,17);
 assert.equal(r.total,1700);assert.equal(r.quantity,17);assert.equal(r.products[0].category,'Helado x Bocha');assert.deepEqual(d,before);
 d.products[0].iceCreamScoops=2;d.products[0].iceCreamGrams=160;assert.equal(iceCreamConsumption(weeklyConsumptionReport(d,d.weeks[0]).products).grams,2960);
});
test('combina filas recalculadas y registradas sin duplicar productos ni sobrescribir gramajes históricos',()=>{
 const d=fixture();d.sales[0].items.push({...d.sales[0].items[1],quantity:2,subtotal:200,iceCreamGrams:160,iceCreamScoops:2});d.sales[0].total+=200;d.sales[0].received+=200;
 const r=weeklyConsumptionReport(d,d.weeks[0]);assert.equal(r.products.length,3);const two=r.products.find(p=>p.id==='p1')!;assert.equal(two.quantity,12);assert.equal(two.recalculatedUnits,10);assert.equal(iceCreamConsumption(r.products).grams,2960);
 d.products[1].iceCreamScoops=3;d.products[1].iceCreamGrams=240;const changed=weeklyConsumptionReport(d,d.weeks[0]);assert.equal(changed.products.length,4);assert.equal(changed.products.find(p=>p.id==='p1'&&p.iceCreamGrams===160)!.quantity,2);assert.equal(iceCreamConsumption(changed.products).grams,3760);
});
test('solo usa ID del producto, conserva gramaje cero y mantiene faltantes cuando no hay configuración',()=>{
 const d=fixture();delete d.products[0].iceCreamGrams;delete d.products[0].iceCreamScoops;d.products[1].iceCreamGrams=0;delete d.products[1].iceCreamScoops;d.products[2].id='replacement';
 const r=weeklyConsumptionReport(d,d.weeks[0]);assert.deepEqual(iceCreamConsumption(r.products),{grams:0,scoops:0,configured:true,unconfiguredUnits:7});assert.equal(weeklyCategoryGroups(r)[0].recalculatedUnits,10);
 d.sales[0].items[1].iceCreamGrams=0;d.products[1].iceCreamGrams=160;d.products[1].iceCreamScoops=2;assert.equal(weeklyConsumptionReport(d,d.weeks[0]).products.find(p=>p.id==='p1')!.iceCreamGrams,0);
});
test('historial cerrado y CSV recalculan; anulaciones descuentan y snapshot original permanece intacto',()=>{
 const d=fixture(),w=finishWeek(d,'w1','w2','2026-10-13T14:00:00Z'),original=structuredClone(w.closing);const r=weeklyConsumptionReport(d,w);
 assert.equal(iceCreamConsumption(r.products).grams,2640);assert.equal(iceCreamConsumption(weekReport(d,w).products).configured,false);
 const csv=weeklyCsv(w,d);assert.match(csv,/"unidades_recalculadas"/);assert.ok(csv.split('\r\n').find(l=>l.startsWith('"CATEGORIA"'))!.split(';').slice(0,25).join(';').endsWith(';"2,640";"0";"17";"";""'));
 cancelSale(d,'s1','Prueba','2026-10-13T15:00:00Z');assert.equal(weeklyConsumptionReport(d,w).products.length,0);assert.deepEqual(w.closing,original);assert.doesNotThrow(()=>validateData(d));
});
test('respaldo y recarga conservan datos originales mientras la vista recalcula',async()=>{
 const d=fixture(),w=finishWeek(d,'w1','w2','2026-10-13T14:00:00Z'),db=await PosDatabase.open(crypto.randomUUID());
 try{await db.restore(d);const data=await db.exportData();assert.deepEqual({...data,priceAudit:undefined},{...d,priceAudit:undefined});assert.equal(iceCreamConsumption(weeklyConsumptionReport(data,data.weeks[0]).products).grams,2640);assert.deepEqual(await db.exportData(),data);assert.equal(data.sales[0].items[0].iceCreamGrams,undefined);assert.equal(w.closing!.report.products[0].iceCreamGrams,undefined);}finally{db.close();}
});
