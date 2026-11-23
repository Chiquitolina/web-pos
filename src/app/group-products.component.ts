import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FamilyPackagingComponent } from './family-packaging.component';
import { Data, emptyData, Product } from './core/models';
import { ExistingProductGroupDraft } from './core/catalog-groups';
import { standardPresentation, StandardPresentation } from './core/product-presentations';

@Component({selector:'app-group-products',standalone:true,imports:[FormsModule,FamilyPackagingComponent],template:`
 <form (ngSubmit)="submit()" class="group-products-form">
  <p class="sheet-intro">Juntá las cajas y la unidad de un mismo producto en una sola ficha.</p>
  <label>Nombre del producto<input name="group-name" aria-label="Nombre del producto" [(ngModel)]="name" placeholder="Ej.: Bombón Escocés" required autofocus [readOnly]="!!familyId"></label>
  <p class="field-hint">Este nombre los reúne en Productos y Semana. Cada venta conserva el nombre y el precio que ya tenía.</p>
  @for(row of rows;track row.kind){<section class="group-selection">
   <label>{{row.kind==='Caja'?'Producto que se vende por caja principal':row.kind==='Caja 2'?'Producto de segunda caja (opcional)':'Producto que se vende por unidad'}}<select [name]="'group-'+row.kind" [attr.aria-label]="'Producto '+row.kind" [ngModel]="row.productId" (ngModelChange)="selectProduct(row,$event)" [disabled]="row.locked">
    <option value="">Sin seleccionar · se puede agregar después</option>
    @for(p of options(row.kind);track p.id){<option [value]="p.id">{{p.name}}{{p.gridoName&&p.gridoName!==p.name?' · '+p.gridoName:''}} · {{fmt(p.price)}}{{p.active?'':' · Inactivo'}}</option>}
   </select></label>
   @if(row.kind==='Caja 2'&&row.productId){<label>Unidades que trae la segunda caja<input name="group-second-box-units" aria-label="Unidades segunda caja" type="number" min="1" step="1" [(ngModel)]="secondBoxUnits" placeholder="Ej.: 10" required></label>}
   @if(selected(row.productId);as p){<div class="group-product-preview"><strong>{{p.name}}</strong><span>{{fmt(p.price)}}</span><small>Código Grido: {{p.gridoName||p.name}}</small><small>{{p.active?'Disponible para vender':'Inactivo · seguirá inactivo'}}</small></div>}
  </section>}
  <app-family-packaging [(unitsPerBox)]="unitsPerBox" [(boxesPerPack)]="boxesPerPack"></app-family-packaging>
  <p class="inline-help">Podés elegir solo uno ahora. No se crean copias ni se cambian nombres, códigos Grido, precios o ventas anteriores.</p>
  @if(!available.length&&!familyId){<p>No hay productos sin agrupar en esta categoría.</p>}
  @if(error){<p class="catalog-error" role="alert">{{error}}</p>}
  <footer class="sheet-actions"><button class="primary" type="submit" [disabled]="!hasSelection">{{familyId?'Guardar vinculación':'Agrupar productos'}}</button><button type="button" (click)="cancel.emit()">Cancelar</button></footer>
 </form>
`})
export class GroupProductsComponent implements OnInit {
 @Input() catalog:Data=emptyData();@Input() category='';@Input() familyId='';
 @Output() save=new EventEmitter<ExistingProductGroupDraft>();@Output() cancel=new EventEmitter<void>();
 name='';error='';secondBoxUnits:number|null=null;unitsPerBox:number|null=null;boxesPerPack:number|null=null;rows:{kind:StandardPresentation;productId:string;locked:boolean}[]=[{kind:'Caja',productId:'',locked:false},{kind:'Caja 2',productId:'',locked:false},{kind:'Unidad',productId:'',locked:false}];
 ngOnInit(){const family=this.catalog.productFamilies?.find(f=>f.id===this.familyId);this.name=family?.name??'';this.unitsPerBox=family?.unitsPerBox??null;this.boxesPerPack=family?.boxesPerPack??null;for(const row of this.rows){const p=this.catalog.products.find(p=>!p.deletedAt&&!!this.familyId&&p.familyId===this.familyId&&standardPresentation(p.presentation)===row.kind);if(p){row.productId=p.id;row.locked=true;if(row.kind==='Caja 2')this.secondBoxUnits=p.unitsPerBox??null;}}}
 get available(){return this.catalog.products.filter(p=>!p.deletedAt&&p.category===this.category&&(!p.familyId||p.familyId===this.familyId)).sort((a,b)=>a.name.localeCompare(b.name,'es'));}
 get hasSelection(){return this.rows.some(r=>!!r.productId);}
 selectProduct(row:{kind:StandardPresentation;productId:string},id:string){row.productId=id;if(row.kind==='Caja 2')this.secondBoxUnits=this.selected(id)?.unitsPerBox??null;}
 options(kind:StandardPresentation){const other=new Set(this.rows.filter(r=>r.kind!==kind).map(r=>r.productId));return this.available.filter(p=>!other.has(p.id)&&(!p.presentation||standardPresentation(p.presentation)===kind));}
 selected(id:string):Product|undefined{return this.catalog.products.find(p=>p.id===id&&!p.deletedAt);}
 fmt(price:number){return new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(price/100);}
 submit(){this.error='';if(!this.hasSelection){this.error='Elegí al menos un producto para agrupar';return;}const id=(kind:StandardPresentation)=>this.rows.find(r=>r.kind===kind)!.productId;this.save.emit({name:this.name,category:this.category,unitsPerBox:this.unitsPerBox,boxesPerPack:this.boxesPerPack,...(this.familyId?{familyId:this.familyId}:{}),...(id('Caja')?{boxProductId:id('Caja')}:{}),...(id('Caja 2')?{secondBoxProductId:id('Caja 2'),secondBoxUnitsPerBox:this.secondBoxUnits}:{}),...(id('Unidad')?{unitProductId:id('Unidad')}:{})});}
}
