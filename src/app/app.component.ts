import { filterPosProducts, PosProductFilter, posProductKind, saleProducts, posProductCaption } from './core/pos-products';
import { PosProductSearchComponent } from './pos-product-search.component';
import { MetricsComponent } from './metrics.component';
import { boxUnits, presentationCaption } from './core/presentation-kinds';
import { setUnitsPerBox, setBoxesPerPack, validUnitsPerBox } from './core/box-equivalents';
import { FamilyPackagingComponent } from './family-packaging.component';
import { MovementReceiptComponent } from './movement-receipt.component';
import { movementReceiptView, MovementReceiptView, recordCashMovement } from './core/movement-receipt';
import { ProductPresentationsComponent, PresentationStart } from './product-presentations.component';
import { saveBaseProduct, BaseProductDraft, standardPresentation } from './core/product-presentations';
import { catalogFamilies } from './core/product-families';
import { catalogEntries, CatalogEntry, groupExistingProducts, ExistingProductGroupDraft, separateProductGroup, deleteProductGroup } from './core/catalog-groups';
import { CatalogDialogComponent } from './catalog-dialog.component';
import { GroupProductsComponent } from './group-products.component';
import { ClosingReceiptComponent } from './closing-receipt.component';
import { closingReceiptView, ClosingReceiptView } from './core/closing-receipt';
import { verifyAuditAccess } from './core/audit-access';
import { PriceAuditComponent } from './price-audit.component';
import { Component, ChangeDetectorRef, computed, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StorageService } from './core/storage.service';
import { Item, Payment, Sale, Week, Session, Product, Category } from './core/models';
import { money, closeSession, netSessionClosing, validateData } from './core/domain';
import { CashCountComponent } from './cash-count.component';
import { emptyCashCount, cashCountTotal } from './core/cash-count';
import { addCategory } from './core/categories';
import { catalogCategories, saveProduct, deleteProduct, renameCategory, deleteCategory } from './core/catalog';
import { activeWeek, beginWeek, finishWeek, mondayDate, localDate, startOfDate } from './core/weeks';
import { weeklyCsv } from './core/weekly-csv';
import { cancelSale } from './core/cancellations';
import { WeeklyReportComponent } from './weekly-report.component';
import { ReceiptComponent } from './receipt.component';
import { prepareReceiptPage, clearReceiptPage } from './core/receipt-print';
import { paymentName } from './core/receipt';
import { HistoryFilter } from './core/history';
import { summarizeSales } from './core/weeks';
import { snapshotIceCreamPortion } from './core/ice-cream';
import { weeklyConsumptionReport } from './core/weekly-consumption-report';
import { exportCatalog, importCatalog, validateCatalogFile, CatalogImportResult } from './core/catalog-transfer';
import { environment } from '../environments/environment';
@Component({selector:'app-root',standalone:true,imports:[MetricsComponent,PosProductSearchComponent,FamilyPackagingComponent,CatalogDialogComponent,GroupProductsComponent,ProductPresentationsComponent,MovementReceiptComponent,ClosingReceiptComponent,PriceAuditComponent,FormsModule,CashCountComponent,WeeklyReportComponent,ReceiptComponent],templateUrl:'./app.component.html'})
export class AppComponent {
 store=inject(StorageService); title=environment.storeName;timeZone=environment.timeZone;vatRate:number|null=null;iceCreamGrams:number|null=null;iceCreamScoops:number|null=null;historyMode:'current'|'session'|'day'|'all'='current';historySessionId='';historyDate=localDate(new Date().toISOString());
 readonly turnSummary=computed(()=>{const d=this.store.data(),s=d.sessions.find(s=>!s.closing);return s?summarizeSales(d.sales.filter(v=>v.sessionId===s.id)):null;}); private _tab='Venta';get tab(){return this._tab;}set tab(value:string){this._tab=value;if(value!=='Control de productos')this.auditUnlocked=false;} tabs=['Venta','Productos','Categorías','Semana','Métricas','Caja','Cierres','Historial','Respaldo'];
 private readonly posFilters=new Map<string,PosProductFilter>();
 cart=signal<Item[]>([]); busy=signal(false); message=signal(''); receipt=signal<Sale|null>(null);closingReceipt=signal<ClosingReceiptView|null>(null);movementReceipt=signal<MovementReceiptView|null>(null);
 payment:Payment='CASH';received=0;openingCount=emptyCashCount();closingCount=emptyCashCount();amount=0;reason='';type:'IN'|'OUT'='OUT';name='';category='';categoryDraft='';price=0;weekStart=mondayDate();selectedPosCategory='';gridoName='';categoryGridoDraft='';editingProductId='';categoryEditor:Category|null=null;categoryDeletion:Category|null=null;categoryDeletionTarget='';
 creationMode:'presentations'|'simple'='presentations';presentationStart:PresentationStart={key:0};presentationReset=0;
 presentation='';productUnitsPerBox:number|null=null;productSpecificBoxUnits:number|null=null;productBoxesPerPack:number|null=null;productActive=true;catalogSearch='';catalogDialog:'product'|'group'|null=null;groupFamilyId='';
 auditUnlocked=false;showAuditAccess=false;auditPin='';auditAccessError='';auditAccessBusy=false;private readonly auditDetector=inject(ChangeDetectorRef);private auditTaps=0;private auditLastTap=0;
 auditTap(){if(this.showAuditAccess)return;const now=Date.now();this.auditTaps=now-this.auditLastTap>4000?1:this.auditTaps+1;this.auditLastTap=now;if(this.auditTaps<5)return;this.auditTaps=0;this.auditPin='';this.auditAccessError='';this.showAuditAccess=true;}
 closeAuditAccess(){if(this.auditAccessBusy)return;this.showAuditAccess=false;this.auditPin='';this.auditAccessError='';}
 async unlockPriceAudit(){if(this.auditAccessBusy)return;this.auditAccessBusy=true;this.auditAccessError='';try{if(!await verifyAuditAccess(localStorage,environment.dbName,this.auditPin))throw Error('Clave incorrecta.');this.auditUnlocked=true;this.showAuditAccess=false;this.auditPin='';this.tab='Control de productos';}catch(e){this.auditAccessError=e instanceof Error?e.message:'No se pudo ingresar';}finally{this.auditAccessBusy=false;this.auditDetector.markForCheck();}}
 closePriceAudit(){this.auditUnlocked=false;this.tab='Venta';}
 constructor(){const beforePrint=()=>prepareReceiptPage(document);window.addEventListener('beforeprint',beforePrint);inject(DestroyRef).onDestroy(()=>{window.removeEventListener('beforeprint',beforePrint);clearReceiptPage(document);});this.store.init().catch(e=>this.message.set('No se pudo abrir almacenamiento: '+e.message));}
 get managedCategories(){return catalogCategories(this.store.data());}
 get deletionTargets(){return this.managedCategories.filter(c=>c.id!==this.categoryDeletion?.id);}
 get catalogCategory(){const categories=this.store.data().categories;return categories.includes(this.category)?this.category:categories[0]??'';}
 set catalogCategory(value:string){this.category=value;this.catalogSearch='';}
 get visibleCatalogProducts(){return this.store.data().products.filter(p=>!p.deletedAt&&p.category===this.catalogCategory);}
 get managedFamilies(){return catalogFamilies(this.store.data()).slice().sort((a,b)=>a.name.localeCompare(b.name,'es'));}
 get catalogList(){return catalogEntries(this.store.data(),this.catalogCategory,this.catalogSearch);}
 get catalogCount(){return catalogEntries(this.store.data(),this.catalogCategory).length;}
 get ungroupedProducts(){return this.visibleCatalogProducts.filter(p=>!p.familyId);}
 get editingBase(){return this.managedFamilies.find(f=>f.id===this.presentationStart.familyId);}
 familyUnitsPerBox(id?:string){return this.store.data().productFamilies?.find(f=>f.id===id)?.unitsPerBox;}
 familyBoxesPerPack(id?:string){return this.store.data().productFamilies?.find(f=>f.id===id)?.boxesPerPack;}
 productPresentation(p:Product){return presentationCaption(p.presentation,boxUnits(p,this.store.data().productFamilies?.find(f=>f.id===p.familyId)));}
 get editedProduct(){return this.store.data().products.find(p=>p.id===this.editingProductId&&!p.deletedAt);}
 get editingSecondBox(){return standardPresentation(this.editedProduct?.presentation)==='Caja 2';}
 get editingBaseProducts(){return this.store.data().products.filter(p=>!p.deletedAt&&p.familyId===this.editingBase?.id&&!!p.familyId);}
 get productDialogTitle(){return this.editingProductId?'Editar producto':this.editingBase?.name??'Nuevo producto';}
 needsPresentation(entry:CatalogEntry){return !!entry.familyId&&['Caja','Caja 2','Unidad'].some(kind=>!entry.products.some(p=>standardPresentation(p.presentation)===kind));}
 resetPresentationForm(){this.presentationStart={key:this.presentationStart.key+1};this.presentationReset++;}
 openNewProduct(){this.message.set('');this.cancelProductEdit();this.resetPresentationForm();this.creationMode='presentations';this.catalogDialog='product';}
 openCatalogEntry(entry:CatalogEntry){if(entry.familyId)this.addFamilyPresentation(entry.familyId);else this.beginProductEdit(entry.products[0]);}
 closeCatalogDialog(){if(this.busy())return;this.finishCatalogEdit();this.message.set('');}
 private finishCatalogEdit(){this.catalogDialog=null;this.cancelProductEdit();this.resetPresentationForm();}
 savePresentations(draft:BaseProductDraft){this.run(async()=>{await this.store.update(d=>{saveBaseProduct(d,draft);});this.cart.update(items=>items.filter(i=>this.store.data().products.some(p=>p.id===i.productId&&p.active&&!p.deletedAt)));this.finishCatalogEdit();});}
 openGroupProducts(familyId=''){this.message.set('');this.groupFamilyId=familyId;this.catalogDialog='group';}
 saveProductGroup(draft:ExistingProductGroupDraft){this.run(async()=>{await this.store.update(d=>{groupExistingProducts(d,draft);},{priceSource:'FAMILY_EDIT'});this.finishCatalogEdit();});}
 separateBase(){const family=this.editingBase;if(!family||!confirm('¿Separar los productos de '+family.name+'? Cada uno volverá a aparecer por separado. Sus precios y ventas se conservan.'))return;this.run(async()=>{await this.store.update(d=>separateProductGroup(d,family.id),{priceSource:'FAMILY_EDIT'});this.finishCatalogEdit();});}
 removeBase(){const family=this.editingBase;if(!family||!confirm('¿Eliminar '+family.name+' y todas sus formas de venta del catálogo? Las ventas, tickets y cierres anteriores se conservan.'))return;this.run(async()=>{await this.store.update(d=>deleteProductGroup(d,family.id));this.cart.update(items=>items.filter(i=>this.store.data().products.some(p=>p.id===i.productId&&p.active&&!p.deletedAt)));this.finishCatalogEdit();});}
 categoryBases(name:string){return this.managedFamilies.filter(f=>f.category===name).length;}
 addFamilyPresentation(familyId:string){this.message.set('');this.cancelProductEdit();this.creationMode='presentations';this.presentationStart={key:this.presentationStart.key+1,familyId};this.catalogDialog='product';}
 get posCategories(){const d=this.store.data();return d.categories.filter(c=>d.products.some(p=>!p.deletedAt&&p.active&&p.category===c));}
 get posCategory(){const categories=this.posCategories;return categories.includes(this.selectedPosCategory)?this.selectedPosCategory:categories[0]??'';}
 get posCategoryIndex(){return this.posCategories.indexOf(this.posCategory);}
 get posSaleProducts(){return saleProducts(this.store.data().products);}
 get posCategoryProducts(){return filterPosProducts(this.store.data().products,this.posCategory);}
 get posPresentationFilter():PosProductFilter{return this.posFilters.get(this.posCategory)??'all';}
 get posProducts(){return filterPosProducts(this.store.data().products,this.posCategory,this.posPresentationFilter);}
 posFilterCount(filter:PosProductFilter){return filterPosProducts(this.store.data().products,this.posCategory,filter).length;}
 setPosFilter(filter:PosProductFilter){this.posFilters.set(this.posCategory,filter);}
 posCaption(product:Product){return posProductCaption(product,this.store.data().productFamilies);}
 pickPosProduct(id:string){if(this.busy()||!this.session)return;const product=this.store.data().products.find(p=>p.id===id&&p.active&&!p.deletedAt);if(!product)return;this.selectedPosCategory=product.category;const kind=posProductKind(product);if(this.posPresentationFilter!=='all'&&kind!==this.posPresentationFilter)this.setPosFilter(kind==='other'?'all':kind);this.add(product.id);}
 movePosCategory(direction:number){const categories=this.posCategories;if(categories.length<2)return;this.selectedPosCategory=categories[(this.posCategoryIndex+direction+categories.length)%categories.length];}
 get week(){return activeWeek(this.store.data());}
 get weekly(){return this.week?weeklyConsumptionReport(this.store.data(),this.week):null;}
 get closedWeeks(){return this.store.data().weeks.filter(w=>w.closing).slice().reverse();}
 get unassignedSales(){return this.store.stats().unassignedCount;}
 get today(){return localDate(new Date().toISOString());}
 startWeek(){const date=this.weekStart;this.run(()=>this.store.update(d=>{beginWeek(d,crypto.randomUUID(),date);},{fromDate:startOfDate(date)}));}
 closeWeek(){const id=this.week?.id;if(!id)return;if(!confirm('¿Guardar el cierre semanal y descargar CSV? La siguiente semana quedará abierta automáticamente.'))return;this.run(async()=>{let closed:Week|undefined;await this.store.update(d=>{closed=structuredClone(finishWeek(d,id,crypto.randomUUID()));},{weekId:id});this.downloadWeek(closed!);});}
 downloadWeek(week:Week){const url=URL.createObjectURL(new Blob([weeklyCsv(week,this.store.data())],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='cierre-semanal-'+localDate(week.startedAt)+'-'+localDate(week.closing!.at)+'-'+week.id.slice(0,8)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 get historyTotal(){return this.store.historyStats().total;}
 get turnCancelled(){return this.store.data().sales.filter(s=>s.sessionId===this.session?.id&&s.cancellation).length;}
 paymentLabel=paymentName;
 async changeHistoryFilter(){
  if(this.historyMode==='session'&&!this.historySessionId)this.historySessionId=this.session?.id??this.store.data().sessions.at(-1)?.id??'';
  const filter:HistoryFilter=this.historyMode==='day'?{kind:'day',date:this.historyDate}:this.historyMode==='session'?{kind:'session',sessionId:this.historySessionId}:{kind:this.historyMode};
  try{await this.store.setHistoryFilter(filter);}catch(e){this.message.set(e instanceof Error?e.message:'No se pudo cargar el historial');}
 }
 showTurnHistory(){this.historyMode='current';this.tab='Historial';this.changeHistoryFilter();}
 historyPage(direction:number){this.store.loadHistory(this.store.historyPage()+direction).catch(e=>this.message.set(e.message));}
 reportForWeek(week:Week){return weeklyConsumptionReport(this.store.data(),week);}
 netClosing(session:Session){return netSessionClosing(this.store.data(),session);}
 cancelledForSession(id:string){return this.store.data().sales.filter(s=>s.sessionId===id&&s.cancellation);}
 cancelledForWeek(id:string){return this.store.data().sales.filter(s=>s.weekId===id&&s.cancellation);}
 annulSale(sale:Sale){if(this.busy()||sale.cancellation)return;const reason=prompt('Motivo para anular el ticket #'+sale.number+':');if(reason===null)return;if(!reason.trim()){this.message.set('Ingresá un motivo de anulación');return;}if(!confirm('¿Anular el ticket #'+sale.number+' por '+this.fmt(sale.total)+'? Se descontará de los totales de su caja y semana y quedará registrado en el historial. Esta acción no procesa una devolución del medio de pago.'))return;this.run(async()=>{await this.store.update(d=>{cancelSale(d,sale.id,reason);},{saleId:sale.id});if(this.receipt()?.id===sale.id)this.receipt.set(this.store.data().sales.find(s=>s.id===sale.id)!);});}
 get session(){return this.store.data().sessions.find(s=>!s.closing);}
 countTotal(rows:typeof this.openingCount):number|null {try{return cashCountTotal(rows);}catch{return null;}}
 get openingTotal(){return this.countTotal(this.openingCount);}
 get closingTotal(){return this.countTotal(this.closingCount);}
 get total(){return this.cart().reduce((n,i)=>n+i.subtotal,0);}
 get expected(){return this.session?closeSession(this.store.data(),this.session,0).expected:0;}
 fmt(n:number){return new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(n/100);}
 date(s:string){return new Intl.DateTimeFormat('es-AR',{dateStyle:'short',timeStyle:'short',timeZone:environment.timeZone}).format(new Date(s));}
 async run(fn:()=>Promise<void>){if(this.busy())return;this.busy.set(true);this.message.set('');try{await fn();this.message.set('Guardado correctamente');}catch(e){this.message.set(e instanceof Error?e.message:'Error al guardar');}finally{this.busy.set(false);}}
 add(id:string){const p=this.store.data().products.find(p=>p.id===id);if(!p||p.deletedAt||!p.active)return;const items=structuredClone(this.cart());const i=items.find(i=>i.productId===id);if(i){i.quantity++;i.subtotal=i.quantity*i.unitPrice;}else items.push({productId:id,name:p.name,quantity:1,category:p.category,gridoName:p.gridoName??p.name,categoryGridoName:this.managedCategories.find(c=>c.name===p.category)?.gridoName??p.category,unitPrice:p.price,subtotal:p.price});this.cart.set(items);}
 remove(id:string){this.cart.update(items=>items.flatMap(i=>i.productId!==id?[i]:i.quantity>1?[{...i,quantity:i.quantity-1,subtotal:(i.quantity-1)*i.unitPrice}]:[]));}
 open(){const openingCount=structuredClone(this.openingCount);this.run(async()=>{const opening=cashCountTotal(openingCount);await this.store.update(d=>{if(d.sessions.some(s=>!s.closing))throw Error('Ya hay caja abierta');d.sessions.push({id:crypto.randomUUID(),openedAt:new Date().toISOString(),opening,openingCount,movements:[]});});this.openingCount=emptyCashCount();this.closingCount=emptyCashCount();});}
 charge(){this.run(async()=>{const id=this.session?.id,items=structuredClone(this.cart()),payment=this.payment,total=this.total,received=payment==='CASH'?money(this.received):total;if(!id||!items.length)throw Error('Abrí caja y agregá productos');if(received<total)throw Error('Efectivo insuficiente');let sale:Sale|undefined;await this.store.update((d,context)=>{if(!d.sessions.some(s=>s.id===id&&!s.closing))throw Error('Caja cerrada');for(const i of items){const p=d.products.find(p=>p.id===i.productId);if(!p?.active||p.deletedAt||p.price!==i.unitPrice)throw Error('Cambió un producto. Vaciá y rehacé la venta');snapshotIceCreamPortion(i,p);if(p.vatRate===undefined)delete i.vatRate;else i.vatRate=p.vatRate;i.name=p.name;i.gridoName=p.gridoName??p.name;i.category=p.category;i.categoryGridoName=catalogCategories(d).find(c=>c.name===p.category)?.gridoName??p.category;}sale={id:crypto.randomUUID(),number:context.nextSaleNumber,sessionId:id,...(activeWeek(d)?{weekId:activeWeek(d)!.id}:{}),at:new Date().toISOString(),items,total,payment,received,change:received-total};if(sale.weekId&&Date.parse(sale.at)<Date.parse(activeWeek(d)!.startedAt))throw Error('Revisá la fecha y hora del equipo');d.sales.push(sale);});this.closingReceipt.set(null);this.movementReceipt.set(null);this.receipt.set(sale!);this.cart.set([]);this.received=0;});}
 product(){
  const editing=!!this.editingProductId,id=this.editingProductId||crypto.randomUUID(),active=this.productActive;
  const familyId=this.editedProduct?.familyId,unitsPerBox=this.productUnitsPerBox,boxesPerPack=this.productBoxesPerPack,ownCapacity=this.productSpecificBoxUnits,presentation=this.editedProduct?.presentation;
  const changes={name:this.name,gridoName:this.gridoName,category:this.catalogCategory,price:this.price,vatRate:this.vatRate,iceCreamGrams:this.iceCreamGrams,iceCreamScoops:this.iceCreamScoops};
  this.run(async()=>{
   const price=money(changes.price);if(standardPresentation(presentation)==='Caja 2'&&!validUnitsPerBox(ownCapacity))throw Error('Indicá cuántas unidades trae la segunda caja');
   await this.store.update(d=>{
    const current=d.products.find(p=>p.id===id&&!p.deletedAt);
    if(editing&&!current)throw Error('El producto ya no existe');
    if(editing&&current?.familyId!==familyId||editing&&current?.presentation!==presentation)throw Error('Cambió la agrupación del producto. Volvé a abrir la ficha.');
    const p=saveProduct(d,id,{...changes,price,...(standardPresentation(presentation)==='Caja 2'?{unitsPerBox:ownCapacity}:{})});p.active=active;
    if(familyId){const family=d.productFamilies?.find(f=>f.id===familyId&&!f.deletedAt);if(!family)throw Error('La agrupación ya no está disponible');setUnitsPerBox(family,unitsPerBox);setBoxesPerPack(family,boxesPerPack);}
   });
   this.cart.update(items=>items.filter(i=>this.store.data().products.some(p=>p.id===i.productId&&p.active&&!p.deletedAt)));this.finishCatalogEdit();
  });
 }
 beginProductEdit(product:Product){this.message.set('');this.presentation=product.presentation??'';this.editingProductId=product.id;this.productSpecificBoxUnits=product.unitsPerBox??null;this.productUnitsPerBox=this.familyUnitsPerBox(product.familyId)??null;this.productBoxesPerPack=this.familyBoxesPerPack(product.familyId)??null;this.name=product.name;this.gridoName=product.gridoName??product.name;this.price=product.price/100;this.productActive=product.active;this.vatRate=product.vatRate??null;this.iceCreamGrams=product.iceCreamGrams??null;this.iceCreamScoops=product.iceCreamScoops??null;this.category=product.category;this.catalogDialog='product';}
 cancelProductEdit(){this.productSpecificBoxUnits=null;this.productUnitsPerBox=null;this.productBoxesPerPack=null;this.presentation='';this.editingProductId='';this.name='';this.gridoName='';this.price=0;this.productActive=true;this.vatRate=null;this.iceCreamGrams=null;this.iceCreamScoops=null;}
 setProductScoops(value:number|null){this.iceCreamScoops=value;if(value!=null)this.iceCreamGrams=value*80;}
 grams(n:number){return new Intl.NumberFormat('es-AR').format(n)+' g';}
 removeProduct(product:Product){if(!confirm('¿Eliminar '+product.name+' del catálogo? Sus ventas y cierres anteriores se conservan.'))return;this.run(async()=>{await this.store.update(d=>deleteProduct(d,product.id));this.cart.update(items=>items.filter(i=>i.productId!==product.id));this.finishCatalogEdit();});}
 openCategoryEditor(category:Category){this.message.set('');this.categoryEditor={...category};}
 saveCategoryEdit(){const draft=this.categoryEditor;if(!draft)return;const oldName=this.managedCategories.find(c=>c.id===draft.id)?.name;this.run(async()=>{let saved='';await this.store.update(d=>{saved=renameCategory(d,draft.id,draft.name,draft.gridoName).name;},{priceSource:'CATEGORY_EDIT'});if(this.catalogCategory===oldName||this.category===oldName)this.category=saved;if(this.selectedPosCategory===oldName)this.selectedPosCategory=saved;this.categoryEditor=null;});}
 openCategoryDeletion(category:Category){this.message.set('');this.categoryDeletion={...category};this.categoryDeletionTarget='';}
 confirmCategoryDeletion(){const category=this.categoryDeletion;if(!category)return;const target=this.categoryDeletionTarget;this.run(async()=>{await this.store.update(d=>deleteCategory(d,category.id,target||undefined),{priceSource:'CATEGORY_EDIT'});this.categoryDeletion=null;this.categoryDeletionTarget='';});}
 createCategory(){const name=this.categoryDraft,gridoName=this.categoryGridoDraft;this.run(async()=>{let saved='';await this.store.update(d=>{saved=addCategory(d,name,gridoName);});this.category=saved;this.categoryDraft='';this.categoryGridoDraft='';});}
 categoryProducts(name:string){return this.store.data().products.filter(p=>!p.deletedAt&&p.category===name).length;}
 async move(){if(this.busy())return;const sessionId=this.session?.id??'',type=this.type,value=this.amount,reason=this.reason;let saved=false;await this.run(async()=>{const movement={id:crypto.randomUUID(),at:new Date().toISOString(),type,amount:money(value),reason};let report:MovementReceiptView|undefined;await this.store.update(d=>{recordCashMovement(d,sessionId,movement);report=movementReceiptView(d.sessions.find(s=>s.id===sessionId)!,movement.id,this.title,this.timeZone);});this.reason='';this.amount=0;this.receipt.set(null);this.closingReceipt.set(null);this.movementReceipt.set(report!);saved=true;});if(saved)await this.printRenderedReceipt();}
 async reprintMovement(sessionId:string,movementId:string){if(this.busy())return;this.busy.set(true);this.message.set('');let loaded=false;try{const session=this.store.data().sessions.find(s=>s.id===sessionId);if(!session)throw Error('Turno no encontrado');const report=movementReceiptView(session,movementId,this.title,this.timeZone);this.receipt.set(null);this.closingReceipt.set(null);this.movementReceipt.set(report);loaded=true;}catch(e){this.message.set(e instanceof Error?e.message:'No se pudo cargar el comprobante');}finally{this.busy.set(false);}if(loaded)await this.printRenderedReceipt();}
 async close(){if(this.busy())return;if(!confirm('¿Guardar cierre definitivo e imprimir el resumen del turno?'))return;const id=this.session?.id,cashCount=structuredClone(this.closingCount);let saved=false;await this.run(async()=>{const counted=cashCountTotal(cashCount);let report:ClosingReceiptView|undefined;await this.store.update(d=>{const s=d.sessions.find(s=>s.id===id&&!s.closing);if(!s)throw Error('Caja cerrada');s.closing=closeSession(d,s,counted,cashCount);report=closingReceiptView(s,d.sales,this.title,this.timeZone);},{sessionId:id});this.cart.set([]);this.closingCount=emptyCashCount();this.tab='Cierres';this.receipt.set(null);this.movementReceipt.set(null);this.closingReceipt.set(report!);saved=true;});if(saved)await this.printRenderedReceipt();}
 async reprintClosing(id:string){if(this.busy())return;this.busy.set(true);this.message.set('');let loaded=false;try{const {session,sales}=await this.store.sessionDetails(id);this.receipt.set(null);this.movementReceipt.set(null);this.closingReceipt.set(closingReceiptView(session,sales,this.title,this.timeZone));loaded=true;}catch(e){this.message.set(e instanceof Error?e.message:'No se pudo cargar el cierre');}finally{this.busy.set(false);}if(loaded)await this.printRenderedReceipt();}
 private async printRenderedReceipt(){await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));this.print();}
 closeReceipt(){this.receipt.set(null);this.closingReceipt.set(null);this.movementReceipt.set(null);clearReceiptPage(document);}

 export(){this.run(async()=>{const data=await this.store.exportData();const url=URL.createObjectURL(new Blob([JSON.stringify({...data,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='heladeria-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});}
 async import(e:Event){const input=e.target as HTMLInputElement,file=input.files?.[0];if(!file)return;await this.run(async()=>{const data=validateData(JSON.parse(await file.text()));if(!confirm('Reemplazar todos los datos locales? Exportá antes un respaldo.'))return;await this.store.restore(data);this.cart.set([]);this.closeReceipt();});input.value='';}
 exportProducts(){this.run(async()=>{const data=exportCatalog(this.store.data());const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='heladeria-productos-categorias-'+this.today+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});}
 async importProducts(e:Event){const input=e.target as HTMLInputElement,file=input.files?.[0];if(!file)return;let result:CatalogImportResult|undefined;await this.run(async()=>{const data=validateCatalogFile(JSON.parse(await file.text()));if(!confirm('¿Reemplazar el catálogo por '+data.products.length+' productos y '+data.categories.length+' categorías? Los que no estén en el archivo se quitarán del catálogo. Se aplican los nombres, precios, IVA y estado activo del archivo. Ventas, cajas y semanas anteriores se conservan.'))return;await this.store.update(d=>{result=importCatalog(d,data);},{priceSource:'CATALOG_IMPORT'});this.cart.set([]);this.finishCatalogEdit();});if(result)this.message.set('Catálogo de productos y categorías reemplazado. Productos nuevos: '+result.added+' · Actualizados: '+result.updated+' · Productos quitados: '+result.removedProducts+' · Categorías quitadas: '+result.removedCategories+'.');input.value='';}
 print(){try{prepareReceiptPage(document);window.print();this.message.set('');}catch(e){this.message.set(e instanceof Error?e.message:'No se pudo preparar el ticket');}}
}
