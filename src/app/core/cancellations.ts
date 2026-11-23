import { Data, Sale } from './models';
export function effectiveSale(sale:Sale, asOf?:string):boolean {
 return !sale.cancellation || (asOf!==undefined&&Date.parse(sale.cancellation.at)>Date.parse(asOf));
}
export function cancelSale(data:Data,id:string,reason:string,now=new Date().toISOString()):Sale {
 const sale=data.sales.find(s=>s.id===id);if(!sale)throw Error('Venta no encontrada');if(sale.cancellation)throw Error('La venta ya está anulada');
 const text=reason.trim();if(!text)throw Error('Ingresá el motivo de anulación');if(!Number.isFinite(Date.parse(now)))throw Error('Fecha de anulación inválida');
 const cashClosing=data.sessions.find(s=>s.id===sale.sessionId)?.closing?.at;
 const weeklyClosing=data.weeks.find(w=>w.id===sale.weekId)?.closing?.at;
 // Preserve ordering relative to saved closures, including actions in the same
 // millisecond or after the computer clock moves backwards.
 const at=new Date(Math.max(Date.parse(now),Date.parse(sale.at),cashClosing?Date.parse(cashClosing)+1:0,weeklyClosing?Date.parse(weeklyClosing)+1:0)).toISOString();
 sale.cancellation={at,reason:text};return sale;
}
