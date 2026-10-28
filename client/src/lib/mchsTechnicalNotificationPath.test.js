import {describe,it,expect} from 'vitest';
import {mchsTechnicalNotificationPath as route} from './mchsTechnicalNotificationPath.js';
const incident={type:'system',payload:{diagnosticOnly:true,officialAlert:false,incidentId:'incident-123',url:'/app/admin?tab=safety-mchs&incident=incident-123'}};
describe('MCHS technical notification navigation',()=>{
 it('opens a matching incident',()=>expect(route(incident)).toBe(incident.payload.url));
 it('opens diagnostic probe',()=>expect(route({type:'system',payload:{diagnosticOnly:true,officialAlert:false,diagnosticProbe:true,url:'/app/admin?tab=safety-mchs'}})).toBe('/app/admin?tab=safety-mchs'));
 it('rejects mismatched incident IDs',()=>expect(route({...incident,payload:{...incident.payload,incidentId:'other'}})).toBe(null));
 it('rejects untrusted navigation paths',()=>expect(route({...incident,payload:{...incident.payload,url:'https://evil.example/'}})).toBe(null));
 it('ignores unrelated system notices',()=>expect(route({type:'system',payload:{url:'/app/admin?tab=safety-mchs'}})).toBe(null));
});