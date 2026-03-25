const express = require('express');
const multer = require('multer');
const { execFile } = require('child_process');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const util = require('util');

const execFileAsync = util.promisify(execFile);

const app = express();
const PORT = process.env.PORT || 5000;
const MEDIA_DIR = path.join(__dirname, 'media');
const TMP_DIR = process.env.TMP_DIR || '/tmp';
const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB || 50);

const upload = multer({
  dest: TMP_DIR,
  limits: {
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
  },
});

fs.mkdirSync(MEDIA_DIR, { recursive: true });

app.get('/', (_req, res) => {
  res.send('Welcome to chanmo/poppler');
});

app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});

function missingFile(res) {
  return res.json({
    success: false,
    message: 'file is required.',
  });
}

function normalizeFormat(value) {
  const format = String(value || 'png').toLowerCase();

  if (format === 'jpg') return 'jpeg';
  if (format === 'png' || format === 'jpeg') return format;

  throw new Error('format must be one of: png, jpeg, jpg');
}

function parseDpi(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const dpi = Number.parseInt(String(value), 10);

  if (!Number.isInteger(dpi) || dpi <= 0) {
    throw new Error('dpi must be a positive integer');
  }

  return dpi;
}

function getExtension(format) {
  return format === 'jpeg' ? '.jpg' : '.png';
}

async function removeFileQuietly(filePath) {
  if (!filePath) return;
  try {
    await fsp.unlink(filePath);
  } catch {}
}

async function removeDirQuietly(dirPath) {
  if (!dirPath) return;
  try {
    await fsp.rm(dirPath, { recursive: true, force: true });
  } catch {}
}

function commandError(command, err) {
  const stderr = err?.stderr
    ? Buffer.isBuffer(err.stderr)
      ? err.stderr.toString('utf8')
      : String(err.stderr)
    : '';

  return {
    success: false,
    message: stderr.trim() || err.message || `${command} failed`,
  };
}

async function runCommand(command, args, options = {}) {
  return execFileAsync(command, args, {
    encoding: 'buffer',
    maxBuffer: 100 * 1024 * 1024,
    ...options,
  });
}

function buildImageResponse(outId, files) {
  return {
    images: files.map((name) => `/media/${outId}/${name}`),
  };
}

async function runImageCommand(command, req, res, options = {}) {
  if (!req.file) return missingFile(res);

  let format;
  let dpi;

  try {
    format = normalizeFormat(req.body?.format);
    dpi = parseDpi(req.body?.dpi);
  } catch (err) {
    await removeFileQuietly(req.file.path);
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  const outId = crypto.randomUUID();
  const outDir = path.join(MEDIA_DIR, outId);
  const args = [];

  if (dpi) {
    args.push('-r', String(dpi));
  }

  if (command === 'pdftocairo') {
    args.push(format === 'jpeg' ? '-jpeg' : '-png');
    args.push(req.file.path, path.join(outDir, 'output'));
  } else if (command === 'pdftoppm') {
    args.push(format === 'jpeg' ? '-jpeg' : '-png');
    args.push(req.file.path, 'output');
  } else {
    await removeFileQuietly(req.file.path);
    return res.status(500).json({
      success: false,
      message: 'invalid image command',
    });
  }

  try {
    await fsp.mkdir(outDir, { recursive: false });

    if (command === 'pdftoppm') {
      await runCommand(command, args, { cwd: outDir, ...options });
    } else {
      await runCommand(command, args, options);
    }

    const expectedExt = getExtension(format);
    const files = (await fsp.readdir(outDir))
      .filter((name) => name.toLowerCase().endsWith(expectedExt))
      .sort();

    return res.json(buildImageResponse(outId, files));
  } catch (err) {
    await removeDirQuietly(outDir);
    return res.status(500).json(commandError(command, err));
  } finally {
    await removeFileQuietly(req.file?.path);
  }
}

app.post('/pdftocairo', upload.single('file'), async (req, res) => {
  return runImageCommand('pdftocairo', req, res);
});

app.post('/pdftoppm', upload.single('file'), async (req, res) => {
  return runImageCommand('pdftoppm', req, res);
});

app.post('/pdftohtml', upload.single('file'), async (req, res) => {
  if (!req.file) return missingFile(res);

  try {
    const { stdout } = await runCommand('pdftohtml', [
      '-s',
      '-dataurls',
      '-noframes',
      '-stdout',
      req.file.path,
    ]);

    return res.type('html').send(stdout);
  } catch (err) {
    return res.status(500).json(commandError('pdftohtml', err));
  } finally {
    await removeFileQuietly(req.file?.path);
  }
});

app.post('/pdfinfo', upload.single('file'), async (req, res) => {
  if (!req.file) return missingFile(res);

  try {
    const { stdout } = await runCommand('pdfinfo', [req.file.path]);
    return res.type('text/plain').send(stdout);
  } catch (err) {
    return res.status(500).json(commandError('pdfinfo', err));
  } finally {
    await removeFileQuietly(req.file?.path);
  }
});

app.post('/pdftotext', upload.single('file'), async (req, res) => {
  if (!req.file) return missingFile(res);

  try {
    const { stdout } = await runCommand('pdftotext', [req.file.path, '-']);
    return res.type('text/plain').send(stdout);
  } catch (err) {
    return res.status(500).json(commandError('pdftotext', err));
  } finally {
    await removeFileQuietly(req.file?.path);
  }
});

app.use('/media', express.static(MEDIA_DIR));

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: `file is too large. max size is ${MAX_FILE_SIZE_MB}MB.`,
    });
  }

  return res.status(500).json({
    success: false,
    message: err.message || 'internal server error',
  });
});

app.listen(PORT, () => {
  console.log(`PDF service (Poppler) running on port ${PORT}`);
});
