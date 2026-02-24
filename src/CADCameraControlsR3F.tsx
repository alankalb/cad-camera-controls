import { extend, useThree, useFrame, type ThreeElement } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { CADCameraControls } from './CADCameraControls';
import type { InputBindings, TouchBindings, KeyboardKeys, KeyboardBindings, ZoomMode } from './types';

extend({ CADCameraControls });

declare module '@react-three/fiber' {
	interface ThreeElements {
		cadCameraControls: ThreeElement<typeof CADCameraControls>
	}
}

export type CADCameraControlsR3FProps = {
	enabled?: boolean
	enableDamping?: boolean
	dampingFactor?: number
	pivot?: [number, number, number]
	inputBindings?: InputBindings
	touchBindings?: TouchBindings
	rotateSpeed?: number
	panSpeed?: number
	zoomSpeed?: number
	minDistance?: number
	maxDistance?: number
	minZoom?: number
	maxZoom?: number
	zoomMode?: ZoomMode
	minFov?: number
	maxFov?: number
	preventContextMenu?: boolean
	enableKeyboard?: boolean
	keyboardBindings?: KeyboardBindings
	keyPanSpeed?: number
	keyRotateSpeed?: number
	keyZoomSpeed?: number
	keys?: KeyboardKeys
	listenToKeyEvents?: boolean
};

export function CADCameraControlsR3F(props: CADCameraControlsR3FProps) {
	const { camera, gl } = useThree();
	const ref = useRef<CADCameraControls>(null!);

	useEffect(() => {
		ref.current.connect(gl.domElement);
		if (props.listenToKeyEvents !== false) {
			ref.current.listenToKeyEvents(gl.domElement);
		}
		return () => ref.current.dispose();
	}, [gl.domElement, props.listenToKeyEvents]);

	useFrame((_, delta) => ref.current.update(delta));

	return <cadCameraControls ref={ref} args={[camera]} {...props} />;
}
