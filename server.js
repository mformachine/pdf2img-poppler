const express = require('express');
const multer = require('multer');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const upload = multer({ dest: '/tmp/' });
const MEDIA_DIR = path.join(__dirname, 'media');

// Ensure media directory exists
if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR);
}

app.get('/', (_req, res) => {
  res.send('Welcome to docker-poppler-node');
});

app.post('/pdftocairo', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.json({ success: false, message: 'file is required.' });
  }

  const outId = crypto.randomUUID();
  const outDir = path.join(MEDIA_DIR, outId);
  fs.mkdirSync(outDir);

  execFileSync('pdftocairo', ['-png', req.file.path, path.join(outDir, 'output')]);
  fs.unlinkSync(req.file.path);

  const images = fs.readdirSync(outDir).map(name => `/media/${outId}/${name}`);
  res.json({ images });
});

app.post('/pdftoppm', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.json({ success: false, message: 'file is required.' });
  }

  const outId = crypto.randomUUID();
  const outDir = path.join(MEDIA_DIR, outId);
  fs.mkdirSync(outDir);

  execFileSync('pdftoppm', ['-png', req.file.path, path.join(outDir, 'output')]);
  fs.unlinkSync(req.file.path);

  const images = fs.readdirSync(outDir).map(name => `/media/${outId}/${name}`);
  res.json({ images });
});

app.post('/pdftohtml', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.json({ success: false, message: 'file is required.' });
  }

  const output = execFileSync('pdftohtml', ['-s', '-dataurls', '-noframes', '-stdout', req.file.path]);
  fs.unlinkSync(req.file.path);

  res.set('Content-Type', 'text/html');
  res.send(output);
});

app.post('/pdfinfo', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.json({ success: false, message: 'file is required.' });
  }

  const output = execFileSync('pdfinfo', [req.file.path]);
  fs.unlinkSync(req.file.path);

  res.set('Content-Type', 'text/plain');
  res.send(output);
});

app.post('/pdftotext', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.json({ success: false, message: 'file is required.' });
  }

  const output = execFileSync('pdftotext', [req.file.path, '-']);
  fs.unlinkSync(req.file.path);

  res.set('Content-Type', 'text/plain');
  res.send(output);
});

app.use('/media', express.static(MEDIA_DIR));

app.listen(5000, () => {
  console.log('PDF service (Poppler) running on port 5000');
});
