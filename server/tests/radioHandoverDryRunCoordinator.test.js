import {describe,it,expect} from 'vitest';
import {RadioHandoverDryRunCoordinator} from '../src/lib/radioHandoverDryRunCoordinator.js';
const ready={scheduleKnown:true,scheduledActive:false,presenterAuthorized:true,presenterConnected:true,
  gatewayRunning:true,pcmReady:true,presenterId:'a',leaseId:'lease-a',scheduleRevision:12};
describe('dry run coordinator',()=>{
 it('rejects concurrent owners and never emits a broadcast switch',()=>{
  const c=new RadioHandoverDryRunCoordinator(),p=c.prepare({owner:'operator-1',snapshot:ready});
  expect(p.ok).toBe(true);
  expect(c.prepare({owner:'operator-2',snapshot:ready}).reason).toBe('ANOTHER_OPERATOR_PREPARING');
  expect(c.verify({owner:'operator-2',proposalId:p.proposalId,snapshot:ready}).reason).toBe('OWNER_MISMATCH');
  expect(c.verify({owner:'operator-1',proposalId:p.proposalId,snapshot:ready}).changeApplied).toBe(false);
  expect(c.snapshot().connectedToEncoder).toBe(false);
 });
 it('releases ownership when presenter disappears',()=>{
  const c=new RadioHandoverDryRunCoordinator();
  c.prepare({owner:'one',snapshot:ready});
  expect(c.onPresenterLost('DISCONNECT').recommendedSource).toBe('AUTO_DJ');
  expect(c.snapshot().ownerPresent).toBe(false);
  expect(c.prepare({owner:'two',snapshot:ready}).ok).toBe(true);
 });
 it('prevents a competing operator from cancelling the proposal',()=>{
  const c=new RadioHandoverDryRunCoordinator();
  c.prepare({owner:'one',snapshot:ready});
  expect(c.release({owner:'two'}).ok).toBe(false);
  expect(c.snapshot().pending).toBe(true);
  expect(c.release({owner:'one'}).ok).toBe(true);
 });
});
