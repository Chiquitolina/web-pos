import { CashCountRow } from './models';
// All amounts, including denomination values, are expressed in cents.
export const DENOMINATIONS = [20000,10000,2000,1000,500,200,100,50,20,10].map(pesos=>pesos*100);
export function emptyCashCount():CashCountRow[] { return DENOMINATIONS.map(denomination=>({denomination,quantity:0})); }
export function cashCountTotal(rows:CashCountRow[]):number {
 if(!Array.isArray(rows)||rows.length!==DENOMINATIONS.length) throw Error('Conteo incompleto');
 const seen=new Set<number>();let total=0;
 for(const row of rows) {
  if(!row||!DENOMINATIONS.includes(row.denomination)||seen.has(row.denomination)||!Number.isSafeInteger(row.quantity)||row.quantity<0) throw Error('Ingresá cantidades enteras de billetes, mayores o iguales a cero');
  seen.add(row.denomination);total+=row.denomination*row.quantity;
  if(!Number.isSafeInteger(total))throw Error('Conteo demasiado grande');
 }
 return total;
}
