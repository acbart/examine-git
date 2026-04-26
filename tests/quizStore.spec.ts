import { useQuizStore } from '../src/features/quiz/quizStore';
import type {
    Quiz,
    MultipleChoiceAnswer,
    FillBlankAnswer,
    MultiFillBlankAnswer,
    MatchingAnswer,
    FreeResponseAnswer,
} from '../src/features/quiz/quizTypes';

// ── Fixture helpers ────────────────────────────────────────────────

function makeMCQuiz(options: string[], correctAnswer: string): Quiz {
    return {
        id: 'test-quiz',
        title: 'Test Quiz',
        groups: [
            {
                id: 'g1',
                requireAll: true,
                questions: [
                    {
                        id: 'q1',
                        type: 'multiple-choice',
                        text: 'Pick one',
                        options,
                        autograde: [{ type: 'exact', value: correctAnswer }],
                    },
                ],
            },
        ],
    };
}

function makeFillBlankQuiz(correct: string): Quiz {
    return {
        id: 'test-quiz',
        title: 'Test Quiz',
        groups: [
            {
                id: 'g1',
                requireAll: true,
                questions: [
                    {
                        id: 'q1',
                        type: 'fill-blank',
                        text: 'Fill in',
                        autograde: [{ type: 'exact', value: correct }],
                    },
                ],
            },
        ],
    };
}

function makeRegexQuiz(pattern: string, flags?: string): Quiz {
    return {
        id: 'test-quiz',
        title: 'Test Quiz',
        groups: [
            {
                id: 'g1',
                requireAll: true,
                questions: [
                    {
                        id: 'q1',
                        type: 'fill-blank',
                        text: 'Regex question',
                        autograde: [{ type: 'regex', pattern, flags }],
                    },
                ],
            },
        ],
    };
}

function makeMultiGroupQuiz(): Quiz {
    return {
        id: 'multi-group',
        title: 'Multi-group Quiz',
        groups: [
            {
                id: 'g1',
                requireAll: true,
                questions: [{ id: 'q1', type: 'fill-blank', text: 'Q1' }],
            },
            {
                id: 'g2',
                requireAll: true,
                questions: [{ id: 'q2', type: 'fill-blank', text: 'Q2' }],
            },
        ],
    };
}

function resetStore(quiz: Quiz | null = null) {
    useQuizStore.setState({
        quiz,
        currentGroupIndex: 0,
        submittedGroups: new Set(),
        answers: {},
        grades: {},
    });
}

// ── Tests ──────────────────────────────────────────────────────────

describe('quizStore – setQuiz / clearQuiz', () => {
    beforeEach(() => resetStore());

    test('setQuiz loads a quiz and resets all state', () => {
        const quiz = makeFillBlankQuiz('hello');
        useQuizStore.getState().setAnswer('q1', { type: 'fill-blank', value: 'old' });
        useQuizStore.getState().setQuiz(quiz);
        const state = useQuizStore.getState();
        expect(state.quiz).toBe(quiz);
        expect(state.currentGroupIndex).toBe(0);
        expect(state.submittedGroups.size).toBe(0);
        expect(Object.keys(state.answers)).toHaveLength(0);
        expect(Object.keys(state.grades)).toHaveLength(0);
    });

    test('clearQuiz removes quiz and resets state', () => {
        useQuizStore.getState().setQuiz(makeFillBlankQuiz('x'));
        useQuizStore.getState().clearQuiz();
        expect(useQuizStore.getState().quiz).toBeNull();
    });
});

describe('quizStore – setAnswer', () => {
    beforeEach(() => resetStore(makeFillBlankQuiz('hello')));

    test('records a fill-blank answer', () => {
        const answer: FillBlankAnswer = { type: 'fill-blank', value: 'hello' };
        useQuizStore.getState().setAnswer('q1', answer);
        expect(useQuizStore.getState().answers['q1']).toEqual(answer);
    });

    test('overwrites an existing answer', () => {
        useQuizStore.getState().setAnswer('q1', { type: 'fill-blank', value: 'first' });
        useQuizStore.getState().setAnswer('q1', { type: 'fill-blank', value: 'second' });
        const stored = useQuizStore.getState().answers['q1'] as FillBlankAnswer;
        expect(stored.value).toBe('second');
    });

    test('does not affect other answers', () => {
        useQuizStore.getState().setAnswer('q1', { type: 'fill-blank', value: 'a' });
        useQuizStore.getState().setAnswer('q2', { type: 'fill-blank', value: 'b' });
        expect(useQuizStore.getState().answers['q1']).toBeDefined();
        expect(useQuizStore.getState().answers['q2']).toBeDefined();
    });
});

describe('quizStore – submitGroup (autograding: exact)', () => {
    test('grades multiple-choice question correctly', () => {
        const quiz = makeMCQuiz(['A', 'B', 'C'], 'B');
        resetStore(quiz);
        const answer: MultipleChoiceAnswer = { type: 'multiple-choice', selectedIndex: 1 };
        useQuizStore.getState().setAnswer('q1', answer);
        useQuizStore.getState().submitGroup();
        expect(useQuizStore.getState().grades['q1']?.autograde).toBe('correct');
    });

    test('grades multiple-choice question incorrectly', () => {
        const quiz = makeMCQuiz(['A', 'B', 'C'], 'B');
        resetStore(quiz);
        const answer: MultipleChoiceAnswer = { type: 'multiple-choice', selectedIndex: 0 };
        useQuizStore.getState().setAnswer('q1', answer);
        useQuizStore.getState().submitGroup();
        expect(useQuizStore.getState().grades['q1']?.autograde).toBe('incorrect');
    });

    test('grades MC as pending when option value is not in options list', () => {
        const quiz = makeMCQuiz(['A', 'B'], 'Z');
        resetStore(quiz);
        useQuizStore.getState().setAnswer('q1', { type: 'multiple-choice', selectedIndex: 0 });
        useQuizStore.getState().submitGroup();
        expect(useQuizStore.getState().grades['q1']?.autograde).toBe('pending');
    });

    test('grades fill-blank correctly (exact match)', () => {
        resetStore(makeFillBlankQuiz('hello'));
        useQuizStore.getState().setAnswer('q1', { type: 'fill-blank', value: 'hello' });
        useQuizStore.getState().submitGroup();
        expect(useQuizStore.getState().grades['q1']?.autograde).toBe('correct');
    });

    test('grades fill-blank correctly (trims whitespace)', () => {
        resetStore(makeFillBlankQuiz('hello'));
        useQuizStore.getState().setAnswer('q1', { type: 'fill-blank', value: '  hello  ' });
        useQuizStore.getState().submitGroup();
        expect(useQuizStore.getState().grades['q1']?.autograde).toBe('correct');
    });

    test('grades fill-blank incorrectly', () => {
        resetStore(makeFillBlankQuiz('hello'));
        useQuizStore.getState().setAnswer('q1', { type: 'fill-blank', value: 'world' });
        useQuizStore.getState().submitGroup();
        expect(useQuizStore.getState().grades['q1']?.autograde).toBe('incorrect');
    });

    test('grades multi-fill-blank correctly', () => {
        const quiz: Quiz = {
            id: 'q',
            title: 'Q',
            groups: [
                {
                    id: 'g1',
                    requireAll: true,
                    questions: [
                        {
                            id: 'q1',
                            type: 'multi-fill-blank',
                            text: 'Fill',
                            textParts: ['def ', '(', '):'],
                            blanks: [
                                { id: 'b1', placeholder: 'name' },
                                { id: 'b2', placeholder: 'param' },
                            ],
                            autograde: [{ type: 'exact', value: 'b1:greet;b2:name' }],
                        },
                    ],
                },
            ],
        };
        resetStore(quiz);
        const answer: MultiFillBlankAnswer = {
            type: 'multi-fill-blank',
            values: { b1: 'greet', b2: 'name' },
        };
        useQuizStore.getState().setAnswer('q1', answer);
        useQuizStore.getState().submitGroup();
        expect(useQuizStore.getState().grades['q1']?.autograde).toBe('correct');
    });

    test('grades multi-fill-blank incorrectly', () => {
        const quiz: Quiz = {
            id: 'q',
            title: 'Q',
            groups: [
                {
                    id: 'g1',
                    requireAll: true,
                    questions: [
                        {
                            id: 'q1',
                            type: 'multi-fill-blank',
                            text: 'Fill',
                            textParts: ['def ', '(', '):'],
                            blanks: [
                                { id: 'b1', placeholder: 'name' },
                                { id: 'b2', placeholder: 'param' },
                            ],
                            autograde: [{ type: 'exact', value: 'b1:greet;b2:name' }],
                        },
                    ],
                },
            ],
        };
        resetStore(quiz);
        const answer: MultiFillBlankAnswer = {
            type: 'multi-fill-blank',
            values: { b1: 'wrong', b2: 'name' },
        };
        useQuizStore.getState().setAnswer('q1', answer);
        useQuizStore.getState().submitGroup();
        expect(useQuizStore.getState().grades['q1']?.autograde).toBe('incorrect');
    });

    test('grades matching correctly', () => {
        const quiz: Quiz = {
            id: 'q',
            title: 'Q',
            groups: [
                {
                    id: 'g1',
                    requireAll: true,
                    questions: [
                        {
                            id: 'q1',
                            type: 'matching',
                            text: 'Match',
                            items: [
                                { id: 'm1', left: 'A', right: 'Apple' },
                                { id: 'm2', left: 'B', right: 'Banana' },
                            ],
                            autograde: [{ type: 'exact', value: 'm1:Apple;m2:Banana' }],
                        },
                    ],
                },
            ],
        };
        resetStore(quiz);
        const answer: MatchingAnswer = {
            type: 'matching',
            mapping: { m1: 'Apple', m2: 'Banana' },
        };
        useQuizStore.getState().setAnswer('q1', answer);
        useQuizStore.getState().submitGroup();
        expect(useQuizStore.getState().grades['q1']?.autograde).toBe('correct');
    });

    test('grades matching incorrectly when one item is wrong', () => {
        const quiz: Quiz = {
            id: 'q',
            title: 'Q',
            groups: [
                {
                    id: 'g1',
                    requireAll: true,
                    questions: [
                        {
                            id: 'q1',
                            type: 'matching',
                            text: 'Match',
                            items: [
                                { id: 'm1', left: 'A', right: 'Apple' },
                                { id: 'm2', left: 'B', right: 'Banana' },
                            ],
                            autograde: [{ type: 'exact', value: 'm1:Apple;m2:Banana' }],
                        },
                    ],
                },
            ],
        };
        resetStore(quiz);
        const answer: MatchingAnswer = {
            type: 'matching',
            mapping: { m1: 'Apple', m2: 'Cherry' },
        };
        useQuizStore.getState().setAnswer('q1', answer);
        useQuizStore.getState().submitGroup();
        expect(useQuizStore.getState().grades['q1']?.autograde).toBe('incorrect');
    });
});

describe('quizStore – submitGroup (autograding: regex)', () => {
    test('regex match marks as correct', () => {
        resetStore(makeRegexQuiz('^\\s*3\\s*$'));
        useQuizStore.getState().setAnswer('q1', { type: 'fill-blank', value: '3' });
        useQuizStore.getState().submitGroup();
        expect(useQuizStore.getState().grades['q1']?.autograde).toBe('correct');
    });

    test('regex non-match marks as incorrect', () => {
        resetStore(makeRegexQuiz('^\\s*3\\s*$'));
        useQuizStore.getState().setAnswer('q1', { type: 'fill-blank', value: '4' });
        useQuizStore.getState().submitGroup();
        expect(useQuizStore.getState().grades['q1']?.autograde).toBe('incorrect');
    });

    test('regex is case-insensitive by default', () => {
        resetStore(makeRegexQuiz('hello'));
        useQuizStore.getState().setAnswer('q1', { type: 'fill-blank', value: 'HELLO' });
        useQuizStore.getState().submitGroup();
        expect(useQuizStore.getState().grades['q1']?.autograde).toBe('correct');
    });

    test('regex matches free-response answer', () => {
        const quiz: Quiz = {
            id: 'q',
            title: 'Q',
            groups: [
                {
                    id: 'g1',
                    requireAll: true,
                    questions: [
                        {
                            id: 'q1',
                            type: 'free-response',
                            text: 'Describe',
                            autograde: [{ type: 'regex', pattern: 'function' }],
                        },
                    ],
                },
            ],
        };
        resetStore(quiz);
        const answer: FreeResponseAnswer = { type: 'free-response', value: 'uses a function' };
        useQuizStore.getState().setAnswer('q1', answer);
        useQuizStore.getState().submitGroup();
        expect(useQuizStore.getState().grades['q1']?.autograde).toBe('correct');
    });

    test('invalid regex falls through to pending', () => {
        resetStore(makeRegexQuiz('[invalid'));
        useQuizStore.getState().setAnswer('q1', { type: 'fill-blank', value: 'anything' });
        useQuizStore.getState().submitGroup();
        expect(useQuizStore.getState().grades['q1']?.autograde).toBe('pending');
    });
});

describe('quizStore – submitGroup (autograding: code / no strategy)', () => {
    test('code strategy always returns pending', () => {
        const quiz: Quiz = {
            id: 'q',
            title: 'Q',
            groups: [
                {
                    id: 'g1',
                    requireAll: true,
                    questions: [
                        {
                            id: 'q1',
                            type: 'fill-blank',
                            text: 'Code question',
                            autograde: [{ type: 'code', code: 'return student.x === 1;' }],
                        },
                    ],
                },
            ],
        };
        resetStore(quiz);
        useQuizStore.getState().setAnswer('q1', { type: 'fill-blank', value: '1' });
        useQuizStore.getState().submitGroup();
        expect(useQuizStore.getState().grades['q1']?.autograde).toBe('pending');
    });

    test('no autograde strategy yields pending', () => {
        const quiz: Quiz = {
            id: 'q',
            title: 'Q',
            groups: [
                {
                    id: 'g1',
                    requireAll: true,
                    questions: [{ id: 'q1', type: 'free-response', text: 'Describe' }],
                },
            ],
        };
        resetStore(quiz);
        const answer: FreeResponseAnswer = { type: 'free-response', value: 'some text' };
        useQuizStore.getState().setAnswer('q1', answer);
        useQuizStore.getState().submitGroup();
        expect(useQuizStore.getState().grades['q1']?.autograde).toBe('pending');
    });

    test('unanswered question is not graded', () => {
        resetStore(makeFillBlankQuiz('hello'));
        // No answer set for q1
        useQuizStore.getState().submitGroup();
        expect(useQuizStore.getState().grades['q1']).toBeUndefined();
    });
});

describe('quizStore – submitGroup (group locking)', () => {
    test('adds group index to submittedGroups', () => {
        resetStore(makeFillBlankQuiz('x'));
        useQuizStore.getState().setAnswer('q1', { type: 'fill-blank', value: 'x' });
        useQuizStore.getState().submitGroup();
        expect(useQuizStore.getState().submittedGroups.has(0)).toBe(true);
    });

    test('does nothing when quiz is null', () => {
        resetStore(null);
        useQuizStore.getState().submitGroup();
        expect(useQuizStore.getState().submittedGroups.size).toBe(0);
    });
});

describe('quizStore – advanceGroup / goToGroup', () => {
    test('advanceGroup increments currentGroupIndex', () => {
        resetStore(makeMultiGroupQuiz());
        useQuizStore.getState().advanceGroup();
        expect(useQuizStore.getState().currentGroupIndex).toBe(1);
    });

    test('advanceGroup does not go past last group', () => {
        resetStore(makeMultiGroupQuiz());
        useQuizStore.getState().advanceGroup();
        useQuizStore.getState().advanceGroup();
        expect(useQuizStore.getState().currentGroupIndex).toBe(1);
    });

    test('advanceGroup is a no-op when quiz is null', () => {
        resetStore(null);
        useQuizStore.getState().advanceGroup();
        expect(useQuizStore.getState().currentGroupIndex).toBe(0);
    });

    test('goToGroup jumps to a valid index', () => {
        resetStore(makeMultiGroupQuiz());
        useQuizStore.getState().goToGroup(1);
        expect(useQuizStore.getState().currentGroupIndex).toBe(1);
    });

    test('goToGroup ignores out-of-bounds index', () => {
        resetStore(makeMultiGroupQuiz());
        useQuizStore.getState().goToGroup(99);
        expect(useQuizStore.getState().currentGroupIndex).toBe(0);
    });

    test('goToGroup ignores negative index', () => {
        resetStore(makeMultiGroupQuiz());
        useQuizStore.getState().goToGroup(-1);
        expect(useQuizStore.getState().currentGroupIndex).toBe(0);
    });

    test('goToGroup is a no-op when quiz is null', () => {
        resetStore(null);
        useQuizStore.getState().goToGroup(0);
        expect(useQuizStore.getState().currentGroupIndex).toBe(0);
    });
});

describe('quizStore – setRubricScore / setRubricComment', () => {
    test('setRubricScore creates a grade entry if none exists', () => {
        resetStore(makeFillBlankQuiz('x'));
        useQuizStore.getState().setRubricScore('q1', 'r1', 2);
        expect(useQuizStore.getState().grades['q1']?.rubricScores?.['r1']).toBe(2);
    });

    test('setRubricScore updates an existing grade entry', () => {
        resetStore(makeFillBlankQuiz('x'));
        useQuizStore.getState().setAnswer('q1', { type: 'fill-blank', value: 'x' });
        useQuizStore.getState().submitGroup();
        useQuizStore.getState().setRubricScore('q1', 'r1', 3);
        expect(useQuizStore.getState().grades['q1']?.rubricScores?.['r1']).toBe(3);
    });

    test('setRubricScore does not overwrite other criteria', () => {
        resetStore(makeFillBlankQuiz('x'));
        useQuizStore.getState().setRubricScore('q1', 'r1', 2);
        useQuizStore.getState().setRubricScore('q1', 'r2', 1);
        expect(useQuizStore.getState().grades['q1']?.rubricScores?.['r1']).toBe(2);
        expect(useQuizStore.getState().grades['q1']?.rubricScores?.['r2']).toBe(1);
    });

    test('setRubricComment stores feedback text', () => {
        resetStore(makeFillBlankQuiz('x'));
        useQuizStore.getState().setRubricComment('q1', 'r1', 'Great work!');
        expect(useQuizStore.getState().grades['q1']?.rubricComments?.['r1']).toBe('Great work!');
    });

    test('setRubricComment preserves other comments', () => {
        resetStore(makeFillBlankQuiz('x'));
        useQuizStore.getState().setRubricComment('q1', 'r1', 'Good');
        useQuizStore.getState().setRubricComment('q1', 'r2', 'Could improve');
        expect(useQuizStore.getState().grades['q1']?.rubricComments?.['r1']).toBe('Good');
        expect(useQuizStore.getState().grades['q1']?.rubricComments?.['r2']).toBe('Could improve');
    });
});
