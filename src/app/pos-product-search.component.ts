import { Component, ElementRef, EventEmitter, HostListener, Input, Output, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Product, ProductFamily } from './core/models';
import { posProductCaption, searchPosProducts } from './core/pos-products';

@Component({selector:'app-pos-product-search',standalone:true,imports:[FormsModule],template:`
 <label class="pos-search-label" for="pos-product-query">Buscar producto por nombre</label>
 <div class="pos-search-input"><input #input id="pos-product-query" type="search" role="combobox" aria-label="Buscar producto por nombre" autocomplete="off" aria-autocomplete="list" [attr.aria-expanded]="showResults" aria-controls="pos-product-results" [attr.aria-activedescendant]="showResults&&activeIndex>=0?'pos-result-'+activeIndex:null" aria-describedby="pos-search-help" [ngModel]="query" (ngModelChange)="changeQuery($event)" (focus)="openResults()" (click)="openResults()" (keydown)="keyDown($event)" placeholder="Ej.: frutilla, bombón o código Grido" [disabled]="busy">
  @if(query){<button type="button" aria-label="Limpiar búsqueda de venta" (click)="clear()" [disabled]="busy">✕</button>}
 </div>
 <small id="pos-search-help">Busca en todas las categorías y presentaciones. {{canAdd?'Elegí un resultado para agregarlo al pedido.':'Abrí la caja para agregar productos al pedido.'}}</small>
 @if(showResults){<div class="pos-search-popup">
  <div id="pos-product-results" role="listbox" aria-label="Productos encontrados" class="pos-search-results">
   @for(p of results;track p.id;let i=$index){<button type="button" role="option" [id]="'pos-result-'+i" [attr.aria-selected]="activeIndex===i" [class.highlighted]="activeIndex===i" [disabled]="!canAdd||busy" tabindex="-1" (mousedown)="$event.preventDefault()" (click)="choose(p.id)"><span><strong>{{p.name}}</strong><small>{{p.category}} · {{caption(p)}}</small>@if(p.gridoName&&p.gridoName!==p.name){<small>Grido: {{p.gridoName}}</small>}</span><b>{{fmt(p.price)}}</b></button>}
  </div>
  @if(!matches.length){<p class="pos-search-empty" role="status">No encontramos productos activos con ese nombre.</p>}@else{<small class="pos-search-count">{{results.length}} de {{matches.length}} coincidencias · ↑ ↓ para elegir · Enter para agregar@if(matches.length>results.length){ · Escribí más para precisar la búsqueda.}</small>}
 </div>}
`})
export class PosProductSearchComponent {
 @Input() products:Product[]=[];@Input() families:ProductFamily[]=[];@Input() canAdd=false;@Input() busy=false;
 @Output() picked=new EventEmitter<string>();
 @ViewChild('input',{static:true}) input!:ElementRef<HTMLInputElement>;
 private readonly host=inject(ElementRef<HTMLElement>);
 query='';opened=false;activeId:string|null=null;
 get matches(){return searchPosProducts(this.products,this.query);}
 get results(){return this.matches.slice(0,20);}
 get activeIndex(){return this.results.findIndex(p=>p.id===this.activeId);}
 get showResults(){return this.opened&&!!this.query.trim();}
 changeQuery(value:string){this.query=value;this.activeId=null;this.opened=!!value.trim();}
 openResults(){this.opened=!!this.query.trim();}
 clear(){this.query='';this.opened=false;this.activeId=null;this.input.nativeElement.focus();}
 caption(product:Product){return posProductCaption(product,this.families);}
 fmt(value:number){return new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(value/100);}
 choose(id:string){if(!this.canAdd||this.busy||!this.products.some(p=>p.id===id&&p.active&&!p.deletedAt))return;this.picked.emit(id);this.clear();}
 keyDown(event:KeyboardEvent){
  if(this.busy)return;
  if(event.key==='Escape'){event.preventDefault();this.opened=false;this.activeId=null;return;}
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
   const rows=this.results,count=rows.length;if(!count)return;event.preventDefault();this.opened=true;
   const index=this.activeIndex<0?(event.key==='ArrowDown'?0:count-1):(this.activeIndex+(event.key==='ArrowDown'?1:-1)+count)%count;
   this.activeId=rows[index].id;
   requestAnimationFrame(()=>this.host.nativeElement.querySelector('#pos-result-'+this.activeIndex)?.scrollIntoView({block:'nearest'}));return;
  }
  if(event.key==='Enter'&&this.query.trim()){
   event.preventDefault();this.opened=true;const rows=this.results;
   if(this.activeId&&!rows.some(p=>p.id===this.activeId)){this.activeId=null;return;}
   if(this.activeIndex>=0&&rows[this.activeIndex])this.choose(rows[this.activeIndex].id);
   else if(rows.length===1)this.choose(rows[0].id);
   else if(rows.length)this.activeId=rows[0].id;
  }
 }
 @HostListener('document:click',['$event']) outside(event:MouseEvent){if(!this.host.nativeElement.contains(event.target as Node)){this.opened=false;this.activeId=null;}}
}
