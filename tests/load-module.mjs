import { buildSync } from 'esbuild';
import { read, root } from './helpers.mjs';
export async function loadModule(entry){const result=buildSync({absWorkingDir:root,entryPoints:[entry],bundle:true,write:false,format:'esm',platform:'node',define:{__APP_VERSION__:JSON.stringify(JSON.parse(read('package.json')).version),__BROWSER_PREVIEW__:'true'}});return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));}
