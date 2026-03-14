import * as THREE from 'three';
import { TeapotGeometry } from 'three/examples/jsm/geometries/TeapotGeometry.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import GUI from 'lil-gui';
import { CADCameraControls } from '../src/CADCameraControls';
import type { ZoomMode } from '../src/types';
import { buildInputBindings, buildKeyboardBindings } from './bindings';
import type { ButtonLabel, ModifierLabel } from './bindings';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(render);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const clock = new THREE.Clock();
const bindingsEl = document.getElementById('bindings')!;

// Lighting

const ambient = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambient);

const directional = new THREE.DirectionalLight(0xffffff, 0.9);
directional.position.set(3, 5, 8);
scene.add(directional);

// Scene objects

const GRID_SIZE = 4000;
const GRID_DIVISIONS = 40;
const AXES_SIZE = 300;
const CAMERA_FOV = 50;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 200000;
const CAMERA_DISTANCE = 1200;
const ORTHO_FRUSTUM = 1200;

const grid = new THREE.GridHelper(GRID_SIZE, GRID_DIVISIONS, 0x444444, 0x222222);
scene.add(grid);

function createAxisLine(positions: number[], color: number): Line2 {
	const geometry = new LineGeometry();
	geometry.setPositions(positions);
	const material = new LineMaterial({ color, linewidth: 3, resolution: new THREE.Vector2(window.innerWidth, window.innerHeight) });
	return new Line2(geometry, material);
}

const pivotGroup = new THREE.Group();
const axisX = createAxisLine([0, 0, 0, AXES_SIZE, 0, 0], 0xff0000);
const axisY = createAxisLine([0, 0, 0, 0, AXES_SIZE, 0], 0x00ff00);
const axisZ = createAxisLine([0, 0, 0, 0, 0, AXES_SIZE], 0x0000ff);
pivotGroup.add(axisX, axisY, axisZ);
scene.add(pivotGroup);

const pivotCanvas = document.createElement('canvas');
pivotCanvas.width = 64;
pivotCanvas.height = 64;
const ctx = pivotCanvas.getContext('2d')!;
ctx.beginPath();
ctx.arc(32, 32, 28, 0, Math.PI * 2);
ctx.fillStyle = '#ffdd00';
ctx.fill();
ctx.lineWidth = 4;
ctx.strokeStyle = '#000000';
ctx.stroke();
const pivotTexture = new THREE.CanvasTexture(pivotCanvas);
const pivotSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: pivotTexture, depthTest: false, sizeAttenuation: false }));
pivotSprite.scale.set(0.015, 0.015, 1);
pivotSprite.renderOrder = 999;
scene.add(pivotSprite);

const teapotGeometry = new TeapotGeometry(200, 15, true, true, true, true, true);
teapotGeometry.computeBoundingBox();
const teapotSphere = new THREE.Sphere();
teapotGeometry.boundingBox!.getBoundingSphere(teapotSphere);
const model = new THREE.Mesh(teapotGeometry, new THREE.MeshNormalMaterial({ side: THREE.DoubleSide }));
scene.add(model);

// Camera

let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera = createPerspectiveCamera();

function createPerspectiveCamera(): THREE.PerspectiveCamera {
	const cam = new THREE.PerspectiveCamera(CAMERA_FOV, window.innerWidth / window.innerHeight, CAMERA_NEAR, CAMERA_FAR);
	cam.position.set(0, 0, CAMERA_DISTANCE);
	return cam;
}

function createOrthographicCamera(): THREE.OrthographicCamera {
	const aspect = window.innerWidth / window.innerHeight;
	const cam = new THREE.OrthographicCamera(
		- ORTHO_FRUSTUM * aspect / 2,
		ORTHO_FRUSTUM * aspect / 2,
		ORTHO_FRUSTUM / 2,
		- ORTHO_FRUSTUM / 2,
		- CAMERA_FAR,
		CAMERA_FAR
	);
	cam.position.set(0, 0, CAMERA_DISTANCE);
	return cam;
}

// Controls

const modifierOptions = ['none', 'ctrl', 'meta', 'alt', 'shift'];

const params = {
	cameraType: 'Perspective' as string,
	enabled: true,
	enableDamping: true,
	dampingFactor: 0.2,
	showPivot: true,
	pivotX: 0,
	pivotY: 0,
	pivotZ: 0,
	rotateButton: 'left' as ButtonLabel,
	panButton: 'right' as ButtonLabel,
	panModifier: 'none' as ModifierLabel,
	rotateSpeed: 0.005,
	panSpeed: 0.001,
	zoomSpeed: 1,
	autoFovAnchorScale: 1,
	zoomMode: 'auto' as ZoomMode,
	minDistance: Math.ceil(teapotSphere.radius),
	maxDistance: 100000,
	minZoom: 0.01,
	maxZoom: 1000,
	minFov: 1,
	maxFov: 120,
	preventContextMenu: true,
	enableKeyboard: true,
	keyRotateModifier: 'shift' as ModifierLabel,
	keyPanModifier: 'none' as ModifierLabel,
	keyZoomModifier: 'meta' as ModifierLabel,
	keyPanSpeed: 7,
	keyRotateSpeed: 1,
	keyZoomSpeed: 1,
};

let controls = new CADCameraControls(camera, renderer.domElement);
controls.listenToKeyEvents(document.body);

function switchCamera(): void {
	controls.dispose();

	if (params.cameraType === 'Perspective') {
		camera = createPerspectiveCamera();
	} else {
		camera = createOrthographicCamera();
	}

	controls = new CADCameraControls(camera, renderer.domElement);
	controls.listenToKeyEvents(document.body);
	applyControls();
}

// GUI

const gui = new GUI();

gui.add(params, 'cameraType', ['Perspective', 'Orthographic']).name('camera').onChange(switchCamera);
gui.add(params, 'zoomMode', ['dolly', 'fov', 'auto']).name('zoom mode').onChange(applyControls);
gui.add(params, 'enabled').onChange(applyControls);
gui.add(params, 'enableDamping').onChange(applyControls);
gui.add(params, 'dampingFactor', 0, 1, 0.01).onChange(applyControls);

const pivotFolder = gui.addFolder('pivot');
pivotFolder.add(params, 'showPivot').name('show pivot').onChange(applyControls);
pivotFolder.add(params, 'pivotX', - 1000, 1000, 1).onChange(applyControls);
pivotFolder.add(params, 'pivotY', - 1000, 1000, 1).onChange(applyControls);
pivotFolder.add(params, 'pivotZ', - 1000, 1000, 1).onChange(applyControls);
pivotFolder.open();

const inputFolder = gui.addFolder('input');
inputFolder.add(params, 'rotateButton', ['left', 'middle', 'right']).name('rotate').onChange(applyControls);
inputFolder.add(params, 'panButton', ['left', 'middle', 'right']).name('pan').onChange(applyControls);
const panModifierCtrl = inputFolder.add(params, 'panModifier', modifierOptions).name('pan modifier').onChange(applyControls);
inputFolder.add(params, 'preventContextMenu').onChange(applyControls);
inputFolder.open();

const keyboardFolder = gui.addFolder('keyboard');
keyboardFolder.add(params, 'enableKeyboard').name('enable').onChange(applyControls);
const keyRotateModCtrl = keyboardFolder.add(params, 'keyRotateModifier', modifierOptions).name('rotate modifier').onChange(applyControls);
const keyPanModCtrl = keyboardFolder.add(params, 'keyPanModifier', modifierOptions).name('pan modifier').onChange(applyControls);
const keyZoomModCtrl = keyboardFolder.add(params, 'keyZoomModifier', modifierOptions).name('zoom modifier').onChange(applyControls);
keyboardFolder.add(params, 'keyPanSpeed', 1, 50, 1).name('pan speed').onChange(applyControls);
keyboardFolder.add(params, 'keyRotateSpeed', 0.1, 5, 0.1).name('rotate speed').onChange(applyControls);
keyboardFolder.add(params, 'keyZoomSpeed', 0.1, 5, 0.1).name('zoom speed').onChange(applyControls);

const speedFolder = gui.addFolder('speed');
speedFolder.add(params, 'rotateSpeed', 0.0005, 0.02, 0.0001).onChange(applyControls);
speedFolder.add(params, 'panSpeed', 0.0001, 0.02, 0.0001).onChange(applyControls);
speedFolder.add(params, 'zoomSpeed', 0.1, 5, 0.1).onChange(applyControls);
speedFolder.add(params, 'autoFovAnchorScale', 0, 5, 0.01).name('auto fov anchor').onChange(applyControls);

// Fit & Views

const fitViewFolder = gui.addFolder('fit & views');

fitViewFolder.add({ fitToBox: () => {
	const box = new THREE.Box3().setFromObject(model);
	controls.fitToBox(box, true, 0.1);
} }, 'fitToBox').name('fit to box');

fitViewFolder.add({ fitToSphere: () => {
	const sphere = new THREE.Sphere();
	new THREE.Box3().setFromObject(model).getBoundingSphere(sphere);
	controls.fitToSphere(sphere, true, 0.1);
} }, 'fitToSphere').name('fit to sphere');

// Saved views

const savedViews: { position: THREE.Vector3; quaternion: THREE.Quaternion; fov: number; zoom: number }[] = [];

fitViewFolder.add({ saveView: () => {
	savedViews.push({
		position: camera.position.clone(),
		quaternion: camera.quaternion.clone(),
		fov: camera instanceof THREE.PerspectiveCamera ? camera.fov : 50,
		zoom: camera instanceof THREE.OrthographicCamera ? camera.zoom : 1,
	});
	rebuildViewButtons();
} }, 'saveView').name('save view');

function rebuildViewButtons(): void {
	// Remove old view buttons
	for (const ctrl of viewButtonControllers) {
		ctrl.destroy();
	}
	viewButtonControllers.length = 0;

	for (let i = 0; i < savedViews.length; i ++) {
		const view = savedViews[i];
		const obj = { [`view${ i }`]: () => {
			controls.setView(view.position, view.quaternion, true, {
				fov: view.fov,
				zoom: view.zoom,
			});
		} };
		const ctrl = fitViewFolder.add(obj, `view${ i }`).name(`restore ${ i + 1 }`);
		viewButtonControllers.push(ctrl);
	}
}

const viewButtonControllers: ReturnType<typeof fitViewFolder.add>[] = [];

// Preset orientation views

const PRESET_DISTANCE = CAMERA_DISTANCE;

fitViewFolder.add({ front: () => {
	const pos = new THREE.Vector3(0, 0, PRESET_DISTANCE);
	const quat = new THREE.Quaternion();
	controls.setView(pos, quat);
} }, 'front').name('front');

fitViewFolder.add({ top: () => {
	const pos = new THREE.Vector3(0, PRESET_DISTANCE, 0);
	const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), - Math.PI / 2);
	controls.setView(pos, quat);
} }, 'top').name('top');

fitViewFolder.add({ right: () => {
	const pos = new THREE.Vector3(PRESET_DISTANCE, 0, 0);
	const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
	controls.setView(pos, quat);
} }, 'right').name('right');

fitViewFolder.add({ iso: () => {
	const d = PRESET_DISTANCE / Math.sqrt(3);
	const pos = new THREE.Vector3(d, d, d);
	const quat = new THREE.Quaternion().setFromRotationMatrix(
		new THREE.Matrix4().lookAt(pos, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0))
	);
	controls.setView(pos, quat);
} }, 'iso').name('isometric');

fitViewFolder.open();

const limitsFolder = gui.addFolder('limits');
limitsFolder.add(params, 'minDistance', 1, 10000, 1).onChange(applyControls);
limitsFolder.add(params, 'maxDistance', 100, 200000, 10).onChange(applyControls);
limitsFolder.add(params, 'minZoom', 0.001, 1, 0.001).onChange(applyControls);
limitsFolder.add(params, 'maxZoom', 1, 2000, 1).onChange(applyControls);
limitsFolder.add(params, 'minFov', 1, 60, 1).onChange(applyControls);
limitsFolder.add(params, 'maxFov', 60, 170, 1).onChange(applyControls);

// Helpers

function mouseLabel(button: number): string {
	if (button === 0) return 'left-drag';
	if (button === 1) return 'middle-drag';
	return 'right-drag';
}

function getInputBindings() {
	const result = buildInputBindings(params.rotateButton, params.panButton, params.panModifier);

	if (result.resolvedModifier !== params.panModifier) {
		params.panModifier = result.resolvedModifier;
		panModifierCtrl.updateDisplay();
	}

	return result.bindings;
}

function getKeyboardBindings() {
	const result = buildKeyboardBindings(params.keyRotateModifier, params.keyPanModifier, params.keyZoomModifier);

	if (result.resolvedRotateModifier !== params.keyRotateModifier) {
		params.keyRotateModifier = result.resolvedRotateModifier;
		keyRotateModCtrl.updateDisplay();
	}

	if (result.resolvedPanModifier !== params.keyPanModifier) {
		params.keyPanModifier = result.resolvedPanModifier;
		keyPanModCtrl.updateDisplay();
	}

	if (result.resolvedZoomModifier !== params.keyZoomModifier) {
		params.keyZoomModifier = result.resolvedZoomModifier;
		keyZoomModCtrl.updateDisplay();
	}

	return result.bindings;
}

function applyBindingsText(): void {
	const bindings = controls.inputBindings;
	const rotateText = mouseLabel(bindings.rotate.button);
	const panHasModifier = 'modifier' in bindings.pan;
	const panText = panHasModifier
		? `${ (bindings.pan as { modifier: string }).modifier }+${ mouseLabel(bindings.pan.button) }`
		: mouseLabel(bindings.pan.button);

	const kb = controls.keyboardBindings;

	const actionText = (action: typeof kb.rotate, allKeys: string, subset?: string): string => {
		if (action === false) return 'off';
		const keys = subset ?? allKeys;
		if ('modifier' in action) return `${ (action as { modifier: string }).modifier }+${ keys }`;
		return keys;
	};

	const kbRotateText = actionText(kb.rotate, 'arrows');
	const kbPanText = actionText(kb.pan, 'arrows');
	const kbZoomText = actionText(kb.zoom, 'arrows', 'up/down');

	bindingsEl.textContent = `rotate: ${ rotateText } | pan: ${ panText } | zoom: mousewheel | keyboard rotate: ${ kbRotateText }, pan: ${ kbPanText }, zoom: ${ kbZoomText }`;
}

function applyControls(): void {
	controls.enabled = params.enabled;
	controls.enableDamping = params.enableDamping;
	controls.dampingFactor = params.dampingFactor;
	controls.pivot.set(params.pivotX, params.pivotY, params.pivotZ);
	pivotGroup.visible = params.showPivot;
	pivotGroup.position.copy(controls.pivot);
	pivotSprite.visible = params.showPivot;
	pivotSprite.position.copy(controls.pivot);
	controls.inputBindings = getInputBindings();
	controls.rotateSpeed = params.rotateSpeed;
	controls.panSpeed = params.panSpeed;
	controls.zoomSpeed = params.zoomSpeed;
	controls.autoFovAnchorScale = params.autoFovAnchorScale;
	controls.minDistance = Math.min(params.minDistance, params.maxDistance - 1);
	controls.maxDistance = Math.max(params.maxDistance, params.minDistance + 1);
	controls.minZoom = params.minZoom;
	controls.maxZoom = params.maxZoom;
	controls.zoomMode = params.zoomMode;
	controls.minFov = params.minFov;
	controls.maxFov = params.maxFov;
	controls.preventContextMenu = params.preventContextMenu;
	controls.enableKeyboard = params.enableKeyboard;
	controls.keyboardBindings = getKeyboardBindings();
	controls.keyPanSpeed = params.keyPanSpeed;
	controls.keyRotateSpeed = params.keyRotateSpeed;
	controls.keyZoomSpeed = params.keyZoomSpeed;
	applyBindingsText();
}

function onWindowResize(): void {
	const aspect = window.innerWidth / window.innerHeight;

	if (camera instanceof THREE.PerspectiveCamera) {
		camera.aspect = aspect;
	} else if (camera instanceof THREE.OrthographicCamera) {
		camera.left = - ORTHO_FRUSTUM * aspect / 2;
		camera.right = ORTHO_FRUSTUM * aspect / 2;
		camera.top = ORTHO_FRUSTUM / 2;
		camera.bottom = - ORTHO_FRUSTUM / 2;
	}

	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
	const res = new THREE.Vector2(window.innerWidth, window.innerHeight);
	axisX.material.resolution = res;
	axisY.material.resolution = res;
	axisZ.material.resolution = res;
}

function render(): void {
	controls.update(clock.getDelta());
	renderer.render(scene, camera);
}

window.addEventListener('resize', onWindowResize);
applyControls();
