import fs from 'fs';
import path from 'path'
import { nodeResolve } from '@rollup/plugin-node-resolve';
// import { terser } from 'rollup-plugin-terser';

const OUT_DIR = 'dist';

// Inspired by https://lihautan.com/12-line-rollup-plugin/
const copyFilesPlugin = function(files) {
  function copyFile(id) {
    // Use the nodejs resolver to get a file path. Yarn PnP will work if
    // rollup is invoked via yarn, e.g. `yarn rollup -c`.
    const src = require.resolve(id);
    const srcFilename = path.basename(src);
    const dst = path.join(OUT_DIR, srcFilename);
    try {
      fs.unlinkSync(dst);
    } catch (e) {}
    fs.copyFileSync(src, dst);
  }
  
  return {
    name: 'copy-files',

    load() {
      for (const file of files) {
        if (file.startsWith('.')) {
          this.addWatchFile(path.resolve(file));
        }
      }
    },

    generateBundle() {
      fs.mkdirSync(OUT_DIR, { recursive: true });
      for (const file of files) {
        copyFile(file);
      }
    }
  };
}

export default [{
  input: "src/client-app.js",
  output: [
    {
      file: `${OUT_DIR}/client-app.js`,
      format: "iife",
      sourcemap: true
    },
    // {
    //   file: `${OUT_DIR}/client-app-min.js`,
    //   format: "iife",
    //   plugins: [terser({
    //     ecma: 2020,
    //     toplevel: true
    //   })],
    //   sourcemap: true
    // }
  ],
  plugins: [
    copyFilesPlugin([
      './src/client.html'
    ]),
    nodeResolve()
  ]
}];
