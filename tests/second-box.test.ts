import 'fake-indexeddb/auto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Data,emptyData} from '../src/app/core/models';
import {saveBaseProduct,BaseProductDraft} from '../src/app/core/product-presentations';
import {groupExistingProducts} from '../src/app/core/catalog-groups';
import {weeklyCategoryGroups} from '../src/app/core/weekly-category-groups';
import {weeklyConsumptionReport} from '../src/app/core/weekly-consumption-report';
import {finishWeek} from '../src/app/core/weeks';
import {cancelSale} from '../src/app/core/cancellations';
import {weeklyCsv} from '../src/app/core/weekly-csv';
import {validateData} from '../src/app/core/domain';
import {exportCatalog,importCatalog,validateCatalogFile} from '../src/app/core/catalog-transfer';
import {PosDatabase} from '../src/app/core/indexed-db';
import {boxEquivalence} from '../src/app/core/box-equivalents';
import {boxUnits,presentationCaption} from '../src/app/core/presentation-kinds';

function request():BaseProductDraft {return {baseName:'Palito frutilla',category:'Envasados',unitsPerBox:20,boxesPerPack:6,rows:[{kind:'Caja',active:true,name:'Palito caja x20',gridoName:'PALITO X20',price:2000000},{kind:'Caja 2',active:true,name:'Palito caja x10',gridoName:'PALITO X10',price:1100000,unitsPerBox:10},{kind:'Unidad',active:true,name:'Palito individual',gridoName:'PALITO 1U',price:120000}]};}
function fixture():Data {const d=emptyData();d.products=[];let n=0;const {familyId}=saveBaseProduct(d,request(),()=> 'new-'+ ++n);d.weeks=[{id:'week',startedAt:'2026-11-09T03:00:00Z'}];d.sessions=[{id:'turn',openedAt:'2026-11-09T12:00:00Z',opening:0,movements:[]}];d.sales=d.products.map((p,n)=>{const quantity=p.presentation==='Unidad'?2:1,total=p.price*quantity;return {id:'s'+n,number:n+1,sessionId:'turn',weekId:'week',at:`2026-11-09T13:0${n}:00Z`,items:[{productId:p.id,name:p.name,gridoName:p.gridoName,category:p.category,quantity,unitPrice:p.price,subtotal:total}],total,payment:'CASH',received:total,change:0};});assert.equal(familyId,'new-1');return d;}
const current=(d:Data)=>weeklyCategoryGroups(weeklyConsumptionReport(d,d.weeks[0]),d)[0].families[0];
const operations=(d:Data)=>structuredClone({sales:d.sales,sessions:d.sessions,weeks:d.weeks});
function edit(d:Data):BaseProductDraft {return {...request(),familyId:d.productFamilies![0].id,rows:request().rows.map(r=>{const p=d.products.find(p=>p.familyId===d.productFamilies![0].id&&p.presentation===r.kind&&!p.deletedAt);return {...r,...(p?{productId:p.id,name:p.name,gridoName:p.gridoName!,price:p.price,active:p.active,unitsPerBox:p.unitsPerBox}: {})};})};}
const csvRows=(csv:string)=>{const rows=csv.slice(1).trim().split('\r\n').map(l=>l.split(';').map(c=>JSON.parse(c)));return rows.slice(1).map(row=>Object.fromEntries(rows[0].map((name,i)=>[name,row[i]])));};

test('una familia admite caja principal, segunda caja y unidad con precios, códigos y tamaños independientes',()=>{
 const d=fixture();assert.equal(d.products.length,3);assert.equal(d.productFamilies!.length,1);assert.deepEqual(d.products.map(p=>[p.presentation,p.price,p.gridoName,p.unitsPerBox]),[['Caja',2000000,'PALITO X20',undefined],['Caja 2',1100000,'PALITO X10',10],['Unidad',120000,'PALITO 1U',undefined]]);assert.doesNotThrow(()=>validateData(d));
 assert.equal(presentationCaption('Caja 2',10),'Segunda caja · 10 unidades');assert.equal(boxUnits(d.products[0],d.productFamilies![0]),20);assert.equal(boxUnits(d.products[1],d.productFamilies![0]),10);
});

test('1 caja de 20 + 1 de 10 + 2 individuales son 32 unidades, 1,6 cajas de referencia y 32/120 packs',()=>{
 const d=fixture(),before=structuredClone(d),r=current(d);assert.equal(r.boxEquivalence!.boxes,2);assert.equal(r.boxEquivalence!.looseUnits,2);assert.equal(r.boxEquivalence!.totalUnits,32);assert.equal(r.boxEquivalence!.totalBoxes,1.6);assert.equal(r.boxEquivalence!.totalPacks,1.6/6);assert.deepEqual(r.products.map(p=>[p.presentation,p.quantity,p.unitsPerBox]),[['Caja',1,20],['Caja 2',1,10],['Unidad',2,undefined]]);assert.deepEqual(d,before);
});

test('desactivar y reactivar la segunda caja reutiliza ID, precio, código y tamaño y no altera lo vendido',()=>{
 const d=fixture(),before=operations(d),original=structuredClone(d.products[1]);for(let n=0;n<2;n++){let draft=edit(d);draft.rows[1].active=false;draft.rows[1].price=0;saveBaseProduct(d,draft);assert.deepEqual(d.products[1],{...original,active:false});assert.equal(current(d).boxEquivalence!.totalUnits,32);draft=edit(d);draft.rows[1].active=true;saveBaseProduct(d,draft);assert.deepEqual(d.products[1],original);}assert.deepEqual(operations(d),before);assert.equal(d.products.length,3);
});

test('un draft anterior de dos opciones conserva la segunda caja existente en vez de borrarla o duplicarla',()=>{
 const d=fixture(),original=structuredClone(d.products[1]),draft=edit(d);draft.rows=draft.rows.filter(r=>r.kind!=='Caja 2');saveBaseProduct(d,draft);assert.deepEqual(d.products[1],original);assert.equal(d.products.length,3);
});

test('segunda caja exige capacidad y precio válidos y revierte también los cambios de la primera opción',()=>{
 for(const value of [undefined,null,0,-1,2.5,'10',Number.MAX_SAFE_INTEGER+1]){const d=fixture(),before=structuredClone(d),draft=edit(d);draft.baseName='No guardar';draft.unitsPerBox=30;draft.rows[0].price=9000000;draft.rows[1].unitsPerBox=value as number;assert.throws(()=>saveBaseProduct(d,draft),/segunda caja/);assert.deepEqual(d,before);}
 const d=fixture(),before=structuredClone(d),draft=edit(d);draft.rows[1].price=0;assert.throws(()=>saveBaseProduct(d,draft),/Precio/);assert.deepEqual(d,before);
});

test('IDs y roles obsoletos o duplicados no sustituyen silenciosamente la segunda caja',()=>{
 const d=fixture(),before=structuredClone(d),draft=edit(d);draft.rows[1].productId=d.products[0].id;assert.throws(()=>saveBaseProduct(d,draft),/Cambió/);assert.deepEqual(d,before);
 const repeated=edit(d);repeated.rows[2].kind='Caja 2';assert.throws(()=>saveBaseProduct(d,repeated));assert.deepEqual(d,before);
});

test('vincular una caja existente recalcula ventas anteriores de ese ID y conserva todos sus datos comerciales',()=>{
 const d=fixture(),second=d.products[1],id=second.id;delete second.familyId;delete second.presentation;delete second.unitsPerBox;const original=structuredClone(second),before=operations(d),f=d.productFamilies![0];
 groupExistingProducts(d,{name:f.name,category:'Envasados',familyId:f.id,boxProductId:d.products[0].id,unitProductId:d.products[2].id,secondBoxProductId:id,secondBoxUnitsPerBox:10});
 assert.deepEqual(d.products.find(p=>p.id===id),{...original,familyId:f.id,presentation:'Caja 2',unitsPerBox:10});assert.equal(current(d).boxEquivalence!.totalUnits,32);assert.deepEqual(operations(d),before);
});

test('la selección de tres productos es atómica y no permite repetir el mismo SKU en dos posiciones',()=>{
 const d=fixture(),f=d.productFamilies![0],before=structuredClone(d);
 assert.throws(()=>groupExistingProducts(d,{name:f.name,category:'Envasados',familyId:f.id,boxProductId:d.products[0].id,unitProductId:d.products[2].id,secondBoxProductId:d.products[0].id,secondBoxUnitsPerBox:10}),/distintos/);assert.deepEqual(d,before);
 assert.throws(()=>groupExistingProducts(d,{name:f.name,category:'Envasados',familyId:f.id,boxProductId:d.products[0].id,unitProductId:d.products[2].id,secondBoxProductId:d.products[1].id,secondBoxUnitsPerBox:0}),/segunda caja/);assert.deepEqual(d,before);
});

test('una Caja 2 antigua sin capacidad puede abrirse, se muestra como parcial y no se estima por su nombre',()=>{
 const d=fixture();delete d.products[1].unitsPerBox;assert.doesNotThrow(()=>validateData(d));const r=current(d).boxEquivalence!;assert.equal(r.partial,true);assert.equal(r.unconvertedUnits,1);assert.equal(r.totalUnits,22);assert.equal(r.totalBoxes,1.1);d.products[1].unitsPerBox=10;assert.equal(current(d).boxEquivalence!.totalUnits,32);
 assert.throws(()=>boxEquivalence([{presentation:'Caja 2',quantity:1,unitsPerBox:0}],20,6),/inválidas/);
});

test('CSV conserva columnas anteriores y exporta la capacidad real de cada caja, con totales netos correctos',()=>{
 const d=fixture();finishWeek(d,'week','next','2026-11-10T03:00:00Z');const original=structuredClone(d.weeks[0].closing);let rows=csvRows(weeklyCsv(d.weeks[0],d));const second=rows.find(r=>r.tipo==='PRODUCTO'&&r.presentacion==='Caja 2')!;
 assert.equal(second.unidades_por_caja_presentacion,'10');assert.equal(second.unidades_por_caja,'20');assert.equal(second.unidades_totales_equivalentes,'10');assert.equal(second.cajas_totales,'0,5');let family=rows.find(r=>r.tipo==='FAMILIA')!;assert.equal(family.unidades_totales_equivalentes,'32');assert.equal(family.cajas_totales,'1,6');
 cancelSale(d,'s1','Prueba','2026-11-10T12:00:00Z');rows=csvRows(weeklyCsv(d.weeks[0],d));family=rows.find(r=>r.tipo==='FAMILIA')!;assert.equal(family.unidades_totales_equivalentes,'22');assert.equal(family.cajas_totales,'1,1');assert.deepEqual(d.weeks[0].closing,original);assert.doesNotThrow(()=>validateData(d));
});

test('catálogo portable transporta ambas cajas y reimportar mantiene IDs y snapshots locales',()=>{
 const d=fixture(),before=structuredClone(d),file=exportCatalog(d);assert.deepEqual(validateCatalogFile(file),file);const second=file.products.find(p=>p.presentation==='Caja 2')!;assert.equal(second.unitsPerBox,10);importCatalog(d,file);assert.deepEqual(d,before);
 const target=emptyData();importCatalog(target,file);assert.equal(target.products.find(p=>p.presentation==='Caja 2')!.unitsPerBox,10);assert.equal(target.productFamilies![0].unitsPerBox,20);
 const invalid=structuredClone(file);invalid.products.find(p=>p.presentation==='Caja 2')!.unitsPerBox=0;assert.throws(()=>importCatalog(d,invalid),/Unidades/);assert.deepEqual(d,before);
});

test('auditoría y respaldo preservan capacidad propia y referencia; restauración y recarga no cambian IDs',async()=>{
 const name=crypto.randomUUID(),db=await PosDatabase.open(name);
 try{await db.restore(fixture());const before=operations(await db.exportData());await db.update(d=>{const draft=edit(d);draft.rows[1].unitsPerBox=12;saveBaseProduct(d,draft);});const records=(await db.queryPriceAudit(1)).rows.filter(r=>r.source==='PRODUCT_EDIT');assert.equal(records.length,1);assert.equal(records[0].action,'PRODUCT_EDITED');assert.ok(records[0].changes!.some(c=>c.field==='unitsPerBox'&&c.previous===10&&c.next===12));
 await db.update(d=>{const draft=edit(d);draft.unitsPerBox=30;saveBaseProduct(d,draft);});const backup=await db.exportData();assert.deepEqual(operations(backup),before);assert.equal(backup.products[1].unitsPerBox,12);assert.ok(backup.priceAudit!.some(r=>r.productId===backup.products[1].id&&r.changes?.some(c=>c.field==='referenceUnitsPerBox'&&c.previous===20&&c.next===30)));const target=await PosDatabase.open(crypto.randomUUID());try{await target.restore(backup);assert.deepEqual((await target.exportData()).products,backup.products);}finally{target.close();}}finally{db.close();}
 const reopened=await PosDatabase.open(name);try{assert.equal((await reopened.exportData()).products[1].unitsPerBox,12);}finally{reopened.close();}
});
