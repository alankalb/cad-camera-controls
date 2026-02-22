export type MouseButton = 0 | 1 | 2;
export type ModifierKey = 'ctrl' | 'meta' | 'alt' | 'shift';

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

export type CADCameraControlsEventMap = {
	change: {};
	start: {};
	end: {};
};
