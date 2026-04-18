export type ConsoleAPICommand = 'log' | 'error' | 'info' | 'warn' | 'table' | 'clear';

export const CONSOLE_API_COMMAND_LIST: ConsoleAPICommand[] = [
    'log',
    'error',
    'info',
    'warn',
    'table',
    'clear',
];

export interface ConsoleMessage {
    type: ConsoleAPICommand;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args: any[];
    timestamp: number;
}
