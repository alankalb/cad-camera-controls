import { defineConfig } from 'eslint/config';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';

export default defineConfig(
	{
		ignores: ['node_modules', 'dist', 'build', 'examples/node_modules', 'examples/dist'],
	},
	eslint.configs.recommended,
	tseslint.configs.recommended,
	{
		files: ['src/**/*.ts', 'src/**/*.tsx', 'test/**/*.ts', 'examples/**/*.ts'],
		plugins: {
			'@stylistic': stylistic,
		},
		rules: {
			'@stylistic/indent': ['error', 'tab'],
			'@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
			'@stylistic/semi': ['error', 'always'],
			'@stylistic/no-trailing-spaces': 'error',
			'@stylistic/eol-last': ['error', 'always'],
			'@stylistic/no-multiple-empty-lines': ['error', { max: 1 }],
			'@stylistic/space-in-parens': ['error', 'never'],
			'@stylistic/array-bracket-spacing': ['error', 'never'],
			'@stylistic/object-curly-spacing': ['error', 'always'],
			'@stylistic/computed-property-spacing': ['error', 'never'],
			'@stylistic/space-before-blocks': ['error', 'always'],
			'@stylistic/keyword-spacing': ['error', { before: true, after: true }],
			'@stylistic/space-infix-ops': 'error',
			'@stylistic/comma-spacing': ['error', { before: false, after: true }],
			'@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: false }],
			'@stylistic/padded-blocks': ['error', 'never'],
			'@stylistic/space-before-function-paren': ['error', { anonymous: 'always', named: 'never', asyncArrow: 'always' }],
			'@typescript-eslint/no-empty-object-type': ['error', { allowObjectTypes: 'always' }],
			'eqeqeq': 'error',
			'prefer-const': ['error', { destructuring: 'all' }],
			'no-var': 'error',
		},
	},
);
