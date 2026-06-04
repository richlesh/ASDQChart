# ASDQ Chart v1.1.0

An Autism Spectrum Disorder Questionnaire (ASDQ) chart generator for Linux, macOS and Windows.

*by Richard Lesh*

---

## Features

- Facilitates the generation of ASDQ charts.
- Customizable chart appearance.
- Bar chart and radar chart options.
- Export to PDF or PNG.
- Suports all 39 ASEQ questions.
- Settings window (save/load to `~/.asdq-chart-settings.json`)
- License key validation (HMAC-SHA256 based)
- Splash screen with donation link
- About window
- macOS, Windows, and Linux builds via electron-builder
- GitHub Actions workflows for all platforms
- Code signing support for macOS

---

## Installation

### Prerequisites
- [Node.js](https://nodejs.org) (v18 or later)
- npm

### Setup
```bash
git clone https://github.com/richlesh/ASDQChart.git
cd ASDQChart
npm install
```

### Running
```bash
npm start
```

---

## Building Distribution Packages

```bash
# All platforms and architectures
npm run dist:all

# Individual builds
npm run dist:mac:x64       # macOS Intel
npm run dist:mac:arm64     # macOS Apple Silicon
npm run dist:win:x64       # Windows x64
npm run dist:win:arm64     # Windows ARM64
npm run dist:linux:x64     # Linux x64
npm run dist:linux:arm64   # Linux ARM64
```

Output files are placed in the `dist/` folder.

---

## Project Structure

```
ASDQ Chart/
├── main.js              # Electron main process
├── index.html           # Main window (ASDQ questionnaire form)
├── styles.css           # Main window styles
├── chart.html           # Bar graph window
├── radar.html           # Radar chart window
├── settings.html        # Settings window
├── settings.js          # Settings module (load/save)
├── about.html           # About dialog
├── license_dialog.html  # License key entry
├── splash.html          # Splash screen
├── config.json          # App configuration
├── package.json         # npm/electron-builder config
├── app_icon.png/.icns/.ico  # App icons
├── doc_icon.png/.icns/.ico  # Document icons (.asdq files)
├── generate_license_key.py  # License key generator
├── sign-mac.sh          # macOS code signing script
└── .github/workflows/   # CI/CD workflows
```

---

## License Key

Generate a license key for a user:
```bash
python3 generate_license_key.py user@example.com
```

---

## Tech Stack

- [Electron](https://www.electronjs.org)

---

## License

GPL 3.0
