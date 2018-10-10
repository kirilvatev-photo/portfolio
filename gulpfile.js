/* jshint node: true, esversion: 6, unused: true */
const path = require('path');
const fs = require('fs-extra');

const gulp = require('gulp');
const sequence = require('gulp-sequence');
const Jimp = require('jimp');
const piexif = require('piexifjs');
const shellton = require('shellton');
const globby = require('globby');
const prettyBytes = require('pretty-bytes');
const prettyMs = require('pretty-ms');
const chalk = require('chalk');
const log = require('fancy-log');
const async = require('async');

const pkg = require('./package.json');
process.title = pkg.name;

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

function optimizeImage(fileBuffer, name) {
  const originalSize = fileBuffer.length;
  const start = Date.now();

  return Jimp.read(fileBuffer)
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
  .then(resultBuffer => {
    return addCopyright(resultBuffer, name);
  })
  .then(resultBuffer => {
    const newSize = resultBuffer.length;
    const end = Date.now();

    log(chalk.gray(`'${chalk.cyan(name)}': ${size(originalSize)} -> ${size(newSize)} (${size(newSize - originalSize, true)}) in ${time(end - start)}`));

    return resultBuffer;
  });
}

gulp.task('clean', () => {
  return fs.remove('tmp');
});

gulp.task('build:images', () => {
  // We can't use gulp here. The vinyl streams like to
  // read files and keep a lot of stuff in memory. Since images
  // can be as high as 20-30MB and there can be tens of them,
  // that's quite a bit of memory. It often resulted in memory or
  // segfault errors on both Windows and Linux. As a bonus, doing
  // it manually is also faster
  const outdir = path.resolve(__dirname, 'tmp/images');

  return fs.ensureDir(outdir)
  .then(() => {
    return globby('images/*.jpg');
  })
  .then(files => {
    return new Promise((resolve, reject) => {
      async.eachLimit(files, 4, (file, next) => {
        const name = path.basename(file);

        shellton({
          task: `gulp build:image:single "--${name}" "--${file}" "--${path.resolve(outdir, name)}"`,
          stdout: 'inherit',
          stderr: 'inherit'
        }, next);
      }, (err) => {
        if (err) {
          return reject(err);
        }

        return resolve();
      });
    });

//    return files.reduce((prom, file) => {
//      const name = path.basename(file);
//
//      return prom.then(() => {
//        return fs.readFile(file)
//        .then(buffer => {
//          return optimizeImage(buffer, name);
//        })
//        .then(result => {
//          return fs.writeFile(path.resolve(__dirname, 'tmp/images', name), result);
//        });
//      });
//    }, Promise.resolve());
  });
});

gulp.task('build:image:single', () => {
  const name = (process.argv[3] || '').slice(2);
  const inpath = (process.argv[4] || '').slice(2);
  const outpath = (process.argv[5] || '').slice(2);

  if (!name) {
    throw new Error('no name was provided');
  }

  if (!inpath) {
    throw new Error('no inpath was provided');
  }

  if (!outpath) {
    throw new Error('no outpath was provided');
  }

  return fs.readFile(inpath)
  .then(buffer => {
    return optimizeImage(buffer, name);
  })
  .then(result => {
    return fs.writeFile(outpath, result);
  });
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
    return fs.remove('tmp/.git');
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
