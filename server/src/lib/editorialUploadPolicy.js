export const STANDARD_EDITORIAL_MAX_BYTES = 200 * 1024 * 1024;
export const ADMIN_EDITORIAL_MAX_BYTES = 5 * 1024 * 1024 * 1024;

export const isEditorialAdmin = user => user?.role === 'ADMIN';

export function editorialUploadPolicy({ user, name, mimeType, size, allowed }) {
    const admin = isEditorialAdmin(user);
    const limit = admin ? ADMIN_EDITORIAL_MAX_BYTES : STANDARD_EDITORIAL_MAX_BYTES;
    if (!Number.isSafeInteger(size) || size <= 0 || size > limit) {
        return { allowed:false, error:admin
            ? 'Файл превышает допустимый размер 5 ГБ'
            : 'Максимальный размер файла 200 МБ. Загрузка до 5 ГБ доступна администратору.' };
    }
    const m4v = typeof name === 'string' && /\.m4v$/i.test(name);
    const normal = allowed(mimeType);
    // Browsers vary between video/x-m4v, video/mp4 and an empty MIME for m4v.
    if (!normal && !(admin && m4v && ['video/x-m4v','video/mp4','application/octet-stream',''].includes(mimeType))) {
        return { allowed:false, error:'Недопустимый формат файла' };
    }
    if (m4v && !admin) {
        return { allowed:false, error:'Загрузка файлов M4V доступна только администратору' };
    }
    return {allowed:true,limit};
}
