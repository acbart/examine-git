export interface ExamSubmission {
  questionId: string;
  answer: string;
  sessionId: string;
}

export interface ExamApi {
  submitAnswer: (submission: ExamSubmission) => Promise<void>;
}

export class StubExamApi implements ExamApi {
  async submitAnswer(): Promise<void> {
    // stub - no-op
  }
}
