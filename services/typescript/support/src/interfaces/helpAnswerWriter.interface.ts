export interface HelpAnswerDraftInput {
  readonly category: string;
  readonly locale: string;
  readonly subject: string;
  readonly question: string;
  readonly answer: string;
}

export interface HelpAnswerDraft {
  readonly title: string;
  readonly summary: string;
  readonly question: string;
  readonly answerMarkdown: string;
  readonly tags: readonly string[];
  readonly writer: string;
}

export interface HelpAnswerWriter {
  writeHelpAnswer(input: HelpAnswerDraftInput): Promise<HelpAnswerDraft | null>;
}

export const noHelpAnswerWriter: HelpAnswerWriter = { writeHelpAnswer: async () => null };
