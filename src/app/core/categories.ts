import { Data } from './models';
export function categoryName(value:string):string {return value.trim().replace(/\s+/g,' ');}
export function categoryKey(value:string):string {return categoryName(value).normalize('NFC').toLocaleLowerCase('es-AR');}
export function addCategory(data:Data, input:string, gridoName=input, id:string=crypto.randomUUID()):string {
 const name=categoryName(input);
 if(!name)throw Error('Ingresá el nombre de la categoría');
 if(data.categories.some(c=>categoryKey(c)===categoryKey(name)))throw Error('Esa categoría ya existe');
 if(!gridoName.trim())throw Error('Ingresá el nombre o código Grido');
 data.categories.push(name);data.categoryDetails??=[];data.categoryDetails.push({id,name,gridoName:categoryName(gridoName)});return name;
}
export function findCategory(data:Data, input:string):string {
 const name=data.categories.find(c=>categoryKey(c)===categoryKey(input));
 if(!name)throw Error('Seleccioná una categoría de la lista');return name;
}
// Existing V1 data used free-text product categories. Build the catalog without
// dropping those categories, while preserving separately created unused names.
export function migrateCategories(data:Data):Data {
 const next=structuredClone(data);const names=new Map<string,string>();
 for(const name of next.categories??[])if(categoryName(name))names.set(categoryKey(name),categoryName(name));
 for(const p of next.products){if(p.deletedAt)continue;const key=categoryKey(p.category);if(!names.has(key))names.set(key,categoryName(p.category));p.category=names.get(key)!;}
 next.categories=[...names.values()];return next;
}
export function validateCategories(data:Data):void {
 // Missing catalog is supported exclusively as the legacy V1 format.
 if(data.categories===undefined)return;
 if(!Array.isArray(data.categories)||data.categories.some(c=>typeof c!=='string'||!categoryName(c)))throw Error('Lista de categorías inválida');
 if(new Set(data.categories.map(categoryKey)).size!==data.categories.length)throw Error('Categorías duplicadas');
 for(const p of data.products)if(!p.deletedAt)findCategory(data,p.category);
}
