import { Data, Sale, Week, WeeklyReport } from './models';
import { effectiveSale } from './cancellations';
export const weeklyProductKey=(p:{id:string;category:string;gridoName?:string;categoryGridoName?:string;iceCreamGrams?:number;iceCreamScoops?:number})=>JSON.stringify([p.id,p.category,p.gridoName??'',p.categoryGridoName??'',...(p.iceCreamGrams!==undefined||p.iceCreamScoops!==undefined?[p.iceCreamGrams??null,p.iceCreamScoops??null]:[])]);
export const WEEK_TIME_ZONE='America/Argentina/Buenos_Aires';
export function localDate(at:string):string {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:WEEK_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(at));
 const part=(type:string)=>parts.find(p=>p.type===type)!.value;
 return `${part('year')}-${part('month')}-${part('day')}`;
}
export function mondayDate(now=new Date()):string {
 const date=localDate(now.toISOString());const d=new Date(`${date}T12:00:00-03:00`);d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return localDate(d.toISOString());
}
export function startOfDate(date:string):string {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Elegí una fecha de inicio válida');
 const d=new Date(`${date}T00:00:00-03:00`);if(!Number.isFinite(d.getTime())||localDate(d.toISOString())!==date)throw Error('Fecha inválida');return d.toISOString();
}
export function migrateWeeks(data:Data):Data {
 const next=structuredClone(data);next.weeks??=[];
 // The old format did not snapshot category on sales. Infer it once from the
 // current catalog; new sales always preserve the category at sale time.
 for(const s of next.sales)for(const i of s.items)i.category??=next.products.find(p=>p.id===i.productId)?.category??'Sin categoría histórica';
 return next;
}
export function activeWeek(data:Data):Week|undefined {return data.weeks.find(w=>!w.closing);}
export function summarizeSales(sales:Sale[],asOf?:string):WeeklyReport {
 const report:WeeklyReport={saleIds:[],salesCount:0,quantity:0,total:0,payments:{CASH:0,MP:0,CARD:0},products:[],categories:[],days:[]};
 const products=new Map<string,WeeklyReport['products'][number]>(),categories=new Map<string,WeeklyReport['categories'][number]>(),days=new Map<string,WeeklyReport['days'][number]>();
 for(const sale of sales.filter(s=>effectiveSale(s,asOf)).sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id))){
 report.saleIds.push(sale.id);report.salesCount++;report.total+=sale.total;report.payments[sale.payment]+=sale.total;
 const dayKey=localDate(sale.at),day=days.get(dayKey)??{date:dayKey,salesCount:0,quantity:0,total:0};day.salesCount++;day.total+=sale.total;days.set(dayKey,day);
 const seen=new Set<string>();
 for(const i of sale.items){const category=i.category??'Sin categoría histórica';const key=weeklyProductKey({...i,id:i.productId,category});const product=products.get(key)??{id:i.productId,name:i.name,category,...(i.gridoName?{gridoName:i.gridoName}:{}),...(i.categoryGridoName?{categoryGridoName:i.categoryGridoName}:{}),...(i.iceCreamGrams!==undefined?{iceCreamGrams:i.iceCreamGrams}:{}),...(i.iceCreamScoops!==undefined?{iceCreamScoops:i.iceCreamScoops}:{}),quantity:0,total:0};product.quantity+=i.quantity;product.total+=i.subtotal;products.set(key,product);
 const categoryId=JSON.stringify([category,i.categoryGridoName??'']);const cat=categories.get(categoryId)??{name:category,...(i.categoryGridoName?{gridoName:i.categoryGridoName}:{}),quantity:0,salesCount:0,total:0};cat.quantity+=i.quantity;cat.total+=i.subtotal;if(!seen.has(categoryId)){cat.salesCount++;seen.add(categoryId);}categories.set(categoryId,cat);report.quantity+=i.quantity;day.quantity+=i.quantity;
 }
 }
 report.products=[...products.values()].sort((a,b)=>b.quantity-a.quantity||a.id.localeCompare(b.id)||a.category.localeCompare(b.category));report.categories=[...categories.values()].sort((a,b)=>b.quantity-a.quantity||a.name.localeCompare(b.name));report.days=[...days.values()].sort((a,b)=>a.date.localeCompare(b.date));return report;
}
export function weekReport(data:Data, week:Week):WeeklyReport {
 if(!week.closing)return summarizeSales(data.sales.filter(s=>s.weekId===week.id));
 const report=structuredClone(week.closing.report);
 const cancelled=data.sales.filter(s=>s.weekId===week.id&&s.cancellation&&Date.parse(s.cancellation.at)>Date.parse(week.closing!.at));
 const removed=summarizeSales(cancelled.map(s=>({...s,cancellation:undefined})));
 const ids=new Set(removed.saleIds);report.saleIds=report.saleIds.filter(id=>!ids.has(id));
 report.salesCount-=removed.salesCount;report.quantity-=removed.quantity;report.total-=removed.total;
 for(const payment of ['CASH','MP','CARD'] as const)report.payments[payment]-=removed.payments[payment];
 const productKey=weeklyProductKey;
 for(const row of report.products){const delta=removed.products.find(p=>productKey(p)===productKey(row));if(delta){row.quantity-=delta.quantity;row.total-=delta.total;}}
 for(const row of report.categories){const delta=removed.categories.find(c=>c.name===row.name&&c.gridoName===row.gridoName);if(delta){row.quantity-=delta.quantity;row.salesCount-=delta.salesCount;row.total-=delta.total;}}
 for(const row of report.days){const delta=removed.days.find(d=>d.date===row.date);if(delta){row.quantity-=delta.quantity;row.salesCount-=delta.salesCount;row.total-=delta.total;}}
 report.products=report.products.filter(p=>p.quantity>0).sort((a,b)=>b.quantity-a.quantity||a.id.localeCompare(b.id)||a.category.localeCompare(b.category));
 report.categories=report.categories.filter(c=>c.quantity>0).sort((a,b)=>b.quantity-a.quantity||a.name.localeCompare(b.name));report.days=report.days.filter(d=>d.salesCount>0);return report;
}
export function beginWeek(data:Data,id:string,date:string,now=new Date().toISOString()):Week {
 if(activeWeek(data)||data.weeks.length)throw Error('El seguimiento ya fue iniciado');const startedAt=startOfDate(date);
 if(Date.parse(startedAt)>Date.parse(now))throw Error('El inicio no puede ser futuro');
 const week:Week={id,startedAt};data.weeks.push(week);
 for(const s of data.sales)if(!s.weekId&&Date.parse(s.at)>=Date.parse(startedAt)&&Date.parse(s.at)<=Date.parse(now))s.weekId=id;
 return week;
}
export function finishWeek(data:Data,id:string,nextId:string,at=new Date().toISOString()):Week {
 const week=data.weeks.find(w=>w.id===id&&!w.closing);if(!week)throw Error('La semana ya fue cerrada');if(data.weeks.some(w=>w.id===nextId))throw Error('ID de semana duplicado');
 if(Date.parse(at)<Date.parse(week.startedAt)||data.sales.some(s=>s.weekId===id&&Date.parse(s.at)>Date.parse(at)))throw Error('Revisá la fecha y hora del equipo antes de cerrar');
 at=new Date(Math.max(Date.parse(at),...data.sales.filter(s=>s.weekId===id).map(s=>s.cancellation?Date.parse(s.cancellation.at):0))).toISOString();
 week.closing={at,report:summarizeSales(data.sales.filter(s=>s.weekId===id))};data.weeks.push({id:nextId,startedAt:at});return week;
}
export function validateWeeks(data:Data):void {
 if(!Array.isArray(data.weeks)||new Set(data.weeks.map(w=>w?.id)).size!==data.weeks.length||data.weeks.filter(w=>!w.closing).length>1)throw Error('Semanas inválidas');
 if(data.weeks.length&&!activeWeek(data))throw Error('Falta el período semanal en curso');
 const date=(at:string)=>typeof at==='string'&&Number.isFinite(Date.parse(at));
 for(let n=0;n<data.weeks.length;n++){
 const w=data.weeks[n];if(!w||typeof w.id!=='string'||!w.id||!date(w.startedAt))throw Error('Semana inválida');
 if(n>0){const prev=data.weeks[n-1];if(!prev.closing||w.startedAt!==prev.closing.at)throw Error('Períodos semanales inconsistentes');}
 for(const s of data.sales.filter(s=>s.weekId===w.id))if(Date.parse(s.at)<Date.parse(w.startedAt)||w.closing&&Date.parse(s.at)>Date.parse(w.closing.at))throw Error('Venta fuera de su semana');
 if(w.closing){if(!date(w.closing.at)||Date.parse(w.closing.at)<Date.parse(w.startedAt)||JSON.stringify(w.closing.report)!==JSON.stringify(summarizeSales(data.sales.filter(s=>s.weekId===w.id),w.closing.at)))throw Error('Resumen semanal inconsistente');}
 }
 for(const s of data.sales){if(s.weekId!==undefined&&!data.weeks.some(w=>w.id===s.weekId))throw Error('Semana de venta inválida');for(const i of s.items)if(typeof i.category!=='string'||!i.category.trim())throw Error('Categoría histórica inválida');}
}
