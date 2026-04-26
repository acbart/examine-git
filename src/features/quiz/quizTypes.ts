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
 * - `exact`       – compare the trimmed answer against a fixed string.
 * - `regex`       – test the answer against a regular expression.
 * - `code`        – run arbitrary code in the project execution context (stubbed).
 * - `branch-diff` – inspect the submitted task branch against a set of checks.
 */
export type AutogradeStrategy =
  | { type: 'exact'; value: string }
  | { type: 'regex'; pattern: string; flags?: string }
  | { type: 'code'; code: string }
  | { type: 'branch-diff'; checks: BranchCheck[] };

// ── Branch-diff checks (for task questions) ───────────────────────

/** A single check run against the submitted task branch. */
export type BranchCheck =
  | { type: 'fileContains'; path: string; pattern: string }
  | { type: 'fileMatches'; path: string; pattern: string; flags?: string }
  | { type: 'commitCount'; min?: number; max?: number }
  | { type: 'fileExists'; path: string };

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

// ── Task question ─────────────────────────────────────────────────

export interface StarterPatch {
  path: string;
  content: string;
}

/**
 * A question where the student must modify code on a dedicated Git branch
 * and submit that branch as their answer.
 *
 * `baseBranch` may be a literal branch name (e.g. `"main"`) **or** a
 * reference to another task question's submitted branch so that tasks can
 * be chained.
 */
export interface TaskQuestion extends QuestionBase {
  type: 'task';
  /**
   * The branch (or the submitted branch of another task) to branch from.
   * If `{ fromTask: '<questionId>' }` is used, the referenced task must be
   * submitted before this one can be started.
   */
  baseBranch: string | { fromTask: string };
  /** Prefix used when auto-generating the working branch name. */
  taskBranchPrefix?: string;
  /** Extra file-line references displayed as clickable links in the task UI. */
  fileHints?: LineReference[];
  /** Files that must be modified for the answer to be considered valid. */
  requiredFiles?: string[];
  /**
   * Optional file content to apply as an initial commit on the task branch
   * before the student starts working.
   */
  starterPatches?: StarterPatch[];
}

export type Question =
  | MultipleChoiceQuestion
  | FillBlankQuestion
  | MultiFillBlankQuestion
  | MatchingQuestion
  | FreeResponseQuestion
  | TaskQuestion;

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
export type TaskAnswer = {
  type: 'task';
  /** Name of the branch the student submitted. */
  submittedBranch: string;
  /** Number of commits above the base at submission time. */
  commitCount: number;
};

export type UserAnswer =
  | MultipleChoiceAnswer
  | FillBlankAnswer
  | MultiFillBlankAnswer
  | MatchingAnswer
  | FreeResponseAnswer
  | TaskAnswer;

// ── Task state (internal to the store) ───────────────────────────

/**
 * Runtime state for a single task question, kept in the quiz store.
 * This is not part of the `Question` definition – it tracks the student's
 * progress while working.
 */
export interface TaskState {
  status: 'not-started' | 'in-progress' | 'submitted';
  /** The working branch created for this task, or null if not yet started. */
  workingBranch: string | null;
  /**
   * Number of commits on the working branch when the task was first started
   * (after any starter patches are applied).  Student commits = current count
   * minus this value.
   */
  baseCommitCount: number;
  /**
   * Snapshot of file contents that differed from the branch HEAD when the
   * student last paused the task, so they can be restored on resume.
   */
  uncommittedChanges: Record<string, string>;
}

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
  /** For task questions: the branch name submitted as the answer. */
  submittedBranch?: string;
}
