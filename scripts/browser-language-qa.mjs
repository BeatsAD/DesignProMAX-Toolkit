// Run through ego-browser on the local test page, never against a live Figma file.
export async function auditSettingsAndHelp(){
 const d=document.querySelector('iframe').contentDocument,wait=()=>new Promise(r=>setTimeout(r,80));
 const scan=()=>{const found=[];const walker=d.createTreeWalker(d.body,NodeFilter.SHOW_TEXT);for(let node;node=walker.nextNode();){const p=node.parentElement;if(/[\u3400-\u9fff]/.test(node.textContent)&&!p.closest('[data-i18n-skip],script,style,option')&&p.getClientRects().length)found.push(node.textContent.trim());}for(const el of d.querySelectorAll('[aria-label],[title],[placeholder],[alt]'))if(!el.closest('[data-i18n-skip]'))for(const key of ['aria-label','title','placeholder','alt']){const value=el.getAttribute(key);if(value&&/[\u3400-\u9fff]/.test(value)&&!String(el.dataset.i18nPreserve).split(',').includes(key))found.push(key+': '+value);}return[...new Set(found)];};
 const buttons=()=>[...d.querySelectorAll('button')],clickText=text=>{const b=buttons().find(b=>b.textContent.trim()===text);if(!b)throw new Error('Button missing: '+text);b.click();};
 d.querySelector('button[aria-label="Open Settings"]').click();await wait();const result=[];
 const entries=[...d.querySelectorAll('.settings-list-item')].map(b=>b.querySelector('strong')?.textContent??b.textContent.trim());
 for(let i=0;i<8;i++){
  const list=d.querySelectorAll('.settings-list-item');if(i===5)continue; // Clear cache opens a destructive-data dialog; tested separately.
  const button=list[i];if(!button)continue;button.click();await wait();
  if(d.querySelector('.help-page')){const help=[];for(const entry of [...d.querySelectorAll('.help-manual-index-item')]){entry.click();await wait();help.push({tool:entry.textContent.trim(),untranslated:scan()});}result.push({view:'Help',details:help});}
  else result.push({view:entries[i],untranslated:scan()});
  d.querySelector('button[aria-label="Open Settings"]').click();await wait();
  if(!d.querySelector('.settings-list-item')){d.querySelector('.settings-back')?.click();await wait();}
 }
 return result;
}
export async function auditLocales({locales,homeLabels,settingsLabels}){
 const d=document.querySelector('iframe').contentDocument,wait=()=>new Promise(r=>setTimeout(r,70));
 const settings=async()=>{const header=d.querySelector('.topbar-icon-btn');const buttons=[...d.querySelectorAll('.topbar-icon-btn')];const settingsButton=buttons.find(b=>b.getAttribute('aria-label')?.match(/Settings|设置|設定|설정|Réglages|Einstellungen|Ajustes|Configurações/i));if(!settingsButton)throw new Error('Settings button missing');settingsButton.click();await wait();if(d.querySelector('.settings-back')){d.querySelector('.settings-back').click();await wait();}d.querySelector('.settings-list-item').click();await wait();};
 const result=[];
 for(const locale of locales){await settings();const trigger=d.querySelector('.language-picker .select-trigger');trigger.click();await wait();const option=d.querySelector(`.language-picker .select-option[data-value="${locale}"]`);if(!option)throw new Error('Language option missing: '+locale);option.click();await new Promise((resolve,reject)=>{let ticks=0;const t=setInterval(()=>{if(d.documentElement.lang===locale&&d.querySelector('.language-picker').getAttribute('aria-busy')==='false'){clearInterval(t);resolve();}else if(++ticks>100){clearInterval(t);reject(new Error('Language did not change'));}},20)});
  const stored=JSON.parse(localStorage.getItem('figma.toolkit.settings.v1')).locale;
  const sidebar=d.querySelector('.topbar-home');sidebar.click();await wait();const header=d.querySelector('.topbar').textContent,home=d.querySelector('.tool-grid')?.textContent;
  result.push({locale,stored,header,expected:homeLabels[locale],cards:d.querySelectorAll('.tool-card').length,homeText:home,passed:stored===locale&&header===homeLabels[locale]});
 }
 return result;
}
