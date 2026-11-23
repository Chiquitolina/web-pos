import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild } from '@angular/core';

@Component({selector:'app-catalog-dialog',standalone:true,template:`
 <dialog #dialog class="product-sheet" aria-labelledby="product-dialog-title" (cancel)="cancel($event)">
  <header class="sheet-header"><div><small>{{category}}</small><h2 id="product-dialog-title">{{title}}</h2></div><button type="button" aria-label="Cerrar ficha" (click)="dismissed.emit()" [disabled]="busy">✕</button></header>
  <fieldset [disabled]="busy"><ng-content></ng-content></fieldset>
 </dialog>
`})
export class CatalogDialogComponent implements AfterViewInit,OnDestroy {
 @Input() title='Producto';@Input() category='';@Input() busy=false;
 @Output() dismissed=new EventEmitter<void>();
 @ViewChild('dialog',{static:true}) dialog!:ElementRef<HTMLDialogElement>;
 private opener:HTMLElement|null=null;
 ngAfterViewInit(){const dialog=this.dialog.nativeElement;this.opener=dialog.ownerDocument.activeElement as HTMLElement;dialog.showModal();}
 ngOnDestroy(){const dialog=this.dialog.nativeElement;dialog.close();queueMicrotask(()=>{if(this.opener?.isConnected&&!dialog.ownerDocument.querySelector('dialog[open]'))this.opener.focus({preventScroll:true});});}
 cancel(event:Event){event.preventDefault();if(!this.busy)this.dismissed.emit();}
}
