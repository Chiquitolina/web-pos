import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Data, emptyData } from '../src/app/core/models';
import { catalogEntries, groupExistingProducts, separateProductGroup, deleteProductGroup, ExistingProductGroupDraft } from '../src/app/core/catalog-groups';
import { weeklyCategoryGroups } from '../src/app/core/weekly-category-groups';
import { summarizeSales } from '../src/app/core/weeks';
import { closeSession, validateData } from '../src/app/core/domain';
import { exportCatalog, importCatalog } from '../src/app/core/catalog-transfer';
import { PosDatabase } from '../src/app/core/indexed-db';
import { saveBaseProduct } from '../src/app/core/product-presentations';

function fixture():Data {
 const d=emptyData();
 d.products=[
  {id:'box',name:'Bombón Escocés caja',gridoName:'ESCOCES x8U',category:'Envasados',price:1080000,active:true,vatRate:21,iceCreamGrams:800},
  {id:'unit',name:'Escocés individual',gridoName:'ESCOCES 1U',category:'Envasados',price:150000,active:false,iceCreamGrams:100},
  {id:'water',name:'Palito frutilla agua',category:'Envasados',price:100000,active:true},
  {id:'cream',name:'Palito frutilla crema',gridoName:'CREMA 1U',category:'Envasados',price:130000,active:true},
  {id:'kg',name:'1 kg',gridoName:'HELADO 1KG',category:'Granel',price:1800000,active:true,iceCreamGrams:1000}
 ];
 d.weeks=[{id:'week',startedAt:'2026-11-09T03:00:00Z'}];
 d.sessions=[{id:'turn',openedAt:'2026-11-09T12:00:00Z',opening:0,movements:[{id:'in',at:'2026-11-09T12:01:00Z',type:'IN',amount:10000,reason:'Cambio'}]}];
 const items=d.products.slice(0,2).map(p=>({productId:p.id,name:p.name,gridoName:p.gridoName,category:p.category,quantity:2,unitPrice:p.price,subtotal:p.price*2}));
 const total=items.reduce((sum,i)=>sum+i.subtotal,0);
 d.sales=[{id:'sale',number:3,sessionId:'turn',weekId:'week',at:'2026-11-09T13:00:00Z',items,total,payment:'CASH',received:total,change:0}];
 d.sessions[0].closing=closeSession(d,d.sessions[0],total+10000,undefined,'2026-11-09T14:00:00Z');
 d.weeks[0].closing={at:'2026-11-10T03:00:00Z',report:summarizeSales(d.sales)};
 d.weeks.push({id:'next-week',startedAt:d.weeks[0].closing.at});
 return d;
}
const draft:ExistingProductGroupDraft={name:'Bombón Escocés',category:'Envasados',boxProductId:'box',unitProductId:'unit'};
const operational=(d:Data)=>structuredClone({sales:d.sales,sessions:d.sessions,weeks:d.weeks});

test('agrupa dos IDs existentes y conserva exactamente nombres, códigos, precios, estado y snapshots',()=>{
 const d=fixture(),original=structuredClone(d.products),before=operational(d);
 const id=groupExistingProducts(d,draft,()=>'base');
 assert.equal(id,'base');assert.equal(d.products.length,original.length);
 assert.deepEqual(d.products.slice(0,2),original.slice(0,2).map((p,i)=>({...p,familyId:'base',presentation:i?'Unidad':'Caja'})));
 assert.deepEqual(d.products.slice(2),original.slice(2));assert.deepEqual(operational(d),before);
 const report=weeklyCategoryGroups(before.weeks[0].closing!.report,d)[0];
 assert.equal(report.families[0].name,'Bombón Escocés');assert.deepEqual(report.families[0].products.map(p=>p.id),['box','unit']);
 assert.equal(report.families[0].total,d.sales[0].total);assert.doesNotThrow(()=>validateData(d));
});

test('permite agrupar solo uno y vincular el segundo después sin copiar ni reactivar productos',()=>{
 const d=fixture(),original=structuredClone(d.products);
 groupExistingProducts(d,{...draft,unitProductId:undefined},()=>'base');
 assert.equal(d.products[1].familyId,undefined);
 groupExistingProducts(d,{...draft,familyId:'base'});
 groupExistingProducts(d,{...draft,familyId:'base'});
 assert.equal(d.productFamilies!.length,1);assert.equal(d.products.length,original.length);
 assert.equal(d.products[1].id,'unit');assert.equal(d.products[1].active,false);
 assert.equal(catalogEntries(d,'Envasados').length,3);
});

test('rechaza selecciones repetidas, de otra categoría, eliminadas o de otro grupo sin cambios parciales',()=>{
 for(const request of [
  {...draft,unitProductId:'box'}, {...draft,unitProductId:'kg'}, {...draft,unitProductId:'missing'},
  {...draft,boxProductId:undefined,unitProductId:undefined}, {...draft,name:' '}
 ]){const d=fixture(),before=structuredClone(d);assert.throws(()=>groupExistingProducts(d,request,()=>'base'));assert.deepEqual(d,before);}
 const d=fixture();groupExistingProducts(d,draft,()=>'base');const before=structuredClone(d);
 assert.throws(()=>groupExistingProducts(d,{name:'Otro',category:'Envasados',boxProductId:'box'},()=>'other'),/agrupado/);
 assert.deepEqual(d,before);
});

test('un formulario viejo no sustituye ni omite una presentación ya vinculada',()=>{
 const d=fixture();groupExistingProducts(d,draft,()=>'base');const before=structuredClone(d);
 for(const request of [{...draft,familyId:'base',unitProductId:'water'},{...draft,familyId:'base',unitProductId:undefined},{...draft,familyId:'deleted'}]){
  assert.throws(()=>groupExistingProducts(d,request));assert.deepEqual(d,before);
 }
 assert.throws(()=>groupExistingProducts(d,{name:'bombón escocés',category:'Envasados',boxProductId:'water'},()=>'new'),/existe/);
 assert.deepEqual(d,before);
});

test('no agrupa por palabras parecidas y no usa IDs duplicados para crear la ficha',()=>{
 const d=fixture(),before=structuredClone(d);
 assert.throws(()=>groupExistingProducts(d,draft,()=>'box'),/ID/);assert.deepEqual(d,before);
 groupExistingProducts(d,{name:'Palito frutilla agua',category:'Envasados',unitProductId:'water'},()=>'water-base');
 assert.equal(d.products.find(p=>p.id==='cream')!.familyId,undefined);
 assert.equal(catalogEntries(d,'Envasados').filter(e=>e.products.some(p=>p.id==='water')).length,1);
});

test('editar una agrupación antigua con categorías mezcladas no mueve productos silenciosamente',()=>{
 const d=fixture();groupExistingProducts(d,draft,()=>'base');d.products.find(p=>p.id==='unit')!.category='Granel';
 const before=structuredClone(d);
 assert.throws(()=>saveBaseProduct(d,{baseName:'Bombón Escocés',familyId:'base',category:'Envasados',rows:[
  {kind:'Caja',active:true,productId:'box',name:'Nuevo nombre',gridoName:'NUEVO',price:100},
  {kind:'Unidad',active:false,productId:'unit',name:'Escocés individual',gridoName:'ESCOCES 1U',price:0}
 ]}),/distintas categorías/);
 assert.deepEqual(d,before);
});

test('separar una agrupación mantiene productos, ventas y estados; permite volver a agruparlos',()=>{
 const d=fixture(),original=structuredClone(d.products),before=operational(d);
 groupExistingProducts(d,draft,()=>'base');separateProductGroup(d,'base','2026-11-15T12:00:00Z');
 assert.deepEqual(d.products,original);assert.deepEqual(operational(d),before);
 assert.equal(d.productFamilies![0].deletedAt,'2026-11-15T12:00:00Z');assert.equal(catalogEntries(d,'Envasados').length,4);
 groupExistingProducts(d,draft,()=>'new-base');assert.equal(d.products[0].familyId,'new-base');assert.doesNotThrow(()=>validateData(d));
});

test('eliminar ficha archiva todas sus presentaciones, conservando historia y agrupación histórica',()=>{
 const d=fixture(),before=operational(d);groupExistingProducts(d,draft,()=>'base');
 deleteProductGroup(d,'base','2026-11-15T12:00:00Z');
 assert.ok(d.products.slice(0,2).every(p=>p.deletedAt==='2026-11-15T12:00:00Z'&&!p.active));
 assert.deepEqual(operational(d),before);assert.equal(catalogEntries(d,'Envasados').length,2);
 assert.equal(weeklyCategoryGroups(before.weeks[0].closing!.report,d)[0].families[0].name,'Bombón Escocés');
 assert.doesNotThrow(()=>validateData(d));
 const latest=structuredClone(d);assert.throws(()=>separateProductGroup(d,'missing'));assert.deepEqual(d,latest);
});

test('la lista muestra cada SKU una sola vez, incluye inactivos y busca dentro de nombres y códigos',()=>{
 const d=fixture();groupExistingProducts(d,draft,()=>'base');
 const entries=catalogEntries(d,'Envasados');
 assert.deepEqual(entries.map(e=>e.name),['Bombón Escocés','Palito frutilla agua','Palito frutilla crema']);
 assert.deepEqual(entries.flatMap(e=>e.products.map(p=>p.id)).sort(),['box','cream','unit','water']);
 assert.equal(catalogEntries(d,'Envasados','escoces 1u')[0].key,'group:base');
 assert.equal(catalogEntries(d,'Envasados','individual')[0].products[1].active,false);
 assert.equal(catalogEntries(d,'Granel').length,1);assert.equal(catalogEntries(d,'Granel','Escocés').length,0);
 // Older catalogs may have an empty base or custom presentations. Both remain visible.
 d.productFamilies!.push({id:'empty',name:'Pendiente'},{id:'custom',name:'Pack especial',category:'Envasados'});
 d.products[2].familyId='custom';d.products[2].presentation='Pack de 3';
 assert.equal(catalogEntries(d,'Granel').some(e=>e.key==='group:empty'),true);
 assert.equal(catalogEntries(d,'Envasados').some(e=>e.key==='group:empty'),false);
 assert.equal(catalogEntries(d,'Envasados').find(e=>e.key==='group:custom')!.products[0].presentation,'Pack de 3');
});

test('exportación de catálogo transporta la agrupación y la reimportación mantiene IDs locales',()=>{
 const d=fixture();groupExistingProducts(d,draft,()=>'base');const before=structuredClone(d),file=exportCatalog(d);
 assert.deepEqual(file.families,[{name:'Bombón Escocés',category:'Envasados'}]);
 importCatalog(d,file);assert.deepEqual(d.products,before.products.map(p=>({...p,gridoName:p.gridoName??p.name})));assert.deepEqual(operational(d),operational(before));
 const other=emptyData();importCatalog(other,file);const entries=catalogEntries(other,'Envasados');
 const base=entries.find(e=>e.name==='Bombón Escocés')!;assert.deepEqual(base.products.map(p=>[p.name,p.gridoName,p.price,p.active]),before.products.slice(0,2).map(p=>[p.name,p.gridoName,p.price,p.active]));
});

test('agrupación y separación se auditan en la misma transacción, sin falsos cambios de precio',async()=>{
 const db=await PosDatabase.open(crypto.randomUUID());
 try{
  await db.restore(fixture());const original=await db.exportData();
  await db.update(d=>{groupExistingProducts(d,draft,()=>'base');},{priceSource:'FAMILY_EDIT'});
  let entries=(await db.queryPriceAudit(1)).rows.filter(r=>r.source==='FAMILY_EDIT');
  assert.equal(entries.length,2);assert.ok(entries.every(r=>r.action==='PRODUCT_EDITED'&&r.previousPrice===r.newPrice));
  assert.ok(entries.every(r=>r.changes!.some(c=>c.field==='familyId')&&r.changes!.some(c=>c.field==='presentation')));
  const grouped=await db.exportData();
  await assert.rejects(db.update(d=>{groupExistingProducts(d,{...draft,familyId:'base',unitProductId:'water'});},{priceSource:'FAMILY_EDIT'}));
  assert.deepEqual(await db.exportData(),grouped);
  await db.update(d=>separateProductGroup(d,'base'),{priceSource:'FAMILY_EDIT'});
  const separated=await db.exportData();entries=(await db.queryPriceAudit(1)).rows.filter(r=>r.source==='FAMILY_EDIT');
  assert.equal(entries.length,4);assert.deepEqual(separated.products,original.products);assert.deepEqual(operational(separated),operational(original));
 }finally{db.close();}
});
