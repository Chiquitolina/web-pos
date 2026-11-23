import {test} from 'node:test';
import assert from 'node:assert/strict';
import {receiptHeightMm,RECEIPT_WIDTH_MM,RECEIPT_MIN_HEIGHT_MM} from '../src/app/core/receipt-print';

test('tickets cortos siempre solicitan papel vertical, incluso sin la línea de recibido/vuelto',()=>{
 for(const height of [1,140,220,280,294.8,300]){
  const length=receiptHeightMm(height);assert.equal(length,82);assert.ok(length>RECEIPT_WIDTH_MM);assert.ok(length>80,'el largo también supera el ancho del rollo seleccionado de 80 mm');assert.ok(length>=height*25.4/96);
 }
 assert.equal(RECEIPT_WIDTH_MM,78);assert.equal(RECEIPT_MIN_HEIGHT_MM,82);
});
test('tickets largos conservan todo el contenido y redondean solo al milímetro siguiente',()=>{
 for(const height of [311,480,1000,8000,11000]){
  const measured=height*25.4/96,length=receiptHeightMm(height);assert.ok(length>=measured);assert.ok(length<measured+1);assert.equal(length,Math.ceil(measured));
 }
 assert.notEqual(receiptHeightMm(480),297,'no se impone un largo fijo de hoja a los tickets');
});
test('medidas inválidas se rechazan antes de solicitar una impresión',()=>{
 for(const height of [0,-1,NaN,Infinity,-Infinity])assert.throws(()=>receiptHeightMm(height),/No se pudo calcular el tamaño del ticket/);
});
