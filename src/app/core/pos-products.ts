import { Product, ProductFamily } from './models';
import { boxUnits, presentationCaption, standardPresentation } from './presentation-kinds';

export type PosProductFilter='all'|'unit'|'box';
export type PosProductKind='unit'|'box'|'other';
export const posSearchKey=(text:string)=>text.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-AR').replace(/\s+/g,' ');

// Legacy labels are used only to place a card in a visual filter. They never
// assign families, infer physical box sizes or alter financial/report data.
function legacyKind(text:string):PosProductKind|undefined {
 const value=posSearchKey(text);
 if(/\b(?:por\s+unidad|x\s*(?:unidad|u\.?)|individual(?:es)?|suelt[oa]s?)\b/.test(value))return 'unit';
 if(/\bcajas?\b/.test(value))return 'box';
 if(/\b(?:unidad|unid\.?|1u)\s*$/.test(value))return 'unit';
 const count=value.match(/(?:\bx\s*(\d+)\s*(?:u(?:nidades?)?\.?)?|x\s*(\d+)\s*u)\s*$/);
 if(count){const n=Number(count[1]??count[2]);if(Number.isSafeInteger(n)&&n>0)return n===1?'unit':'box';}
 return undefined;
}
export function posProductKind(product:Product):PosProductKind {
 const kind=standardPresentation(product.presentation);
 if(kind==='Caja'||kind==='Caja 2')return 'box';
 if(kind==='Unidad')return 'unit';
 if(product.presentation?.trim())return 'other';
 return legacyKind(product.name)??legacyKind(product.gridoName??'')??'unit';
}
export const saleProducts=(products:Product[])=>products.filter(p=>p.active&&!p.deletedAt);
export function filterPosProducts(products:Product[],category:string,filter:PosProductFilter='all'):Product[] {
 return saleProducts(products).filter(p=>p.category===category&&(filter==='all'||posProductKind(p)===filter));
}
export function searchPosProducts(products:Product[],query:string):Product[] {
 const words=posSearchKey(query).split(' ').filter(Boolean);if(!words.length)return [];
 return saleProducts(products).filter(p=>{const text=posSearchKey(p.name+' '+(p.gridoName??''));return words.every(word=>text.includes(word));}).sort((a,b)=>a.name.localeCompare(b.name,'es',{sensitivity:'base',numeric:true})||a.category.localeCompare(b.category,'es')||a.id.localeCompare(b.id));
}
export function posProductCaption(product:Product,families:ProductFamily[]=[]):string {
 if(standardPresentation(product.presentation))return presentationCaption(product.presentation,boxUnits(product,families.find(f=>f.id===product.familyId)));
 const kind=posProductKind(product);return kind==='box'?'Por caja':kind==='unit'?'Por unidad':product.presentation??'Otra presentación';
}
