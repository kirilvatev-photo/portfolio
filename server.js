/* jshint node: true, esversion: 6 */
const path = require('path');
const fs = require('fs');

const express = require('express');
const app = express();

const pkg = require('./package.json');
process.title = pkg.name;

app.use((req, res, next) => {
  console.log(req.method, req.url);
  next();
});

app.use(express.static('public', {
  extensions: ['html']
}));
app.use('/images', express.static('images'));

app.get('*', (req, res) => {
  // handle as 404

  res.writeHead(404);
  fs.createReadStream('public/404.html')
    .pipe(res);
});

app.listen(3000, () => console.log('Listening on port 3000'));
