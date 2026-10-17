import assert from 'node:assert/strict';
import test from 'node:test';
import {loadModule} from './load-module.mjs';
const {createHost}=await loadModule('src/main/host.ts');
const {loadNodeFont}=await loadModule('src/engine/main/handlers/nodes.ts');
test('Figma adapter maps native constraints, paints and mixed fonts while preserving node identity',()=>{
 const mixed=Symbol();const child={id:'text',type:'TEXT',fontName:mixed,constraints:{horizontal:'MAX',vertical:'STRETCH'},getRangeFontName:()=>mixed};const page={selection:[child],children:[child]};child.parent=page;const api={mixed,currentPage:page,root:{children:[page]},clientStorage:{},ui:{},viewport:{}};const host=createHost(api);const node=host.document.currentPage.selection[0];assert.equal(node,host.document.currentPage.children[0]);assert.equal(node.parent,host.document.currentPage);assert.deepEqual(node.constraints,{horizontal:'END',vertical:'STARTANDEND'});assert.equal(node.fontName,'mixed');assert.equal(node.getRangeFontName(0,1),'mixed');node.fills=[{type:'IMAGE',imageRef:'hash',scaleMode:'FIT'},{type:'SOLID',color:{r:1,g:0,b:0,a:.5}}];assert.equal(child.fills[0].imageHash,'hash');assert.ok(!('imageRef'in child.fills[0]));assert.deepEqual(child.fills[1].color,{r:1,g:0,b:0});assert.equal(child.fills[1].opacity,.5);host.document.currentPage.selection=[node];assert.equal(page.selection[0],child);
});
test('mixed-font text loads every distinct original font before character replacement',async()=>{
 const loaded=[];const regular={family:'Inter',style:'Regular'},bold={family:'Inter',style:'Bold'};await loadNodeFont({loadFontAsync:async font=>loaded.push(font)},{type:'TEXT',fontName:'mixed',characters:'ABBA',getRangeFontName:i=>i===0?regular:bold});assert.deepEqual(loaded,[regular,bold]);
});
