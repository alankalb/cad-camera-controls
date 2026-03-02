import { describe, it, expect, vi } from 'vitest';
import { Box3, Quaternion, Sphere, Vector3, MathUtils } from 'three';
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
		expect(controls.dampingFactor).toBe(0.2);
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

		for (let i = 0; i < 1000; i ++) dispatchWheel(element, - 100);

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

describe('fitToBox', () => {
	it('perspective snap: camera moves to correct distance from box center', () => {
		const { controls, camera } = createControls();
		const box = new Box3(new Vector3(- 50, - 50, - 50), new Vector3(50, 50, 50));

		controls.fitToBox(box, false);

		const center = new Vector3();
		box.getCenter(center);

		// Camera should be looking along -Z (default), so it moves along +Z from center
		const distance = camera.position.distanceTo(center);

		// Expected: heightToFit * 0.5 / tan(fov/2) + depth * 0.5
		const fov = camera.getEffectiveFOV() * MathUtils.DEG2RAD;
		const aspect = camera.aspect; // 800/600 = 1.333
		const size = new Vector3(100, 100, 100);
		const heightToFit = (size.x / size.y) < aspect ? size.y : size.x / aspect;
		const expectedDistance = MathUtils.clamp(
			heightToFit * 0.5 / Math.tan(fov * 0.5) + size.z * 0.5,
			controls.minDistance, controls.maxDistance
		);

		expect(distance).toBeCloseTo(expectedDistance, 1);
		controls.dispose();
	});

	it('perspective snap: camera looks along current forward direction', () => {
		const { controls, camera } = createControls();
		const forwardBefore = new Vector3();
		camera.getWorldDirection(forwardBefore);

		const box = new Box3(new Vector3(- 100, - 50, - 30), new Vector3(100, 50, 30));
		controls.fitToBox(box, false);

		const forwardAfter = new Vector3();
		camera.getWorldDirection(forwardAfter);

		expect(forwardAfter.x).toBeCloseTo(forwardBefore.x, 5);
		expect(forwardAfter.y).toBeCloseTo(forwardBefore.y, 5);
		expect(forwardAfter.z).toBeCloseTo(forwardBefore.z, 5);
		controls.dispose();
	});

	it('perspective transition: camera converges to end position over time', async () => {
		const { controls, camera } = createControls();
		const box = new Box3(new Vector3(- 50, - 50, - 50), new Vector3(50, 50, 50));

		const promise = controls.fitToBox(box, true);

		const startPos = camera.position.clone();

		// Pump updates for the 0.5s transition
		for (let i = 0; i < 60; i ++) {
			controls.update(1 / 60);
		}

		await promise;

		const endPos = camera.position.clone();
		expect(endPos.equals(startPos)).toBe(false);

		// Should match the snap position
		const { controls: snapControls, camera: snapCamera } = createControls();
		snapControls.fitToBox(box, false);
		expect(endPos.x).toBeCloseTo(snapCamera.position.x, 1);
		expect(endPos.y).toBeCloseTo(snapCamera.position.y, 1);
		expect(endPos.z).toBeCloseTo(snapCamera.position.z, 1);
		snapControls.dispose();
		controls.dispose();
	});

	it('ortho snap: zoom matches formula, camera centered on box', () => {
		const { controls, camera } = createOrthoControls();
		const box = new Box3(new Vector3(- 200, - 100, - 50), new Vector3(200, 100, 50));

		controls.fitToBox(box, false);

		const baseWidth = (camera.right - camera.left) / 1; // initial zoom = 1
		const baseHeight = (camera.top - camera.bottom) / 1;
		const expectedZoom = MathUtils.clamp(
			Math.min(baseWidth / 400, baseHeight / 200),
			controls.minZoom, controls.maxZoom
		);

		expect(camera.zoom).toBeCloseTo(expectedZoom, 3);
		controls.dispose();
	});

	it('pivot unchanged after fit', () => {
		const { controls } = createControls();
		const pivotBefore = controls.pivot.clone();
		const box = new Box3(new Vector3(100, 100, 100), new Vector3(200, 200, 200));

		controls.fitToBox(box, false);

		expect(controls.pivot.equals(pivotBefore)).toBe(true);
		controls.dispose();
	});

	it('camera orientation unchanged after fit', () => {
		const { controls, camera } = createControls();
		const quatBefore = camera.quaternion.clone();
		const box = new Box3(new Vector3(- 50, - 50, - 50), new Vector3(50, 50, 50));

		controls.fitToBox(box, false);

		expect(camera.quaternion.x).toBeCloseTo(quatBefore.x, 5);
		expect(camera.quaternion.y).toBeCloseTo(quatBefore.y, 5);
		expect(camera.quaternion.z).toBeCloseTo(quatBefore.z, 5);
		expect(camera.quaternion.w).toBeCloseTo(quatBefore.w, 5);
		controls.dispose();
	});

	it('change events fire during transition', () => {
		const { controls } = createControls();
		const changeFn = vi.fn();
		controls.addEventListener('change', changeFn);

		const box = new Box3(new Vector3(- 50, - 50, - 50), new Vector3(50, 50, 50));
		controls.fitToBox(box, true);

		for (let i = 0; i < 30; i ++) {
			controls.update(1 / 60);
		}

		expect(changeFn.mock.calls.length).toBeGreaterThan(1);
		controls.dispose();
	});

	it('snap promise resolves immediately', async () => {
		const { controls } = createControls();
		const box = new Box3(new Vector3(- 50, - 50, - 50), new Vector3(50, 50, 50));

		const promise = controls.fitToBox(box, false);

		// Should already be resolved
		let resolved = false;
		promise.then(() => {
			resolved = true;
		});

		// Flush microtasks
		await Promise.resolve();
		expect(resolved).toBe(true);
		controls.dispose();
	});

	it('transition promise resolves after updates complete', async () => {
		const { controls } = createControls();
		const box = new Box3(new Vector3(- 50, - 50, - 50), new Vector3(50, 50, 50));

		let resolved = false;
		const promise = controls.fitToBox(box, true);
		promise.then(() => {
			resolved = true;
		});

		await Promise.resolve();
		expect(resolved).toBe(false);

		for (let i = 0; i < 60; i ++) {
			controls.update(1 / 60);
		}

		await promise;
		expect(resolved).toBe(true);
		controls.dispose();
	});

	it('empty box returns resolved promise (no-op)', async () => {
		const { controls, camera } = createControls();
		const posBefore = camera.position.clone();
		const box = new Box3(); // empty box

		await controls.fitToBox(box, false);

		expect(camera.position.equals(posBefore)).toBe(true);
		controls.dispose();
	});

	it('degenerate box (single point) returns resolved promise (no-op)', async () => {
		const { controls, camera } = createControls();
		const posBefore = camera.position.clone();
		const box = new Box3(new Vector3(0, 0, 0), new Vector3(0, 0, 0));

		await controls.fitToBox(box, false);

		expect(camera.position.equals(posBefore)).toBe(true);
		controls.dispose();
	});

	it('distance clamped to minDistance', () => {
		const { controls, camera } = createControls({ minDistance: 500 });
		// Tiny box that would normally result in very short distance
		const box = new Box3(new Vector3(- 1, - 1, - 1), new Vector3(1, 1, 1));

		controls.fitToBox(box, false);

		const center = new Vector3();
		box.getCenter(center);
		const distance = camera.position.distanceTo(center);
		expect(distance).toBeGreaterThanOrEqual(500 - 1);
		controls.dispose();
	});

	it('distance clamped to maxDistance', () => {
		const { controls, camera } = createControls({ maxDistance: 200 });
		// Huge box that would normally result in very long distance
		const box = new Box3(new Vector3(- 5000, - 5000, - 5000), new Vector3(5000, 5000, 5000));

		controls.fitToBox(box, false);

		const center = new Vector3();
		box.getCenter(center);
		const distance = camera.position.distanceTo(center);
		expect(distance).toBeLessThanOrEqual(200 + 1);
		controls.dispose();
	});

	it('update() returns true during transition, false after', async () => {
		const { controls } = createControls();
		const box = new Box3(new Vector3(- 50, - 50, - 50), new Vector3(50, 50, 50));

		controls.fitToBox(box, true);

		expect(controls.update(1 / 60)).toBe(true);

		// Complete the transition
		for (let i = 0; i < 60; i ++) {
			controls.update(1 / 60);
		}

		// After transition, should return false (no more changes)
		expect(controls.update(1 / 60)).toBe(false);
		controls.dispose();
	});

	it('padding increases camera distance (perspective)', () => {
		const noPad = createControls();
		const box = new Box3(new Vector3(- 50, - 50, - 50), new Vector3(50, 50, 50));
		noPad.controls.fitToBox(box, false);
		const noPadDistance = noPad.camera.position.distanceTo(new Vector3(0, 0, 0));
		noPad.controls.dispose();

		const withPad = createControls();
		withPad.controls.fitToBox(box, false, 0.2);
		const withPadDistance = withPad.camera.position.distanceTo(new Vector3(0, 0, 0));
		withPad.controls.dispose();

		expect(withPadDistance).toBeGreaterThan(noPadDistance);
	});

	it('padding decreases zoom (ortho)', () => {
		const noPad = createOrthoControls();
		const box = new Box3(new Vector3(- 200, - 100, - 50), new Vector3(200, 100, 50));
		noPad.controls.fitToBox(box, false);
		const noPadZoom = noPad.camera.zoom;
		noPad.controls.dispose();

		const withPad = createOrthoControls();
		withPad.controls.fitToBox(box, false, 0.2);
		const withPadZoom = withPad.camera.zoom;
		withPad.controls.dispose();

		expect(withPadZoom).toBeLessThan(noPadZoom);
	});

	it('negative padding is clamped to 0', () => {
		const noPad = createControls();
		const box = new Box3(new Vector3(- 50, - 50, - 50), new Vector3(50, 50, 50));
		noPad.controls.fitToBox(box, false);
		const noPadDistance = noPad.camera.position.distanceTo(new Vector3(0, 0, 0));
		noPad.controls.dispose();

		const negPad = createControls();
		negPad.controls.fitToBox(box, false, - 0.5);
		const negPadDistance = negPad.camera.position.distanceTo(new Vector3(0, 0, 0));
		negPad.controls.dispose();

		expect(negPadDistance).toBeCloseTo(noPadDistance, 5);
	});
});

describe('fitToSphere', () => {
	it('perspective snap: camera distance = radius / sin(fov/2)', () => {
		const { controls, camera } = createControls();
		const sphere = new Sphere(new Vector3(0, 0, 0), 100);

		controls.fitToSphere(sphere, false);

		const vFOV = camera.getEffectiveFOV() * MathUtils.DEG2RAD;
		const hFOV = 2 * Math.atan(Math.tan(vFOV * 0.5) * camera.aspect);
		const fov = camera.aspect >= 1 ? vFOV : hFOV;
		const expectedDistance = MathUtils.clamp(
			sphere.radius / Math.sin(fov * 0.5),
			controls.minDistance, controls.maxDistance
		);

		const distance = camera.position.distanceTo(sphere.center);
		expect(distance).toBeCloseTo(expectedDistance, 1);
		controls.dispose();
	});

	it('ortho snap: zoom matches formula', () => {
		const { controls, camera } = createOrthoControls();
		const sphere = new Sphere(new Vector3(0, 0, 0), 200);

		controls.fitToSphere(sphere, false);

		const baseWidth = (camera.right - camera.left) / 1;
		const baseHeight = (camera.top - camera.bottom) / 1;
		const diameter = 400;
		const expectedZoom = MathUtils.clamp(
			Math.min(baseWidth / diameter, baseHeight / diameter),
			controls.minZoom, controls.maxZoom
		);

		expect(camera.zoom).toBeCloseTo(expectedZoom, 3);
		controls.dispose();
	});

	it('pivot unchanged after fitToSphere', () => {
		const { controls } = createControls();
		const pivotBefore = controls.pivot.clone();
		const sphere = new Sphere(new Vector3(100, 200, 300), 50);

		controls.fitToSphere(sphere, false);

		expect(controls.pivot.equals(pivotBefore)).toBe(true);
		controls.dispose();
	});

	it('camera orientation unchanged after fitToSphere', () => {
		const { controls, camera } = createControls();
		const quatBefore = camera.quaternion.clone();
		const sphere = new Sphere(new Vector3(0, 0, 0), 100);

		controls.fitToSphere(sphere, false);

		expect(camera.quaternion.x).toBeCloseTo(quatBefore.x, 5);
		expect(camera.quaternion.y).toBeCloseTo(quatBefore.y, 5);
		expect(camera.quaternion.z).toBeCloseTo(quatBefore.z, 5);
		expect(camera.quaternion.w).toBeCloseTo(quatBefore.w, 5);
		controls.dispose();
	});

	it('zero-radius sphere returns resolved promise (no-op)', async () => {
		const { controls, camera } = createControls();
		const posBefore = camera.position.clone();
		const sphere = new Sphere(new Vector3(0, 0, 0), 0);

		await controls.fitToSphere(sphere, false);

		expect(camera.position.equals(posBefore)).toBe(true);
		controls.dispose();
	});

	it('negative-radius sphere returns resolved promise (no-op)', async () => {
		const { controls, camera } = createControls();
		const posBefore = camera.position.clone();
		const sphere = new Sphere(new Vector3(0, 0, 0), - 10);

		await controls.fitToSphere(sphere, false);

		expect(camera.position.equals(posBefore)).toBe(true);
		controls.dispose();
	});

	it('padding increases camera distance (perspective)', () => {
		const sphere = new Sphere(new Vector3(0, 0, 0), 100);

		const noPad = createControls();
		noPad.controls.fitToSphere(sphere, false);
		const noPadDistance = noPad.camera.position.distanceTo(sphere.center);
		noPad.controls.dispose();

		const withPad = createControls();
		withPad.controls.fitToSphere(sphere, false, 0.3);
		const withPadDistance = withPad.camera.position.distanceTo(sphere.center);
		withPad.controls.dispose();

		expect(withPadDistance).toBeGreaterThan(noPadDistance);
	});

	it('padding decreases zoom (ortho)', () => {
		const sphere = new Sphere(new Vector3(0, 0, 0), 200);

		const noPad = createOrthoControls();
		noPad.controls.fitToSphere(sphere, false);
		const noPadZoom = noPad.camera.zoom;
		noPad.controls.dispose();

		const withPad = createOrthoControls();
		withPad.controls.fitToSphere(sphere, false, 0.3);
		const withPadZoom = withPad.camera.zoom;
		withPad.controls.dispose();

		expect(withPadZoom).toBeLessThan(noPadZoom);
	});
});

describe('transition cancellation', () => {
	it('pointer down cancels active transition', async () => {
		const { controls, element } = createControls();
		const box = new Box3(new Vector3(- 50, - 50, - 50), new Vector3(50, 50, 50));

		let resolved = false;
		const promise = controls.fitToBox(box, true);
		promise.then(() => {
			resolved = true;
		});

		// Start the transition partway
		for (let i = 0; i < 10; i ++) {
			controls.update(1 / 60);
		}

		// Simulate pointer down to cancel
		dispatchPointer(element, 'pointerdown', { button: 0, clientX: 400, clientY: 300 });
		dispatchPointer(element, 'pointerup', { button: 0, clientX: 400, clientY: 300 });

		await promise;
		expect(resolved).toBe(true);

		// Transition should be cancelled — update should now return false
		expect(controls.update(1 / 60)).toBe(false);
		controls.dispose();
	});

	it('wheel cancels active transition', async () => {
		const { controls, element } = createControls();
		const box = new Box3(new Vector3(- 50, - 50, - 50), new Vector3(50, 50, 50));

		let resolved = false;
		const promise = controls.fitToBox(box, true);
		promise.then(() => {
			resolved = true;
		});

		controls.update(1 / 60);

		dispatchWheel(element, - 100);

		await promise;
		expect(resolved).toBe(true);
		controls.dispose();
	});

	it('keydown cancels active transition', async () => {
		const { controls, element } = createControls();
		controls.listenToKeyEvents(element);
		const box = new Box3(new Vector3(- 50, - 50, - 50), new Vector3(50, 50, 50));

		let resolved = false;
		const promise = controls.fitToBox(box, true);
		promise.then(() => {
			resolved = true;
		});

		controls.update(1 / 60);

		dispatchKeyDown(element, 'ArrowLeft');

		await promise;
		expect(resolved).toBe(true);
		controls.dispose();
	});

	it('new fit cancels previous fit', async () => {
		const { controls } = createControls();
		const box1 = new Box3(new Vector3(- 50, - 50, - 50), new Vector3(50, 50, 50));
		const box2 = new Box3(new Vector3(- 100, - 100, - 100), new Vector3(100, 100, 100));

		let firstResolved = false;
		const first = controls.fitToBox(box1, true);
		first.then(() => {
			firstResolved = true;
		});

		controls.update(1 / 60);

		// Second fit should cancel first
		const second = controls.fitToBox(box2, true);

		await first;
		expect(firstResolved).toBe(true);

		// Complete second transition
		for (let i = 0; i < 60; i ++) {
			controls.update(1 / 60);
		}

		await second;
		controls.dispose();
	});

	it('dispose cancels active transition', async () => {
		const { controls } = createControls();
		const box = new Box3(new Vector3(- 50, - 50, - 50), new Vector3(50, 50, 50));

		let resolved = false;
		const promise = controls.fitToBox(box, true);
		promise.then(() => {
			resolved = true;
		});

		controls.update(1 / 60);

		controls.dispose();

		await promise;
		expect(resolved).toBe(true);
	});

	it('works with enableDamping = false', () => {
		const { controls, camera } = createControls({ enableDamping: false });
		const box = new Box3(new Vector3(- 50, - 50, - 50), new Vector3(50, 50, 50));
		const posBefore = camera.position.clone();

		controls.fitToBox(box, false);

		expect(camera.position.equals(posBefore)).toBe(false);
		controls.dispose();
	});

	it('programmatic transition works with enabled = false', async () => {
		const { controls } = createControls({ enabled: false });
		const box = new Box3(new Vector3(- 50, - 50, - 50), new Vector3(50, 50, 50));

		const promise = controls.fitToBox(box, true);

		// update should still return true during transition even when enabled=false
		expect(controls.update(1 / 60)).toBe(true);

		for (let i = 0; i < 60; i ++) {
			controls.update(1 / 60);
		}

		await promise;
		controls.dispose();
	});

	it('change event fires on snap', () => {
		const { controls } = createControls();
		const changeFn = vi.fn();
		controls.addEventListener('change', changeFn);

		const box = new Box3(new Vector3(- 50, - 50, - 50), new Vector3(50, 50, 50));
		controls.fitToBox(box, false);

		expect(changeFn).toHaveBeenCalledTimes(1);
		controls.dispose();
	});
});

describe('setView', () => {
	it('snap: moves camera to exact position and orientation', () => {
		const { controls, camera } = createControls();
		const pos = new Vector3(500, 200, 300);
		const quat = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 4);

		controls.setView(pos, quat, false);

		expect(camera.position.x).toBeCloseTo(pos.x, 5);
		expect(camera.position.y).toBeCloseTo(pos.y, 5);
		expect(camera.position.z).toBeCloseTo(pos.z, 5);
		expect(camera.quaternion.x).toBeCloseTo(quat.x, 5);
		expect(camera.quaternion.y).toBeCloseTo(quat.y, 5);
		expect(camera.quaternion.z).toBeCloseTo(quat.z, 5);
		expect(camera.quaternion.w).toBeCloseTo(quat.w, 5);
		controls.dispose();
	});

	it('transition: camera converges to end position and orientation', async () => {
		const { controls, camera } = createControls();
		const pos = new Vector3(500, 200, 300);
		const quat = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);

		const promise = controls.setView(pos, quat, true);

		for (let i = 0; i < 60; i ++) {
			controls.update(1 / 60);
		}

		await promise;

		expect(camera.position.x).toBeCloseTo(pos.x, 1);
		expect(camera.position.y).toBeCloseTo(pos.y, 1);
		expect(camera.position.z).toBeCloseTo(pos.z, 1);
		expect(camera.quaternion.x).toBeCloseTo(quat.x, 3);
		expect(camera.quaternion.y).toBeCloseTo(quat.y, 3);
		expect(camera.quaternion.z).toBeCloseTo(quat.z, 3);
		expect(camera.quaternion.w).toBeCloseTo(quat.w, 3);
		controls.dispose();
	});

	it('transition: orientation interpolates mid-way (not instant)', () => {
		const { controls, camera } = createControls();
		const startQuat = camera.quaternion.clone();
		const endQuat = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI);

		controls.setView(new Vector3(0, 0, - 1000), endQuat, true);

		// Advance ~halfway through the 0.5s transition
		for (let i = 0; i < 15; i ++) {
			controls.update(1 / 60);
		}

		const dotStart = camera.quaternion.dot(startQuat);
		const dotEnd = camera.quaternion.dot(endQuat);

		// Should not be exactly at start or end
		expect(Math.abs(dotStart)).toBeLessThan(0.999);
		expect(Math.abs(dotEnd)).toBeLessThan(0.999);
		controls.dispose();
	});

	it('snap with zoom option sets ortho camera zoom', () => {
		const { controls, camera } = createOrthoControls();
		const pos = new Vector3(0, 0, 500);
		const quat = camera.quaternion.clone();

		controls.setView(pos, quat, false, { zoom: 3.5 });

		expect(camera.zoom).toBeCloseTo(3.5, 5);
		controls.dispose();
	});

	it('transition with zoom option lerps ortho camera zoom', async () => {
		const { controls, camera } = createOrthoControls();
		const initialZoom = camera.zoom; // 1
		const pos = new Vector3(0, 0, 500);
		const quat = camera.quaternion.clone();

		const promise = controls.setView(pos, quat, true, { zoom: 5 });

		// Midway: zoom should be between 1 and 5
		for (let i = 0; i < 15; i ++) {
			controls.update(1 / 60);
		}

		expect(camera.zoom).toBeGreaterThan(initialZoom);
		expect(camera.zoom).toBeLessThan(5);

		// Complete
		for (let i = 0; i < 45; i ++) {
			controls.update(1 / 60);
		}

		await promise;
		expect(camera.zoom).toBeCloseTo(5, 1);
		controls.dispose();
	});

	it('snap with fov option sets perspective camera fov', () => {
		const { controls, camera } = createControls();
		const pos = new Vector3(0, 0, 500);
		const quat = camera.quaternion.clone();

		controls.setView(pos, quat, false, { fov: 90 });

		expect(camera.fov).toBeCloseTo(90, 5);
		controls.dispose();
	});

	it('transition with fov option lerps perspective camera fov', async () => {
		const { controls, camera } = createControls();
		const initialFov = camera.fov; // 50
		const pos = new Vector3(0, 0, 500);
		const quat = camera.quaternion.clone();

		const promise = controls.setView(pos, quat, true, { fov: 90 });

		// Midway
		for (let i = 0; i < 15; i ++) {
			controls.update(1 / 60);
		}

		expect(camera.fov).toBeGreaterThan(initialFov);
		expect(camera.fov).toBeLessThan(90);

		// Complete
		for (let i = 0; i < 45; i ++) {
			controls.update(1 / 60);
		}

		await promise;
		expect(camera.fov).toBeCloseTo(90, 1);
		controls.dispose();
	});

	it('without zoom/fov options, current values are preserved', () => {
		const { controls, camera } = createControls();
		const initialFov = camera.fov;
		const pos = new Vector3(200, 100, 500);
		const quat = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 4);

		controls.setView(pos, quat, false);

		expect(camera.fov).toBeCloseTo(initialFov, 5);
		controls.dispose();
	});

	it('fitToBox does not change orientation (no slerp regression)', () => {
		const { controls, camera } = createControls();
		const quatBefore = camera.quaternion.clone();
		const box = new Box3(new Vector3(- 50, - 50, - 50), new Vector3(50, 50, 50));

		controls.fitToBox(box, false);

		expect(camera.quaternion.x).toBeCloseTo(quatBefore.x, 5);
		expect(camera.quaternion.y).toBeCloseTo(quatBefore.y, 5);
		expect(camera.quaternion.z).toBeCloseTo(quatBefore.z, 5);
		expect(camera.quaternion.w).toBeCloseTo(quatBefore.w, 5);
		controls.dispose();
	});

	it('pivot unchanged after setView', () => {
		const { controls } = createControls();
		const pivotBefore = controls.pivot.clone();

		controls.setView(
			new Vector3(500, 200, 300),
			new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 4),
			false
		);

		expect(controls.pivot.equals(pivotBefore)).toBe(true);
		controls.dispose();
	});

	it('cancellation works with setView transitions', async () => {
		const { controls, element } = createControls();
		const pos = new Vector3(500, 200, 300);
		const quat = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 4);

		let resolved = false;
		const promise = controls.setView(pos, quat, true);
		promise.then(() => {
			resolved = true;
		});

		controls.update(1 / 60);

		dispatchPointer(element, 'pointerdown', { button: 0, clientX: 400, clientY: 300 });
		dispatchPointer(element, 'pointerup', { button: 0, clientX: 400, clientY: 300 });

		await promise;
		expect(resolved).toBe(true);
		expect(controls.update(1 / 60)).toBe(false);
		controls.dispose();
	});

	it('snap promise resolves immediately', async () => {
		const { controls } = createControls();
		const pos = new Vector3(500, 200, 300);
		const quat = new Quaternion();

		let resolved = false;
		const promise = controls.setView(pos, quat, false);
		promise.then(() => {
			resolved = true;
		});

		await Promise.resolve();
		expect(resolved).toBe(true);
		controls.dispose();
	});

	it('dispatches change event on snap', () => {
		const { controls } = createControls();
		const changeFn = vi.fn();
		controls.addEventListener('change', changeFn);

		controls.setView(
			new Vector3(500, 200, 300),
			new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 4),
			false
		);

		expect(changeFn).toHaveBeenCalledTimes(1);
		controls.dispose();
	});
});
