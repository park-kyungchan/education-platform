import {describe,expect,test} from 'bun:test';
import {validDate,validTimeZone} from '../src/model';
describe('independent calendar knowledge',()=>{test('real calendar dates only',()=>{expect(validDate('2026-10-19')).toBe(true);expect(validDate('2026-02-30')).toBe(false);expect(validDate('2026-1-1')).toBe(false);});test('timezones remain independently explicit',()=>{expect(validTimeZone('Etc/UTC')).toBe(true);expect(validTimeZone('')).toBe(false);expect(validTimeZone('unknown')).toBe(false);});});
