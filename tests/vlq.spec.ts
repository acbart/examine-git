import { decode } from '../src/services/execution/vlq';

describe('VLQ decode', () => {
    test('decodes a single zero value (A)', () => {
        expect(decode('A')).toEqual([0]);
    });

    test('decodes a single positive value', () => {
        // 'C' encodes 1
        expect(decode('C')).toEqual([1]);
    });

    test('decodes a single negative value', () => {
        // 'D' encodes -1
        expect(decode('D')).toEqual([-1]);
    });

    test('decodes multiple values', () => {
        // 'AAAA' => [0, 0, 0, 0]
        expect(decode('AAAA')).toEqual([0, 0, 0, 0]);
    });

    test('decodes a multi-digit (continuation bit) value', () => {
        // 'iB' encodes 17 in VLQ
        expect(decode('iB')).toEqual([17]);
    });

    test('decodes empty string to empty array', () => {
        expect(decode('')).toEqual([]);
    });

    test('throws on an invalid character', () => {
        expect(() => decode('!')).toThrow('Invalid character');
    });

    test('decodes known source-map segment AAAA', () => {
        // Typical first segment in a source map: compiled col 0, source file 0, source line 0, source col 0
        expect(decode('AAAA')).toEqual([0, 0, 0, 0]);
    });

    test('decodes positive and negative mix', () => {
        // 'SAAS' => [9, 0, 0, 9]  — check with: encode([9,0,0,9]) in vlq
        const result = decode('SAAS');
        expect(result.length).toBe(4);
        expect(result[0]).toBe(9);
        expect(result[1]).toBe(0);
        expect(result[2]).toBe(0);
        expect(result[3]).toBe(9);
    });
});
