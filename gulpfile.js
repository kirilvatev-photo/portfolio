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

function size(bytes, useColor = false) {
  const color = !useColor ? (v) => v :
    bytes < 0 ? chalk.green : chalk.red;

  return color(prettyBytes(bytes));
}

function time(ms) {
  return chalk.magenta(prettyMs(ms));
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

function addCopyright() {
  return mapStream((content, file, stream, cb) => {
    const name = path.basename(file.path);
    const start = Date.now();

    let data;

    try {
      const zeroth = {};
      const exif = {};

      zeroth[piexif.ImageIFD.Copyright] = 'Kiril Vatev';

      const exifStr = piexif.dump({
        '0th': zeroth, 'Exif': exif
      });

      let dataStr = piexif.insert(exifStr, content.toString('binary'));

      data = Buffer.from(dataStr, 'binary');
    } catch (e) {
      console.log('copyright error:', e);
      process.exitCode = 1;
    }

    let end = Date.now();

    if (data) {
      log(`'${name}': added copyright ${time(end - start)}`);
      cb(null, data);
    } else {
      cb(null, content);
    }
  }, 'buffer');
}

gulp.task('clean', () => {
  return del(['tmp']);
});

gulp.task('build:images', () => {
  return gulp.src('images/*.jpg')
    .pipe(optimizeImages())
    .pipe(addCopyright())
    .pipe(gulp.dest('tmp/images'));
});

gulp.task('build:files', () => {
  return gulp.src(['index.html', '404.html'])
    .pipe(gulp.dest('tmp'));
});

gulp.task('build', ['clean'], sequence(
  'build:files',
  'build:images'
));
