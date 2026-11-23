import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Data, emptyData } from '../src/app/core/models';
import { boxEquivalence, setBoxesPerPack, setUnitsPerBox } from '../src/app/core/box-equivalents';
import { BaseProductDraft, saveBaseProduct } from '../src/app/core/product-presentations';
import { groupExistingProducts, deleteProductGroup } from '../src/app/core/catalog-groups';
import { weeklyCategoryGroups } from '../src/app/core/weekly-category-groups';
import { weeklyConsumptionReport } from '../src/app/core/weekly-consumption-report';
import { finishWeek } from '../src/app/core/weeks';
import { weeklyCsv } from '../src/app/core/weekly-csv';
import { exportCatalog, importCatalog, validateCatalogFile } from '../src/app/core/catalog-transfer';
import { cancelSale } from '../src/app/core/cancellations';
import { validateData } from '../src/app/core/domain';
import { PosDatabase } from '../src/app/core/indexed-db';

function fixture():Data {
 const d=emptyData();
 d.productFamilies=[{id:'f',name:'Bombón Escocés',category:'Envasados',unitsPerBox:8}];
 d.products=[{id:'box',name:'Bombón Escocés caja',gridoName:'ESCOCES X8U',category:'Envasados',familyId:'f',presentation:'Caja',price:1000000,active:true},{id:'unit',name:'Escocés individual',gridoName:'ESCOCES X1U',category:'Envasados',familyId:'f',presentation:'Unidad',price:150000,active:true}];
 d.sessions=[{id:'turn',openedAt:'2026-11-09T12:00:00Z',opening:0,movements:[]}];
 d.weeks=[{id:'week',startedAt:'2026-11-09T03:00:00Z'}];
 d.sales=[['box',2],['box',2],['unit',4]].map(([id,quantity],n)=>{const p=d.products.find(p=>p.id===id)!,q=Number(quantity),price=p.price+(n===1?10000:0),total=price*q;return {id:'sale-'+n,number:n+1,sessionId:'turn',weekId:'week',at:`2026-11-09T13:0${n}:00Z`,items:[{productId:p.id,name:p.name,gridoName:p.gridoName,category:p.category,quantity:q,unitPrice:price,subtotal:total}],total,payment:'CASH',received:total,change:0};});
 return d;
}
const snapshots=(d:Data)=>structuredClone({products:d.products,sales:d.sales,sessions:d.sessions,weeks:d.weeks});
const group=(d:Data)=>weeklyCategoryGroups(weeklyConsumptionReport(d,d.weeks[0]),d)[0].families.find(f=>f.id==='f')!;
function edit(d:Data,boxesPerPack:number|null|undefined):BaseProductDraft {return {familyId:'f',baseName:'Bombón Escocés',category:'Envasados',boxesPerPack,rows:d.products.filter(p=>p.familyId==='f').map(p=>({kind:p.presentation as 'Caja'|'Unidad',active:p.active,productId:p.id,name:p.name,gridoName:p.gridoName!,price:p.price}))};}
const csvRows=(value:string)=>{const rows=value.slice(1).trim().split('\r\n').map(line=>line.split(';').map(cell=>JSON.parse(cell)));return rows.slice(1).map(row=>Object.fromEntries(rows[0].map((name,i)=>[name,row[i]])));};

test('4 cajas y 4 unidades a 8 por caja y 6 cajas por pack son 36 unidades, 4,5 cajas y 0,75 packs',()=>{
 const r=boxEquivalence([{presentation:'Caja',quantity:4},{presentation:'Unidad',quantity:4}],8,6);
 assert.equal(r.totalUnits,36);assert.equal(r.totalBoxes,4.5);assert.equal(r.totalPacks,0.75);assert.equal(r.boxesPerPack,6);
 assert.equal(boxEquivalence([{presentation:'Unidad',quantity:48}],8,6).totalPacks,1);
 assert.equal(boxEquivalence([{presentation:'Caja',quantity:6}],8,6).totalPacks,1);
 assert.equal(boxEquivalence([],8,6).totalPacks,0);
 // Fractional equivalence stays fractional; it is not a rounded purchase order.
 assert.equal(boxEquivalence([{presentation:'Unidad',quantity:1}],8,6).totalPacks,1/48);
});

test('configurar packs después recalcula toda la semana ya vendida sin cambiar ventas ni catálogo comercial',()=>{
 const d=fixture(),before=snapshots(d);assert.equal(group(d).boxEquivalence!.totalPacks,undefined);
 saveBaseProduct(d,edit(d,6));assert.equal(group(d).boxEquivalence!.totalPacks,0.75);assert.deepEqual(snapshots(d),before);
 saveBaseProduct(d,edit(d,3));assert.equal(group(d).boxEquivalence!.totalPacks,1.5);assert.deepEqual(snapshots(d),before);
 assert.doesNotThrow(()=>validateData(d));
});

test('cada familia conserva su capacidad propia y la presentación no se deduce del nombre',()=>{
 const d=fixture();setBoxesPerPack(d.productFamilies![0],6);
 d.productFamilies!.push({id:'water',name:'Palito agua',category:'Envasados',unitsPerBox:12,boxesPerPack:4});
 d.products.push({id:'water-unit',name:'Escocés caja parecido',gridoName:'AGUA X1U',category:'Envasados',familyId:'water',presentation:'Unidad',price:100000,active:true});
 const p=d.products[2],total=p.price*6;d.sales.push({id:'water-sale',number:4,sessionId:'turn',weekId:'week',at:'2026-11-09T14:00:00Z',items:[{productId:p.id,name:p.name,category:p.category,quantity:6,unitPrice:p.price,subtotal:total}],total,payment:'CASH',received:total,change:0});
 const families=weeklyCategoryGroups(weeklyConsumptionReport(d,d.weeks[0]),d)[0].families;
 assert.deepEqual(families.map(f=>[f.name,f.boxEquivalence!.totalUnits,f.boxEquivalence!.totalBoxes,f.boxEquivalence!.totalPacks]),[['Bombón Escocés',36,4.5,0.75],['Palito agua',6,0.5,0.125]]);
});

test('sin capacidad de pack no se inventa una y con solo cajas por pack no se estima la caja desconocida',()=>{
 const d=fixture();assert.equal(group(d).boxEquivalence!.totalPacks,undefined);
 delete d.productFamilies![0].unitsPerBox;setBoxesPerPack(d.productFamilies![0],6);
 assert.equal(group(d).boxEquivalence,undefined);assert.doesNotThrow(()=>validateData(d));
 setUnitsPerBox(d.productFamilies![0],8);assert.equal(group(d).boxEquivalence!.totalPacks,0.75);
});

test('borrar pack conserva cajas; un draft anterior sin el nuevo campo conserva la configuración existente',()=>{
 const d=fixture();saveBaseProduct(d,edit(d,6));saveBaseProduct(d,edit(d,undefined));assert.equal(d.productFamilies![0].boxesPerPack,6);
 saveBaseProduct(d,edit(d,null));assert.equal(d.productFamilies![0].boxesPerPack,undefined);assert.equal(group(d).boxEquivalence!.totalBoxes,4.5);assert.equal(group(d).boxEquivalence!.totalUnits,36);assert.equal(group(d).boxEquivalence!.totalPacks,undefined);
});

test('valida enteros positivos y revierte toda una edición inválida de familia y productos',()=>{
 for(const value of [0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'6']){
  const d=fixture(),before=structuredClone(d),draft=edit(d,value as number);draft.baseName='No guardar';draft.rows[0].price=2000000;
  assert.throws(()=>saveBaseProduct(d,draft),/Cajas por pack/);assert.deepEqual(d,before);
  assert.throws(()=>boxEquivalence([],8,value as number),/Cajas por pack/);
 }
 const d=fixture();d.productFamilies![0].boxesPerPack=null as unknown as number;assert.throws(()=>validateData(d),/Cajas por pack/);
});

test('catálogo portable transporta ambos factores y mantiene los IDs locales; un archivo anterior limpia solo packs',()=>{
 const d=fixture();setBoxesPerPack(d.productFamilies![0],6);const before=snapshots(d),file=exportCatalog(d);
 assert.deepEqual(file.families![0],{name:'Bombón Escocés',category:'Envasados',unitsPerBox:8,boxesPerPack:6});assert.deepEqual(validateCatalogFile(file),file);
 importCatalog(d,file);assert.deepEqual(snapshots(d),before);assert.equal(group(d).boxEquivalence!.totalPacks,0.75);
 const target=emptyData();importCatalog(target,file);assert.equal(target.productFamilies![0].boxesPerPack,6);
 const old=structuredClone(file);delete (old.families![0] as {boxesPerPack?:number}).boxesPerPack;importCatalog(d,old);
 assert.equal(d.productFamilies![0].boxesPerPack,undefined);assert.equal(d.productFamilies![0].unitsPerBox,8);assert.equal(group(d).boxEquivalence!.totalBoxes,4.5);
 const legacy=fixture();delete legacy.productFamilies![0].category;setBoxesPerPack(legacy.productFamilies![0],6);const legacyFile=exportCatalog(legacy);assert.deepEqual(validateCatalogFile(legacyFile),legacyFile);
});

test('archivo con cajas por pack inválidas no reemplaza parcialmente productos, familias o historial',()=>{
 for(const value of [0,-1,2.5,'6',null]){const d=fixture(),before=structuredClone(d),file=exportCatalog(d);(file.families![0] as {boxesPerPack:unknown}).boxesPerPack=value;assert.throws(()=>importCatalog(d,file),/Cajas por pack/);assert.deepEqual(d,before);}
});

test('CSV agrega unidades canónicas y packs, y descuenta anulaciones posteriores manteniendo el cierre original',()=>{
 const d=fixture();setBoxesPerPack(d.productFamilies![0],6);finishWeek(d,'week','next','2026-11-10T03:00:00Z');const original=structuredClone(d.weeks[0].closing);
 let row=csvRows(weeklyCsv(d.weeks[0],d)).find(r=>r.tipo==='FAMILIA')!;
 assert.equal(row.unidades_totales_equivalentes,'36');assert.equal(row.cajas_totales,'4,5');assert.equal(row.cajas_por_pack,'6');assert.equal(row.packs_equivalentes,'0,75');assert.equal(row.base_equivalencia_cajas,'catalogo_actual');
 cancelSale(d,'sale-0','Anulación','2026-11-10T12:00:00Z');row=csvRows(weeklyCsv(d.weeks[0],d)).find(r=>r.tipo==='FAMILIA')!;
 assert.equal(row.unidades_totales_equivalentes,'20');assert.equal(row.cajas_totales,'2,5');assert.equal(row.packs_equivalentes,'0,416667');assert.deepEqual(d.weeks[0].closing,original);
 assert.equal(weeklyCategoryGroups(original!.report,d)[0].families[0].boxEquivalence!.totalPacks,0.75);assert.doesNotThrow(()=>validateData(d));
});

test('presentaciones desconocidas marcan los tres equivalentes como parciales y el archivo conserva el aviso',()=>{
 const d=fixture();setBoxesPerPack(d.productFamilies![0],6);d.products[1].presentation='Pack';
 const value=group(d).boxEquivalence!;assert.equal(value.partial,true);assert.equal(value.unconvertedUnits,4);assert.equal(value.totalUnits,32);assert.equal(value.totalPacks,4/6);
 finishWeek(d,'week','next','2026-11-10T03:00:00Z');const row=csvRows(weeklyCsv(d.weeks[0],d)).find(r=>r.tipo==='FAMILIA')!;
 assert.equal(row.equivalencia_cajas_parcial,'SI');assert.equal(row.unidades_sin_equivalencia,'4');assert.equal(row.unidades_totales_equivalentes,'32');
 deleteProductGroup(d,'f');assert.equal(group(d).boxEquivalence!.totalPacks,4/6);
});

test('agrupar productos existentes o crear una base vacía guarda los dos factores sin duplicar SKUs',()=>{
 const d=fixture();for(const p of d.products){delete p.familyId;delete p.presentation;}d.productFamilies=[];const before=snapshots(d);
 groupExistingProducts(d,{name:'Bombón Escocés',category:'Envasados',boxProductId:'box',unitsPerBox:8,boxesPerPack:6},()=>'f');
 groupExistingProducts(d,{name:'Bombón Escocés',category:'Envasados',familyId:'f',boxProductId:'box',unitProductId:'unit'});
 assert.equal(group(d).boxEquivalence!.totalPacks,0.75);assert.deepEqual(d.sales,before.sales);assert.deepEqual(d.weeks,before.weeks);assert.equal(d.products.length,2);
 const blank=emptyData();saveBaseProduct(blank,{baseName:'Vacío',category:'Envasados',unitsPerBox:8,boxesPerPack:6,rows:[{kind:'Caja',active:false,name:'',gridoName:'',price:0},{kind:'Unidad',active:false,name:'',gridoName:'',price:0}]},()=>'empty');
 assert.equal(blank.productFamilies![0].boxesPerPack,6);assert.equal(blank.products.length,emptyData().products.length);
});

test('packs persisten y se auditan con valores anterior/nuevo; respaldo, restauración y recarga conservan datos',async()=>{
 const name=crypto.randomUUID(),db=await PosDatabase.open(name);
 try{
  await db.restore(fixture());const before=snapshots(await db.exportData());await db.update(d=>{saveBaseProduct(d,edit(d,6));});
  let records=(await db.queryPriceAudit(1)).rows.filter(r=>r.source==='PRODUCT_EDIT'&&r.changes?.some(c=>c.field==='boxesPerPack'));
  assert.equal(records.length,2);assert.ok(records.every(r=>r.action==='PRODUCT_EDITED'&&r.previousPrice===r.newPrice&&r.changes!.some(c=>c.field==='boxesPerPack'&&c.previous===null&&c.next===6)));
  const backup=await db.exportData();assert.deepEqual(snapshots(backup),before);assert.equal(backup.productFamilies![0].boxesPerPack,6);assert.doesNotThrow(()=>validateData(backup));
  await assert.rejects(db.update(d=>{saveBaseProduct(d,edit(d,0));}));assert.deepEqual(await db.exportData(),backup);
  const target=await PosDatabase.open(crypto.randomUUID());try{await target.restore(backup);const restored=await target.exportData();assert.equal(group(restored).boxEquivalence!.totalPacks,0.75);assert.deepEqual(restored.productFamilies,backup.productFamilies);}finally{target.close();}
  await db.update(d=>{saveBaseProduct(d,edit(d,4));});records=(await db.queryPriceAudit(1)).rows.filter(r=>r.source==='PRODUCT_EDIT'&&r.changes?.some(c=>c.field==='boxesPerPack'));assert.equal(records.length,4);assert.ok(records.slice(0,2).every(r=>r.changes!.some(c=>c.field==='boxesPerPack'&&c.previous===6&&c.next===4)));
 }finally{db.close();}
 const reopened=await PosDatabase.open(name);try{assert.equal((await reopened.exportData()).productFamilies![0].boxesPerPack,4);}finally{reopened.close();}
});
