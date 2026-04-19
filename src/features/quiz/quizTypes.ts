export type QuestionType = 'essay' | 'true-false' | 'multiple-choice';

export interface LineReference {
  filePath: string;
  line: number;
  label?: string;
}

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  lineReferences: LineReference[];
  /** Only used for multiple-choice questions */
  choices: string[];
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  questions: QuizQuestion[];
}

export type StudentAnswer = string | boolean | number | null;
