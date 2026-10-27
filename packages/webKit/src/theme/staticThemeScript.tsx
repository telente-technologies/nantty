/** @jsxRuntime automatic */
/** @jsxImportSource react */
import { themeCookieMaxAgeSeconds, themeCookieName } from "./themePreference.constant";

const staticThemeScript = `(function(){try{var root=document.documentElement;var cookieName=${JSON.stringify(themeCookieName)};var cookieMaxAge=${themeCookieMaxAgeSeconds};var darkQuery=window.matchMedia("(prefers-color-scheme: dark)");function readPreference(){var match=document.cookie.match(new RegExp("(?:^|; )"+cookieName+"=(light|dark|system)(?:;|$)"));return match?match[1]:"system"}function applyPreference(preference,persist){if(preference==="system"){root.removeAttribute("data-theme")}else{root.setAttribute("data-theme",preference)}if(persist){var secure=window.location.protocol==="https:"?"; Secure":"";document.cookie=cookieName+"="+preference+"; Path=/; Max-Age="+cookieMaxAge+"; SameSite=Lax"+secure}}function syncControls(){var preference=readPreference();document.querySelectorAll('[data-theme-switcher] input[type="radio"]').forEach(function(input){input.checked=input.value===preference})}applyPreference(readPreference(),false);document.addEventListener("change",function(event){var input=event.target;if(input&&input.matches&&input.matches('[data-theme-switcher] input[type="radio"]')&&(input.value==="light"||input.value==="dark"||input.value==="system")){applyPreference(input.value,true)}},true);darkQuery.addEventListener("change",function(){if(readPreference()==="system")root.removeAttribute("data-theme")});if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",syncControls,{once:true})}else{syncControls()}}catch(error){}})();`;

export function StaticThemeScript() {
  return <script data-nantty-static-theme="true" dangerouslySetInnerHTML={{ __html: staticThemeScript }} />;
}
