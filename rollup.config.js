import fs from 'fs';
import path from 'path'
import { nodeResolve } from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';

// import { terser } from 'rollup-plugin-terser';

const OUT_DIR = 'dist';

/**
 * Inspired by https://lihautan.com/12-line-rollup-plugin/
 * @param {(string|{ path: string, replace: [string|RegExp, string][]})[]} files 
 * @returns 
 */
const copyFilesPlugin = function(files) {
  return {
    name: 'copy-files',

    load() {
      for (const file of files) {
        const filepath = typeof file === 'string' ? file : file.path;
        if (filepath.startsWith('.')) {
          this.addWatchFile(path.resolve(filepath));
        }
      }
    },

    generateBundle() {
      fs.mkdirSync(OUT_DIR, { recursive: true });
      for (const file of files) {
        // Use the nodejs resolver to get a file path. Yarn PnP will work if
        // rollup is invoked via yarn, e.g. `yarn rollup -c`.
        const filepath = typeof file === 'object' ? file.path : file;
        const src = require.resolve(filepath);
        const srcFilename = path.basename(src);
        const dst = path.join(OUT_DIR, srcFilename);

        if (typeof file === 'object') {
          // Replace strings. Note that replacements are applied serially.
          let content = fs.readFileSync(src, { encoding: 'utf8' });
          for (const [pattern, s] of file.replace) {
            content = content.replaceAll(pattern, s);
          }
          fs.writeFileSync(dst, content);
        } else {
          fs.copyFileSync(src, dst);
        }
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
      './src/client.html',
      './src/icon192.png',
      './src/icon512.png',
      {
        path: './src/manifest.json',
        replace: [['/src', '/video-board/dist']]
      },

      './src/rtc.html'
    ]),
    nodeResolve()
  ]
}, {
  input: 'src/sw.js',
  output: [
    {
      file: `${OUT_DIR}/sw.js`,
      format: "iife",
      sourcemap: true
    },
  ],
  plugins: [
    nodeResolve(),
    replace({
      preventAssignment: true,
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
    })
  ]
}, {
  input: 'src/client-rtc.js',
  output: [
    {
      file: `${OUT_DIR}/client-rtc.js`,
      format: "iife",
      sourcemap: true
    }
  ],
  plugins: [
    nodeResolve()
  ]
}];
