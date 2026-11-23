import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CashCountRow } from './core/models';
import { cashCountTotal } from './core/cash-count';
@Component({selector:'app-cash-count',standalone:true,imports:[FormsModule],template:`
<table class="cash-count"><thead><tr><th>Billete</th><th>Cantidad</th><th>Subtotal</th></tr></thead><tbody>
@for(row of rows;track row.denomination){<tr><td>{{fmt(row.denomination)}}</td><td><input type="number" min="0" step="1" inputmode="numeric" [attr.aria-label]="'Cantidad de billetes de '+fmt(row.denomination)" [ngModel]="row.quantity" (ngModelChange)="change(row.denomination,$event)" [disabled]="disabled"></td><td>{{validQuantity(row.quantity)?fmt(row.denomination*row.quantity):'—'}}</td></tr>}
</tbody></table><div class="count-total"><span>Total contado</span><strong>{{total===null?'—':fmt(total)}}</strong></div>
@if(total===null){<p role="alert">Usá cantidades enteras, sin valores negativos.</p>}
`})
export class CashCountComponent {
 @Input({required:true}) rows:CashCountRow[]=[];
 @Input() disabled=false;
 @Output() rowsChange=new EventEmitter<CashCountRow[]>();
 get total():number|null {try{return cashCountTotal(this.rows);}catch{return null;}}
 validQuantity(q:number){return Number.isSafeInteger(q)&&q>=0;}
 change(denomination:number,quantity:number|null){this.rowsChange.emit(this.rows.map(r=>r.denomination===denomination?{...r,quantity:quantity??0}:r));}
 fmt(n:number){return new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n/100);}
}
