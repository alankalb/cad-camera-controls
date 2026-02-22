import * as THREE from 'three';
import GUI from 'lil-gui';
import { CADCameraControls } from '../src/CADCameraControls';
import type { InputBindings } from '../src/types';

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

const grid = new THREE.GridHelper( 4000, 40, 0x444444, 0x222222 );
scene.add( grid );

const axes = new THREE.AxesHelper( 300 );
scene.add( axes );

const cube = new THREE.Mesh(
	new THREE.BoxGeometry( 120, 120, 120 ),
	new THREE.MeshNormalMaterial()
);
scene.add( cube );

// Camera

let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera = createPerspectiveCamera();

function createPerspectiveCamera(): THREE.PerspectiveCamera {

	const cam = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.1, 200000 );
	cam.position.set( 0, 0, 1200 );
	return cam;

}

// Binding presets

const presets: Record<string, InputBindings> = {
	'Right + Ctrl (CAD)': { rotate: { button: 2 }, pan: { button: 2, modifier: 'ctrl' } },
	'Left / Right': { rotate: { button: 0 }, pan: { button: 2 } },
	'Right / Middle': { rotate: { button: 2 }, pan: { button: 1 } },
	'Left + Shift': { rotate: { button: 0 }, pan: { button: 0, modifier: 'shift' } },
};

// Controls

const params = {
	cameraType: 'Perspective' as string,
	enabled: true,
	enableDamping: true,
	dampingFactor: 0.9,
	pivotX: 0,
	pivotY: 0,
	pivotZ: 0,
	bindingPreset: 'Right + Ctrl (CAD)' as string,
	rotateSpeed: 0.005,
	panSpeed: 0.0016,
	zoomSpeed: 0.0012,
	minDistance: 50,
	maxDistance: 100000,
	preventContextMenu: true,
};

let controls = new CADCameraControls( camera, renderer.domElement );

function switchCamera(): void {

	controls.dispose();

	if ( params.cameraType === 'Perspective' ) {

		camera = createPerspectiveCamera();

	}

	controls = new CADCameraControls( camera, renderer.domElement );
	applyControls();

}

// GUI

const gui = new GUI();

gui.add( params, 'cameraType', [ 'Perspective' ] ).name( 'camera' ).onChange( switchCamera );
gui.add( params, 'enabled' ).onChange( applyControls );
gui.add( params, 'enableDamping' ).onChange( applyControls );
gui.add( params, 'dampingFactor', 0.7, 0.99, 0.001 ).onChange( applyControls );

const pivotFolder = gui.addFolder( 'pivot' );
pivotFolder.add( params, 'pivotX', - 1000, 1000, 1 ).onChange( applyControls );
pivotFolder.add( params, 'pivotY', - 1000, 1000, 1 ).onChange( applyControls );
pivotFolder.add( params, 'pivotZ', - 1000, 1000, 1 ).onChange( applyControls );
pivotFolder.open();

const inputFolder = gui.addFolder( 'input' );
inputFolder.add( params, 'bindingPreset', Object.keys( presets ) ).name( 'bindings' ).onChange( applyControls );
inputFolder.add( params, 'preventContextMenu' ).onChange( applyControls );

const speedFolder = gui.addFolder( 'speed' );
speedFolder.add( params, 'rotateSpeed', 0.0005, 0.02, 0.0001 ).onChange( applyControls );
speedFolder.add( params, 'panSpeed', 0.0001, 0.02, 0.0001 ).onChange( applyControls );
speedFolder.add( params, 'zoomSpeed', 0.0001, 0.02, 0.0001 ).onChange( applyControls );

const limitsFolder = gui.addFolder( 'distance limits' );
limitsFolder.add( params, 'minDistance', 1, 10000, 1 ).onChange( applyControls );
limitsFolder.add( params, 'maxDistance', 100, 200000, 10 ).onChange( applyControls );

// Helpers

function mouseLabel( button: number ): string {

	if ( button === 0 ) return 'left-drag';
	if ( button === 1 ) return 'middle-drag';
	return 'right-drag';

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
	controls.inputBindings = presets[ params.bindingPreset ];
	controls.rotateSpeed = params.rotateSpeed;
	controls.panSpeed = params.panSpeed;
	controls.zoomSpeed = params.zoomSpeed;
	controls.minDistance = Math.min( params.minDistance, params.maxDistance - 1 );
	controls.maxDistance = Math.max( params.maxDistance, params.minDistance + 1 );
	controls.preventContextMenu = params.preventContextMenu;
	applyBindingsText();

}

function onWindowResize(): void {

	if ( camera instanceof THREE.PerspectiveCamera ) {

		camera.aspect = window.innerWidth / window.innerHeight;

	}

	camera.updateProjectionMatrix();
	renderer.setSize( window.innerWidth, window.innerHeight );

}

function render(): void {

	controls.update( clock.getDelta() );
	renderer.render( scene, camera );

}

window.addEventListener( 'resize', onWindowResize );
applyBindingsText();
