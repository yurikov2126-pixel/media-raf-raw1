/**
 * Barrel админ-роутов.
 *
 * Раньше здесь был монолит ~1400 строк. Теперь всё разбито по доменам
 * в ./admin/*. Этот файл оставлен как точка входа, чтобы app.js
 * (`import adminRoutes from './routes/admin.js'`) не менялся.
 */
export { default } from './admin/index.js';