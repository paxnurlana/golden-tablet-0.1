import {it,expect} from 'vitest';
import {workflowDate,workflowStatusAge} from '../src/lib/workflow-dates';
it('shows honest unknown dates and elapsed status time in the app timezone',()=>{
 expect(workflowDate(null)).toBe('Нет данных');expect(workflowStatusAge(null)).toBe('Нет истории статуса');
 expect(workflowStatusAge('2026-10-01T10:00:00Z',Date.parse('2026-10-15T10:00:00Z'))).toBe('14 дн. в статусе');
 expect(workflowDate('2026-10-01T21:00:00Z')).toContain('2 окт.');
});
