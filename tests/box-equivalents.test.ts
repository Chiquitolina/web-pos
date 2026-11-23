import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Data, emptyData, Sale } from '../src/app/core/models';
import { boxEquivalence, setUnitsPerBox } from '../src/app/core/box-equivalents';
import { saveBaseProduct, BaseProductDraft } from '../src/app/core/product-presentations';
import { groupExistingProducts, deleteProductGroup } from '../src/app/core/catalog-groups';
import { weeklyCategoryGroups } from '../src/app/core/weekly-category-groups';
import { weeklyConsumptionReport } from '../src/app/core/weekly-consumption-report';
import { weeklyCsv } from '../src/app/core/weekly-csv';
import { finishWeek } from '../src/app/core/weeks';
import { cancelSale } from '../src/app/core/cancellations';
import { closeSession, validateData } from '../src/app/core/domain';
import { exportCatalog, importCatalog, validateCatalogFile } from '../src/app/core/catalog-transfer';
import { PosDatabase } from '../src/app/core/indexed-db';

function fixture():Data {
 const d=emptyData();
 d.productFamilies=[{id:'escoces',name:'Bombón Escocés',category:'Envasados'},{id:'agua',name:'Palito frutilla agua',category:'Envasados',unitsPerBox:12}];
 d.products=[
  {id:'ec',name:'Bombón Escocés caja',gridoName:'Escocés x8U',category:'Envasados',familyId:'escoces',presentation:'Caja',price:1000000,active:true},
  {id:'eu',name:'Escocés individual',gridoName:'Escocés x1U',category:'Envasados',familyId:'escoces',presentation:'Unidad',price:150000,active:true},
  {id:'ac',name:'Palito agua caja',gridoName:'Agua x12U',category:'Envasados',familyId:'agua',presentation:'Caja',price:900000,active:true},
  {id:'au',name:'Palito agua individual',gridoName:'Agua x1U',category:'Envasados',familyId:'agua',presentation:'Unidad',price:100000,active:true}
 ];
 d.sessions=[{id:'turn',openedAt:'2026-11-09T12:00:00Z',opening:0,movements:[]}];
 d.weeks=[{id:'week',startedAt:'2026-11-09T03:00:00Z'}];
 const counts:[string,number][]=[['ec',2],['ec',2],['eu',4],['ac',1],['au',6]];
 d.sales=counts.map(([id,quantity],n)=>{
  const p=d.products.find(p=>p.id===id)!,price=p.price+(n===1?10000:0),total=price*quantity;
  return {id:'s'+n,number:n+1,sessionId:'turn',weekId:'week',at:`2026-11-09T13:0${n}:00Z`,items:[{productId:p.id,name:p.name,gridoName:p.gridoName,category:p.category,quantity,unitPrice:price,subtotal:total}],total,payment:'CASH',received:total,change:0} as Sale;
 });
 d.sessions[0].closing=closeSession(d,d.sessions[0],d.sales.reduce((sum,s)=>sum+s.total,0),undefined,'2026-11-09T15:00:00Z');
 finishWeek(d,'week','next-week','2026-11-10T03:00:00Z');
 return d;
}
const snapshots=(d:Data)=>structuredClone({products:d.products,sales:d.sales,sessions:d.sessions,weeks:d.weeks});
const groups=(d:Data)=>weeklyCategoryGroups(weeklyConsumptionReport(d,d.weeks[0]),d)[0].families;
function edit(d:Data,unitsPerBox:number|null|undefined):BaseProductDraft {
 return {baseName:'Bombón Escocés',category:'Envasados',familyId:'escoces',unitsPerBox,rows:d.products.filter(p=>p.familyId==='escoces').map(p=>({kind:p.presentation as 'Caja'|'Unidad',active:p.active,productId:p.id,name:p.name,gridoName:p.gridoName!,price:p.price}))};
}
const csvRows=(value:string)=>{const rows=value.slice(1).trim().split('\r\n').map(line=>line.split(';').map(cell=>JSON.parse(cell)));return rows.slice(1).map(row=>Object.fromEntries(rows[0].map((name,i)=>[name,row[i]])));};

test('4 cajas y 4 unidades de una caja de 8 equivalen a 4,5; la captura de 10 y 20 equivale a 12,5',()=>{
 assert.deepEqual(boxEquivalence([{presentation:'Caja',quantity:4},{presentation:'Unidad',quantity:4}],8),{unitsPerBox:8,boxes:4,looseUnits:4,unconvertedUnits:0,totalBoxes:4.5,totalUnits:36,partial:false});
 assert.equal(boxEquivalence([{presentation:'Caja',quantity:10},{presentation:'Unidad',quantity:20}],8).totalBoxes,12.5);
 assert.equal(boxEquivalence([{presentation:' Unidad ',quantity:4}],8).totalBoxes,0.5);
 assert.equal(boxEquivalence([{presentation:'caja',quantity:4}],8).totalBoxes,4);
 assert.equal(boxEquivalence([],8).totalBoxes,0);
});

test('una presentación desconocida no se interpreta como unidad y marca la equivalencia parcial',()=>{
 const result=boxEquivalence([{presentation:'Caja',quantity:4},{presentation:'Unidad',quantity:4},{presentation:'Pack x3',quantity:2},{quantity:1}],8);
 assert.equal(result.totalBoxes,4.5);assert.equal(result.partial,true);assert.equal(result.unconvertedUnits,3);
});

test('configurar después recalcula ventas anteriores a distintos precios sin reescribir cantidades ni cierres',()=>{
 const d=fixture(),before=snapshots(d);
 assert.equal(groups(d).find(f=>f.id==='escoces')!.boxEquivalence,undefined);
 saveBaseProduct(d,edit(d,8));
 assert.deepEqual(snapshots(d),before);
 const group=groups(d).find(f=>f.id==='escoces')!;
 assert.equal(group.boxEquivalence!.totalBoxes,4.5);assert.equal(group.boxEquivalence!.boxes,4);assert.equal(group.boxEquivalence!.looseUnits,4);
 assert.equal(group.total,d.sales.slice(0,3).reduce((sum,s)=>sum+s.total,0));
 setUnitsPerBox(d.productFamilies![0],16);assert.equal(groups(d).find(f=>f.id==='escoces')!.boxEquivalence!.totalBoxes,4.25);
 assert.deepEqual(snapshots(d),before);assert.doesNotThrow(()=>validateData(d));
});

test('cada familia usa su propia capacidad y no se suman cajas de productos distintos',()=>{
 const d=fixture();setUnitsPerBox(d.productFamilies![0],8);
 assert.deepEqual(groups(d).map(f=>[f.name,f.boxEquivalence!.unitsPerBox,f.boxEquivalence!.totalBoxes]),[['Bombón Escocés',8,4.5],['Palito frutilla agua',12,1.5]]);
});

test('anular después del cierre descuenta cajas del informe vigente y mantiene el snapshot original',()=>{
 const d=fixture();setUnitsPerBox(d.productFamilies![0],8);const closed=structuredClone(d.weeks[0].closing);
 cancelSale(d,'s0','Prueba de anulación','2026-11-10T12:00:00Z');
 assert.equal(groups(d).find(f=>f.id==='escoces')!.boxEquivalence!.totalBoxes,2.5);
 assert.deepEqual(d.weeks[0].closing,closed);
 const original=weeklyCategoryGroups(d.weeks[0].closing!.report,d)[0].families.find(f=>f.id==='escoces')!;
 assert.equal(original.boxEquivalence!.totalBoxes,4.5);
 assert.doesNotThrow(()=>validateData(d));
});

test('unidades por caja exige enteros positivos y los errores revierten la edición completa',()=>{
 for(const value of [0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'8',null]){
  const d=fixture(),before=structuredClone(d);d.productFamilies![0].unitsPerBox=value as number;
  assert.throws(()=>validateData(d),/Unidades por caja/);
  if(value!==null){const clean=fixture(),original=structuredClone(clean);assert.throws(()=>saveBaseProduct(clean,edit(clean,value as number)),/Unidades por caja/);assert.deepEqual(clean,original);}
  assert.deepEqual(before,fixture());
 }
 const d=fixture();saveBaseProduct(d,edit(d,1));assert.equal(groups(d).find(f=>f.id==='escoces')!.boxEquivalence!.totalBoxes,8);
 saveBaseProduct(d,edit(d,undefined));assert.equal(d.productFamilies![0].unitsPerBox,1);
 saveBaseProduct(d,edit(d,null));assert.equal(d.productFamilies![0].unitsPerBox,undefined);assert.equal(groups(d).find(f=>f.id==='escoces')!.boxEquivalence,undefined);
});

test('agrupar productos existentes puede guardar la capacidad sin tocar los SKUs ni su historia',()=>{
 const d=fixture();d.productFamilies=d.productFamilies!.filter(f=>f.id!=='escoces');
 for(const p of d.products.filter(p=>p.familyId==='escoces')){delete p.familyId;delete p.presentation;}
 const before=snapshots(d);
 groupExistingProducts(d,{name:'Bombón Escocés',category:'Envasados',boxProductId:'ec',unitProductId:'eu',unitsPerBox:8},()=>'new-family');
 assert.equal(groups(d).find(f=>f.id==='new-family')!.boxEquivalence!.totalBoxes,4.5);
 assert.deepEqual(d.sales,before.sales);assert.deepEqual(d.weeks,before.weeks);assert.equal(d.products.length,before.products.length);
 for(const p of d.products){const {familyId,presentation,...rest}=p;const old=before.products.find(o=>o.id===p.id)!;const {familyId:oldFamily,presentation:oldKind,...oldRest}=old;assert.deepEqual(rest,oldRest);}
 const invalid=structuredClone(d);assert.throws(()=>groupExistingProducts(d,{name:'Bombón Escocés',category:'Envasados',familyId:'new-family',boxProductId:'ec',unitProductId:'eu',unitsPerBox:0}));assert.deepEqual(d,invalid);
});

test('el catálogo portable y un respaldo antiguo conservan compatibilidad; importar sin capacidad la deja vacía',()=>{
 const d=fixture();setUnitsPerBox(d.productFamilies![0],8);const file=exportCatalog(d),before=snapshots(d);
 assert.deepEqual(validateCatalogFile(file),file);assert.deepEqual(file.families![0],{name:'Bombón Escocés',category:'Envasados',unitsPerBox:8});
 importCatalog(d,file);assert.deepEqual(snapshots(d),before);assert.equal(groups(d).find(f=>f.id==='escoces')!.boxEquivalence!.totalBoxes,4.5);
 const target=emptyData();importCatalog(target,file);assert.equal(target.productFamilies!.find(f=>f.name==='Bombón Escocés')!.unitsPerBox,8);
 const old=structuredClone(file);for(const f of old.families!)if(typeof f!=='string')delete f.unitsPerBox;
 importCatalog(d,old);assert.ok(d.productFamilies!.filter(f=>!f.deletedAt).every(f=>f.unitsPerBox===undefined));assert.doesNotThrow(()=>validateData(fixture()));
 // Legacy families can lack a category, including empty bases.
 const legacy=fixture();delete legacy.productFamilies![0].category;setUnitsPerBox(legacy.productFamilies![0],8);
 const legacyFile=exportCatalog(legacy);assert.deepEqual(legacyFile.families![0],{name:'Bombón Escocés',unitsPerBox:8});assert.deepEqual(validateCatalogFile(legacyFile),legacyFile);
});

test('un archivo con capacidad inválida no reemplaza parcialmente el catálogo',()=>{
 for(const value of [0,-8,2.5,null,'8']){
  const d=fixture(),before=structuredClone(d),file=exportCatalog(d);
  (file.families![0] as {unitsPerBox:unknown}).unitsPerBox=value;
  assert.throws(()=>importCatalog(d,file),/Unidades por caja/);assert.deepEqual(d,before);
 }
});

test('CSV conserva columnas previas y agrega subtotal familiar, capacidad y cajas equivalentes sin duplicar cantidades',()=>{
 const d=fixture();setUnitsPerBox(d.productFamilies![0],8);const before=structuredClone(d),rows=csvRows(weeklyCsv(d.weeks[0],d));
 const family=rows.find(r=>r.tipo==='FAMILIA'&&r.familia==='Bombón Escocés')!;
 assert.equal(family.unidades_por_caja,'8');assert.equal(family.cajas_vendidas,'4');assert.equal(family.unidades_sueltas,'4');assert.equal(family.cajas_totales,'4,5');assert.equal(family.unidades,'');assert.equal(family.base_equivalencia_cajas,'catalogo_actual');assert.equal(family.equivalencia_cajas_parcial,'NO');
 const unit=rows.find(r=>r.tipo==='PRODUCTO'&&r.producto_id==='eu')!;assert.equal(unit.cajas_totales,'0,5');assert.equal(unit.presentacion,'Unidad');
 assert.equal(rows.filter(r=>r.tipo==='PRODUCTO').reduce((sum,r)=>sum+Number(String(r.importe_ars).replace(',','.')),0),d.sales.reduce((sum,s)=>sum+s.total,0)/100);
 assert.deepEqual(d,before);
});

test('CSV marca como parcial lo que no puede convertir y no inventa equivalencias sin configuración',()=>{
 const d=fixture();d.products[1].presentation='Pack';setUnitsPerBox(d.productFamilies![0],8);
 let family=csvRows(weeklyCsv(d.weeks[0],d)).find(r=>r.tipo==='FAMILIA'&&r.familia==='Bombón Escocés')!;
 assert.equal(family.cajas_totales,'4');assert.equal(family.unidades_sin_equivalencia,'4');assert.equal(family.equivalencia_cajas_parcial,'SI');
 setUnitsPerBox(d.productFamilies![0],null);family=csvRows(weeklyCsv(d.weeks[0],d)).find(r=>r.tipo==='FAMILIA'&&r.familia==='Bombón Escocés')!;
 assert.equal(family.cajas_totales,'');assert.equal(family.unidades_por_caja,'');
});

test('archivar el producto conserva la equivalencia de sus ventas históricas',()=>{
 const d=fixture();setUnitsPerBox(d.productFamilies![0],8);const before=structuredClone(d.sales);
 deleteProductGroup(d,'escoces');assert.equal(groups(d).find(f=>f.id==='escoces')!.boxEquivalence!.totalBoxes,4.5);assert.deepEqual(d.sales,before);
});

test('la capacidad persiste, se audita, se respalda y se restaura sin cambiar precios ni la versión de IndexedDB',async()=>{
 const name=crypto.randomUUID(),db=await PosDatabase.open(name);
 try{
  await db.restore(fixture());const original=await db.exportData();
  await db.update(d=>{saveBaseProduct(d,edit(d,8));});
  let audit=(await db.queryPriceAudit(1)).rows.filter(r=>r.source==='PRODUCT_EDIT'&&r.changes?.some(c=>c.field==='unitsPerBox'));
  assert.equal(audit.length,2);assert.ok(audit.every(r=>r.action==='PRODUCT_EDITED'&&r.previousPrice===r.newPrice));
  assert.ok(audit.every(r=>r.changes!.find(c=>c.field==='unitsPerBox')!.previous===null&&r.changes!.find(c=>c.field==='unitsPerBox')!.next===8));
  const backup=await db.exportData();assert.equal(backup.productFamilies![0].unitsPerBox,8);assert.deepEqual(snapshots(backup),snapshots(original));
  await assert.rejects(db.update(d=>{saveBaseProduct(d,edit(d,0));}));assert.deepEqual(await db.exportData(),backup);
  const target=await PosDatabase.open(crypto.randomUUID());try{await target.restore(backup);const restored=await target.exportData();assert.equal(groups(restored).find(f=>f.id==='escoces')!.boxEquivalence!.totalBoxes,4.5);assert.deepEqual(restored.productFamilies,backup.productFamilies);}finally{target.close();}
  await db.update(d=>{saveBaseProduct(d,edit(d,12));});audit=(await db.queryPriceAudit(1)).rows.filter(r=>r.source==='PRODUCT_EDIT'&&r.changes?.some(c=>c.field==='unitsPerBox'));
  assert.equal(audit.length,4);assert.ok(audit.slice(0,2).every(r=>r.changes!.some(c=>c.field==='unitsPerBox'&&c.previous===8&&c.next===12)));
 }finally{db.close();}
 const reopened=await PosDatabase.open(name);try{assert.equal((await reopened.exportData()).productFamilies![0].unitsPerBox,12);}finally{reopened.close();}
});
