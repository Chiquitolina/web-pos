import { Item, Product, WeeklyReport } from './models';
export const SCOOP_GRAMS=80;
export function validIceCreamGrams(value:unknown):value is number {return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;}
export function validIceCreamScoops(value:unknown):value is number {return typeof value==='number'&&Number.isSafeInteger(value)&&value>0&&Number.isSafeInteger(value*SCOOP_GRAMS);}
export function validateIceCreamPortion(row:{iceCreamGrams?:number;iceCreamScoops?:number}):void {
 if(row.iceCreamGrams!==undefined&&!validIceCreamGrams(row.iceCreamGrams))throw Error('Gramaje inválido: ingresá gramos enteros, desde cero');
 if(row.iceCreamScoops!==undefined&&(!validIceCreamScoops(row.iceCreamScoops)||row.iceCreamGrams!==row.iceCreamScoops*SCOOP_GRAMS))throw Error('Bochas inválidas: cada bocha equivale a 80 gramos');
}
// Freeze the configured portion at checkout, without asking the cashier.
export function snapshotIceCreamPortion(item:Item,product:Product):void {
 for(const field of ['iceCreamGrams','iceCreamScoops'] as const){if(product[field]===undefined)delete item[field];else item[field]=product[field];}
}
export function iceCreamConsumption(products:WeeklyReport['products']) {
 let grams=0,scoops=0,unconfiguredUnits=0;let configured=false;
 for(const p of products){validateIceCreamPortion(p);if(p.iceCreamGrams===undefined)unconfiguredUnits+=p.quantity;else{configured=true;grams+=p.quantity*p.iceCreamGrams;}scoops+=p.quantity*(p.iceCreamScoops??0);}
 if(![grams,scoops,unconfiguredUnits].every(Number.isSafeInteger))throw Error('Consumo teórico demasiado grande');
 return {grams,scoops,unconfiguredUnits,configured};
}
