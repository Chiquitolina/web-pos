import { boxUnits, standardPresentation, presentationOrder } from './presentation-kinds';
import { Data, Product, ProductFamily, WeeklyReport } from './models';
import { categoryKey, categoryName } from './categories';
import { boxEquivalence, BoxEquivalence, validUnitsPerBox } from './box-equivalents';
export const catalogFamilies=(data:Pick<Data,'productFamilies'>):ProductFamily[]=>(data.productFamilies??[]).filter(f=>!f.deletedAt);
export function validateFamilies(data:Data):void {
 const families=data.productFamilies??[];
 if(!Array.isArray(families)||new Set(families.map(f=>f?.id)).size!==families.length)throw Error('Familias de productos inválidas');
 for(const f of families)if(!f||typeof f.id!=='string'||!f.id||typeof f.name!=='string'||!categoryName(f.name)||f.deletedAt!==undefined&&(typeof f.deletedAt!=='string'||!Number.isFinite(Date.parse(f.deletedAt))))throw Error('Familia de producto inválida');
 for(const f of families)if(f.category!==undefined&&(typeof f.category!=='string'||!categoryName(f.category)||!f.deletedAt&&!data.categories.some(c=>categoryKey(c)===categoryKey(f.category!))))throw Error('Categoría del producto base inválida');
 for(const f of families)if(f.unitsPerBox!==undefined&&!validUnitsPerBox(f.unitsPerBox))throw Error('Unidades por caja inválidas');
 for(const f of families)if(f.boxesPerPack!==undefined&&!validUnitsPerBox(f.boxesPerPack))throw Error('Cajas por pack inválidas');
 const live=catalogFamilies(data);if(new Set(live.map(f=>categoryKey(f.name))).size!==live.length)throw Error('Hay familias de productos duplicadas');
 for(const p of data.products){if(p.familyId!==undefined&&(typeof p.familyId!=='string'||!families.some(f=>f.id===p.familyId&&(p.deletedAt||!f.deletedAt))))throw Error('Familia del producto inválida');if(p.presentation!==undefined&&(typeof p.presentation!=='string'||!categoryName(p.presentation)||!p.familyId))throw Error('Elegí una familia para definir la presentación');}
}
export function addFamily(data:Data,id:string,nameInput:string):ProductFamily {
 const name=categoryName(nameInput);if(!name)throw Error('Ingresá el nombre de la familia');if(!id||(data.productFamilies??[]).some(f=>f.id===id))throw Error('ID de familia duplicado');if(catalogFamilies(data).some(f=>categoryKey(f.name)===categoryKey(name)))throw Error('Esa familia ya existe');
 const family={id,name};data.productFamilies??=[];data.productFamilies.push(family);return family;
}
export function renameFamily(data:Data,id:string,nameInput:string):void {
 const f=catalogFamilies(data).find(f=>f.id===id);if(!f)throw Error('Familia no encontrada');const name=categoryName(nameInput);if(!name)throw Error('Ingresá el nombre de la familia');if(catalogFamilies(data).some(other=>other.id!==id&&categoryKey(other.name)===categoryKey(name)))throw Error('Esa familia ya existe');f.name=name;
}
export function archiveFamily(data:Data,id:string,at=new Date().toISOString()):void {
 const f=catalogFamilies(data).find(f=>f.id===id);if(!f)throw Error('Familia no encontrada');if(data.products.some(p=>!p.deletedAt&&p.familyId===id))throw Error('Primero reasigná los productos de esta familia');f.deletedAt=at;
}
export function assignFamily(data:Data,ids:string[],familyId:string|null):void {
 if(familyId!==null&&!catalogFamilies(data).some(f=>f.id===familyId))throw Error('Elegí una familia válida');const products=[...new Set(ids)].map(id=>data.products.find(p=>p.id===id&&!p.deletedAt));if(!products.length||products.some(p=>!p))throw Error('Seleccioná productos existentes');
 for(const p of products as Product[]){if(familyId===null){delete p.familyId;delete p.presentation;}else p.familyId=familyId;}
}
export type FamilyReportProduct=WeeklyReport['products'][number]&{presentation?:string;unitsPerBox?:number};
export interface WeeklyFamilyGroup { key:string;id:string|null;name:string|null;products:FamilyReportProduct[];total:number;boxEquivalence?:BoxEquivalence }
const collator=new Intl.Collator('es',{sensitivity:'base',numeric:true});
// Group explicit catalog relationships by product ID, including already-sold items.
// Categories and financial snapshots remain those recorded in the weekly report.
export function weeklyFamilyGroups(products:WeeklyReport['products'],catalog?:Pick<Data,'products'|'productFamilies'>):WeeklyFamilyGroup[] {
 const byId=new Map((catalog?.products??[]).map(p=>[p.id,p])),families=new Map((catalog?.productFamilies??[]).map(f=>[f.id,f]));const groups=new Map<string,WeeklyFamilyGroup>();
 for(const p of products){const current=byId.get(p.id),family=current?.familyId?families.get(current.familyId):undefined;const key=family?'family:'+family.id:'unassigned';let group=groups.get(key);if(!group){group={key,id:family?.id??null,name:family?.name??null,products:[],total:0};groups.set(key,group);}const capacity=current?boxUnits(current,family):undefined;group.products.push({...p,...(family&&current?.presentation?{presentation:standardPresentation(current.presentation)??current.presentation}:{}),...(capacity!==undefined?{unitsPerBox:capacity}:{})});group.total+=p.total;}
 const ordered=[...groups.values()].sort((a,b)=>a.name===null?1:b.name===null?-1:collator.compare(a.name,b.name)||a.key.localeCompare(b.key));
 for(const g of ordered){
  g.products.sort((a,b)=>presentationOrder(a.presentation)-presentationOrder(b.presentation)||collator.compare(a.presentation??'',b.presentation??'')||collator.compare(a.name,b.name)||a.id.localeCompare(b.id));
  const family=g.id?families.get(g.id):undefined;
  if(family?.unitsPerBox!==undefined)g.boxEquivalence=boxEquivalence(g.products,family.unitsPerBox,family.boxesPerPack);
 }
 return ordered;
}
