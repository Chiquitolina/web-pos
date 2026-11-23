import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FamilyPackagingComponent } from './family-packaging.component';
import { Data, Product, emptyData } from './core/models';
import { money } from './core/domain';
import { presentationName, BaseProductDraft, StandardPresentation, standardPresentation } from './core/product-presentations';

export interface PresentationStart {key:number;familyId?:string}
type Row={kind:StandardPresentation;active:boolean;productId?:string;name:string;gridoName:string;price:number|null;vatRate:number|null;iceCreamGrams:number|null;iceCreamScoops:number|null;autoName:boolean;autoCode:boolean;unitsPerBox:number|null};
const rows=():Row[]=>['Caja','Caja 2','Unidad'].map(kind=>({kind:kind as StandardPresentation,active:false,name:'',gridoName:'',price:null,vatRate:null,iceCreamGrams:null,iceCreamScoops:null,autoName:true,autoCode:true,unitsPerBox:null}));

@Component({selector:'app-product-presentations',standalone:true,imports:[FormsModule,FamilyPackagingComponent],template:`
<section class="presentation-builder">
 <form (ngSubmit)="submit()">
  <label>Nombre del producto<input name="base-name" aria-label="Nombre del producto" [ngModel]="baseName" (ngModelChange)="changeBase($event)" placeholder="Ej.: Bombón Escocés" required autofocus></label>
  <app-family-packaging [unitsPerBox]="unitsPerBox" (unitsPerBoxChange)="changeMainCapacity($event)" [(boxesPerPack)]="boxesPerPack"></app-family-packaging>
  <p class="sheet-intro">Activá hasta dos tamaños de caja y la venta por unidad. Cada opción tiene su nombre, código Grido y precio.</p>
  @for(r of draftRows;track r.kind){<section class="presentation-row" [class.presentation-inactive]="!r.active" [attr.data-presentation]="r.kind">
   <label class="presentation-switch"><input type="checkbox" [name]="'active-'+r.kind" [attr.aria-label]="'Activar '+r.kind" [(ngModel)]="r.active"><strong>Venta por {{r.kind==='Caja'?'caja principal':r.kind==='Caja 2'?'segunda caja':'unidad'}}</strong><span>{{r.active?'Activada':'Desactivada'}}</span></label>
   @if(r.active){@if(r.kind==='Caja 2'){<label>Unidades que trae esta segunda caja<input [name]="'box-units-'+r.kind" aria-label="Unidades segunda caja" type="number" min="1" step="1" [ngModel]="r.unitsPerBox" (ngModelChange)="changeSecondCapacity(r,$event)" placeholder="Ej.: 10" required></label>}<div class="row"><label>Nombre visible<input [name]="'name-'+r.kind" [attr.aria-label]="'Nombre visible '+r.kind" [ngModel]="r.name" (ngModelChange)="changeName(r,$event)" required></label><label>Nombre / código Grido<input [name]="'code-'+r.kind" [attr.aria-label]="'Código Grido '+r.kind" [ngModel]="r.gridoName" (ngModelChange)="changeCode(r,$event)" required></label><label>Precio final $<input type="number" min="0.01" step="0.01" [name]="'price-'+r.kind" [attr.aria-label]="'Precio '+r.kind" [(ngModel)]="r.price" required></label></div>
    <details><summary>IVA y consumo de helado (opcional)</summary><div class="row"><label>IVA %<input type="number" min="0" max="100" step="0.01" [name]="'vat-'+r.kind" [attr.aria-label]="'IVA '+r.kind" [(ngModel)]="r.vatRate"></label><label>Bochas por presentación<input type="number" min="1" step="1" [name]="'scoops-'+r.kind" [attr.aria-label]="'Bochas '+r.kind" [ngModel]="r.iceCreamScoops" (ngModelChange)="setScoops(r,$event)"></label><label>Gramos por presentación<input type="number" min="0" step="1" [name]="'grams-'+r.kind" [attr.aria-label]="'Gramos '+r.kind" [(ngModel)]="r.iceCreamGrams" [readonly]="r.iceCreamScoops!==null"></label></div></details>
   }@else if(r.productId){<p class="presentation-saved"><strong>{{r.name}}</strong> · {{fmt((r.price??0)*100)}}<small>{{r.gridoName}}</small></p><small>No aparece en Venta. Al volver a activarla conserva sus datos.</small>}@else{<small>No se venderá por {{r.kind==='Caja'?'caja principal':r.kind==='Caja 2'?'segunda caja':'unidad'}}. Podés activarla más adelante.</small>}
  </section>}
  @if(conflict){<p class="catalog-error" role="alert">{{conflict}} Abrí «Más opciones» para revisar los productos vinculados o separarlos.</p>}
  @if(error){<p class="catalog-error" role="alert">{{error}}</p>}
  <p class="inline-help">Desactivar una opción la oculta de Venta y conserva sus ventas anteriores. Podés guardar sin activar ninguna.</p>
  <footer class="sheet-actions"><button type="submit" class="primary" [disabled]="!category||!!conflict">Guardar producto</button><button type="button" (click)="cancel.emit()">Cancelar</button></footer>
 </form>
</section>
`})
export class ProductPresentationsComponent implements OnChanges {
 @Input() catalog:Data=emptyData();@Input() category='';@Input() start:PresentationStart={key:0};@Input() resetToken=0;
 @Output() save=new EventEmitter<BaseProductDraft>();@Output() cancel=new EventEmitter<void>();
 baseName='';familyId='';unitsPerBox:number|null=null;boxesPerPack:number|null=null;draftRows=rows();error='';conflict='';
 ngOnChanges(changes:SimpleChanges){if(changes['start']||changes['resetToken'])this.reset();}
 reset(){
  this.error='';this.conflict='';this.familyId=this.start.familyId??'';
  this.baseName=this.catalog.productFamilies?.find(f=>f.id===this.familyId)?.name??'';
  this.unitsPerBox=this.catalog.productFamilies?.find(f=>f.id===this.familyId)?.unitsPerBox??null;
  this.boxesPerPack=this.catalog.productFamilies?.find(f=>f.id===this.familyId)?.boxesPerPack??null;
  this.draftRows=rows();
  for(const row of this.draftRows){
   const matches=this.catalog.products.filter(p=>!p.deletedAt&&!!this.familyId&&p.familyId===this.familyId&&standardPresentation(p.presentation)===row.kind);
   if(matches[0])this.load(row,matches[0]);
   if(matches.length>1)this.conflict='Hay más de un producto vinculado como '+row.kind.toLowerCase()+'.';
  }
  this.fillNames();
 }
 load(row:Row,product:Product){Object.assign(row,{productId:product.id,active:product.active,name:product.name,gridoName:product.gridoName??product.name,price:product.price/100,vatRate:product.vatRate??null,iceCreamGrams:product.iceCreamGrams??null,iceCreamScoops:product.iceCreamScoops??null,autoName:false,autoCode:false,unitsPerBox:product.unitsPerBox??null});}
 changeMainCapacity(value:number|null){this.unitsPerBox=value;this.fillNames();}
 changeSecondCapacity(row:Row,value:number|null){row.unitsPerBox=value;this.fillNames();}
 changeBase(value:string){this.baseName=value;this.fillNames();}
 fillNames(){for(const r of this.draftRows){const name=this.baseName.trim()?presentationName(this.baseName,r.kind,r.kind==='Caja'?this.unitsPerBox:r.unitsPerBox):'';if(r.autoName)r.name=name;if(r.autoCode)r.gridoName=name;}}
 changeName(row:Row,value:string){row.name=value;row.autoName=false;}
 changeCode(row:Row,value:string){row.gridoName=value;row.autoCode=false;}
 setScoops(row:Row,value:number|null){row.iceCreamScoops=value;if(value!==null)row.iceCreamGrams=value*80;}
 fmt(value:number){return new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(value/100);}
 submit(){
  this.error='';
  try{
   if(this.conflict)throw Error(this.conflict);
   const rowDrafts=this.draftRows.map(r=>{
    if(r.active&&(r.price===null||r.price<=0))throw Error('Ingresá el precio de '+r.kind.toLowerCase());
    return {kind:r.kind,active:r.active,...(r.kind==='Caja 2'?{unitsPerBox:r.unitsPerBox}:{}),...(r.productId?{productId:r.productId}:{}),name:r.name,gridoName:r.gridoName,price:r.active?money(r.price!):0,vatRate:r.vatRate,iceCreamGrams:r.iceCreamGrams,iceCreamScoops:r.iceCreamScoops};
   });
   this.save.emit({baseName:this.baseName,category:this.category,unitsPerBox:this.unitsPerBox,boxesPerPack:this.boxesPerPack,...(this.familyId?{familyId:this.familyId}:{}),rows:rowDrafts});
  }catch(e){this.error=e instanceof Error?e.message:'Revisá los datos';}
 }
}
