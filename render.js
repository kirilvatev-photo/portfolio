/* jshint node: true, esversion: 6 */
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const { Module, wrap } = require('module');

const readFile = promisify(fs.readFile);

async function render(file) {
  const text = await readFile(file, 'utf-8');
  const name = path.basename(file);

  const mod = new Module(name);
  mod.filename = file;

  const sandbox = {
    module: mod,
    exports: mod.exports,
    require,
    __filename: '',
    __dirname: ''
  };

  const result = vm.runInThisContext(wrap(text), {
    filename: file
  })(mod.exports, require, mod, '', '');

  console.log(sandbox);
  console.log(result);

  return sandbox.exports;
}

function middleware(req, res, next) {
  let name = req.url.replace(/^\//, '');

  if (name === '') {
    name = 'index';
  }

  const file = path.resolve(__dirname, 'src', name + '.html');

  render(file).then((text) => {
    res.write(text);
  }).catch((e) => {
    console.log('render error:', e);
    next();
  });
}

module.exports = render;
module.exports.middleware = middleware;
