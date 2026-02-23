import * as THREE from 'three';
import GUI from 'lil-gui';
import { CADCameraControls } from '../src/CADCameraControls';
import type { ZoomMode } from '../src/types';
import { buildInputBindings } from './bindings';
import type { ButtonLabel, ModifierLabel } from './bindings';

const renderer = new THREE.WebGLRenderer( { antialias: true } );
renderer.setPixelRatio( window.devicePixelRatio );
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setAnimationLoop( render );
document.body.appendChild( renderer.domElement );

const scene = new THREE.Scene();
scene.background = new THREE.Color( 0x000000 );

const clock = new THREE.Clock();
const bindingsEl = document.getElementById( 'bindings' )!;

// Lighting

const ambient = new THREE.AmbientLight( 0xffffff, 0.8 );
scene.add( ambient );

const directional = new THREE.DirectionalLight( 0xffffff, 0.9 );
directional.position.set( 3, 5, 8 );
scene.add( directional );

// Scene objects

const GRID_SIZE = 4000;
const GRID_DIVISIONS = 40;
const AXES_SIZE = 300;
const CUBE_SIZE = 120;
const CAMERA_FOV = 50;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 200000;
const CAMERA_DISTANCE = 1200;
const ORTHO_FRUSTUM = 1200;

const grid = new THREE.GridHelper( GRID_SIZE, GRID_DIVISIONS, 0x444444, 0x222222 );
scene.add( grid );

const axes = new THREE.AxesHelper( AXES_SIZE );
scene.add( axes );

const cube = new THREE.Mesh(
	new THREE.BoxGeometry( CUBE_SIZE, CUBE_SIZE, CUBE_SIZE ),
	new THREE.MeshNormalMaterial()
);
scene.add( cube );

// Camera

let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera = createPerspectiveCamera();

function createPerspectiveCamera(): THREE.PerspectiveCamera {

	const cam = new THREE.PerspectiveCamera( CAMERA_FOV, window.innerWidth / window.innerHeight, CAMERA_NEAR, CAMERA_FAR );
	cam.position.set( 0, 0, CAMERA_DISTANCE );
	return cam;

}

function createOrthographicCamera(): THREE.OrthographicCamera {

	const aspect = window.innerWidth / window.innerHeight;
	const cam = new THREE.OrthographicCamera(
		- ORTHO_FRUSTUM * aspect / 2,
		ORTHO_FRUSTUM * aspect / 2,
		ORTHO_FRUSTUM / 2,
		- ORTHO_FRUSTUM / 2,
		CAMERA_NEAR,
		CAMERA_FAR
	);
	cam.position.set( 0, 0, CAMERA_DISTANCE );
	return cam;

}

// Controls

const modifierOptions = [ 'none', 'ctrl', 'meta', 'alt', 'shift' ];

const params = {
	cameraType: 'Perspective' as string,
	enabled: true,
	enableDamping: true,
	dampingFactor: 0.9,
	pivotX: 0,
	pivotY: 0,
	pivotZ: 0,
	rotateButton: 'left' as ButtonLabel,
	panButton: 'right' as ButtonLabel,
	panModifier: 'none' as ModifierLabel,
	rotateSpeed: 0.005,
	panSpeed: 0.001,
	zoomSpeed: 0.005,
	zoomMode: 'dolly' as ZoomMode,
	minDistance: Math.ceil( 1.1 * CUBE_SIZE * Math.sqrt( 3 ) / 2 ),
	maxDistance: 100000,
	minZoom: 0.01,
	maxZoom: 1000,
	minFov: 1,
	maxFov: 120,
	preventContextMenu: true,
};

let controls = new CADCameraControls( camera, renderer.domElement );

function switchCamera(): void {

	controls.dispose();

	if ( params.cameraType === 'Perspective' ) {

		camera = createPerspectiveCamera();

	} else {

		camera = createOrthographicCamera();

	}

	controls = new CADCameraControls( camera, renderer.domElement );
	applyControls();

}

// GUI

const gui = new GUI();

gui.add( params, 'cameraType', [ 'Perspective', 'Orthographic' ] ).name( 'camera' ).onChange( switchCamera );
gui.add( params, 'zoomMode', [ 'dolly', 'fov', 'auto' ] ).name( 'zoom mode' ).onChange( applyControls );
gui.add( params, 'enabled' ).onChange( applyControls );
gui.add( params, 'enableDamping' ).onChange( applyControls );
gui.add( params, 'dampingFactor', 0.7, 0.99, 0.001 ).onChange( applyControls );

const pivotFolder = gui.addFolder( 'pivot' );
pivotFolder.add( params, 'pivotX', - 1000, 1000, 1 ).onChange( applyControls );
pivotFolder.add( params, 'pivotY', - 1000, 1000, 1 ).onChange( applyControls );
pivotFolder.add( params, 'pivotZ', - 1000, 1000, 1 ).onChange( applyControls );
pivotFolder.open();

const inputFolder = gui.addFolder( 'input' );
inputFolder.add( params, 'rotateButton', [ 'left', 'middle', 'right' ] ).name( 'rotate' ).onChange( applyControls );
inputFolder.add( params, 'panButton', [ 'left', 'middle', 'right' ] ).name( 'pan' ).onChange( applyControls );
const panModifierCtrl = inputFolder.add( params, 'panModifier', modifierOptions ).name( 'pan modifier' ).onChange( applyControls );
inputFolder.add( params, 'preventContextMenu' ).onChange( applyControls );
inputFolder.open();

const speedFolder = gui.addFolder( 'speed' );
speedFolder.add( params, 'rotateSpeed', 0.0005, 0.02, 0.0001 ).onChange( applyControls );
speedFolder.add( params, 'panSpeed', 0.0001, 0.02, 0.0001 ).onChange( applyControls );
speedFolder.add( params, 'zoomSpeed', 0.0001, 0.02, 0.0001 ).onChange( applyControls );

const limitsFolder = gui.addFolder( 'limits' );
limitsFolder.add( params, 'minDistance', 1, 10000, 1 ).onChange( applyControls );
limitsFolder.add( params, 'maxDistance', 100, 200000, 10 ).onChange( applyControls );
limitsFolder.add( params, 'minZoom', 0.001, 1, 0.001 ).onChange( applyControls );
limitsFolder.add( params, 'maxZoom', 1, 2000, 1 ).onChange( applyControls );
limitsFolder.add( params, 'minFov', 1, 60, 1 ).onChange( applyControls );
limitsFolder.add( params, 'maxFov', 60, 170, 1 ).onChange( applyControls );

// Helpers

function mouseLabel( button: number ): string {

	if ( button === 0 ) return 'left-drag';
	if ( button === 1 ) return 'middle-drag';
	return 'right-drag';

}

function getInputBindings() {

	const result = buildInputBindings( params.rotateButton, params.panButton, params.panModifier );

	if ( result.resolvedModifier !== params.panModifier ) {

		params.panModifier = result.resolvedModifier;
		panModifierCtrl.updateDisplay();

	}

	return result.bindings;

}

function applyBindingsText(): void {

	const bindings = controls.inputBindings;
	const rotateText = mouseLabel( bindings.rotate.button );
	const panHasModifier = 'modifier' in bindings.pan;
	const panText = panHasModifier
		? `${ ( bindings.pan as { modifier: string } ).modifier }+${ mouseLabel( bindings.pan.button ) }`
		: mouseLabel( bindings.pan.button );
	bindingsEl.textContent = `rotate: ${ rotateText } | pan: ${ panText } | zoom: mousewheel`;

}

function applyControls(): void {

	controls.enabled = params.enabled;
	controls.enableDamping = params.enableDamping;
	controls.dampingFactor = params.dampingFactor;
	controls.pivot.set( params.pivotX, params.pivotY, params.pivotZ );
	axes.position.copy( controls.pivot );
	controls.inputBindings = getInputBindings();
	controls.rotateSpeed = params.rotateSpeed;
	controls.panSpeed = params.panSpeed;
	controls.zoomSpeed = params.zoomSpeed;
	controls.minDistance = Math.min( params.minDistance, params.maxDistance - 1 );
	controls.maxDistance = Math.max( params.maxDistance, params.minDistance + 1 );
	controls.minZoom = params.minZoom;
	controls.maxZoom = params.maxZoom;
	controls.zoomMode = params.zoomMode;
	controls.minFov = params.minFov;
	controls.maxFov = params.maxFov;
	controls.preventContextMenu = params.preventContextMenu;
	applyBindingsText();

}

function onWindowResize(): void {

	const aspect = window.innerWidth / window.innerHeight;

	if ( camera instanceof THREE.PerspectiveCamera ) {

		camera.aspect = aspect;

	} else if ( camera instanceof THREE.OrthographicCamera ) {

		camera.left = - ORTHO_FRUSTUM * aspect / 2;
		camera.right = ORTHO_FRUSTUM * aspect / 2;
		camera.top = ORTHO_FRUSTUM / 2;
		camera.bottom = - ORTHO_FRUSTUM / 2;

	}

	camera.updateProjectionMatrix();
	renderer.setSize( window.innerWidth, window.innerHeight );

}

function render(): void {

	controls.update( clock.getDelta() );
	renderer.render( scene, camera );

}

window.addEventListener( 'resize', onWindowResize );
applyControls();
