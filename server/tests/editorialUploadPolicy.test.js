import { describe, expect, it } from 'vitest';
import { ADMIN_EDITORIAL_MAX_BYTES, STANDARD_EDITORIAL_MAX_BYTES, editorialUploadPolicy } from '../src/lib/editorialUploadPolicy.js';

const allowed = mime => ['image/jpeg','video/mp4'].includes(mime);
const check = (user,name,mimeType,size) => editorialUploadPolicy({ user,name,mimeType,size,allowed });

describe('role-based editorial resumable upload policy', () => {
    const admin={role:'ADMIN'}, student={role:'STUDENT'};
    it('accepts a 5 GiB upload from admin and rejects anything larger',() => {
        expect(check(admin,'documentary.mp4','video/mp4',ADMIN_EDITORIAL_MAX_BYTES).allowed).toBe(true);
        expect(check(admin,'documentary.mp4','video/mp4',ADMIN_EDITORIAL_MAX_BYTES+1).allowed).toBe(false);
    });
    it('preserves 200 MiB limit for non-admin users',() => {
        expect(check(student,'photo.jpg','image/jpeg',STANDARD_EDITORIAL_MAX_BYTES).allowed).toBe(true);
        expect(check(student,'photo.jpg','image/jpeg',STANDARD_EDITORIAL_MAX_BYTES+1).allowed).toBe(false);
    });
    it('accepts admin M4V MIME variants and denies student M4V',() => {
        for (const mime of ['video/mp4','video/x-m4v','application/octet-stream','']) {
            expect(check(admin,'FILM.M4V',mime,1024).allowed).toBe(true);
            expect(check(student,'FILM.M4V',mime,1024).allowed).toBe(false);
        }
    });
    it('does not permit unsupported types by renaming unrelated files',() => {
        expect(check(admin,'script.exe','application/octet-stream',1024).allowed).toBe(false);
        expect(check(student,'video.mp4','video/mp4',1024).allowed).toBe(true);
        expect(check(admin,'','video/mp4',0).allowed).toBe(false);
    });
});
