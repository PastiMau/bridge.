import { app, BrowserWindow, ipcMain, Menu } from "electron";
import "./communicator.js";
import "./Discord";
import { BP_BASE_PATH } from "../shared/paths.js";

//Set __static path to static files in production
if (process.env.NODE_ENV !== "development") {
    global.__static = require("path").join(__dirname, "/static").replace(/\\/g, "\\\\")
}

let mainWindow, loadingWindow, windowOptions = {
    height: 600,
    useContentSize: true,
    width: 1000,
    frame: false,
    minWidth: 900,
    minHeight: 600,
    show: false,
    webPreferences: {
        nodeIntegration: true
    }
};
const winURL = process.env.NODE_ENV === "development"
    ? `http://localhost:9080`
    : `file://${__dirname}/index.html`;

function createWindow () {
    /**
     * Initial window options
     */
    mainWindow = new BrowserWindow(windowOptions);

    mainWindow.loadURL(winURL);

    mainWindow.on("closed", () => {
        mainWindow = null;
        if(loadingWindow) {
            loadingWindow.close();
        }
    });

    mainWindow.webContents.on("did-finish-load", () => {
        if(loadingWindow) {
            mainWindow.setPosition(...loadingWindow.getPosition());
            // mainWindow.toggleDevTools();
            loadingWindow.close();
            mainWindow.show();
        }
    });

    if(process.env.NODE_ENV === "development") mainWindow.setMenu(Menu.buildFromTemplate([
        {
            label: "View",
            submenu: [
                { role: "reload" }
            ]
        }
    ]));
    if(process.env.NODE_ENV !== "development") mainWindow.setMenu(null);
}

function createSplashScreen() {
    loadingWindow = new BrowserWindow({
        height: 300,
        useContentSize: true,
        width: 300,
        frame: false,
        resizable: false
    });

    loadingWindow.loadURL(`file://${__static}/loading.html`);

    loadingWindow.on("closed", () => {
        loadingWindow = null;
    });

    loadingWindow.webContents.on("did-finish-load", () => {
        loadingWindow.show();

        if(process.platform == 'win32' && process.argv.length >= 2 && process.env.NODE_ENV !== "development") {
            openFile(process.argv[1]);
        }
    });
}

function openFile(file) {
    mainWindow.webContents.send("openFile", file)
}

const gotTheLock = app.requestSingleInstanceLock();
if(!gotTheLock) {
    if(process.platform === 'win32' && process.argv.length >= 2)
        app.quit();
} else {
    app.on("second-instance", (event, argv, working_directory) => {
        if(process.platform === 'win32' && argv.length >= 2) {
            if(mainWindow) {
                if (mainWindow.isMinimized()) mainWindow.restore();
                mainWindow.focus();
            }
            if(loadingWindow) {
                if (loadingWindow.isMinimized()) loadingWindow.restore();
                loadingWindow.focus();
            }

            openFile(argv[3]);
        }
    });
}

app.on('ready', () => {
    createWindow();
    createSplashScreen();
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    if (mainWindow === null) {
        createWindow();
    }
});

ipcMain.on("toggleDevTools", () => { mainWindow.toggleDevTools(); });
ipcMain.on("bridge:setOverlayIcon", (event, project) => {
    try {
        mainWindow.setOverlayIcon((BP_BASE_PATH + project + "/pack_icon.png").replace(/\//g, "\\"), project);
    } catch(e) {
        mainWindow.setOverlayIcon(null, "");
    }
});