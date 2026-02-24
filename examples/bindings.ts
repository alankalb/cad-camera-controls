import type { InputBindings, KeyboardBindings, ModifierKey } from '../src/types';

export type ButtonLabel = 'left' | 'middle' | 'right';
export type ModifierLabel = 'none' | 'ctrl' | 'meta' | 'alt' | 'shift';

const buttonValues: Record<ButtonLabel, 0 | 1 | 2> = { left: 0, middle: 1, right: 2 };

export interface BuildResult {
	bindings: InputBindings;
	resolvedModifier: ModifierLabel;
}

export function buildInputBindings(
	rotateButton: ButtonLabel,
	panButton: ButtonLabel,
	panModifier: ModifierLabel,
): BuildResult {
	const rotateBtn = buttonValues[rotateButton];
	const panBtn = buttonValues[panButton];
	const modifier = panModifier === 'none' ? undefined : panModifier as ModifierKey;

	if (rotateBtn === panBtn) {
		const resolved = modifier ?? 'ctrl';
		return {
			bindings: {
				rotate: { button: rotateBtn },
				pan: { button: panBtn, modifier: resolved },
			} as InputBindings,
			resolvedModifier: resolved,
		};
	}

	if (modifier) {
		return {
			bindings: {
				rotate: { button: rotateBtn },
				pan: { button: panBtn, modifier },
			} as InputBindings,
			resolvedModifier: panModifier,
		};
	}

	return {
		bindings: {
			rotate: { button: rotateBtn },
			pan: { button: panBtn },
		} as InputBindings,
		resolvedModifier: 'none',
	};
}

export interface KeyboardBuildResult {
	bindings: KeyboardBindings;
	resolvedRotateModifier: ModifierLabel;
	resolvedPanModifier: ModifierLabel;
	resolvedZoomModifier: ModifierLabel;
}

export function buildKeyboardBindings(
	rotateModifier: ModifierLabel,
	panModifier: ModifierLabel,
	zoomModifier: ModifierLabel,
): KeyboardBuildResult {
	const rotMod = rotateModifier === 'none' ? undefined : rotateModifier as ModifierKey;
	const panMod = panModifier === 'none' ? undefined : panModifier as ModifierKey;
	const zoomMod = zoomModifier === 'none' ? undefined : zoomModifier as ModifierKey;

	// Resolve rotate/pan first
	let resolvedRot = rotMod;
	let resolvedPan = panMod;

	if (! resolvedRot && ! resolvedPan) {
		resolvedRot = 'shift';
	} else if (resolvedRot && resolvedPan && resolvedRot === resolvedPan) {
		resolvedRot = 'shift';
		resolvedPan = 'ctrl';
	}

	// Resolve zoom — must differ from rotate and pan
	let resolvedZoom = zoomMod;
	let bareZoom = false;

	if (resolvedZoom) {
		const used = new Set([resolvedRot, resolvedPan].filter(Boolean));
		if (used.has(resolvedZoom)) {
			const allMods: ModifierKey[] = ['ctrl', 'meta', 'alt', 'shift'];
			resolvedZoom = allMods.find(m => ! used.has(m) && m !== resolvedZoom) ?? allMods.find(m => ! used.has(m))!;
		}
	} else if (zoomModifier === 'none' && resolvedRot && resolvedPan) {
		bareZoom = true;
	}

	// Build bindings — zoom is always present (false when disabled)
	const rotatePart = resolvedRot ? { modifier: resolvedRot } : {};
	const panPart = resolvedPan ? { modifier: resolvedPan } : {};
	const zoomPart = resolvedZoom
		? { modifier: resolvedZoom }
		: bareZoom ? {} : false;

	const bindings: KeyboardBindings = {
		rotate: rotatePart,
		pan: panPart,
		zoom: zoomPart,
	};

	return {
		bindings,
		resolvedRotateModifier: resolvedRot ?? 'none',
		resolvedPanModifier: resolvedPan ?? 'none',
		resolvedZoomModifier: bareZoom ? 'none' : (resolvedZoom ?? 'none'),
	};
}
