import {describe,it,expect} from 'vitest';
import {radioFolderTree,radioFolderPath} from './radioFolderTree.js';
describe('audio folder hierarchy',()=>{
 const folders=[{id:'b',parentId:'a',name:'Второй'},{id:'a',parentId:null,name:'Первый'},{id:'c',parentId:'missing',name:'Потерянная'}];
 it('renders parent before child with depth',()=>{const t=radioFolderTree(folders);expect(t.find(x=>x.id==='b').depth).toBe(1);expect(t.findIndex(x=>x.id==='a')).toBeLessThan(t.findIndex(x=>x.id==='b'));});
 it('supports orphan folders and breadcrumbs',()=>{expect(radioFolderTree(folders)).toHaveLength(3);expect(radioFolderPath(folders,'b').map(x=>x.id)).toEqual(['a','b']);});
 it('handles loops without infinite recursion',()=>{expect(radioFolderTree([{id:'a',parentId:'b',name:'A'},{id:'b',parentId:'a',name:'B'}])).toHaveLength(2);});
});