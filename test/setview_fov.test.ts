import { describe, it, expect } from 'vitest';
import { createControls, dispatchWheel } from './helpers';

describe('setView FOV restore with auto zoom', () => {
	it('restores far view with damping enabled', () => {
		const { controls, camera, element } = createControls({
			zoomMode: 'auto',
			enableDamping: true,
			dampingFactor: 0.2,
			minDistance: 100,
			maxDistance: 100000,
			autoFovAnchorScale: 1,
		});

		// Save the default far view
		const savedPos = camera.position.clone();
		const savedQuat = camera.quaternion.clone();
		const savedFov = camera.fov; // 50

		// Zoom in with damping — alternate between wheel events and updates
		for (let i = 0; i < 300; i++) {
			dispatchWheel(element, -200);
			controls.update(1 / 60);
		}
		// Let damping settle
		for (let i = 0; i < 300; i++) {
			controls.update(1 / 60);
		}

		const distAfter = camera.position.distanceTo(controls.pivot);
		const fovAfter = camera.fov;
		console.log('After damped zoom in - fov:', fovAfter.toFixed(2), 'dist:', distAfter.toFixed(1));

		// Restore saved view with transition
		controls.setView(savedPos, savedQuat, true, { fov: savedFov, zoom: 1 });

		// Pump updates: transition is 0.5s
		for (let i = 0; i < 60; i++) {
			controls.update(1 / 60);
		}
		// Extra updates for any damping after transition
		for (let i = 0; i < 60; i++) {
			controls.update(1 / 60);
		}

		console.log('After restore - fov:', camera.fov.toFixed(2), 'dist:', camera.position.distanceTo(controls.pivot).toFixed(1));

		expect(camera.fov).toBeCloseTo(savedFov, 0);
		expect(camera.position.z).toBeCloseTo(savedPos.z, -1);

		controls.dispose();
	});

	it('restores zoomed-in view with damping from far away', () => {
		const { controls, camera, element } = createControls({
			zoomMode: 'auto',
			enableDamping: true,
			dampingFactor: 0.2,
			minDistance: 100,
			maxDistance: 100000,
			autoFovAnchorScale: 1,
		});

		// Zoom in past minDistance to narrow FOV
		for (let i = 0; i < 300; i++) {
			dispatchWheel(element, -200);
			controls.update(1 / 60);
		}
		for (let i = 0; i < 300; i++) {
			controls.update(1 / 60);
		}

		// Save the zoomed-in view
		const savedPos = camera.position.clone();
		const savedQuat = camera.quaternion.clone();
		const savedFov = camera.fov;
		console.log('Saved zoomed-in view - fov:', savedFov.toFixed(2),
			'dist:', camera.position.distanceTo(controls.pivot).toFixed(1));
		expect(savedFov).toBeLessThan(50);

		// Zoom back out
		for (let i = 0; i < 300; i++) {
			dispatchWheel(element, 200);
			controls.update(1 / 60);
		}
		for (let i = 0; i < 300; i++) {
			controls.update(1 / 60);
		}

		console.log('After zoom out - fov:', camera.fov.toFixed(2),
			'dist:', camera.position.distanceTo(controls.pivot).toFixed(1));

		// Restore zoomed-in view
		controls.setView(savedPos, savedQuat, true, { fov: savedFov, zoom: 1 });

		for (let i = 0; i < 120; i++) {
			controls.update(1 / 60);
		}

		console.log('After restore - fov:', camera.fov.toFixed(2),
			'dist:', camera.position.distanceTo(controls.pivot).toFixed(1));

		expect(camera.fov).toBeCloseTo(savedFov, 0);
		expect(camera.position.distanceTo(savedPos)).toBeLessThan(5);

		controls.dispose();
	});
});
