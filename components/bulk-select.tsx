"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckSquare,
  FolderInput,
  HelpCircle,
  Loader2,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { refreshChapter } from "@/app/upload/actions";
import { useViewer } from "@/components/file-tools";
import {
  allSubjects,
  findSubject,
  sectionLabel,
  sectionsOf,
  sectionTitle,
} from "@/lib/curriculum";
import { supabaseBrowser } from "@/lib/supabase/browser";

/** One note or Drive-library file that can be picked. */
export interface BulkItem {
  id: string;
  /** "u": uploaded to the site. "d": a file of the Google Drive library (admins only). */
  kind: "u" | "d";
  name: string;
  subject: string;
  unit: number;
  /** In the admin list: already hidden (deleted), so it can be restored. */
  hidden?: boolean;
}

interface Ctx {
  on: boolean;
  setOn: (v: boolean) => void;
  picked: Map<string, BulkItem>;
  toggle: (item: BulkItem) => void;
  setAll: (items: BulkItem[]) => void;
  clear: () => void;
  all: BulkItem[];
}

const Bulk = createContext<Ctx | null>(null);

/**
 * Pick several notes at once and act on them together (move, hide, tag). For admins and
 * moderators only; the database re-checks every change, so this is convenience, not protection.
 */
export function BulkProvider({
  all,
  children,
}: {
  all: BulkItem[];
  children: React.ReactNode;
}) {
  const [on, setOnRaw] = useState(false);
  const [picked, setPicked] = useState<Map<string, BulkItem>>(new Map());
  const value = useMemo<Ctx>(
    () => ({
      on,
      setOn: (v) => {
        setOnRaw(v);
        if (!v) setPicked(new Map());
      },
      picked,
      toggle: (item) =>
        setPicked((m) => {
          const next = new Map(m);
          if (next.has(item.id)) next.delete(item.id);
          else next.set(item.id, item);
          return next;
        }),
      setAll: (items) => setPicked(new Map(items.map((i) => [i.id, i]))),
      clear: () => setPicked(new Map()),
      all,
    }),
    [on, picked, all],
  );
  return <Bulk.Provider value={value}>{children}</Bulk.Provider>;
}

function useBulk() {
  return useContext(Bulk);
}

const useStaff = () => {
  const viewer = useViewer();
  return {
    staff: viewer?.role === "moderator" || viewer?.role === "admin",
    admin: viewer?.role === "admin",
  };
};

/** The "Select" button that turns picking on. Nothing for anyone but staff. */
export function BulkToggle() {
  const bulk = useBulk();
  const { staff } = useStaff();
  if (!bulk || !staff || bulk.all.length === 0) return null;
  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={() => bulk.setOn(!bulk.on)}
        aria-pressed={bulk.on}
        className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium ${bulk.on ? "border-accent bg-accent-soft text-accent" : "border-line hover:bg-surface-2"}`}
      >
        <CheckSquare className="size-4" />{" "}
        {bulk.on ? "Done selecting" : "Select"}
      </button>
    </div>
  );
}

/** Covers a card while picking, so a tap picks it instead of opening it. */
export function SelectOverlay({ item }: { item: BulkItem }) {
  const bulk = useBulk();
  const { staff, admin } = useStaff();
  if (!bulk?.on || !staff || (item.kind === "d" && !admin)) return null;
  const checked = bulk.picked.has(item.id);
  return (
    <button
      type="button"
      onClick={() => bulk.toggle(item)}
      aria-pressed={checked}
      aria-label={`${checked ? "Unselect" : "Select"} ${item.name}`}
      className={`absolute inset-0 z-20 rounded-2xl border-2 transition ${checked ? "border-accent bg-accent/10" : "border-transparent bg-transparent hover:border-line-strong"}`}
    >
      <span
        className={`absolute top-2.5 left-2.5 grid size-6 place-items-center rounded-md border ${checked ? "border-accent bg-accent text-accent-ink" : "border-line-strong bg-bg/90"}`}
      >
        {checked && <Check className="size-4" />}
      </span>
    </button>
  );
}

/** A table row's checkbox (the admin file list). */
export function RowCheck({ item }: { item: BulkItem }) {
  const bulk = useBulk();
  const { staff } = useStaff();
  if (!bulk?.on || !staff) return null;
  return (
    <input
      type="checkbox"
      checked={bulk.picked.has(item.id)}
      onChange={() => bulk.toggle(item)}
      aria-label={`Select ${item.name}`}
      className="size-4 accent-[var(--accent)]"
    />
  );
}

/** The bar that appears at the bottom once something is picked. */
export function BulkBar() {
  const bulk = useBulk();
  const { staff, admin } = useStaff();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!bulk?.on) return;
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && !moving && bulk.setOn(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [bulk, moving]);

  if (!bulk || !staff || !bulk.on) return null;
  const items = [...bulk.picked.values()];
  const uploaded = items.filter((i) => i.kind === "u");
  const visible = uploaded.filter((i) => !i.hidden);
  const hidden = uploaded.filter((i) => i.hidden);

  async function refresh(
    list: BulkItem[],
    extra?: { subject: string; unit: number },
  ) {
    const seen = new Set<string>();
    const places = [
      ...list.map((i) => ({ subject: i.subject, unit: i.unit })),
      ...(extra ? [extra] : []),
    ];
    for (const p of places) {
      const k = `${p.subject}:${p.unit}`;
      if (seen.has(k)) continue;
      seen.add(k);
      await refreshChapter(p.subject, p.unit).catch(() => undefined);
    }
    router.refresh();
  }

  async function hide(restore: boolean) {
    const list = restore ? hidden : visible;
    if (list.length === 0) return;
    if (
      !restore &&
      !confirm(
        `Hide ${list.length} ${list.length === 1 ? "note" : "notes"} from the site? Their owners can restore them from My notes.`,
      )
    )
      return;
    setBusy(restore ? "restore" : "hide");
    setNote(null);
    const { error } = await supabaseBrowser()
      .from("files")
      .update({ deleted_at: restore ? null : new Date().toISOString() })
      .in(
        "id",
        list.map((i) => i.id),
      );
    setBusy(null);
    if (error) return setNote(error.message);
    await refresh(list);
    setNote(`${restore ? "Restored" : "Hidden"} ${list.length}.`);
    bulk!.clear();
  }

  async function tag(on: boolean) {
    if (uploaded.length === 0) return;
    setBusy(on ? "tag" : "untag");
    setNote(null);
    const failed: string[] = [];
    for (const i of uploaded) {
      const { error } = await supabaseBrowser().rpc("staff_set_file_tag", {
        p_file: i.id,
        p_tag: "questions",
        p_on: on,
      });
      if (error) failed.push(i.name);
    }
    setBusy(null);
    await refresh(uploaded);
    setNote(
      failed.length
        ? `Done, except: ${failed.join(", ")}`
        : `${on ? "Tagged" : "Untagged"} ${uploaded.length} as Questions.`,
    );
    if (!failed.length) bulk!.clear();
  }

  const btn =
    "inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-bg px-3 text-sm font-medium whitespace-nowrap hover:bg-surface-2 disabled:opacity-50";

  return (
    <>
      <div className="fixed inset-x-3 bottom-20 z-40 mx-auto max-w-3xl rounded-2xl border border-line-strong bg-surface p-3 shadow-pop md:bottom-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm font-semibold tabular-nums">
            {items.length} selected
          </span>
          <button
            type="button"
            className="text-xs font-medium text-accent hover:underline"
            onClick={() =>
              bulk.setAll(bulk.all.filter((i) => i.kind === "u" || admin))
            }
          >
            Select all ({bulk.all.filter((i) => i.kind === "u" || admin).length}
            )
          </button>
          {items.length > 0 && (
            <button
              type="button"
              className="text-xs font-medium text-ink-3 hover:underline"
              onClick={bulk.clear}
            >
              Clear
            </button>
          )}
          <span className="flex-1" />
          <button
            type="button"
            disabled={items.length === 0 || busy !== null}
            onClick={() => setMoving(true)}
            className={btn}
          >
            <FolderInput className="size-4" /> Move
          </button>
          {uploaded.length > 0 && (
            <>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void tag(true)}
                className={btn}
                title="Also list these in the Question bank"
              >
                {busy === "tag" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <HelpCircle className="size-4" />
                )}{" "}
                Tag Questions
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void tag(false)}
                className={btn}
              >
                {busy === "untag" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}{" "}
                Untag
              </button>
            </>
          )}
          {hidden.length > 0 && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void hide(true)}
              className={btn}
            >
              {busy === "restore" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RotateCcw className="size-4" />
              )}{" "}
              Restore {hidden.length}
            </button>
          )}
          {visible.length > 0 && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void hide(false)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-danger/40 bg-bg px-3 text-sm font-medium whitespace-nowrap text-danger hover:bg-danger-soft disabled:opacity-50"
            >
              {busy === "hide" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}{" "}
              Delete {visible.length}
            </button>
          )}
        </div>
        {note && <p className="mt-2 text-xs text-ink-2">{note}</p>}
      </div>
      {moving && (
        <BulkMove
          items={items}
          admin={admin}
          onClose={() => setMoving(false)}
          onDone={async (target, message) => {
            setMoving(false);
            await refresh(items, target);
            setNote(message);
            bulk.clear();
          }}
        />
      )}
    </>
  );
}

function BulkMove({
  items,
  admin,
  onClose,
  onDone,
}: {
  items: BulkItem[];
  admin: boolean;
  onClose: () => void;
  onDone: (
    target: { subject: string; unit: number },
    message: string,
  ) => Promise<void>;
}) {
  const first = items[0]!;
  const [code, setCode] = useState(first.subject);
  const [target, setTarget] = useState(first.unit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subjects = useMemo(() => {
    const seen = new Map<string, { code: string; label: string }>();
    for (const { subject: s } of allSubjects())
      if (!seen.has(s.code))
        seen.set(s.code, { code: s.code, label: `${s.short} · ${s.name}` });
    return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, []);
  const found = findSubject(code);
  const sections = found ? sectionsOf(found.subject) : [];

  function chooseSubject(next: string) {
    setCode(next);
    const f = findSubject(next);
    const list = f ? sectionsOf(f.subject) : [];
    setTarget(
      list.includes(target)
        ? target
        : (list.find((u) => u > 0) ?? list[0] ?? 0),
    );
  }

  async function move() {
    setBusy(true);
    setError(null);
    const failed: string[] = [];
    let moved = 0;
    for (const i of items) {
      if (i.kind === "d" && !admin) {
        failed.push(`${i.name} (admins only)`);
        continue;
      }
      const db = supabaseBrowser();
      const { error: err } =
        i.kind === "d"
          ? await db.rpc("staff_move_drive_file", {
              p_file: i.id,
              p_subject: code,
              p_unit: target,
            })
          : await db.rpc("staff_move_file", {
              p_file: i.id,
              p_subject: code,
              p_unit: target,
            });
      if (err) failed.push(`${i.name} (${err.message})`);
      else moved += 1;
    }
    setBusy(false);
    if (moved === 0) return setError(failed.join("; ") || "Nothing was moved.");
    await onDone(
      { subject: code, unit: target },
      failed.length
        ? `Moved ${moved}. Not moved: ${failed.join("; ")}`
        : `Moved ${moved}.`,
    );
  }

  const field =
    "mt-1.5 h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-accent";
  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Move notes"
    >
      <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-pop">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">
            Move {items.length} {items.length === 1 ? "note" : "notes"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-9 shrink-0 place-items-center rounded-lg hover:bg-surface-2"
          >
            <X className="size-4" />
          </button>
        </div>
        <label className="mt-5 block text-sm font-medium">
          Subject
          <select
            value={code}
            onChange={(e) => chooseSubject(e.target.value)}
            className={field}
          >
            {subjects.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-4 block text-sm font-medium">
          Chapter or section
          <select
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
            className={field}
          >
            {found &&
              sections.map((u) => (
                <option key={u} value={u}>
                  {sectionLabel(u)} · {sectionTitle(found.subject, u)}
                </option>
              ))}
          </select>
        </label>
        <p className="mt-3 text-xs text-ink-3">
          Each note keeps its uploader, comments, votes and saves. Only where it
          appears changes.
        </p>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-line px-4 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void move()}
            className="btn-primary inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
          >
            {busy && <Loader2 className="size-4 animate-spin" />} Move here
          </button>
        </div>
      </div>
    </div>
  );
}
