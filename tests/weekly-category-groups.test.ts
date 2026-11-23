import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sale } from '../src/app/core/models';
import { summarizeSales } from '../src/app/core/weeks';
import { weeklyCategoryGroups } from '../src/app/core/weekly-category-groups';
const sale:Sale={id:'s1',number:1,sessionId:'cash',at:'2026-10-10T12:00:00.000Z',payment:'CASH',total:700,received:700,change:0,items:[{productId:'p',name:'Bocha original',category:'Granel',categoryGridoName:'GRANEL',quantity:2,unitPrice:100,subtotal:200},{productId:'p',name:'Bocha con otro código histórico',category:'Granel',categoryGridoName:'ANTERIOR',quantity:1,unitPrice:100,subtotal:100},{productId:'p2',name:'Bombón',category:'Envasados',quantity:1,unitPrice:400,subtotal:400}]};
test('agrupa productos por categoría y código histórico, conservando subtotales y snapshots',()=>{
 const report=summarizeSales([sale]),before=structuredClone(report),groups=weeklyCategoryGroups(report);
 assert.equal(groups.length,3);assert.equal(groups.find(g=>g.category.gridoName==='GRANEL')!.products[0].name,'Bocha original');assert.equal(groups.find(g=>g.category.gridoName==='ANTERIOR')!.products[0].name,'Bocha con otro código histórico');assert.equal(groups.find(g=>g.category.name==='Envasados')!.products[0].name,'Bombón');
 for(const g of groups){assert.equal(g.products.reduce((n,p)=>n+p.total,0),g.category.total);assert.equal(g.products.reduce((n,p)=>n+p.quantity,0),g.category.quantity);}
 assert.equal(groups.flatMap(g=>g.products).length,report.products.length);assert.equal(groups.reduce((n,g)=>n+g.category.total,0),report.total);assert.deepEqual(report,before);
});
test('ventas anuladas y reportes vacíos no crean grupos ni productos vigentes',()=>{
 const report=summarizeSales([{...sale,cancellation:{at:'2026-10-10T13:00:00.000Z',reason:'Duplicado'}}]);assert.deepEqual(weeklyCategoryGroups(report),[]);assert.deepEqual(weeklyCategoryGroups(summarizeSales([])),[]);
});
