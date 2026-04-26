// ── Line references ───────────────────────────────────────────────

/** A reference to a specific line in a project file. */
export interface LineReference {
  path: string;
  line: number;
  label?: string;
}

// ── Autograding strategies ────────────────────────────────────────

/**
 * Strategies used to automatically grade a question.
 *
 * - `exact`  – compare the trimmed answer against a fixed string.
 * - `regex`  – test the answer against a regular expression.
 * - `code`   – run arbitrary code in the project execution context (stubbed).
 */
export type AutogradeStrategy =
  | { type: 'exact'; value: string }
  | { type: 'regex'; pattern: string; flags?: string }
  | { type: 'code'; code: string };

// ── Manual grading (rubrics) ──────────────────────────────────────

export interface RubricCriterion {
  id: string;
  description: string;
  points: number;
}

export interface Rubric {
  criteria: RubricCriterion[];
}

// ── Question types ────────────────────────────────────────────────

/**
 * Base fields shared by every question kind.
 *
 * Inline line-references can be embedded in `text` using the syntax
 * `{link:path#line:label}` – the QuizPanel will render them as
 * clickable links that jump the editor to the referenced line.
 *
 * Explicit, labelled references may also be listed in `lineRefs` and
 * are rendered as a dedicated "Code References" section.
 */
interface QuestionBase {
  id: string;
  /** Prompt text; may contain `{link:path#line:label}` tokens. */
  text: string;
  lineRefs?: LineReference[];
  autograde?: AutogradeStrategy[];
  rubric?: Rubric;
}

export interface MultipleChoiceQuestion extends QuestionBase {
  type: 'multiple-choice';
  options: string[];
}

export interface FillBlankQuestion extends QuestionBase {
  type: 'fill-blank';
  placeholder?: string;
}

export interface Blank {
  id: string;
  placeholder?: string;
}

/**
 * A fill-in-the-blank question with multiple blanks.
 *
 * Text is split into `textParts` interleaved with `blanks`:
 *   textParts[0]  blank[0]  textParts[1]  blank[1]  …  textParts[n]
 */
export interface MultiFillBlankQuestion extends QuestionBase {
  type: 'multi-fill-blank';
  textParts: string[];
  blanks: Blank[];
}

export interface MatchItem {
  id: string;
  left: string;
  right: string;
}

export interface MatchingQuestion extends QuestionBase {
  type: 'matching';
  items: MatchItem[];
}

export interface FreeResponseQuestion extends QuestionBase {
  type: 'free-response';
}

export type Question =
  | MultipleChoiceQuestion
  | FillBlankQuestion
  | MultiFillBlankQuestion
  | MatchingQuestion
  | FreeResponseQuestion;

// ── Question groups ───────────────────────────────────────────────

export interface QuestionGroup {
  id: string;
  title?: string;
  questions: Question[];
  /** When true every question must be answered before the group can be submitted. */
  requireAll: boolean;
  /** When requireAll is false, the minimum number that must be answered. */
  minRequired?: number;
}

export interface Quiz {
  id: string;
  title: string;
  description?: string;
  groups: QuestionGroup[];
}

// ── User answers ──────────────────────────────────────────────────

export type MultipleChoiceAnswer = { type: 'multiple-choice'; selectedIndex: number };
export type FillBlankAnswer = { type: 'fill-blank'; value: string };
export type MultiFillBlankAnswer = { type: 'multi-fill-blank'; values: Record<string, string> };
export type MatchingAnswer = { type: 'matching'; mapping: Record<string, string> };
export type FreeResponseAnswer = { type: 'free-response'; value: string };

export type UserAnswer =
  | MultipleChoiceAnswer
  | FillBlankAnswer
  | MultiFillBlankAnswer
  | MatchingAnswer
  | FreeResponseAnswer;

// ── Grading results ───────────────────────────────────────────────

export type AutogradeResult = 'correct' | 'incorrect' | 'pending';

export interface GradeResult {
  questionId: string;
  /** `'pending'` when no autograde strategy produced a definitive result. */
  autograde: AutogradeResult;
  feedback?: string;
  /** Scores awarded per rubric criterion id. */
  rubricScores?: Record<string, number>;
  rubricComments?: Record<string, string>;
}
