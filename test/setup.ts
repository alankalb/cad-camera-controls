// jsdom does not implement PointerEvent — polyfill it as a MouseEvent subclass.
if ( typeof globalThis.PointerEvent === 'undefined' ) {

	class PointerEvent extends MouseEvent {

		readonly pointerId: number;
		readonly width: number;
		readonly height: number;
		readonly pressure: number;
		readonly tiltX: number;
		readonly tiltY: number;
		readonly pointerType: string;
		readonly isPrimary: boolean;

		constructor( type: string, params: PointerEventInit = {} ) {

			super( type, params );
			this.pointerId = params.pointerId ?? 0;
			this.width = params.width ?? 1;
			this.height = params.height ?? 1;
			this.pressure = params.pressure ?? 0;
			this.tiltX = params.tiltX ?? 0;
			this.tiltY = params.tiltY ?? 0;
			this.pointerType = params.pointerType ?? '';
			this.isPrimary = params.isPrimary ?? false;

		}

	}

	globalThis.PointerEvent = PointerEvent as unknown as typeof globalThis.PointerEvent;

}
