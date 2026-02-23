import { describe, it, expect } from 'vitest';
import { buildInputBindings } from '../examples/bindings';

describe('buildInputBindings', () => {
	it('left rotate / right pan with no modifier', () => {
		const { bindings, resolvedModifier } = buildInputBindings('left', 'right', 'none');
		expect(bindings.rotate.button).toBe(0);
		expect(bindings.pan.button).toBe(2);
		expect('modifier' in bindings.pan).toBe(false);
		expect(resolvedModifier).toBe('none');
	});

	it('right rotate / middle pan with no modifier', () => {
		const { bindings, resolvedModifier } = buildInputBindings('right', 'middle', 'none');
		expect(bindings.rotate.button).toBe(2);
		expect(bindings.pan.button).toBe(1);
		expect('modifier' in bindings.pan).toBe(false);
		expect(resolvedModifier).toBe('none');
	});

	it('left rotate / right pan with ctrl modifier', () => {
		const { bindings, resolvedModifier } = buildInputBindings('left', 'right', 'ctrl');
		expect(bindings.rotate.button).toBe(0);
		expect(bindings.pan.button).toBe(2);
		expect((bindings.pan as { modifier: string }).modifier).toBe('ctrl');
		expect(resolvedModifier).toBe('ctrl');
	});

	it('middle rotate / left pan with shift modifier', () => {
		const { bindings, resolvedModifier } = buildInputBindings('middle', 'left', 'shift');
		expect(bindings.rotate.button).toBe(1);
		expect(bindings.pan.button).toBe(0);
		expect((bindings.pan as { modifier: string }).modifier).toBe('shift');
		expect(resolvedModifier).toBe('shift');
	});

	it('both left with ctrl modifier', () => {
		const { bindings, resolvedModifier } = buildInputBindings('left', 'left', 'ctrl');
		expect(bindings.rotate.button).toBe(0);
		expect(bindings.pan.button).toBe(0);
		expect((bindings.pan as { modifier: string }).modifier).toBe('ctrl');
		expect(resolvedModifier).toBe('ctrl');
	});

	it('both right with alt modifier', () => {
		const { bindings, resolvedModifier } = buildInputBindings('right', 'right', 'alt');
		expect(bindings.rotate.button).toBe(2);
		expect(bindings.pan.button).toBe(2);
		expect((bindings.pan as { modifier: string }).modifier).toBe('alt');
		expect(resolvedModifier).toBe('alt');
	});

	it('both left with none falls back to ctrl', () => {
		const { bindings, resolvedModifier } = buildInputBindings('left', 'left', 'none');
		expect(bindings.rotate.button).toBe(0);
		expect(bindings.pan.button).toBe(0);
		expect((bindings.pan as { modifier: string }).modifier).toBe('ctrl');
		expect(resolvedModifier).toBe('ctrl');
	});

	it('both middle with none falls back to ctrl', () => {
		const { bindings, resolvedModifier } = buildInputBindings('middle', 'middle', 'none');
		expect(bindings.rotate.button).toBe(1);
		expect(bindings.pan.button).toBe(1);
		expect((bindings.pan as { modifier: string }).modifier).toBe('ctrl');
		expect(resolvedModifier).toBe('ctrl');
	});

	it('both right with none falls back to ctrl', () => {
		const { bindings, resolvedModifier } = buildInputBindings('right', 'right', 'none');
		expect(bindings.rotate.button).toBe(2);
		expect(bindings.pan.button).toBe(2);
		expect((bindings.pan as { modifier: string }).modifier).toBe('ctrl');
		expect(resolvedModifier).toBe('ctrl');
	});

	it('meta modifier on different buttons', () => {
		const { bindings, resolvedModifier } = buildInputBindings('left', 'middle', 'meta');
		expect((bindings.pan as { modifier: string }).modifier).toBe('meta');
		expect(resolvedModifier).toBe('meta');
	});

	it('alt modifier on different buttons', () => {
		const { bindings, resolvedModifier } = buildInputBindings('left', 'middle', 'alt');
		expect((bindings.pan as { modifier: string }).modifier).toBe('alt');
		expect(resolvedModifier).toBe('alt');
	});

	it('shift modifier on different buttons', () => {
		const { bindings, resolvedModifier } = buildInputBindings('left', 'middle', 'shift');
		expect((bindings.pan as { modifier: string }).modifier).toBe('shift');
		expect(resolvedModifier).toBe('shift');
	});
});
