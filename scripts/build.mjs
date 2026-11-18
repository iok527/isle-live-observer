import {build} from 'esbuild';
await build({entryPoints:['src/observer-v10.jsx'],bundle:true,minify:true,define:{'process.env.NODE_ENV':'"production"'},outfile:'dist/observer-v10.js',sourcemap:true});
