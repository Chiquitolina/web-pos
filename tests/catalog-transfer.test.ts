import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyData } from '../src/app/core/models';
import { exportCatalog, importCatalog, validateCatalogFile } from '../src/app/core/catalog-transfer';
import { PosDatabase } from '../src/app/core/indexed-db';
import { closeSession, validateData } from '../src/app/core/domain';
const ids=()=>{let n=0;return ()=>'import-'+n++;};
test('exportar productos incluye categorías vacías, nombres Grido e IVA y excluye operación y eliminados',()=>{
 const d=emptyData();d.categories.push('Sin productos');d.categoryDetails!.push({id:'empty',name:'Sin productos',gridoName:'VACÍA'});d.products[0].vatRate=21;d.products[1].active=false;d.products[2].active=false;d.products[2].deletedAt=new Date().toISOString();d.sessions.push({id:'live',openedAt:new Date().toISOString(),opening:0,movements:[]});
 const file=exportCatalog(d);assert.deepEqual(Object.keys(file).sort(),['categories','exportedAt','format','products','version']);assert.equal(file.products.length,5);assert.equal(file.categories.at(-1)!.name,'Sin productos');assert.equal(file.products[0].vatRate,21);assert.equal(file.products[1].active,false);assert.ok(!('id' in file.products[0]));assert.deepEqual(validateCatalogFile(file),file);
});
test('reemplazar dos veces es estable, actualiza por código y archiva productos ausentes',()=>{
 const source=emptyData();source.products[0].name='Nombre nuevo';source.products[0].price=99900;source.products[0].vatRate=10.5;source.products[0].active=false;
 const local=emptyData();local.products.forEach(p=>p.id='local-'+p.id);local.products.push({id:'extra',name:'Extra',gridoName:'Extra',category:'Granel',price:100,active:true});
 assert.deepEqual(importCatalog(local,exportCatalog(source),ids()),{added:0,updated:6,removedProducts:1,removedCategories:0});assert.equal(local.products[0].id,'local-p0');assert.equal(local.products[0].name,'Nombre nuevo');assert.equal(local.products[0].price,99900);assert.equal(local.products[0].vatRate,10.5);assert.equal(local.products[0].active,false);
 assert.deepEqual(importCatalog(local,exportCatalog(source),ids()),{added:0,updated:6,removedProducts:0,removedCategories:0});assert.equal(local.products.length,7);assert.equal(exportCatalog(local).products.length,6);assert.equal(local.products.at(-1)!.id,'extra');assert.equal(local.products.at(-1)!.active,false);assert.ok(local.products.at(-1)!.deletedAt);
});
test('IDs de otra heladería no pisan productos diferentes; reimportar conserva el nuevo ID',()=>{
 const source=emptyData();source.products=[{id:'p0',name:'Postre nuevo',gridoName:'Postre x8U',category:'Envasados',price:999,active:true}];const local=emptyData();const before=structuredClone(local.products[0]);
 assert.deepEqual(importCatalog(local,exportCatalog(source),ids()),{added:1,updated:0,removedProducts:6,removedCategories:0});assert.equal(local.products[0].id,'import-0');const old=local.products.find(p=>p.id===before.id)!;assert.equal(old.name,before.name);assert.equal(old.price,before.price);assert.equal(old.active,false);assert.ok(old.deletedAt);assert.deepEqual(importCatalog(local,exportCatalog(source),ids()),{added:0,updated:1,removedProducts:0,removedCategories:0});assert.equal(local.products.length,7);assert.equal(exportCatalog(local).products.length,1);
});
test('validación rechaza archivos incompatibles o inválidos sin modificar catálogo',()=>{
 const local=emptyData(),before=structuredClone(local),file=exportCatalog(local);file.products[0].price=-1;assert.throws(()=>importCatalog(local,file),/Producto inválido/);assert.deepEqual(local,before);
 assert.throws(()=>validateCatalogFile(emptyData()),/no un respaldo completo/);
 const missing=exportCatalog(local);missing.products[0].category='Desconocida';assert.throws(()=>importCatalog(local,missing));assert.deepEqual(local,before);
 const duplicate=exportCatalog(local);duplicate.products.push({...duplicate.products[0]});assert.throws(()=>importCatalog(local,duplicate),/duplicados/);assert.deepEqual(local,before);
 const badVat=exportCatalog(local);badVat.products[0].vatRate=101;assert.throws(()=>importCatalog(local,badVat),/IVA/);
});
test('productos distintos con un código compartido se conservan sin sobrescribirse',()=>{
 const source=emptyData();source.products=[{id:'a',name:'Grande',gridoName:'Mismo código',category:'Granel',price:100,active:true},{id:'b',name:'Chico',gridoName:'Mismo código',category:'Granel',price:50,active:true}];const local=emptyData();assert.equal(importCatalog(local,exportCatalog(source),ids()).added,2);assert.equal(importCatalog(local,exportCatalog(source),ids()).updated,2);assert.equal(local.products.length,8);assert.equal(exportCatalog(local).products.length,2);
});
test('importación persistida no modifica ventas, caja abierta, cierres, semanas ni secuencia de tickets',async()=>{
 const d=emptyData();d.sessions=[{id:'closed',openedAt:'2026-10-08T12:00:00.000Z',opening:0,movements:[]},{id:'live',openedAt:'2026-10-09T12:00:00.000Z',opening:0,movements:[]}];d.sales=[{id:'sale1',number:1,sessionId:'closed',at:'2026-10-08T13:00:00.000Z',items:[{productId:'p0',name:d.products[0].name,category:'Granel',quantity:1,unitPrice:100,subtotal:100}],total:100,payment:'CASH',received:100,change:0}];d.sessions[0].closing=closeSession(d,d.sessions[0],100,undefined,'2026-10-08T14:00:00.000Z');
 const db=await PosDatabase.open(crypto.randomUUID());await db.restore(d);const before=await db.exportData();const source=emptyData();source.products=[{...source.products[5],price:1}];source.categories=['Envasados'];source.categoryDetails=source.categoryDetails!.filter(c=>c.name==='Envasados');await db.update(data=>{importCatalog(data,exportCatalog(source));});const after=await db.exportData();for(const key of ['sales','sessions','weeks'] as const)assert.deepEqual(after[key],before[key]);assert.equal(after.products[0].price,1);assert.deepEqual(after.categories,['Envasados']);assert.ok(after.products.find(p=>p.id==='p0')!.deletedAt);assert.ok(after.categoryDetails!.find(c=>c.id==='c0')!.deletedAt);assert.deepEqual(validateData(after),after);assert.equal((await db.view()).meta.nextSaleNumber,2);assert.equal((await db.queryHistory({kind:'all'},1)).totals.total,100);db.close();
});

test('reemplaza categorías y productos ausentes, preserva vacías y orden del archivo',()=>{
 const local=emptyData(),source=emptyData();source.categories=['Nuevas','Envasados'];source.categoryDetails=[{id:'new',name:'Nuevas',gridoName:'NUEVA'},{id:'c1',name:'Envasados',gridoName:'ENV'}];source.products=[{...source.products[5],category:'Envasados',active:false}];
 const result=importCatalog(local,exportCatalog(source),ids(),'2026-10-10T13:00:00.000Z');assert.equal(result.removedProducts,5);assert.equal(result.removedCategories,1);assert.deepEqual(local.categories,source.categories);assert.deepEqual(exportCatalog(local).categories,[{name:'Nuevas',gridoName:'NUEVA'},{name:'Envasados',gridoName:'ENV'}]);assert.equal(exportCatalog(local).products.length,1);assert.equal(local.products[0].id,'p5');assert.equal(local.products[0].active,false);assert.deepEqual(validateData(local),local);
});
test('archivo vacío reemplaza ambos catálogos y reexporta vacío sin revivir registros archivados',()=>{
 const local=emptyData(),source={...emptyData(),products:[],categories:[],categoryDetails:[]};const file=exportCatalog(source);
 assert.deepEqual(importCatalog(local,file,ids()),{added:0,updated:0,removedProducts:6,removedCategories:2});assert.deepEqual(local.categories,[]);assert.deepEqual(exportCatalog(local).products,[]);assert.deepEqual(exportCatalog(local).categories,[]);assert.deepEqual(validateData(local),local);assert.deepEqual(importCatalog(local,file,ids()),{added:0,updated:0,removedProducts:0,removedCategories:0});
});
test('duplicados locales ambiguos se archivan y el nuevo catálogo queda exactamente como el archivo',()=>{
 const local=emptyData(),source=emptyData();local.products.push({...local.products[0],id:'duplicated'});source.products=[source.products[0]];
 const result=importCatalog(local,exportCatalog(source),ids());assert.equal(result.added,1);assert.equal(result.updated,0);assert.equal(result.removedProducts,7);assert.equal(exportCatalog(local).products.length,1);assert.equal(local.products[0].id,'import-0');assert.deepEqual(validateData(local),local);
});
test('importación inválida revierte la transacción y no deja un catálogo parcialmente borrado',async()=>{
 const db=await PosDatabase.open(crypto.randomUUID());const before=await db.exportData(),file=exportCatalog(before);file.products[0].price=0;
 await assert.rejects(db.update(d=>importCatalog(d,file)),/Producto inválido/);assert.deepEqual(await db.exportData(),before);db.close();
});
