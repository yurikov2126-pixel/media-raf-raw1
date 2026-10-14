import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import EditorialMaterials from './EditorialMaterials.jsx';

vi.mock('../api/client.js', () => ({ api: vi.fn(async () => ({ files:[] })) }));
vi.mock('./EditorialMaterialViewer.jsx', () => ({ default: () => null }));
afterEach(cleanup);

function setup(status = 'REVISION') {
    const props = {
        project:{ id:'project' }, task:{ id:'task', status, assigneeId:'student' },
        token:'test-token', user:{ id:'student' }, canEdit:false,
        refresh:vi.fn(), onError:vi.fn(), onClose:vi.fn(),
    };
    const result = render(<EditorialMaterials {...props} />);
    return result;
}

describe('editorial materials file selection', () => {
    it('uses one accessible drop zone instead of a duplicate visible file picker', () => {
        setup();
        expect(screen.getAllByRole('button', { name:'Выбрать файлы или перетащить их сюда' })).toHaveLength(1);
        const input = screen.getByLabelText('Выбрать файлы для загрузки');
        expect(input.className).toContain('sr-only');
    });
    it('adds dropped files to the same caption queue', () => {
        setup();
        const zone = screen.getByRole('button', { name:'Выбрать файлы или перетащить их сюда' });
        const file = new File(['photo'], 'portrait.jpg', { type:'image/jpeg' });
        fireEvent.dragEnter(zone, { dataTransfer:{ files:[file] } });
        expect(screen.getByText('Отпустите файлы для добавления')).toBeTruthy();
        fireEvent.drop(zone, { dataTransfer:{ files:[file] } });
        expect(screen.getByText('portrait.jpg')).toBeTruthy();
        expect(screen.getByPlaceholderText('Добавить подпись к этому файлу (необязательно)')).toBeTruthy();
        expect(screen.getByRole('button', { name:'Отправить на проверку' })).toBeTruthy();
    });
    it('does not expose the drop zone after submission', () => {
        setup('IN_REVIEW');
        expect(screen.queryByRole('button', { name:'Выбрать файлы или перетащить их сюда' })).toBeNull();
    });
});
