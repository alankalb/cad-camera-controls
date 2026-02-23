import { defineConfig } from 'tsup';

export default defineConfig({
	entry: {
		index: 'src/index.ts',
		react: 'src/react.ts',
	},
	format: ['esm'],
	dts: true,
	clean: true,
	external: ['three', 'react', 'react-dom', '@react-three/fiber'],
});
