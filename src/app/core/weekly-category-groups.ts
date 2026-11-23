import { Data, WeeklyReport } from './models';
import { weeklyFamilyGroups, WeeklyFamilyGroup } from './product-families';
import { iceCreamConsumption } from './ice-cream';
export interface WeeklyCategoryGroup {
 key:string;
 category:WeeklyReport['categories'][number];
 products:WeeklyReport['products'];
 consumption:ReturnType<typeof iceCreamConsumption>;
 recalculatedUnits:number;
 families:WeeklyFamilyGroup[];
}
const key=(name:string,gridoName?:string)=>JSON.stringify([name,gridoName??'']);
// Categories and totals stay historical; family layout uses current catalog relationships.
export function weeklyCategoryGroups(report:WeeklyReport,catalog?:Pick<Data,'products'|'productFamilies'>):WeeklyCategoryGroup[] {
 const groups=report.categories.map(category=>({key:key(category.name,category.gridoName),category,products:[] as WeeklyReport['products']}));
 const byCategory=new Map(groups.map(group=>[group.key,group]));
 for(const product of report.products)byCategory.get(key(product.category,product.categoryGridoName))?.products.push(product);
 return groups.map(group=>({...group,families:weeklyFamilyGroups(group.products,catalog),consumption:iceCreamConsumption(group.products),recalculatedUnits:group.products.reduce((n,p)=>n+(p.recalculatedUnits??0),0)}));
}
