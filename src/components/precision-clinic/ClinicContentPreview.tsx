"use client";

import type {
  ClinicGrammarPattern,
  ClinicKeyPhraseQuestion,
  ClinicMatchingPair,
  ClinicSentenceWritingWord,
  ClinicSoundGroup,
} from "@/domain/precision-clinic/types";
import { formatClinicTypeLabel } from "./clinic-drill-utils";

type ClinicContentPreviewProps = {
  drill: Record<string, unknown>;
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-100 bg-white p-4 dark:border-border dark:bg-card">
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-muted-foreground">
        {title}
      </h4>
      {children}
    </section>
  );
}

function EmptyState({ type }: { type: string }) {
  return (
    <p className="text-sm text-gray-500 dark:text-muted-foreground">
      No {formatClinicTypeLabel(type).toLowerCase()} content yet.
    </p>
  );
}

/**
 * Read-only renderer for Precision Clinic type-specific content.
 */
export function ClinicContentPreview({ drill }: ClinicContentPreviewProps) {
  const type = String(drill.type ?? "");

  switch (type) {
    case "pronunciation": {
      const groups = (drill.soundGroups ?? []) as ClinicSoundGroup[];
      if (!Array.isArray(groups) || groups.length === 0) {
        return <EmptyState type={type} />;
      }
      return (
        <div className="space-y-3">
          {groups.map((group, gi) => (
            <Section
              key={`${group.targetSound}-${gi}`}
              title={`Sound group: ${group.targetSound || "—"}`}
            >
              <ul className="space-y-2">
                {(group.words ?? []).map((w, wi) => (
                  <li
                    key={`${w.word}-${wi}`}
                    className="rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-muted/40"
                  >
                    <p className="font-semibold text-gray-900 dark:text-foreground">
                      {w.word}
                    </p>
                    {w.practiceSentence ? (
                      <p className="mt-0.5 text-gray-600 dark:text-muted-foreground">
                        {w.practiceSentence}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Section>
          ))}
        </div>
      );
    }

    case "key_phrases": {
      const questions = (drill.questions ?? []) as ClinicKeyPhraseQuestion[];
      if (!Array.isArray(questions) || questions.length === 0) {
        return <EmptyState type={type} />;
      }
      return (
        <div className="space-y-3">
          {questions.map((q, i) => (
            <Section key={i} title={`Question ${i + 1}`}>
              {q.respondentName ? (
                <p className="mb-1 text-xs text-gray-500 dark:text-muted-foreground">
                  Respondent: {q.respondentName}
                </p>
              ) : null}
              <p className="text-sm font-medium text-gray-900 dark:text-foreground">
                {q.prompt}
              </p>
              <ul className="mt-2 space-y-1">
                {(q.options ?? []).map((opt, oi) => (
                  <li
                    key={oi}
                    className={`rounded-lg px-3 py-1.5 text-sm ${
                      opt === q.correctAnswer
                        ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                        : "bg-gray-50 text-gray-700 dark:bg-muted/40 dark:text-foreground"
                    }`}
                  >
                    {opt}
                    {opt === q.correctAnswer ? " ✓" : ""}
                  </li>
                ))}
              </ul>
            </Section>
          ))}
        </div>
      );
    }

    case "matching": {
      const pairs = (drill.pairs ?? []) as ClinicMatchingPair[];
      if (!Array.isArray(pairs) || pairs.length === 0) {
        return <EmptyState type={type} />;
      }
      return (
        <Section title="Matching pairs">
          <ul className="divide-y divide-gray-100 dark:divide-border">
            {pairs.map((p, i) => (
              <li
                key={i}
                className="flex flex-col gap-1 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-foreground">
                    {p.left}
                  </p>
                  {p.leftTranslation ? (
                    <p className="text-xs text-gray-500">{p.leftTranslation}</p>
                  ) : null}
                </div>
                <span className="hidden text-gray-300 sm:inline">→</span>
                <div className="sm:text-right">
                  <p className="font-medium text-gray-900 dark:text-foreground">
                    {p.right}
                  </p>
                  {p.rightTranslation ? (
                    <p className="text-xs text-gray-500">{p.rightTranslation}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      );
    }

    case "grammar": {
      const patterns = (drill.patterns ?? []) as ClinicGrammarPattern[];
      if (!Array.isArray(patterns) || patterns.length === 0) {
        return <EmptyState type={type} />;
      }
      return (
        <div className="space-y-3">
          {patterns.map((p, i) => (
            <Section key={i} title={p.pattern || `Pattern ${i + 1}`}>
              <p className="text-sm text-gray-900 dark:text-foreground">
                {p.exampleSentence}
              </p>
              {p.hint ? (
                <p className="mt-1 text-xs text-gray-500 dark:text-muted-foreground">
                  Hint: {p.hint}
                </p>
              ) : null}
            </Section>
          ))}
        </div>
      );
    }

    case "sentence_writing": {
      const words = (drill.words ?? []) as ClinicSentenceWritingWord[];
      if (!Array.isArray(words) || words.length === 0) {
        return <EmptyState type={type} />;
      }
      return (
        <Section title="Words / expressions">
          <ul className="space-y-2">
            {words.map((w, i) => (
              <li
                key={i}
                className="rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-muted/40"
              >
                <p className="font-semibold text-gray-900 dark:text-foreground">
                  {w.word}
                </p>
                {w.hint ? (
                  <p className="mt-0.5 text-gray-600 dark:text-muted-foreground">
                    Hint: {w.hint}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      );
    }

    case "listening": {
      const title = String(drill.contentTitle ?? "");
      const content = String(drill.content ?? "");
      if (!title && !content) return <EmptyState type={type} />;
      return (
        <Section title={title || "Listening content"}>
          <p className="whitespace-pre-wrap text-sm text-gray-800 dark:text-foreground">
            {content || "—"}
          </p>
        </Section>
      );
    }

    case "summary": {
      const title = String(drill.articleTitle ?? "");
      const content = String(drill.articleContent ?? "");
      if (!title && !content) return <EmptyState type={type} />;
      return (
        <Section title={title || "Article"}>
          <p className="whitespace-pre-wrap text-sm text-gray-800 dark:text-foreground">
            {content || "—"}
          </p>
        </Section>
      );
    }

    default:
      return (
        <p className="text-sm text-gray-500 dark:text-muted-foreground">
          Unknown clinic type: {type || "—"}
        </p>
      );
  }
}
