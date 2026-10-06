import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyData } from '../src/app/core/models';
import { closeSession, money, validateData } from '../src/app/core/domain';
test('cierre incluye fondo, efectivo neto, ingresos y retiros; agrupa productos',()=>{
 const d=emptyData();const s={id:'s',openedAt:new Date().toISOString(),opening:10000,movements:[{id:'m',at:new Date().toISOString(),type:'OUT' as const,amount:1000,reason:'Retiro'}]};d.sessions.push(s);
 d.sales.push({id:'v',number:1,sessionId:'s',at:new Date().toISOString(),payment:'CASH',received:10000,change:3000,total:7000,items:[{productId:'p0',name:'Bocha',quantity:2,unitPrice:3500,subtotal:7000}]});
 const c=closeSession(d,s,15900);assert.equal(c.expected,16000);assert.equal(c.difference,-100);assert.equal(c.products[0].quantity,2);assert.equal(c.payments.CASH,7000);
 d.sessions[0]={...s,closing:c};assert.deepEqual(validateData(d),d);d.products[0].price=999999;assert.equal(d.sales[0].total,7000);assert.equal(d.sessions[0].closing!.total,7000);
});
test('rechaza backup manipulado y valores inválidos',()=>{assert.throws(()=>money(NaN));assert.throws(()=>money(-1));assert.equal(money(12.34),1234);const d=emptyData();d.products[0].price=-1;assert.throws(()=>validateData(d));assert.throws(()=>validateData({version:2}));});
