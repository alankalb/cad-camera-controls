import { describe, it, expect, vi } from 'vitest';
import { Vector3 } from 'three';
import { CADCameraControls } from '../src/CADCameraControls';
import {
	createCamera,
	createDomElement,
	createControls,
	createOrthoControls,
	dispatchPointer,
	dispatchWheel,
	dispatchKeyDown,
	simulateDrag,
	dispatchTouch,
	simulateTouchDrag,
	simulatePinch,
} from './helpers';

describe('construction and lifecycle', () => {
	it('constructs with camera only, domElement is null', () => {
		const camera = createCamera();
		const controls = new CADCameraControls(camera);
		expect(controls.camera).toBe(camera);
		expect(controls.domElement).toBeNull();
		controls.dispose();
	});

	it('constructs with camera + domElement, auto-connects', () => {
		const camera = createCamera();
		const element = createDomElement();
		const spy = vi.spyOn(element, 'addEventListener');
		const controls = new CADCameraControls(camera, element);

		expect(controls.domElement).toBe(element);
		expect(spy).toHaveBeenCalled();
		controls.dispose();
	});

	it('connect() attaches listeners to domElement', () => {
		const camera = createCamera();
		const element = createDomElement();
		const controls = new CADCameraControls(camera);
		const spy = vi.spyOn(element, 'addEventListener');

		controls.connect(element);
		expect(spy).toHaveBeenCalled();
		expect(controls.domElement).toBe(element);
		controls.dispose();
	});

	it('disconnect() removes listeners, can reconnect', () => {
		const { controls, element } = createControls();
		const removeSpy = vi.spyOn(element, 'removeEventListener');

		controls.disconnect();
		expect(removeSpy).toHaveBeenCalled();

		const addSpy = vi.spyOn(element, 'addEventListener');
		controls.connect();
		expect(addSpy).toHaveBeenCalled();
		controls.dispose();
	});

	it('dispose() disconnects', () => {
		const { controls, element } = createControls();
		const removeSpy = vi.spyOn(element, 'removeEventListener');

		controls.dispose();
		expect(removeSpy).toHaveBeenCalled();
	});

	it('has correct default property values', () => {
		const camera = createCamera();
		const controls = new CADCameraControls(camera);

		expect(controls.enabled).toBe(true);
		expect(controls.enableDamping).toBe(true);
		expect(controls.dampingFactor).toBe(0.05);
		expect(controls.pivot.equals(new Vector3(0, 0, 0))).toBe(true);
		expect(controls.inputBindings).toEqual({
			rotate: { button: 0 },
			pan: { button: 2 },
		});
		expect(controls.touchBindings).toEqual({
			one: 'rotate',
			two: 'pan',
			pinch: true,
		});
		expect(controls.rotateSpeed).toBe(0.005);
		expect(controls.panSpeed).toBe(0.0016);
		expect(controls.zoomSpeed).toBe(1);
		expect(controls.minDistance).toBe(50);
		expect(controls.maxDistance).toBe(100000);
		expect(controls.minZoom).toBe(0.01);
		expect(controls.maxZoom).toBe(1000);
		expect(controls.zoomMode).toBe('dolly');
		expect(controls.minFov).toBe(1);
		expect(controls.maxFov).toBe(120);
		expect(controls.preventContextMenu).toBe(true);
		controls.dispose();
	});
});

describe('rotation', () => {
	it('left-drag rotates the camera', () => {
		const { controls, camera, element } = createControls();
		const initialPos = camera.position.clone();
		const initialQuat = camera.quaternion.clone();

		simulateDrag(element, { button: 0, startX: 400, startY: 300, endX: 500, endY: 300 });

		expect(camera.position.equals(initialPos)).toBe(false);
		expect(camera.quaternion.equals(initialQuat)).toBe(false);
		controls.dispose();
	});

	it('camera distance from pivot stays constant during rotation', () => {
		const { controls, camera, element } = createControls();
		const initialDistance = camera.position.distanceTo(controls.pivot);

		simulateDrag(element, { button: 0, startX: 400, startY: 300, endX: 500, endY: 350 });

		const finalDistance = camera.position.distanceTo(controls.pivot);
		expect(finalDistance).toBeCloseTo(initialDistance, 5);
		controls.dispose();
	});

	it('pivot position remains unchanged after rotation', () => {
		const { controls, element } = createControls();
		const pivotBefore = controls.pivot.clone();

		simulateDrag(element, { button: 0, startX: 400, startY: 300, endX: 500, endY: 350 });

		expect(controls.pivot.equals(pivotBefore)).toBe(true);
		controls.dispose();
	});

	it('dispatches start, change, end events during rotation', () => {
		const { controls, element } = createControls();
		const startFn = vi.fn();
		const changeFn = vi.fn();
		const endFn = vi.fn();
		controls.addEventListener('start', startFn);
		controls.addEventListener('change', changeFn);
		controls.addEventListener('end', endFn);

		simulateDrag(element, { button: 0, startX: 400, startY: 300, endX: 500, endY: 300, steps: 3 });

		expect(startFn).toHaveBeenCalledTimes(1);
		expect(changeFn.mock.calls.length).toBeGreaterThanOrEqual(1);
		expect(endFn).toHaveBeenCalledTimes(1);
		controls.dispose();
	});

	it('does not rotate when enabled = false', () => {
		const { controls, camera, element } = createControls({ enabled: false });
		const initialPos = camera.position.clone();

		simulateDrag(element, { button: 0, startX: 400, startY: 300, endX: 500, endY: 300 });

		expect(camera.position.equals(initialPos)).toBe(true);
		controls.dispose();
	});

	it('larger rotateSpeed produces larger rotation', () => {
		const slow = createControls({ rotateSpeed: 0.001 });
		const slowInitial = slow.camera.position.clone();
		simulateDrag(slow.element, { button: 0, startX: 400, startY: 300, endX: 500, endY: 300 });
		const slowDelta = slow.camera.position.distanceTo(slowInitial);
		slow.controls.dispose();

		const fast = createControls({ rotateSpeed: 0.02 });
		const fastInitial = fast.camera.position.clone();
		simulateDrag(fast.element, { button: 0, startX: 400, startY: 300, endX: 500, endY: 300 });
		const fastDelta = fast.camera.position.distanceTo(fastInitial);
		fast.controls.dispose();

		expect(fastDelta).toBeGreaterThan(slowDelta);
	});
});

describe('pan', () => {
	it('right-drag pans the camera', () => {
		const { controls, camera, element } = createControls();
		const initialPos = camera.position.clone();

		simulateDrag(element, {
			button: 2,
			startX: 400, startY: 300,
			endX: 500, endY: 350,
		});

		expect(camera.position.equals(initialPos)).toBe(false);
		controls.dispose();
	});

	it('camera quaternion stays constant during pan', () => {
		const { controls, camera, element } = createControls();
		const initialQuat = camera.quaternion.clone();

		simulateDrag(element, {
			button: 2,
			startX: 400, startY: 300,
			endX: 500, endY: 350,
		});

		expect(camera.quaternion.x).toBeCloseTo(initialQuat.x, 10);
		expect(camera.quaternion.y).toBeCloseTo(initialQuat.y, 10);
		expect(camera.quaternion.z).toBeCloseTo(initialQuat.z, 10);
		expect(camera.quaternion.w).toBeCloseTo(initialQuat.w, 10);
		controls.dispose();
	});

	it('dispatches change events during pan', () => {
		const { controls, element } = createControls();
		const changeFn = vi.fn();
		controls.addEventListener('change', changeFn);

		simulateDrag(element, {
			button: 2,
			startX: 400, startY: 300,
			endX: 500, endY: 350,
			steps: 3,
		});

		expect(changeFn.mock.calls.length).toBeGreaterThanOrEqual(1);
		controls.dispose();
	});

	it('larger panSpeed produces larger translation', () => {
		const slow = createControls({ panSpeed: 0.0004 });
		const slowInitial = slow.camera.position.clone();
		simulateDrag(slow.element, { button: 2, startX: 400, startY: 300, endX: 500, endY: 300 });
		const slowDelta = slow.camera.position.distanceTo(slowInitial);
		slow.controls.dispose();

		const fast = createControls({ panSpeed: 0.008 });
		const fastInitial = fast.camera.position.clone();
		simulateDrag(fast.element, { button: 2, startX: 400, startY: 300, endX: 500, endY: 300 });
		const fastDelta = fast.camera.position.distanceTo(fastInitial);
		fast.controls.dispose();

		expect(fastDelta).toBeGreaterThan(slowDelta);
	});

	it('respects pan modifier setting on same-button bindings', () => {
		const { controls, camera, element } = createControls({
			inputBindings: { rotate: { button: 2 }, pan: { button: 2, modifier: 'alt' } },
		});
		const initialPos = camera.position.clone();

		simulateDrag(element, {
			button: 2,
			startX: 400, startY: 300,
			endX: 500, endY: 300,
			ctrlKey: true,
		});
		const afterCtrl = camera.position.clone();

		camera.position.set(0, 0, 1000);
		camera.lookAt(0, 0, 0);
		camera.updateMatrixWorld();

		simulateDrag(element, {
			button: 2,
			startX: 400, startY: 300,
			endX: 500, endY: 300,
			altKey: true,
		});

		expect(afterCtrl.equals(initialPos)).toBe(false);
		expect(camera.position.equals(initialPos)).toBe(false);
		controls.dispose();
	});
});

describe('zoom / dolly', () => {
	it('wheel scroll moves camera closer to pivot', () => {
		const { controls, camera, element } = createControls();
		const initialDistance = camera.position.distanceTo(controls.pivot);

		dispatchWheel(element, - 100);

		const finalDistance = camera.position.distanceTo(controls.pivot);
		expect(finalDistance).toBeLessThan(initialDistance);
		controls.dispose();
	});

	it('wheel scroll moves camera away from pivot', () => {
		const { controls, camera, element } = createControls();
		const initialDistance = camera.position.distanceTo(controls.pivot);

		dispatchWheel(element, 100);

		const finalDistance = camera.position.distanceTo(controls.pivot);
		expect(finalDistance).toBeGreaterThan(initialDistance);
		controls.dispose();
	});

	it('minDistance clamping prevents getting closer than minimum', () => {
		const { controls, camera, element } = createControls({ minDistance: 900 });

		for (let i = 0; i < 50; i ++) {
			dispatchWheel(element, - 200);
		}

		const finalDistance = camera.position.distanceTo(controls.pivot);
		expect(finalDistance).toBeGreaterThanOrEqual(900 - 1);
		controls.dispose();
	});

	it('maxDistance clamping prevents getting farther than maximum', () => {
		const { controls, camera, element } = createControls({ maxDistance: 1200 });

		for (let i = 0; i < 50; i ++) {
			dispatchWheel(element, 200);
		}

		const finalDistance = camera.position.distanceTo(controls.pivot);
		expect(finalDistance).toBeLessThanOrEqual(1200 + 1);
		controls.dispose();
	});

	it('dispatches change event on wheel', () => {
		const { controls, element } = createControls();
		const changeFn = vi.fn();
		controls.addEventListener('change', changeFn);

		dispatchWheel(element, - 100);

		expect(changeFn).toHaveBeenCalled();
		controls.dispose();
	});

	it('does not zoom when enabled = false', () => {
		const { controls, camera, element } = createControls({ enabled: false });
		const initialPos = camera.position.clone();

		dispatchWheel(element, - 100);

		expect(camera.position.equals(initialPos)).toBe(true);
		controls.dispose();
	});
});

describe('damping / inertia', () => {
	it('update() returns false with no velocity', () => {
		const { controls } = createControls();

		expect(controls.update(1 / 60)).toBe(false);
		controls.dispose();
	});

	it('update() returns false when enableDamping = false', () => {
		const { controls, element } = createControls({ enableDamping: false });

		simulateDrag(element, { button: 0, startX: 400, startY: 300, endX: 500, endY: 300 });

		expect(controls.update(1 / 60)).toBe(false);
		controls.dispose();
	});

	it('update() returns false when enabled = false', () => {
		const { controls, element } = createControls();

		simulateDrag(element, { button: 0, startX: 400, startY: 300, endX: 500, endY: 300 });
		controls.enabled = false;

		expect(controls.update(1 / 60)).toBe(false);
		controls.dispose();
	});

	it('update() returns false while dragging', () => {
		const { controls, element } = createControls();

		dispatchPointer(element, 'pointerdown', { button: 0, clientX: 400, clientY: 300 });
		dispatchPointer(element, 'pointermove', { button: 0, clientX: 500, clientY: 300 });

		expect(controls.update(1 / 60)).toBe(false);

		dispatchPointer(element, 'pointerup', { button: 0, clientX: 500, clientY: 300 });
		controls.dispose();
	});

	it('after drag release, update() returns true and moves camera (inertia)', () => {
		const { controls, camera, element } = createControls();

		simulateDrag(element, { button: 0, startX: 400, startY: 300, endX: 500, endY: 300, steps: 3 });

		const posAfterDrag = camera.position.clone();

		const changed = controls.update(1 / 60);
		expect(changed).toBe(true);
		expect(camera.position.equals(posAfterDrag)).toBe(false);
		controls.dispose();
	});

	it('velocity decays over successive update() calls', () => {
		const { controls, camera, element } = createControls();

		simulateDrag(element, { button: 0, startX: 400, startY: 300, endX: 500, endY: 300, steps: 3 });

		const pos0 = camera.position.clone();
		controls.update(1 / 60);
		const delta1 = camera.position.distanceTo(pos0);

		const pos1 = camera.position.clone();
		controls.update(1 / 60);
		const delta2 = camera.position.distanceTo(pos1);

		expect(delta2).toBeLessThan(delta1);
		controls.dispose();
	});

	it('velocity eventually stops (update returns false)', () => {
		const { controls, element } = createControls({ dampingFactor: 0.5 });

		simulateDrag(element, { button: 0, startX: 400, startY: 300, endX: 420, endY: 300, steps: 2 });

		let lastResult = true;
		for (let i = 0; i < 200; i ++) {
			lastResult = controls.update(1 / 60);
			if (! lastResult) break;
		}

		expect(lastResult).toBe(false);
		controls.dispose();
	});

	it('starting a drag clears dolly velocity from a prior wheel zoom', () => {
		const { controls, camera, element } = createControls({ enableDamping: false });

		dispatchWheel(element, - 100);
		const distanceAfterWheel = camera.position.distanceTo(controls.pivot);
		expect(distanceAfterWheel).toBeLessThan(1000);

		dispatchPointer(element, 'pointerdown', { button: 0, clientX: 400, clientY: 300 });
		dispatchPointer(element, 'pointerup', { button: 0, clientX: 400, clientY: 300 });

		controls.enableDamping = true;
		const distanceBefore = camera.position.distanceTo(controls.pivot);
		controls.update(1 / 60);
		const distanceAfter = camera.position.distanceTo(controls.pivot);

		expect(distanceAfter).toBeCloseTo(distanceBefore, 5);
		controls.dispose();
	});
});

describe('configuration', () => {
	it('inputBindings changes which buttons trigger rotation and pan', () => {
		const { controls, camera, element } = createControls({
			inputBindings: { rotate: { button: 1 }, pan: { button: 2 } },
		});
		const initialPos = camera.position.clone();

		simulateDrag(element, { button: 0, startX: 400, startY: 300, endX: 500, endY: 300 });
		expect(camera.position.equals(initialPos)).toBe(true);

		simulateDrag(element, { button: 1, startX: 400, startY: 300, endX: 500, endY: 300 });
		expect(camera.position.equals(initialPos)).toBe(false);
		controls.dispose();
	});

	it('pan works without modifier when buttons differ', () => {
		const { controls, camera, element } = createControls({
			inputBindings: { rotate: { button: 0 }, pan: { button: 2 } },
		});
		const initialQuat = camera.quaternion.clone();

		simulateDrag(element, { button: 2, startX: 400, startY: 300, endX: 500, endY: 350 });

		expect(camera.quaternion.x).toBeCloseTo(initialQuat.x, 10);
		expect(camera.quaternion.y).toBeCloseTo(initialQuat.y, 10);
		expect(camera.quaternion.z).toBeCloseTo(initialQuat.z, 10);
		expect(camera.quaternion.w).toBeCloseTo(initialQuat.w, 10);
		controls.dispose();
	});

	it('preventContextMenu blocks context menu', () => {
		const { controls, element } = createControls({ preventContextMenu: true });
		const event = new Event('contextmenu', { cancelable: true });
		element.dispatchEvent(event);

		expect(event.defaultPrevented).toBe(true);
		controls.dispose();
	});

	it('preventContextMenu = false allows context menu', () => {
		const { controls, element } = createControls({ preventContextMenu: false });
		const event = new Event('contextmenu', { cancelable: true });
		element.dispatchEvent(event);

		expect(event.defaultPrevented).toBe(false);
		controls.dispose();
	});
});

describe('touch', () => {
	it('single-finger drag rotates the camera', () => {
		const { controls, camera, element } = createControls();
		const initialPos = camera.position.clone();
		const initialQuat = camera.quaternion.clone();

		simulateTouchDrag(element, { startX: 400, startY: 300, endX: 500, endY: 300 });

		expect(camera.position.equals(initialPos)).toBe(false);
		expect(camera.quaternion.equals(initialQuat)).toBe(false);
		controls.dispose();
	});

	it('single-finger drag pans when touchBindings.one = pan', () => {
		const { controls, camera, element } = createControls({
			touchBindings: { one: 'pan', two: 'rotate', pinch: true },
		});
		const initialQuat = camera.quaternion.clone();

		simulateTouchDrag(element, { startX: 400, startY: 300, endX: 500, endY: 350 });

		expect(camera.quaternion.x).toBeCloseTo(initialQuat.x, 10);
		expect(camera.quaternion.y).toBeCloseTo(initialQuat.y, 10);
		expect(camera.quaternion.z).toBeCloseTo(initialQuat.z, 10);
		expect(camera.quaternion.w).toBeCloseTo(initialQuat.w, 10);
		controls.dispose();
	});

	it('two-finger drag pans the camera', () => {
		const { controls, camera, element } = createControls();
		const initialQuat = camera.quaternion.clone();

		dispatchTouch(element, 'pointerdown', { clientX: 350, clientY: 300, pointerId: 10 });
		dispatchTouch(element, 'pointerdown', { clientX: 450, clientY: 300, pointerId: 11 });

		for (let i = 1; i <= 5; i ++) {
			dispatchTouch(element, 'pointermove', { clientX: 350 + i * 20, clientY: 300, pointerId: 10 });
			dispatchTouch(element, 'pointermove', { clientX: 450 + i * 20, clientY: 300, pointerId: 11 });
		}

		dispatchTouch(element, 'pointerup', { clientX: 450, clientY: 300, pointerId: 10 });
		dispatchTouch(element, 'pointerup', { clientX: 550, clientY: 300, pointerId: 11 });

		expect(camera.quaternion.x).toBeCloseTo(initialQuat.x, 10);
		expect(camera.quaternion.y).toBeCloseTo(initialQuat.y, 10);
		expect(camera.quaternion.z).toBeCloseTo(initialQuat.z, 10);
		expect(camera.quaternion.w).toBeCloseTo(initialQuat.w, 10);
		controls.dispose();
	});

	it('pinch zooms the camera closer', () => {
		const { controls, camera, element } = createControls();
		const initialDistance = camera.position.distanceTo(controls.pivot);

		simulatePinch(element, { startSpread: 100, endSpread: 300, steps: 5 });

		const finalDistance = camera.position.distanceTo(controls.pivot);
		expect(finalDistance).toBeLessThan(initialDistance);
		controls.dispose();
	});

	it('pinch zooms the camera farther', () => {
		const { controls, camera, element } = createControls();
		const initialDistance = camera.position.distanceTo(controls.pivot);

		simulatePinch(element, { startSpread: 300, endSpread: 100, steps: 5 });

		const finalDistance = camera.position.distanceTo(controls.pivot);
		expect(finalDistance).toBeGreaterThan(initialDistance);
		controls.dispose();
	});

	it('pinch disabled when touchBindings.pinch = false', () => {
		const { controls, camera, element } = createControls({
			touchBindings: { one: 'rotate', two: 'pan', pinch: false },
		});
		const initialDistance = camera.position.distanceTo(controls.pivot);

		simulatePinch(element, { startSpread: 100, endSpread: 300, steps: 5 });

		const finalDistance = camera.position.distanceTo(controls.pivot);
		expect(finalDistance).toBeCloseTo(initialDistance, 0);
		controls.dispose();
	});

	it('dispatches start and end events for touch', () => {
		const { controls, element } = createControls();
		const startFn = vi.fn();
		const endFn = vi.fn();
		controls.addEventListener('start', startFn);
		controls.addEventListener('end', endFn);

		simulateTouchDrag(element, { startX: 400, startY: 300, endX: 500, endY: 300 });

		expect(startFn).toHaveBeenCalledTimes(1);
		expect(endFn).toHaveBeenCalledTimes(1);
		controls.dispose();
	});
});

describe('orthographic rotation', () => {
	it('drag rotates the ortho camera', () => {
		const { controls, camera, element } = createOrthoControls();
		const initialQuat = camera.quaternion.clone();

		simulateDrag(element, { button: 0, startX: 400, startY: 300, endX: 500, endY: 300 });

		expect(camera.quaternion.equals(initialQuat)).toBe(false);
		controls.dispose();
	});

	it('camera.zoom remains unchanged during rotation', () => {
		const { controls, camera, element } = createOrthoControls();
		const initialZoom = camera.zoom;

		simulateDrag(element, { button: 0, startX: 400, startY: 300, endX: 500, endY: 300 });

		expect(camera.zoom).toBe(initialZoom);
		controls.dispose();
	});
});

describe('orthographic zoom', () => {
	it('wheel scroll zooms in (increases camera.zoom)', () => {
		const { controls, camera, element } = createOrthoControls();
		const initialZoom = camera.zoom;

		dispatchWheel(element, - 100);

		expect(camera.zoom).toBeGreaterThan(initialZoom);
		controls.dispose();
	});

	it('wheel scroll zooms out (decreases camera.zoom)', () => {
		const { controls, camera, element } = createOrthoControls();
		const initialZoom = camera.zoom;

		dispatchWheel(element, 100);

		expect(camera.zoom).toBeLessThan(initialZoom);
		controls.dispose();
	});

	it('camera.zoom does not go below minZoom', () => {
		const { controls, camera, element } = createOrthoControls({ minZoom: 0.5 });

		for (let i = 0; i < 100; i ++) dispatchWheel(element, 200);

		expect(camera.zoom).toBeGreaterThanOrEqual(0.5);
		controls.dispose();
	});

	it('camera.zoom does not exceed maxZoom', () => {
		const { controls, camera, element } = createOrthoControls({ maxZoom: 5 });

		for (let i = 0; i < 100; i ++) dispatchWheel(element, - 200);

		expect(camera.zoom).toBeLessThanOrEqual(5);
		controls.dispose();
	});

	it('does not move camera along forward axis', () => {
		const { controls, camera, element } = createOrthoControls();
		const initialZ = camera.position.z;

		dispatchWheel(element, - 100, 400, 300);

		expect(camera.position.z).toBeCloseTo(initialZ, 1);
		controls.dispose();
	});
});

describe('orthographic pan', () => {
	it('right-drag pans the ortho camera', () => {
		const { controls, camera, element } = createOrthoControls();
		const initialPos = camera.position.clone();

		simulateDrag(element, { button: 2, startX: 400, startY: 300, endX: 500, endY: 350 });

		expect(camera.position.equals(initialPos)).toBe(false);
		controls.dispose();
	});

	it('camera quaternion stays constant during ortho pan', () => {
		const { controls, camera, element } = createOrthoControls();
		const initialQuat = camera.quaternion.clone();

		simulateDrag(element, { button: 2, startX: 400, startY: 300, endX: 500, endY: 350 });

		expect(camera.quaternion.x).toBeCloseTo(initialQuat.x, 10);
		expect(camera.quaternion.y).toBeCloseTo(initialQuat.y, 10);
		expect(camera.quaternion.z).toBeCloseTo(initialQuat.z, 10);
		expect(camera.quaternion.w).toBeCloseTo(initialQuat.w, 10);
		controls.dispose();
	});

	it('camera.zoom stays constant during ortho pan', () => {
		const { controls, camera, element } = createOrthoControls();
		const initialZoom = camera.zoom;

		simulateDrag(element, { button: 2, startX: 400, startY: 300, endX: 500, endY: 350 });

		expect(camera.zoom).toBe(initialZoom);
		controls.dispose();
	});
});

describe('orthographic touch', () => {
	it('pinch zoom in increases camera.zoom', () => {
		const { controls, camera, element } = createOrthoControls();
		const initialZoom = camera.zoom;

		simulatePinch(element, { startSpread: 100, endSpread: 300, steps: 5 });

		expect(camera.zoom).toBeGreaterThan(initialZoom);
		controls.dispose();
	});

	it('pinch zoom out decreases camera.zoom', () => {
		const { controls, camera, element } = createOrthoControls();
		const initialZoom = camera.zoom;

		simulatePinch(element, { startSpread: 300, endSpread: 100, steps: 5 });

		expect(camera.zoom).toBeLessThan(initialZoom);
		controls.dispose();
	});
});

describe('orthographic damping', () => {
	it('zoom velocity decays over successive updates', () => {
		const { controls, camera, element } = createOrthoControls();

		dispatchWheel(element, - 100);

		const zoom0 = camera.zoom;
		controls.update(1 / 60);
		const ratio1 = camera.zoom / zoom0;

		const zoom1 = camera.zoom;
		controls.update(1 / 60);
		const ratio2 = camera.zoom / zoom1;

		expect(Math.abs(ratio2 - 1)).toBeLessThan(Math.abs(ratio1 - 1));
		controls.dispose();
	});

	it('starting a drag clears zoom velocity', () => {
		const { controls, camera, element } = createOrthoControls({ enableDamping: false });

		dispatchWheel(element, - 100);
		const zoomAfterWheel = camera.zoom;
		expect(zoomAfterWheel).toBeGreaterThan(1);

		dispatchPointer(element, 'pointerdown', { button: 0, clientX: 400, clientY: 300 });
		dispatchPointer(element, 'pointerup', { button: 0, clientX: 400, clientY: 300 });

		controls.enableDamping = true;
		const zoomBefore = camera.zoom;
		controls.update(1 / 60);

		expect(camera.zoom).toBeCloseTo(zoomBefore, 5);
		controls.dispose();
	});
});

describe('fov zoom', () => {
	it('wheel scroll in fov mode decreases camera.fov (zoom in)', () => {
		const { controls, camera, element } = createControls({ zoomMode: 'fov' });
		const initialFov = camera.fov;

		dispatchWheel(element, - 100);

		expect(camera.fov).toBeLessThan(initialFov);
		controls.dispose();
	});

	it('wheel scroll in fov mode increases camera.fov (zoom out)', () => {
		const { controls, camera, element } = createControls({ zoomMode: 'fov' });
		const initialFov = camera.fov;

		dispatchWheel(element, 100);

		expect(camera.fov).toBeGreaterThan(initialFov);
		controls.dispose();
	});

	it('camera distance from pivot stays approximately constant during fov zoom', () => {
		const { controls, camera, element } = createControls({ zoomMode: 'fov' });
		const initialDistance = camera.position.distanceTo(controls.pivot);

		dispatchWheel(element, - 100, 400, 300);

		const finalDistance = camera.position.distanceTo(controls.pivot);
		expect(finalDistance).toBeCloseTo(initialDistance, 0);
		controls.dispose();
	});

	it('minFov clamping prevents fov from going below minimum', () => {
		const { controls, camera, element } = createControls({ zoomMode: 'fov', minFov: 10 });

		for (let i = 0; i < 100; i ++) dispatchWheel(element, - 200);

		expect(camera.fov).toBeGreaterThanOrEqual(10);
		controls.dispose();
	});

	it('maxFov clamping prevents fov from exceeding maximum', () => {
		const { controls, camera, element } = createControls({ zoomMode: 'fov', maxFov: 80 });

		for (let i = 0; i < 100; i ++) dispatchWheel(element, 200);

		expect(camera.fov).toBeLessThanOrEqual(80);
		controls.dispose();
	});

	it('fov velocity decays with damping', () => {
		const { controls, camera, element } = createControls({ zoomMode: 'fov' });

		dispatchWheel(element, - 100);

		const fov0 = camera.fov;
		controls.update(1 / 60);
		const ratio1 = camera.fov / fov0;

		const fov1 = camera.fov;
		controls.update(1 / 60);
		const ratio2 = camera.fov / fov1;

		expect(Math.abs(ratio2 - 1)).toBeLessThan(Math.abs(ratio1 - 1));
		controls.dispose();
	});

	it('starting a drag clears fov velocity', () => {
		const { controls, camera, element } = createControls({ zoomMode: 'fov', enableDamping: false });

		dispatchWheel(element, - 100);
		expect(camera.fov).toBeLessThan(50);

		dispatchPointer(element, 'pointerdown', { button: 0, clientX: 400, clientY: 300 });
		dispatchPointer(element, 'pointerup', { button: 0, clientX: 400, clientY: 300 });

		controls.enableDamping = true;
		const fovBefore = camera.fov;
		controls.update(1 / 60);

		expect(camera.fov).toBeCloseTo(fovBefore, 5);
		controls.dispose();
	});

	it('pinch zoom changes fov in touch mode', () => {
		const { controls, camera, element } = createControls({ zoomMode: 'fov' });
		const initialFov = camera.fov;

		simulatePinch(element, { startSpread: 100, endSpread: 300, steps: 5 });

		expect(camera.fov).toBeLessThan(initialFov);
		controls.dispose();
	});

	it('dolly mode is unaffected by zoomMode setting (default behavior)', () => {
		const { controls, camera, element } = createControls();
		const initialFov = camera.fov;
		const initialDistance = camera.position.distanceTo(controls.pivot);

		dispatchWheel(element, - 100);

		expect(camera.fov).toBe(initialFov);
		expect(camera.position.distanceTo(controls.pivot)).toBeLessThan(initialDistance);
		controls.dispose();
	});
});

describe('auto zoom', () => {
	it('dollies normally when far from minDistance', () => {
		const { controls, camera, element } = createControls({ zoomMode: 'auto', minDistance: 200 });
		const initialDistance = camera.position.distanceTo(controls.pivot);
		const initialFov = camera.fov;

		dispatchWheel(element, - 100);

		expect(camera.position.distanceTo(controls.pivot)).toBeLessThan(initialDistance);
		expect(camera.fov).toBe(initialFov);
		controls.dispose();
	});

	it('switches to FOV zoom after hitting minDistance', () => {
		const { controls, camera, element } = createControls({ zoomMode: 'auto', minDistance: 100 });
		const initialFov = camera.fov;

		dispatchWheel(element, - 10);

		expect(camera.fov).toBe(initialFov);
		expect(camera.position.distanceTo(controls.pivot)).toBeLessThan(1000);

		for (let i = 0; i < 2000; i ++) dispatchWheel(element, - 100);

		expect(camera.fov).toBeLessThan(initialFov);
		controls.dispose();
	});

	it('camera distance stays at minDistance during FOV zoom phase', () => {
		const { controls, camera, element } = createControls({ zoomMode: 'auto', minDistance: 950 });

		for (let i = 0; i < 100; i ++) dispatchWheel(element, - 100);

		const distanceAtMin = camera.position.distanceTo(controls.pivot);

		for (let i = 0; i < 10; i ++) dispatchWheel(element, - 100);

		const distanceAfterFov = camera.position.distanceTo(controls.pivot);
		expect(distanceAfterFov).toBeCloseTo(distanceAtMin, 0);
		controls.dispose();
	});

	it('zoom-out widens FOV before increasing distance', () => {
		const { controls, camera, element } = createControls({ zoomMode: 'auto', minDistance: 950 });
		const baseFov = camera.fov;

		for (let i = 0; i < 100; i ++) dispatchWheel(element, - 100);

		const narrowedFov = camera.fov;
		expect(narrowedFov).toBeLessThan(baseFov);

		for (let i = 0; i < 3; i ++) dispatchWheel(element, 100);

		expect(camera.fov).toBeGreaterThan(narrowedFov);
		controls.dispose();
	});

	it('FOV does not exceed baseFov during zoom-out', () => {
		const { controls, camera, element } = createControls({ zoomMode: 'auto', minDistance: 950 });
		const baseFov = camera.fov;

		for (let i = 0; i < 100; i ++) dispatchWheel(element, - 100);

		for (let i = 0; i < 200; i ++) dispatchWheel(element, 100);

		expect(camera.fov).toBeLessThanOrEqual(baseFov + 0.1);
		controls.dispose();
	});

	it('resumes dollying outward once FOV is restored', () => {
		const { controls, camera, element } = createControls({ zoomMode: 'auto', minDistance: 950 });
		const baseFov = camera.fov;

		for (let i = 0; i < 200; i ++) dispatchWheel(element, - 50);

		const narrowedFov = camera.fov;
		expect(narrowedFov).toBeLessThan(baseFov);

		for (let i = 0; i < 200; i ++) dispatchWheel(element, 50);

		expect(camera.fov).toBeGreaterThan(narrowedFov);
		expect(camera.fov).toBeLessThanOrEqual(baseFov + 0.1);

		const distanceBefore = camera.position.distanceTo(controls.pivot);

		dispatchWheel(element, 100);

		expect(camera.position.distanceTo(controls.pivot)).toBeGreaterThan(distanceBefore);
		controls.dispose();
	});

	it('resetBaseFov updates the base FOV', () => {
		const { controls, camera, element } = createControls({ zoomMode: 'auto', minDistance: 950 });

		camera.fov = 30;
		camera.updateProjectionMatrix();
		controls.resetBaseFov();

		for (let i = 0; i < 100; i ++) dispatchWheel(element, - 100);

		for (let i = 0; i < 200; i ++) dispatchWheel(element, 100);

		expect(camera.fov).toBeLessThanOrEqual(30 + 0.1);
		controls.dispose();
	});
});

describe('keyboard', () => {
	it('has correct default keyboard property values', () => {
		const camera = createCamera();
		const controls = new CADCameraControls(camera);
		expect(controls.enableKeyboard).toBe(true);
		expect(controls.keyboardBindings).toEqual({
			rotate: { modifier: 'shift' },
			pan: {},
			zoom: false,
		});
		expect(controls.keyPanSpeed).toBe(7);
		expect(controls.keyRotateSpeed).toBe(1);
		expect(controls.keys).toEqual({
			LEFT: 'ArrowLeft',
			UP: 'ArrowUp',
			RIGHT: 'ArrowRight',
			BOTTOM: 'ArrowDown',
		});
		controls.dispose();
	});

	it('arrow keys pan the camera when no modifier is held', () => {
		const { controls, camera, element } = createControls();
		controls.listenToKeyEvents(element);
		const initialPos = camera.position.clone();

		dispatchKeyDown(element, 'ArrowLeft');

		expect(camera.position.equals(initialPos)).toBe(false);
		controls.dispose();
	});

	it('arrow keys rotate the camera when rotate modifier is held (default: shift)', () => {
		const { controls, camera, element } = createControls();
		controls.listenToKeyEvents(element);
		const initialQuat = camera.quaternion.clone();

		dispatchKeyDown(element, 'ArrowLeft', { shiftKey: true });

		expect(camera.quaternion.equals(initialQuat)).toBe(false);
		controls.dispose();
	});

	it('bare arrow keys do not rotate when rotate has modifier', () => {
		const { controls, camera, element } = createControls();
		controls.listenToKeyEvents(element);
		const initialQuat = camera.quaternion.clone();

		dispatchKeyDown(element, 'ArrowLeft');

		expect(camera.quaternion.equals(initialQuat)).toBe(true);
		controls.dispose();
	});

	it('respects custom keyboardBindings with rotate modifier ctrl', () => {
		const { controls, camera, element } = createControls({
			keyboardBindings: { rotate: { modifier: 'ctrl' }, pan: {}, zoom: false },
		});
		controls.listenToKeyEvents(element);

		const initialQuat = camera.quaternion.clone();
		dispatchKeyDown(element, 'ArrowRight', { ctrlKey: true });
		expect(camera.quaternion.equals(initialQuat)).toBe(false);

		controls.dispose();
	});

	it('respects custom keyboardBindings with pan modifier', () => {
		const { controls, camera, element } = createControls({
			keyboardBindings: { rotate: {}, pan: { modifier: 'alt' }, zoom: false },
		});
		controls.listenToKeyEvents(element);

		const quatBefore = camera.quaternion.clone();
		dispatchKeyDown(element, 'ArrowLeft');
		expect(camera.quaternion.equals(quatBefore)).toBe(false);

		const posBefore = camera.position.clone();
		dispatchKeyDown(element, 'ArrowLeft', { altKey: true });
		expect(camera.position.equals(posBefore)).toBe(false);

		controls.dispose();
	});

	it('supports both modifiers for rotate and pan', () => {
		const { controls, camera, element } = createControls({
			keyboardBindings: { rotate: { modifier: 'ctrl' }, pan: { modifier: 'shift' }, zoom: false },
		});
		controls.listenToKeyEvents(element);

		const quatBefore = camera.quaternion.clone();
		dispatchKeyDown(element, 'ArrowLeft', { ctrlKey: true });
		expect(camera.quaternion.equals(quatBefore)).toBe(false);

		const posBefore = camera.position.clone();
		dispatchKeyDown(element, 'ArrowRight', { shiftKey: true });
		expect(camera.position.equals(posBefore)).toBe(false);

		controls.dispose();
	});

	it('ignores bare arrow keys when both bindings have modifiers', () => {
		const { controls, camera, element } = createControls({
			keyboardBindings: { rotate: { modifier: 'ctrl' }, pan: { modifier: 'shift' }, zoom: false },
		});
		controls.listenToKeyEvents(element);
		const initialPos = camera.position.clone();
		const initialQuat = camera.quaternion.clone();

		dispatchKeyDown(element, 'ArrowLeft');

		expect(camera.position.equals(initialPos)).toBe(true);
		expect(camera.quaternion.equals(initialQuat)).toBe(true);
		controls.dispose();
	});

	it('does not respond to keys when enableKeyboard is false', () => {
		const { controls, camera, element } = createControls();
		controls.listenToKeyEvents(element);
		controls.enableKeyboard = false;
		const initialPos = camera.position.clone();

		dispatchKeyDown(element, 'ArrowLeft');

		expect(camera.position.equals(initialPos)).toBe(true);
		controls.dispose();
	});

	it('does not respond to keys when enabled is false', () => {
		const { controls, camera, element } = createControls({ enabled: false });
		controls.listenToKeyEvents(element);
		const initialPos = camera.position.clone();

		dispatchKeyDown(element, 'ArrowLeft');

		expect(camera.position.equals(initialPos)).toBe(true);
		controls.dispose();
	});

	it('does not respond to keys before listenToKeyEvents is called', () => {
		const { controls, camera, element } = createControls();
		const initialPos = camera.position.clone();

		dispatchKeyDown(element, 'ArrowLeft');

		expect(camera.position.equals(initialPos)).toBe(true);
		controls.dispose();
	});

	it('stopListenToKeyEvents removes keyboard listener', () => {
		const { controls, camera, element } = createControls();
		controls.listenToKeyEvents(element);
		controls.stopListenToKeyEvents();
		const initialPos = camera.position.clone();

		dispatchKeyDown(element, 'ArrowLeft');

		expect(camera.position.equals(initialPos)).toBe(true);
		controls.dispose();
	});

	it('dispose stops keyboard events', () => {
		const { controls, camera, element } = createControls();
		controls.listenToKeyEvents(element);
		controls.dispose();
		const initialPos = camera.position.clone();

		dispatchKeyDown(element, 'ArrowLeft');

		expect(camera.position.equals(initialPos)).toBe(true);
	});

	it('larger keyPanSpeed produces larger translation', () => {
		const slow = createControls();
		slow.controls.keyPanSpeed = 3;
		slow.controls.listenToKeyEvents(slow.element);
		const slowInitial = slow.camera.position.clone();
		dispatchKeyDown(slow.element, 'ArrowLeft');
		const slowDelta = slow.camera.position.distanceTo(slowInitial);
		slow.controls.dispose();

		const fast = createControls();
		fast.controls.keyPanSpeed = 20;
		fast.controls.listenToKeyEvents(fast.element);
		const fastInitial = fast.camera.position.clone();
		dispatchKeyDown(fast.element, 'ArrowLeft');
		const fastDelta = fast.camera.position.distanceTo(fastInitial);
		fast.controls.dispose();

		expect(fastDelta).toBeGreaterThan(slowDelta);
	});

	it('pan preserves camera orientation', () => {
		const { controls, camera, element } = createControls();
		controls.listenToKeyEvents(element);
		const initialQuat = camera.quaternion.clone();

		dispatchKeyDown(element, 'ArrowLeft');
		dispatchKeyDown(element, 'ArrowUp');

		expect(camera.quaternion.x).toBeCloseTo(initialQuat.x, 10);
		expect(camera.quaternion.y).toBeCloseTo(initialQuat.y, 10);
		expect(camera.quaternion.z).toBeCloseTo(initialQuat.z, 10);
		expect(camera.quaternion.w).toBeCloseTo(initialQuat.w, 10);
		controls.dispose();
	});

	it('rotation preserves camera distance from pivot', () => {
		const { controls, camera, element } = createControls();
		controls.listenToKeyEvents(element);
		const initialDistance = camera.position.distanceTo(controls.pivot);

		dispatchKeyDown(element, 'ArrowLeft', { shiftKey: true });

		expect(camera.position.distanceTo(controls.pivot)).toBeCloseTo(initialDistance, 5);
		controls.dispose();
	});

	it('dispatches start, change, and end events', () => {
		const { controls, element } = createControls();
		controls.listenToKeyEvents(element);
		const startFn = vi.fn();
		const changeFn = vi.fn();
		const endFn = vi.fn();
		controls.addEventListener('start', startFn);
		controls.addEventListener('change', changeFn);
		controls.addEventListener('end', endFn);

		dispatchKeyDown(element, 'ArrowLeft');

		expect(startFn).toHaveBeenCalledTimes(1);
		expect(changeFn).toHaveBeenCalledTimes(1);
		expect(endFn).toHaveBeenCalledTimes(1);
		controls.dispose();
	});

	it('keyboard sets velocity for damping after keypress', () => {
		const { controls, camera, element } = createControls();
		controls.listenToKeyEvents(element);

		dispatchKeyDown(element, 'ArrowLeft');
		const posAfterKey = camera.position.clone();

		const changed = controls.update(1 / 60);
		expect(changed).toBe(true);
		expect(camera.position.equals(posAfterKey)).toBe(false);
		controls.dispose();
	});

	it('ignores non-configured keys', () => {
		const { controls, camera, element } = createControls();
		controls.listenToKeyEvents(element);
		const initialPos = camera.position.clone();

		dispatchKeyDown(element, 'KeyW');

		expect(camera.position.equals(initialPos)).toBe(true);
		controls.dispose();
	});

	it('respects custom keys configuration', () => {
		const { controls, camera, element } = createControls();
		controls.keys = { LEFT: 'KeyA', UP: 'KeyW', RIGHT: 'KeyD', BOTTOM: 'KeyS' };
		controls.listenToKeyEvents(element);
		const initialPos = camera.position.clone();

		dispatchKeyDown(element, 'KeyA');

		expect(camera.position.equals(initialPos)).toBe(false);
		controls.dispose();
	});

	it('preventDefault is called on configured keys', () => {
		const { controls, element } = createControls();
		controls.listenToKeyEvents(element);

		const event = new KeyboardEvent('keydown', {
			bubbles: true, cancelable: true, code: 'ArrowLeft',
		});
		const spy = vi.spyOn(event, 'preventDefault');
		element.dispatchEvent(event);

		expect(spy).toHaveBeenCalledTimes(1);
		controls.dispose();
	});

	it('all four arrow keys produce movement in different directions', () => {
		const directions = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
		const positions: Vector3[] = [];

		for (const code of directions) {
			const { controls, camera, element } = createControls();
			controls.listenToKeyEvents(element);
			dispatchKeyDown(element, code);
			positions.push(camera.position.clone());
			controls.dispose();
		}

		for (let i = 0; i < positions.length; i ++) {
			for (let j = i + 1; j < positions.length; j ++) {
				expect(positions[i].equals(positions[j])).toBe(false);
			}
		}
	});

	it('has correct default keyZoomSpeed', () => {
		const camera = createCamera();
		const controls = new CADCameraControls(camera);
		expect(controls.keyZoomSpeed).toBe(1);
		controls.dispose();
	});

	it('default keyboardBindings has zoom disabled', () => {
		const camera = createCamera();
		const controls = new CADCameraControls(camera);
		expect(controls.keyboardBindings.zoom).toBe(false);
		controls.dispose();
	});

	it('zoom modifier + UP zooms in (decreases distance)', () => {
		const { controls, camera, element } = createControls({
			keyboardBindings: { rotate: { modifier: 'shift' }, pan: {}, zoom: { modifier: 'ctrl' } },
		});
		controls.listenToKeyEvents(element);
		const initialDistance = camera.position.distanceTo(controls.pivot);

		dispatchKeyDown(element, 'ArrowUp', { ctrlKey: true });

		expect(camera.position.distanceTo(controls.pivot)).toBeLessThan(initialDistance);
		controls.dispose();
	});

	it('zoom modifier + DOWN zooms out (increases distance)', () => {
		const { controls, camera, element } = createControls({
			keyboardBindings: { rotate: { modifier: 'shift' }, pan: {}, zoom: { modifier: 'ctrl' } },
		});
		controls.listenToKeyEvents(element);
		const initialDistance = camera.position.distanceTo(controls.pivot);

		dispatchKeyDown(element, 'ArrowDown', { ctrlKey: true });

		expect(camera.position.distanceTo(controls.pivot)).toBeGreaterThan(initialDistance);
		controls.dispose();
	});

	it('zoom modifier + LEFT/RIGHT does nothing', () => {
		const { controls, camera, element } = createControls({
			keyboardBindings: { rotate: { modifier: 'shift' }, pan: {}, zoom: { modifier: 'ctrl' } },
		});
		controls.listenToKeyEvents(element);
		const initialPos = camera.position.clone();
		const initialQuat = camera.quaternion.clone();

		dispatchKeyDown(element, 'ArrowLeft', { ctrlKey: true });
		dispatchKeyDown(element, 'ArrowRight', { ctrlKey: true });

		expect(camera.position.equals(initialPos)).toBe(true);
		expect(camera.quaternion.equals(initialQuat)).toBe(true);
		controls.dispose();
	});

	it('larger keyZoomSpeed produces larger zoom', () => {
		const slow = createControls({
			keyboardBindings: { rotate: { modifier: 'shift' }, pan: {}, zoom: { modifier: 'ctrl' } },
			keyZoomSpeed: 0.5,
		});
		slow.controls.listenToKeyEvents(slow.element);
		const slowInitialDist = slow.camera.position.distanceTo(slow.controls.pivot);
		dispatchKeyDown(slow.element, 'ArrowUp', { ctrlKey: true });
		const slowDelta = slowInitialDist - slow.camera.position.distanceTo(slow.controls.pivot);
		slow.controls.dispose();

		const fast = createControls({
			keyboardBindings: { rotate: { modifier: 'shift' }, pan: {}, zoom: { modifier: 'ctrl' } },
			keyZoomSpeed: 3,
		});
		fast.controls.listenToKeyEvents(fast.element);
		const fastInitialDist = fast.camera.position.distanceTo(fast.controls.pivot);
		dispatchKeyDown(fast.element, 'ArrowUp', { ctrlKey: true });
		const fastDelta = fastInitialDist - fast.camera.position.distanceTo(fast.controls.pivot);
		fast.controls.dispose();

		expect(fastDelta).toBeGreaterThan(slowDelta);
	});

	it('keyboard zoom works with orthographic camera (increases camera.zoom)', () => {
		const { controls, camera, element } = createOrthoControls({
			keyboardBindings: { rotate: { modifier: 'shift' }, pan: {}, zoom: { modifier: 'ctrl' } },
		});
		controls.listenToKeyEvents(element);
		const initialZoom = camera.zoom;

		dispatchKeyDown(element, 'ArrowUp', { ctrlKey: true });

		expect(camera.zoom).toBeGreaterThan(initialZoom);
		controls.dispose();
	});

	it('keyboard zoom works with orthographic camera (decreases camera.zoom)', () => {
		const { controls, camera, element } = createOrthoControls({
			keyboardBindings: { rotate: { modifier: 'shift' }, pan: {}, zoom: { modifier: 'ctrl' } },
		});
		controls.listenToKeyEvents(element);
		const initialZoom = camera.zoom;

		dispatchKeyDown(element, 'ArrowDown', { ctrlKey: true });

		expect(camera.zoom).toBeLessThan(initialZoom);
		controls.dispose();
	});

	it('keyboard zoom dispatches start and end events', () => {
		const { controls, element } = createControls({
			keyboardBindings: { rotate: { modifier: 'shift' }, pan: {}, zoom: { modifier: 'ctrl' } },
		});
		controls.listenToKeyEvents(element);
		const startFn = vi.fn();
		const endFn = vi.fn();
		controls.addEventListener('start', startFn);
		controls.addEventListener('end', endFn);

		dispatchKeyDown(element, 'ArrowUp', { ctrlKey: true });

		expect(startFn).toHaveBeenCalledTimes(1);
		expect(endFn).toHaveBeenCalledTimes(1);
		controls.dispose();
	});

	it('keyboard zoom preserves camera orientation', () => {
		const { controls, camera, element } = createControls({
			keyboardBindings: { rotate: { modifier: 'shift' }, pan: {}, zoom: { modifier: 'ctrl' } },
		});
		controls.listenToKeyEvents(element);
		const initialQuat = camera.quaternion.clone();

		dispatchKeyDown(element, 'ArrowUp', { ctrlKey: true });

		expect(camera.quaternion.x).toBeCloseTo(initialQuat.x, 10);
		expect(camera.quaternion.y).toBeCloseTo(initialQuat.y, 10);
		expect(camera.quaternion.z).toBeCloseTo(initialQuat.z, 10);
		expect(camera.quaternion.w).toBeCloseTo(initialQuat.w, 10);
		controls.dispose();
	});

	it('keyboard zoom does not fire when zoom is disabled', () => {
		const { controls, camera, element } = createControls({
			keyboardBindings: { rotate: { modifier: 'ctrl' }, pan: { modifier: 'shift' }, zoom: false },
		});
		controls.listenToKeyEvents(element);
		const initialPos = camera.position.clone();
		const initialQuat = camera.quaternion.clone();

		dispatchKeyDown(element, 'ArrowUp', { altKey: true });

		expect(camera.position.equals(initialPos)).toBe(true);
		expect(camera.quaternion.equals(initialQuat)).toBe(true);
		controls.dispose();
	});

	it('bare zoom + UP zooms in when both rotate and pan have modifiers', () => {
		const { controls, camera, element } = createControls({
			keyboardBindings: { rotate: { modifier: 'ctrl' }, pan: { modifier: 'shift' }, zoom: {} },
		});
		controls.listenToKeyEvents(element);
		const initialDistance = camera.position.distanceTo(controls.pivot);

		dispatchKeyDown(element, 'ArrowUp');

		expect(camera.position.distanceTo(controls.pivot)).toBeLessThan(initialDistance);
		controls.dispose();
	});

	it('bare zoom + DOWN zooms out when both rotate and pan have modifiers', () => {
		const { controls, camera, element } = createControls({
			keyboardBindings: { rotate: { modifier: 'ctrl' }, pan: { modifier: 'shift' }, zoom: {} },
		});
		controls.listenToKeyEvents(element);
		const initialDistance = camera.position.distanceTo(controls.pivot);

		dispatchKeyDown(element, 'ArrowDown');

		expect(camera.position.distanceTo(controls.pivot)).toBeGreaterThan(initialDistance);
		controls.dispose();
	});

	it('bare zoom does not fire when a modifier is held', () => {
		const { controls, camera, element } = createControls({
			keyboardBindings: { rotate: { modifier: 'ctrl' }, pan: { modifier: 'shift' }, zoom: {} },
		});
		controls.listenToKeyEvents(element);

		const quatBefore = camera.quaternion.clone();
		dispatchKeyDown(element, 'ArrowUp', { ctrlKey: true });
		expect(camera.quaternion.equals(quatBefore)).toBe(false);

		controls.dispose();
	});

	it('bare zoom + LEFT/RIGHT does nothing', () => {
		const { controls, camera, element } = createControls({
			keyboardBindings: { rotate: { modifier: 'ctrl' }, pan: { modifier: 'shift' }, zoom: {} },
		});
		controls.listenToKeyEvents(element);
		const initialPos = camera.position.clone();
		const initialQuat = camera.quaternion.clone();

		dispatchKeyDown(element, 'ArrowLeft');
		dispatchKeyDown(element, 'ArrowRight');

		expect(camera.position.equals(initialPos)).toBe(true);
		expect(camera.quaternion.equals(initialQuat)).toBe(true);
		controls.dispose();
	});

	it('bare zoom dispatches start and end events', () => {
		const { controls, element } = createControls({
			keyboardBindings: { rotate: { modifier: 'ctrl' }, pan: { modifier: 'shift' }, zoom: {} },
		});
		controls.listenToKeyEvents(element);
		const startFn = vi.fn();
		const endFn = vi.fn();
		controls.addEventListener('start', startFn);
		controls.addEventListener('end', endFn);

		dispatchKeyDown(element, 'ArrowUp');

		expect(startFn).toHaveBeenCalledTimes(1);
		expect(endFn).toHaveBeenCalledTimes(1);
		controls.dispose();
	});

	it('bare zoom works with orthographic camera', () => {
		const { controls, camera, element } = createOrthoControls({
			keyboardBindings: { rotate: { modifier: 'ctrl' }, pan: { modifier: 'shift' }, zoom: {} },
		});
		controls.listenToKeyEvents(element);
		const initialZoom = camera.zoom;

		dispatchKeyDown(element, 'ArrowUp');

		expect(camera.zoom).toBeGreaterThan(initialZoom);
		controls.dispose();
	});

	it('bare zoom preserves camera orientation', () => {
		const { controls, camera, element } = createControls({
			keyboardBindings: { rotate: { modifier: 'ctrl' }, pan: { modifier: 'shift' }, zoom: {} },
		});
		controls.listenToKeyEvents(element);
		const initialQuat = camera.quaternion.clone();

		dispatchKeyDown(element, 'ArrowUp');

		expect(camera.quaternion.x).toBeCloseTo(initialQuat.x, 10);
		expect(camera.quaternion.y).toBeCloseTo(initialQuat.y, 10);
		expect(camera.quaternion.z).toBeCloseTo(initialQuat.z, 10);
		expect(camera.quaternion.w).toBeCloseTo(initialQuat.w, 10);
		controls.dispose();
	});

	it('validates: throws on duplicate modifiers', () => {
		expect(() => createControls({
			keyboardBindings: { rotate: { modifier: 'ctrl' }, pan: { modifier: 'ctrl' }, zoom: false },
		})).toThrow('duplicate modifier');
	});

	it('validates: throws on two bare actions', () => {
		expect(() => createControls({
			keyboardBindings: { rotate: {}, pan: {}, zoom: false },
		})).toThrow('at most one action can be bare');
	});

	it('validates: throws on all disabled', () => {
		expect(() => createControls({
			keyboardBindings: { rotate: false, pan: false, zoom: false },
		})).toThrow('at least one action must be active');
	});
});
