import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Product} from '../src/app/core/models';
import {filterPosProducts,posProductKind,posProductCaption,searchPosProducts} from '../src/app/core/pos-products';

function product(id:string,changes:Partial<Product>={}):Product{return {id,name:id,category:'Palitos',price:100000,active:true,...changes};}
function fixture():Product[]{return [
 product('main',{name:'Palito limón caja x20',presentation:'Caja',familyId:'f'}),
 product('second',{name:'Palito limón caja x10',presentation:'Caja 2',familyId:'f',unitsPerBox:10}),
 product('unit',{name:'Palito limón por unidad',presentation:'Unidad',familyId:'f'}),
 product('old-box',{name:'Palito Bombón DDL x 10',gridoName:'BOMBONX10U'}),
 product('old-unit',{name:'Cremoso Frutilla x UNIDAD'}),
 product('pack',{name:'Promo especial x6',presentation:'Pack',familyId:'f'}),
 product('inactive',{name:'Palito limón agotado',active:false,presentation:'Caja'}),
 product('deleted',{name:'Palito limón eliminado',active:false,deletedAt:'2026-11-15T12:00:00Z'}),
 product('postre',{name:'Bombón Escocés',gridoName:'ESCOCES X8U',category:'Postres',presentation:'Caja',familyId:'e'}),
 product('drink',{name:'Agua mineral',gridoName:'AGUA 500',category:'Bebidas'})
];}

test('los roles explícitos prevalecen sobre nombres y códigos; ambas cajas se filtran juntas',()=>{
 assert.equal(posProductKind(product('a',{presentation:'Caja',name:'Nombre individual'})),'box');
 assert.equal(posProductKind(product('b',{presentation:'caja 2',name:'Nombre por unidad'})),'box');
 assert.equal(posProductKind(product('c',{presentation:'Unidad',name:'Caja x20',gridoName:'CAJA X20U'})),'unit');
 assert.equal(posProductKind(product('d',{presentation:'Pack',name:'Caja x20'})),'other');
});

test('el catálogo anterior reconoce rótulos de caja/unidad y x10/x20 solo para filtrar tarjetas',()=>{
 for(const name of ['Palito Frutal LIMÓN x 20','Palito Bombón DDL x 10','Bombón Caja x8 unidades'])assert.equal(posProductKind(product(name)),'box');
 assert.equal(posProductKind(product('sku',{name:'Bombón Escocés',gridoName:'ESCOCESx8U'})),'box');
 for(const name of ['Cremoso Frutilla x UNIDAD','Palito por unidad','Bombón individual','Cucurucho 2 bochas','Helado x 2 bochas','Promo 2x1','Bebida 500ml'])assert.equal(posProductKind(product(name)),'unit');
 const legacy=product('legacy',{name:'Palito caja x20'});assert.equal(posProductCaption(legacy),'Por caja');assert.equal(legacy.unitsPerBox,undefined);assert.equal(legacy.familyId,undefined);
});

test('filtra por categoría y presentación sin perder productos simples/custom en Todos ni mostrar bajas/inactivos',()=>{
 const data=fixture();assert.deepEqual(filterPosProducts(data,'Palitos','all').map(p=>p.id),['main','second','unit','old-box','old-unit','pack']);
 assert.deepEqual(filterPosProducts(data,'Palitos','box').map(p=>p.id),['main','second','old-box']);assert.deepEqual(filterPosProducts(data,'Palitos','unit').map(p=>p.id),['unit','old-unit']);
 assert.deepEqual(filterPosProducts(data,'Bebidas','box'),[]);assert.equal(filterPosProducts(data,'Bebidas','unit')[0].id,'drink');assert.deepEqual(filterPosProducts(data,'No existe'),[]);
});

test('busca globalmente por nombre o código, sin acentos/mayúsculas y con palabras en distinto orden',()=>{
 const data=fixture();assert.deepEqual(searchPosProducts(data,'  ESCOCES  ').map(p=>p.id),['postre']);assert.equal(searchPosProducts(data,'agua 500')[0].category,'Bebidas');
 assert.deepEqual(searchPosProducts(data,'CAJA limon').map(p=>p.id),['second','main']);assert.equal(searchPosProducts(data,'FRUTILLA unidad')[0].id,'old-unit');assert.equal(searchPosProducts(data,'BOMBONX10U')[0].id,'old-box');
 assert.deepEqual(searchPosProducts(data,'  '),[]);assert.deepEqual(searchPosProducts(data,'zzzz'),[]);assert.ok(searchPosProducts(data,'limon').every(p=>p.active&&!p.deletedAt));
});

test('productos homónimos conservan IDs, códigos y precios independientes en los resultados',()=>{
 const products=[product('large',{name:'Agua mineral',gridoName:'AGUA 1500',price:270000,category:'Bebidas'}),product('small',{name:'Agua mineral',gridoName:'AGUA 500',price:150000,category:'Bebidas'})];
 assert.equal(searchPosProducts(products,'Agua mineral').length,2);assert.equal(searchPosProducts(products,'1500')[0].id,'large');assert.equal(searchPosProducts(products,'1500')[0].price,270000);assert.equal(searchPosProducts(products,'500').length,2);
});

test('filtrar y buscar no mutan orden, relaciones, precios ni gramajes del catálogo',()=>{
 const data=fixture(),before=structuredClone(data);for(const p of data)Object.freeze(p);Object.freeze(data);
 for(let i=0;i<3;i++){filterPosProducts(data,'Palitos','box');filterPosProducts(data,'Palitos','unit');searchPosProducts(data,'palito');}
 assert.deepEqual(data,before);
});

test('resultados y rótulos usan el catálogo vigente y la capacidad configurada, sin cachear precios ni inferir tamaños',()=>{
 const data=fixture();data[0].price=123400;assert.equal(searchPosProducts(data,'x20')[0].price,123400);data[0].active=false;assert.equal(searchPosProducts(data,'x20').some(p=>p.id==='main'),false);
 assert.equal(posProductCaption(data[1],[{id:'f',name:'Palito',unitsPerBox:20}]),'Segunda caja · 10 unidades');assert.equal(posProductCaption({...data[0],active:true},[{id:'f',name:'Palito',unitsPerBox:20}]),'Caja principal · 20 unidades');assert.equal(posProductCaption(data[5]),'Pack');
});
