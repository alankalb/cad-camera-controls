import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Vector3, Quaternion } from 'three';
import { CADCameraControls } from '../src/CADCameraControls';
import {
	createCamera,
	createDomElement,
	createControls,
	dispatchPointer,
	dispatchWheel,
	simulateDrag,
	dispatchTouch,
	simulateTouchDrag,
	simulatePinch,
} from './helpers';

// ---------------------------------------------------------------------------
// Construction & lifecycle
// ---------------------------------------------------------------------------

describe( 'construction and lifecycle', () => {

	it( 'constructs with camera only, domElement is null', () => {

		const camera = createCamera();
		const controls = new CADCameraControls( camera );
		expect( controls.camera ).toBe( camera );
		expect( controls.domElement ).toBeNull();
		controls.dispose();

	} );

	it( 'constructs with camera + domElement, auto-connects', () => {

		const camera = createCamera();
		const element = createDomElement();
		const spy = vi.spyOn( element, 'addEventListener' );
		const controls = new CADCameraControls( camera, element );

		expect( controls.domElement ).toBe( element );
		expect( spy ).toHaveBeenCalled();
		controls.dispose();

	} );

	it( 'connect() attaches listeners to domElement', () => {

		const camera = createCamera();
		const element = createDomElement();
		const controls = new CADCameraControls( camera ); // no element yet
		const spy = vi.spyOn( element, 'addEventListener' );

		controls.connect( element );
		expect( spy ).toHaveBeenCalled();
		expect( controls.domElement ).toBe( element );
		controls.dispose();

	} );

	it( 'disconnect() removes listeners, can reconnect', () => {

		const { controls, element } = createControls();
		const removeSpy = vi.spyOn( element, 'removeEventListener' );

		controls.disconnect();
		expect( removeSpy ).toHaveBeenCalled();

		// Can reconnect
		const addSpy = vi.spyOn( element, 'addEventListener' );
		controls.connect();
		expect( addSpy ).toHaveBeenCalled();
		controls.dispose();

	} );

	it( 'dispose() disconnects', () => {

		const { controls, element } = createControls();
		const removeSpy = vi.spyOn( element, 'removeEventListener' );

		controls.dispose();
		expect( removeSpy ).toHaveBeenCalled();

	} );

	it( 'has correct default property values', () => {

		const camera = createCamera();
		const controls = new CADCameraControls( camera );

		expect( controls.enabled ).toBe( true );
		expect( controls.enableDamping ).toBe( true );
		expect( controls.dampingFactor ).toBe( 0.9 );
		expect( controls.pivot.equals( new Vector3( 0, 0, 0 ) ) ).toBe( true );
		expect( controls.inputBindings ).toEqual( {
			rotate: { button: 0 },
			pan: { button: 2 },
		} );
		expect( controls.touchBindings ).toEqual( {
			one: 'rotate',
			two: 'pan',
			pinch: true,
		} );
		expect( controls.rotateSpeed ).toBe( 0.005 );
		expect( controls.panSpeed ).toBe( 0.0016 );
		expect( controls.zoomSpeed ).toBe( 0.0012 );
		expect( controls.minDistance ).toBe( 50 );
		expect( controls.maxDistance ).toBe( 100000 );
		expect( controls.preventContextMenu ).toBe( true );
		controls.dispose();

	} );

} );

// ---------------------------------------------------------------------------
// Rotation (left-drag by default)
// ---------------------------------------------------------------------------

describe( 'rotation', () => {

	it( 'left-drag rotates the camera', () => {

		const { controls, camera, element } = createControls();
		const initialPos = camera.position.clone();
		const initialQuat = camera.quaternion.clone();

		simulateDrag( element, { button: 0, startX: 400, startY: 300, endX: 500, endY: 300 } );

		expect( camera.position.equals( initialPos ) ).toBe( false );
		expect( camera.quaternion.equals( initialQuat ) ).toBe( false );
		controls.dispose();

	} );

	it( 'camera distance from pivot stays constant during rotation', () => {

		const { controls, camera, element } = createControls();
		const initialDistance = camera.position.distanceTo( controls.pivot );

		simulateDrag( element, { button: 0, startX: 400, startY: 300, endX: 500, endY: 350 } );

		const finalDistance = camera.position.distanceTo( controls.pivot );
		expect( finalDistance ).toBeCloseTo( initialDistance, 5 );
		controls.dispose();

	} );

	it( 'pivot position remains unchanged after rotation', () => {

		const { controls, element } = createControls();
		const pivotBefore = controls.pivot.clone();

		simulateDrag( element, { button: 0, startX: 400, startY: 300, endX: 500, endY: 350 } );

		expect( controls.pivot.equals( pivotBefore ) ).toBe( true );
		controls.dispose();

	} );

	it( 'dispatches start, change, end events during rotation', () => {

		const { controls, element } = createControls();
		const startFn = vi.fn();
		const changeFn = vi.fn();
		const endFn = vi.fn();
		controls.addEventListener( 'start', startFn );
		controls.addEventListener( 'change', changeFn );
		controls.addEventListener( 'end', endFn );

		simulateDrag( element, { button: 0, startX: 400, startY: 300, endX: 500, endY: 300, steps: 3 } );

		expect( startFn ).toHaveBeenCalledTimes( 1 );
		expect( changeFn.mock.calls.length ).toBeGreaterThanOrEqual( 1 );
		expect( endFn ).toHaveBeenCalledTimes( 1 );
		controls.dispose();

	} );

	it( 'does not rotate when enabled = false', () => {

		const { controls, camera, element } = createControls( { enabled: false } );
		const initialPos = camera.position.clone();

		simulateDrag( element, { button: 0, startX: 400, startY: 300, endX: 500, endY: 300 } );

		expect( camera.position.equals( initialPos ) ).toBe( true );
		controls.dispose();

	} );

	it( 'larger rotateSpeed produces larger rotation', () => {

		// Slow speed
		const slow = createControls( { rotateSpeed: 0.001 } );
		const slowInitial = slow.camera.position.clone();
		simulateDrag( slow.element, { button: 0, startX: 400, startY: 300, endX: 500, endY: 300 } );
		const slowDelta = slow.camera.position.distanceTo( slowInitial );
		slow.controls.dispose();

		// Fast speed
		const fast = createControls( { rotateSpeed: 0.02 } );
		const fastInitial = fast.camera.position.clone();
		simulateDrag( fast.element, { button: 0, startX: 400, startY: 300, endX: 500, endY: 300 } );
		const fastDelta = fast.camera.position.distanceTo( fastInitial );
		fast.controls.dispose();

		expect( fastDelta ).toBeGreaterThan( slowDelta );

	} );

} );

// ---------------------------------------------------------------------------
// Pan (right-drag by default)
// ---------------------------------------------------------------------------

describe( 'pan', () => {

	it( 'right-drag pans the camera', () => {

		const { controls, camera, element } = createControls();
		const initialPos = camera.position.clone();

		simulateDrag( element, {
			button: 2,
			startX: 400, startY: 300,
			endX: 500, endY: 350,
		} );

		expect( camera.position.equals( initialPos ) ).toBe( false );
		controls.dispose();

	} );

	it( 'camera quaternion stays constant during pan', () => {

		const { controls, camera, element } = createControls();
		const initialQuat = camera.quaternion.clone();

		simulateDrag( element, {
			button: 2,
			startX: 400, startY: 300,
			endX: 500, endY: 350,
		} );

		expect( camera.quaternion.x ).toBeCloseTo( initialQuat.x, 10 );
		expect( camera.quaternion.y ).toBeCloseTo( initialQuat.y, 10 );
		expect( camera.quaternion.z ).toBeCloseTo( initialQuat.z, 10 );
		expect( camera.quaternion.w ).toBeCloseTo( initialQuat.w, 10 );
		controls.dispose();

	} );

	it( 'dispatches change events during pan', () => {

		const { controls, element } = createControls();
		const changeFn = vi.fn();
		controls.addEventListener( 'change', changeFn );

		simulateDrag( element, {
			button: 2,
			startX: 400, startY: 300,
			endX: 500, endY: 350,
			steps: 3,
		} );

		expect( changeFn.mock.calls.length ).toBeGreaterThanOrEqual( 1 );
		controls.dispose();

	} );

	it( 'larger panSpeed produces larger translation', () => {

		const slow = createControls( { panSpeed: 0.0004 } );
		const slowInitial = slow.camera.position.clone();
		simulateDrag( slow.element, { button: 2, startX: 400, startY: 300, endX: 500, endY: 300 } );
		const slowDelta = slow.camera.position.distanceTo( slowInitial );
		slow.controls.dispose();

		const fast = createControls( { panSpeed: 0.008 } );
		const fastInitial = fast.camera.position.clone();
		simulateDrag( fast.element, { button: 2, startX: 400, startY: 300, endX: 500, endY: 300 } );
		const fastDelta = fast.camera.position.distanceTo( fastInitial );
		fast.controls.dispose();

		expect( fastDelta ).toBeGreaterThan( slowDelta );

	} );

	it( 'respects pan modifier setting on same-button bindings', () => {

		const { controls, camera, element } = createControls( {
			inputBindings: { rotate: { button: 2 }, pan: { button: 2, modifier: 'alt' } },
		} );
		const initialPos = camera.position.clone();

		// ctrl should rotate (not pan) when pan modifier is 'alt'
		simulateDrag( element, {
			button: 2,
			startX: 400, startY: 300,
			endX: 500, endY: 300,
			ctrlKey: true,
		} );
		const afterCtrl = camera.position.clone();

		// Reset camera
		camera.position.set( 0, 0, 1000 );
		camera.lookAt( 0, 0, 0 );
		camera.updateMatrixWorld();

		// alt should pan
		simulateDrag( element, {
			button: 2,
			startX: 400, startY: 300,
			endX: 500, endY: 300,
			altKey: true,
		} );

		// Both should have moved the camera
		expect( afterCtrl.equals( initialPos ) ).toBe( false );
		expect( camera.position.equals( initialPos ) ).toBe( false );
		controls.dispose();

	} );

} );

// ---------------------------------------------------------------------------
// Zoom / Dolly (wheel)
// ---------------------------------------------------------------------------

describe( 'zoom / dolly', () => {

	it( 'wheel scroll moves camera closer to pivot', () => {

		const { controls, camera, element } = createControls();
		const initialDistance = camera.position.distanceTo( controls.pivot );

		// Negative deltaY = zoom in (toward pivot)
		dispatchWheel( element, - 100 );

		const finalDistance = camera.position.distanceTo( controls.pivot );
		expect( finalDistance ).toBeLessThan( initialDistance );
		controls.dispose();

	} );

	it( 'wheel scroll moves camera away from pivot', () => {

		const { controls, camera, element } = createControls();
		const initialDistance = camera.position.distanceTo( controls.pivot );

		// Positive deltaY = zoom out (away from pivot)
		dispatchWheel( element, 100 );

		const finalDistance = camera.position.distanceTo( controls.pivot );
		expect( finalDistance ).toBeGreaterThan( initialDistance );
		controls.dispose();

	} );

	it( 'minDistance clamping prevents getting closer than minimum', () => {

		const { controls, camera, element } = createControls( { minDistance: 900 } );

		// Try to zoom in a lot
		for ( let i = 0; i < 50; i ++ ) {

			dispatchWheel( element, - 200 );

		}

		const finalDistance = camera.position.distanceTo( controls.pivot );
		expect( finalDistance ).toBeGreaterThanOrEqual( 900 - 1 ); // small float tolerance
		controls.dispose();

	} );

	it( 'maxDistance clamping prevents getting farther than maximum', () => {

		const { controls, camera, element } = createControls( { maxDistance: 1200 } );

		// Try to zoom out a lot
		for ( let i = 0; i < 50; i ++ ) {

			dispatchWheel( element, 200 );

		}

		const finalDistance = camera.position.distanceTo( controls.pivot );
		expect( finalDistance ).toBeLessThanOrEqual( 1200 + 1 ); // small float tolerance
		controls.dispose();

	} );

	it( 'dispatches change event on wheel', () => {

		const { controls, element } = createControls();
		const changeFn = vi.fn();
		controls.addEventListener( 'change', changeFn );

		dispatchWheel( element, - 100 );

		expect( changeFn ).toHaveBeenCalled();
		controls.dispose();

	} );

	it( 'does not zoom when enabled = false', () => {

		const { controls, camera, element } = createControls( { enabled: false } );
		const initialPos = camera.position.clone();

		dispatchWheel( element, - 100 );

		expect( camera.position.equals( initialPos ) ).toBe( true );
		controls.dispose();

	} );

} );

// ---------------------------------------------------------------------------
// Damping / inertia (update)
// ---------------------------------------------------------------------------

describe( 'damping / inertia', () => {

	it( 'update() returns false with no velocity', () => {

		const { controls } = createControls();

		expect( controls.update( 1 / 60 ) ).toBe( false );
		controls.dispose();

	} );

	it( 'update() returns false when enableDamping = false', () => {

		const { controls, element } = createControls( { enableDamping: false } );

		// Build up some velocity via a drag
		simulateDrag( element, { button: 0, startX: 400, startY: 300, endX: 500, endY: 300 } );

		expect( controls.update( 1 / 60 ) ).toBe( false );
		controls.dispose();

	} );

	it( 'update() returns false when enabled = false', () => {

		const { controls, element } = createControls();

		// Build up some velocity via a drag
		simulateDrag( element, { button: 0, startX: 400, startY: 300, endX: 500, endY: 300 } );
		controls.enabled = false;

		expect( controls.update( 1 / 60 ) ).toBe( false );
		controls.dispose();

	} );

	it( 'update() returns false while dragging', () => {

		const { controls, element } = createControls();

		// Start drag but don't release
		dispatchPointer( element, 'pointerdown', { button: 0, clientX: 400, clientY: 300 } );
		dispatchPointer( element, 'pointermove', { button: 0, clientX: 500, clientY: 300 } );

		expect( controls.update( 1 / 60 ) ).toBe( false );

		// Clean up
		dispatchPointer( element, 'pointerup', { button: 0, clientX: 500, clientY: 300 } );
		controls.dispose();

	} );

	it( 'after drag release, update() returns true and moves camera (inertia)', () => {

		const { controls, camera, element } = createControls();

		// Drag to build velocity, then release
		simulateDrag( element, { button: 0, startX: 400, startY: 300, endX: 500, endY: 300, steps: 3 } );

		const posAfterDrag = camera.position.clone();

		// Inertia should continue moving the camera
		const changed = controls.update( 1 / 60 );
		expect( changed ).toBe( true );
		expect( camera.position.equals( posAfterDrag ) ).toBe( false );
		controls.dispose();

	} );

	it( 'velocity decays over successive update() calls', () => {

		const { controls, camera, element } = createControls();

		simulateDrag( element, { button: 0, startX: 400, startY: 300, endX: 500, endY: 300, steps: 3 } );

		// Measure movement from first update
		const pos0 = camera.position.clone();
		controls.update( 1 / 60 );
		const delta1 = camera.position.distanceTo( pos0 );

		// Measure movement from second update
		const pos1 = camera.position.clone();
		controls.update( 1 / 60 );
		const delta2 = camera.position.distanceTo( pos1 );

		// Second update should produce smaller movement (damping)
		expect( delta2 ).toBeLessThan( delta1 );
		controls.dispose();

	} );

	it( 'velocity eventually stops (update returns false)', () => {

		const { controls, element } = createControls( { dampingFactor: 0.5 } ); // faster decay

		simulateDrag( element, { button: 0, startX: 400, startY: 300, endX: 420, endY: 300, steps: 2 } );

		// Run enough frames for velocity to decay below threshold
		let lastResult = true;
		for ( let i = 0; i < 200; i ++ ) {

			lastResult = controls.update( 1 / 60 );
			if ( ! lastResult ) break;

		}

		expect( lastResult ).toBe( false );
		controls.dispose();

	} );

} );

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

describe( 'configuration', () => {

	it( 'inputBindings changes which buttons trigger rotation and pan', () => {

		const { controls, camera, element } = createControls( {
			inputBindings: { rotate: { button: 1 }, pan: { button: 2 } },
		} );
		const initialPos = camera.position.clone();

		// Left-click (button 0) should NOT rotate or pan
		simulateDrag( element, { button: 0, startX: 400, startY: 300, endX: 500, endY: 300 } );
		expect( camera.position.equals( initialPos ) ).toBe( true );

		// Middle-click (button 1) SHOULD rotate
		simulateDrag( element, { button: 1, startX: 400, startY: 300, endX: 500, endY: 300 } );
		expect( camera.position.equals( initialPos ) ).toBe( false );
		controls.dispose();

	} );

	it( 'pan works without modifier when buttons differ', () => {

		const { controls, camera, element } = createControls( {
			inputBindings: { rotate: { button: 0 }, pan: { button: 2 } },
		} );
		const initialQuat = camera.quaternion.clone();

		// Right-drag (no modifier) should pan — quaternion stays constant
		simulateDrag( element, { button: 2, startX: 400, startY: 300, endX: 500, endY: 350 } );

		expect( camera.quaternion.x ).toBeCloseTo( initialQuat.x, 10 );
		expect( camera.quaternion.y ).toBeCloseTo( initialQuat.y, 10 );
		expect( camera.quaternion.z ).toBeCloseTo( initialQuat.z, 10 );
		expect( camera.quaternion.w ).toBeCloseTo( initialQuat.w, 10 );
		controls.dispose();

	} );

	it( 'preventContextMenu blocks context menu', () => {

		const { controls, element } = createControls( { preventContextMenu: true } );
		const event = new Event( 'contextmenu', { cancelable: true } );
		element.dispatchEvent( event );

		expect( event.defaultPrevented ).toBe( true );
		controls.dispose();

	} );

	it( 'preventContextMenu = false allows context menu', () => {

		const { controls, element } = createControls( { preventContextMenu: false } );
		const event = new Event( 'contextmenu', { cancelable: true } );
		element.dispatchEvent( event );

		expect( event.defaultPrevented ).toBe( false );
		controls.dispose();

	} );

} );

// ---------------------------------------------------------------------------
// Touch
// ---------------------------------------------------------------------------

describe( 'touch', () => {

	it( 'single-finger drag rotates the camera', () => {

		const { controls, camera, element } = createControls();
		const initialPos = camera.position.clone();
		const initialQuat = camera.quaternion.clone();

		simulateTouchDrag( element, { startX: 400, startY: 300, endX: 500, endY: 300 } );

		expect( camera.position.equals( initialPos ) ).toBe( false );
		expect( camera.quaternion.equals( initialQuat ) ).toBe( false );
		controls.dispose();

	} );

	it( 'single-finger drag pans when touchBindings.one = pan', () => {

		const { controls, camera, element } = createControls( {
			touchBindings: { one: 'pan', two: 'rotate', pinch: true },
		} );
		const initialQuat = camera.quaternion.clone();

		simulateTouchDrag( element, { startX: 400, startY: 300, endX: 500, endY: 350 } );

		// Pan should not change quaternion
		expect( camera.quaternion.x ).toBeCloseTo( initialQuat.x, 10 );
		expect( camera.quaternion.y ).toBeCloseTo( initialQuat.y, 10 );
		expect( camera.quaternion.z ).toBeCloseTo( initialQuat.z, 10 );
		expect( camera.quaternion.w ).toBeCloseTo( initialQuat.w, 10 );
		controls.dispose();

	} );

	it( 'two-finger drag pans the camera', () => {

		const { controls, camera, element } = createControls();
		const initialQuat = camera.quaternion.clone();

		// Two fingers: pointer 10 and 11, drag both rightward
		dispatchTouch( element, 'pointerdown', { clientX: 350, clientY: 300, pointerId: 10 } );
		dispatchTouch( element, 'pointerdown', { clientX: 450, clientY: 300, pointerId: 11 } );

		// Move both fingers right
		for ( let i = 1; i <= 5; i ++ ) {

			dispatchTouch( element, 'pointermove', { clientX: 350 + i * 20, clientY: 300, pointerId: 10 } );
			dispatchTouch( element, 'pointermove', { clientX: 450 + i * 20, clientY: 300, pointerId: 11 } );

		}

		dispatchTouch( element, 'pointerup', { clientX: 450, clientY: 300, pointerId: 10 } );
		dispatchTouch( element, 'pointerup', { clientX: 550, clientY: 300, pointerId: 11 } );

		// Pan should not change quaternion
		expect( camera.quaternion.x ).toBeCloseTo( initialQuat.x, 10 );
		expect( camera.quaternion.y ).toBeCloseTo( initialQuat.y, 10 );
		expect( camera.quaternion.z ).toBeCloseTo( initialQuat.z, 10 );
		expect( camera.quaternion.w ).toBeCloseTo( initialQuat.w, 10 );
		controls.dispose();

	} );

	it( 'pinch zooms the camera closer', () => {

		const { controls, camera, element } = createControls();
		const initialDistance = camera.position.distanceTo( controls.pivot );

		// Spread fingers apart = zoom in
		simulatePinch( element, { startSpread: 100, endSpread: 300, steps: 5 } );

		const finalDistance = camera.position.distanceTo( controls.pivot );
		expect( finalDistance ).toBeLessThan( initialDistance );
		controls.dispose();

	} );

	it( 'pinch zooms the camera farther', () => {

		const { controls, camera, element } = createControls();
		const initialDistance = camera.position.distanceTo( controls.pivot );

		// Pinch fingers together = zoom out
		simulatePinch( element, { startSpread: 300, endSpread: 100, steps: 5 } );

		const finalDistance = camera.position.distanceTo( controls.pivot );
		expect( finalDistance ).toBeGreaterThan( initialDistance );
		controls.dispose();

	} );

	it( 'pinch disabled when touchBindings.pinch = false', () => {

		const { controls, camera, element } = createControls( {
			touchBindings: { one: 'rotate', two: 'pan', pinch: false },
		} );
		const initialDistance = camera.position.distanceTo( controls.pivot );

		simulatePinch( element, { startSpread: 100, endSpread: 300, steps: 5 } );

		const finalDistance = camera.position.distanceTo( controls.pivot );
		expect( finalDistance ).toBeCloseTo( initialDistance, 0 );
		controls.dispose();

	} );

	it( 'dispatches start and end events for touch', () => {

		const { controls, element } = createControls();
		const startFn = vi.fn();
		const endFn = vi.fn();
		controls.addEventListener( 'start', startFn );
		controls.addEventListener( 'end', endFn );

		simulateTouchDrag( element, { startX: 400, startY: 300, endX: 500, endY: 300 } );

		expect( startFn ).toHaveBeenCalledTimes( 1 );
		expect( endFn ).toHaveBeenCalledTimes( 1 );
		controls.dispose();

	} );

} );
