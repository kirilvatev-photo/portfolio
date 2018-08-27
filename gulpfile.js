/* jshint node: true, esversion: 6 */
const path = require('path');

const gulp = require('gulp');
const imagemin = require('gulp-imagemin');
const sequence = require('gulp-sequence');
const del = require('del');
const mapStream = require('read-vinyl-file-stream');
const Jimp = require('jimp');
const prettyBytes = require('pretty-bytes');
const prettyMs = require('pretty-ms');
const chalk = require('chalk');
const log = require('fancy-log');
const piexif = require('piexifjs');
const shellton = require('shellton');

const copyright = 'Kiril Vatev';
const repo = 'https://github.com/kirilvatev-photo/portfolio.git';

function size(bytes, useColor = false) {
  const color = !useColor ? (v) => v :
    bytes < 0 ? chalk.green : chalk.red;

  return color(prettyBytes(bytes));
}

function time(ms) {
  return chalk.magenta(prettyMs(ms));
}

function addCopyright(buffer, name) {
  const start = Date.now();

  let data;

  try {
    const zeroth = {};
    const exif = {};

    zeroth[piexif.ImageIFD.Copyright] = copyright;

    const exifStr = piexif.dump({
      '0th': zeroth, 'Exif': exif
    });

    let dataStr = piexif.insert(exifStr, buffer.toString('binary'));

    data = Buffer.from(dataStr, 'binary');
  } catch (e) {
    // fail the build, but let the process continue
    // dealing with the rest of the images
    log.error('copyright error:', e);
    process.exitCode = 1;
  }

  let end = Date.now();

  if (data) {
    log(chalk.grey(`'${chalk.cyan(name)}': added copyright ${time(end - start)}`));

    return data;
  }

  return buffer;
}

function optimizeImages() {
  return mapStream((content, file, stream, cb) => {
    const originalSize = content.length;
    const name = path.basename(file.path);
    const start = Date.now();

    Jimp.read(content)
    .then(img => {
      const targetSize = 2500;
      const { width, height } = img.bitmap;

      if (width > height && width > targetSize) {
        img.resize(targetSize, Jimp.AUTO);
      } else if (height > targetSize) {
        img.resize(Jimp.AUTO, targetSize);
      }

      img.quality(85);

      return img;
    })
    .then(img => {
      return img.getBufferAsync(Jimp.MIME_JPEG);
    })
    .then(buffer => {
      return addCopyright(buffer, name);
    })
    .then(buffer => {
      const newSize = buffer.length;
      const end = Date.now();

      log(chalk.gray(`'${chalk.cyan(name)}': ${size(originalSize)} -> ${size(newSize)} (${size(newSize - originalSize, true)}) in ${time(end - start)}`));

      cb(null, buffer);
    })
    .catch(err => {
      cb(err);
    });
  }, 'buffer');
}

gulp.task('clean', () => {
  return del(['tmp']);
});

gulp.task('build:images', () => {
  return gulp.src('images/*.jpg')
    .pipe(optimizeImages())
    .pipe(gulp.dest('tmp/images'));
});

gulp.task('build:files', () => {
  return gulp.src(['public/**/*'])
    .pipe(gulp.dest('tmp'));
});

gulp.task('build', ['clean'], sequence(
  'build:files',
  'build:images'
));

gulp.task('publish', () => {
  function exec(line) {
    console.log(chalk.green(line));
    return new Promise((resolve, reject) => {
      shellton({
        task: line,
        cwd: path.resolve(__dirname, 'tmp'),
        stdin: 'inherit',
        stdout: 'inherit',
        stderr: 'inherit'
      }, (err) => err ? reject(err) : resolve());
    });
  }

  function clean() {
    return del('tmp/.git');
  }

  // using an https repo means that it will ask for
  // a username and password when publishing... so that's fun
  const script = `
git init
git config user.name "${copyright}"
git config user.email "contact@kirilvatev.com"
git add .
git commit -m "automatic publishing"
git remote add origin ${repo}
git push --force -u origin master:gh-pages
`.trim();

  return script.split('\n').map(v => v.trim()).reduce((prom, line) => {
    return prom.then(() => exec(line));
  }, clean()).then(() => clean());
});
