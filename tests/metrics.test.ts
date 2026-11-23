import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Item, Product, Sale } from '../src/app/core/models';
import { MetricsAccumulator, MetricsFilter, metricDateParts, metricsPresetDates, validateMetricsFilter } from '../src/app/core/metrics';
const TZ='America/Argentina/Buenos_Aires',NOW='2026-11-16T01:00:00Z';
const product=(id:string,name:string,extra:Partial<Product>={}):Product=>({id,name,category:'Palitos',price:100,active:true,gridoName:id.toUpperCase(),...extra});
const catalog=()=>({categories:['Palitos','Postres','Bebidas'],productFamilies:[{id:'f',name:'Limón',unitsPerBox:20,boxesPerPack:6}],products:[product('box20','Limón caja',{familyId:'f',presentation:'Caja'}),product('box10','Limón caja chica',{familyId:'f',presentation:'Caja 2',unitsPerBox:10}),product('unit','Limón unidad',{familyId:'f',presentation:'Unidad'}),product('pack','Promo caja',{familyId:'f',presentation:'Pack'}),product('retired','Otro nombre actual',{active:false,deletedAt:'2026-11-10T12:00:00Z'}),product('drink','Agua mineral',{category:'Bebidas'})]});
const filter=(extra:Partial<MetricsFilter>={}):MetricsFilter=>({from:'2026-11-09',to:'2026-11-15',category:'',presentation:'all',search:'',weekday:null,hourFrom:0,hourTo:24,...extra});
const item=(id:string,quantity:number,extra:Partial<Item>={}):Item=>({productId:id,name:catalog().products.find(p=>p.id===id)?.name??id,category:id==='drink'?'Bebidas':'Palitos',gridoName:id.toUpperCase(),quantity,unitPrice:100,subtotal:quantity*100,...extra});
const sale=(at:string,items:Item[],cancel=false):Sale=>({id:at,number:1,sessionId:'closed',at,items,total:items.reduce((sum,i)=>sum+i.subtotal,0),payment:'CASH',received:0,change:0,...(cancel?{cancellation:{at:'2026-11-16T04:00:00Z',reason:'Error'}}:{})});
const report=(sales:Sale[],extra:Partial<MetricsFilter>={},data=catalog())=>{const c=new MetricsAccumulator(filter(extra),data,TZ,NOW);for(const s of sales)c.add(s);return c.finish();};
const sum=(values:number[])=>values.reduce((a,b)=>a+b,0);

test('métricas usa fecha/hora de Argentina y no desplaza medianoche ni devuelve hora 24',()=>{
 assert.deepEqual(metricDateParts('2026-11-16T02:59:59.999Z',TZ),{date:'2026-11-15',hour:23});
 assert.deepEqual(metricDateParts('2026-11-16T03:00:00Z',TZ),{date:'2026-11-16',hour:0});
 assert.deepEqual(metricDateParts('2026-11-15T23:00:00-03:00',TZ),metricDateParts('2026-11-16T02:00:00Z',TZ));
 assert.equal(metricDateParts('2026-11-16T00:00:00Z','UTC').hour,0);
});
test('suma cantidades de cada línea, excluye anulaciones y no deriva indicadores monetarios/de pedidos',()=>{
 const a=sale('2026-11-09T21:00:00Z',[item('box20',2),item('unit',7),item('drink',3)]),b=sale('2026-11-10T21:00:00Z',[item('unit',99)],true);
 const r=report([a,b]);assert.equal(r.quantity,12);assert.equal(r.uniqueProducts,3);assert.equal(r.weekdays[0].quantity,12);assert.equal(r.hours[18].quantity,12);
 assert.deepEqual(r.categories.map(c=>[c.label,c.quantity]),[['Palitos',9],['Bebidas',3]]);
 for(const key of ['salesCount','orders','total','payments','averageTicket','price','unitPrice'])assert.ok(!Object.keys(r).includes(key));
 assert.ok(!JSON.stringify(r).includes('subtotal'));a.total=999999;a.items[0].unitPrice=999999;assert.deepEqual(report([a,b]),r);
});
test('fechas desde/hasta inclusivas consideran el día local completo y timestamps con offset',()=>{
 const r=report([sale('2026-11-09T02:59:59Z',[item('unit',100)]),sale('2026-11-09T00:00:00-03:00',[item('unit',2)]),sale('2026-11-16T02:59:59.999Z',[item('unit',3)]),sale('2026-11-16T03:00:00Z',[item('unit',100)])]);
 assert.equal(r.quantity,5);assert.equal(r.weekdays[0].quantity,2);assert.equal(r.weekdays[6].quantity,3);assert.equal(r.hours[0].quantity,2);assert.equal(r.hours[23].quantity,3);
});
test('filtrar categoría toma solo las líneas coincidentes de un pedido mixto',()=>{
 const sales=[sale('2026-11-10T20:00:00Z',[item('unit',4),item('drink',9)])];const r=report(sales,{category:'Palitos'});
 assert.equal(r.quantity,4);assert.deepEqual(r.products.map(p=>p.key),['unit']);assert.equal(r.hours[17].quantity,4);assert.equal(r.categories[0].share,100);
});
test('caja reúne principal y segunda; unidad separa individuales y conserva custom únicamente en Todas',()=>{
 const sales=[sale('2026-11-10T20:00:00Z',[item('box20',2),item('box10',3),item('unit',5),item('pack',7)])];
 assert.equal(report(sales).quantity,17);assert.equal(report(sales,{presentation:'box'}).quantity,5);assert.equal(report(sales,{presentation:'unit'}).quantity,5);
 assert.match(report(sales,{presentation:'box'}).products[0].presentation,/Segunda caja · 10 unidades/);
});
test('clasificación explícita prevalece; el rótulo antiguo solo filtra y no convierte a unidades físicas',()=>{
 const sales=[sale('2026-11-10T20:00:00Z',[item('unit',4,{name:'Caja x 20'}),item('legacy',3,{name:'Palito Bombón x 10'})])];
 const r=report(sales,{presentation:'box'});assert.equal(r.quantity,3);assert.equal(r.products[0].presentation,'Por caja');assert.equal(report(sales,{presentation:'unit'}).quantity,4);
});
test('busca sin tildes/mayúsculas por palabras o código histórico/actual y conserva homónimos separados',()=>{
 const sales=[sale('2026-11-10T20:00:00Z',[item('unit',4,{name:'Palito FRUTAL LIMÓN',gridoName:'LIMON-XU'}),item('retired',6,{name:'Agua mineral',gridoName:'AGUA500'}),item('drink',7,{name:'Agua mineral',gridoName:'AGUA1500'})])];
 assert.equal(report(sales,{search:'frutal limon'}).quantity,4);assert.equal(report(sales,{search:'LIMON-XU'}).quantity,4);assert.equal(report(sales,{search:'otro nombre actual'}).quantity,6);
 const r=report(sales,{search:'agua mineral'});assert.equal(r.products.length,2);assert.deepEqual(r.products.map(p=>p.code),['AGUA1500','AGUA500']);assert.equal(r.quantity,13);
});
test('filtros de día y franja incluyen hora inicial, excluyen hora final y no mezclan días UTC',()=>{
 const sales=[sale('2026-11-10T20:59:59Z',[item('unit',2)]),sale('2026-11-10T21:00:00Z',[item('unit',3)]),sale('2026-11-11T02:59:59Z',[item('unit',5)]),sale('2026-11-11T03:00:00Z',[item('unit',7)])];
 const r=report(sales,{weekday:1,hourFrom:18,hourTo:24});assert.equal(r.quantity,8);assert.equal(r.hours[17].quantity,0);assert.equal(r.hours[18].quantity,3);assert.equal(r.hours[23].quantity,5);assert.equal(r.weekdays[1].days,1);assert.equal(r.weekdays[2].days,0);
});
test('promedio por día usa ocurrencias calendario, incluidos ceros y meses desiguales',()=>{
 const r=report([sale('2026-11-04T18:00:00Z',[item('unit',12)]),sale('2026-11-08T18:00:00Z',[item('unit',9)])],{from:'2026-11-04',to:'2026-11-28'});
 assert.deepEqual(r.weekdays.map(d=>d.days),[3,3,4,4,4,4,3]);assert.equal(r.weekdays[2].average,3);assert.equal(r.weekdays[6].average,3);assert.equal(r.weekdays[0].average,0);
});
test('todos los gráficos concilian entre sí después de filtros combinados',()=>{
 const sales=[sale('2026-11-09T21:00:00Z',[item('unit',4),item('box10',8),item('drink',5)]),sale('2026-11-10T22:00:00Z',[item('unit',2)]),sale('2026-11-11T22:00:00Z',[item('unit',99)],true)];
 const r=report(sales,{category:'Palitos',presentation:'unit',search:'limon',hourFrom:18,hourTo:24});assert.equal(r.quantity,6);
 for(const rows of [r.hours,r.weekdays,r.categories,r.products,r.trend])assert.equal(sum(rows.map(p=>p.quantity)),6);assert.equal(sum(r.heatmap.flat()),6);assert.equal(sum(r.products.map(p=>p.share)),100);
});
test('agrupar por ID no duplica productos renombrados y conserva categorías históricas/bajas',()=>{
 const r=report([sale('2026-11-09T20:00:00Z',[item('retired',2,{name:'Nombre viejo',category:'Categoría anterior',gridoName:'COD-ANT'})]),sale('2026-11-10T20:00:00Z',[item('retired',3,{name:'Nombre nuevo',category:'Palitos',gridoName:'COD-NUEVO'})])]);
 assert.equal(r.uniqueProducts,1);assert.equal(r.products[0].quantity,5);assert.equal(r.products[0].label,'Nombre nuevo');assert.equal(r.products[0].code,'COD-NUEVO');assert.deepEqual(r.products[0].categories,['Categoría anterior','Palitos']);assert.ok(r.availableCategories.includes('Categoría anterior'));
 assert.equal(report([sale('2026-11-09T20:00:00Z',[item('retired',2,{category:'Categoría anterior'})])],{category:'Categoría anterior'}).quantity,2);
});
test('todo el historial no depende del turno/semana activos y agrupa períodos largos sin perder cantidades',()=>{
 const sales=[sale('2020-01-01T12:00:00-03:00',[item('unit',3)]),sale('2026-11-10T20:00:00Z',[item('box10',4)])];
 const r=report(sales,{from:'',to:''});assert.equal(r.from,'2020-01-01');assert.equal(r.to,'2026-11-15');assert.equal(r.trendUnit,'año');assert.equal(r.trend.length,7);assert.equal(sum(r.trend.map(p=>p.quantity)),7);assert.equal(r.trend[0].quantity,3);
});
test('evolución completa ceros y agrupa semanas/meses con extremos parciales correctos',()=>{
 const r=report([sale('2026-11-09T20:00:00Z',[item('unit',3)])]);assert.equal(r.trend.length,7);assert.equal(r.trend[0].quantity,3);assert.equal(r.trend[1].quantity,0);
 const weekly=report([sale('2026-01-02T20:00:00Z',[item('unit',3)]),sale('2026-04-03T20:00:00Z',[item('unit',4)])],{from:'2026-01-02',to:'2026-04-03'});assert.equal(weekly.trendUnit,'semana');assert.equal(weekly.trend[0].key,'2025-12-29');assert.equal(sum(weekly.trend.map(p=>p.quantity)),7);
 const monthly=report([sale('2026-01-02T20:00:00Z',[item('unit',3)])],{from:'2025-12-25',to:'2027-01-01'});assert.equal(monthly.trendUnit,'mes');assert.equal(monthly.trend.length,14);assert.equal(sum(monthly.trend.map(p=>p.quantity)),3);const lastYear=report([],{from:'9995-01-01',to:'9999-12-31'});assert.equal(lastYear.trendUnit,'año');assert.equal(lastYear.trend.length,5);
});
test('períodos rápidos usan la fecha del negocio aunque UTC ya sea otro día',()=>{
 assert.deepEqual(metricsPresetDates('today',NOW,TZ),{from:'2026-11-15',to:'2026-11-15'});assert.deepEqual(metricsPresetDates('week',NOW,TZ),{from:'2026-11-09',to:'2026-11-15'});
 assert.deepEqual(metricsPresetDates('7days',NOW,TZ),{from:'2026-11-09',to:'2026-11-15'});assert.deepEqual(metricsPresetDates('30days',NOW,TZ),{from:'2026-10-17',to:'2026-11-15'});assert.deepEqual(metricsPresetDates('month',NOW,TZ),{from:'2026-11-01',to:'2026-11-15'});assert.deepEqual(metricsPresetDates('all',NOW,TZ),{from:'',to:''});
});
test('rechaza fechas inexistentes, rangos invertidos y franjas/días inválidos antes de consultar',()=>{
 for(const change of [{from:'2026-02-30'},{from:'0000-01-01'},{to:''},{from:'2026-11-16'},{hourFrom:18,hourTo:8},{hourFrom:-1},{hourTo:25},{weekday:7},{weekday:1.5},{presentation:'pack'}])assert.throws(()=>validateMetricsFilter(filter(change as Partial<MetricsFilter>)));
 assert.doesNotThrow(()=>validateMetricsFilter(filter({from:'',to:''})));assert.throws(()=>new MetricsAccumulator(filter(),catalog(),'Zona/Inexistente',NOW));
});
test('consulta vacía y resultados derivados no modifican catálogo, gramajes ni snapshots originales',()=>{
 const data=catalog(),sales=[sale('2026-11-10T20:00:00Z',[item('unit',4)])],before=structuredClone({data,sales});for(const p of data.products)Object.freeze(p);for(const s of sales){s.items.forEach(Object.freeze);Object.freeze(s.items);Object.freeze(s);}Object.freeze(sales);
 const r=report(sales,{},data);r.heatmap[1][17]=999;r.products[0].categories.push('No guardar');assert.deepEqual({data,sales},before);
 const empty=report([],{from:'',to:''});assert.equal(empty.quantity,0);assert.equal(empty.uniqueProducts,0);assert.equal(empty.hours.length,24);assert.equal(empty.weekdays.length,7);assert.equal(empty.trend.length,1);assert.equal(sum(empty.heatmap.flat()),0);
});
