import { Payment, Sale } from './models';
export const paymentName=(payment:Payment):string=>({CASH:'EFECTIVO',MP:'MERCADO PAGO',CARD:'TARJETA'}[payment]);
export function validVatRate(rate:unknown):rate is number {return typeof rate==='number'&&Number.isFinite(rate)&&rate>=0&&rate<=100&&Math.abs(rate*100-Math.round(rate*100))<1e-7;}
export function receiptNumber(value:number):string {return new Intl.NumberFormat('es-AR',{useGrouping:false,minimumFractionDigits:2,maximumFractionDigits:2}).format(value);}
export function receiptDate(at:string,timeZone:string):string {
 const parts=new Intl.DateTimeFormat('es-AR',{timeZone,day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(at));
 const get=(type:string)=>parts.find(p=>p.type===type)!.value;
 return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}:${get('second')}`;
}
export function receiptView(sale:Sale,storeName:string,timeZone:string){
 return {storeName,orderNumber:sale.number,id:sale.id,sessionId:sale.sessionId,sessionCode:sale.sessionId.slice(0,8),date:receiptDate(sale.at,timeZone),payment:paymentName(sale.payment),
  items:sale.items.map(i=>({name:i.name,quantity:receiptNumber(i.quantity),vat:i.vatRate===undefined?'—':receiptNumber(i.vatRate),price:receiptNumber(i.unitPrice/100),amount:receiptNumber(i.subtotal/100)})),total:receiptNumber(sale.total/100),received:receiptNumber(sale.received/100),change:receiptNumber(sale.change/100),cancellation:sale.cancellation};
}
