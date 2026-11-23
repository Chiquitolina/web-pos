import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyData, Data } from '../src/app/core/models';
import { saveProduct, deleteProduct, renameCategory, deleteCategory, migrateCatalog, catalogCategories } from '../src/app/core/catalog';
import { addCategory, migrateCategories } from '../src/app/core/categories';
import { validateData, closeSession } from '../src/app/core/domain';
import { beginWeek, finishWeek, weekReport } from '../src/app/core/weeks';
import { weeklyCsv } from '../src/app/core/weekly-csv';
function fixture():Data {
 const d=emptyData();d.sessions.push({id:'cash',openedAt:'2026-10-05T12:00:00Z',opening:0,movements:[]});
 d.sales.push({id:'s',number:1,sessionId:'cash',at:'2026-10-06T12:00:00Z',payment:'CASH',received:850000,change:0,total:850000,items:[{productId:'p5',name:'Bombón Escocés',gridoName:'Bombón Escocés x8U',category:'Envasados',categoryGridoName:'Postres envasados',quantity:1,unitPrice:850000,subtotal:850000}]});
 beginWeek(d,'w1','2026-10-05','2026-10-07T12:00:00Z');d.sessions[0].closing=closeSession(d,d.sessions[0],850000,undefined,'2026-10-07T14:00:00Z');finishWeek(d,'w1','w2','2026-10-07T15:00:00Z');return d;
}
test('edición de producto conserva ID, permite ambos nombres/precio/categoría y no toca ventas',()=>{
 const d=fixture(),history=structuredClone({sales:d.sales,sessions:d.sessions,weeks:d.weeks});const original=d.products.find(p=>p.id==='p5')!;
 const edited=saveProduct(d,'p5',{name:'Bombón',gridoName:'Bombón Escocés x8U NUEVO',category:'Granel',price:999999});assert.equal(edited.id,original.id);assert.equal(edited.price,999999);assert.equal(edited.name,'Bombón');assert.equal(edited.category,'Granel');assert.equal(d.products.length,6);
 assert.deepEqual({sales:d.sales,sessions:d.sessions,weeks:d.weeks},history);assert.doesNotThrow(()=>validateData(d));
});
test('producto eliminado queda archivado; snapshot, reportes, CSV y backup siguen conciliados',()=>{
 const d=fixture();const prior=structuredClone(d.weeks[0].closing);deleteProduct(d,'p5','2026-10-07T16:00:00Z');const p=d.products.find(p=>p.id==='p5')!;assert.equal(p.active,false);assert.ok(p.deletedAt);assert.equal(weekReport(d,d.weeks[0]).total,850000);assert.deepEqual(d.weeks[0].closing,prior);
 const csv=weeklyCsv(d.weeks[0],d);assert.ok(csv.includes('"producto_grido"'));assert.ok(csv.includes('"categoria_grido"'));assert.ok(csv.includes('"Bombón Escocés x8U"'));assert.ok(csv.includes('"Postres envasados"'));
 assert.deepEqual(validateData(JSON.parse(JSON.stringify(d))),d);assert.throws(()=>saveProduct(d,'p5',{name:'X',gridoName:'X',category:'Granel',price:100}));
});
test('categoría se renombra con ambos nombres; productos cambian sin alterar historial',()=>{
 const d=fixture();const history=structuredClone(d.sales);const c=renameCategory(d,'c1','Postres','Postres envasados xU');assert.equal(c.id,'c1');assert.equal(c.gridoName,'Postres envasados xU');assert.ok(d.categories.includes('Postres'));assert.ok(!d.categories.includes('Envasados'));assert.equal(d.products.find(p=>p.id==='p5')!.category,'Postres');assert.deepEqual(d.sales,history);assert.doesNotThrow(()=>validateData(d));
 const snap=structuredClone(d);assert.throws(()=>renameCategory(d,'c1','GRANEL','Otro'));assert.deepEqual(d,snap);
});
test('eliminar categoría ocupada requiere reasignación y no resucita al migrar',()=>{
 const d=fixture();assert.throws(()=>deleteCategory(d,'c1'));assert.throws(()=>deleteCategory(d,'c1','c1'));deleteCategory(d,'c1','c0','2026-10-07T16:00:00Z');assert.equal(d.products.find(p=>p.id==='p5')!.category,'Granel');assert.equal(d.categoryDetails!.find(c=>c.id==='c1')!.deletedAt,'2026-10-07T16:00:00Z');assert.deepEqual(d.categories,['Granel']);assert.doesNotThrow(()=>validateData(d));
 assert.deepEqual(migrateCatalog(migrateCategories(d)).categories,['Granel']);assert.equal(d.sales[0].items[0].category,'Envasados');
});
test('categoría sin productos se puede eliminar y los productos archivados no la recrean',()=>{
 const d=fixture();deleteProduct(d,'p5','2026-10-07T16:00:00Z');deleteCategory(d,'c1',undefined,'2026-10-07T16:01:00Z');const migrated=migrateCatalog(migrateCategories(d));assert.deepEqual(migrated.categories,['Granel']);assert.equal(catalogCategories(migrated).length,1);assert.doesNotThrow(()=>validateData(d));
 addCategory(d,'Envasados','Nuevos envasados','new-id');assert.equal(catalogCategories(d).find(c=>c.name==='Envasados')!.id,'new-id');assert.doesNotThrow(()=>validateData(d));
});
test('backup antiguo sin metadatos migra manteniendo categorías y nombres de ventas',()=>{
 const d:any=fixture();delete d.categoryDetails;for(const p of d.products)delete p.gridoName;const restored=validateData(d);assert.equal(catalogCategories(restored).length,2);assert.ok(catalogCategories(restored).every(c=>c.name===c.gridoName));assert.deepEqual(restored.sales,d.sales);assert.deepEqual(restored.weeks,d.weeks);
});
test('valida nombres Grido, catálogo inconsistente y eliminaciones inválidas',()=>{
 const d=emptyData();assert.throws(()=>saveProduct(d,'new',{name:'X',gridoName:' ',category:'Granel',price:100}));assert.throws(()=>saveProduct(d,'new',{name:'X',gridoName:'X',category:'No existe',price:100}));assert.throws(()=>renameCategory(d,'c0',' ','X'));
 d.categoryDetails![0].gridoName=' ';assert.throws(()=>validateData(d));d.categoryDetails![0].gridoName='Granel';d.products[0].deletedAt='2026-10-07';assert.throws(()=>validateData(d));
});
