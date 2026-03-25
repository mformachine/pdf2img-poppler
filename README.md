# Docker Poppler (Node.js)

A simple HTTP API service for Poppler, includes `pdftohtml`, `pdftotext`, `pdfinfo`, `pdftoppm`, `pdftocairo`

## Usage

Build the Docker image:
```
docker build -t poppler-node .
```

Start the HTTP server:
```
docker run --rm -p 5000:5000 poppler-node
```

Convert a PDF file to PNG images:
```
curl -F file=@/path/to/file.pdf http://localhost:5000/pdftocairo
```

Convert a PDF file to text:
```
curl -F file=@/path/to/file.pdf http://localhost:5000/pdftotext
```

Convert a PDF file to HTML:
```
curl -F file=@/path/to/file.pdf http://localhost:5000/pdftohtml -o demo.html
```

Get PDF file information:
```
curl -F file=@/path/to/file.pdf http://localhost:5000/pdfinfo
```

## License

MIT
