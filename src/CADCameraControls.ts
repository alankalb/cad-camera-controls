import {
	EventDispatcher,
	MathUtils,
	PerspectiveCamera,
	OrthographicCamera,
	Quaternion,
	Raycaster,
	Vector2,
	Vector3,
} from 'three';

import type { ModifierKey, InputBindings, TouchBindings, CADCameraControlsEventMap } from './types';

const WORLD_UP = new Vector3( 0, 1, 0 );
const CAMERA_RIGHT = new Vector3( 1, 0, 0 );
const CAMERA_UP = new Vector3( 0, 1, 0 );

function hasModifier( event: PointerEvent, key: ModifierKey ): boolean {

	if ( key === 'ctrl' ) return event.ctrlKey;
	if ( key === 'meta' ) return event.metaKey;
	if ( key === 'alt' ) return event.altKey;
	return event.shiftKey;

}

function intersectRayWithPlane(
	rayOrigin: Vector3,
	rayDirection: Vector3,
	planePoint: Vector3,
	planeNormal: Vector3,
	out: Vector3
): boolean {

	const denom = planeNormal.dot( rayDirection );
	if ( Math.abs( denom ) < 1e-6 ) return false;

	const t = planeNormal.dot( out.copy( planePoint ).sub( rayOrigin ) ) / denom;
	if ( t < 0 ) return false;

	out.copy( rayOrigin ).addScaledVector( rayDirection, t );
	return true;

}

const _changeEvent = { type: 'change' } as const;
const _startEvent = { type: 'start' } as const;
const _endEvent = { type: 'end' } as const;

class CADCameraControls extends EventDispatcher<CADCameraControlsEventMap> {

	camera: PerspectiveCamera | OrthographicCamera;
	domElement: HTMLElement | null;

	// Configuration
	enabled: boolean;
	enableDamping: boolean;
	dampingFactor: number;
	pivot: Vector3;
	inputBindings: InputBindings;
	touchBindings: TouchBindings;
	rotateSpeed: number;
	panSpeed: number;
	zoomSpeed: number;
	minDistance: number;
	maxDistance: number;
	preventContextMenu: boolean;

	// Private state
	private _drag: { isDragging: boolean; mode: 'rotate' | 'pan' | null; x: number; y: number };
	private _raycaster: Raycaster;
	private _pointer: Vector2;
	private _wheelPointer: Vector2;
	private _offset: Vector3;
	private _dir: Vector3;
	private _dir2: Vector3;
	private _right: Vector3;
	private _up: Vector3;
	private _yawQ: Quaternion;
	private _pitchQ: Quaternion;
	private _orientation: Quaternion;
	private _before: Vector3;
	private _after: Vector3;
	private _nextPos: Vector3;
	private _origin: Vector3;
	private _rotateVelocity: Vector2;
	private _panVelocity: Vector2;
	private _dollyVelocity: number;
	private _pointers: PointerEvent[];
	private _pinchDistance: number;

	constructor( camera: PerspectiveCamera | OrthographicCamera, domElement?: HTMLElement ) {

		super();

		this.camera = camera;
		this.domElement = domElement ?? null;

		this.enabled = true;
		this.enableDamping = true;
		this.dampingFactor = 0.9;
		this.pivot = new Vector3( 0, 0, 0 );
		this.inputBindings = { rotate: { button: 2 }, pan: { button: 2, modifier: 'ctrl' } };
		this.touchBindings = { one: 'rotate', two: 'pan', pinch: true };
		this.rotateSpeed = 0.005;
		this.panSpeed = 0.0016;
		this.zoomSpeed = 0.0012;
		this.minDistance = 50;
		this.maxDistance = 100000;
		this.preventContextMenu = true;

		this._drag = { isDragging: false, mode: null, x: 0, y: 0 };
		this._raycaster = new Raycaster();
		this._pointer = new Vector2();
		this._wheelPointer = new Vector2();
		this._offset = new Vector3();
		this._dir = new Vector3();
		this._dir2 = new Vector3();
		this._right = new Vector3();
		this._up = new Vector3();
		this._yawQ = new Quaternion();
		this._pitchQ = new Quaternion();
		this._orientation = new Quaternion();
		this._before = new Vector3();
		this._after = new Vector3();
		this._nextPos = new Vector3();
		this._origin = new Vector3();
		this._rotateVelocity = new Vector2();
		this._panVelocity = new Vector2();
		this._dollyVelocity = 0;
		this._pointers = [];
		this._pinchDistance = 0;

		this._onContextMenu = this._onContextMenu.bind( this );
		this._onPointerDown = this._onPointerDown.bind( this );
		this._onPointerMove = this._onPointerMove.bind( this );
		this._onPointerUp = this._onPointerUp.bind( this );
		this._onWheel = this._onWheel.bind( this );

		if ( this.domElement ) {

			this.connect();

		}

	}

	connect( domElement?: HTMLElement ): void {

		if ( domElement ) this.domElement = domElement;

		const el = this.domElement;
		if ( ! el ) return;

		el.addEventListener( 'contextmenu', this._onContextMenu );
		el.addEventListener( 'pointerdown', this._onPointerDown );
		el.addEventListener( 'pointermove', this._onPointerMove );
		el.addEventListener( 'pointerup', this._onPointerUp );
		el.addEventListener( 'pointercancel', this._onPointerUp );
		el.addEventListener( 'wheel', this._onWheel, { passive: false } );

	}

	disconnect(): void {

		const el = this.domElement;
		if ( ! el ) return;

		el.removeEventListener( 'contextmenu', this._onContextMenu );
		el.removeEventListener( 'pointerdown', this._onPointerDown );
		el.removeEventListener( 'pointermove', this._onPointerMove );
		el.removeEventListener( 'pointerup', this._onPointerUp );
		el.removeEventListener( 'pointercancel', this._onPointerUp );
		el.removeEventListener( 'wheel', this._onWheel );

	}

	dispose(): void {

		this.disconnect();

	}

	update( deltaSeconds: number = 1 / 60 ): boolean {

		if ( ! this.enabled || ! this.enableDamping || this._drag.isDragging ) return false;

		const STOP_EPSILON = 0.01;
		const deltaFrames = Math.max( 0.001, deltaSeconds * 60 );
		const damping = Math.pow( MathUtils.clamp( this.dampingFactor, 0, 0.9999 ), deltaFrames );
		let changed = false;

		if ( Math.abs( this._rotateVelocity.x ) > STOP_EPSILON || Math.abs( this._rotateVelocity.y ) > STOP_EPSILON ) {

			this._applyRotate( this._rotateVelocity.x, this._rotateVelocity.y );
			this._rotateVelocity.multiplyScalar( damping );
			changed = true;

		}

		if ( Math.abs( this._panVelocity.x ) > STOP_EPSILON || Math.abs( this._panVelocity.y ) > STOP_EPSILON ) {

			this._applyPan( this._panVelocity.x, this._panVelocity.y );
			this._panVelocity.multiplyScalar( damping );
			changed = true;

		}

		if ( Math.abs( this._dollyVelocity ) > STOP_EPSILON ) {

			this._applyDolly( this._dollyVelocity, this._wheelPointer );
			this._dollyVelocity *= damping;
			changed = true;

		}

		return changed;

	}

	private _applyRotate( dx: number, dy: number ): void {

		const offset = this._offset.copy( this.camera.position ).sub( this.pivot );
		const yawQ = this._yawQ.setFromAxisAngle( WORLD_UP, - dx * this.rotateSpeed );
		const orientation = this._orientation.copy( this.camera.quaternion ).premultiply( yawQ );
		const rightAxis = this._right.copy( CAMERA_RIGHT ).applyQuaternion( orientation ).normalize();
		const pitchQ = this._pitchQ.setFromAxisAngle( rightAxis, - dy * this.rotateSpeed );

		offset.applyQuaternion( yawQ ).applyQuaternion( pitchQ );
		this.camera.position.copy( this.pivot ).add( offset );
		this.camera.quaternion.premultiply( yawQ );
		this.camera.quaternion.premultiply( pitchQ );
		this.camera.updateMatrixWorld();

		this.dispatchEvent( _changeEvent );

	}

	private _applyPan( dx: number, dy: number ): void {

		const distance = this.camera.position.distanceTo( this.pivot );
		const worldPerPixel = distance * this.panSpeed;
		const right = this._right.copy( CAMERA_RIGHT ).applyQuaternion( this.camera.quaternion ).normalize();
		const up = this._up.copy( CAMERA_UP ).applyQuaternion( this.camera.quaternion ).normalize();
		const move = right.multiplyScalar( - dx * worldPerPixel ).add( up.multiplyScalar( dy * worldPerPixel ) );

		this.camera.position.add( move );
		this.camera.updateMatrixWorld();

		this.dispatchEvent( _changeEvent );

	}

	private _applyDolly( step: number, pointer: Vector2 ): void {

		this._raycaster.setFromCamera( pointer, this.camera );
		const rayDir = this._raycaster.ray.direction;
		const forward = this._dir2;
		this.camera.getWorldDirection( forward );
		const nextPos = this._nextPos.copy( this.camera.position ).addScaledVector( forward, step );
		const before = this._before;
		const after = this._after;
		const origin = this._origin.copy( this.camera.position );

		const hasBefore = intersectRayWithPlane( origin, rayDir, this.pivot, forward, before );
		const hasAfter = intersectRayWithPlane( nextPos, rayDir, this.pivot, forward, after );

		if ( hasBefore && hasAfter ) {

			nextPos.add( before.sub( after ) );

		} else {

			nextPos.addScaledVector( rayDir, step );

		}

		const nextFromPivot = this._dir.copy( nextPos ).sub( this.pivot );
		const nextDistance = nextFromPivot.length();
		const clampedDistance = MathUtils.clamp( nextDistance, this.minDistance, this.maxDistance );

		if ( nextDistance > 0 && clampedDistance !== nextDistance ) {

			nextFromPivot.multiplyScalar( clampedDistance / nextDistance );
			nextPos.copy( this.pivot ).add( nextFromPivot );

		}

		this.camera.position.copy( nextPos );
		this.camera.updateMatrixWorld();

		this.dispatchEvent( _changeEvent );

	}

	private _onContextMenu( event: Event ): void {

		if ( this.preventContextMenu ) event.preventDefault();

	}

	private _onPointerDown( event: PointerEvent ): void {

		if ( ! this.enabled ) return;

		if ( event.pointerType === 'touch' ) {

			this._onTouchStart( event );
			return;

		}

		const bindings = this.inputBindings;
		const panHasModifier = 'modifier' in bindings.pan;
		const panMode = event.button === bindings.pan.button
			&& ( ! panHasModifier || hasModifier( event, ( bindings.pan as { modifier: ModifierKey } ).modifier ) );
		const rotateMode = event.button === bindings.rotate.button && ! panMode;
		if ( ! panMode && ! rotateMode ) return;

		this._drag.isDragging = true;
		this._drag.mode = panMode ? 'pan' : 'rotate';
		this._drag.x = event.clientX;
		this._drag.y = event.clientY;
		this._rotateVelocity.set( 0, 0 );
		this._panVelocity.set( 0, 0 );

		if ( this.domElement ) {

			this.domElement.setPointerCapture( event.pointerId );

		}

		this.dispatchEvent( _startEvent );

	}

	private _onTouchStart( event: PointerEvent ): void {

		this._pointers.push( event );

		if ( this.domElement ) {

			this.domElement.setPointerCapture( event.pointerId );

		}

		if ( this._pointers.length === 1 ) {

			this._drag.isDragging = true;
			this._drag.mode = this.touchBindings.one;
			this._drag.x = event.clientX;
			this._drag.y = event.clientY;
			this._rotateVelocity.set( 0, 0 );
			this._panVelocity.set( 0, 0 );
			this.dispatchEvent( _startEvent );

		} else if ( this._pointers.length === 2 ) {

			this._drag.mode = this.touchBindings.two;
			this._drag.x = ( this._pointers[ 0 ].clientX + this._pointers[ 1 ].clientX ) * 0.5;
			this._drag.y = ( this._pointers[ 0 ].clientY + this._pointers[ 1 ].clientY ) * 0.5;
			this._pinchDistance = this._getPointerDistance();

		}

	}

	private _onPointerMove( event: PointerEvent ): void {

		if ( ! this.enabled ) return;

		if ( event.pointerType === 'touch' ) {

			this._onTouchMove( event );
			return;

		}

		if ( ! this._drag.isDragging || ! this._drag.mode ) return;

		const dx = event.clientX - this._drag.x;
		const dy = event.clientY - this._drag.y;
		this._drag.x = event.clientX;
		this._drag.y = event.clientY;

		if ( this._drag.mode === 'rotate' ) {

			this._applyRotate( dx, dy );
			this._rotateVelocity.set( dx, dy );

		} else {

			this._applyPan( dx, dy );
			this._panVelocity.set( dx, dy );

		}

	}

	private _onTouchMove( event: PointerEvent ): void {

		// Update stored pointer
		const index = this._pointers.findIndex( p => p.pointerId === event.pointerId );
		if ( index === - 1 ) return;
		this._pointers[ index ] = event;

		if ( ! this._drag.isDragging || ! this._drag.mode ) return;

		if ( this._pointers.length === 2 ) {

			const midX = ( this._pointers[ 0 ].clientX + this._pointers[ 1 ].clientX ) * 0.5;
			const midY = ( this._pointers[ 0 ].clientY + this._pointers[ 1 ].clientY ) * 0.5;
			const dx = midX - this._drag.x;
			const dy = midY - this._drag.y;
			this._drag.x = midX;
			this._drag.y = midY;

			// Two-finger drag
			if ( this._drag.mode === 'rotate' ) {

				this._applyRotate( dx, dy );
				this._rotateVelocity.set( dx, dy );

			} else {

				this._applyPan( dx, dy );
				this._panVelocity.set( dx, dy );

			}

			// Pinch-to-zoom
			if ( this.touchBindings.pinch ) {

				const currentDistance = this._getPointerDistance();
				const delta = currentDistance - this._pinchDistance;
				this._pinchDistance = currentDistance;

				const distance = this.camera.position.distanceTo( this.pivot );
				const step = delta * this.zoomSpeed * Math.max( 1, distance * 0.25 );

				// Use center of pinch as zoom target
				const el = this.domElement!;
				const rect = el.getBoundingClientRect();
				this._wheelPointer.set(
					( ( midX - rect.left ) / rect.width ) * 2 - 1,
					- ( ( midY - rect.top ) / rect.height ) * 2 + 1
				);

				this._applyDolly( step, this._wheelPointer );
				this._dollyVelocity = step;

			}

		} else if ( this._pointers.length === 1 ) {

			const dx = event.clientX - this._drag.x;
			const dy = event.clientY - this._drag.y;
			this._drag.x = event.clientX;
			this._drag.y = event.clientY;

			if ( this._drag.mode === 'rotate' ) {

				this._applyRotate( dx, dy );
				this._rotateVelocity.set( dx, dy );

			} else {

				this._applyPan( dx, dy );
				this._panVelocity.set( dx, dy );

			}

		}

	}

	private _onPointerUp( event: PointerEvent ): void {

		if ( event.pointerType === 'touch' ) {

			this._onTouchEnd( event );
			return;

		}

		if ( event.button !== this.inputBindings.rotate.button && event.button !== this.inputBindings.pan.button ) return;

		this._drag.isDragging = false;
		this._drag.mode = null;

		if ( this.domElement ) {

			this.domElement.releasePointerCapture( event.pointerId );

		}

		this.dispatchEvent( _endEvent );

	}

	private _onTouchEnd( event: PointerEvent ): void {

		const index = this._pointers.findIndex( p => p.pointerId === event.pointerId );
		if ( index !== - 1 ) this._pointers.splice( index, 1 );

		if ( this.domElement ) {

			this.domElement.releasePointerCapture( event.pointerId );

		}

		if ( this._pointers.length === 0 ) {

			this._drag.isDragging = false;
			this._drag.mode = null;
			this.dispatchEvent( _endEvent );

		} else if ( this._pointers.length === 1 ) {

			// Downgrade from two-finger to one-finger
			this._drag.mode = this.touchBindings.one;
			this._drag.x = this._pointers[ 0 ].clientX;
			this._drag.y = this._pointers[ 0 ].clientY;

		}

	}

	private _getPointerDistance(): number {

		const dx = this._pointers[ 0 ].clientX - this._pointers[ 1 ].clientX;
		const dy = this._pointers[ 0 ].clientY - this._pointers[ 1 ].clientY;
		return Math.sqrt( dx * dx + dy * dy );

	}

	private _onWheel( event: WheelEvent ): void {

		if ( ! this.enabled ) return;
		event.preventDefault();

		const el = this.domElement!;
		const rect = el.getBoundingClientRect();
		this._pointer.set(
			( ( event.clientX - rect.left ) / rect.width ) * 2 - 1,
			- ( ( event.clientY - rect.top ) / rect.height ) * 2 + 1
		);

		const distance = this.camera.position.distanceTo( this.pivot );
		const step = - event.deltaY * this.zoomSpeed * Math.max( 1, distance * 0.25 );
		this._wheelPointer.copy( this._pointer );
		this._applyDolly( step, this._wheelPointer );
		this._dollyVelocity = step;

	}

}

export { CADCameraControls };
export type { InputBindings, TouchBindings, MouseButton, ModifierKey } from './types';
