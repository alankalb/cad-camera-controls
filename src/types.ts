export type MouseButton = 0 | 1 | 2;
export type ModifierKey = 'ctrl' | 'meta' | 'alt' | 'shift';
export type ZoomMode = 'dolly' | 'fov' | 'auto';

// Same button — modifier is REQUIRED to disambiguate
type SameButtonBindings =
	| { rotate: { button: 0 }; pan: { button: 0; modifier: ModifierKey } }
	| { rotate: { button: 1 }; pan: { button: 1; modifier: ModifierKey } }
	| { rotate: { button: 2 }; pan: { button: 2; modifier: ModifierKey } };

// Different buttons — modifier is OPTIONAL
type DifferentButtonBindings =
	| { rotate: { button: 0 }; pan: { button: 1; modifier?: ModifierKey } }
	| { rotate: { button: 0 }; pan: { button: 2; modifier?: ModifierKey } }
	| { rotate: { button: 1 }; pan: { button: 0; modifier?: ModifierKey } }
	| { rotate: { button: 1 }; pan: { button: 2; modifier?: ModifierKey } }
	| { rotate: { button: 2 }; pan: { button: 0; modifier?: ModifierKey } }
	| { rotate: { button: 2 }; pan: { button: 1; modifier?: ModifierKey } };

export type InputBindings = SameButtonBindings | DifferentButtonBindings;

export type TouchBindings = {
	one: 'rotate' | 'pan';
	two: 'rotate' | 'pan';
	pinch: boolean;
};

export type KeyboardKeys = {
	LEFT: string;
	UP: string;
	RIGHT: string;
	BOTTOM: string;
};

// Each keyboard action is active with a modifier, active bare (no modifier), or disabled.
// Runtime validation enforces:
//   • At most one active action can be bare
//   • All active modifiers are unique
//   • At least one action is active
type KeyboardAction = { modifier: ModifierKey } | {} | false;

export type KeyboardBindings = {
	rotate: KeyboardAction;
	pan: KeyboardAction;
	zoom: KeyboardAction;
};

export type CADCameraControlsEventMap = {
	change: {};
	start: {};
	end: {};
};
