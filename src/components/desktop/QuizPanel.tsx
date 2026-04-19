import { useState } from 'react';
import { useQuizStore } from '../../features/quiz/quizStore';
import { useGitStore } from '../../features/git/gitStore';
import { useFilesystemStore } from '../../features/filesystem/filesystemStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import type { QuizQuestion, LineReference, QuestionType } from '../../features/quiz/quizTypes';
import { generateId } from '../../features/quiz/quizStore';

// ─── Instructor: question editor ────────────────────────────────────────────

function LineRefEditor({
  refs,
  onChange,
}: {
  refs: LineReference[];
  onChange: (refs: LineReference[]) => void;
}) {
  function addRef() {
    onChange([...refs, { filePath: '', line: 1, label: '' }]);
  }
  function removeRef(i: number) {
    onChange(refs.filter((_, idx) => idx !== i));
  }
  function updateRef(i: number, patch: Partial<LineReference>) {
    onChange(refs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  return (
    <div className="quiz-line-refs-editor">
      <div className="quiz-field-label">Line References</div>
      {refs.map((ref, i) => (
        <div key={i} className="quiz-line-ref-row">
          <input
            className="quiz-input quiz-input-sm"
            placeholder="file path"
            value={ref.filePath}
            onChange={(e) => updateRef(i, { filePath: e.target.value })}
          />
          <input
            className="quiz-input quiz-input-xs"
            type="number"
            min={1}
            placeholder="line"
            value={ref.line}
            onChange={(e) => updateRef(i, { line: Math.max(1, Number(e.target.value)) })}
          />
          <input
            className="quiz-input quiz-input-sm"
            placeholder="label (optional)"
            value={ref.label ?? ''}
            onChange={(e) => updateRef(i, { label: e.target.value })}
          />
          <button className="quiz-icon-btn quiz-danger-btn" onClick={() => removeRef(i)} title="Remove">
            ✕
          </button>
        </div>
      ))}
      <button className="quiz-small-btn" onClick={addRef}>
        + Add line reference
      </button>
    </div>
  );
}

function QuestionEditor({ question }: { question: QuizQuestion }) {
  const { updateQuestion, removeQuestion, setEditingQuestion } = useQuizStore();

  function setChoices(choices: string[]) {
    updateQuestion(question.id, { choices });
  }

  return (
    <div className="quiz-question-editor">
      <div className="quiz-question-editor-header">
        <select
          className="quiz-select"
          value={question.type}
          onChange={(e) =>
            updateQuestion(question.id, { type: e.target.value as QuestionType })
          }
        >
          <option value="essay">Essay</option>
          <option value="true-false">True / False</option>
          <option value="multiple-choice">Multiple Choice</option>
        </select>
        <button
          className="quiz-icon-btn quiz-danger-btn"
          onClick={() => removeQuestion(question.id)}
          title="Delete question"
        >
          🗑
        </button>
      </div>

      <div className="quiz-field-label">Prompt</div>
      <textarea
        className="quiz-textarea"
        rows={3}
        value={question.prompt}
        placeholder="Enter question prompt…"
        onChange={(e) => updateQuestion(question.id, { prompt: e.target.value })}
      />

      {question.type === 'multiple-choice' && (
        <div className="quiz-choices-editor">
          <div className="quiz-field-label">Answer Choices</div>
          {question.choices.map((choice, i) => (
            <div key={i} className="quiz-choice-row">
              <span className="quiz-choice-letter">{String.fromCharCode(65 + i)}.</span>
              <input
                className="quiz-input"
                value={choice}
                placeholder={`Choice ${String.fromCharCode(65 + i)}`}
                onChange={(e) => {
                  const updated = [...question.choices];
                  updated[i] = e.target.value;
                  setChoices(updated);
                }}
              />
              {question.choices.length > 2 && (
                <button
                  className="quiz-icon-btn quiz-danger-btn"
                  onClick={() => setChoices(question.choices.filter((_, idx) => idx !== i))}
                  title="Remove choice"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {question.choices.length < 8 && (
            <button className="quiz-small-btn" onClick={() => setChoices([...question.choices, ''])}>
              + Add choice
            </button>
          )}
        </div>
      )}

      <LineRefEditor
        refs={question.lineReferences}
        onChange={(refs) => updateQuestion(question.id, { lineReferences: refs })}
      />

      <button className="quiz-small-btn quiz-done-btn" onClick={() => setEditingQuestion(null)}>
        ✓ Done
      </button>
    </div>
  );
}

// ─── Student: question renderer ─────────────────────────────────────────────

function LineRefLink({ ref: lineRef }: { ref: LineReference }) {
  const { requestLineJump, openFile } = useWorkspaceStore();

  function handleClick() {
    openFile(lineRef.filePath);
    requestLineJump(lineRef.filePath, lineRef.line);
  }

  return (
    <button className="quiz-line-ref-link" onClick={handleClick} title={`${lineRef.filePath}:${lineRef.line}`}>
      📍 {lineRef.label ?? `${lineRef.filePath}:${lineRef.line}`}
    </button>
  );
}

function QuestionView({ question, index }: { question: QuizQuestion; index: number }) {
  const { answers, setAnswer, mode, setEditingQuestion, editingQuestionId } = useQuizStore();
  const answer = answers[question.id] ?? null;
  const isEditing = mode === 'instructor' && editingQuestionId === question.id;

  if (isEditing) {
    return <QuestionEditor question={question} />;
  }

  return (
    <div className="quiz-question">
      <div className="quiz-question-header">
        <span className="quiz-question-number">Q{index + 1}</span>
        <span className="quiz-question-type-badge">{question.type}</span>
        {mode === 'instructor' && (
          <button
            className="quiz-icon-btn"
            onClick={() => setEditingQuestion(question.id)}
            title="Edit question"
          >
            ✏️
          </button>
        )}
      </div>

      {question.lineReferences.length > 0 && (
        <div className="quiz-line-refs">
          {question.lineReferences.map((ref, i) => (
            <LineRefLink key={i} ref={ref} />
          ))}
        </div>
      )}

      <p className="quiz-question-prompt">{question.prompt || <em className="quiz-placeholder">No prompt entered</em>}</p>

      {question.type === 'essay' && (
        <textarea
          className="quiz-answer-textarea"
          rows={4}
          placeholder="Type your answer here…"
          value={typeof answer === 'string' ? answer : ''}
          onChange={(e) => setAnswer(question.id, e.target.value)}
        />
      )}

      {question.type === 'true-false' && (
        <div className="quiz-tf-group">
          {['True', 'False'].map((opt) => (
            <label key={opt} className="quiz-tf-option">
              <input
                type="radio"
                name={`tf-${question.id}`}
                value={opt}
                checked={answer === opt}
                onChange={() => setAnswer(question.id, opt)}
              />
              {opt}
            </label>
          ))}
        </div>
      )}

      {question.type === 'multiple-choice' && (
        <div className="quiz-mc-group">
          {question.choices.map((choice, i) => (
            <label key={i} className="quiz-mc-option">
              <input
                type="radio"
                name={`mc-${question.id}`}
                value={i}
                checked={answer === i}
                onChange={() => setAnswer(question.id, i)}
              />
              <span className="quiz-choice-letter">{String.fromCharCode(65 + i)}.</span>
              {choice || <em className="quiz-placeholder">Choice {String.fromCharCode(65 + i)}</em>}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Reset helpers ───────────────────────────────────────────────────────────

function ResetBar() {
  const { repo } = useGitStore();
  const { resetFile, listFiles } = useFilesystemStore();
  const { markClean } = useWorkspaceStore();
  const [confirm, setConfirm] = useState(false);

  function handleReset() {
    if (!confirm) {
      setConfirm(true);
      return;
    }
    // Restore all tracked files to their committed state
    for (const [path, content] of Object.entries(repo.trackedFiles)) {
      if (content !== undefined) {
        resetFile(path, content);
        markClean(path);
      }
    }
    setConfirm(false);
  }

  const trackedPaths = Object.keys(repo.trackedFiles);
  const files = listFiles();
  const hasChanges = files.some((f) => {
    const tracked = repo.trackedFiles[f.path];
    return tracked !== undefined && f.content !== tracked;
  });

  if (trackedPaths.length === 0) return null;

  return (
    <div className="quiz-reset-bar">
      <div className="quiz-reset-label">
        {hasChanges ? '⚠ You have unsaved changes' : '✓ Code matches original'}
      </div>
      <button
        className={`quiz-reset-btn${confirm ? ' confirming' : ''}`}
        onClick={handleReset}
        disabled={!hasChanges && !confirm}
        title="Restore all files to the last committed version"
      >
        {confirm ? 'Confirm reset?' : '↩ Reset to Original'}
      </button>
      {confirm && (
        <button className="quiz-cancel-btn" onClick={() => setConfirm(false)}>
          Cancel
        </button>
      )}
    </div>
  );
}

// ─── Quiz Panel ──────────────────────────────────────────────────────────────

export function QuizPanel() {
  const { quiz, mode, setMode, clearAnswers, addQuestion, updateQuizMeta } = useQuizStore();

  if (quiz === null) {
    return (
      <div className="quiz-panel">
        <div className="panel-header">QUIZ</div>
        <div className="quiz-empty">No quiz loaded.</div>
      </div>
    );
  }

  return (
    <div className="quiz-panel">
      <div className="quiz-panel-header">
        <span className="quiz-panel-title">QUIZ</span>
        <div className="quiz-mode-toggle">
          <button
            className={`quiz-mode-btn${mode === 'student' ? ' active' : ''}`}
            onClick={() => setMode('student')}
            title="Student mode"
          >
            👤
          </button>
          <button
            className={`quiz-mode-btn${mode === 'instructor' ? ' active' : ''}`}
            onClick={() => setMode('instructor')}
            title="Instructor mode"
          >
            🎓
          </button>
        </div>
      </div>

      <div className="quiz-panel-body">
        <ResetBar />

        {mode === 'instructor' ? (
          <div className="quiz-meta-editor">
            <input
              className="quiz-input quiz-title-input"
              value={quiz.title}
              placeholder="Quiz title"
              onChange={(e) => updateQuizMeta({ title: e.target.value })}
            />
            <textarea
              className="quiz-textarea"
              rows={2}
              value={quiz.description}
              placeholder="Quiz description…"
              onChange={(e) => updateQuizMeta({ description: e.target.value })}
            />
          </div>
        ) : (
          <div className="quiz-intro">
            <div className="quiz-title">{quiz.title}</div>
            {quiz.description && <p className="quiz-description">{quiz.description}</p>}
          </div>
        )}

        <div className="quiz-questions">
          {quiz.questions.map((q, i) => (
            <QuestionView key={q.id} question={q} index={i} />
          ))}
        </div>

        {mode === 'instructor' && (
          <div className="quiz-add-question-bar">
            <span className="quiz-field-label">Add question:</span>
            <div className="quiz-add-btns">
              <button className="quiz-small-btn" onClick={() => addQuestion('essay')}>Essay</button>
              <button className="quiz-small-btn" onClick={() => addQuestion('true-false')}>True/False</button>
              <button className="quiz-small-btn" onClick={() => addQuestion('multiple-choice')}>Multiple Choice</button>
            </div>
          </div>
        )}

        {mode === 'student' && quiz.questions.length > 0 && (
          <button
            className="quiz-clear-btn"
            onClick={() => { if (window.confirm('Clear all your answers?')) clearAnswers(); }}
          >
            Clear All Answers
          </button>
        )}
      </div>
    </div>
  );
}
