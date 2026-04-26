import { create } from 'zustand';
import type {
  Quiz,
  Question,
  TaskQuestion,
  UserAnswer,
  TaskAnswer,
  GradeResult,
  AutogradeStrategy,
  AutogradeResult,
  BranchCheck,
  TaskState,
} from './quizTypes';
import { useGitStore } from '../git/gitStore';
import { useFilesystemStore } from '../filesystem/filesystemStore';

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
          // Split only on the first colon to allow colons in values.
          const expected = Object.fromEntries(
            strategy.value.split(';').map((pair) => {
              const idx = pair.indexOf(':');
              return idx === -1
                ? ([pair, ''] as [string, string])
                : ([pair.slice(0, idx), pair.slice(idx + 1)] as [string, string]);
            }),
          );
          const allCorrect = Object.entries(expected).every(
            ([id, val]) => (answer.values[id] ?? '').trim() === val.trim(),
          );
          return allCorrect ? 'correct' : 'incorrect';
        }
        if (answer.type === 'matching') {
          // `value` encodes id=right pairs as "id1:right1;id2:right2"
          // Split only on the first colon to allow colons in right-side values.
          const expected = Object.fromEntries(
            strategy.value.split(';').map((pair) => {
              const idx = pair.indexOf(':');
              return idx === -1
                ? ([pair, ''] as [string, string])
                : ([pair.slice(0, idx), pair.slice(idx + 1)] as [string, string]);
            }),
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

      case 'branch-diff': {
        // branch-diff is evaluated separately in runBranchDiffAutograde.
        break;
      }
    }
  }
  return 'pending';
}

/**
 * Runs `branch-diff` autograde checks for a task question.
 * `branchFiles` is the reconstructed file map of the submitted branch,
 * `commitCount` is the number of commits above the base.
 */
function runBranchDiffAutograde(
  checks: BranchCheck[],
  branchFiles: Record<string, string>,
  commitCount: number,
): AutogradeResult {
  for (const check of checks) {
    switch (check.type) {
      case 'fileExists':
        if (!(check.path in branchFiles)) return 'incorrect';
        break;
      case 'fileContains':
        if (!(branchFiles[check.path] ?? '').includes(check.pattern)) return 'incorrect';
        break;
      case 'fileMatches': {
        try {
          const re = new RegExp(check.pattern, check.flags ?? '');
          if (!re.test(branchFiles[check.path] ?? '')) return 'incorrect';
        } catch {
          return 'pending';
        }
        break;
      }
      case 'commitCount': {
        if (check.min !== undefined && commitCount < check.min) return 'incorrect';
        if (check.max !== undefined && commitCount > check.max) return 'incorrect';
        break;
      }
    }
  }
  return 'correct';
}

/**
 * Grades a task question's autograde strategies at submission time.
 * Only `branch-diff` strategies are evaluated; other strategy types are skipped.
 */
function gradeTaskAnswer(
  strategies: AutogradeStrategy[],
  branchFiles: Record<string, string>,
  commitCount: number,
): AutogradeResult {
  for (const strategy of strategies) {
    if (strategy.type === 'branch-diff') {
      return runBranchDiffAutograde(strategy.checks, branchFiles, commitCount);
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
    {
      id: 'group-3',
      title: 'Add a multiply function',
      requireAll: true,
      questions: [
        {
          id: 'q7',
          type: 'task',
          text: 'Add a `multiply(a, b)` function to {link:src/main.ts#5:src/main.ts} that returns the product of two numbers. Then call it with the arguments `3` and `4` and log the result.',
          baseBranch: 'main',
          fileHints: [{ path: 'src/main.ts', line: 5, label: 'add function (for reference)' }],
          requiredFiles: ['src/main.ts'],
          autograde: [
            {
              type: 'branch-diff',
              checks: [
                { type: 'fileContains', path: 'src/main.ts', pattern: 'multiply' },
                { type: 'commitCount', min: 1 },
              ],
            },
          ],
          rubric: {
            criteria: [
              { id: 'r1', description: 'multiply function is defined and correct', points: 2 },
              { id: 'r2', description: 'multiply is called and result is logged', points: 1 },
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
  answers: Record<string, UserAnswer | undefined>;
  grades: Record<string, GradeResult | undefined>;
  /** Per-question runtime state for task questions. */
  taskStates: Record<string, TaskState | undefined>;
  /** The question id of the task currently being worked on, or null. */
  activeTaskId: string | null;

  setQuiz: (quiz: Quiz) => void;
  clearQuiz: () => void;
  setAnswer: (questionId: string, answer: UserAnswer) => void;
  submitGroup: () => void;
  advanceGroup: () => void;
  goToGroup: (index: number) => void;
  setRubricScore: (questionId: string, criterionId: string, score: number) => void;
  setRubricComment: (questionId: string, criterionId: string, comment: string) => void;

  // ── Task actions ──────────────────────────────────────────────
  /** Start a new task (or resume a paused one). */
  startTask: (questionId: string) => void;
  /** Pause the active task, snapshotting any uncommitted changes. */
  pauseTask: () => void;
  /** Resume a previously paused task. */
  resumeTask: (questionId: string) => void;
  /** Submit the active task branch as the answer. */
  submitTask: (questionId: string) => void;
  /**
   * Save a checkpoint commit in novice mode:
   * stages all files and commits with a timestamped message.
   */
  saveCheckpoint: (questionId: string) => void;
  /** Reopen a submitted task so the student can continue working on it. */
  reopenTask: (questionId: string) => void;
}

export const useQuizStore = create<QuizState>()((set, get) => ({
  quiz: DEMO_QUIZ,
  currentGroupIndex: 0,
  submittedGroups: new Set(),
  answers: {},
  grades: {},
  taskStates: {},
  activeTaskId: null,

  setQuiz: (quiz) =>
    set({
      quiz,
      currentGroupIndex: 0,
      submittedGroups: new Set(),
      answers: {},
      grades: {},
      taskStates: {},
      activeTaskId: null,
    }),

  clearQuiz: () =>
    set({
      quiz: null,
      currentGroupIndex: 0,
      submittedGroups: new Set(),
      answers: {},
      grades: {},
      taskStates: {},
      activeTaskId: null,
    }),

  setAnswer: (questionId, answer) =>
    set((state) => ({ answers: { ...state.answers, [questionId]: answer } })),

  submitGroup: () => {
    const { quiz, currentGroupIndex, answers, submittedGroups } = get();
    if (!quiz) return;
    const group = quiz.groups[currentGroupIndex];

    const newGrades: Record<string, GradeResult> = {};
    for (const question of group.questions) {
      const answer = answers[question.id];
      if (answer !== undefined) {
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

  // ── Task actions ────────────────────────────────────────────────

  startTask: (questionId) => {
    const state = get();
    const quiz = state.quiz;
    if (!quiz) return;

    const question = quiz.groups
      .flatMap((g) => g.questions)
      .find((q) => q.id === questionId) as TaskQuestion | undefined;
    if (!question) return;

    // Pause any other active task first.
    if (state.activeTaskId !== null && state.activeTaskId !== questionId) {
      get().pauseTask();
    }

    // If already in-progress, delegate to resumeTask.
    const existing = state.taskStates[questionId];
    if (existing?.status === 'in-progress') {
      get().resumeTask(questionId);
      return;
    }

    // Do not restart a submitted task.
    if (existing?.status === 'submitted') return;

    // Resolve base branch.
    let baseBranch: string;
    if (typeof question.baseBranch === 'string') {
      baseBranch = question.baseBranch;
    } else {
      const depId = question.baseBranch.fromTask;
      const depTask = state.taskStates[depId];
      if (!depTask || depTask.status !== 'submitted') return;
      const depAnswer = state.answers[depId];
      if (!depAnswer || depAnswer.type !== 'task') return;
      baseBranch = depAnswer.submittedBranch;
    }

    // Generate a unique branch name.
    const branchName = question.taskBranchPrefix ?? `task/${quiz.id}/${questionId}`;
    const gitStore = useGitStore.getState();

    // Create the branch off the base (no-op if it already exists from a prior session).
    if (!gitStore.repo.branches[branchName]) {
      const created = gitStore.createBranchFrom(branchName, baseBranch);
      if (!created) return;
    }

    // Checkout and update the filesystem.
    gitStore.checkoutBranch(branchName);

    // Apply starterPatches as an initial commit, if present.
    if (question.starterPatches && question.starterPatches.length > 0) {
      const fsStore = useFilesystemStore.getState();
      for (const patch of question.starterPatches) {
        fsStore.writeFile(patch.path, patch.content);
      }
      const fileContents: Record<string, string> = {};
      for (const f of useFilesystemStore.getState().listFiles()) {
        fileContents[f.path] = f.content;
      }
      useGitStore.getState().runCommand(['add', '.'], fileContents);
      useGitStore.getState().runCommand(['commit', '-m', 'Task setup'], fileContents);
    }

    const baseCommitCount =
      useGitStore.getState().repo.branches[branchName]?.commitHashes.length ?? 0;

    set((s) => ({
      taskStates: {
        ...s.taskStates,
        [questionId]: {
          status: 'in-progress',
          workingBranch: branchName,
          baseCommitCount,
          uncommittedChanges: {},
        },
      },
      activeTaskId: questionId,
    }));
  },

  pauseTask: () => {
    const state = get();
    const questionId = state.activeTaskId;
    if (!questionId) return;
    const taskState = state.taskStates[questionId];
    if (!taskState || !taskState.workingBranch) return;

    // Diff current filesystem against branch HEAD to capture unsaved work.
    const headFiles = useGitStore.getState().getFilesAtBranch(taskState.workingBranch);
    const uncommittedChanges: Record<string, string> = {};
    for (const file of useFilesystemStore.getState().listFiles()) {
      if (headFiles[file.path] !== file.content) {
        uncommittedChanges[file.path] = file.content;
      }
    }

    set((s) => ({
      taskStates: {
        ...s.taskStates,
        [questionId]: { ...taskState, uncommittedChanges },
      },
      activeTaskId: null,
    }));
  },

  resumeTask: (questionId) => {
    const state = get();
    // Pause any other active task first.
    if (state.activeTaskId !== null && state.activeTaskId !== questionId) {
      get().pauseTask();
    }

    const taskState = state.taskStates[questionId];
    if (!taskState || taskState.status !== 'in-progress') return;
    if (!taskState.workingBranch) return;

    // Restore the branch HEAD in the filesystem.
    useGitStore.getState().checkoutBranch(taskState.workingBranch);

    // Re-apply any uncommitted changes saved at pause time.
    if (Object.keys(taskState.uncommittedChanges).length > 0) {
      const fsStore = useFilesystemStore.getState();
      for (const [path, content] of Object.entries(taskState.uncommittedChanges)) {
        fsStore.writeFile(path, content);
      }
    }

    set({ activeTaskId: questionId });
  },

  submitTask: (questionId) => {
    const state = get();
    const taskState = state.taskStates[questionId];
    if (!taskState || taskState.status !== 'in-progress') return;
    if (!taskState.workingBranch) return;

    const gitStore = useGitStore.getState();
    const branch = gitStore.repo.branches[taskState.workingBranch];
    const commitCount = (branch?.commitHashes.length ?? 0) - taskState.baseCommitCount;
    if (commitCount < 1) return; // at least one commit is required

    const branchFiles = gitStore.getFilesAtBranch(taskState.workingBranch);
    const quiz = state.quiz;
    let autograde: AutogradeResult = 'pending';
    if (quiz) {
      const question = quiz.groups
        .flatMap((g) => g.questions)
        .find((q) => q.id === questionId);
      if (question && question.type === 'task' && question.autograde) {
        autograde = gradeTaskAnswer(question.autograde, branchFiles, commitCount);
      }
    }

    const answer: TaskAnswer = {
      type: 'task',
      submittedBranch: taskState.workingBranch,
      commitCount,
    };

    set((s) => ({
      answers: { ...s.answers, [questionId]: answer },
      grades: {
        ...s.grades,
        [questionId]: {
          questionId,
          autograde,
          submittedBranch: taskState.workingBranch ?? undefined,
        },
      },
      taskStates: {
        ...s.taskStates,
        [questionId]: { ...taskState, status: 'submitted', uncommittedChanges: {} },
      },
      activeTaskId: s.activeTaskId === questionId ? null : s.activeTaskId,
    }));
  },

  saveCheckpoint: (questionId) => {
    const state = get();
    if (state.activeTaskId !== questionId) return;
    const taskState = state.taskStates[questionId];
    if (!taskState || taskState.status !== 'in-progress') return;

    const fileContents: Record<string, string> = {};
    for (const f of useFilesystemStore.getState().listFiles()) {
      fileContents[f.path] = f.content;
    }
    const gitStore = useGitStore.getState();
    gitStore.runCommand(['add', '.'], fileContents);
    // Re-read after add in case state changed (it's synchronous here).
    const updated: Record<string, string> = {};
    for (const f of useFilesystemStore.getState().listFiles()) {
      updated[f.path] = f.content;
    }
    gitStore.runCommand(
      ['commit', '-m', `Checkpoint ${new Date().toLocaleString()}`],
      updated,
    );
  },

  reopenTask: (questionId) => {
    const state = get();
    const taskState = state.taskStates[questionId];
    if (!taskState || taskState.status !== 'submitted') return;

    set((s) => ({
      taskStates: {
        ...s.taskStates,
        [questionId]: { ...taskState, status: 'in-progress' },
      },
      answers: { ...s.answers, [questionId]: undefined },
      grades: { ...s.grades, [questionId]: undefined },
    }));
    get().resumeTask(questionId);
  },
}));
