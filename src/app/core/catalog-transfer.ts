import { Data, Product, Category, ProductFamily } from './models';
import { catalogFamilies } from './product-families';
import { catalogCategories, validateCatalog } from './catalog';
import { categoryKey, categoryName } from './categories';
import { validateData } from './domain';
export interface PortableProduct { name:string; gridoName:string; category:string; price:number; active:boolean; family?:string; presentation?:string; unitsPerBox?:number; vatRate?:number; iceCreamGrams?:number; iceCreamScoops?:number }
export interface PortableFamily { name:string;category?:string;unitsPerBox?:number;boxesPerPack?:number }
export interface CatalogFile { format:'heladeria-products'; version:1; exportedAt:string; families?:(string|PortableFamily)[]; categories:{name:string;gridoName:string}[]; products:PortableProduct[] }
const portableFamily=(f:PortableFamily):string|PortableFamily=>f.category||f.unitsPerBox!==undefined||f.boxesPerPack!==undefined?{name:f.name,...(f.category?{category:f.category}:{}),...(f.unitsPerBox!==undefined?{unitsPerBox:f.unitsPerBox}:{}),...(f.boxesPerPack!==undefined?{boxesPerPack:f.boxesPerPack}:{})}:f.name;
const identity=(p:PortableProduct|Product)=>JSON.stringify([categoryKey(p.gridoName??p.name),categoryKey(p.name),categoryKey(p.category)]);
export function exportCatalog(data:Data,at=new Date().toISOString()):CatalogFile {
 const families=catalogFamilies(data),byId=new Map(families.map(f=>[f.id,f.name]));
 return {format:'heladeria-products',version:1,exportedAt:at,...(data.productFamilies!==undefined?{families:families.map(portableFamily)}:{}),categories:catalogCategories(data).map(c=>({name:c.name,gridoName:c.gridoName})),products:data.products.filter(p=>!p.deletedAt).map(p=>({name:p.name,gridoName:p.gridoName??p.name,category:p.category,price:p.price,active:p.active,...(p.familyId&&byId.has(p.familyId)?{family:byId.get(p.familyId)!,...(p.presentation?{presentation:p.presentation}:{})}:{}),...(p.vatRate!==undefined?{vatRate:p.vatRate}:{}),...(p.iceCreamGrams!==undefined?{iceCreamGrams:p.iceCreamGrams}:{}),...(p.iceCreamScoops!==undefined?{iceCreamScoops:p.iceCreamScoops}:{}),...(p.unitsPerBox!==undefined?{unitsPerBox:p.unitsPerBox}:{})}))};
}
export function validateCatalogFile(input:unknown):CatalogFile {
 const f=input as CatalogFile;
 if(!f||f.format!=='heladeria-products'||f.version!==1||!Array.isArray(f.products)||!Array.isArray(f.categories))throw Error('Elegí un archivo de productos y categorías exportado desde esta app, no un respaldo completo');
 const text=(value:unknown)=>{if(typeof value!=='string'||!categoryName(value))throw Error('Nombre de catálogo inválido');return categoryName(value);};
 const categories=f.categories.map(c=>{if(!c)throw Error('Categoría inválida');return {name:text(c.name),gridoName:text(c.gridoName)};});
 const families=f.families===undefined?undefined:(()=>{if(!Array.isArray(f.families))throw Error('Familias inválidas');const entries=f.families.map(entry=>typeof entry==='string'?{name:text(entry)}:{name:text(entry?.name),...(entry?.category!==undefined?{category:text(entry.category)}:{}),...(entry?.unitsPerBox!==undefined?{unitsPerBox:entry.unitsPerBox}:{}),...(entry?.boxesPerPack!==undefined?{boxesPerPack:entry.boxesPerPack}:{})});if(new Set(entries.map(e=>categoryKey(e.name))).size!==entries.length)throw Error('Familias duplicadas');return entries;})();
 const products=f.products.map(p=>{if(!p)throw Error('Producto inválido');return {name:text(p.name),gridoName:text(p.gridoName),category:text(p.category),price:p.price,active:p.active,...(p.family!==undefined?{family:text(p.family)}:{}),...(p.presentation!==undefined?{presentation:text(p.presentation)}:{}),...(p.vatRate!==undefined?{vatRate:p.vatRate}:{}),...(p.iceCreamGrams!==undefined?{iceCreamGrams:p.iceCreamGrams}:{}),...(p.iceCreamScoops!==undefined?{iceCreamScoops:p.iceCreamScoops}:{}),...(p.unitsPerBox!==undefined?{unitsPerBox:p.unitsPerBox}:{})};});
 for(const p of products){if(p.family!==undefined&&!families?.some(entry=>categoryKey(entry.name)===categoryKey(p.family!)))throw Error('Familia desconocida en el archivo');if(p.presentation&&!p.family)throw Error('Presentación sin familia');}
 const familyRows=(families??[]).map((entry,i)=>({id:'family-'+i,...entry}));
 const d:Data={version:1,...(families!==undefined?{productFamilies:familyRows}:{}),categories:categories.map(c=>c.name),categoryDetails:categories.map((c,i)=>({...c,id:'category-'+i})),products:products.map((p,i)=>{const {family,...row}=p;return {...row,id:'product-'+i,...(family?{familyId:familyRows.find(f=>categoryKey(f.name)===categoryKey(family))!.id}:{})};}),sales:[],sessions:[],weeks:[]};
 validateData(d);
 if(new Set(products.map(identity)).size!==products.length)throw Error('El archivo contiene productos duplicados');
 return {format:'heladeria-products',version:1,exportedAt:typeof f.exportedAt==='string'?f.exportedAt:'',...(families!==undefined?{families:families.map(portableFamily)}:{}),categories,products};
}
export interface CatalogImportResult { added:number; updated:number; removedProducts:number; removedCategories:number }
// Replace the live catalog, retaining archived records for historical references.
export function importCatalog(data:Data,input:unknown,newId:()=>string=()=>crypto.randomUUID(),at=new Date().toISOString()):CatalogImportResult {
 const file=validateCatalogFile(input),next=structuredClone(data),existing=next.products.filter(p=>!p.deletedAt),used=new Set<string>();let added=0,updated=0,removedProducts=0,removedCategories=0;
 const currentCategories=catalogCategories(next),categoryIds=new Set<string>(),categories:Category[]=[];
 for(const c of file.categories){
  let local=currentCategories.find(x=>categoryKey(x.name)===categoryKey(c.name));
  if(local)Object.assign(local,c);else{const id=newId();if((next.categoryDetails??[]).some(x=>x.id===id)||categoryIds.has(id))throw Error('ID de categoría duplicado');local={id,...c};}
  categoryIds.add(local.id);categories.push(local);
 }
 const currentFamilies=catalogFamilies(next),familyIds=new Set<string>(),families:ProductFamily[]=[];
 for(const entry of file.families??[]){const name=typeof entry==='string'?entry:entry.name,category=typeof entry==='string'?undefined:entry.category;let local=currentFamilies.find(f=>categoryKey(f.name)===categoryKey(name));if(local)local.name=name;else{const id=newId();if((next.productFamilies??[]).some(f=>f.id===id)||familyIds.has(id))throw Error('ID de familia duplicado');local={id,name};}if(category!==undefined)local.category=categories.find(c=>categoryKey(c.name)===categoryKey(category))!.name;else delete local.category;if(typeof entry==='string'||entry.unitsPerBox===undefined)delete local.unitsPerBox;else local.unitsPerBox=entry.unitsPerBox;if(typeof entry==='string'||entry.boxesPerPack===undefined)delete local.boxesPerPack;else local.boxesPerPack=entry.boxesPerPack;familyIds.add(local.id);families.push(local);}
 const products:Product[]=[];
 for(const p of file.products){
  const code=categoryKey(p.gridoName),exact=existing.filter(x=>identity(x)===identity(p));
  let local=exact.length===1?exact[0]:undefined;
  if(!local&&exact.length===0&&file.products.filter(x=>categoryKey(x.gridoName)===code).length===1){const sameCode=existing.filter(x=>categoryKey(x.gridoName??x.name)===code);if(sameCode.length===1)local=sameCode[0];}
  // Ambiguous local matches get a fresh ID; their original records are archived.
  if(local&&used.has(local.id))local=undefined;
  const category=categories.find(c=>categoryKey(c.name)===categoryKey(p.category))!.name;
  const {family,...portable}=p;const row={...portable,category,...(family?{familyId:families.find(f=>categoryKey(f.name)===categoryKey(family))!.id}:{})};
  if(local){used.add(local.id);Object.assign(local,row);if(p.vatRate===undefined)delete local.vatRate;for(const field of ['iceCreamGrams','iceCreamScoops','familyId','presentation','unitsPerBox'] as const)if(row[field]===undefined)delete local[field];products.push(local);updated++;}
  else{const id=newId();if(next.products.some(x=>x.id===id)||products.some(x=>x.id===id))throw Error('ID de producto duplicado');products.push({id,...row});added++;}
 }
 for(const p of existing)if(!used.has(p.id)){p.active=false;p.deletedAt=at;removedProducts++;}
 for(const c of currentCategories)if(!categoryIds.has(c.id)){c.deletedAt=at;removedCategories++;}
 for(const f of currentFamilies)if(!familyIds.has(f.id))f.deletedAt=at;
 if(next.productFamilies!==undefined||file.families!==undefined)next.productFamilies=[...families,...(next.productFamilies??[]).filter(f=>f.deletedAt)];
 next.products=[...products,...next.products.filter(p=>p.deletedAt)];
 next.categories=categories.map(c=>c.name);
 next.categoryDetails=[...categories,...(next.categoryDetails??[]).filter(c=>c.deletedAt)];
 validateCatalog(next);
 data.products=next.products;data.categories=next.categories;data.categoryDetails=next.categoryDetails;if(next.productFamilies!==undefined)data.productFamilies=next.productFamilies;
 return {added,updated,removedProducts,removedCategories};
}
