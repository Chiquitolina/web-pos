import { validateIceCreamPortion } from './ice-cream';
import { validatePriceAudit } from './price-audit';
import { Data, Session, Closing, Item, Payment, CashCountRow } from './models';
import { cashCountTotal } from './cash-count';
import { migrateCategories, validateCategories } from './categories';
import { migrateWeeks, validateWeeks } from './weeks';
import { migrateCatalog, validateCatalog } from './catalog';
import { validVatRate } from './receipt';
import { effectiveSale } from './cancellations';
export function money(value:number):number { if(!Number.isFinite(value)||value<0) throw Error('Importe inválido'); const cents=Math.round(value*100); if(!Number.isSafeInteger(cents)) throw Error('Importe demasiado grande'); return cents; }
export function closeSession(data:Data, session:Session, counted:number, cashCount?:CashCountRow[], asOf?:string):Closing {
 if(session.closing) throw Error('Caja ya cerrada');
 if(!Number.isSafeInteger(counted)||counted<0) throw Error('Conteo inválido');
 if(cashCount!==undefined&&cashCountTotal(cashCount)!==counted)throw Error('El desglose no coincide con el efectivo contado');
 const sessionSales=data.sales.filter(s=>s.sessionId===session.id);
 const snapshotAt=asOf??new Date(Math.max(Date.now(),...sessionSales.map(s=>s.cancellation?Date.parse(s.cancellation.at):0))).toISOString();
 const sales=sessionSales.filter(s=>effectiveSale(s,asOf));
 const payments:Record<Payment,number>={CASH:0,MP:0,CARD:0};
 const products=new Map<string,{id:string;name:string;quantity:number;total:number}>();
 for(const sale of sales) { payments[sale.payment]+=sale.total; for(const item of sale.items) { const row=products.get(item.productId)??{id:item.productId,name:item.name,quantity:0,total:0};row.quantity+=item.quantity;row.total+=item.subtotal;products.set(row.id,row); } }
 const expected=session.opening+payments.CASH+session.movements.reduce((n,m)=>n+(m.type==='IN'?m.amount:-m.amount),0);
 return {at:snapshotAt,counted,...(cashCount!==undefined?{cashCount:structuredClone(cashCount)}:{}),expected,difference:counted-expected,salesCount:sales.length,total:sales.reduce((n,s)=>n+s.total,0),payments,products:[...products.values()]};
}
// Closed cash sessions use their original snapshot and only subtract later voids.
// This works without loading every historical sale into memory.
export function netSessionClosing(data:Data,session:Session):Closing {
 if(!session.closing)return closeSession(data,session,0);
 const result=structuredClone(session.closing);
 for(const sale of data.sales.filter(s=>s.sessionId===session.id&&s.cancellation&&Date.parse(s.cancellation.at)>Date.parse(session.closing!.at))){
  result.salesCount--;result.total-=sale.total;result.payments[sale.payment]-=sale.total;
  for(const item of sale.items){const row=result.products.find(p=>p.id===item.productId);if(row){row.quantity-=item.quantity;row.total-=item.subtotal;}}
 }
 result.products=result.products.filter(p=>p.quantity>0);
 result.expected=session.opening+result.payments.CASH+session.movements.reduce((n,m)=>n+(m.type==='IN'?m.amount:-m.amount),0);result.difference=result.counted-result.expected;return result;
}
export function validateData(input:unknown):Data {
 const d=input as Data;if(d?.priceAudit!==undefined)validatePriceAudit(d.priceAudit); if(!d||d.version!==1||!Array.isArray(d.products)||!Array.isArray(d.sales)||!Array.isArray(d.sessions)) throw Error('Backup incompatible');
 if(d.weeks!==undefined&&!Array.isArray(d.weeks))throw Error('Semanas inválidas');
 const integer=(n:unknown)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
 const str=(s:unknown)=>typeof s==='string'&&s.length>0;
 const date=(s:unknown)=>str(s)&&Number.isFinite(Date.parse(s as string));
 const ids=(rows:{id:string}[])=>rows.every(r=>r&&str(r.id))&&new Set(rows.map(r=>r.id)).size===rows.length;
 if(!ids(d.products)||!ids(d.sales)||!ids(d.sessions)||d.sessions.filter(s=>!s.closing).length>1) throw Error('IDs o cajas inválidos');
 for(const p of d.products) if(!str(p.name)||!str(p.category)||!integer(p.price)||p.price===0||typeof p.active!=='boolean') throw Error('Producto inválido');
 validateCategories(d);validateCatalog(d);
 for(const s of d.sessions) {
 if(!date(s.openedAt)||!integer(s.opening)||!Array.isArray(s.movements)||!ids(s.movements)) throw Error('Caja inválida');
 if(s.openingCount!==undefined&&cashCountTotal(s.openingCount)!==s.opening)throw Error('El desglose de apertura no coincide con el monto');
 for(const m of s.movements) if(!date(m.at)||!['IN','OUT'].includes(m.type)||!integer(m.amount)||m.amount===0||!str(m.reason)) throw Error('Movimiento inválido');
 }
 const numbers=new Set<number>();
 for(const s of d.sales) {
 if(!integer(s.number)||s.number===0||numbers.has(s.number)||!d.sessions.some(c=>c.id===s.sessionId)||!date(s.at)||!['CASH','MP','CARD'].includes(s.payment)||!Array.isArray(s.items)||!s.items.length||!integer(s.total)||!integer(s.received)||!integer(s.change)) throw Error('Venta inválida'); numbers.add(s.number);
 if(s.cancellation!==undefined&&(!s.cancellation||!date(s.cancellation.at)||typeof s.cancellation.reason!=='string'||!s.cancellation.reason.trim()||Date.parse(s.cancellation.at)<Date.parse(s.at)))throw Error('Anulación inválida');
 for(const i of s.items)validateIceCreamPortion(i);
 for(const i of s.items) if(i.vatRate!==undefined&&!validVatRate(i.vatRate)||[i.gridoName,i.categoryGridoName].some(n=>n!==undefined&&(typeof n!=='string'||!n.trim()))||(i.category!==undefined&&(typeof i.category!=='string'||!i.category.trim()))||!str(i.productId)||!str(i.name)||!integer(i.quantity)||i.quantity===0||!integer(i.unitPrice)||i.unitPrice===0||!integer(i.subtotal)||i.subtotal!==i.quantity*i.unitPrice) throw Error('Detalle inválido');
 if(s.total!==s.items.reduce((n,i)=>n+i.subtotal,0)||s.received<s.total||s.change!==s.received-s.total||s.payment!=='CASH'&&(s.change!==0||s.received!==s.total)) throw Error('Total inválido');
 }
 for(const s of d.sessions) if(s.closing) {
 const c=s.closing;if(!date(c.at)||!integer(c.counted)) throw Error('Cierre inválido');
 const expected=closeSession(d,{...s,closing:undefined},c.counted,c.cashCount,c.at);
 for(const key of ['expected','difference','salesCount','total'] as const) if(c[key]!==expected[key]) throw Error('Cierre inconsistente');
 if(JSON.stringify(c.payments)!==JSON.stringify(expected.payments)||JSON.stringify(c.products)!==JSON.stringify(expected.products)) throw Error('Resumen inconsistente');
 }
 const migrated=migrateWeeks(migrateCatalog(migrateCategories(d)));validateWeeks(migrated);return migrated;
}
