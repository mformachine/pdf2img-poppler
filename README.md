# mformachine/poppler

A small Docker-ready HTTP API for Poppler tools.

It keeps the original Python-style workflow:
- `POST` a PDF to convert it
- receive back `/media/...` URLs
- `GET` the converted files from those URLs

This image is published on Docker Hub as `mformachine/poppler`.

## Quick start

Pull and run:

```bash
docker pull mformachine/poppler
docker run --rm -p 5000:5000 mformachine/poppler
```

The service will be available at:

```text
http://localhost:5000
```

Health check:

```bash
curl http://localhost:5000/healthz
```

## Available endpoints

- `GET /`
- `GET /healthz`
- `POST /pdftocairo`
- `POST /pdftoppm`
- `POST /pdftohtml`
- `POST /pdfinfo`
- `POST /pdftotext`
- `GET /media/...`

## Features

- wraps Poppler tools in a simple HTTP API
- works well with Docker and n8n
- uploaded PDFs are deleted after processing
- converted images are temporarily stored under `/media`
- media is automatically cleaned up after 60 minutes by default
- supports `format` and `dpi` on image conversion endpoints
- runs as a non-root user in Docker

## Supported image parameters

For `POST /pdftocairo` and `POST /pdftoppm`:

- `file`: required PDF upload
- `format`: `png`, `jpeg`, or `jpg`
- `dpi`: positive integer, such as `150` or `300`

## API examples

Convert a PDF to PNG images:

```bash
curl -X POST http://localhost:5000/pdftocairo \
  -F "file=@/path/to/file.pdf"
```

Convert a PDF to JPEG images at 300 DPI:

```bash
curl -X POST http://localhost:5000/pdftocairo \
  -F "file=@/path/to/file.pdf" \
  -F "format=jpeg" \
  -F "dpi=300"
```

Example response:

```json
{
  "images": [
    "/media/6ec8f5cf-c1df-4aa7-b8d0-4d3e9f6f61be/output-01.png",
    "/media/6ec8f5cf-c1df-4aa7-b8d0-4d3e9f6f61be/output-02.png"
  ]
}
```

Retrieve one converted image:

```bash
curl -O http://localhost:5000/media/6ec8f5cf-c1df-4aa7-b8d0-4d3e9f6f61be/output-01.png
```

Convert a PDF to HTML:

```bash
curl -X POST http://localhost:5000/pdftohtml \
  -F "file=@/path/to/file.pdf" \
  -o output.html
```

Extract text from a PDF:

```bash
curl -X POST http://localhost:5000/pdftotext \
  -F "file=@/path/to/file.pdf"
```

Get PDF metadata:

```bash
curl -X POST http://localhost:5000/pdfinfo \
  -F "file=@/path/to/file.pdf"
```

## n8n flow

Typical image conversion flow:

1. `POST` the PDF to `/pdftocairo` or `/pdftoppm`
2. read the returned `images` array
3. `GET` each `/media/...` URL

This matches the original workflow and keeps integration simple.

## Data lifecycle and cleanup

- uploaded PDFs are stored temporarily and deleted after processing
- generated images are stored in `/app/media/<uuid>`
- generated images are served through `GET /media/...`
- media is automatically removed after the configured TTL

By default:

- `MEDIA_TTL_MINUTES=60`
- `CLEANUP_INTERVAL_MINUTES=60`

That means converted files are kept for up to about one hour, then removed automatically.

For more aggressive cleanup of sensitive data, you can lower the retention window:

```bash
docker run --rm -p 5000:5000 \
  -e MEDIA_TTL_MINUTES=15 \
  -e CLEANUP_INTERVAL_MINUTES=15 \
  mformachine/poppler
```

## Environment variables

- `PORT` default: `5000`
- `TMP_DIR` default: `/tmp`
- `MAX_FILE_SIZE_MB` default: `50`
- `MEDIA_TTL_MINUTES` default: `60`
- `CLEANUP_INTERVAL_MINUTES` default: `60`

## Build locally

```bash
docker build -t mformachine/poppler .
```

Run locally:

```bash
docker run --rm -p 5000:5000 mformachine/poppler
```

## Docker Compose

```bash
docker compose up --build
```

## Publish flow

This repo includes a GitHub Actions workflow that automatically builds and publishes the Docker image to Docker Hub on every push to `main`, and also publishes version tags.

Expected Docker Hub repository:

```text
mformachine/poppler
```

Required GitHub repository secrets:

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

## License

MIT
