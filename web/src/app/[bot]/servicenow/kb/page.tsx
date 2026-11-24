"use client";
import { ChevronDown, ChevronRight, MoreHorizontal, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { API, useApi } from "@/lib/api";
import { SN_STATE, type SnArticle, type SnCategory, type SnState, type SnVersion } from "@/lib/sn";
import { useBot } from "@/components/shell";
import { Badge, Button, Card, Empty, ErrorNote, inputCls, Loading, Page, PageHeader, Tabs } from "@/components/ui";
import { ago, cn } from "@/lib/utils";

type Summary = { status: Record<SnState, number>; flags: [string, number][] };
const STATES: SnState[] = ["published", "review", "draft", "pending_retirement", "retired"];

export default function SnKbPage() {
  const bot = useBot();
  const [state, setState] = useState<SnState>("published");
  const [cat, setCat] = useState<number | null>(null);
  const [flag, setFlag] = useState("");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(50);
  const cats = useApi<{ categories: SnCategory[] }>(`/api/chatbots/${bot}/servicenow/categories`);
  const sum = useApi<Summary>(`/api/chatbots/${bot}/servicenow/review-summary`);
  const versions = useApi<SnVersion[]>(`/api/chatbots/${bot}/servicenow/versions`);
  const qs = new URLSearchParams({ status: state, limit: String(limit), ...(cat ? { category: String(cat), sub: "true" } : {}), ...(flag ? { flag } : {}), ...(q.trim() ? { q: q.trim() } : {}) });
  const list = useApi<{ total: number; articles: SnArticle[] }>(`/api/chatbots/${bot}/servicenow/articles?${qs}`);
  const reset = () => setLimit(50);
  const exp = (f: string) => `${API}/api/chatbots/${bot}/servicenow/export?format=${f}`;

  return (
    <Page wide>
      <PageHeader title="Knowledge base" description="Every article, in every state."
        actions={<Link href={`/${bot}/servicenow/article/new${cat ? `?category=${cat}` : ""}`}><Button variant="primary"><Plus className="size-4" /> Create an article</Button></Link>} />
      {(list.error || cats.error) && <ErrorNote>{list.error || cats.error}</ErrorNote>}

      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <input className={cn(inputCls, "pl-9")} placeholder="Search title, text or KB number" value={q} onChange={(e) => { setQ(e.target.value); reset(); }} />
        </div>
        <select aria-label="Flags" className="h-9 rounded-[10px] border border-line bg-white px-3 text-sm" value={flag} onChange={(e) => { setFlag(e.target.value); reset(); }}>
          <option value="">Flags: Any</option>
          {sum.data?.flags.map(([f, n]) => <option key={f} value={f}>{f} ({n})</option>)}
        </select>
        <details className="relative">
          <summary aria-label="More" className="flex h-9 cursor-pointer list-none items-center rounded-[10px] border border-line bg-white px-2.5 hover:bg-subtle"><MoreHorizontal className="size-4" /></summary>
          <div className="absolute right-0 z-30 mt-1 w-64 rounded-xl border border-line bg-white p-1 text-[13px] shadow-lg">
            {versions.data?.length ? (
              <>
                <a href={exp("json")} className="block rounded-lg px-2.5 py-1.5 hover:bg-neutral-100">Download latest release (JSON)</a>
                <a href={exp("md")} className="block rounded-lg px-2.5 py-1.5 hover:bg-neutral-100">Download latest release (Markdown)</a>
              </>
            ) : <p className="px-2.5 py-1.5 text-muted">No release yet</p>}
            <Link href={`/${bot}/servicenow/publish`} className="block rounded-lg px-2.5 py-1.5 hover:bg-neutral-100">Past releases</Link>
          </div>
        </details>
      </div>

      <Tabs className="mb-5" value={state} onChange={(v) => { setState(v); reset(); }}
        items={STATES.map((s) => ({ value: s, label: SN_STATE[s].label, count: sum.data?.status[s] ?? 0 }))} />

      <div className="grid grid-cols-[260px_1fr] items-start gap-6">
        <Tree cats={cats.data?.categories} selected={cat} onSelect={(id) => { setCat(id); reset(); }} />
        <div className="min-w-0">
          {!list.data ? (!list.error && <Loading />) : list.data.articles.length === 0 ? (
            <Card><Empty title={cats.data?.categories.length ? "No articles here" : "Nothing imported yet"}>
              {cats.data?.categories.length ? "Try another state, category or flag." : "The ServiceNow import runs on the server. Ask the person who manages it."}
            </Empty></Card>
          ) : (
            <>
              <Card className="divide-y divide-line">
                {list.data.articles.map((a) => <Row key={a.id} bot={bot} a={a} />)}
              </Card>
              {list.data.total > list.data.articles.length && (
                <button onClick={() => setLimit((l) => l + 100)} className="mt-3 w-full rounded-xl border border-line py-2.5 text-[13px] font-medium text-neutral-600 hover:bg-subtle">
                  Show more ({list.data.total - list.data.articles.length} remaining)
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </Page>
  );
}

function Row({ bot, a }: { bot: string; a: SnArticle }) {
  return (
    <div className="relative px-5 py-3.5 hover:bg-subtle">
      <div className="flex flex-wrap items-center gap-1.5">
        {/* stretched link: the whole row opens the article, the KB number link sits above it */}
        <Link href={`/${bot}/servicenow/article/${a.id}`} className="text-[13px] font-medium after:absolute after:inset-0">{a.title}</Link>
        {a.p_stage === "review" && <Badge tone="amber">Change in review</Badge>}
        {a.p_stage === "draft" && <Badge>Draft change</Badge>}
        {a.flags.map((f) => <Badge key={f} tone={f === "Internal only" ? "violet" : "neutral"}>{f}</Badge>)}
      </div>
      <p className="mt-0.5 text-xs text-muted">{a.category ?? "No category"} · Updated {ago(a.updated_at)}{a.reviewer && ` by ${a.reviewer}`}</p>
      {a.excerpt && <p className="mt-1 line-clamp-2 text-[13px] text-neutral-600">{a.excerpt}</p>}
      {a.number && (a.kb_url
        ? <a href={a.kb_url} target="_blank" rel="noreferrer" className="relative z-10 mt-1 inline-block font-mono text-[11px] text-neutral-400 hover:text-ink">{a.number}</a>
        : <p className="mt-1 font-mono text-[11px] text-neutral-400">{a.number}</p>)}
    </div>
  );
}

function Tree({ cats, selected, onSelect }: { cats?: SnCategory[]; selected: number | null; onSelect: (id: number | null) => void }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState("");
  const { kids, sizes } = useMemo(() => {
    const kids = new Map<number | null, SnCategory[]>();
    cats?.forEach((c) => kids.set(c.parent_id, [...(kids.get(c.parent_id) ?? []), c]));
    const sizes = new Map<number, number>();
    const size = (c: SnCategory): number => {
      const n = c.total + (kids.get(c.id) ?? []).reduce((s, k) => s + size(k), 0);
      sizes.set(c.id, n);
      return n;
    };
    kids.get(null)?.forEach(size);
    return { kids, sizes };
  }, [cats]);
  const item = (c: SnCategory, depth: number, label = c.name) => {
    const children = (kids.get(c.id) ?? []).filter((k) => sizes.get(k.id));
    const isOpen = open.has(c.id);
    return (
      <div key={c.id}>
        <div className={cn("flex items-center rounded-lg text-[13px]", selected === c.id ? "bg-ink text-white" : "hover:bg-subtle")} style={{ paddingLeft: depth * 14 }}>
          {children.length ? (
            <button aria-label={`${isOpen ? "Collapse" : "Expand"} ${c.name}`} onClick={() => setOpen((s) => { const n = new Set(s); if (isOpen) n.delete(c.id); else n.add(c.id); return n; })} className="flex size-6 shrink-0 items-center justify-center">
              {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </button>
          ) : <span className="size-6 shrink-0" />}
          <button onClick={() => onSelect(c.id)} className="flex min-w-0 flex-1 justify-between gap-2 py-1.5 pr-2.5 text-left">
            <span className="truncate" title={c.path}>{label}</span><span className={selected === c.id ? "text-neutral-300" : "text-muted"}>{sizes.get(c.id)}</span>
          </button>
        </div>
        {isOpen && children.map((k) => item(k, depth + 1))}
      </div>
    );
  };
  const fl = filter.toLowerCase().trim();
  return (
    <Card className="sticky top-8 max-h-[calc(100vh-6rem)] overflow-y-auto p-2">
      <input className={cn(inputCls, "mb-2")} placeholder="Filter categories" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <button onClick={() => onSelect(null)} className={cn("flex w-full rounded-lg px-2.5 py-1.5 text-left text-[13px]", selected === null ? "bg-ink text-white" : "hover:bg-subtle")}>All</button>
      {!cats ? <Loading /> : fl
        ? cats.filter((c) => sizes.get(c.id) && c.path.toLowerCase().includes(fl)).map((c) => item(c, 0, c.path))
        : (kids.get(null) ?? []).filter((c) => sizes.get(c.id)).map((c) => item(c, 0))}
    </Card>
  );
}
