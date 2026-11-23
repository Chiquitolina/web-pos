import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyData, Item, Sale } from '../src/app/core/models';
import { saveProduct } from '../src/app/core/catalog';
import { snapshotIceCreamPortion, iceCreamConsumption } from '../src/app/core/ice-cream';
import { summarizeSales, beginWeek, finishWeek, weekReport } from '../src/app/core/weeks';
import { weeklyCategoryGroups } from '../src/app/core/weekly-category-groups';
import { cancelSale } from '../src/app/core/cancellations';
import { validateData } from '../src/app/core/domain';
import { exportCatalog, importCatalog } from '../src/app/core/catalog-transfer';
import { PosDatabase } from '../src/app/core/indexed-db';
import { weeklyCsv } from '../src/app/core/weekly-csv';
function item(id:string,category:string,quantity:number,grams?:number,scoops?:number):Item{return {productId:id,name:id,category,quantity,unitPrice:100,subtotal:quantity*100,...(grams!==undefined?{iceCreamGrams:grams}:{}),...(scoops!==undefined?{iceCreamScoops:scoops}:{})};}
function sale(n:number,items:Item[]):Sale{const total=items.reduce((n,i)=>n+i.subtotal,0);return {id:'s'+n,number:n,sessionId:'cash',at:`2026-10-06T1${n}:00:00Z`,items,total,payment:'CASH',received:total,change:0};}
function fixture(){const d=emptyData();d.sessions.push({id:'cash',openedAt:'2026-10-05T12:00:00Z',opening:0,movements:[]});d.sales=[sale(1,[item('one','Helado x Bocha',10,80,1),item('two','Helado x Bocha',5,160,2),item('three','Helado x Bocha',2,240,3),item('kg','Helado x Kilo',2,1000),item('half','Helado x Kilo',3,500),item('quarter','Helado x Kilo',4,250)])];return d;}
test('suma bochas 1/2/3 a 80 g y kilos, medios y cuartos por categoría',()=>{
 const groups=weeklyCategoryGroups(summarizeSales(fixture().sales));
 assert.deepEqual(groups.find(g=>g.category.name==='Helado x Bocha')!.consumption,{grams:2080,scoops:26,configured:true,unconfiguredUnits:0});
 assert.deepEqual(groups.find(g=>g.category.name==='Helado x Kilo')!.consumption,{grams:4500,scoops:0,configured:true,unconfiguredUnits:0});
 assert.equal(iceCreamConsumption(groups.flatMap(g=>g.products)).grams,6580);
});
test('configuración valida gramos/bochas, permite borrar y no modifica datos ante error',()=>{
 const d=emptyData(),p=d.products[0],changes={name:p.name,gridoName:p.name,category:p.category,price:p.price};
 for(const grams of [-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){const before=structuredClone(d);assert.throws(()=>saveProduct(d,p.id,{...changes,iceCreamGrams:grams,iceCreamScoops:null}));assert.deepEqual(d,before);}
 for(const scoops of [0,-1,1.5])assert.throws(()=>saveProduct(d,p.id,{...changes,iceCreamScoops:scoops,iceCreamGrams:80}));
 assert.throws(()=>saveProduct(d,p.id,{...changes,iceCreamGrams:100,iceCreamScoops:1}));
 saveProduct(d,p.id,{...changes,iceCreamGrams:240,iceCreamScoops:3});assert.equal(p.iceCreamGrams,240);
 saveProduct(d,p.id,{...changes,iceCreamGrams:null,iceCreamScoops:null});assert.equal(p.iceCreamGrams,undefined);
 saveProduct(d,p.id,{...changes,iceCreamGrams:0});assert.equal(p.iceCreamGrams,0);
});
test('cobro copia configuración; cambios posteriores y ventas antiguas no recalculan consumo',()=>{
 const d=emptyData(),p=d.products[0],i=item(p.id,p.category,2);snapshotIceCreamPortion(i,p);
 p.iceCreamGrams=240;p.iceCreamScoops=3;const newer=item(p.id,p.category,1);snapshotIceCreamPortion(newer,p);
 const old=item(p.id,p.category,4);const r=summarizeSales([sale(1,[i,newer,old])]);
 assert.equal(r.products.length,3);assert.deepEqual(iceCreamConsumption(r.products),{grams:400,scoops:5,unconfiguredUnits:4,configured:true});
 delete p.iceCreamGrams;delete p.iceCreamScoops;snapshotIceCreamPortion(newer,p);assert.equal(newer.iceCreamGrams,undefined);assert.equal(i.iceCreamGrams,80);
});
test('anulaciones posteriores ajustan gramos/bochas vigentes sin alterar el cierre original',()=>{
 const d=fixture();d.sales.push(sale(2,[item('one','Helado x Bocha',2,80,1)]));beginWeek(d,'w1','2026-10-05','2026-10-07T12:00:00Z');const w=finishWeek(d,'w1','w2','2026-10-07T13:00:00Z');const original=structuredClone(w.closing);
 cancelSale(d,'s2','Prueba','2026-10-07T14:00:00Z');assert.equal(iceCreamConsumption(weekReport(d,w).products).grams,6580);assert.equal(iceCreamConsumption(w.closing!.report.products).grams,6740);assert.deepEqual(w.closing,original);assert.doesNotThrow(()=>validateData(d));
 cancelSale(d,'s1','Prueba','2026-10-07T15:00:00Z');assert.equal(weeklyCategoryGroups(weekReport(d,w)).length,0);
});
test('catálogo portátil y respaldo IndexedDB conservan gramajes; archivos viejos siguen compatibles',async()=>{
 const d=fixture();beginWeek(d,'w1','2026-10-05','2026-10-07T12:00:00Z');finishWeek(d,'w1','w2','2026-10-07T13:00:00Z');
 const db=await PosDatabase.open(crypto.randomUUID());try{await db.restore(d);const restored=await db.exportData();assert.deepEqual({...restored,priceAudit:undefined},{...d,priceAudit:undefined});assert.equal(restored.priceAudit!.at(-1)!.action,'BACKUP_RESTORED');assert.equal(iceCreamConsumption(weekReport(restored,restored.weeks[0]).products).grams,6580);
 const f=exportCatalog(d),other=emptyData();importCatalog(other,f);assert.equal(other.products[0].iceCreamGrams,80);assert.equal(other.products[0].iceCreamScoops,1);
 for(const p of f.products){delete p.iceCreamGrams;delete p.iceCreamScoops;}importCatalog(other,f);assert.equal(other.products[0].iceCreamGrams,undefined);assert.equal(other.products[0].iceCreamScoops,undefined);
 const bad=structuredClone(restored);bad.sales[0].items[0].iceCreamGrams=-1;await assert.rejects(db.restore(bad),/Gramaje/);assert.deepEqual(await db.exportData(),restored);
 const badCatalog=exportCatalog(d);badCatalog.products[0].iceCreamGrams=81;const before=structuredClone(other);assert.throws(()=>importCatalog(other,badCatalog),/Bochas/);assert.deepEqual(other,before);
 }finally{db.close();}
});
test('CSV incluye consumo por producto/categoría y unidades sin gramaje en vez de inventar cero',()=>{
 const d=fixture();d.sales[0].items.push(item('legacy','Helado x Bocha',3));d.sales[0].total+=300;d.sales[0].received+=300;beginWeek(d,'w1','2026-10-05','2026-10-07T12:00:00Z');const w=finishWeek(d,'w1','w2','2026-10-07T13:00:00Z');
 const lines=weeklyCsv(w,d).trim().split('\r\n');const header=lines[0];assert.match(header,/"gramos_por_unidad";"bochas_por_unidad";"bochas_teoricas";"gramos_teoricos";"kilos_teoricos";"unidades_sin_gramaje"/);
 const bocha=lines.find(l=>l.startsWith('"CATEGORIA"')&&l.includes('"Helado x Bocha"'))!;assert.ok(bocha.split(';').slice(0,25).join(';').endsWith(';"";"";"26";"2080";"2,080";"3";"0";"";""'));
 const kg=lines.find(l=>l.startsWith('"CATEGORIA"')&&l.includes('"Helado x Kilo"'))!;assert.ok(kg.split(';').slice(0,25).join(';').endsWith(';"";"";"0";"4500";"4,500";"0";"0";"";""'));
 const legacy=lines.find(l=>l.startsWith('"PRODUCTO"')&&l.includes('"legacy"'))!;assert.ok(legacy.split(';').slice(0,25).join(';').endsWith(';"";"";"0";"";"";"3";"0";"";""'));
});
