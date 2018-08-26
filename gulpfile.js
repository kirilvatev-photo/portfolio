/* jshint node: true, esversion: 6 */
const path = require('path');

const gulp = require('gulp');
const imagemin = require('gulp-imagemin');
const sequence = require('gulp-sequence');
const del = require('del');
const mapStream = require('read-vinyl-file-stream');
const Jimp = require('jimp');

function optimizeImages() {
  return mapStream((content, file, stream, cb) => {
    const originalSize = content.length;
    const name = path.basename(file.path);

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

      console.log(`${name}: ${originalSize} -> ${newSize} (${newSize - originalSize})`);

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

gulp.task('build', ['clean'], sequence(
  'build:images'
));
