import { PerspectiveCamera } from 'three';
import { CADCameraControls } from '../src/CADCameraControls';

export function createCamera(): PerspectiveCamera {

	const camera = new PerspectiveCamera( 50, 800 / 600, 0.1, 200000 );
	camera.position.set( 0, 0, 1000 );
	camera.lookAt( 0, 0, 0 );
	camera.updateMatrixWorld();
	return camera;

}

export function createDomElement(): HTMLDivElement {

	const el = document.createElement( 'div' );

	// jsdom doesn't implement pointer capture
	el.setPointerCapture = () => {};
	el.releasePointerCapture = () => {};

	// jsdom elements have no layout — provide a fixed rect
	el.getBoundingClientRect = () => ( {
		x: 0, y: 0, width: 800, height: 600,
		top: 0, right: 800, bottom: 600, left: 0,
		toJSON() { return this; },
	} );

	return el;

}

export function createControls( overrides?: Partial<Pick<CADCameraControls,
	'enabled' | 'enableDamping' | 'dampingFactor' | 'inputBindings' |
	'rotateSpeed' | 'panSpeed' | 'zoomSpeed' | 'minDistance' |
	'maxDistance' | 'preventContextMenu'
>> ): { controls: CADCameraControls; camera: PerspectiveCamera; element: HTMLDivElement } {

	const camera = createCamera();
	const element = createDomElement();
	const controls = new CADCameraControls( camera, element );

	if ( overrides ) {

		Object.assign( controls, overrides );

	}

	return { controls, camera, element };

}

export function dispatchPointer(
	element: HTMLElement,
	type: string,
	options: {
		button?: number;
		clientX?: number;
		clientY?: number;
		ctrlKey?: boolean;
		metaKey?: boolean;
		altKey?: boolean;
		shiftKey?: boolean;
		pointerId?: number;
	} = {}
): void {

	element.dispatchEvent( new PointerEvent( type, {
		bubbles: true,
		cancelable: true,
		button: options.button ?? 2,
		clientX: options.clientX ?? 0,
		clientY: options.clientY ?? 0,
		ctrlKey: options.ctrlKey ?? false,
		metaKey: options.metaKey ?? false,
		altKey: options.altKey ?? false,
		shiftKey: options.shiftKey ?? false,
		pointerId: options.pointerId ?? 1,
	} ) );

}

export function dispatchWheel(
	element: HTMLElement,
	deltaY: number,
	clientX: number = 400,
	clientY: number = 300,
): void {

	element.dispatchEvent( new WheelEvent( 'wheel', {
		bubbles: true,
		cancelable: true,
		deltaY,
		clientX,
		clientY,
	} ) );

}

export function simulateDrag(
	element: HTMLElement,
	options: {
		button?: number;
		startX?: number;
		startY?: number;
		endX?: number;
		endY?: number;
		steps?: number;
		ctrlKey?: boolean;
		metaKey?: boolean;
		altKey?: boolean;
		shiftKey?: boolean;
	} = {}
): void {

	const button = options.button ?? 2;
	const startX = options.startX ?? 400;
	const startY = options.startY ?? 300;
	const endX = options.endX ?? 500;
	const endY = options.endY ?? 350;
	const steps = options.steps ?? 5;
	const modifiers = {
		ctrlKey: options.ctrlKey ?? false,
		metaKey: options.metaKey ?? false,
		altKey: options.altKey ?? false,
		shiftKey: options.shiftKey ?? false,
	};

	dispatchPointer( element, 'pointerdown', { button, clientX: startX, clientY: startY, ...modifiers } );

	for ( let i = 1; i <= steps; i ++ ) {

		const t = i / steps;
		const x = startX + ( endX - startX ) * t;
		const y = startY + ( endY - startY ) * t;
		dispatchPointer( element, 'pointermove', { button, clientX: x, clientY: y, ...modifiers } );

	}

	dispatchPointer( element, 'pointerup', { button, clientX: endX, clientY: endY, ...modifiers } );

}
