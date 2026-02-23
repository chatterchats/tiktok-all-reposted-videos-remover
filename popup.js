import { COUNTRY_CURRENCY_MAP, TIMEZONE_COUNTRY_MAP, LOCALE_COUNTRY_MAP, LANGUAGE_COUNTRY_MAP } from "./maps.js";

const ext = globalThis.browser ?? globalThis.chrome;

// Função para detectar o país do usuário usando apenas recursos do navegador
function detectUserCountry() {
  try {
    // Método 1: Usar timezone do navegador (mais preciso)
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    if (TIMEZONE_COUNTRY_MAP[timezone]) {
      return TIMEZONE_COUNTRY_MAP[timezone];
    }
  } catch (error) {
    console.log("Erro ao detectar país via timezone:", error);
  }

  try {
    // Método 2: Usar o locale do navegador
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;


    if (LOCALE_COUNTRY_MAP[locale]) {
      return LOCALE_COUNTRY_MAP[locale];
    }
  } catch (error) {
    console.log("Erro ao detectar país via locale:", error);
  }

  try {
    // Método 3: Usar navigator.language como fallback
    const language = navigator.language || navigator.userLanguage;
    if (language.includes("-")) {
      const countryCode = language.split("-")[1].toUpperCase();
      // Verificar se o código de país existe no nosso mapeamento
      if (COUNTRY_CURRENCY_MAP[countryCode]) {
        return countryCode;
      }
    }

    // Mapeamento básico por idioma

    const languageCode = language.split("-")[0].toLowerCase();
    if (LANGUAGE_COUNTRY_MAP[languageCode]) {
      return LANGUAGE_COUNTRY_MAP[languageCode];
    }
  } catch (error) {
    console.log("Erro ao detectar país via language:", error);
  }

  // Fallback final: US como padrão
  return "US";
}

// Função para abrir doação do PayPal
function openDonation() {
  const countryCode = detectUserCountry();
  const currencyCode = COUNTRY_CURRENCY_MAP[countryCode] || "USD";

  const donationUrl = `https://www.paypal.com/donate/?cmd=_donations&business=S34UMJ23659VY&currency_code=${currencyCode}`;

  ext.tabs.create({ url: donationUrl });
}

async function checkTiktokLogin() {
  try {
    const cookies = await ext.cookies.getAll({ domain: "tiktok.com" });
    const hasMultiSids = cookies.some((c) => c.name === "multi_sids");
    const hasLivingUserId = cookies.some((c) => c.name === "living_user_id");
    return !!(hasMultiSids || hasLivingUserId);
  } catch (e) {
    return false;
  }
}

const I18N_KEYS_PANEL = [
  "panelTitle", "statusPreparing", "statusPaused", "statusResuming", "btnPause", "btnResume",
  "btnDownloadReport", "statusWaiting", "statusListing", "statusPageRemoving", "statusDone",
  "statusNone", "statusErrorNoAccount", "statusErrorRedirectedForyou", "statusErrorRemove", "panelClose", "statsPages",
  "statsRemoved", "statsListed", "statsFailed", "statusStoppedFailures", "statusBetweenPages"
];

function applyI18n() {
  const i18n = ext?.i18n ?? null;
  const getMsg = (key) => (i18n ? i18n.getMessage(key) : "") || "";

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");
    const message = getMsg(key);
    element.innerHTML = message || element.innerHTML || "";
  });
  document.querySelectorAll("[data-i18n-title]").forEach((element) => {
    const key = element.getAttribute("data-i18n-title");
    const message = getMsg(key);
    if (message) element.title = message;
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    const key = element.getAttribute("data-i18n-placeholder");
    const message = getMsg(key);
    element.placeholder = message || element.placeholder || "";
  });
  document.querySelectorAll("option[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");
    const message = getMsg(key);
    element.textContent = message || element.textContent || "";
  });
}

function getPanelI18n() {
  const i18n = ext?.i18n ?? null;
  const o = {};
  I18N_KEYS_PANEL.forEach((key) => {
    o[key] = (i18n && i18n.getMessage(key)) || key;
  });
  return o;
}

async function getStorage(key) {
  const storage = ext?.storage?.local;
  if (!storage) return null;

  // If it returns a Promise
  try {
    const res = await storage.get(key);
    return res;
  } catch {
    // Callback fallback (Chrome)
    return await new Promise((resolve) => storage.get(key, resolve));
  }
}

async function setStorage(obj) {
  const storage = ext?.storage?.local;
  if (!storage) return;

  try {
    await storage.set(obj);
  } catch {
    storage.set(obj);
  }
}

function getConfig() {
  const useKeywords = document.getElementById("useKeywords").checked;
  const keywordsInput = document.getElementById("keywordsInput");
  const keywordsFilter = useKeywords ? (keywordsInput.value || "").trim() : "";
  const intervalMode = document.getElementById("intervalMode").value;
  let intervalMin = Math.max(1, Math.min(10, parseInt(document.getElementById("intervalMin").value, 10) || 1));
  let intervalMax = Math.max(1, Math.min(10, parseInt(document.getElementById("intervalMax").value, 10) || 3));
  if (intervalMin > intervalMax) intervalMax = intervalMin;
  const intervalSetStr = (document.getElementById("intervalSet").value || "1,3,5")
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n >= 0);
  const requestIntervalSet = intervalSetStr.length ? intervalSetStr : [1, 3, 5];
  const reportFormat = document.getElementById("reportFormat").value;
  const pagePause = Math.max(0, Math.min(120, parseInt(document.getElementById("pagePause").value, 10) || 5));
  return {
    keywordsFilter,
    requestIntervalMode: intervalMode,
    requestIntervalRange: { min: intervalMin, max: intervalMax },
    requestIntervalSet,
    exportFileType: reportFormat,
    pagePauseSeconds: pagePause,
    i18n: getPanelI18n(),
  };
}

async function loadSavedConfig() {
  const storage = await getStorage("trrConfig");
  const c = storage && storage.trrConfig;
  if (!c) return;

  storage.get("trrConfig", (data) => {
    const c = data && data.trrConfig;
    if (!c) return;
    try {
      if (c.useKeywords != null) document.getElementById("useKeywords").checked = !!c.useKeywords;
      const kw = document.getElementById("keywordsInput");
      if (kw) {
        if (c.keywordsFilter) kw.value = c.keywordsFilter;
        kw.disabled = !document.getElementById("useKeywords").checked;
      }
      if (c.requestIntervalMode) document.getElementById("intervalMode").value = c.requestIntervalMode;
      const isRange = document.getElementById("intervalMode").value === "range";
      const rangeGrp = document.getElementById("intervalRangeGroup");
      const setGrp = document.getElementById("intervalSetGroup");
      if (rangeGrp) rangeGrp.style.display = isRange ? "flex" : "none";
      if (setGrp) setGrp.style.display = isRange ? "none" : "flex";
      if (c.requestIntervalRange) {
        const minEl = document.getElementById("intervalMin");
        const maxEl = document.getElementById("intervalMax");
        const minVal = Math.max(1, Math.min(10, c.requestIntervalRange.min ?? 1));
        const maxVal = Math.max(1, Math.min(10, c.requestIntervalRange.max ?? 3));
        if (minEl) minEl.value = minVal;
        if (maxEl) maxEl.value = Math.max(minVal, maxVal);
        const fillEl = document.getElementById("intervalRangeFill");
        const displayEl = document.getElementById("intervalRangeDisplay");
        if (minEl && maxEl) {
          const min = parseInt(minEl.value, 10) || 1;
          const max = parseInt(maxEl.value, 10) || 3;
          const range = 10 - 1;
          const pctMin = ((min - 1) / range) * 100;
          const pctWidth = ((max - min) / range) * 100;
          if (fillEl) {
            fillEl.style.left = pctMin + "%";
            fillEl.style.width = pctWidth + "%";
          }
          if (displayEl) displayEl.textContent = min + "s – " + max + "s";
        }
      }
      if (c.requestIntervalSet && c.requestIntervalSet.length) {
        const setEl = document.getElementById("intervalSet");
        if (setEl) setEl.value = c.requestIntervalSet.join(", ");
      }
      if (c.exportFileType) document.getElementById("reportFormat").value = c.exportFileType;
      if (c.pagePauseSeconds != null) {
        const pp = document.getElementById("pagePause");
        if (pp) pp.value = Math.max(0, c.pagePauseSeconds);
      }
    } catch (err) {
      console.warn("TikTok Reposts Remover: loadSavedConfig", err);
    }
  });
}

async function saveConfig(config) {
  const storage = getStorage();
  if (!storage) return;

  try {
    await setStorage({
      trrConfig: {
        useKeywords: !!config.keywordsFilter,
        keywordsFilter: config.keywordsFilter,
        requestIntervalMode: config.requestIntervalMode,
        requestIntervalRange: config.requestIntervalRange,
        requestIntervalSet: config.requestIntervalSet,
        exportFileType: config.exportFileType,
        pagePauseSeconds: config.pagePauseSeconds,
      },
    });
  } catch (err) {
    console.warn("TikTok Reposts Remover: saveConfig", err);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  applyI18n();
  loadSavedConfig();

  const startButton = document.getElementById("startButton");
  const useKeywords = document.getElementById("useKeywords");
  const keywordsInput = document.getElementById("keywordsInput");
  const intervalMode = document.getElementById("intervalMode");
  const intervalRangeGroup = document.getElementById("intervalRangeGroup");
  const intervalSetGroup = document.getElementById("intervalSetGroup");

  // Toggle configuração (slide)
  const configSection = document.querySelector(".popup-config");
  const configToggle = document.getElementById("configToggle");
  const configBody = document.getElementById("configBody");
  if (configSection && configToggle && configBody) {
    configToggle.addEventListener("click", function () {
      const isClosed = configSection.classList.toggle("is-closed");
      configToggle.setAttribute("aria-expanded", isClosed ? "false" : "true");
    });
  }

  // Menu dropdown (clique)
  const menuBtn = document.getElementById("menuBtn");
  const menuDropdown = document.getElementById("menuDropdown");
  if (menuBtn && menuDropdown) {
    menuBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      const isOpen = menuDropdown.classList.toggle("is-open");
      menuBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
      menuDropdown.setAttribute("aria-hidden", isOpen ? "false" : "true");
    });
    document.addEventListener("click", function () {
      if (menuDropdown.classList.contains("is-open")) {
        menuDropdown.classList.remove("is-open");
        menuBtn.setAttribute("aria-expanded", "false");
        menuDropdown.setAttribute("aria-hidden", "true");
      }
    });
  }

  useKeywords.addEventListener("change", function () {
    keywordsInput.disabled = !this.checked;
  });
  const INTERVAL_MIN = 1;
  const INTERVAL_MAX = 10;

  function updateDualRangeDisplay() {
    const minEl = document.getElementById("intervalMin");
    const maxEl = document.getElementById("intervalMax");
    const fillEl = document.getElementById("intervalRangeFill");
    const displayEl = document.getElementById("intervalRangeDisplay");
    if (!minEl || !maxEl) return;
    let min = Math.max(INTERVAL_MIN, Math.min(INTERVAL_MAX, parseInt(minEl.value, 10) || INTERVAL_MIN));
    let max = Math.max(INTERVAL_MIN, Math.min(INTERVAL_MAX, parseInt(maxEl.value, 10) || INTERVAL_MAX));
    if (min > max) max = min;
    if (max < min) min = max;
    minEl.value = min;
    maxEl.value = max;
    const range = INTERVAL_MAX - INTERVAL_MIN;
    const pctMin = ((min - INTERVAL_MIN) / range) * 100;
    const pctWidth = ((max - min) / range) * 100;
    if (fillEl) {
      fillEl.style.left = pctMin + "%";
      fillEl.style.width = pctWidth + "%";
    }
    if (displayEl) displayEl.textContent = min + "s – " + max + "s";
  }

  const intervalMinEl = document.getElementById("intervalMin");
  const intervalMaxEl = document.getElementById("intervalMax");
  if (intervalMinEl && intervalMaxEl) {
    intervalMinEl.addEventListener("input", function () {
      const min = parseInt(this.value, 10);
      const maxEl = document.getElementById("intervalMax");
      if (maxEl && parseInt(maxEl.value, 10) < min) maxEl.value = min;
      updateDualRangeDisplay();
    });
    intervalMaxEl.addEventListener("input", function () {
      const max = parseInt(this.value, 10);
      const minEl = document.getElementById("intervalMin");
      if (minEl && parseInt(minEl.value, 10) > max) minEl.value = max;
      updateDualRangeDisplay();
    });
    updateDualRangeDisplay();
  }

  intervalMode.addEventListener("change", function () {
    const isRange = this.value === "range";
    intervalRangeGroup.style.display = isRange ? "flex" : "none";
    intervalSetGroup.style.display = isRange ? "none" : "flex";
  });

  const loginButton = document.getElementById("loginButton");
  checkTiktokLogin().then((isLoggedIn) => {
    if (isLoggedIn) {
      startButton.disabled = false;
      startButton.style.display = "block";
      if (loginButton) { loginButton.style.display = "none"; loginButton.hidden = true; }
    } else {
      startButton.disabled = true;
      startButton.style.display = "none";
      if (loginButton) {
        loginButton.hidden = false;
        loginButton.style.display = "block";
        const i18n = typeof chrome !== "undefined" && ext.i18n ? ext.i18n : null;
        loginButton.title = (i18n && i18n.getMessage("notLoggedIn")) || "Sign in to TikTok first.";
      }
    }
  });
  if (loginButton) {
    loginButton.addEventListener("click", () => {
      ext.tabs.create({ url: "https://www.tiktok.com/login", active: true });
      window.close();
    });
  }

  startButton.addEventListener("click", function () {
    if (startButton.disabled) return;
    const config = getConfig();
    saveConfig(config);
    ext.runtime.sendMessage({
      action: "startRemovingReposts",
      payload: { config },
    });
    window.close();
  });

  const donateButton = document.getElementById("donateButton");
  if (donateButton) {
    donateButton.addEventListener("click", function () {
      openDonation();
    });
  }
});
