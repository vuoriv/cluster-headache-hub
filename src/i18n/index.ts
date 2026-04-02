import i18n from "i18next"
import { initReactI18next } from "react-i18next"

import en from "./locales/en.json"
import fi from "./locales/fi.json"
import sv from "./locales/sv.json"
import de from "./locales/de.json"
import fr from "./locales/fr.json"
import es from "./locales/es.json"

const savedLang = localStorage.getItem("language")

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fi: { translation: fi },
    sv: { translation: sv },
    de: { translation: de },
    fr: { translation: fr },
    es: { translation: es },
  },
  lng: savedLang || navigator.language.split("-")[0] || "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
})

export const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "fi", label: "Suomi", flag: "🇫🇮" },
  { code: "sv", label: "Svenska", flag: "🇸🇪" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "es", label: "Español", flag: "🇪🇸" },
]

export default i18n
