import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import PaginationBar from "../components/PaginationBar";
import TableFilterBar from "../components/TableFilterBar";
import { useTableFilters } from "../hooks/useTableFilters";
import { PAGE_SIZE_OPTIONS } from "../hooks/useClientPagination";
import { useLocale } from "../i18n/LocaleContext";
import { pickAxiosErrorMessage } from "../lib/apiError";
import { ownerFormatMoney } from "../owner/ownerFormat";
import { confirmDanger } from "../lib/swalConfirm";
import { toastError, toastSuccess } from "../lib/toast";
import { filtersFromSearchParams, searchParamsFromTableState } from "../lib/filterTableRows";
import { formatMarketDateTime } from "../utils/formatMarketDateTime";

type PageTab = "sales" | "redemptions";

type OrderRow = {
  id: string;
  source?: "store" | "external";
  representative_id: number;
  store_id: number | null;
  store_name: string;
  area_id?: number | null;
  area_name?: string | null;
  rep_name: string;
  payment_type: string;
  total_amount: string;
  created_at: string;
  product_names?: string;
  product_ids?: string;
};

type OrderSummary = {
  totalCount: number;
  totalRevenue: number;
  monthOrderCount: number;
  monthRevenue: number;
  filteredCount: number;
  filteredRevenue: number;
};

type OrdersPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type RedemptionRow = {
  id: string;
  createdAt: string;
  totalPointsSpent: number;
  storeId: number;
  storeName: string;
  repName: string;
  lines: {
    productName: string;
    quantity: number;
    pointsSpent: number;
  }[];
};

type AreaOption = { id: number; name: string };
type ProductOption = { id: number; name: string };
type RepOption = { id: number; full_name: string };

const ORDER_FILTER_KEYS = [
  "dateFrom",
  "dateTo",
  "type",
  "rep",
  "area",
  "id",
  "store",
  "total",
  "productId",
  "source",
] as const;

function parsePositiveInt(raw: string | null, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export default function OrdersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { can } = useAuth();
  const { t, locale } = useLocale();

  const [pageTab, setPageTab] = useState<PageTab>(() =>
    searchParams.get("tab") === "redemptions" ? "redemptions" : "sales"
  );
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionRow[]>([]);
  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [serverPagination, setServerPagination] = useState<OrdersPagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [redemptionsLoading, setRedemptionsLoading] = useState(false);
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [reps, setReps] = useState<RepOption[]>([]);

  const [search, setSearchState] = useState(() => searchParams.get("q") ?? "");
  const [filters, setFilters] = useState<Record<string, string>>(() =>
    filtersFromSearchParams(searchParams, ORDER_FILTER_KEYS)
  );
  const [showFilters, setShowFilters] = useState(
    () =>
      (searchParams.get("q") ?? "").trim() !== "" ||
      ORDER_FILTER_KEYS.some((k) => (searchParams.get(k) ?? "").trim() !== "")
  );
  const [page, setPage] = useState(() => parsePositiveInt(searchParams.get("page"), 1));
  const [pageSize, setPageSizeState] = useState(() => {
    const n = parsePositiveInt(searchParams.get("pageSize"), 20);
    return PAGE_SIZE_OPTIONS.includes(n as (typeof PAGE_SIZE_OPTIONS)[number]) ? n : 20;
  });

  const canDelete = can("orders.delete");
  const canRedeemRead = can("redeem.read");
  const canRedeemDelete = can("redeem.write") || can("orders.delete");

  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  const hasActiveFilters =
    search.trim() !== "" || Object.values(filters).some((v) => v !== "");

  function setSearch(value: string) {
    setSearchState(value);
    setPage(1);
  }

  function setFilter(id: string, value: string) {
    setFilters((prev) => ({ ...prev, [id]: value }));
    setPage(1);
  }

  function clearFilters() {
    setSearchState("");
    setFilters({});
    setPage(1);
  }

  function setPageSize(n: number) {
    setPageSizeState(n);
    setPage(1);
  }

  const repFilterOptions = useMemo(
    () =>
      reps
        .slice()
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "ar"))
        .map((r) => ({ value: r.full_name, label: r.full_name })),
    [reps]
  );

  const paymentTypeOptions = useMemo(
    () => [
      { value: "cash", label: t.overview.payCash },
      { value: "deferred", label: t.overview.payDeferred },
    ],
    [t.overview.payCash, t.overview.payDeferred]
  );

  const sourceOptions = useMemo(
    () => [
      { value: "store", label: t.orders.sourceStore },
      { value: "external", label: t.orders.sourceExternal },
    ],
    [t.orders.sourceExternal, t.orders.sourceStore]
  );

  const productFilterOptions = useMemo(
    () =>
      products
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, "ar"))
        .map((p) => ({ value: String(p.id), label: p.name })),
    [products]
  );

  const areaFilterOptions = useMemo(
    () =>
      areas
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, "ar"))
        .map((a) => ({ value: a.name, label: a.name })),
    [areas]
  );

  const orderFilterFields = useMemo(
    () => [
      { id: "id", label: t.orders.colId, type: "text" as const, getValue: () => "" },
      { id: "store", label: t.orders.colStore, type: "text" as const, getValue: () => "" },
      {
        id: "area",
        label: t.orders.colArea,
        type: "searchableSelect" as const,
        getValue: () => "",
        options: areaFilterOptions,
      },
      {
        id: "productId",
        label: t.orders.colProducts,
        type: "searchableSelect" as const,
        getValue: () => "",
        options: productFilterOptions,
      },
      {
        id: "source",
        label: t.orders.colSource,
        type: "select" as const,
        getValue: () => "",
        options: sourceOptions,
      },
      {
        id: "rep",
        label: t.orders.colRep,
        type: "searchableSelect" as const,
        getValue: () => "",
        options: repFilterOptions,
      },
      {
        id: "type",
        label: t.orders.colType,
        type: "select" as const,
        getValue: () => "",
        options: paymentTypeOptions,
      },
      { id: "total", label: t.orders.colTotal, type: "text" as const, getValue: () => "" },
      {
        id: "dateFrom",
        label: t.orders.dateFrom,
        type: "dateFrom" as const,
        getValue: () => "",
      },
      {
        id: "dateTo",
        label: t.orders.dateTo,
        type: "dateTo" as const,
        getValue: () => "",
      },
    ],
    [
      areaFilterOptions,
      paymentTypeOptions,
      productFilterOptions,
      repFilterOptions,
      sourceOptions,
      t.orders.colArea,
      t.orders.colId,
      t.orders.colProducts,
      t.orders.colRep,
      t.orders.colSource,
      t.orders.colStore,
      t.orders.colTotal,
      t.orders.colType,
      t.orders.dateFrom,
      t.orders.dateTo,
    ]
  );

  const selectedRepName = (filters.rep ?? "").trim();
  const selectedRepId = useMemo(() => {
    if (!selectedRepName) return null;
    const hit = reps.find((r) => r.full_name.trim() === selectedRepName);
    return hit?.id ?? null;
  }, [reps, selectedRepName]);

  useEffect(() => {
    void (async () => {
      try {
        const productsRes = await api
          .get<{ products: ProductOption[] }>("/products")
          .catch(() => ({ data: { products: [] as ProductOption[] } }));
        setProducts((productsRes.data.products ?? []).map((p) => ({ id: p.id, name: p.name })));
      } catch {
        setProducts([]);
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await api.get<{ areas: AreaOption[] }>("/areas", {
          params: selectedRepId ? { representativeId: selectedRepId } : undefined,
        });
        setAreas(data.areas ?? []);
      } catch {
        setAreas([]);
      }
    })();
  }, [selectedRepId]);

  useEffect(() => {
    const areaVal = (filters.area ?? "").trim();
    if (!areaVal) return;
    if (areas.length === 0) return;
    if (!areas.some((a) => a.name === areaVal)) {
      setFilters((prev) => ({ ...prev, area: "" }));
    }
  }, [areas, filters.area]);

  useEffect(() => {
    if (pageTab !== "sales") return;
    const next = searchParamsFromTableState({
      filters,
      search,
      extra: {
        page: page > 1 ? String(page) : undefined,
        pageSize: pageSize !== 20 ? String(pageSize) : undefined,
      },
    });
    const cur = searchParams.toString();
    const nxt = next.toString();
    if (cur !== nxt) setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync sales filters to URL
  }, [filters, search, page, pageSize, pageTab]);

  useEffect(() => {
    if (pageTab === "redemptions") {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("tab", "redemptions");
          return next;
        },
        { replace: true }
      );
    }
  }, [pageTab, setSearchParams]);

  useEffect(() => {
    if (pageTab !== "sales") return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      void (async () => {
        setOrdersLoading(true);
        try {
          const params: Record<string, string | number> = {
            page,
            pageSize,
          };
          const q = search.trim();
          if (q) params.q = q;
          for (const key of ORDER_FILTER_KEYS) {
            const v = (filters[key] ?? "").trim();
            if (!v) continue;
            if (key === "productId") {
              const id = Number(v);
              if (Number.isFinite(id) && id > 0) params.productId = id;
              continue;
            }
            params[key] = v;
          }
          const { data } = await api.get<{
            orders: OrderRow[];
            summary: OrderSummary;
            pagination: OrdersPagination;
            filterOptions?: { reps: RepOption[] };
          }>("/orders", { params });
          if (cancelled) return;
          setOrders(data.orders ?? []);
          setSummary(data.summary);
          setServerPagination(
            data.pagination ?? {
              page,
              pageSize,
              total: data.summary?.filteredCount ?? 0,
              totalPages: 1,
            }
          );
          if (data.filterOptions?.reps) {
            setReps(data.filterOptions.reps);
          }
        } catch (e) {
          if (!cancelled) {
            toastError(pickAxiosErrorMessage(e, t.orders.loadFailed));
          }
        } finally {
          if (!cancelled) setOrdersLoading(false);
        }
      })();
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [page, pageSize, filtersKey, search, pageTab, filters, t.orders.loadFailed]);

  const redemptionFilterFields = useMemo(
    () => [
      { id: "id", label: t.orders.colId, type: "text" as const, getValue: (r: RedemptionRow) => r.id },
      { id: "store", label: t.orders.colStore, type: "text" as const, getValue: (r: RedemptionRow) => r.storeName },
      { id: "rep", label: t.orders.colRep, type: "text" as const, getValue: (r: RedemptionRow) => r.repName },
      {
        id: "points",
        label: t.orders.colPoints,
        type: "text" as const,
        getValue: (r: RedemptionRow) => r.totalPointsSpent,
      },
      {
        id: "products",
        label: t.orders.colProducts,
        type: "text" as const,
        getValue: (r: RedemptionRow) => r.lines.map((l) => l.productName).join(", "),
      },
      {
        id: "dateFrom",
        label: t.orders.dateFrom,
        type: "dateFrom" as const,
        getValue: (r: RedemptionRow) => r.createdAt,
      },
      {
        id: "dateTo",
        label: t.orders.dateTo,
        type: "dateTo" as const,
        getValue: (r: RedemptionRow) => r.createdAt,
      },
    ],
    [
      t.orders.colId,
      t.orders.colPoints,
      t.orders.colProducts,
      t.orders.colRep,
      t.orders.colStore,
      t.orders.dateFrom,
      t.orders.dateTo,
    ]
  );

  const redemptionTable = useTableFilters(redemptions, {
    searchAccessors: [
      "id",
      "storeName",
      "repName",
      "totalPointsSpent",
      (r) => formatMarketDateTime(r.createdAt, locale),
      (r) => r.lines.map((l) => `${l.productName} ${l.quantity}`).join(" "),
    ],
    fields: redemptionFilterFields,
  });
  const redemptionPgn = redemptionTable.pagination;

  const filteredPointsTotal = useMemo(
    () => redemptionTable.filtered.reduce((sum, r) => sum + r.totalPointsSpent, 0),
    [redemptionTable.filtered]
  );

  const formatMoney = (n: number) => ownerFormatMoney(n, t.overview.currency);

  function paymentTypeLabel(type: string): string {
    if (type === "cash") return t.overview.payCash;
    if (type === "deferred") return t.overview.payDeferred;
    return type;
  }

  function formatRedemptionLines(lines: RedemptionRow["lines"]) {
    return lines.map((l) => `${l.productName} ×${l.quantity}`).join(" · ");
  }

  async function reloadOrders() {
    try {
      const params: Record<string, string | number> = { page, pageSize };
      const q = search.trim();
      if (q) params.q = q;
      for (const key of ORDER_FILTER_KEYS) {
        const v = (filters[key] ?? "").trim();
        if (!v) continue;
        if (key === "productId") {
          const id = Number(v);
          if (Number.isFinite(id) && id > 0) params.productId = id;
          continue;
        }
        params[key] = v;
      }
      const { data } = await api.get<{
        orders: OrderRow[];
        summary: OrderSummary;
        pagination: OrdersPagination;
        filterOptions?: { reps: RepOption[] };
      }>("/orders", { params });
      setOrders(data.orders ?? []);
      setSummary(data.summary);
      setServerPagination(
        data.pagination ?? {
          page,
          pageSize,
          total: data.summary?.filteredCount ?? 0,
          totalPages: 1,
        }
      );
      if (data.filterOptions?.reps) {
        setReps(data.filterOptions.reps);
      }
    } catch (e) {
      toastError(pickAxiosErrorMessage(e, t.orders.loadFailed));
    }
  }

  async function loadRedemptions() {
    if (!canRedeemRead) return;
    setRedemptionsLoading(true);
    try {
      const { data } = await api.get<{ redemptions: RedemptionRow[] }>("/redeem/redemptions", {
        params: { limit: 500 },
      });
      setRedemptions(data.redemptions ?? []);
    } catch (e) {
      toastError(pickAxiosErrorMessage(e, t.orders.redemptionsLoadFailed));
    } finally {
      setRedemptionsLoading(false);
    }
  }

  useEffect(() => {
    if (pageTab === "redemptions" && canRedeemRead) {
      void loadRedemptions();
    }
  }, [pageTab, canRedeemRead]);

  function openOrder(orderId: string) {
    const returnTo = `${location.pathname}${location.search}`;
    navigate(`/app/orders/${orderId}`, { state: { fromOrders: returnTo } });
  }

  async function removeOrder(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!canDelete) return;
    const ok = await confirmDanger({
      title: t.orders.deleteTitle,
      text: t.orders.confirmDelete,
      confirmText: t.orders.delete,
      cancelText: t.orders.cancelDelete,
    });
    if (!ok) return;
    try {
      await api.delete(`/orders/${id}`);
      await reloadOrders();
      toastSuccess(t.orders.deleted);
    } catch (err) {
      toastError(pickAxiosErrorMessage(err, t.orders.deleteFailed));
    }
  }

  async function removeRedemption(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!canRedeemDelete) return;
    const ok = await confirmDanger({
      title: t.orders.deleteRedemptionTitle,
      text: t.orders.confirmDeleteRedemption,
      confirmText: t.orders.delete,
      cancelText: t.orders.cancelDelete,
    });
    if (!ok) return;
    try {
      await api.delete(`/redeem/redemptions/${id}`);
      await loadRedemptions();
      toastSuccess(t.orders.deletedRedemption);
    } catch (err) {
      toastError(pickAxiosErrorMessage(err, t.orders.deleteRedemptionFailed));
    }
  }

  const showingFiltered = hasActiveFilters;
  const showingRedemptionFiltered = redemptionTable.hasActiveFilters;
  const filteredCount = summary?.filteredCount ?? serverPagination.total;
  const filteredRevenue = summary?.filteredRevenue ?? 0;
  const pgnFrom =
    filteredCount === 0 ? 0 : (serverPagination.page - 1) * serverPagination.pageSize + 1;
  const pgnTo =
    filteredCount === 0 ? 0 : Math.min(serverPagination.page * serverPagination.pageSize, filteredCount);

  return (
    <div className="grid">
      <div className="card">
        <h2>{t.orders.title}</h2>
        {canRedeemRead ? (
          <div className="orders-page-tabs" role="tablist" aria-label={t.orders.tabsAria}>
            <button
              type="button"
              role="tab"
              aria-selected={pageTab === "sales"}
              className={`orders-page-tab${pageTab === "sales" ? " orders-page-tab--on" : ""}`}
              onClick={() => setPageTab("sales")}
            >
              {t.orders.tabSales}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={pageTab === "redemptions"}
              className={`orders-page-tab${pageTab === "redemptions" ? " orders-page-tab--on" : ""}`}
              onClick={() => setPageTab("redemptions")}
            >
              {t.orders.tabRedemptions}
            </button>
          </div>
        ) : null}

        {pageTab === "sales" ? (
          <>
            <p className="muted small">{t.orders.rowHint}</p>
            <TableFilterBar
              search={search}
              filters={filters}
              showFilters={showFilters}
              fields={orderFilterFields}
              totalCount={summary?.totalCount ?? 0}
              filteredCount={filteredCount}
              hasActiveFilters={hasActiveFilters}
              onSearchChange={setSearch}
              onFilterChange={setFilter}
              onClear={clearFilters}
              onToggleFilters={() => setShowFilters((v) => !v)}
              pinnedFieldIds={["dateFrom", "dateTo", "type", "rep", "area", "productId"]}
              labels={t.tableFilters}
            />
            {summary && (
              <div className="orders-filter-totals stat-row">
                <div className="stat-pill">
                  <span className="muted small">
                    {showingFiltered ? t.orders.filteredOrders : t.orders.allOrdersCount}
                  </span>
                  <strong>{showingFiltered ? filteredCount : summary.totalCount}</strong>
                </div>
                <div className="stat-pill stat-pill--accent">
                  <span className="muted small">{t.overview.monthRevenue}</span>
                  <strong>{formatMoney(summary.monthRevenue)}</strong>
                  <span className="muted small orders-stat-sub">
                    {t.orders.monthOrdersCount(summary.monthOrderCount)}
                  </span>
                </div>
                <div className="stat-pill">
                  <span className="muted small">
                    {showingFiltered ? t.orders.filteredTotal : t.overview.totalRevenue}
                  </span>
                  <strong>
                    {formatMoney(showingFiltered ? filteredRevenue : summary.totalRevenue)}
                  </strong>
                </div>
                {showingFiltered ? (
                  <span className="muted small orders-filter-totals-hint">
                    {t.orders.filteredTotalsHint} ·{" "}
                    {t.tableFilters.filteredSummary(filteredCount, summary.totalCount)}
                  </span>
                ) : (
                  <span className="muted small orders-filter-totals-hint">{t.orders.totalsMatchHome}</span>
                )}
              </div>
            )}
            {ordersLoading ? <p className="muted">{t.common.loading}</p> : null}
            {filteredCount > 0 && (
              <PaginationBar
                className="pagination-bar--flush"
                page={serverPagination.page}
                totalPages={serverPagination.totalPages}
                totalItems={filteredCount}
                from={pgnFrom}
                to={pgnTo}
                pageSize={pageSize}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            )}
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t.orders.colId}</th>
                    <th>{t.orders.colStore}</th>
                    <th>{t.orders.colProducts}</th>
                    <th>{t.orders.colSource}</th>
                    <th>{t.orders.colRep}</th>
                    <th>{t.orders.colType}</th>
                    <th>{t.orders.colTotal}</th>
                    <th>{t.orders.colWhen}</th>
                    {canDelete && <th>{t.orders.colActions}</th>}
                  </tr>
                </thead>
                <tbody>
                  {!ordersLoading && orders.length === 0 ? (
                    <tr>
                      <td colSpan={canDelete ? 9 : 8} className="muted">
                        {t.tableFilters.noResults}
                      </td>
                    </tr>
                  ) : (
                    orders.map((o) => (
                      <tr
                        key={o.id}
                        className="store-row"
                        onClick={() => openOrder(String(o.id))}
                        role="link"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openOrder(String(o.id));
                          }
                        }}
                      >
                        <td className="strong">#{o.id}</td>
                        <td>{o.store_name}</td>
                        <td className="small">{o.product_names || "—"}</td>
                        <td>
                          {(o.source ?? "store") === "external"
                            ? t.orders.sourceExternal
                            : t.orders.sourceStore}
                        </td>
                        <td>{o.rep_name}</td>
                        <td>{paymentTypeLabel(o.payment_type)}</td>
                        <td>{formatMoney(parseFloat(o.total_amount) || 0)}</td>
                        <td className="small muted">{formatMarketDateTime(o.created_at)}</td>
                        {canDelete && (
                          <td onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="ghost danger"
                              onClick={(e) => void removeOrder(e, o.id)}
                            >
                              {t.orders.delete}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <p className="muted small">{t.orders.redemptionsHint}</p>
            {redemptionsLoading ? (
              <p className="muted">{t.common.loading}</p>
            ) : (
              <>
                <TableFilterBar
                  {...redemptionTable}
                  onSearchChange={redemptionTable.setSearch}
                  onFilterChange={redemptionTable.setFilter}
                  onClear={redemptionTable.clearFilters}
                  onToggleFilters={() => redemptionTable.setShowFilters((v) => !v)}
                  pinnedFieldIds={["dateFrom", "dateTo", "store", "rep"]}
                  labels={t.tableFilters}
                />
                <div className="orders-filter-totals stat-row">
                  <div className="stat-pill">
                    <span className="muted small">
                      {showingRedemptionFiltered ? t.orders.filteredRedemptions : t.orders.allRedemptionsCount}
                    </span>
                    <strong>
                      {showingRedemptionFiltered ? redemptionTable.filteredCount : redemptions.length}
                    </strong>
                  </div>
                  <div className="stat-pill stat-pill--accent">
                    <span className="muted small">{t.orders.colPoints}</span>
                    <strong>
                      {t.overview.loyaltyPoints(
                        showingRedemptionFiltered
                          ? filteredPointsTotal
                          : redemptions.reduce((s, r) => s + r.totalPointsSpent, 0)
                      )}
                    </strong>
                  </div>
                </div>
                {redemptionTable.filteredCount > 0 && (
                  <PaginationBar
                    className="pagination-bar--flush"
                    page={redemptionPgn.page}
                    totalPages={redemptionPgn.totalPages}
                    totalItems={redemptionPgn.total}
                    from={redemptionPgn.from}
                    to={redemptionPgn.to}
                    pageSize={redemptionPgn.pageSize}
                    pageSizeOptions={redemptionPgn.pageSizeOptions}
                    onPageChange={redemptionPgn.setPage}
                    onPageSizeChange={redemptionPgn.setPageSize}
                  />
                )}
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t.orders.colId}</th>
                        <th>{t.orders.colStore}</th>
                        <th>{t.orders.colRep}</th>
                        <th>{t.orders.colProducts}</th>
                        <th>{t.orders.colPoints}</th>
                        <th>{t.orders.colWhen}</th>
                        {canRedeemDelete && <th>{t.orders.colActions}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {redemptionPgn.slice.length === 0 ? (
                        <tr>
                          <td colSpan={canRedeemDelete ? 7 : 6} className="muted">
                            {t.orders.emptyRedemptions}
                          </td>
                        </tr>
                      ) : (
                        redemptionPgn.slice.map((r) => (
                          <tr key={r.id}>
                            <td className="strong">#{r.id}</td>
                            <td>
                              <Link
                                to={`/app/stores/${r.storeId}`}
                                className="linkish"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {r.storeName}
                              </Link>
                            </td>
                            <td>{r.repName}</td>
                            <td className="small">{formatRedemptionLines(r.lines)}</td>
                            <td className="strong">{t.overview.loyaltyPoints(r.totalPointsSpent)}</td>
                            <td className="small muted">{formatMarketDateTime(r.createdAt, locale)}</td>
                            {canRedeemDelete && (
                              <td>
                                <button
                                  type="button"
                                  className="ghost danger"
                                  onClick={(e) => void removeRedemption(e, r.id)}
                                >
                                  {t.orders.delete}
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
