import { Data, Session, Closing, Item, Payment } from './models';
export function money(value:number):number { if(!Number.isFinite(value)||value<0) throw Error('Importe inválido'); const cents=Math.round(value*100); if(!Number.isSafeInteger(cents)) throw Error('Importe demasiado grande'); return cents; }
export function closeSession(data:Data, session:Session, counted:number):Closing {
 if(session.closing) throw Error('Caja ya cerrada');
 const sales=data.sales.filter(s=>s.sessionId===session.id);
 const payments:Record<Payment,number>={CASH:0,MP:0,CARD:0};
 const products=new Map<string,{id:string;name:string;quantity:number;total:number}>();
 for(const sale of sales) { payments[sale.payment]+=sale.total; for(const item of sale.items) { const row=products.get(item.productId)??{id:item.productId,name:item.name,quantity:0,total:0};row.quantity+=item.quantity;row.total+=item.subtotal;products.set(row.id,row); } }
 const expected=session.opening+payments.CASH+session.movements.reduce((n,m)=>n+(m.type==='IN'?m.amount:-m.amount),0);
 return {at:new Date().toISOString(),counted,expected,difference:counted-expected,salesCount:sales.length,total:sales.reduce((n,s)=>n+s.total,0),payments,products:[...products.values()]};
}
export function validateData(input:unknown):Data {
 const d=input as Data; if(!d||d.version!==1||!Array.isArray(d.products)||!Array.isArray(d.sales)||!Array.isArray(d.sessions)) throw Error('Backup incompatible');
 const integer=(n:unknown)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
 const str=(s:unknown)=>typeof s==='string'&&s.length>0;
 const date=(s:unknown)=>str(s)&&Number.isFinite(Date.parse(s as string));
 const ids=(rows:{id:string}[])=>rows.every(r=>r&&str(r.id))&&new Set(rows.map(r=>r.id)).size===rows.length;
 if(!ids(d.products)||!ids(d.sales)||!ids(d.sessions)||d.sessions.filter(s=>!s.closing).length>1) throw Error('IDs o cajas inválidos');
 for(const p of d.products) if(!str(p.name)||!str(p.category)||!integer(p.price)||p.price===0||typeof p.active!=='boolean') throw Error('Producto inválido');
 for(const s of d.sessions) {
 if(!date(s.openedAt)||!integer(s.opening)||!Array.isArray(s.movements)||!ids(s.movements)) throw Error('Caja inválida');
 for(const m of s.movements) if(!date(m.at)||!['IN','OUT'].includes(m.type)||!integer(m.amount)||m.amount===0||!str(m.reason)) throw Error('Movimiento inválido');
 }
 const numbers=new Set<number>();
 for(const s of d.sales) {
 if(!integer(s.number)||s.number===0||numbers.has(s.number)||!d.sessions.some(c=>c.id===s.sessionId)||!date(s.at)||!['CASH','MP','CARD'].includes(s.payment)||!Array.isArray(s.items)||!s.items.length||!integer(s.total)||!integer(s.received)||!integer(s.change)) throw Error('Venta inválida'); numbers.add(s.number);
 for(const i of s.items) if(!str(i.productId)||!str(i.name)||!integer(i.quantity)||i.quantity===0||!integer(i.unitPrice)||i.unitPrice===0||!integer(i.subtotal)||i.subtotal!==i.quantity*i.unitPrice) throw Error('Detalle inválido');
 if(s.total!==s.items.reduce((n,i)=>n+i.subtotal,0)||s.received<s.total||s.change!==s.received-s.total||s.payment!=='CASH'&&(s.change!==0||s.received!==s.total)) throw Error('Total inválido');
 }
 for(const s of d.sessions) if(s.closing) {
 const c=s.closing;if(!date(c.at)||!integer(c.counted)) throw Error('Cierre inválido');
 const expected=closeSession(d,{...s,closing:undefined},c.counted);
 for(const key of ['expected','difference','salesCount','total'] as const) if(c[key]!==expected[key]) throw Error('Cierre inconsistente');
 if(JSON.stringify(c.payments)!==JSON.stringify(expected.payments)||JSON.stringify(c.products)!==JSON.stringify(expected.products)) throw Error('Resumen inconsistente');
 }
 return structuredClone(d);
}
