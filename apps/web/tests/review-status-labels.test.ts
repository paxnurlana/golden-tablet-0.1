import {it,expect} from 'vitest';
import {dayStatusLabel,dayTone,statusTone} from '../src/lib/review-context';
import {weekDayStatus} from '../src/lib/trading-review';
it('shows Nothing for existing Nothing Day records and orange for Missed',()=>{
 expect(dayStatusLabel('Nothing Day')).toBe('Nothing');
 expect(dayStatusLabel('Missed')).toBe('Missed');
 expect(dayTone('Missed')).toContain('orange');expect(statusTone('Missed')).toContain('orange');
 expect(weekDayStatus(['Missed','Nothing Day'])).toBe('Missed');
 expect(weekDayStatus(['Win Day','Missed'])).toBe('Win Day');
});
