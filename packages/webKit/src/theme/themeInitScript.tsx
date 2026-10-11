/** @jsxRuntime automatic */
/** @jsxImportSource react */
import { themeColorByResolvedTheme, themeCookieName } from "./themePreference.constant";

const themeInitScriptSource = `(function(){try{var m=document.cookie.match(/(?:^|; )${themeCookieName}=(light|dark|system)/);var p=m?m[1]:"system";var r=document.documentElement;if(p==="system"){r.removeAttribute("data-theme")}else{r.setAttribute("data-theme",p)}var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(p!=="system"){document.querySelectorAll('meta[name="theme-color"]').forEach(function(e){e.content=d?"${themeColorByResolvedTheme.dark}":"${themeColorByResolvedTheme.light}"})}}catch(e){}})();`;

export function ThemeInitScript({ nonce }: { readonly nonce?: string }) {
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeInitScriptSource }} />;
}
