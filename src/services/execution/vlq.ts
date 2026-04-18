/**
 * VLQ codec for source map decoding.
 * Based on https://github.com/Rich-Harris/vlq (MIT license)
 */

const charToInteger: Record<string, number | undefined> = {};
const integerToChar: Record<number, string> = {};

'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
    .split('')
    .forEach((char, i) => {
        charToInteger[char] = i;
        integerToChar[i] = char;
    });

export function decode(string: string): number[] {
    const result: number[] = [];
    let shift = 0;
    let value = 0;

    for (let i = 0; i < string.length; i++) {
        let integer = charToInteger[string[i]];
        if (integer === undefined) {
            throw new Error('Invalid character (' + string[i] + ')');
        }
        const hasContinuationBit = integer & 32;
        integer &= 31;
        value += integer << shift;
        if (hasContinuationBit) {
            shift += 5;
        } else {
            const shouldNegate = value & 1;
            value >>>= 1;
            if (shouldNegate) {
                result.push(value === 0 ? -0x80000000 : -value);
            } else {
                result.push(value);
            }
            value = shift = 0;
        }
    }

    return result;
}
