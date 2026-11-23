import { Payment, Sale, Session } from './models';
import { effectiveSale } from './cancellations';
import { receiptDate } from './receipt';

const methods:Payment[]=['CASH','CARD','MP'];
export function closingReceiptView(session:Session,sales:Sale[],storeName:string,timeZone:string,printedAt=new Date().toISOString()) {
 const closing=session.closing;if(!closing)throw Error('El turno todavía no está cerrado');
 const all=sales.filter(s=>s.sessionId===session.id).sort((a,b)=>a.number-b.number);
 const valid=all.filter(s=>effectiveSale(s,closing.at));
 const cancelled=all.filter(s=>!effectiveSale(s,closing.at));
 const later=valid.filter(s=>!!s.cancellation);
 // Read the entire session, including older orders absent from the UI cache.
 if(valid.length!==closing.salesCount||valid.reduce((n,s)=>n+s.total,0)!==closing.total)throw Error('No se pudo conciliar el cierre con todos los pedidos del turno');
 const cancellation=(s:Sale)=>({id:s.id,number:s.number,amount:s.total,at:receiptDate(s.cancellation!.at,timeZone),reason:s.cancellation!.reason});
 const movements=[...session.movements].sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id)).map(m=>({...m,date:receiptDate(m.at,timeZone)}));
 const incoming=movements.filter(m=>m.type==='IN').reduce((n,m)=>n+m.amount,0);
 const outgoing=movements.filter(m=>m.type==='OUT').reduce((n,m)=>n+m.amount,0);
 const cancelledAmount=cancelled.reduce((n,s)=>n+s.total,0),laterAmount=later.reduce((n,s)=>n+s.total,0);
 const quantity=closing.products.reduce((n,p)=>n+p.quantity,0);
 const durationMinutes=Math.floor((Date.parse(closing.at)-Date.parse(session.openedAt))/60000);
 return {
  storeName,sessionId:session.id,sessionCode:session.id.slice(0,8),
  openedAt:receiptDate(session.openedAt,timeZone),closedAt:receiptDate(closing.at,timeZone),printedAt:receiptDate(printedAt,timeZone),
  duration:durationMinutes<0?'—':`${Math.floor(durationMinutes/60)} h ${durationMinutes%60} min`,
  orders:all.length,firstOrder:all[0]?.number??null,lastOrder:all.at(-1)?.number??null,
  validOrders:closing.salesCount,cancelledOrders:cancelled.length,cancelledAmount,
  grossTotal:closing.total+cancelledAmount,total:closing.total,quantity,
  average:closing.salesCount?Math.round(closing.total/closing.salesCount):0,
  payments:methods.map(method=>({method,label:{CASH:'Efectivo',CARD:'Tarjeta',MP:'Mercado Pago'}[method],orders:valid.filter(s=>s.payment===method).length,total:closing.payments[method]})),
  opening:session.opening,incoming,outgoing,expected:closing.expected,counted:closing.counted,difference:closing.difference,
  movements,products:closing.products.map(p=>({...p})),cancelled:cancelled.map(cancellation),
  laterCancellations:later.map(cancellation),laterAmount,currentTotal:closing.total-laterAmount,currentOrders:closing.salesCount-later.length
 };
}
export type ClosingReceiptView=ReturnType<typeof closingReceiptView>;
