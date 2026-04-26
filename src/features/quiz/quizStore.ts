import { create } from 'zustand';
import type {
  Quiz,
  Question,
  UserAnswer,
  GradeResult,
  AutogradeStrategy,
  AutogradeResult,
} from './quizTypes';

// ── Autograding (stubbed) ─────────────────────────────────────────

/**
 * Runs the provided autograding strategies against a user answer.
 *
 * The `code` strategy is intentionally stubbed – real execution must
 * happen inside the project's sandboxed iframe environment and will
 * be wired in a future iteration.
 */
function runAutograde(
  question: Question,
  answer: UserAnswer,
  strategies: AutogradeStrategy[],
): AutogradeResult {
  for (const strategy of strategies) {
    switch (strategy.type) {
      case 'exact': {
        if (answer.type === 'multiple-choice') {
          const mc = question as Extract<Question, { type: 'multiple-choice' }>;
          const correctIndex = mc.options.indexOf(strategy.value);
          if (correctIndex === -1) break;
          return answer.selectedIndex === correctIndex ? 'correct' : 'incorrect';
        }
        if (answer.type === 'fill-blank') {
          return answer.value.trim() === strategy.value.trim() ? 'correct' : 'incorrect';
        }
        if (answer.type === 'multi-fill-blank') {
          // `value` encodes blankId=expected pairs as "id1:val1;id2:val2"
          const expected = Object.fromEntries(
            strategy.value.split(';').map((pair) => pair.split(':') as [string, string]),
          );
          const allCorrect = Object.entries(expected).every(
            ([id, val]) => (answer.values[id] ?? '').trim() === val.trim(),
          );
          return allCorrect ? 'correct' : 'incorrect';
        }
        if (answer.type === 'matching') {
          // `value` encodes id=right pairs as "id1:right1;id2:right2"
          const expected = Object.fromEntries(
            strategy.value.split(';').map((pair) => pair.split(':') as [string, string]),
          );
          const allCorrect = Object.entries(expected).every(
            ([id, right]) => (answer.mapping[id] ?? '').trim() === right.trim(),
          );
          return allCorrect ? 'correct' : 'incorrect';
        }
        break;
      }

      case 'regex': {
        let subject: string | null = null;
        if (answer.type === 'fill-blank') subject = answer.value;
        if (answer.type === 'free-response') subject = answer.value;
        if (subject !== null) {
          try {
            const re = new RegExp(strategy.pattern, strategy.flags ?? 'i');
            return re.test(subject) ? 'correct' : 'incorrect';
          } catch {
            // Invalid regex – treat as pending
          }
        }
        break;
      }

      case 'code': {
        // TODO: execute `strategy.code` inside the project execution sandbox
        // (the iframe environment used by executionStore) with access to the
        // student's current file contents.  Return 'correct' | 'incorrect'
        // based on the result.
        return 'pending';
      }
    }
  }
  return 'pending';
}

function gradeAnswer(question: Question, answer: UserAnswer): GradeResult {
  const strategies = question.autograde ?? [];
  const autograde =
    strategies.length > 0 ? runAutograde(question, answer, strategies) : 'pending';
  return { questionId: question.id, autograde };
}

// ── Demo quiz ─────────────────────────────────────────────────────

const DEMO_QUIZ: Quiz = {
  id: 'demo',
  title: 'Project Walkthrough Quiz',
  description: 'A short quiz about the starter project files.',
  groups: [
    {
      id: 'group-1',
      title: 'Understanding main.ts',
      requireAll: true,
      questions: [
        {
          id: 'q1',
          type: 'multiple-choice',
          text: 'What is the TypeScript type of the {link:src/main.ts#2:greeting} variable declared on line 2?',
          options: ['string', 'number', 'boolean', 'any'],
          autograde: [{ type: 'exact', value: 'string' }],
        },
        {
          id: 'q2',
          type: 'fill-blank',
          text: 'What value does {link:src/main.ts#9:add(1, 2)} return? (enter just the number)',
          placeholder: 'e.g. 42',
          autograde: [
            { type: 'exact', value: '3' },
            { type: 'regex', pattern: '^\\s*3\\s*$' },
          ],
          lineRefs: [{ path: 'src/main.ts', line: 5, label: 'add function definition' }],
        },
        {
          id: 'q3',
          type: 'free-response',
          text: 'In your own words, describe what src/main.ts does.',
          rubric: {
            criteria: [
              { id: 'r1', description: 'Mentions the greeting variable', points: 1 },
              { id: 'r2', description: 'Mentions the add function', points: 1 },
              { id: 'r3', description: 'Clear and complete explanation', points: 2 },
            ],
          },
        },
      ],
    },
    {
      id: 'group-2',
      title: 'Understanding app.py',
      requireAll: false,
      minRequired: 2,
      questions: [
        {
          id: 'q4',
          type: 'matching',
          text: 'Match each {link:src/app.py#1:Python} element to its description.',
          items: [
            { id: 'm1', left: 'greet', right: 'A function that builds a greeting string' },
            { id: 'm2', left: '`name` parameter', right: 'The recipient of the greeting' },
            { id: 'm3', left: '__main__ block', right: 'Entry point when the script is run directly' },
          ],
          lineRefs: [
            { path: 'src/app.py', line: 5, label: 'greet function' },
            { path: 'src/app.py', line: 9, label: '__main__ block' },
          ],
        },
        {
          id: 'q5',
          type: 'multi-fill-blank',
          text: 'Complete the function signature below:',
          textParts: ['def ', '(', ': str) -> str:'],
          blanks: [
            { id: 'b1', placeholder: 'function name' },
            { id: 'b2', placeholder: 'parameter name' },
          ],
          autograde: [{ type: 'exact', value: 'b1:greet;b2:name' }],
          lineRefs: [{ path: 'src/app.py', line: 5, label: 'function signature' }],
        },
        {
          id: 'q6',
          type: 'free-response',
          text: 'How would you modify greet() to accept a title (e.g. "Dr.") as an optional second argument?',
          rubric: {
            criteria: [
              { id: 'r1', description: 'Adds an optional parameter with a default value', points: 2 },
              { id: 'r2', description: 'Includes the title in the returned string', points: 1 },
            ],
          },
        },
      ],
    },
  ],
};

// ── Store ─────────────────────────────────────────────────────────

interface QuizState {
  quiz: Quiz | null;
  currentGroupIndex: number;
  /** Indices of groups that have been submitted (locked for editing). */
  submittedGroups: Set<number>;
  answers: Record<string, UserAnswer>;
  grades: Record<string, GradeResult>;

  setQuiz: (quiz: Quiz) => void;
  clearQuiz: () => void;
  setAnswer: (questionId: string, answer: UserAnswer) => void;
  submitGroup: () => void;
  advanceGroup: () => void;
  goToGroup: (index: number) => void;
  setRubricScore: (questionId: string, criterionId: string, score: number) => void;
  setRubricComment: (questionId: string, criterionId: string, comment: string) => void;
}

export const useQuizStore = create<QuizState>()((set, get) => ({
  quiz: DEMO_QUIZ,
  currentGroupIndex: 0,
  submittedGroups: new Set(),
  answers: {},
  grades: {},

  setQuiz: (quiz) =>
    set({ quiz, currentGroupIndex: 0, submittedGroups: new Set(), answers: {}, grades: {} }),

  clearQuiz: () =>
    set({ quiz: null, currentGroupIndex: 0, submittedGroups: new Set(), answers: {}, grades: {} }),

  setAnswer: (questionId, answer) =>
    set((state) => ({ answers: { ...state.answers, [questionId]: answer } })),

  submitGroup: () => {
    const { quiz, currentGroupIndex, answers, submittedGroups } = get();
    if (!quiz) return;
    const group = quiz.groups[currentGroupIndex];
    if (!group) return;

    const newGrades: Record<string, GradeResult> = {};
    for (const question of group.questions) {
      const answer = answers[question.id];
      if (answer) {
        newGrades[question.id] = gradeAnswer(question, answer);
      }
    }

    const newSubmitted = new Set(submittedGroups);
    newSubmitted.add(currentGroupIndex);

    set((state) => ({
      grades: { ...state.grades, ...newGrades },
      submittedGroups: newSubmitted,
    }));
  },

  advanceGroup: () => {
    const { quiz, currentGroupIndex } = get();
    if (!quiz) return;
    if (currentGroupIndex < quiz.groups.length - 1) {
      set({ currentGroupIndex: currentGroupIndex + 1 });
    }
  },

  goToGroup: (index) => {
    const { quiz } = get();
    if (!quiz) return;
    if (index >= 0 && index < quiz.groups.length) {
      set({ currentGroupIndex: index });
    }
  },

  setRubricScore: (questionId, criterionId, score) =>
    set((state) => {
      const existing = state.grades[questionId] ?? {
        questionId,
        autograde: 'pending' as AutogradeResult,
      };
      return {
        grades: {
          ...state.grades,
          [questionId]: {
            ...existing,
            rubricScores: { ...(existing.rubricScores ?? {}), [criterionId]: score },
          },
        },
      };
    }),

  setRubricComment: (questionId, criterionId, comment) =>
    set((state) => {
      const existing = state.grades[questionId] ?? {
        questionId,
        autograde: 'pending' as AutogradeResult,
      };
      return {
        grades: {
          ...state.grades,
          [questionId]: {
            ...existing,
            rubricComments: { ...(existing.rubricComments ?? {}), [criterionId]: comment },
          },
        },
      };
    }),
}));
