import { useMemo } from 'react';
import { useQuizStore } from '../../features/quiz/quizStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import type {
  Question,
  MultipleChoiceQuestion,
  FillBlankQuestion,
  MultiFillBlankQuestion,
  MatchingQuestion,
  UserAnswer,
  GradeResult,
  Rubric,
  LineReference,
} from '../../features/quiz/quizTypes';

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Parses question text, splitting it into plain-text segments and
 * inline line-reference links encoded as `{link:path#line:label}`.
 */
type TextSegment =
  | { kind: 'text'; content: string }
  | { kind: 'lineref'; path: string; line: number; label: string };

function parseText(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const re = /\{link:([^#}]+)#(\d+):([^}]*)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segments.push({ kind: 'text', content: text.slice(last, m.index) });
    segments.push({
      kind: 'lineref',
      path: m[1],
      line: parseInt(m[2], 10),
      label: m[3] || `${m[1]}:${m[2]}`,
    });
    last = m.index + m[0].length;
  }
  if (last < text.length) segments.push({ kind: 'text', content: text.slice(last) });
  return segments;
}

// ── Sub-components ────────────────────────────────────────────────

function LineRefLink({ path, line, label }: LineReference) {
  const { openFile, requestLineJump } = useWorkspaceStore();

  function handleClick() {
    openFile(path);
    requestLineJump(path, line);
  }

  return (
    <button className="quiz-lineref-link" onClick={handleClick} title={`${path} line ${line}`}>
      📌 {label ?? `${path}:${line}`}
    </button>
  );
}

function QuestionText({ text }: { text: string }) {
  const { openFile, requestLineJump } = useWorkspaceStore();
  const segments = useMemo(() => parseText(text), [text]);

  return (
    <p className="quiz-question-text">
      {segments.map((seg, i) => {
        if (seg.kind === 'text') return <span key={i}>{seg.content}</span>;
        return (
          <button
            key={i}
            className="quiz-inline-link"
            onClick={() => {
              openFile(seg.path);
              requestLineJump(seg.path, seg.line);
            }}
            title={`${seg.path} line ${seg.line}`}
          >
            {seg.label}
          </button>
        );
      })}
    </p>
  );
}

function GradeBadge({ result }: { result: GradeResult | undefined }) {
  if (!result) return null;
  if (result.autograde === 'correct')
    return <span className="quiz-grade-badge correct">✓ Correct</span>;
  if (result.autograde === 'incorrect')
    return <span className="quiz-grade-badge incorrect">✗ Incorrect</span>;
  return <span className="quiz-grade-badge pending">⧗ Pending review</span>;
}

function RubricEditor({
  questionId,
  rubric,
  grade,
}: {
  questionId: string;
  rubric: Rubric;
  grade: GradeResult | undefined;
}) {
  const { setRubricScore, setRubricComment } = useQuizStore();

  return (
    <div className="quiz-rubric">
      <div className="quiz-rubric-title">Rubric</div>
      {rubric.criteria.map((c) => {
        const score = grade?.rubricScores?.[c.id] ?? null;
        const comment = grade?.rubricComments?.[c.id] ?? '';
        return (
          <div key={c.id} className="quiz-rubric-criterion">
            <div className="quiz-rubric-desc">
              <span>{c.description}</span>
              <span className="quiz-rubric-pts">/ {c.points} pts</span>
            </div>
            <div className="quiz-rubric-inputs">
              <input
                type="number"
                className="quiz-rubric-score-input"
                min={0}
                max={c.points}
                step={0.5}
                value={score ?? ''}
                placeholder="—"
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v)) setRubricScore(questionId, c.id, Math.min(c.points, Math.max(0, v)));
                }}
              />
              <input
                type="text"
                className="quiz-rubric-comment-input"
                placeholder="Feedback…"
                value={comment}
                onChange={(e) => setRubricComment(questionId, c.id, e.target.value)}
              />
            </div>
          </div>
        );
      })}
      <div className="quiz-rubric-total">
        Total:{' '}
        <strong>
          {rubric.criteria.reduce((sum, c) => sum + (grade?.rubricScores?.[c.id] ?? 0), 0)}
        </strong>{' '}
        / {rubric.criteria.reduce((sum, c) => sum + c.points, 0)} pts
      </div>
    </div>
  );
}

// ── Question renderers ────────────────────────────────────────────

function MultipleChoiceRenderer({
  question,
  answer,
  submitted,
  onAnswer,
}: {
  question: MultipleChoiceQuestion;
  answer: UserAnswer | undefined;
  submitted: boolean;
  onAnswer: (a: UserAnswer) => void;
}) {
  const selected = answer?.type === 'multiple-choice' ? answer.selectedIndex : -1;
  return (
    <div className="quiz-mc-options">
      {question.options.map((opt, i) => (
        <label key={i} className={`quiz-mc-option${selected === i ? ' selected' : ''}`}>
          <input
            type="radio"
            name={question.id}
            value={i}
            checked={selected === i}
            disabled={submitted}
            onChange={() => onAnswer({ type: 'multiple-choice', selectedIndex: i })}
          />
          <span>{opt}</span>
        </label>
      ))}
    </div>
  );
}

function FillBlankRenderer({
  question,
  answer,
  submitted,
  onAnswer,
}: {
  question: FillBlankQuestion;
  answer: UserAnswer | undefined;
  submitted: boolean;
  onAnswer: (a: UserAnswer) => void;
}) {
  const value = answer?.type === 'fill-blank' ? answer.value : '';
  return (
    <input
      className="quiz-fill-input"
      type="text"
      value={value}
      placeholder={question.placeholder ?? 'Your answer…'}
      disabled={submitted}
      onChange={(e) => onAnswer({ type: 'fill-blank', value: e.target.value })}
    />
  );
}

function MultiFillBlankRenderer({
  question,
  answer,
  submitted,
  onAnswer,
}: {
  question: MultiFillBlankQuestion;
  answer: UserAnswer | undefined;
  submitted: boolean;
  onAnswer: (a: UserAnswer) => void;
}) {
  const values = answer?.type === 'multi-fill-blank' ? answer.values : {};

  function handleChange(id: string, value: string) {
    onAnswer({ type: 'multi-fill-blank', values: { ...values, [id]: value } });
  }

  return (
    <div className="quiz-multi-fill">
      {question.textParts.map((part, i) => (
        <span key={i}>
          <span className="quiz-multi-fill-text">{part}</span>
          {i < question.blanks.length && (
            <input
              key={question.blanks[i].id}
              className="quiz-fill-input inline"
              type="text"
              value={values[question.blanks[i].id] ?? ''}
              placeholder={question.blanks[i].placeholder ?? '___'}
              disabled={submitted}
              onChange={(e) => handleChange(question.blanks[i].id, e.target.value)}
            />
          )}
        </span>
      ))}
    </div>
  );
}

function MatchingRenderer({
  question,
  answer,
  submitted,
  onAnswer,
}: {
  question: MatchingQuestion;
  answer: UserAnswer | undefined;
  submitted: boolean;
  onAnswer: (a: UserAnswer) => void;
}) {
  const mapping = answer?.type === 'matching' ? answer.mapping : {};

  // Shuffle right-side options once per question id using a djb2-style hash seed.
  const shuffledRights = useMemo(() => {
    const rights = question.items.map((it) => it.right);
    // djb2-style hash for a better distribution across different question IDs.
    let seed = 5381;
    for (let ci = 0; ci < question.id.length; ci++) {
      seed = ((seed << 5) + seed + question.id.charCodeAt(ci)) & 0xffffffff;
    }
    const arr = [...rights];
    for (let i = arr.length - 1; i > 0; i--) {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      const j = Math.abs(seed) % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [question.id, question.items]);

  function handleChange(id: string, value: string) {
    onAnswer({ type: 'matching', mapping: { ...mapping, [id]: value } });
  }

  return (
    <div className="quiz-matching">
      {question.items.map((item) => (
        <div key={item.id} className="quiz-matching-row">
          <span className="quiz-matching-left">{item.left}</span>
          <select
            className="quiz-matching-select"
            value={mapping[item.id] ?? ''}
            disabled={submitted}
            onChange={(e) => handleChange(item.id, e.target.value)}
          >
            <option value="">— select —</option>
            {shuffledRights.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

function FreeResponseRenderer({
  answer,
  submitted,
  onAnswer,
}: {
  answer: UserAnswer | undefined;
  submitted: boolean;
  onAnswer: (a: UserAnswer) => void;
}) {
  const value = answer?.type === 'free-response' ? answer.value : '';
  return (
    <textarea
      className="quiz-free-response"
      rows={4}
      value={value}
      placeholder="Write your response here…"
      disabled={submitted}
      onChange={(e) => onAnswer({ type: 'free-response', value: e.target.value })}
    />
  );
}

// ── Question card ─────────────────────────────────────────────────

function QuestionCard({
  question,
  index,
  answer,
  grade,
  submitted,
}: {
  question: Question;
  index: number;
  answer: UserAnswer | undefined;
  grade: GradeResult | undefined;
  submitted: boolean;
}) {
  const { setAnswer } = useQuizStore();

  function onAnswer(a: UserAnswer) {
    setAnswer(question.id, a);
  }

  function renderAnswerInput() {
    switch (question.type) {
      case 'multiple-choice':
        return (
          <MultipleChoiceRenderer
            question={question}
            answer={answer}
            submitted={submitted}
            onAnswer={onAnswer}
          />
        );
      case 'fill-blank':
        return (
          <FillBlankRenderer
            question={question}
            answer={answer}
            submitted={submitted}
            onAnswer={onAnswer}
          />
        );
      case 'multi-fill-blank':
        return (
          <MultiFillBlankRenderer
            question={question}
            answer={answer}
            submitted={submitted}
            onAnswer={onAnswer}
          />
        );
      case 'matching':
        return (
          <MatchingRenderer
            question={question}
            answer={answer}
            submitted={submitted}
            onAnswer={onAnswer}
          />
        );
      case 'free-response':
        return (
          <FreeResponseRenderer
            answer={answer}
            submitted={submitted}
            onAnswer={onAnswer}
          />
        );
    }
  }

  const typeLabel: Record<Question['type'], string> = {
    'multiple-choice': 'Multiple Choice',
    'fill-blank': 'Fill in the Blank',
    'multi-fill-blank': 'Fill in the Blanks',
    matching: 'Matching',
    'free-response': 'Free Response',
  };

  return (
    <div className={`quiz-question-card${submitted ? ' submitted' : ''}`}>
      <div className="quiz-question-header">
        <span className="quiz-question-num">Q{index + 1}</span>
        <span className="quiz-question-type-label">{typeLabel[question.type]}</span>
        {submitted && <GradeBadge result={grade} />}
      </div>

      <QuestionText text={question.text} />

      {question.lineRefs && question.lineRefs.length > 0 && (
        <div className="quiz-linerefs">
          {question.lineRefs.map((ref, i) => (
            <LineRefLink key={i} {...ref} />
          ))}
        </div>
      )}

      <div className="quiz-answer-area">{renderAnswerInput()}</div>

      {submitted && question.rubric && (
        <RubricEditor questionId={question.id} rubric={question.rubric} grade={grade} />
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────

export function QuizPanel() {
  const {
    quiz,
    currentGroupIndex,
    submittedGroups,
    answers,
    grades,
    submitGroup,
    advanceGroup,
    goToGroup,
  } = useQuizStore();

  const { toggleQuizPanel } = useWorkspaceStore();

  if (!quiz) {
    return (
      <div className="quiz-panel">
        <div className="quiz-panel-header">
          <span className="quiz-panel-title">Quiz</span>
          <button className="quiz-close-btn" onClick={toggleQuizPanel} title="Close quiz panel">
            ×
          </button>
        </div>
        <div className="quiz-empty">No quiz loaded.</div>
      </div>
    );
  }

  const group = quiz.groups[currentGroupIndex];
  const isSubmitted = submittedGroups.has(currentGroupIndex);
  const isLast = currentGroupIndex === quiz.groups.length - 1;

  const answeredCount = group.questions.filter((q) => answers[q.id] !== undefined).length;
  const required = group.requireAll ? group.questions.length : (group.minRequired ?? 1);
  const canSubmit = !isSubmitted && answeredCount >= required;

  return (
    <div className="quiz-panel">
      {/* Header */}
      <div className="quiz-panel-header">
        <span className="quiz-panel-title">📝 {quiz.title}</span>
        <button className="quiz-close-btn" onClick={toggleQuizPanel} title="Close quiz panel">
          ×
        </button>
      </div>

      {/* Group navigation */}
      <div className="quiz-group-nav">
        {quiz.groups.map((g, i) => (
          <button
            key={g.id}
            className={`quiz-group-tab${i === currentGroupIndex ? ' active' : ''}${submittedGroups.has(i) ? ' done' : ''}`}
            onClick={() => goToGroup(i)}
          >
            {submittedGroups.has(i) ? '✓ ' : ''}
            {g.title ?? `Part ${i + 1}`}
          </button>
        ))}
      </div>

      {/* Group description */}
      {group.title && (
        <div className="quiz-group-title">
          {group.title}
          {!group.requireAll && group.minRequired !== undefined && (
            <span className="quiz-group-hint">
              {' '}(answer at least {group.minRequired})
            </span>
          )}
        </div>
      )}

      {/* Questions */}
      <div className="quiz-questions-list">
        {group.questions.map((q, i) => (
          <QuestionCard
            key={q.id}
            question={q}
            index={i}
            answer={answers[q.id]}
            grade={grades[q.id]}
            submitted={isSubmitted}
          />
        ))}
      </div>

      {/* Footer actions */}
      <div className="quiz-footer">
        <span className="quiz-progress-hint">
          {isSubmitted
            ? `Submitted · ${group.questions.filter((q) => grades[q.id]?.autograde === 'correct').length}/${group.questions.length} auto-graded correct`
            : `${answeredCount}/${group.questions.length} answered`}
        </span>
        <div className="quiz-footer-btns">
          {!isSubmitted && (
            <button
              className="quiz-submit-btn"
              disabled={!canSubmit}
              onClick={submitGroup}
              title={canSubmit ? 'Submit answers for this part' : `Answer at least ${required} question(s) to submit`}
            >
              Submit
            </button>
          )}
          {isSubmitted && !isLast && (
            <button className="quiz-next-btn" onClick={advanceGroup}>
              Next →
            </button>
          )}
          {isSubmitted && isLast && (
            <span className="quiz-complete-badge">🎉 Quiz complete!</span>
          )}
        </div>
      </div>
    </div>
  );
}
