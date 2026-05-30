const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopApi", {
  saveFile: (options) => ipcRenderer.invoke("save-file", options),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
});
