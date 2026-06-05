const { app, BrowserWindow, ipcMain, Menu, nativeImage, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const nodeCrypto = require("crypto");
const { load, save } = require("./settings");
const { LICENSE_SALT } = require("./license.js");

function openExternal(url) {
  if (process.platform === "linux") {
    const child = spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
    child.unref();
  } else {
    shell.openExternal(url);
  }
}

function expectedLicenseKey(userName) {
  const hmac = nodeCrypto.createHmac("sha256", LICENSE_SALT);
  hmac.update(userName.toLowerCase().trim());
  return hmac.digest("hex").slice(0, 16).toUpperCase();
}

function isValidLicense(key, userName) {
  if (!key || !userName) return false;
  return key.toUpperCase() === expectedLicenseKey(userName);
}

const appIcon = nativeImage.createFromPath(path.join(__dirname, "app_icon.icns"));

app.name = "ASDQ Chart";

app.setAboutPanelOptions({
  applicationName: "ASDQ Chart",
  applicationVersion: require("./package.json").version,
  credits: `by Richard Lesh\nBuilt with Electron v${process.versions.electron}`,
  website: "https://glowingcatsoftware.com/ASDQChart.html",
  iconImage: appIcon
});

let mainWin, settingsWin;

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    icon: appIcon,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });
  win.loadFile("index.html");
  if (!mainWin) {
    mainWin = win;
    buildMenu();
  }

  let closeConfirmed = false;
  win.on("close", async (e) => {
    if (closeConfirmed) return;
    e.preventDefault();
    const dirty = await win.webContents.executeJavaScript("isDirty()");
    if (!dirty) {
      closeConfirmed = true;
      win.close();
      return;
    }
    const { response } = await dialog.showMessageBox(win, {
      type: "question",
      buttons: ["Save", "Don\u2019t Save", "Cancel"],
      defaultId: 0,
      cancelId: 2,
      message: "Do you want to save changes before closing?",
    });
    if (response === 0) {
      const filePath = windowFilePaths.get(win.id);
      if (filePath) {
        const data = await win.webContents.executeJavaScript("getFormData()");
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      } else {
        const chosen = dialog.showSaveDialogSync(win, {
          filters: [{ name: "ASDQ Files", extensions: ["asdq"] }],
        });
        if (!chosen) return;
        const data = await win.webContents.executeJavaScript("getFormData()");
        fs.writeFileSync(chosen, JSON.stringify(data, null, 2));
        windowFilePaths.set(win.id, chosen);
      }
      closeConfirmed = true;
      win.close();
    } else if (response === 1) {
      closeConfirmed = true;
      win.close();
    }
  });

  return win;
}

let aboutWin;
function showAbout() {
  if (aboutWin && !aboutWin.isDestroyed()) return aboutWin.focus();
  aboutWin = new BrowserWindow({
    width: 320,
    height: 420,
    resizable: false,
    minimizable: false,
    maximizable: false,
    parent: mainWin,
    modal: true,
    icon: appIcon,
    show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  aboutWin.setMenuBarVisibility(false);
  aboutWin.loadFile("about.html");
  aboutWin.once("ready-to-show", () => {
    if (mainWin && !mainWin.isDestroyed()) {
      const [px, py] = mainWin.getPosition();
      const [pw, ph] = mainWin.getSize();
      const [w, h] = aboutWin.getSize();
      aboutWin.setPosition(Math.round(px + (pw - w) / 2), Math.round(py + (ph - h) / 2));
    }
    aboutWin.show();
  });
  aboutWin.webContents.once("did-finish-load", () => {
    aboutWin.webContents.send("icon-path", path.join(__dirname, "app_icon.png"));
    aboutWin.webContents.send("app-version", require("./package.json").version);
    const { licenseKey, userName } = load();
    if (isValidLicense(licenseKey, userName)) aboutWin.webContents.send("licensed");
  });
  ipcMain.handleOnce("close-about", () => aboutWin?.close());
  aboutWin.on("closed", () => { aboutWin = null; });
}

// Track file path per window
const windowFilePaths = new Map();

function getFocusedFormWindow() {
  return BrowserWindow.getFocusedWindow() || mainWin;
}

function fileOpen() {
  const win = getFocusedFormWindow();
  const result = dialog.showOpenDialogSync(win, {
    filters: [{ name: "ASDQ Files", extensions: ["asdq"] }],
    properties: ["openFile"],
  });
  if (!result || !result[0]) return;
  const filePath = result[0];
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const newWin = createWindow();
  newWin.webContents.once("did-finish-load", () => {
    newWin.webContents.send("set-form-data", data);
    windowFilePaths.set(newWin.id, filePath);
    newWin.setTitle(`ASDQ Chart — ${path.basename(filePath)}`);
  });
}

function fileSave() {
  const win = getFocusedFormWindow();
  if (!win) return;
  const filePath = windowFilePaths.get(win.id);
  if (filePath) {
    saveToFile(win, filePath);
  } else {
    fileSaveAs();
  }
}

function fileSaveAs() {
  const win = getFocusedFormWindow();
  if (!win) return;
  const filePath = dialog.showSaveDialogSync(win, {
    filters: [{ name: "ASDQ Files", extensions: ["asdq"] }],
  });
  if (!filePath) return;
  saveToFile(win, filePath);
}

function saveToFile(win, filePath) {
  win.webContents.send("get-form-data");
  ipcMain.once("form-data-response", (_e, data) => {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    windowFilePaths.set(win.id, filePath);
    win.setTitle(`ASDQ Chart — ${path.basename(filePath)}`);
    win.webContents.send("mark-clean");
  });
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    {
      label: app.name,
      submenu: [
        { label: "About ASDQ Chart", click: showAbout },
        { type: "separator" },
        { label: "Settings…", click: openSettings },
        { label: "License Key…", click: openLicense },
        { type: "separator" },
        ...(isMac ? [
          { role: "hide" },
          { role: "hideOthers" },
          { role: "unhide" },
          { type: "separator" },
        ] : []),
        { role: "quit" }
      ]
    },
    {
      label: "File",
      submenu: [
        { label: "New", accelerator: "CmdOrCtrl+N", click: () => createWindow() },
        { type: "separator" },
        { label: "Open…", accelerator: "CmdOrCtrl+O", click: fileOpen },
        { label: "Save", accelerator: "CmdOrCtrl+S", click: fileSave },
        { label: "Save As…", accelerator: "CmdOrCtrl+Shift+S", click: fileSaveAs },
        { type: "separator" },
        { role: "close" }
      ]
    },
    { role: "editMenu" },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        ...(isMac ? [{ role: "zoom" }] : []),
        { type: "separator" },
        {
          label: "Toggle Developer Tools",
          accelerator: isMac ? "Cmd+Option+I" : "Ctrl+Shift+I",
          click: () => BrowserWindow.getFocusedWindow()?.webContents.toggleDevTools()
        },
        ...(isMac ? [
          { type: "separator" },
          { role: "front" },
        ] : []),
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

let licenseWin;

function openLicense() {
  if (licenseWin) return licenseWin.focus();
  licenseWin = new BrowserWindow({
    width: 400,
    height: 300,
    resizable: false,
    parent: mainWin,
    modal: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  licenseWin.setMenuBarVisibility(false);
  licenseWin.loadFile("license_dialog.html");
  licenseWin.webContents.once("did-finish-load", () => {
    const { licenseKey, userName } = load();
    licenseWin.webContents.send("license-data", { key: licenseKey || "", userName: userName || "" });
  });
  licenseWin.on("closed", () => { licenseWin = null; });
}

ipcMain.handle("license-save", (_e, { key, userName }) => {
  if (!isValidLicense(key, userName)) return;
  const settings = load();
  settings.licenseKey = key.toUpperCase();
  settings.userName = userName;
  save(settings);
  licenseWin?.close();
});

ipcMain.handle("license-cancel", () => licenseWin?.close());

function openSettings() {
  if (settingsWin) return settingsWin.focus();
  settingsWin = new BrowserWindow({
    width: 400,
    height: 300,
    resizable: false,
    parent: mainWin,
    modal: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  settingsWin.setMenuBarVisibility(false);
  settingsWin.loadFile("settings.html");
  settingsWin.on("closed", () => { settingsWin = null; });
}

ipcMain.handle("settings-get-data", () => ({ settings: load() }));

ipcMain.handle("settings-save", (_e, newSettings) => {
  const existing = load();
  save({ ...existing, ...newSettings });
  settingsWin?.close();
  mainWin?.webContents.send("settings-updated");
});

ipcMain.handle("settings-cancel", () => settingsWin?.close());

ipcMain.handle("open-external", (_e, url) => openExternal(url));

function showSplash(nagOnly) {
  const splash = new BrowserWindow({
    width: 320,
    height: 340,
    resizable: false,
    minimizable: false,
    maximizable: false,
    frame: false,
    icon: appIcon,
    parent: nagOnly ? mainWin : undefined,
    modal: !!nagOnly,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  splash.loadFile("splash.html");
  splash.webContents.once("did-finish-load", () => {
    splash.webContents.send("icon-path", path.join(__dirname, "app_icon.png"));
    splash.webContents.send("app-version", require("./package.json").version);
  });

  const handler = () => {
    if (!splash.isDestroyed()) splash.close();
    if (!nagOnly) createWindow();
  };
  ipcMain.once("splash-close", handler);
  splash.on("closed", () => ipcMain.removeListener("splash-close", handler));
}

app.whenReady().then(() => {
  const { licenseKey, userName } = load();
  if (isValidLicense(licenseKey, userName)) {
    createWindow();
  } else {
    showSplash();
  }
});

ipcMain.handle("show-chart", (_e, scores, name, overall) => {
  const chartWin = new BrowserWindow({
    width: 700,
    height: 500,
    icon: appIcon,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  chartWin.loadFile("chart.html");
  chartWin.webContents.once("did-finish-load", () => {
    chartWin.webContents.send("chart-data", { scores, name, overall });
  });
});

ipcMain.handle("show-radar", (_e, scores, name, overall, questions) => {
  const radarWin = new BrowserWindow({
    width: 650,
    height: 700,
    icon: appIcon,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  radarWin.loadFile("radar.html");
  radarWin.webContents.once("did-finish-load", () => {
    radarWin.webContents.send("radar-data", { scores, name, overall, questions });
  });
});

ipcMain.handle("save-chart-dialog", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const filePath = dialog.showSaveDialogSync(win, {
    filters: [
      { name: "SVG Image", extensions: ["svg"] },
      { name: "PNG Image", extensions: ["png"] },
    ],
  });
  if (!filePath) return null;
  const format = filePath.endsWith(".svg") ? "svg" : "png";
  return { filePath, format };
});

ipcMain.handle("capture-chart", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const image = await win.webContents.capturePage();
  return image.toPNG();
});
