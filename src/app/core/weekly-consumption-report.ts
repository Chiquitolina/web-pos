import { Data, Week, WeeklyReport } from './models';
import { weekReport, weeklyProductKey } from './weeks';
import { validateIceCreamPortion } from './ice-cream';
// Recalculate missing portions in a derived report, preserving recorded portions,
// sales and the original closing snapshot. Match only the same product ID.
export function weeklyConsumptionReport(data:Data,week:Week):WeeklyReport {
 const report=weekReport(data,week);
 const catalog=new Map(data.products.map(p=>[p.id,p]));
 const rows=new Map<string,WeeklyReport['products'][number]>();
 for(const original of report.products){
  const row={...original};
  if(row.iceCreamGrams===undefined){
   const product=catalog.get(row.id);
   if(product?.iceCreamGrams!==undefined){
    validateIceCreamPortion(product);
    row.iceCreamGrams=product.iceCreamGrams;
    if(product.iceCreamScoops!==undefined)row.iceCreamScoops=product.iceCreamScoops;
    row.recalculatedUnits=row.quantity;
   }
  }
  const key=weeklyProductKey(row),previous=rows.get(key);
  if(previous){previous.quantity+=row.quantity;previous.total+=row.total;const count=(previous.recalculatedUnits??0)+(row.recalculatedUnits??0);if(count)previous.recalculatedUnits=count;}
  else rows.set(key,row);
 }
 report.products=[...rows.values()].sort((a,b)=>b.quantity-a.quantity||a.id.localeCompare(b.id)||a.category.localeCompare(b.category));
 return report;
}
