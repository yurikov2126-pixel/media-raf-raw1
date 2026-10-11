import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import EditorialTaskDetails from './EditorialTaskDetails.jsx';

vi.mock('./EditorialMaterials.jsx', () => ({ default: () => <p>Панель загрузки</p> }));
vi.mock('./EditorialTaskDiscussion.jsx', () => ({ default: () => null }));
afterEach(cleanup);

function openTask(status = 'IN_PROGRESS', assigneeId = 'student') {
    const task = { id:'task', title:'Съёмка', status, assigneeId };
    render(<EditorialTaskDetails task={task} tasks={[task]} stages={[]} project={{ id:'project', members:[] }} user={{ id:'student' }} canEdit={false} onError={vi.fn()} refresh={vi.fn()} />);
}

describe('upload entry in task details', () => {
    it.each(['TODO', 'IN_PROGRESS', 'REVISION'])('opens materials for the assignee in %s', status => {
        openTask(status);
        fireEvent.click(screen.getByRole('button', { name:'Загрузить файлы на проверку' }));
        expect(screen.getByRole('tab', { name:'Материалы' }).getAttribute('aria-selected')).toBe('true');
        expect(screen.queryByRole('button', { name:'Загрузить файлы на проверку' })).toBeNull();
    });
    it.each(['IN_REVIEW', 'APPROVED', 'DONE'])('does not offer upload in %s', status => {
        openTask(status);
        expect(screen.queryByRole('button', { name:'Загрузить файлы на проверку' })).toBeNull();
    });
    it('does not offer upload for another assignee', () => {
        openTask('IN_PROGRESS', 'another-student');
        expect(screen.queryByRole('button', { name:'Загрузить файлы на проверку' })).toBeNull();
    });
});
