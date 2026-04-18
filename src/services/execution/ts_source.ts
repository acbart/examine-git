import { decode } from './vlq';

export type SourceCodeMapping = Record<number, Record<number, [number, number]>>;

const EXTRACT_SOURCE_CODE_MAP =
    /[#@]\s(source(?:Mapping)?URL)=data:application\/json;base64,\s*(\S+)/;

export function extractSourceCodeMap(code: string): SourceCodeMapping {
    const sourceCodeMap = code.match(EXTRACT_SOURCE_CODE_MAP);
    if (!sourceCodeMap) {
        return {};
    }
    const encoded = sourceCodeMap[2];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const parsed = JSON.parse(atob(encoded));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const lines: string[] = (parsed.mappings as string).split(';');
    const lineMap: SourceCodeMapping = {};
    const latest = [0, 0, 0, 0];
    lines.forEach((line: string, compiledRow: number) => {
        latest[0] = 0;
        line.split(',').forEach((mapping) => {
            const offsets = decode(mapping);
            offsets.forEach((v, i) => (latest[i] += v));
            const [compiledColumn, , originalRow, originalColumn] = latest;
            if (!(compiledRow in lineMap)) {
                lineMap[compiledRow] = {};
            }
            lineMap[compiledRow][compiledColumn] = [originalRow, originalColumn];
        });
    });
    return lineMap;
}
