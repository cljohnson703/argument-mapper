'use strict';
const fs=require('fs'),assert=require('assert/strict'),{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync(process.argv[2]||'argument-mapper-r27.html','utf8');
async function run(platform,mac){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://localhost/platform',virtualConsole:vc,beforeParse(w){
   Object.defineProperty(w.navigator,'platform',{value:platform});w.matchMedia=()=>({matches:false,addEventListener(){}});w.ResizeObserver=class{observe(){}disconnect(){}};
   const ctx=new Proxy({},{get:(_,p)=>p==='measureText'?()=>({width:40}):()=>ctx});w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.alert=()=>{};w.confirm=()=>true;
 }});
 try{
   await new Promise(r=>setTimeout(r,0));const w=dom.window,d=w.document;
   assert.equal(w.eval('MAC_SHORTCUTS'),mac);
   assert.equal(d.querySelector('#undo-btn .hotkey').textContent,mac?'⌘+Z':'Ctrl+Z');
   assert.equal(d.querySelector('#redo-btn .hotkey').textContent,mac?'⌘+Shift+Z':'Ctrl+Y');
   assert.equal(d.querySelector('#btn-add-parent .hotkey').textContent,mac?'⌥+↑':'Alt+↑');
   assert.match(d.querySelector('#search-input').placeholder,mac?/⌘\+F/:/Ctrl\+F/);
   assert.match(d.querySelector('#help-panel').textContent,mac?/⌘\+Shift\+Z/:/Ctrl\+Y/);
   if(mac)assert.doesNotMatch(d.querySelector('#help-panel').textContent,/\b(?:Ctrl|Alt)\b/);
   w.eval("showContextMenu(80,80,null);document.getElementById('btn-add-weak').innerHTML='Add Weak Rebuttal <span class=hotkey>Ctrl+Enter</span>';document.getElementById('btn-add-parent').title='Parent (Alt+↑)';");
   await new Promise(r=>setTimeout(r,0));
   assert.match(d.querySelector('#context-menu').textContent,mac?/⌘\+Shift\+Z/:/Ctrl\+Y/);
   assert.equal(d.querySelector('#btn-add-weak .hotkey').textContent,mac?'⌘+Enter':'Ctrl+Enter');
   assert.equal(d.querySelector('#btn-add-parent').title,mac?'Parent (⌥+↑)':'Parent (Alt+↑)');
   w.eval("hideContextMenu();state.trees=[{id:'TEST',type:'contention',texts:['Ctrl+S and Alt are the words in this claim.'],children:[],collapsed:[],x:30000,y:30000}];render();");
   await new Promise(r=>setTimeout(r,0));
   assert.match(d.querySelector('#group-TEST').textContent,/Ctrl\+S and Alt are the words/);
   assert.equal(w.eval("state.trees[0].texts[0]"),'Ctrl+S and Alt are the words in this claim.');
   w.eval("window.calls=[];undo=()=>calls.push('undo');redo=()=>calls.push('redo');addParent=()=>calls.push('parent');addChild=type=>calls.push(type);document.activeElement.blur();");
   const key=(code,opts={})=>d.dispatchEvent(new w.KeyboardEvent('keydown',{code,key:code==='KeyZ'?'z':code==='KeyY'?'y':code==='ArrowUp'?'ArrowUp':'Enter',bubbles:true,cancelable:true,...opts}));
   key('KeyZ',mac?{metaKey:true}:{ctrlKey:true});
   key(mac?'KeyZ':'KeyY',mac?{metaKey:true,shiftKey:true}:{ctrlKey:true});
   key('ArrowUp',{altKey:true});key('Enter',mac?{metaKey:true}:{ctrlKey:true});
   assert.deepEqual(Array.from(w.calls),['undo','redo','parent','weak-objection']);
   const input=d.createElement('textarea');d.body.appendChild(input);input.focus();key('KeyZ',mac?{metaKey:true}:{ctrlKey:true});assert.equal(w.calls.length,4,'native text editing undo is not hijacked');
   assert.deepEqual(errors,[]);
   console.log('PASS: '+platform+' shortcut labels, dynamic menus, key bindings and original map text.');
 }finally{dom.window.close();}
}
(async()=>{await run('MacIntel',true);await run('Win32',false);await run('Linux x86_64',false);})().catch(e=>{console.error(e);process.exitCode=1;});
