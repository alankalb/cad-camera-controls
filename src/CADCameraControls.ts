import {
	Box3,
	EventDispatcher,
	MathUtils,
	PerspectiveCamera,
	OrthographicCamera,
	Quaternion,
	Raycaster,
	Sphere,
	Vector2,
	Vector3,
} from 'three';

import type { ModifierKey, ZoomMode, InputBindings, TouchBindings, KeyboardKeys, KeyboardBindings, CADCameraControlsEventMap } from './types';

const WORLD_UP = new Vector3(0, 1, 0);
const CAMERA_RIGHT = new Vector3(1, 0, 0);
const CAMERA_UP = new Vector3(0, 1, 0);

const PLANE_EPSILON = 1e-6;
const STOP_EPSILON = 0.01;
const ZOOM_STOP_EPSILON = 0.0001;
const FOV_EPSILON = 0.01;
const ZOOM_BASE = 0.99;
const MIN_DISTANCE_BUFFER = 1;
const PINCH_SCALE = 0.25;
const DEFAULT_AUTO_FOV_ANCHOR_SCALE = 0.1;
const MIN_DAMPING = 0.0001;

const DEFAULT_DAMPING_FACTOR = 0.2;
const DEFAULT_KEY_PAN_SPEED = 7;
const DEFAULT_KEY_ROTATE_SPEED = 1;
const DEFAULT_KEY_ZOOM_SPEED = 1;
const DEFAULT_ROTATE_SPEED = 0.005;
const DEFAULT_PAN_SPEED = 0.0016;
const DEFAULT_ZOOM_SPEED = 1;
const DEFAULT_MIN_DISTANCE = 50;
const DEFAULT_MAX_DISTANCE = 100000;
const DEFAULT_MIN_ZOOM = 0.01;
const DEFAULT_MAX_ZOOM = 1000;
const DEFAULT_MIN_FOV = 1;
const DEFAULT_MAX_FOV = 120;
const DEFAULT_TRANSITION_DURATION = 0.5;

function hasModifier(event: PointerEvent | KeyboardEvent, key: ModifierKey): boolean {
	if (key === 'ctrl') return event.ctrlKey;
	if (key === 'meta') return event.metaKey;
	if (key === 'alt') return event.altKey;
	return event.shiftKey;
}

function hasNoModifier(event: PointerEvent | KeyboardEvent): boolean {
	return ! event.ctrlKey && ! event.metaKey && ! event.altKey && ! event.shiftKey;
}

function validateKeyboardBindings(bindings: KeyboardBindings): void {
	const actions = [bindings.rotate, bindings.pan, bindings.zoom];
	const active = actions.filter((a): a is Exclude<typeof a, false> => a !== false);

	if (active.length === 0) {
		throw new Error('keyboardBindings: at least one action must be active');
	}

	let bareCount = 0;
	const modifiers: ModifierKey[] = [];

	for (const action of active) {
		if ('modifier' in action) {
			const mod = (action as { modifier: ModifierKey }).modifier;
			if (modifiers.includes(mod)) {
				throw new Error(`keyboardBindings: duplicate modifier '${ mod }'`);
			}
			modifiers.push(mod);
		} else {
			bareCount ++;
		}
	}

	if (bareCount > 1) {
		throw new Error('keyboardBindings: at most one action can be bare (no modifier)');
	}
}

function intersectRayWithPlane(
	rayOrigin: Vector3,
	rayDirection: Vector3,
	planePoint: Vector3,
	planeNormal: Vector3,
	out: Vector3
): boolean {
	const denom = planeNormal.dot(rayDirection);
	if (Math.abs(denom) < PLANE_EPSILON) return false;

	const t = planeNormal.dot(out.copy(planePoint).sub(rayOrigin)) / denom;
	if (t < 0) return false;

	out.copy(rayOrigin).addScaledVector(rayDirection, t);
	return true;
}

function smoothstep(t: number): number {
	return t * t * (3 - 2 * t);
}

const _changeEvent = { type: 'change' } as const;
const _startEvent = { type: 'start' } as const;
const _endEvent = { type: 'end' } as const;

class CADCameraControls extends EventDispatcher<CADCameraControlsEventMap> {
	camera: PerspectiveCamera | OrthographicCamera;
	domElement: HTMLElement | null;

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
	minZoom: number;
	maxZoom: number;
	zoomMode: ZoomMode;
	minFov: number;
	maxFov: number;
	autoFovAnchorScale: number;
	preventContextMenu: boolean;
	enableKeyboard: boolean;
	keyPanSpeed: number;
	keyRotateSpeed: number;
	keyZoomSpeed: number;
	keys: KeyboardKeys;

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
	private _zoomVelocity: number;
	private _fovVelocity: number;
	private _baseFov: number;
	private _pointers: PointerEvent[];
	private _keyboardBindings: KeyboardBindings;
	private _pinchDistance: number;
	private _keyboardElement: HTMLElement | null;
	private _transition: {
		startPosition: Vector3;
		endPosition: Vector3;
		startQuaternion: Quaternion;
		endQuaternion: Quaternion;
		slerp: boolean;
		startZoom: number;
		endZoom: number;
		startFov: number;
		endFov: number;
		elapsed: number;
		duration: number;
		resolve: () => void;
	} | null;
	private _transitionStartPos: Vector3;
	private _transitionEndPos: Vector3;
	private _transitionStartQuat: Quaternion;
	private _transitionEndQuat: Quaternion;
	private _fitCenter: Vector3;
	private _fitSize: Vector3;

	constructor(camera: PerspectiveCamera | OrthographicCamera, domElement?: HTMLElement) {
		super();

		this.camera = camera;
		this.domElement = domElement ?? null;

		this.enabled = true;
		this.enableDamping = true;
		this.dampingFactor = DEFAULT_DAMPING_FACTOR;
		this.pivot = new Vector3(0, 0, 0);
		this.inputBindings = { rotate: { button: 0 }, pan: { button: 2 } };
		this.touchBindings = { one: 'rotate', two: 'pan', pinch: true };
		this.rotateSpeed = DEFAULT_ROTATE_SPEED;
		this.panSpeed = DEFAULT_PAN_SPEED;
		this.zoomSpeed = DEFAULT_ZOOM_SPEED;
		this.minDistance = DEFAULT_MIN_DISTANCE;
		this.maxDistance = DEFAULT_MAX_DISTANCE;
		this.minZoom = DEFAULT_MIN_ZOOM;
		this.maxZoom = DEFAULT_MAX_ZOOM;
		this.zoomMode = 'dolly';
		this.minFov = DEFAULT_MIN_FOV;
		this.maxFov = DEFAULT_MAX_FOV;
		this.autoFovAnchorScale = DEFAULT_AUTO_FOV_ANCHOR_SCALE;
		this.preventContextMenu = true;
		this.enableKeyboard = true;
		this._keyboardBindings = { rotate: { modifier: 'shift' }, pan: {}, zoom: false };
		this.keyPanSpeed = DEFAULT_KEY_PAN_SPEED;
		this.keyRotateSpeed = DEFAULT_KEY_ROTATE_SPEED;
		this.keyZoomSpeed = DEFAULT_KEY_ZOOM_SPEED;
		this.keys = { LEFT: 'ArrowLeft', UP: 'ArrowUp', RIGHT: 'ArrowRight', BOTTOM: 'ArrowDown' };

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
		this._zoomVelocity = 1;
		this._fovVelocity = 1;
		this._baseFov = camera instanceof PerspectiveCamera ? camera.fov : DEFAULT_MAX_FOV;
		this._pointers = [];
		this._pinchDistance = 0;
		this._keyboardElement = null;
		this._transition = null;
		this._transitionStartPos = new Vector3();
		this._transitionEndPos = new Vector3();
		this._transitionStartQuat = new Quaternion();
		this._transitionEndQuat = new Quaternion();
		this._fitCenter = new Vector3();
		this._fitSize = new Vector3();

		this._onContextMenu = this._onContextMenu.bind(this);
		this._onPointerDown = this._onPointerDown.bind(this);
		this._onPointerMove = this._onPointerMove.bind(this);
		this._onPointerUp = this._onPointerUp.bind(this);
		this._onWheel = this._onWheel.bind(this);
		this._onKeyDown = this._onKeyDown.bind(this);

		if (this.domElement) {
			this.connect();
		}
	}

	connect(domElement?: HTMLElement): void {
		this.disconnect();

		if (domElement) this.domElement = domElement;

		const el = this.domElement;
		if (! el) return;

		el.addEventListener('contextmenu', this._onContextMenu);
		el.addEventListener('pointerdown', this._onPointerDown);
		el.addEventListener('pointermove', this._onPointerMove);
		el.addEventListener('pointerup', this._onPointerUp);
		el.addEventListener('pointercancel', this._onPointerUp);
		el.addEventListener('wheel', this._onWheel, { passive: false });

		el.style.touchAction = 'none';
	}

	disconnect(): void {
		const el = this.domElement;
		if (! el) return;

		el.removeEventListener('contextmenu', this._onContextMenu);
		el.removeEventListener('pointerdown', this._onPointerDown);
		el.removeEventListener('pointermove', this._onPointerMove);
		el.removeEventListener('pointerup', this._onPointerUp);
		el.removeEventListener('pointercancel', this._onPointerUp);
		el.removeEventListener('wheel', this._onWheel);

		el.style.touchAction = '';
	}

	listenToKeyEvents(domElement: HTMLElement): void {
		this.stopListenToKeyEvents();
		this._keyboardElement = domElement;
		domElement.addEventListener('keydown', this._onKeyDown);
	}

	stopListenToKeyEvents(): void {
		if (this._keyboardElement) {
			this._keyboardElement.removeEventListener('keydown', this._onKeyDown);
			this._keyboardElement = null;
		}
	}

	dispose(): void {
		this._cancelTransition();
		this.stopListenToKeyEvents();
		this.disconnect();
		this.domElement = null;
		this._pointers.length = 0;
	}

	get keyboardBindings(): KeyboardBindings {
		return this._keyboardBindings;
	}

	set keyboardBindings(value: KeyboardBindings) {
		validateKeyboardBindings(value);
		this._keyboardBindings = value;
	}

	resetBaseFov(): void {
		this._baseFov = (this.camera as PerspectiveCamera).fov;
	}

	fitToBox(box: Box3, enableTransition: boolean = true, padding: number = 0): Promise<void> {
		if (box.isEmpty()) return Promise.resolve();

		const center = this._fitCenter;
		const size = this._fitSize;
		box.getCenter(center);
		box.getSize(size);

		if (size.x === 0 && size.y === 0 && size.z === 0) return Promise.resolve();

		const paddingScale = 1 + Math.max(0, padding);
		const forward = this._dir2;
		this.camera.getWorldDirection(forward);
		const right = this._right.copy(CAMERA_RIGHT).applyQuaternion(this.camera.quaternion).normalize();
		const up = this._up.copy(CAMERA_UP).applyQuaternion(this.camera.quaternion).normalize();
		const projWidth = Math.abs(size.dot(right));
		const projHeight = Math.abs(size.dot(up));

		if (this.camera instanceof OrthographicCamera) {
			const width = Math.max(projWidth, 0.001) * paddingScale;
			const height = Math.max(projHeight, 0.001) * paddingScale;

			return this._fitOrtho(center, forward, width, height, enableTransition);
		} else {
			const camera = this.camera as PerspectiveCamera;
			const fov = camera.getEffectiveFOV() * MathUtils.DEG2RAD;
			const projDepth = Math.abs(size.dot(forward));

			const heightToFit = ((projWidth / projHeight) < camera.aspect ? projHeight : projWidth / camera.aspect) * paddingScale;
			const distance = MathUtils.clamp(
				heightToFit * 0.5 / Math.tan(fov * 0.5) + projDepth * 0.5,
				this.minDistance, this.maxDistance
			);

			return this._fitPerspective(center, forward, distance, camera.fov, enableTransition);
		}
	}

	fitToSphere(sphere: Sphere, enableTransition: boolean = true, padding: number = 0): Promise<void> {
		if (sphere.radius <= 0) return Promise.resolve();

		const paddingScale = 1 + Math.max(0, padding);
		const center = this._fitCenter.copy(sphere.center);
		const forward = this._dir2;
		this.camera.getWorldDirection(forward);
		const diameter = sphere.radius * 2 * paddingScale;

		if (this.camera instanceof OrthographicCamera) {
			return this._fitOrtho(center, forward, diameter, diameter, enableTransition);
		} else {
			const camera = this.camera as PerspectiveCamera;
			const vFOV = camera.getEffectiveFOV() * MathUtils.DEG2RAD;
			const hFOV = 2 * Math.atan(Math.tan(vFOV * 0.5) * camera.aspect);
			const fov = camera.aspect >= 1 ? vFOV : hFOV;

			const distance = MathUtils.clamp(
				(sphere.radius * paddingScale) / Math.sin(fov * 0.5),
				this.minDistance, this.maxDistance
			);

			return this._fitPerspective(center, forward, distance, camera.fov, enableTransition);
		}
	}

	setView(
		position: Vector3,
		quaternion: Quaternion,
		enableTransition: boolean = true,
		options?: { zoom?: number; fov?: number }
	): Promise<void> {
		const endPos = this._transitionEndPos.copy(position);
		const endZoom = options?.zoom ?? (this.camera instanceof OrthographicCamera ? this.camera.zoom : 1);
		const endFov = options?.fov ?? (this.camera instanceof PerspectiveCamera ? this.camera.fov : 50);

		return this._startTransition(endPos, endZoom, endFov, enableTransition, quaternion);
	}

	update(deltaSeconds: number = 1 / 60): boolean {
		if (this._transition) {
			this._updateTransition(deltaSeconds);
			return true;
		}

		if (! this.enabled || ! this.enableDamping || this._drag.isDragging) return false;

		const deltaFrames = Math.max(0.001, deltaSeconds * 60);
		const damping = Math.pow(1 - MathUtils.clamp(this.dampingFactor, MIN_DAMPING, 1), deltaFrames);
		let changed = false;

		if (Math.abs(this._rotateVelocity.x) > STOP_EPSILON || Math.abs(this._rotateVelocity.y) > STOP_EPSILON) {
			this._applyRotate(this._rotateVelocity.x, this._rotateVelocity.y);
			this._rotateVelocity.multiplyScalar(damping);
			changed = true;
		}

		if (Math.abs(this._panVelocity.x) > STOP_EPSILON || Math.abs(this._panVelocity.y) > STOP_EPSILON) {
			this._applyPan(this._panVelocity.x, this._panVelocity.y);
			this._panVelocity.multiplyScalar(damping);
			changed = true;
		}

		if (Math.abs(this._dollyVelocity) > STOP_EPSILON) {
			this._applyDolly(this._dollyVelocity, this._wheelPointer);
			this._dollyVelocity *= damping;
			changed = true;
		}

		if (Math.abs(this._zoomVelocity - 1) > ZOOM_STOP_EPSILON) {
			this._applyZoom(this._zoomVelocity, this._wheelPointer);
			this._zoomVelocity = 1 + (this._zoomVelocity - 1) * damping;
			changed = true;
		}

		if (Math.abs(this._fovVelocity - 1) > ZOOM_STOP_EPSILON) {
			const maxFovOverride = this.zoomMode === 'auto' && this._fovVelocity < 1
				? this._baseFov : undefined;
			this._applyFovZoom(this._fovVelocity, this._wheelPointer, maxFovOverride);
			this._fovVelocity = 1 + (this._fovVelocity - 1) * damping;
			changed = true;
		}

		return changed;
	}

	private _fitOrtho(center: Vector3, forward: Vector3, width: number, height: number, enableTransition: boolean): Promise<void> {
		const camera = this.camera as OrthographicCamera;
		const baseWidth = (camera.right - camera.left) / camera.zoom;
		const baseHeight = (camera.top - camera.bottom) / camera.zoom;
		const targetZoom = MathUtils.clamp(
			Math.min(baseWidth / width, baseHeight / height),
			this.minZoom, this.maxZoom
		);
		const endPos = this._transitionEndPos.copy(center).addScaledVector(forward, - camera.position.distanceTo(center));

		return this._startTransition(endPos, targetZoom, 50, enableTransition);
	}

	private _fitPerspective(center: Vector3, forward: Vector3, distance: number, fov: number, enableTransition: boolean): Promise<void> {
		const endPos = this._transitionEndPos.copy(center).addScaledVector(forward, - distance);

		return this._startTransition(endPos, 1, fov, enableTransition);
	}

	private _cancelTransition(): void {
		if (this._transition) {
			this._transition.resolve();
			this._transition = null;
		}
	}

	private _startTransition(endPosition: Vector3, endZoom: number, endFov: number, enableTransition: boolean, endQuaternion?: Quaternion): Promise<void> {
		this._cancelTransition();

		// Zero all velocities so damping doesn't fight the transition
		this._rotateVelocity.set(0, 0);
		this._panVelocity.set(0, 0);
		this._dollyVelocity = 0;
		this._zoomVelocity = 1;
		this._fovVelocity = 1;

		if (! enableTransition) {
			// Snap immediately
			this.camera.position.copy(endPosition);
			if (endQuaternion) this.camera.quaternion.copy(endQuaternion);
			if (this.camera instanceof OrthographicCamera) {
				this.camera.zoom = endZoom;
				this.camera.updateProjectionMatrix();
			} else if (this.camera instanceof PerspectiveCamera && endFov !== this.camera.fov) {
				this.camera.fov = endFov;
				this.camera.updateProjectionMatrix();
			}
			this.camera.updateMatrixWorld();
			this.dispatchEvent(_changeEvent);
			return Promise.resolve();
		}

		return new Promise<void>((resolve) => {
			this._transition = {
				startPosition: this._transitionStartPos.copy(this.camera.position),
				endPosition: this._transitionEndPos.copy(endPosition),
				startQuaternion: this._transitionStartQuat.copy(this.camera.quaternion),
				endQuaternion: endQuaternion
					? this._transitionEndQuat.copy(endQuaternion)
					: this._transitionEndQuat.copy(this.camera.quaternion),
				slerp: !! endQuaternion,
				startZoom: this.camera instanceof OrthographicCamera ? this.camera.zoom : 1,
				endZoom: endZoom,
				startFov: this.camera instanceof PerspectiveCamera ? this.camera.fov : 50,
				endFov: endFov,
				elapsed: 0,
				duration: DEFAULT_TRANSITION_DURATION,
				resolve,
			};
		});
	}

	private _updateTransition(deltaSeconds: number): void {
		const t = this._transition!;
		t.elapsed += deltaSeconds;
		const progress = MathUtils.clamp(t.elapsed / t.duration, 0, 1);
		const eased = smoothstep(progress);

		this.camera.position.lerpVectors(t.startPosition, t.endPosition, eased);

		if (t.slerp) {
			this.camera.quaternion.slerpQuaternions(t.startQuaternion, t.endQuaternion, eased);
		}

		if (this.camera instanceof OrthographicCamera) {
			this.camera.zoom = MathUtils.lerp(t.startZoom, t.endZoom, eased);
			this.camera.updateProjectionMatrix();
		} else if (this.camera instanceof PerspectiveCamera) {
			this.camera.fov = MathUtils.lerp(t.startFov, t.endFov, eased);
			this.camera.updateProjectionMatrix();
		}

		this.camera.updateMatrixWorld();
		this.dispatchEvent(_changeEvent);

		if (progress >= 1) {
			// Snap to exact end values
			this.camera.position.copy(t.endPosition);
			if (t.slerp) this.camera.quaternion.copy(t.endQuaternion);
			if (this.camera instanceof OrthographicCamera) {
				this.camera.zoom = t.endZoom;
				this.camera.updateProjectionMatrix();
			} else if (this.camera instanceof PerspectiveCamera) {
				this.camera.fov = t.endFov;
				this.camera.updateProjectionMatrix();
			}
			this.camera.updateMatrixWorld();
			t.resolve();
			this._transition = null;
		}
	}

	private _applyRotate(dx: number, dy: number): void {
		const offset = this._offset.copy(this.camera.position).sub(this.pivot);
		const yawQ = this._yawQ.setFromAxisAngle(WORLD_UP, - dx * this.rotateSpeed);
		const orientation = this._orientation.copy(this.camera.quaternion).premultiply(yawQ);
		const rightAxis = this._right.copy(CAMERA_RIGHT).applyQuaternion(orientation).normalize();
		const pitchQ = this._pitchQ.setFromAxisAngle(rightAxis, - dy * this.rotateSpeed);

		offset.applyQuaternion(yawQ).applyQuaternion(pitchQ);
		this.camera.position.copy(this.pivot).add(offset);
		this.camera.quaternion.premultiply(yawQ);
		this.camera.quaternion.premultiply(pitchQ);
		this.camera.updateMatrixWorld();

		this.dispatchEvent(_changeEvent);
	}

	private _applyPan(dx: number, dy: number): void {
		let worldPerPixel: number;

		if (this.camera instanceof OrthographicCamera) {
			const visibleHeight = (this.camera.top - this.camera.bottom) / this.camera.zoom;
			worldPerPixel = visibleHeight * this.panSpeed;
		} else if (this.zoomMode === 'fov' || this.zoomMode === 'auto') {
			const distance = this.camera.position.distanceTo(this.pivot);
			const halfFovRad = MathUtils.degToRad((this.camera as PerspectiveCamera).fov / 2);
			worldPerPixel = 2 * distance * Math.tan(halfFovRad) * this.panSpeed;
		} else {
			const distance = this.camera.position.distanceTo(this.pivot);
			worldPerPixel = distance * this.panSpeed;
		}

		const right = this._right.copy(CAMERA_RIGHT).applyQuaternion(this.camera.quaternion).normalize();
		const up = this._up.copy(CAMERA_UP).applyQuaternion(this.camera.quaternion).normalize();
		const move = right.multiplyScalar(- dx * worldPerPixel).add(up.multiplyScalar(dy * worldPerPixel));

		this.camera.position.add(move);
		this.camera.updateMatrixWorld();

		this.dispatchEvent(_changeEvent);
	}

	private _applyDolly(step: number, pointer: Vector2): void {
		if (this.camera instanceof OrthographicCamera) return;

		if (step > 0) {
			const currentDistance = this.camera.position.distanceTo(this.pivot);
			if (currentDistance <= this.minDistance + STOP_EPSILON) {
				if (this.zoomMode === 'auto') {
					const scale = 1 - this._dollyVelocity / this.minDistance;
					if (scale > 0) this._fovVelocity = 1 / scale;
				}
				this._dollyVelocity = 0;
				return;
			}
		}

		this._raycaster.setFromCamera(pointer, this.camera);
		const rayDir = this._raycaster.ray.direction;
		const forward = this._dir2;
		this.camera.getWorldDirection(forward);
		const nextPos = this._nextPos.copy(this.camera.position).addScaledVector(forward, step);
		const before = this._before;
		const after = this._after;
		const origin = this._origin.copy(this.camera.position);

		const hasBefore = intersectRayWithPlane(origin, rayDir, this.pivot, forward, before);
		const hasAfter = intersectRayWithPlane(nextPos, rayDir, this.pivot, forward, after);

		if (hasBefore && hasAfter) {
			nextPos.add(before.sub(after));
		} else {
			nextPos.addScaledVector(rayDir, step);
		}

		const nextFromPivot = this._dir.copy(nextPos).sub(this.pivot);
		const nextDistance = nextFromPivot.length();
		const clampedDistance = MathUtils.clamp(nextDistance, this.minDistance, this.maxDistance);

		if (nextDistance > 0 && clampedDistance !== nextDistance) {
			nextFromPivot.multiplyScalar(clampedDistance / nextDistance);
			nextPos.copy(this.pivot).add(nextFromPivot);
		}

		this.camera.position.copy(nextPos);
		this.camera.updateMatrixWorld();

		this.dispatchEvent(_changeEvent);
	}

	private _applyZoom(factor: number, pointer: Vector2): void {
		const camera = this.camera as OrthographicCamera;

		const before = this._before.set(pointer.x, pointer.y, 0).unproject(camera);

		camera.zoom = MathUtils.clamp(camera.zoom * factor, this.minZoom, this.maxZoom);
		camera.updateProjectionMatrix();

		const after = this._after.set(pointer.x, pointer.y, 0).unproject(camera);

		camera.position.sub(after).add(before);
		camera.updateMatrixWorld();

		this.dispatchEvent(_changeEvent);
	}

	private _applyFovZoom(factor: number, pointer: Vector2, maxFov?: number): void {
		const camera = this.camera as PerspectiveCamera;
		const forward = this._dir2;
		camera.getWorldDirection(forward);

		this._raycaster.setFromCamera(pointer, camera);
		const rayDir = this._raycaster.ray.direction;
		const before = this._before;
		const hasBefore = intersectRayWithPlane(camera.position, rayDir, this.pivot, forward, before);

		camera.fov = MathUtils.clamp(camera.fov / factor, this.minFov, maxFov ?? this.maxFov);
		camera.updateProjectionMatrix();

		if (hasBefore) {
			this._raycaster.setFromCamera(pointer, camera);
			const afterRayDir = this._raycaster.ray.direction;
			const after = this._after;
			const hasAfter = intersectRayWithPlane(camera.position, afterRayDir, this.pivot, forward, after);

			if (hasAfter) {
				const shift = before.sub(after);
				if (this.zoomMode === 'auto') shift.multiplyScalar(this.autoFovAnchorScale);
				camera.position.add(shift);
				camera.updateMatrixWorld();
			}
		}

		this.dispatchEvent(_changeEvent);
	}

	private _applyScrollZoom(rawDelta: number, factorScale: number, pointer: Vector2): void {
		const normalizedDelta = rawDelta * 0.01;
		const scale = Math.pow(ZOOM_BASE, this.zoomSpeed * normalizedDelta * factorScale);
		const factor = 1 / scale;

		if (this.camera instanceof OrthographicCamera) {
			this._applyZoom(factor, pointer);
			this._zoomVelocity = factor;
		} else if (this.zoomMode === 'fov') {
			this._applyFovZoom(factor, pointer);
			this._fovVelocity = factor;
		} else if (this.zoomMode === 'auto') {
			const distance = this.camera.position.distanceTo(this.pivot);
			const perspCam = this.camera as PerspectiveCamera;
			const isZoomIn = rawDelta > 0;

			if (isZoomIn) {
				if (distance <= this.minDistance + MIN_DISTANCE_BUFFER) {
					this._applyFovZoom(factor, pointer);
					this._fovVelocity = factor;
				} else {
					const step = distance * (1 - scale);
					this._applyDolly(step, pointer);
					this._dollyVelocity = step;
				}
			} else {
				if (perspCam.fov < this._baseFov - FOV_EPSILON) {
					this._applyFovZoom(factor, pointer, this._baseFov);
					this._fovVelocity = factor;
				} else {
					const step = distance * (1 - scale);
					this._applyDolly(step, pointer);
					this._dollyVelocity = step;
				}
			}
		} else {
			const distance = this.camera.position.distanceTo(this.pivot);
			const step = distance * (1 - scale);
			this._applyDolly(step, pointer);
			this._dollyVelocity = step;
		}
	}

	private _applyKeyZoom(direction: number): void {
		const center = this._wheelPointer.set(0, 0);
		const scale = Math.pow(ZOOM_BASE, this.keyZoomSpeed * direction);
		const factor = 1 / scale;

		if (this.camera instanceof OrthographicCamera) {
			this._applyZoom(factor, center);
			this._zoomVelocity = factor;
		} else if (this.zoomMode === 'fov') {
			this._applyFovZoom(factor, center);
			this._fovVelocity = factor;
		} else if (this.zoomMode === 'auto') {
			const distance = this.camera.position.distanceTo(this.pivot);
			const perspCam = this.camera as PerspectiveCamera;
			const isZoomIn = direction > 0;

			if (isZoomIn) {
				if (distance <= this.minDistance + MIN_DISTANCE_BUFFER) {
					this._applyFovZoom(factor, center);
					this._fovVelocity = factor;
				} else {
					const step = distance * (1 - scale);
					this._applyDolly(step, center);
					this._dollyVelocity = step;
				}
			} else {
				if (perspCam.fov < this._baseFov - FOV_EPSILON) {
					this._applyFovZoom(factor, center, this._baseFov);
					this._fovVelocity = factor;
				} else {
					const step = distance * (1 - scale);
					this._applyDolly(step, center);
					this._dollyVelocity = step;
				}
			}
		} else {
			const distance = this.camera.position.distanceTo(this.pivot);
			const step = distance * (1 - scale);
			this._applyDolly(step, center);
			this._dollyVelocity = step;
		}
	}

	private _onContextMenu(event: Event): void {
		if (this.preventContextMenu) event.preventDefault();
	}

	private _onPointerDown(event: PointerEvent): void {
		if (! this.enabled) return;

		this._cancelTransition();

		if (event.pointerType === 'touch') {
			event.preventDefault();
			this._onTouchStart(event);
			return;
		}

		const bindings = this.inputBindings;
		const panHasModifier = 'modifier' in bindings.pan;
		const panMode = event.button === bindings.pan.button
			&& (! panHasModifier || hasModifier(event, (bindings.pan as { modifier: ModifierKey }).modifier));
		const rotateMode = event.button === bindings.rotate.button && ! panMode;
		if (! panMode && ! rotateMode) return;

		this._drag.isDragging = true;
		this._drag.mode = panMode ? 'pan' : 'rotate';
		this._drag.x = event.clientX;
		this._drag.y = event.clientY;
		this._rotateVelocity.set(0, 0);
		this._panVelocity.set(0, 0);
		this._dollyVelocity = 0;
		this._zoomVelocity = 1;
		this._fovVelocity = 1;

		if (this.domElement) {
			this.domElement.setPointerCapture(event.pointerId);
		}

		this.dispatchEvent(_startEvent);
	}

	private _onTouchStart(event: PointerEvent): void {
		this._pointers.push(event);

		if (this.domElement) {
			this.domElement.setPointerCapture(event.pointerId);
		}

		if (this._pointers.length === 1) {
			this._drag.isDragging = true;
			this._drag.mode = this.touchBindings.one;
			this._drag.x = event.clientX;
			this._drag.y = event.clientY;
			this._rotateVelocity.set(0, 0);
			this._panVelocity.set(0, 0);
			this._dollyVelocity = 0;
			this._zoomVelocity = 1;
			this._fovVelocity = 1;
			this.dispatchEvent(_startEvent);
		} else if (this._pointers.length === 2) {
			this._drag.mode = this.touchBindings.two;
			this._drag.x = (this._pointers[0].clientX + this._pointers[1].clientX) * 0.5;
			this._drag.y = (this._pointers[0].clientY + this._pointers[1].clientY) * 0.5;
			this._pinchDistance = this._getPointerDistance();
		}
	}

	private _onPointerMove(event: PointerEvent): void {
		if (! this.enabled) return;

		if (event.pointerType === 'touch') {
			this._onTouchMove(event);
			return;
		}

		if (! this._drag.isDragging || ! this._drag.mode) return;

		const dx = event.clientX - this._drag.x;
		const dy = event.clientY - this._drag.y;
		this._drag.x = event.clientX;
		this._drag.y = event.clientY;

		if (this._drag.mode === 'rotate') {
			this._applyRotate(dx, dy);
			this._rotateVelocity.set(dx, dy);
		} else {
			this._applyPan(dx, dy);
			this._panVelocity.set(dx, dy);
		}
	}

	private _onTouchMove(event: PointerEvent): void {
		const index = this._pointers.findIndex(p => p.pointerId === event.pointerId);
		if (index === - 1) return;
		this._pointers[index] = event;

		if (! this._drag.isDragging || ! this._drag.mode) return;

		if (this._pointers.length === 2) {
			const midX = (this._pointers[0].clientX + this._pointers[1].clientX) * 0.5;
			const midY = (this._pointers[0].clientY + this._pointers[1].clientY) * 0.5;
			const dx = midX - this._drag.x;
			const dy = midY - this._drag.y;
			this._drag.x = midX;
			this._drag.y = midY;

			if (this._drag.mode === 'rotate') {
				this._applyRotate(dx, dy);
				this._rotateVelocity.set(dx, dy);
			} else {
				this._applyPan(dx, dy);
				this._panVelocity.set(dx, dy);
			}

			if (this.touchBindings.pinch && this.domElement) {
				const currentDistance = this._getPointerDistance();
				const delta = currentDistance - this._pinchDistance;
				this._pinchDistance = currentDistance;

				const el = this.domElement;
				const rect = el.getBoundingClientRect();
				this._wheelPointer.set(
					((midX - rect.left) / rect.width) * 2 - 1,
					- ((midY - rect.top) / rect.height) * 2 + 1
				);

				this._applyScrollZoom(delta, PINCH_SCALE, this._wheelPointer);
			}
		} else if (this._pointers.length === 1) {
			const dx = event.clientX - this._drag.x;
			const dy = event.clientY - this._drag.y;
			this._drag.x = event.clientX;
			this._drag.y = event.clientY;

			if (this._drag.mode === 'rotate') {
				this._applyRotate(dx, dy);
				this._rotateVelocity.set(dx, dy);
			} else {
				this._applyPan(dx, dy);
				this._panVelocity.set(dx, dy);
			}
		}
	}

	private _onPointerUp(event: PointerEvent): void {
		if (event.pointerType === 'touch') {
			this._onTouchEnd(event);
			return;
		}

		if (event.button !== this.inputBindings.rotate.button && event.button !== this.inputBindings.pan.button) return;

		this._drag.isDragging = false;
		this._drag.mode = null;

		if (this.domElement) {
			this.domElement.releasePointerCapture(event.pointerId);
		}

		this.dispatchEvent(_endEvent);
	}

	private _onTouchEnd(event: PointerEvent): void {
		const index = this._pointers.findIndex(p => p.pointerId === event.pointerId);
		if (index !== - 1) this._pointers.splice(index, 1);

		if (this.domElement) {
			this.domElement.releasePointerCapture(event.pointerId);
		}

		if (this._pointers.length === 0) {
			this._drag.isDragging = false;
			this._drag.mode = null;
			this.dispatchEvent(_endEvent);
		} else if (this._pointers.length === 1) {
			this._drag.mode = this.touchBindings.one;
			this._drag.x = this._pointers[0].clientX;
			this._drag.y = this._pointers[0].clientY;
		}
	}

	private _getPointerDistance(): number {
		const dx = this._pointers[0].clientX - this._pointers[1].clientX;
		const dy = this._pointers[0].clientY - this._pointers[1].clientY;
		return Math.sqrt(dx * dx + dy * dy);
	}

	private _matchAction(action: KeyboardBindings[keyof KeyboardBindings], event: KeyboardEvent): boolean {
		if (action === false) return false;
		if ('modifier' in action) return hasModifier(event, (action as { modifier: ModifierKey }).modifier);
		return hasNoModifier(event);
	}

	private _onKeyDown(event: KeyboardEvent): void {
		if (! this.enabled || ! this.enableKeyboard) return;

		this._cancelTransition();

		const code = event.code;
		const { LEFT, UP, RIGHT, BOTTOM } = this.keys;

		if (code !== LEFT && code !== UP && code !== RIGHT && code !== BOTTOM) return;

		const bindings = this._keyboardBindings;
		const isZoom = this._matchAction(bindings.zoom, event);

		if (isZoom) {
			if (code !== UP && code !== BOTTOM) return;

			event.preventDefault();

			const direction = code === UP ? 1 : - 1;
			this._applyKeyZoom(direction);

			this.dispatchEvent(_startEvent);
			this.dispatchEvent(_endEvent);
			return;
		}

		const isRotate = this._matchAction(bindings.rotate, event);
		const isPan = this._matchAction(bindings.pan, event);

		if (! isRotate && ! isPan) return;

		event.preventDefault();

		if (isRotate && ! isPan) {
			const height = this.domElement?.clientHeight || 600;
			const rotateAngle = (2 * Math.PI * this.keyRotateSpeed) / height;
			const pixelDelta = rotateAngle / this.rotateSpeed;

			let dx = 0;
			let dy = 0;

			if (code === LEFT) dx = pixelDelta;
			if (code === RIGHT) dx = - pixelDelta;
			if (code === UP) dy = pixelDelta;
			if (code === BOTTOM) dy = - pixelDelta;

			this._applyRotate(dx, dy);
			this._rotateVelocity.set(dx, dy);
		} else if (isPan) {
			let dx = 0;
			let dy = 0;

			if (code === LEFT) dx = this.keyPanSpeed;
			if (code === RIGHT) dx = - this.keyPanSpeed;
			if (code === UP) dy = this.keyPanSpeed;
			if (code === BOTTOM) dy = - this.keyPanSpeed;

			this._applyPan(dx, dy);
			this._panVelocity.set(dx, dy);
		}

		this.dispatchEvent(_startEvent);
		this.dispatchEvent(_endEvent);
	}

	private _onWheel(event: WheelEvent): void {
		if (! this.enabled || ! this.domElement) return;
		event.preventDefault();

		this._cancelTransition();

		const el = this.domElement;
		const rect = el.getBoundingClientRect();
		this._pointer.set(
			((event.clientX - rect.left) / rect.width) * 2 - 1,
			- ((event.clientY - rect.top) / rect.height) * 2 + 1
		);

		this._wheelPointer.copy(this._pointer);
		this._applyScrollZoom(- event.deltaY, 1, this._wheelPointer);
	}
}

export { CADCameraControls };
export type { InputBindings, TouchBindings, KeyboardKeys, KeyboardBindings, MouseButton, ModifierKey, ZoomMode } from './types';
