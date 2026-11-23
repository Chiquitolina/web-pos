import { Week, Data } from './models';
import { boxEquivalence, BoxEquivalence } from './box-equivalents';
import { iceCreamConsumption } from './ice-cream';
import { weeklyCategoryGroups } from './weekly-category-groups';
import { weeklyConsumptionReport } from './weekly-consumption-report';
// Quoted text protects separators/newlines; leading apostrophe neutralizes
// formula-like text when this CSV is opened with spreadsheet software.
function cell(value:string|number):string {let text=String(value);if(typeof value==='string'&&/^[\s]*[=+@-]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';}
export function weeklyCsv(week:Week,data?:Data):string {
 if(!week.closing)throw Error('Cerrá la semana antes de exportar el resumen definitivo');
 const r=data?weeklyConsumptionReport(data,week):week.closing.report;const rows:(string|number)[][]=[['tipo','semana_id','inicio','fin','fecha','producto_id','producto','categoria','unidades','ventas','importe_ars','medio_pago','motivo_anulacion','anulada_at','producto_grido','categoria_grido','gramos_por_unidad','bochas_por_unidad','bochas_teoricas','gramos_teoricos','kilos_teoricos','unidades_sin_gramaje','unidades_recalculadas','familia','presentacion','unidades_por_caja','cajas_vendidas','unidades_sueltas','cajas_totales','unidades_sin_equivalencia','equivalencia_cajas_parcial','base_equivalencia_cajas','unidades_totales_equivalentes','cajas_por_pack','packs_equivalentes','unidades_por_caja_presentacion']];
 const amount=(cents:number)=>(cents/100).toFixed(2).replace('.',',');
 const boxesNumber=(value:number)=>value.toFixed(6).replace(/0+$/,'').replace(/\.$/,'').replace('.',',');
 const add=(type:string,date='',id='',name='',category='',units:number|string='',sales:number|string='',total:number|string='',payment='',reason='',cancelledAt='',productGrido='',categoryGrido='',consumption?:ReturnType<typeof iceCreamConsumption>,gramsPerUnit:number|string='',scoopsPerUnit:number|string='',recalculatedUnits:number|string='',family='',presentation='',boxes?:BoxEquivalence,boxUnits:number|string='')=>rows.push([type,week.id,week.startedAt,week.closing!.at,date,id,name,category,units,sales,total,payment,reason,cancelledAt,productGrido,categoryGrido,gramsPerUnit,scoopsPerUnit,consumption?.scoops??'',consumption?.configured?consumption.grams:'',consumption?.configured?(consumption.grams/1000).toFixed(3).replace('.',','):'',consumption?.unconfiguredUnits??'',recalculatedUnits,family,presentation,boxes?.unitsPerBox??'',boxes?.boxes??'',boxes?.looseUnits??'',boxes?boxesNumber(boxes.totalBoxes):'',boxes?.unconvertedUnits??'',boxes?(boxes.partial?'SI':'NO'):'',boxes?'catalogo_actual':'',boxes?.totalUnits??'',boxes?.boxesPerPack??'',boxes?.totalPacks!==undefined?boxesNumber(boxes.totalPacks):'',boxUnits]);
 add('GENERAL','','','Total semanal neto','',r.quantity,r.salesCount,amount(r.total),'','','','','',iceCreamConsumption(r.products),'','',r.products.reduce((n,p)=>n+(p.recalculatedUnits??0),0));
 for(const [method,total] of Object.entries(r.payments))add('PAGO','','','','','','',amount(total),{CASH:'Efectivo',MP:'Mercado Pago',CARD:'Tarjeta'}[method as 'CASH'|'MP'|'CARD']);
 const groups=weeklyCategoryGroups(r,data);
 for(const g of groups)for(const f of g.families){
  for(const p of f.products)add('PRODUCTO','',p.id,p.name,p.category,p.quantity,'',amount(p.total),'','','',p.gridoName??'',p.categoryGridoName??'',iceCreamConsumption([p]),p.iceCreamGrams??'',p.iceCreamScoops??'',p.recalculatedUnits??0,f.name??'',p.presentation??'',f.boxEquivalence?boxEquivalence([p],f.boxEquivalence.unitsPerBox,f.boxEquivalence.boxesPerPack):undefined,p.unitsPerBox??'');
  if(f.name)add('FAMILIA','',f.id??'','Subtotal '+f.name,g.category.name,'','',amount(f.total),'','','','',g.category.gridoName??'',undefined,'','','',f.name,'',f.boxEquivalence);
 }
 for(const g of groups){const c=g.category;add('CATEGORIA','','','',c.name,c.quantity,c.salesCount,amount(c.total),'','','','',c.gridoName??'',g.consumption,'','',g.recalculatedUnits);}
 for(const d of r.days)add('DIA',d.date,'','','',d.quantity,d.salesCount,amount(d.total));
 if(data){const cancellations=data.sales.filter(s=>s.weekId===week.id&&s.cancellation);if(cancellations.length){const original=week.closing.report;add('CIERRE_ORIGINAL','','','Resumen guardado al cerrar','',original.quantity,original.salesCount,amount(original.total));for(const s of cancellations)add('ANULACION',s.at,s.id,'Ticket #'+s.number,'',s.items.reduce((n,i)=>n+i.quantity,0),1,amount(s.total),{CASH:'Efectivo',MP:'Mercado Pago',CARD:'Tarjeta'}[s.payment],s.cancellation!.reason,s.cancellation!.at);}}
 return '\uFEFF'+rows.map(row=>row.map(cell).join(';')).join('\r\n')+'\r\n';
}
