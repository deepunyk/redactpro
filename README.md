# AnonDocs - Secure PDF Redaction

A privacy-focused web application for redacting sensitive information from PDF documents entirely in the browser. No data is sent to any server.

## Features

- **Keyword-Based Redaction**: Enter keywords to automatically find and redact matching text
- **Image-Based Redaction**: Creates secure image-only PDFs with no recoverable text layer
- **Real-Time Preview**: See exactly what will be redacted before downloading
- **Privacy First**: Your documents are processed locally and never uploaded to any server

## Use Case

Perfect for sanitizing PDFs before sharing with AI services that may use uploaded content for training data. Redact names, emails, SSNs, or any sensitive information before processing.

## Security

- **Local Processing**: Your documents never leave your device
- **Image-based redaction**: Redacted content cannot be recovered
- **No tracking**: Privacy-first design with no analytics

## Installation & Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **PDF.js** - PDF parsing and rendering
- **pdf-lib** - PDF creation and modification
- **TailwindCSS** - Styling

## How It Works

1. Upload a PDF file (drag & drop or click to browse)
2. Enter keywords you want to redact
3. Preview redaction boxes overlaid on the document
4. Download the redacted PDF

The redacted PDF is created by:
1. Extracting text coordinates using PDF.js
2. Finding keyword matches
3. Rendering each page to canvas at high resolution
4. Drawing black rectangles over matched regions
5. Creating a new image-only PDF from the canvases

This ensures no text layer remains that could expose the redacted information.

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## License

MIT

## Disclaimer

This tool is provided as-is. Always verify redaction results before sharing sensitive documents. The creators accept no liability for data breaches resulting from improper use.
