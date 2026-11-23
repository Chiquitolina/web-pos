// CSS millimetres are independent of display DPI: 96 CSS pixels per inch.
export const RECEIPT_WIDTH_MM=78;
// A short receipt must still be taller than the 78 mm content / 80 mm roll.
// Otherwise the browser can turn the selected roll paper sideways.
export const RECEIPT_MIN_HEIGHT_MM=82;
const STYLE_ID='receipt-page-size';
export function receiptHeightMm(heightCssPx:number):number {
 if(!Number.isFinite(heightCssPx)||heightCssPx<=0)throw Error('No se pudo calcular el tamaño del ticket');
 return Math.max(RECEIPT_MIN_HEIGHT_MM,Math.ceil(heightCssPx*25.4/96));
}
export function prepareReceiptPage(doc:Document):void {
 const receipt=doc.querySelector<HTMLElement>('.receipt-overlay app-receipt, .receipt-overlay app-closing-receipt, .receipt-overlay app-movement-receipt');
 if(!receipt){doc.getElementById(STYLE_ID)?.remove();return;}
 // Measure at paper width, even on a narrow phone or in a scrolled dialog.
 // The toolbar is outside the printable component and does not contribute to paper length.
 const copy=receipt.cloneNode(true) as HTMLElement;
 copy.classList.add('receipt-measure');copy.setAttribute('aria-hidden','true');
 (doc.querySelector('app-root')??doc.body).appendChild(copy);
 let height:number;
 try{height=copy.getBoundingClientRect().height;}finally{copy.remove();}
 const heightMm=receiptHeightMm(height);
 let style=doc.getElementById(STYLE_ID) as HTMLStyleElement|null;
 if(!style){style=doc.createElement('style');style.id=STYLE_ID;doc.head.appendChild(style);}
 // Both dimensions must be lengths; "78mm auto" is invalid CSS.
 style.textContent=`@media print { @page { size: ${RECEIPT_WIDTH_MM}mm ${heightMm}mm; margin: 0; } }`;
}
export function clearReceiptPage(doc:Document):void {doc.getElementById(STYLE_ID)?.remove();}
