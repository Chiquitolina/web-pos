import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { validUnitsPerBox } from './core/box-equivalents';

@Component({selector:'app-family-packaging',standalone:true,imports:[FormsModule],template:`
 <section class="box-setting">
  <h3>Equivalencias de la familia</h3>
  <div class="row">
   <label>Unidades de la caja principal<input name="packaging-units" aria-label="Unidades por caja" type="number" min="1" step="1" [ngModelOptions]="{standalone:true}" [ngModel]="unitsPerBox" (ngModelChange)="unitsPerBoxChange.emit($event)" placeholder="Ej.: 8"></label>
   <label>Cajas principales que trae un pack<input name="packaging-boxes" aria-label="Cajas por pack" type="number" min="1" step="1" [ngModelOptions]="{standalone:true}" [ngModel]="boxesPerPack" (ngModelChange)="boxesPerPackChange.emit($event)" placeholder="Ej.: 6"></label>
  </div>
  <small>La caja principal es la referencia para los equivalentes y packs. La segunda caja tiene su propio tamaño. Para ver packs, completá ambos datos. Podés dejarlos vacíos y configurarlos después.</small>
  @if(packUnits!==null){<p class="packaging-preview">1 pack = {{number(boxesPerPack!)}} cajas principales = {{number(packUnits!)}} unidades</p>}
  <small>Semana recalcula automáticamente lo ya vendido con esta configuración, conservando los importes originales.</small>
 </section>
`})
export class FamilyPackagingComponent {
 @Input() unitsPerBox:number|null=null;@Input() boxesPerPack:number|null=null;
 @Output() unitsPerBoxChange=new EventEmitter<number|null>();@Output() boxesPerPackChange=new EventEmitter<number|null>();
 get packUnits(){return validUnitsPerBox(this.unitsPerBox)&&validUnitsPerBox(this.boxesPerPack)?this.unitsPerBox*this.boxesPerPack:null;}
 number(value:number){return new Intl.NumberFormat('es-AR',{maximumFractionDigits:3}).format(value);}
}
