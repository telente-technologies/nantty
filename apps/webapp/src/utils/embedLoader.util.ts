import { embedMaximumHeight, embedMinimumHeight, embedResizeMessageType } from "./embedSecurity.util";

export function readEmbedSiteOrigin(): string {
  const configured = process.env["NEXT_PUBLIC_SITE_URL"] ?? "http://localhost:3500";
  try {
    return new URL(configured).origin;
  } catch {
    return "http://localhost:3500";
  }
}

export function buildEmbedLoaderScript(origin: string): string {
  return `(function(){"use strict";var origin=${JSON.stringify(origin)};var idPattern=/^[A-Za-z0-9_.~-]{1,100}$/;
function frameId(){var bytes=new Uint8Array(12);crypto.getRandomValues(bytes);return Array.prototype.map.call(bytes,function(b){return("0"+b.toString(16)).slice(-2)}).join("")}
function build(el){if(el.getAttribute("data-zudomart-ready"))return;var type=el.getAttribute("data-type")||"store";var kind=type==="products"?"products":(type==="button"||type==="product")?"product":"store";
var id=el.getAttribute(kind==="product"?"data-product":"data-store")||"";if(!idPattern.test(id))return;var query=new URLSearchParams();
["theme","layout","limit","size","products","view"].forEach(function(key){var value=el.getAttribute("data-"+key);if(value)query.set(key,value)});if(type==="button")query.set("view","button");
var frame=frameId();var iframe=document.createElement("iframe");var text=query.toString();
iframe.src=origin+"/embed/"+kind+"/"+encodeURIComponent(id)+(text?"?"+text:"")+"#frame="+frame;
iframe.setAttribute("sandbox","allow-scripts allow-popups allow-popups-to-escape-sandbox");iframe.setAttribute("referrerpolicy","strict-origin-when-cross-origin");
iframe.setAttribute("loading","lazy");iframe.setAttribute("title",el.getAttribute("data-title")||"Nantty");
iframe.style.cssText="border:0;width:100%;max-width:100%;display:block;height:"+(query.get("view")==="button"?"64px":"200px");
el.setAttribute("data-zudomart-ready","1");el.appendChild(iframe);
window.addEventListener("message",function(event){if(event.source!==iframe.contentWindow)return;if(event.origin!=="null"&&event.origin!==origin)return;var data=event.data;
if(!data||data.type!==${JSON.stringify(embedResizeMessageType)}||data.frame!==frame||typeof data.height!=="number"||!isFinite(data.height))return;
iframe.style.height=Math.min(Math.max(Math.round(data.height),${embedMinimumHeight}),${embedMaximumHeight})+"px"})}
function scan(){var nodes=document.querySelectorAll(".zudomart-embed");for(var i=0;i<nodes.length;i++)build(nodes[i])}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",scan);else scan()})();`;
}
