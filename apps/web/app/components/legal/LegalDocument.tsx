import Link from "next/link";
import type { ReactNode } from "react";
import {
    LEGAL_ENTITY_NAME,
    LEGAL_EFFECTIVE_DATE,
    SUPPORT_EMAIL,
    SUPPORT_PHONE,
} from "~/lib/brand";

export type LegalBlock =
    | { kind: "p"; text: ReactNode }
    | { kind: "list"; items: ReactNode[] }
    | { kind: "terms"; items: { term: ReactNode; detail: ReactNode }[] }
    | { kind: "table"; head: string[]; rows: ReactNode[][]; note?: ReactNode };

export interface LegalClause {
    id: string;
    title: string;
    blocks: LegalBlock[];
}

export interface LegalDocumentProps {
    title: string;
    summary?: ReactNode;
    clauses: LegalClause[];
    sibling: { href: string; label: string; prompt: ReactNode };
    closing?: ReactNode;
}

const prose = "text-neutral-700 leading-[1.75]";

function Block({ block }: { block: LegalBlock }) {
    if (block.kind === "p") {
        return <p className={prose}>{block.text}</p>;
    }

    if (block.kind === "list") {
        return (
            <ul className={`${prose} space-y-2.5`}>
                {block.items.map((item, index) => (
                    <li key={index} className="flex gap-3">
                        <span aria-hidden className="mt-[0.6875rem] size-1 shrink-0 rounded-full bg-neutral-300" />
                        <span>{item}</span>
                    </li>
                ))}
            </ul>
        );
    }

    if (block.kind === "terms") {
        return (
            <dl className="space-y-3">
                {block.items.map(({ term, detail }, index) => (
                    <div key={index} className="grid gap-1 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
                        <dt className="text-sm font-medium text-neutral-900">{term}</dt>
                        <dd className={`${prose} text-[0.9375rem]`}>{detail}</dd>
                    </div>
                ))}
            </dl>
        );
    }

    return (
        <div>
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
                    <thead>
                        <tr className="border-b border-neutral-300">
                            {block.head.map((heading) => (
                                <th
                                    key={heading}
                                    scope="col"
                                    className="py-2.5 pr-6 align-bottom text-xs font-semibold tracking-wide text-neutral-900 uppercase last:pr-0"
                                >
                                    {heading}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {block.rows.map((row, rowIndex) => (
                            <tr key={rowIndex} className="border-b border-neutral-100 align-top">
                                {row.map((cell, cellIndex) => (
                                    <td
                                        key={cellIndex}
                                        className={`py-3 pr-6 align-top text-neutral-700 leading-relaxed last:pr-0 ${
                                            cellIndex === 0
                                                ? "font-medium text-neutral-900"
                                                : ""
                                        }`}
                                    >
                                        {cell}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {block.note ? (
                <p className={`${prose} mt-3 text-sm text-neutral-500`}>{block.note}</p>
            ) : null}
        </div>
    );
}

export function LegalDocument({
    title,
    summary,
    clauses,
    sibling,
    closing,
}: LegalDocumentProps) {
    return (
        <div className="selection:bg-neutral-900 selection:text-white">
            <a
                href="#legal-content"
                className="sr-only rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
            >
                Skip to the document
            </a>

            <header className="pb-10 md:pb-14">
                <h1 className="text-4xl font-bold tracking-tight text-neutral-900 md:text-5xl">
                    {title}
                </h1>
                <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-neutral-500">
                    <span>
                        Last updated{" "}
                        <time dateTime="2026-10-15" className="text-neutral-700">
                            {LEGAL_EFFECTIVE_DATE}
                        </time>
                    </span>
                    <span aria-hidden className="text-neutral-300">
                        /
                    </span>
                    <span>{LEGAL_ENTITY_NAME}</span>
                </div>
                {summary ? (
                    <p className={`${prose} mt-6 max-w-[58ch] text-lg`}>{summary}</p>
                ) : null}
            </header>

            <div
                id="legal-content"
                tabIndex={-1}
                className="scroll-mt-20 lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-16"
            >
                <nav
                    aria-labelledby="legal-contents-heading"
                    className="hidden lg:block"
                >
                    <h2
                        id="legal-contents-heading"
                        className="text-sm font-semibold text-neutral-900"
                    >
                        Contents
                    </h2>
                    <ol className="mt-3 space-y-px">
                        {clauses.map((clause, index) => (
                            <li key={clause.id}>
                                <a
                                    href={`#${clause.id}`}
                                    className="group flex gap-3 border-b border-neutral-100 py-2 text-sm leading-snug text-neutral-500 transition-colors hover:border-neutral-400 hover:text-neutral-900 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
                                >
                                    <span
                                        aria-hidden
                                        className="tabular-nums w-4 shrink-0 text-right text-neutral-400 transition-colors group-hover:text-neutral-600"
                                    >
                                        {index + 1}
                                    </span>
                                    <span>{clause.title}</span>
                                </a>
                            </li>
                        ))}
                    </ol>
                </nav>

                <div className="min-w-0">
                    <div className="space-y-14">
                        {clauses.map((clause, index) => (
                            <section
                                key={clause.id}
                                id={`${clause.id}-section`}
                                className="scroll-mt-24"
                            >
                                <h2
                                    id={clause.id}
                                    className="scroll-mt-24 text-xl font-semibold tracking-tight text-neutral-900 target:underline target:decoration-neutral-300 target:decoration-2 target:underline-offset-[7px]"
                                >
                                    <span aria-hidden className="tabular-nums text-neutral-400">
                                        {index + 1}.
                                    </span>{" "}
                                    {clause.title}
                                </h2>
                                <div className="mt-4 space-y-4">
                                    {clause.blocks.map((block, blockIndex) => (
                                        <Block key={blockIndex} block={block} />
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>

                    <footer className="mt-16 border-t pt-8 pb-20">
                        <h2 className="text-xl font-semibold tracking-tight text-neutral-900">
                            Questions about this document
                        </h2>
                        {closing ? (
                            <>
                                <p className={`${prose} mt-3 max-w-[58ch]`}>{closing}</p>
                                <p className={`${prose} mt-3 max-w-[58ch]`}>
                                    Write to us at{" "}
                                    <a
                                        href={`mailto:${SUPPORT_EMAIL}`}
                                        className="text-neutral-900 underline underline-offset-4 hover:text-neutral-600"
                                    >
                                        {SUPPORT_EMAIL}
                                    </a>{" "}
                                    or call{" "}
                                    <a
                                        href={`tel:${SUPPORT_PHONE.replace(/\s/g, "")}`}
                                        className="tabular-nums text-neutral-900 underline underline-offset-4 hover:text-neutral-600"
                                    >
                                        {SUPPORT_PHONE}
                                    </a>
                                    .
                                </p>
                            </>
                        ) : (
                            <p className={`${prose} mt-3 max-w-[58ch]`}>
                                {sibling.prompt}{" "}
                                <Link
                                    href={sibling.href}
                                    className="text-neutral-900 underline underline-offset-4 hover:text-neutral-600"
                                >
                                    {sibling.label}
                                </Link>
                                , or write to us at{" "}
                                <a
                                    href={`mailto:${SUPPORT_EMAIL}`}
                                    className="text-neutral-900 underline underline-offset-4 hover:text-neutral-600"
                                >
                                    {SUPPORT_EMAIL}
                                </a>{" "}
                                or call{" "}
                                <a
                                    href={`tel:${SUPPORT_PHONE.replace(/\s/g, "")}`}
                                    className="tabular-nums text-neutral-900 underline underline-offset-4 hover:text-neutral-600"
                                >
                                    {SUPPORT_PHONE}
                                </a>
                                .
                            </p>
                        )}
                    </footer>
                </div>
            </div>
        </div>
    );
}