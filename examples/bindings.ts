import type { InputBindings, ModifierKey } from '../src/types';

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
