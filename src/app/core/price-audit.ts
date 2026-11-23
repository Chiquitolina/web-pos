import { standardPresentation } from './presentation-kinds';
import { PriceAuditEntry, PriceAuditSource, Product, ProductAuditField, ProductAuditChange, ProductFamily } from './models';
const fields:ProductAuditField[]=['name','gridoName','category','price','vatRate','iceCreamGrams','iceCreamScoops','active','familyId','familyName','presentation','unitsPerBox','boxesPerPack','referenceUnitsPerBox'];
function validValue(field:ProductAuditField,value:unknown):boolean {if(value===null)return true;if(['name','gridoName','category','familyId','familyName','presentation'].includes(field))return typeof value==='string'&&value.trim().length>0;if(field==='active')return typeof value==='boolean';if(typeof value!=='number'||!Number.isFinite(value))return false;if(field==='vatRate')return value>=0&&value<=100&&Math.abs(value*100-Math.round(value*100))<1e-7;return Number.isSafeInteger(value)&&(field==='iceCreamGrams'?value>=0:value>0);}
export function validatePriceAudit(input:unknown):asserts input is PriceAuditEntry[] {
 if(!Array.isArray(input)||new Set(input.map(r=>r?.id)).size!==input.length)throw Error('Historial de precios inválido');
 const text=(v:unknown)=>typeof v==='string'&&v.trim().length>0;
 const price=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0;
 for(const r of input){
  if(!r||!text(r.id)||typeof r.at!=='string'||!Number.isFinite(Date.parse(r.at))||!['PRODUCT_EDIT','CATEGORY_EDIT','FAMILY_EDIT','CATALOG_IMPORT','BACKUP_RESTORE'].includes(r.source))throw Error('Registro de precios inválido');
  if(!text(r.productName)||typeof r.gridoName!=='string'||typeof r.category!=='string'||r.previousName!==undefined&&!text(r.previousName))throw Error('Detalle de auditoría inválido');
  if(r.changes!==undefined&&(!Array.isArray(r.changes)||!r.changes.length||new Set(r.changes.map((c:ProductAuditChange)=>c?.field)).size!==r.changes.length||r.changes.some((c:ProductAuditChange)=>!c||!fields.includes(c.field)||!validValue(c.field,c.previous)||!validValue(c.field,c.next)||c.previous===c.next)))throw Error('Detalle de cambios de producto inválido');
  const priceChange=r.changes?.find((c:ProductAuditChange)=>c.field==='price');if(priceChange&&(priceChange.previous!==r.previousPrice||priceChange.next!==r.newPrice))throw Error('Precios del detalle inconsistentes');
  if(r.action==='BACKUP_RESTORED'){if(r.source!=='BACKUP_RESTORE'||r.productId!==null||r.previousPrice!==null||r.newPrice!==null||r.changes!==undefined)throw Error('Restauración de precios inválida');continue;}
  if(!text(r.productId)||!text(r.productName)||!text(r.gridoName)||!text(r.category))throw Error('Producto del historial de precios inválido');
  if(r.action==='PRODUCT_EDITED'&&price(r.previousPrice)&&r.previousPrice===r.newPrice&&r.changes?.length&&!priceChange)continue;
  if(r.action==='PRICE_CHANGED'&&r.changes&&!priceChange)throw Error('Falta el cambio de precio en el detalle');
  if(r.action==='PRICE_CHANGED'&&price(r.previousPrice)&&price(r.newPrice)&&r.previousPrice!==r.newPrice)continue;
  if(r.action==='PRODUCT_ADDED'&&r.previousPrice===null&&price(r.newPrice))continue;
  if(r.action==='PRODUCT_REMOVED'&&price(r.previousPrice)&&r.newPrice===null)continue;
  throw Error('Cambio de precio inválido');
 }
}
export function productAuditChanges(before:Product[],after:Product[],source:PriceAuditSource,beforeFamilies:ProductFamily[]=[],afterFamilies:ProductFamily[]=[]):Omit<PriceAuditEntry,'id'|'at'>[] {
 const familyBefore=new Map(beforeFamilies.map(f=>[f.id,f])),familyAfter=new Map(afterFamilies.map(f=>[f.id,f]));
 const value=(p:Product|undefined,field:ProductAuditField,families:Map<string,ProductFamily>)=>{
  const family=p?.familyId?families.get(p.familyId):undefined;
  if(field==='familyName')return p?.familyId?family?.name??p.familyId:null;
  if(field==='referenceUnitsPerBox')return family?.unitsPerBox??null;
  if(field==='unitsPerBox')return standardPresentation(p?.presentation)==='Caja 2'?p?.unitsPerBox??null:family?.unitsPerBox??p?.unitsPerBox??null;
  if(field==='boxesPerPack')return family?.boxesPerPack??null;
  return p?.[field]??null;
 };
 const old=new Map(before.filter(p=>!p.deletedAt).map(p=>[p.id,p])),next=new Map(after.filter(p=>!p.deletedAt).map(p=>[p.id,p]));
 const changes:Omit<PriceAuditEntry,'id'|'at'>[]=[];
 for(const id of new Set([...old.keys(),...next.keys()])){
  const previous=old.get(id),current=next.get(id),p=current??previous!;
  const detail:ProductAuditChange[]=fields.flatMap(field=>{const oldValue=value(previous,field,familyBefore),newValue=value(current,field,familyAfter);return oldValue===newValue?[]:[{field,previous:oldValue,next:newValue}];});
  if(!detail.length)continue;
  const action=!previous?'PRODUCT_ADDED':!current?'PRODUCT_REMOVED':previous.price!==current.price?'PRICE_CHANGED':'PRODUCT_EDITED';
  changes.push({action,source,changes:detail,productId:id,productName:p.name,gridoName:p.gridoName??p.name,category:p.category,previousPrice:previous?.price??null,newPrice:current?.price??null,...(previous&&previous.name!==p.name?{previousName:previous.name}:{})});
 }
 return changes;
}

export function samePriceAudit(a:PriceAuditEntry,b:PriceAuditEntry):boolean {const values=(r:PriceAuditEntry)=>[r.id,r.at,r.action,r.source,r.productId,r.productName,r.gridoName,r.category,r.previousName??null,r.previousPrice,r.newPrice,r.changes?.map(c=>[c.field,c.previous,c.next]).sort((x,y)=>String(x[0]).localeCompare(String(y[0])))??null];return JSON.stringify(values(a))===JSON.stringify(values(b));}
