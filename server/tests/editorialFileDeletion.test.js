import { describe, expect, it } from 'vitest';
import { canRemoveEditorialMaterial, canRemoveEditorialProjectFolder } from '../src/lib/editorialFileDeletion.js';

describe('editorial file deletion guards', () => {
    const file = (completedAt, status) => ({ task:{ status, project:{ completedAt } } });
    it('blocks attachments in an active project even when the task is approved', () => {
        expect(canRemoveEditorialMaterial(file(null,'APPROVED')).allowed).toBe(false);
    });
    it('blocks work in progress even when the project is completed', () => {
        expect(canRemoveEditorialMaterial(file(new Date(),'IN_PROGRESS')).allowed).toBe(false);
    });
    it('allows only finalized materials in completed projects', () => {
        expect(canRemoveEditorialMaterial(file(new Date(),'DONE')).allowed).toBe(true);
        expect(canRemoveEditorialMaterial(file(new Date(),'APPROVED')).allowed).toBe(true);
    });
    it('never removes active or nonempty virtual project folders', () => {
        expect(canRemoveEditorialProjectFolder({completedAt:null,tasks:[]}).allowed).toBe(false);
        expect(canRemoveEditorialProjectFolder({completedAt:new Date(),tasks:[{status:'TODO',_count:{materialFiles:0}}]}).allowed).toBe(false);
        expect(canRemoveEditorialProjectFolder({completedAt:new Date(),tasks:[{status:'DONE',_count:{materialFiles:1}}]}).allowed).toBe(false);
    });
    it('can hide an empty finished project folder', () => {
        expect(canRemoveEditorialProjectFolder({completedAt:new Date(),tasks:[{status:'DONE',_count:{materialFiles:0}}]}).allowed).toBe(true);
    });
});
