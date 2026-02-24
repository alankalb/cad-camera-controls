# cad-camera-controls

CAD-style camera controls for Three.js and React Three Fiber.

All interaction orbits around a fixed pivot point — pan moves the camera without shifting the pivot, and zoom targets the cursor position. This is a similar navigation model in tools like SolidWorks, Fusion 360, Onshape, and Blender.

- Fixed-pivot orbit, modifier-key pan, cursor-anchored zoom
- Perspective and orthographic camera support
- Dolly, FOV, and auto zoom modes
- Inertial damping
- Configurable mouse, touch, and keyboard bindings
- React Three Fiber wrapper included

[Live Demo](https://alankalb.github.io/cad-camera-controls/)

## Installation

### Vanilla Three.js

```bash
npm install cad-camera-controls three
```

```ts
import { CADCameraControls } from 'cad-camera-controls';
```

### React Three Fiber

```bash
npm install cad-camera-controls three react react-dom @react-three/fiber
```

```ts
import { CADCameraControls } from 'cad-camera-controls/react';
```

React, react-dom, and @react-three/fiber are optional peer dependencies — vanilla JS users don't need them.

## Quick Start — Vanilla Three.js

```ts
import * as THREE from 'three';
import { CADCameraControls } from 'cad-camera-controls';

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 10000);
camera.position.set(0, 500, 1000);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const controls = new CADCameraControls(camera, renderer.domElement);
controls.listenToKeyEvents(document.body);

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  controls.update(clock.getDelta());
  renderer.render(scene, camera);
}

animate();
```

## Quick Start — React Three Fiber

```tsx
import { Canvas } from '@react-three/fiber';
import { CADCameraControls } from 'cad-camera-controls/react';

function App() {
  return (
    <Canvas camera={{ position: [0, 500, 1000], fov: 50 }}>
      <CADCameraControls />
      <mesh>
        <boxGeometry />
        <meshNormalMaterial />
      </mesh>
    </Canvas>
  );
}
```

## Orthographic Cameras

Both `PerspectiveCamera` and `OrthographicCamera` are supported. With an orthographic camera, scroll/pinch adjusts `camera.zoom` (clamped by `minZoom`/`maxZoom`). The `zoomMode`, `minDistance`, `maxDistance`, `minFov`, and `maxFov` properties only apply to perspective cameras.

```ts
const camera = new THREE.OrthographicCamera(-500, 500, 500, -500, 0.1, 10000);
const controls = new CADCameraControls(camera, renderer.domElement);
controls.minZoom = 0.1;
controls.maxZoom = 50;
```

## API

### Constructor

#### `new CADCameraControls( camera : PerspectiveCamera | OrthographicCamera, domElement? : HTMLElement )`

**camera** — The camera to control.

**domElement** — The DOM element for event listeners. If provided, `connect()` is called automatically.

---

### Properties

#### `.enabled` : `boolean`

Enable or disable all interaction. Default is `true`.

#### `.enableDamping` : `boolean`

Smooth inertial deceleration after releasing a drag or scroll. When enabled, you must call `.update()` in your animation loop. Default is `true`.

#### `.dampingFactor` : `number`

Damping friction in the range `(0, 1)`. Higher values stop the camera faster. Each frame, velocity is multiplied by `(1 - dampingFactor)`. Same convention as `OrbitControls`. Default is `0.05`.

#### `.pivot` : `Vector3`

Fixed orbit center. Rotation orbits around this point. Pan moves the camera without changing the pivot. Default is `(0, 0, 0)`.

#### `.inputBindings` : `InputBindings`

Mouse button and modifier key mapping. Button values: `0` = left, `1` = middle, `2` = right. An optional `modifier` (`'ctrl'`, `'meta'`, `'alt'`, `'shift'`) disambiguates when both actions share the same button.

Default is `{ rotate: { button: 0 }, pan: { button: 2 } }` (left-click to rotate, right-click to pan).

```ts
// Middle-click to pan
controls.inputBindings = { rotate: { button: 0 }, pan: { button: 1 } };

// Same button with modifier: shift+left to pan, left to rotate
controls.inputBindings = { rotate: { button: 0 }, pan: { button: 0, modifier: 'shift' } };
```

#### `.touchBindings` : `TouchBindings`

Touch gesture mapping. `one` and `two` control one-finger and two-finger drag. `pinch` enables pinch-to-zoom.

Default is `{ one: 'rotate', two: 'pan', pinch: true }`.

#### `.rotateSpeed` : `number`

Orbit rotation sensitivity in radians per pixel of mouse/touch drag. With damping enabled, releasing the drag produces a smooth inertial tail that decays by `dampingFactor` per frame. Default is `0.005`.

#### `.panSpeed` : `number`

Pan sensitivity in world-units per pixel per unit-distance from the pivot. The actual pan per pixel of drag is `panSpeed × distance-to-pivot`. With damping enabled, releasing the drag produces a smooth inertial tail. Default is `0.0016`.

#### `.zoomSpeed` : `number`

Scroll and pinch zoom speed (exponent multiplier). Zoom per scroll tick is `Math.pow(0.95, zoomSpeed)`. Uses the same convention and default as OrbitControls. With damping enabled, the per-tick exponent is internally scaled so the total zoom (including the inertial tail) matches the formula. Default is `1`.

#### `.zoomMode` : `'dolly' | 'fov' | 'auto'`

Zoom strategy for perspective cameras. Has no effect on orthographic cameras. Default is `'dolly'`.

- **`'dolly'`** — Moves the camera toward or away from the pivot. Clamped by `minDistance` / `maxDistance`.
- **`'fov'`** — Narrows or widens the field of view, keeping the camera stationary. Clamped by `minFov` / `maxFov`.
- **`'auto'`** — Dolly until the camera reaches `minDistance`, then seamlessly switches to FOV narrowing. Zooming back out reverses: FOV widens to its original value first, then dolly resumes.

```ts
controls.zoomMode = 'auto';
```

#### `.minDistance` : `number`

Minimum camera distance from the pivot in world units. Perspective cameras only. Default is `50`.

#### `.maxDistance` : `number`

Maximum camera distance from the pivot in world units. Perspective cameras only. Default is `100000`.

#### `.minZoom` : `number`

Minimum `camera.zoom` value. Orthographic cameras only. Default is `0.01`.

#### `.maxZoom` : `number`

Maximum `camera.zoom` value. Orthographic cameras only. Default is `1000`.

#### `.minFov` : `number`

Minimum field of view in degrees. Used by `'fov'` and `'auto'` zoom modes. Default is `1`.

#### `.maxFov` : `number`

Maximum field of view in degrees. Used by `'fov'` and `'auto'` zoom modes. Default is `120`.

#### `.preventContextMenu` : `boolean`

Suppress the browser right-click context menu on the DOM element. Default is `true`.

#### `.enableKeyboard` : `boolean`

Enable or disable keyboard controls. Keyboard listeners must be attached separately with `.listenToKeyEvents()`. Default is `true`.

#### `.keyboardBindings` : `KeyboardBindings`

Keyboard action mapping. Each of `rotate`, `pan`, and `zoom` is either `{ modifier: ModifierKey }` (active with modifier), `{}` (active bare — no modifier), or `false` (disabled). At most one action can be bare, all active modifiers must be unique, and at least one action must be active. These constraints are validated at runtime.

Default is `{ rotate: { modifier: 'shift' }, pan: {}, zoom: false }` (shift+arrows to rotate, bare arrows to pan, zoom disabled).

```ts
// Bare arrows rotate, ctrl+arrows pan, zoom disabled
controls.keyboardBindings = { rotate: {}, pan: { modifier: 'ctrl' }, zoom: false };

// All three with modifiers
controls.keyboardBindings = { rotate: { modifier: 'shift' }, pan: { modifier: 'ctrl' }, zoom: { modifier: 'alt' } };

// Bare UP/DOWN to zoom (only valid when both rotate and pan have modifiers)
controls.keyboardBindings = { rotate: { modifier: 'ctrl' }, pan: { modifier: 'shift' }, zoom: {} };
```

#### `.keyPanSpeed` : `number`

Screen pixels of simulated mouse drag per arrow key press for panning. The actual world-space movement depends on `panSpeed` and camera distance from the pivot. With damping enabled, each keypress produces a smooth ease-in/ease-out motion. Default is `7`.

#### `.keyRotateSpeed` : `number`

Rotation speed for arrow key rotation. The rotation angle per keypress is `2π × keyRotateSpeed / domElement.clientHeight` radians. With damping enabled, each keypress produces a smooth ease-in/ease-out motion. Default is `1`.

#### `.keyZoomSpeed` : `number`

Zoom speed for keyboard zoom (UP/DOWN). Uses the same formula as scroll zoom: `Math.pow(0.95, keyZoomSpeed)` per keypress. With damping enabled, each keypress produces a smooth ease-in/ease-out motion. Only applies when `keyboardBindings.zoom` is not `false`. Default is `1`.

#### `.keys` : `KeyboardKeys`

Key code mapping for arrow controls. Default is `{ LEFT: 'ArrowLeft', UP: 'ArrowUp', RIGHT: 'ArrowRight', BOTTOM: 'ArrowDown' }`.

```ts
// Remap to WASD
controls.keys = { LEFT: 'KeyA', UP: 'KeyW', RIGHT: 'KeyD', BOTTOM: 'KeyS' };
```

---

### Methods

#### `.connect( domElement? : HTMLElement ) : void`

Attach event listeners. If a different element was previously connected, it is disconnected first.

#### `.disconnect() : void`

Remove all event listeners from the current DOM element.

#### `.dispose() : void`

Disconnect and release all resources.

#### `.update( deltaSeconds? : number ) : boolean`

Advance damping and apply camera transforms. Required every frame when `enableDamping` is true. Returns `true` if the camera moved.

**deltaSeconds** — Time since last frame in seconds. Default is `1/60`.

#### `.resetBaseFov() : void`

Recapture the camera's current FOV as the base for `'auto'` zoom mode. Call this after changing `camera.fov` programmatically.

#### `.listenToKeyEvents( domElement : HTMLElement ) : void`

Attach keyboard listeners to the given DOM element. Which modifier triggers rotate vs. pan is controlled by `.keyboardBindings`.

```ts
controls.listenToKeyEvents(document.body);
```

#### `.stopListenToKeyEvents() : void`

Remove keyboard listeners. Called automatically by `.dispose()`.

---

### Events

#### `change`

Fired when the camera position or orientation changes.

#### `start`

Fired when the user begins a drag interaction.

#### `end`

Fired when the user ends a drag interaction.

```ts
controls.addEventListener('change', () => {
  renderer.render(scene, camera);
});
```

## Contributing

```bash
git clone https://github.com/alankalb/cad-camera-controls.git
cd cad-camera-controls
npm install
```

| Command | Description |
|---|---|
| `npm test` | Run tests |
| `npm run lint` | Lint with ESLint |
| `npm run lint:fix` | Lint and auto-fix |
| `npm run typecheck` | TypeScript type check |
| `npm run build` | Build with tsup |
| `npm run dev:example` | Start the example playground |

CI runs lint, typecheck, test, and build on every pull request. PRs welcome.

## License

[MIT](LICENSE)
