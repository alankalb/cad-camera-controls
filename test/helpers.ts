import { PerspectiveCamera, OrthographicCamera } from 'three';
import { CADCameraControls } from '../src/CADCameraControls';

export function createCamera(): PerspectiveCamera {
	const camera = new PerspectiveCamera(50, 800 / 600, 0.1, 200000);
	camera.position.set(0, 0, 1000);
	camera.lookAt(0, 0, 0);
	camera.updateMatrixWorld();
	return camera;
}

export function createDomElement(): HTMLDivElement {
	const el = document.createElement('div');

	// jsdom doesn't implement pointer capture
	el.setPointerCapture = () => {};
	el.releasePointerCapture = () => {};

	// jsdom elements have no layout — provide a fixed rect
	el.getBoundingClientRect = () => ({
		x: 0, y: 0, width: 800, height: 600,
		top: 0, right: 800, bottom: 600, left: 0,
		toJSON() {
			return this;
		},
	});

	return el;
}

export function createControls(overrides?: Partial<Pick<CADCameraControls,
	'enabled' | 'enableDamping' | 'dampingFactor' | 'inputBindings' |
	'touchBindings' | 'rotateSpeed' | 'panSpeed' | 'zoomSpeed' |
	'minDistance' | 'maxDistance' | 'minZoom' | 'maxZoom' |
	'zoomMode' | 'minFov' | 'maxFov' | 'preventContextMenu'
>>): { controls: CADCameraControls; camera: PerspectiveCamera; element: HTMLDivElement } {
	const camera = createCamera();
	const element = createDomElement();
	const controls = new CADCameraControls(camera, element);

	if (overrides) {
		Object.assign(controls, overrides);
	}

	return { controls, camera, element };
}

export function createOrthoCamera(): OrthographicCamera {
	const aspect = 800 / 600;
	const frustumSize = 1000;
	const camera = new OrthographicCamera(
		- frustumSize * aspect / 2,
		frustumSize * aspect / 2,
		frustumSize / 2,
		- frustumSize / 2,
		0.1,
		200000
	);
	camera.position.set(0, 0, 1000);
	camera.lookAt(0, 0, 0);
	camera.updateMatrixWorld();
	return camera;
}

export function createOrthoControls(overrides?: Partial<Pick<CADCameraControls,
	'enabled' | 'enableDamping' | 'dampingFactor' | 'inputBindings' |
	'touchBindings' | 'rotateSpeed' | 'panSpeed' | 'zoomSpeed' |
	'minDistance' | 'maxDistance' | 'minZoom' | 'maxZoom' |
	'zoomMode' | 'minFov' | 'maxFov' | 'preventContextMenu'
>>): { controls: CADCameraControls; camera: OrthographicCamera; element: HTMLDivElement } {
	const camera = createOrthoCamera();
	const element = createDomElement();
	const controls = new CADCameraControls(camera, element);

	if (overrides) {
		Object.assign(controls, overrides);
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
	element.dispatchEvent(new PointerEvent(type, {
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
	}));
}

export function dispatchWheel(
	element: HTMLElement,
	deltaY: number,
	clientX: number = 400,
	clientY: number = 300,
): void {
	element.dispatchEvent(new WheelEvent('wheel', {
		bubbles: true,
		cancelable: true,
		deltaY,
		clientX,
		clientY,
	}));
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

	dispatchPointer(element, 'pointerdown', { button, clientX: startX, clientY: startY, ...modifiers });

	for (let i = 1; i <= steps; i ++) {
		const t = i / steps;
		const x = startX + (endX - startX) * t;
		const y = startY + (endY - startY) * t;
		dispatchPointer(element, 'pointermove', { button, clientX: x, clientY: y, ...modifiers });
	}

	dispatchPointer(element, 'pointerup', { button, clientX: endX, clientY: endY, ...modifiers });
}

export function dispatchTouch(
	element: HTMLElement,
	type: string,
	options: {
		clientX?: number;
		clientY?: number;
		pointerId?: number;
	} = {}
): void {
	element.dispatchEvent(new PointerEvent(type, {
		bubbles: true,
		cancelable: true,
		button: 0,
		clientX: options.clientX ?? 0,
		clientY: options.clientY ?? 0,
		pointerId: options.pointerId ?? 1,
		pointerType: 'touch',
	}));
}

export function simulateTouchDrag(
	element: HTMLElement,
	options: {
		startX?: number;
		startY?: number;
		endX?: number;
		endY?: number;
		steps?: number;
		pointerId?: number;
	} = {}
): void {
	const startX = options.startX ?? 400;
	const startY = options.startY ?? 300;
	const endX = options.endX ?? 500;
	const endY = options.endY ?? 350;
	const steps = options.steps ?? 5;
	const pointerId = options.pointerId ?? 1;

	dispatchTouch(element, 'pointerdown', { clientX: startX, clientY: startY, pointerId });

	for (let i = 1; i <= steps; i ++) {
		const t = i / steps;
		const x = startX + (endX - startX) * t;
		const y = startY + (endY - startY) * t;
		dispatchTouch(element, 'pointermove', { clientX: x, clientY: y, pointerId });
	}

	dispatchTouch(element, 'pointerup', { clientX: endX, clientY: endY, pointerId });
}

export function simulatePinch(
	element: HTMLElement,
	options: {
		centerX?: number;
		centerY?: number;
		startSpread?: number;
		endSpread?: number;
		steps?: number;
	} = {}
): void {
	const centerX = options.centerX ?? 400;
	const centerY = options.centerY ?? 300;
	const startSpread = options.startSpread ?? 100;
	const endSpread = options.endSpread ?? 200;
	const steps = options.steps ?? 5;

	// Two fingers start at center ± half spread
	const finger1Id = 10;
	const finger2Id = 11;

	dispatchTouch(element, 'pointerdown', {
		clientX: centerX - startSpread / 2, clientY: centerY, pointerId: finger1Id,
	});
	dispatchTouch(element, 'pointerdown', {
		clientX: centerX + startSpread / 2, clientY: centerY, pointerId: finger2Id,
	});

	for (let i = 1; i <= steps; i ++) {
		const t = i / steps;
		const spread = startSpread + (endSpread - startSpread) * t;
		dispatchTouch(element, 'pointermove', {
			clientX: centerX - spread / 2, clientY: centerY, pointerId: finger1Id,
		});
		dispatchTouch(element, 'pointermove', {
			clientX: centerX + spread / 2, clientY: centerY, pointerId: finger2Id,
		});
	}

	dispatchTouch(element, 'pointerup', {
		clientX: centerX - endSpread / 2, clientY: centerY, pointerId: finger1Id,
	});
	dispatchTouch(element, 'pointerup', {
		clientX: centerX + endSpread / 2, clientY: centerY, pointerId: finger2Id,
	});
}
