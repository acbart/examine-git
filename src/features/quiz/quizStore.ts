import { create } from 'zustand';
import type { Quiz, QuizQuestion, StudentAnswer, QuestionType } from './quizTypes';

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function makeQuestion(type: QuestionType): QuizQuestion {
  return {
    id: generateId(),
    type,
    prompt: '',
    lineReferences: [],
    choices: type === 'multiple-choice' ? ['', '', '', ''] : [],
  };
}

const SAMPLE_QUIZ: Quiz = {
  id: 'sample',
  title: 'Code Review Quiz',
  description: 'Answer the following questions about the code in the editor.',
  questions: [
    {
      id: 'q1',
      type: 'essay',
      prompt: 'Describe what the `add` function does and how it is used.',
      lineReferences: [{ filePath: 'src/main.ts', line: 5, label: 'add function' }],
      choices: [],
    },
    {
      id: 'q2',
      type: 'true-false',
      prompt: 'The `greeting` variable is declared with `const`.',
      lineReferences: [{ filePath: 'src/main.ts', line: 2, label: 'greeting declaration' }],
      choices: [],
    },
    {
      id: 'q3',
      type: 'multiple-choice',
      prompt: 'What type does the `add` function return?',
      lineReferences: [{ filePath: 'src/main.ts', line: 5, label: 'add function signature' }],
      choices: ['string', 'void', 'number', 'boolean'],
    },
  ],
};

type QuizMode = 'student' | 'instructor';

interface QuizStoreState {
  quiz: Quiz | null;
  answers: Record<string, StudentAnswer>;
  mode: QuizMode;
  /** Index of the question currently being edited (instructor mode) */
  editingQuestionId: string | null;
  setQuiz: (quiz: Quiz | null) => void;
  setMode: (mode: QuizMode) => void;
  setAnswer: (questionId: string, value: StudentAnswer) => void;
  clearAnswers: () => void;
  addQuestion: (type: QuestionType) => void;
  updateQuestion: (id: string, patch: Partial<Omit<QuizQuestion, 'id'>>) => void;
  removeQuestion: (id: string) => void;
  setEditingQuestion: (id: string | null) => void;
  updateQuizMeta: (patch: Partial<Pick<Quiz, 'title' | 'description'>>) => void;
}

export const useQuizStore = create<QuizStoreState>()((set, get) => ({
  quiz: SAMPLE_QUIZ,
  answers: {},
  mode: 'student',
  editingQuestionId: null,

  setQuiz: (quiz) => set({ quiz, answers: {} }),

  setMode: (mode) => set({ mode, editingQuestionId: null }),

  setAnswer: (questionId, value) =>
    set((state) => ({ answers: { ...state.answers, [questionId]: value } })),

  clearAnswers: () => set({ answers: {} }),

  addQuestion: (type) => {
    const question = makeQuestion(type);
    set((state) => {
      if (state.quiz === null) return state;
      return {
        quiz: { ...state.quiz, questions: [...state.quiz.questions, question] },
        editingQuestionId: question.id,
      };
    });
  },

  updateQuestion: (id, patch) =>
    set((state) => {
      if (state.quiz === null) return state;
      return {
        quiz: {
          ...state.quiz,
          questions: state.quiz.questions.map((q) =>
            q.id === id ? { ...q, ...patch } : q
          ),
        },
      };
    }),

  removeQuestion: (id) =>
    set((state) => {
      if (state.quiz === null) return state;
      return {
        quiz: {
          ...state.quiz,
          questions: state.quiz.questions.filter((q) => q.id !== id),
        },
        editingQuestionId:
          state.editingQuestionId === id ? null : state.editingQuestionId,
      };
    }),

  setEditingQuestion: (id) => set({ editingQuestionId: id }),

  updateQuizMeta: (patch) =>
    set((state) => {
      if (state.quiz === null) return state;
      return { quiz: { ...state.quiz, ...patch } };
    }),
}));

export { makeQuestion, generateId };
export type { QuizMode };
