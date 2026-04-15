const playBtn = document.getElementById('play-btn');
const playGroup = document.getElementById('play-group');
const installGameBtn = document.getElementById('install-game-btn');
const uninstallGameBtn = document.getElementById('uninstall-game-btn');
const bepinexBtn = document.getElementById('bepinex-btn');
const uninstallBepinexBtn = document.getElementById('uninstall-bepinex-btn');
const modListContainer = document.getElementById('mod-list');
const playtimeText = document.getElementById('playtime-text');
const dropOverlay = document.getElementById('drop-overlay');
const instanceSelect = document.getElementById('instance-select');
const newInstanceBtn = document.getElementById('new-instance-btn');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');

const instanceModal = document.getElementById('instance-modal');
const instanceNameInput = document.getElementById('instance-name-input');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalCreateBtn = document.getElementById('modal-create-btn');

const renameInstanceBtn = document.getElementById('rename-instance-btn');
const renameModal = document.getElementById('rename-modal');
const renameNameInput = document.getElementById('rename-name-input');
const renameCancelBtn = document.getElementById('rename-cancel-btn');
const renameSubmitBtn = document.getElementById('rename-submit-btn');

const deleteInstanceBtn = document.getElementById('delete-instance-btn');
const deleteModal = document.getElementById('delete-modal');
const deleteTargetName = document.getElementById('delete-target-name');
const deleteCancelBtn = document.getElementById('delete-cancel-btn');
const deleteSubmitBtn = document.getElementById('delete-submit-btn');

const alertModal = document.getElementById('alert-modal');
const alertMessageText = document.getElementById('alert-message-text');
const alertOkBtn = document.getElementById('alert-ok-btn');

const updateModal = document.getElementById('update-modal');
const updateLaterBtn = document.getElementById('update-later-btn');
const updateRestartBtn = document.getElementById('update-restart-btn');

let appState = null;
let githubDatabase = [];

function showCustomAlert(message) {
    alertMessageText.innerText = message;
    alertModal.style.display = 'flex';
    setTimeout(() => alertOkBtn.focus(), 50);
}

alertOkBtn.addEventListener('click', () => {
    alertModal.style.display = 'none';
});

async function syncState() {
    const backendState = await window.electronAPI.getState();
    if (appState && appState.instances) {
        Object.keys(backendState.instances).forEach(name => {
            const oldInst = appState.instances[name];
            if (oldInst && oldInst.isDownloading) {
                backendState.instances[name].isDownloading = oldInst.isDownloading;
                backendState.instances[name].downloadPercent = oldInst.downloadPercent;
                backendState.instances[name].downloadStatus = oldInst.downloadStatus;
            }
        });
    }
    appState = backendState;
}

function formatPlaytime(ms) {
    playtimeText.innerText = `${(ms / (1000 * 60 * 60)).toFixed(1)} hrs on record`;
}

function getActiveInstance() {
    return appState.instances[appState.activeInstance];
}

playBtn.addEventListener('click', () => {
    playBtn.innerText = "PLAYING...";
    playBtn.disabled = true;
    window.electronAPI.launchGame();
});

window.electronAPI.onGameClosed((e, time) => {
    playBtn.innerText = "PLAY GAME";
    playBtn.disabled = false;
    getActiveInstance().playtime = time;
    formatPlaytime(time);
});

document.getElementById('open-folder-btn').addEventListener('click', async () => {
    const result = await window.electronAPI.openModsFolder();
    if (!result.success) showCustomAlert("The mods folder doesn't exist yet! Install BepInEx first.");
});

window.electronAPI.onDownloadProgress((e, data) => {
    const inst = appState.instances[data.instance];
    if (inst) {
        inst.downloadPercent = data.percent;
        inst.downloadStatus = `DOWNLOADING... ${data.percent}%`;
    }
    if (appState.activeInstance === data.instance) {
        progressBar.style.width = `${data.percent}%`;
        installGameBtn.innerText = inst.downloadStatus;
    }
});

window.electronAPI.onDownloadStatus((e, data) => {
    const inst = appState.instances[data.instance];
    if (inst) inst.downloadStatus = data.status;
    if (appState.activeInstance === data.instance) installGameBtn.innerText = data.status;
});

installGameBtn.addEventListener('click', async () => {
    const targetInstance = appState.activeInstance;
    appState.instances[targetInstance].isDownloading = true;
    appState.instances[targetInstance].downloadPercent = 0;
    appState.instances[targetInstance].downloadStatus = "STARTING DOWNLOAD...";
    updateMainUI();

    const result = await window.electronAPI.installGame(targetInstance);

    if (appState.instances[targetInstance]) {
        appState.instances[targetInstance].isDownloading = false;
    }

    if (result.success) {
        await syncState();
        updateMainUI();
    } else {
        showCustomAlert("Failed: " + result.error);
        updateMainUI();
    }
});

uninstallGameBtn.addEventListener('click', async () => {
    if (confirm("Delete the game and mods from this instance?")) {
        uninstallGameBtn.disabled = true;
        playBtn.innerText = "DELETING...";
        await window.electronAPI.uninstallGame();
        uninstallGameBtn.disabled = false;
        playBtn.innerText = "PLAY GAME";
        await syncState();
        updateMainUI();
        loadModsUI();
    }
});

window.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropOverlay.style.display = "flex";
});

window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) dropOverlay.style.display = "none";
});

window.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropOverlay.style.display = "none";
    if (!getActiveInstance().bepinexInstalled) return showCustomAlert("Install BepInEx first!");
    const file = e.dataTransfer.files[0];
    if (file && file.name.toLowerCase().endsWith('.zip')) {
        const result = await window.electronAPI.installLocalMod(file);
        if (result.success) {
            await syncState();
            loadModsUI();
        }
    }
});

function renderInstances() {
    instanceSelect.innerHTML = '';
    Object.keys(appState.instances).forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.innerText = `Instance: ${name}`;
        if (name === appState.activeInstance) opt.selected = true;
        instanceSelect.appendChild(opt);
    });
}

instanceSelect.addEventListener('change', async (e) => {
    instanceSelect.disabled = true;
    await window.electronAPI.switchInstance(e.target.value);
    await syncState();
    instanceSelect.disabled = false;
    updateMainUI();
    loadModsUI();
});

newInstanceBtn.addEventListener('click', () => {
    instanceNameInput.value = '';
    instanceModal.style.display = 'flex';
    setTimeout(() => instanceNameInput.focus(), 50);
});

modalCancelBtn.addEventListener('click', () => {
    instanceModal.style.display = 'none';
});

modalCreateBtn.addEventListener('click', async () => {
    const name = instanceNameInput.value.trim();
    if (name) {
        instanceModal.style.display = 'none';
        const result = await window.electronAPI.createInstance(name);
        if (result.success) {
            await syncState();
            renderInstances();
            updateMainUI();
            loadModsUI();
        } else {
            showCustomAlert("Failed: " + result.error);
        }
    }
});

instanceNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') modalCreateBtn.click();
});

renameInstanceBtn.addEventListener('click', () => {
    renameNameInput.value = appState.activeInstance;
    renameModal.style.display = 'flex';
    setTimeout(() => renameNameInput.focus(), 50);
});

renameCancelBtn.addEventListener('click', () => {
    renameModal.style.display = 'none';
});

renameSubmitBtn.addEventListener('click', async () => {
    const newName = renameNameInput.value.trim();
    const oldName = appState.activeInstance;

    if (newName && newName !== oldName) {
        renameSubmitBtn.disabled = true;
        renameSubmitBtn.innerText = "Working...";

        const result = await window.electronAPI.renameInstance(oldName, newName);

        renameSubmitBtn.disabled = false;
        renameSubmitBtn.innerText = "Rename";

        if (result.success) {
            renameModal.style.display = 'none';
            await syncState();
            renderInstances();
            updateMainUI();
            loadModsUI();
        } else {
            showCustomAlert("Failed: " + result.error);
        }
    } else if (newName === oldName) {
        renameModal.style.display = 'none';
    }
});

renameNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') renameSubmitBtn.click();
});

deleteInstanceBtn.addEventListener('click', () => {
    if (Object.keys(appState.instances).length <= 1) {
        return showCustomAlert("You must have at least one instance. Create a new one before deleting this one!");
    }
    deleteTargetName.innerText = appState.activeInstance;
    deleteModal.style.display = 'flex';
});

deleteCancelBtn.addEventListener('click', () => {
    deleteModal.style.display = 'none';
});

deleteSubmitBtn.addEventListener('click', async () => {
    const target = appState.activeInstance;
    deleteSubmitBtn.disabled = true;
    deleteSubmitBtn.innerText = "Deleting...";

    const result = await window.electronAPI.deleteInstance(target);

    deleteSubmitBtn.disabled = false;
    deleteSubmitBtn.innerText = "Delete";
    deleteModal.style.display = 'none';

    if (result.success) {
        await syncState();
        renderInstances();
        updateMainUI();
        loadModsUI();
    } else {
        showCustomAlert("Failed to delete: " + result.error);
    }
});

function updateMainUI() {
    const inst = getActiveInstance();
    formatPlaytime(inst.playtime);

    if (inst.isDownloading) {
        installGameBtn.style.display = "inline-flex";
        installGameBtn.innerText = inst.downloadStatus || "DOWNLOADING...";
        installGameBtn.disabled = true;
        progressContainer.style.display = "block";
        progressBar.style.width = `${inst.downloadPercent || 0}%`;
        playGroup.style.display = "none";
        bepinexBtn.disabled = true;
        document.getElementById('open-folder-btn').disabled = true;
    } else if (inst.gameInstalled) {
        installGameBtn.style.display = "none";
        progressContainer.style.display = "none";
        playGroup.style.display = "flex";
        bepinexBtn.disabled = false;
        document.getElementById('open-folder-btn').disabled = false;
    } else {
        installGameBtn.style.display = "inline-flex";
        installGameBtn.innerText = "INSTALL GAME";
        installGameBtn.disabled = false;
        progressContainer.style.display = "none";
        playGroup.style.display = "none";
        bepinexBtn.disabled = true;
        document.getElementById('open-folder-btn').disabled = true;
    }

    if (inst.bepinexInstalled) {
        bepinexBtn.style.display = "none";
        uninstallBepinexBtn.style.display = "inline-flex";
        uninstallBepinexBtn.innerText = "Uninstall BepInEx";
    } else {
        uninstallBepinexBtn.style.display = "none";
        bepinexBtn.style.display = "inline-flex";
        bepinexBtn.innerText = "Install BepInEx";
    }
}

bepinexBtn.addEventListener('click', async () => {
    bepinexBtn.innerText = "Installing...";
    bepinexBtn.disabled = true;
    const r = await window.electronAPI.installBepInEx();
    bepinexBtn.disabled = false;
    if (r.success) {
        await syncState();
        updateMainUI();
    }
});

uninstallBepinexBtn.addEventListener('click', async () => {
    if (confirm("Are you sure?")) {
        uninstallBepinexBtn.innerText = "Uninstalling...";
        uninstallBepinexBtn.disabled = true;
        const r = await window.electronAPI.uninstallBepInEx();
        uninstallBepinexBtn.disabled = false;
        if (r.success) {
            await syncState();
            updateMainUI();
            loadModsUI();
        }
    }
});

async function handleInstallWithDependencies(targetModId) {
    let installQueue = [targetModId];
    const resolveDependencies = (id) => {
        const modData = githubDatabase.find(m => m.id === id);
        if (modData && modData.dependencies) {
            modData.dependencies.forEach(depId => {
                if (!getActiveInstance().installedMods[depId] && !installQueue.includes(depId)) {
                    installQueue.push(depId);
                    resolveDependencies(depId);
                }
            });
        }
    };
    resolveDependencies(targetModId);

    if (installQueue.length > 1 && !confirm(`This mod requires ${installQueue.length - 1} dependencies. Install all?`)) return;

    for (let id of installQueue) {
        const data = githubDatabase.find(m => m.id === id);
        if (data) await window.electronAPI.installMod(data.id, data.download_url, data.version);
    }
    await syncState();
    loadModsUI();
}

async function loadModsUI() {
    try {
        if (githubDatabase.length === 0) {
            const res = await fetch('https://raw.githubusercontent.com/Momo-Modding/Momo-Mod-Database/main/mods.json');
            const data = await res.json();
            githubDatabase = data.mods;
        }
        modListContainer.innerHTML = '';
        const inst = getActiveInstance();

        githubDatabase.forEach(mod => {
            const installedVer = inst.installedMods[mod.id];
            const isInstalled = !!installedVer;
            const needsUpdate = isInstalled && installedVer !== mod.version && installedVer !== "local";

            let buttonsHTML = '';
            if (isInstalled) {
                buttonsHTML = `<div class="mod-card-actions"><button class="btn-danger uninstall-mod-btn" data-id="${mod.id}">Uninstall</button></div>`;
                if (needsUpdate) buttonsHTML = `<button class="btn-update update-mod-btn" data-id="${mod.id}" style="margin-bottom:10px; width:100%;">Update to v${mod.version}</button>` + buttonsHTML;
            } else {
                buttonsHTML = `<div class="mod-card-actions"><button class="btn-install install-mod-btn" data-id="${mod.id}">Install Mod</button></div>`;
            }

            const modCard = document.createElement('div');
            modCard.className = 'mod-card';
            modCard.innerHTML = `<h3>${mod.name} <small>v${mod.version}</small></h3><div class="author">By ${mod.author}</div><div class="desc">${mod.description}</div>${buttonsHTML}`;
            modListContainer.appendChild(modCard);
        });

        Object.keys(inst.installedMods).forEach(id => {
            if (inst.installedMods[id] === "local") {
                const localCard = document.createElement('div');
                localCard.className = 'mod-card';
                localCard.innerHTML = `<h3>${id} <small>Local File</small></h3><div class="author">By You</div><div class="desc">Installed via drag and drop.</div>
                    <div class="mod-card-actions"><button class="btn-danger uninstall-mod-btn" data-id="${id}">Uninstall</button></div>`;
                modListContainer.appendChild(localCard);
            }
        });

        document.querySelectorAll('.install-mod-btn, .update-mod-btn').forEach(btn => btn.addEventListener('click', (e) => {
            if (!getActiveInstance().bepinexInstalled) return showCustomAlert("Please install BepInEx first!");
            e.target.innerText = "Working...";
            e.target.disabled = true;
            handleInstallWithDependencies(e.target.getAttribute('data-id'));
        }));

        document.querySelectorAll('.uninstall-mod-btn').forEach(btn => btn.addEventListener('click', async (e) => {
            e.target.innerText = "Deleting...";
            e.target.disabled = true;
            await window.electronAPI.uninstallMod(e.target.getAttribute('data-id'));
            await syncState();
            loadModsUI();
        }));

    } catch (error) {
        modListContainer.innerHTML = `<p style="color: red;">Failed to load mods.</p>`;
    }
}

window.electronAPI.onUpdateDownloaded(() => {
    updateModal.style.display = 'flex';
});

updateLaterBtn.addEventListener('click', () => {
    updateModal.style.display = 'none';
});

updateRestartBtn.addEventListener('click', () => {
    updateRestartBtn.innerText = "Restarting...";
    updateRestartBtn.disabled = true;
    updateLaterBtn.disabled = true;
    window.electronAPI.restartApp();
});

async function bootApp() {
    await syncState();
    renderInstances();
    updateMainUI();
    loadModsUI();
}

bootApp();