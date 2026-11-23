import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyData } from '../src/app/core/models';
import { closeSession, money, validateData } from '../src/app/core/domain';
test('cierre incluye fondo, efectivo neto, ingresos y retiros; agrupa productos',()=>{
 const d=emptyData();const s={id:'s',openedAt:new Date().toISOString(),opening:10000,movements:[{id:'m',at:new Date().toISOString(),type:'OUT' as const,amount:1000,reason:'Retiro'}]};d.sessions.push(s);
 d.sales.push({id:'v',number:1,sessionId:'s',at:new Date().toISOString(),payment:'CASH',received:10000,change:3000,total:7000,items:[{productId:'p0',name:'Bocha',category:'Granel',quantity:2,unitPrice:3500,subtotal:7000}]});
 const c=closeSession(d,s,15900);assert.equal(c.expected,16000);assert.equal(c.difference,-100);assert.equal(c.products[0].quantity,2);assert.equal(c.payments.CASH,7000);
 d.sessions[0]={...s,closing:c};assert.deepEqual(validateData(d),d);d.products[0].price=999999;assert.equal(d.sales[0].total,7000);assert.equal(d.sessions[0].closing!.total,7000);
});
test('rechaza backup manipulado y valores inválidos',()=>{assert.throws(()=>money(NaN));assert.throws(()=>money(-1));assert.equal(money(12.34),1234);const d=emptyData();d.products[0].price=-1;assert.throws(()=>validateData(d));assert.throws(()=>validateData({version:2}));});

import { emptyCashCount, cashCountTotal } from '../src/app/core/cash-count';
test('conteo suma todas las denominaciones en centavos',()=>{
 const rows=emptyCashCount();rows[0].quantity=2;rows[1].quantity=3;rows[2].quantity=4;assert.equal(cashCountTotal(rows),7800000);
 assert.equal(cashCountTotal(emptyCashCount()),0);
 for(const row of emptyCashCount()){const all=emptyCashCount();all.find(r=>r.denomination===row.denomination)!.quantity=1;assert.equal(cashCountTotal(all),row.denomination);}
});
test('rechaza cantidades fraccionarias, negativas, duplicadas e inseguras',()=>{
 for(const quantity of [-1,1.5,Infinity,NaN,Number.MAX_SAFE_INTEGER]){const rows=emptyCashCount();rows[0].quantity=quantity;assert.throws(()=>cashCountTotal(rows));}
 const rows=emptyCashCount();rows[1].denomination=rows[0].denomination;assert.throws(()=>cashCountTotal(rows));assert.throws(()=>cashCountTotal([]));
});
test('persistencia de apertura y cierre verifica y congela el desglose; sigue aceptando V1',()=>{
 const d=emptyData();const rows=emptyCashCount();rows[0].quantity=2;
 d.sessions.push({id:'count',openedAt:new Date().toISOString(),opening:cashCountTotal(rows),openingCount:structuredClone(rows),movements:[]});
 const s=d.sessions[0];s.closing=closeSession(d,s,cashCountTotal(rows),rows);rows[0].quantity=9;
 assert.equal(s.closing.cashCount![0].quantity,2);assert.equal(s.closing.difference,0);assert.deepEqual(validateData(d),d);
 s.closing.cashCount![0].quantity=3;assert.throws(()=>validateData(d));delete s.closing.cashCount;assert.doesNotThrow(()=>validateData(d));
 s.openingCount![0].quantity=3;assert.throws(()=>validateData(d));delete s.openingCount;assert.doesNotThrow(()=>validateData(d));
 assert.throws(()=>closeSession(d,{...s,closing:undefined},1,emptyCashCount()));
});
test('diferencia positiva y negativa contra esperado',()=>{
 const d=emptyData();const s={id:'d',openedAt:new Date().toISOString(),opening:100000,movements:[]};
 const rows=emptyCashCount();rows.find(r=>r.denomination===100000)!.quantity=2;
 assert.equal(closeSession(d,s,cashCountTotal(rows),rows).difference,100000);
 assert.equal(closeSession(d,s,0,emptyCashCount()).difference,-100000);
});

import { addCategory, findCategory, migrateCategories } from '../src/app/core/categories';
test('categorías agregadas permanecen aunque no tengan productos y se restauran',()=>{
 const d=emptyData();assert.equal(addCategory(d,'  Bebidas   frías '),'Bebidas frías');
 const restored=validateData(JSON.parse(JSON.stringify(d)));assert.ok(restored.categories.includes('Bebidas frías'));
 assert.equal(findCategory(restored,'bebidas frías'),'Bebidas frías');
});
test('no admite categorías vacías o duplicadas por espacios y mayúsculas',()=>{
 const d=emptyData();assert.throws(()=>addCategory(d,'  '));assert.throws(()=>addCategory(d,' GRANEL '));
 d.categories.push('granel');assert.throws(()=>validateData(d));
});
test('datos V1 sin catálogo migran preservando categorías y registros',()=>{
 const original=emptyData();original.products.push({id:'legacy',name:'Bebida',category:'Bebidas',price:10000,active:false});
 const legacy: any=structuredClone(original);delete legacy.categories;
 const restored=validateData(legacy);assert.deepEqual(restored.categories,['Granel','Envasados','Bebidas']);assert.deepEqual(restored.products,original.products);
 assert.deepEqual(restored.sales,original.sales);assert.deepEqual(restored.sessions,original.sessions);
 assert.equal(legacy.categories,undefined);assert.deepEqual(migrateCategories(legacy).categories,restored.categories);
});
test('backup con catálogo explícito exige categorías válidas para todos los productos',()=>{
 const d=emptyData();d.categories=[];assert.throws(()=>validateData(d));
 const normalized=emptyData();normalized.products[0].category=' granel ';const restored=validateData(normalized);assert.equal(restored.products[0].category,'Granel');
 const wrong:any=emptyData();wrong.categories='Granel';assert.throws(()=>validateData(wrong));
});
