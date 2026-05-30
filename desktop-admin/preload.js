const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopApi", {
  saveFile: (options) => ipcRenderer.invoke("save-file", options),
});
