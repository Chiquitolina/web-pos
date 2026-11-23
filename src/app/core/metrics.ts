import { Data, Item, Product, Sale } from './models';
import { PosProductFilter, PosProductKind, posProductCaption, posProductKind, posSearchKey } from './pos-products';

export const METRIC_WEEKDAYS=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
export type MetricsPreset='today'|'week'|'7days'|'30days'|'month'|'all'|'custom';
export interface MetricsFilter {
 from:string;to:string;category:string;presentation:PosProductFilter;search:string;
 weekday:number|null;hourFrom:number;hourTo:number;
}
export interface QuantityPoint { key:string;label:string;quantity:number }
export interface MetricWeekday extends QuantityPoint { days:number;average:number }
export interface MetricProduct extends QuantityPoint { code:string;categories:string[];presentation:string;kind:PosProductKind;share:number }
export interface MetricsReport {
 quantity:number;uniqueProducts:number;from:string;to:string;timeZone:string;
 weekdays:MetricWeekday[];hours:QuantityPoint[];heatmap:number[][];
 trend:QuantityPoint[];trendUnit:'día'|'semana'|'mes'|'año';
 products:MetricProduct[];categories:(QuantityPoint&{share:number})[];availableCategories:string[];
}
export interface MetricsSnapshot { report:MetricsReport;revision:number }
type Catalog=Pick<Data,'products'|'productFamilies'|'categories'>;
const DAY=86400000;
const dateMs=(date:string)=>Date.parse(date+'T00:00:00Z');
export const metricShiftDate=(date:string,days:number)=>new Date(dateMs(date)+days*DAY).toISOString().slice(0,10);
const weekday=(date:string)=>(new Date(dateMs(date)).getUTCDay()+6)%7;
function validDate(date:string):boolean {
 return /^\d{4}-\d{2}-\d{2}$/.test(date)&&Number(date.slice(0,4))>0&&Number.isFinite(dateMs(date))&&new Date(dateMs(date)).toISOString().slice(0,10)===date;
}
export function metricDateParts(at:string,timeZone:string):{date:string;hour:number} {
 return dateParts(new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}),at);
}
function dateParts(formatter:Intl.DateTimeFormat,at:string):{date:string;hour:number} {
 const parts=formatter.formatToParts(new Date(at)),value=(type:string)=>parts.find(p=>p.type===type)!.value;
 return {date:`${value('year').padStart(4,'0')}-${value('month')}-${value('day')}`,hour:Number(value('hour'))};
}
export function metricsPresetDates(preset:MetricsPreset,now:string,timeZone:string):{from:string;to:string} {
 const today=metricDateParts(now,timeZone).date;
 switch(preset){
  case 'today':return {from:today,to:today};
  case 'week':return {from:metricShiftDate(today,-weekday(today)),to:today};
  case '7days':return {from:metricShiftDate(today,-6),to:today};
  case '30days':return {from:metricShiftDate(today,-29),to:today};
  case 'month':return {from:today.slice(0,8)+'01',to:today};
  case 'all':return {from:'',to:''};
  default:throw Error('Elegí las fechas del período personalizado.');
 }
}
export function validateMetricsFilter(input:MetricsFilter):MetricsFilter {
 const f={...input};
 if((!!f.from!==!!f.to)||f.from&&(!validDate(f.from)||!validDate(f.to)))throw Error('Completá dos fechas válidas para el período.');
 if(f.from&&f.from>f.to)throw Error('La fecha desde debe ser anterior o igual a la fecha hasta.');
 if(!['all','unit','box'].includes(f.presentation))throw Error('Elegí una presentación válida.');
 if(f.weekday!==null&&(!Number.isInteger(f.weekday)||f.weekday<0||f.weekday>6))throw Error('Elegí un día de semana válido.');
 if(!Number.isInteger(f.hourFrom)||!Number.isInteger(f.hourTo)||f.hourFrom<0||f.hourTo>24||f.hourFrom>=f.hourTo)throw Error('La hora desde debe ser anterior a la hora hasta, entre 00:00 y 24:00.');
 if(typeof f.category!=='string'||typeof f.search!=='string')throw Error('Filtros inválidos.');
 return f;
}
const numberSort=(a:string,b:string)=>a.localeCompare(b,'es',{sensitivity:'base',numeric:true});
function trends(from:string,to:string,quantities:Map<string,number>):{trend:QuantityPoint[];trendUnit:MetricsReport['trendUnit']} {
 const days=Math.round((dateMs(to)-dateMs(from))/DAY)+1;
 const unit=days<=62?'día':days<=366?'semana':days<=1096?'mes':'año';
 const key=(date:string)=>unit==='día'?date:unit==='semana'?metricShiftDate(date,-weekday(date)):unit==='mes'?date.slice(0,7)+'-01':date.slice(0,4)+'-01-01';
 const values=new Map<string,number>();for(const [date,q] of quantities){const k=key(date);values.set(k,(values.get(k)??0)+q);}
 const trend:QuantityPoint[]=[];
 for(let date=key(from);Number.isFinite(dateMs(date))&&dateMs(date)<=dateMs(to);){
  const label=unit==='día'?date.slice(8,10)+'/'+date.slice(5,7):unit==='semana'?date.slice(8,10)+'/'+date.slice(5,7):unit==='mes'?date.slice(5,7)+'/'+date.slice(0,4):date.slice(0,4);
  trend.push({key:date,label,quantity:values.get(date)??0});
  if(unit==='día'||unit==='semana')date=metricShiftDate(date,unit==='día'?1:7);
  else if(unit==='mes'){const d=new Date(dateMs(date));d.setUTCMonth(d.getUTCMonth()+1);date=d.toISOString().slice(0,10);}
  else{const d=new Date(dateMs(date));d.setUTCFullYear(d.getUTCFullYear()+1);date=d.toISOString().slice(0,10);}
 }
 return {trend,trendUnit:unit};
}

// Streams quantities only. No sale arrays, prices or financial totals are retained.
// The catalog is the same read-only transaction snapshot as the scanned history.
export class MetricsAccumulator {
 private readonly filter:MetricsFilter;
 private readonly formatter:Intl.DateTimeFormat;
 private readonly catalog:Map<string,Product>;
 private readonly words:string[];
 private readonly categories=new Map<string,number>();
 private readonly availableCategories:Set<string>;
 private readonly products=new Map<string,MetricProduct&{lastAt:number}>();
 private readonly dates=new Map<string,number>();
 private readonly weekdayQuantities=Array<number>(7).fill(0);
 private readonly hourQuantities=Array<number>(24).fill(0);
 private readonly heatmap=Array.from({length:7},()=>Array<number>(24).fill(0));
 private quantity=0;private firstDate='';private lastDate='';
 constructor(filter:MetricsFilter,private readonly data:Catalog,private readonly timeZone:string,private readonly now:string) {
  this.filter=validateMetricsFilter(filter);this.catalog=new Map(data.products.map(p=>[p.id,p]));
  this.availableCategories=new Set(data.categories);this.words=posSearchKey(filter.search).split(' ').filter(Boolean);
  this.formatter=new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'});
  dateParts(this.formatter,now);
 }
 add(sale:Sale):void {
  if(sale.cancellation)return;
  const {date,hour}=dateParts(this.formatter,sale.at),day=weekday(date),f=this.filter;
  if(!this.firstDate||date<this.firstDate)this.firstDate=date;if(!this.lastDate||date>this.lastDate)this.lastDate=date;
  for(const item of sale.items)this.availableCategories.add(item.category??'Sin categoría histórica');
  if(f.from&&(date<f.from||date>f.to)||f.weekday!==null&&day!==f.weekday||hour<f.hourFrom||hour>=f.hourTo)return;
  for(const item of sale.items){
   const category=item.category??'Sin categoría histórica';if(f.category&&category!==f.category)continue;
   const current=this.catalog.get(item.productId),visual=this.visualProduct(item,current),kind=posProductKind(visual);
   if(f.presentation!=='all'&&f.presentation!==kind)continue;
   if(this.words.length){const text=posSearchKey([item.name,item.gridoName??'',current?.name??'',current?.gridoName??''].join(' '));if(!this.words.every(word=>text.includes(word)))continue;}
   const q=item.quantity;this.quantity+=q;if(!Number.isSafeInteger(this.quantity))throw Error('La cantidad acumulada supera el límite de cálculo.');
   this.weekdayQuantities[day]+=q;this.hourQuantities[hour]+=q;this.heatmap[day][hour]+=q;
   this.dates.set(date,(this.dates.get(date)??0)+q);this.categories.set(category,(this.categories.get(category)??0)+q);
   const previous=this.products.get(item.productId),at=Date.parse(sale.at);
   if(previous){previous.quantity+=q;if(!previous.categories.includes(category))previous.categories.push(category);if(at>=previous.lastAt){previous.label=item.name;previous.code=item.gridoName??'';previous.lastAt=at;}if(previous.kind!==kind){previous.kind='other';previous.presentation='Presentaciones históricas mixtas';}}
   else this.products.set(item.productId,{key:item.productId,label:item.name,code:item.gridoName??'',categories:[category],quantity:q,kind,presentation:posProductCaption(visual,this.data.productFamilies),share:0,lastAt:at});
  }
 }
 private visualProduct(item:Item,current?:Product):Product {
  // Old sales have no presentation snapshot. An explicit current presentation
  // wins; otherwise historic labels are used only for a visual classification.
  return current?.presentation?.trim()?current:{id:item.productId,name:item.name,gridoName:item.gridoName,category:item.category??'',price:0,active:true};
 }
 finish():MetricsReport {
  const today=dateParts(this.formatter,this.now).date,from=this.filter.from||this.firstDate||today,to=this.filter.to||(this.lastDate>today?this.lastDate:today);
  const span=Math.round((dateMs(to)-dateMs(from))/DAY)+1,startDay=weekday(from);
  const weekdays=this.weekdayQuantities.map((quantity,i)=>{
   const days=this.filter.weekday!==null&&i!==this.filter.weekday?0:Math.floor(span/7)+((i-startDay+7)%7<span%7?1:0);
   return {key:String(i),label:METRIC_WEEKDAYS[i],quantity,days,average:days?quantity/days:0};
  });
  const share=(q:number)=>this.quantity?q/this.quantity*100:0;
  const products=[...this.products.values()].map(({lastAt,...p})=>({...p,categories:[...p.categories].sort(numberSort),share:share(p.quantity)})).sort((a,b)=>b.quantity-a.quantity||numberSort(a.label,b.label)||a.key.localeCompare(b.key));
  const categories=[...this.categories].map(([label,quantity])=>({key:label,label,quantity,share:share(quantity)})).sort((a,b)=>b.quantity-a.quantity||numberSort(a.label,b.label));
  return {quantity:this.quantity,uniqueProducts:products.length,from,to,timeZone:this.timeZone,weekdays,hours:this.hourQuantities.map((quantity,h)=>({key:String(h),label:String(h).padStart(2,'0')+':00',quantity})),heatmap:this.heatmap.map(r=>[...r]),...trends(from,to,this.dates),products,categories,availableCategories:[...this.availableCategories].sort(numberSort)};
 }
}
