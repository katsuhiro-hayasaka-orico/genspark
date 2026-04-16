import io
from datetime import datetime
from typing import Optional

import pandas as pd
import plotly.express as px
import streamlit as st

st.set_page_config(page_title="予算管理ダッシュボード（ローカル）", layout="wide")


def read_csv_with_fallback(uploaded_file) -> pd.DataFrame:
    raw = uploaded_file.getvalue()
    for enc in ("utf-8-sig", "cp932", "utf-8"):
        try:
            return pd.read_csv(io.BytesIO(raw), encoding=enc)
        except Exception:
            continue
    return pd.read_csv(io.BytesIO(raw))


def find_col(df: pd.DataFrame, candidates: list[str]) -> Optional[str]:
    cols = {c.lower(): c for c in df.columns}
    for cand in candidates:
        if cand.lower() in cols:
            return cols[cand.lower()]
    return None


def normalize_detail(detail_df: pd.DataFrame) -> pd.DataFrame:
    """value_type/amount の縦持ちCSVを、plan/forecast/actual の横持ちに変換。"""
    vt_col = find_col(detail_df, ["value_type"])
    amt_col = find_col(detail_df, ["amount", "value"])

    if vt_col and amt_col:
        key_cols = [c for c in detail_df.columns if c not in {vt_col, amt_col}]
        pivoted = detail_df.pivot_table(
            index=key_cols,
            columns=vt_col,
            values=amt_col,
            aggfunc="sum",
            fill_value=0,
        ).reset_index()
        pivoted.columns = [str(c) for c in pivoted.columns]

        rename_map = {}
        for c in pivoted.columns:
            cl = c.lower()
            if cl in {"plan", "budget", "revised_plan"}:
                rename_map[c] = "revised_plan"
            elif cl in {"initial", "initial_plan"}:
                rename_map[c] = "initial_plan"
            elif cl in {"forecast", "estimate"}:
                rename_map[c] = "forecast"
            elif cl in {"actual", "result"}:
                rename_map[c] = "actual"
        pivoted = pivoted.rename(columns=rename_map)

        if "initial_plan" not in pivoted.columns and "revised_plan" in pivoted.columns:
            pivoted["initial_plan"] = pivoted["revised_plan"]
        if "forecast" not in pivoted.columns and "revised_plan" in pivoted.columns:
            pivoted["forecast"] = pivoted["revised_plan"]
        if "actual" not in pivoted.columns and "revised_plan" in pivoted.columns:
            pivoted["actual"] = 0

        yyyymm = find_col(pivoted, ["target_year_month"])
        if yyyymm:
            yymm = pivoted[yyyymm].astype(str)
            pivoted["year"] = yymm.str[:4].astype(int)
            pivoted["month"] = yymm.str[-2:].astype(int)

        if find_col(pivoted, ["fiscal_period"]):
            fp = find_col(pivoted, ["fiscal_period"])
            pivoted = pivoted.rename(columns={fp: "fiscal_year"})

        return pivoted

    return detail_df.copy()


def merge_master_detail(master_df: pd.DataFrame, detail_df: pd.DataFrame) -> pd.DataFrame:
    keys = ["management_no", "expense_item_code", "system_code", "expense_item_id", "item_no"]
    mcols = {c.lower() for c in master_df.columns}
    dcols = {c.lower() for c in detail_df.columns}
    common = [k for k in keys if k in mcols and k in dcols]

    if not common:
        return detail_df.copy()

    on_pairs = []
    for k in common:
        l = [c for c in detail_df.columns if c.lower() == k][0]
        r = [c for c in master_df.columns if c.lower() == k][0]
        on_pairs.append((l, r))

    merged = detail_df.copy()
    for i, (lk, rk) in enumerate(on_pairs):
        if i == 0:
            merged = merged.merge(master_df, left_on=lk, right_on=rk, how="left", suffixes=("", "_master"))
    return merged


def prep_dataset(master_df: pd.DataFrame, detail_df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, str], dict[str, Optional[str]]]:
    detail_norm = normalize_detail(detail_df)
    merged = merge_master_detail(master_df, detail_norm)

    amount_cols = {
        "initial": find_col(merged, ["initial_plan", "initial_plan_amount", "initial"]),
        "revised": find_col(merged, ["revised_plan", "monthly_amount", "plan", "amount"]),
        "forecast": find_col(merged, ["forecast", "forecast_amount"]),
        "actual": find_col(merged, ["actual", "actual_amount"]),
    }
    if not amount_cols["initial"] and amount_cols["revised"]:
        amount_cols["initial"] = amount_cols["revised"]
    if not amount_cols["forecast"] and amount_cols["revised"]:
        amount_cols["forecast"] = amount_cols["revised"]
    if not amount_cols["actual"] and amount_cols["revised"]:
        merged["actual"] = 0
        amount_cols["actual"] = "actual"

    for c in set(v for v in amount_cols.values() if v):
        merged[c] = pd.to_numeric(merged[c], errors="coerce").fillna(0)

    dim = {
        "fiscal_year": find_col(merged, ["fiscal_year", "fiscal_period", "period", "year"]),
        "month": find_col(merged, ["month"]),
        "domain": find_col(merged, ["system_classification_name", "domain_name", "domain"]),
        "system": find_col(merged, ["system_name", "system_code"]),
        "category": find_col(merged, ["budget_category", "expense_category_name", "category"]),
        "item": find_col(merged, ["expense_item_name", "item_name", "expense_item_code", "item_no"]),
        "management_no": find_col(merged, ["management_no"]),
    }
    return merged, amount_cols, dim


def month_name(month: int) -> str:
    arr = ["4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月", "1月", "2月", "3月"]
    if 1 <= month <= 12:
        return arr[month - 1]
    return str(month)


def render_dashboard(df: pd.DataFrame, amount: dict[str, str], dim: dict[str, Optional[str]]) -> None:
    revised = df[amount["revised"]].sum()
    initial = df[amount["initial"]].sum()
    forecast = df[amount["forecast"]].sum()
    actual = df[amount["actual"]].sum()

    remaining = revised - actual
    consumption = actual / revised * 100 if revised else 0
    variance = (forecast - revised) / revised * 100 if revised else 0

    st.markdown("### ダッシュボード")
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("修正計画", f"{revised:,.0f}", f"当初 {initial:,.0f}")
    c2.metric("実績累計", f"{actual:,.0f}", f"消化率 {consumption:.1f}%")
    c3.metric("着地見込", f"{forecast:,.0f}", f"計画比 {variance:+.1f}%")
    c4.metric("残予算", f"{remaining:,.0f}", "修正計画 - 実績")

    if dim["system"]:
        sys_sum = df.groupby(dim["system"], as_index=False)[[amount["revised"], amount["forecast"], amount["actual"]]].sum()
        sys_sum["usage_rate"] = sys_sum[amount["actual"]] / sys_sum[amount["revised"]].replace(0, pd.NA) * 100
        sys_sum["variance_rate"] = (sys_sum[amount["forecast"]] - sys_sum[amount["revised"]]) / sys_sum[amount["revised"]].replace(0, pd.NA) * 100
        alerts = sys_sum[(sys_sum["usage_rate"].fillna(0) >= 80) | (sys_sum["variance_rate"].fillna(0) >= 5)]
        if len(alerts) > 0:
            st.warning("超過/差異アラート")
            st.dataframe(alerts.sort_values(["variance_rate", "usage_rate"], ascending=False), use_container_width=True, hide_index=True)

    r1, r2 = st.columns(2)
    if dim["month"]:
        monthly = df.groupby(dim["month"], as_index=False)[[amount["revised"], amount["actual"], amount["forecast"]]].sum().sort_values(dim["month"])
        monthly["month_label"] = monthly[dim["month"]].astype(int).apply(month_name)
        fig_m = px.bar(monthly, x="month_label", y=[amount["revised"], amount["actual"]], barmode="group", title="月別推移（計画 vs 実績）")
        fig_m.add_scatter(x=monthly["month_label"], y=monthly[amount["forecast"]], mode="lines+markers", name="着地見込")
        r1.plotly_chart(fig_m, use_container_width=True)

        cum = monthly.copy()
        for c in [amount["revised"], amount["actual"], amount["forecast"]]:
            cum[c] = cum[c].cumsum()
        fig_c = px.line(cum, x="month_label", y=[amount["revised"], amount["actual"], amount["forecast"]], markers=True, title="累積推移")
        r2.plotly_chart(fig_c, use_container_width=True)

    b1, b2 = st.columns(2)
    if dim["category"]:
        cat = df.groupby(dim["category"], as_index=False)[amount["revised"]].sum()
        b1.plotly_chart(px.pie(cat, names=dim["category"], values=amount["revised"], title="費用カテゴリ別構成"), use_container_width=True)
    if dim["domain"]:
        dom = df.groupby(dim["domain"], as_index=False)[[amount["revised"], amount["actual"], amount["forecast"]]].sum()
        dom["差異率(%)"] = (dom[amount["forecast"]] - dom[amount["revised"]]) / dom[amount["revised"]].replace(0, pd.NA) * 100
        b2.dataframe(dom.sort_values(amount["actual"], ascending=False), use_container_width=True, hide_index=True)


def render_budget_input(df: pd.DataFrame, amount: dict[str, str], dim: dict[str, Optional[str]]) -> None:
    st.markdown("### 予算データ入力")
    if not (dim["system"] and dim["item"] and dim["month"]):
        st.info("システム・費目・月の列が必要です。")
        return
    amount_type = st.selectbox("金額種別", ["initial", "revised", "forecast", "actual"], format_func=lambda x: {
        "initial": "当初計画", "revised": "修正計画", "forecast": "着地見込", "actual": "実績"
    }[x])
    piv = pd.pivot_table(df, index=[dim["system"], dim["item"]], columns=dim["month"], values=amount[amount_type], aggfunc="sum", fill_value=0).reset_index()
    st.dataframe(piv, use_container_width=True, hide_index=True)


def render_analysis(df: pd.DataFrame, amount: dict[str, str], dim: dict[str, Optional[str]]) -> None:
    st.markdown("### 予実差異分析")
    axis_map = {"システム": dim["system"], "カテゴリ": dim["category"], "費目": dim["item"], "ドメイン": dim["domain"]}
    labels = [k for k, v in axis_map.items() if v]
    if not labels:
        st.info("分析可能な分類列がありません。")
        return
    axis = st.selectbox("集計軸", labels)
    gcol = axis_map[axis]

    summary = df.groupby(gcol, as_index=False)[[amount["initial"], amount["revised"], amount["forecast"], amount["actual"]]].sum()
    summary["計画差異"] = summary[amount["revised"]] - summary[amount["actual"]]
    summary["見込差異"] = summary[amount["forecast"]] - summary[amount["revised"]]
    summary["消化率(%)"] = summary[amount["actual"]] / summary[amount["revised"]].replace(0, pd.NA) * 100
    st.dataframe(summary.sort_values("計画差異"), use_container_width=True, hide_index=True)


def render_multi_year(df: pd.DataFrame, amount: dict[str, str], dim: dict[str, Optional[str]]) -> None:
    st.markdown("### 中期比較")
    if not dim["fiscal_year"]:
        st.info("年度列がありません。")
        return
    y = df.groupby(dim["fiscal_year"], as_index=False)[[amount["initial"], amount["revised"], amount["forecast"], amount["actual"]]].sum().sort_values(dim["fiscal_year"])
    st.plotly_chart(px.line(y, x=dim["fiscal_year"], y=[amount["revised"], amount["actual"], amount["forecast"]], markers=True), use_container_width=True)
    st.dataframe(y, use_container_width=True, hide_index=True)


def render_reports(df: pd.DataFrame, amount: dict[str, str], dim: dict[str, Optional[str]]) -> None:
    st.markdown("### レポート")
    t1, t2, t3, t4 = st.tabs(["ドメイン別", "システム別", "カテゴリ別", "エクスポート"])
    with t1:
        if dim["domain"]:
            st.dataframe(df.groupby(dim["domain"], as_index=False)[[amount["initial"], amount["revised"], amount["forecast"], amount["actual"]]].sum(), use_container_width=True, hide_index=True)
    with t2:
        if dim["system"]:
            st.dataframe(df.groupby(dim["system"], as_index=False)[[amount["initial"], amount["revised"], amount["forecast"], amount["actual"]]].sum(), use_container_width=True, hide_index=True)
    with t3:
        if dim["category"]:
            st.dataframe(df.groupby(dim["category"], as_index=False)[[amount["initial"], amount["revised"], amount["forecast"], amount["actual"]]].sum(), use_container_width=True, hide_index=True)
    with t4:
        st.download_button("CSV出力", data=df.to_csv(index=False).encode("utf-8-sig"), file_name="export_data.csv", mime="text/csv")


def render_master(master_df: pd.DataFrame) -> None:
    st.markdown("### マスタ管理")
    st.dataframe(master_df, use_container_width=True, hide_index=True)


def render_comments(df: pd.DataFrame, dim: dict[str, Optional[str]]) -> None:
    st.markdown("### 差異コメント")
    if "comments" not in st.session_state:
        st.session_state.comments = pd.DataFrame(columns=["日時", "期間", "種別", "管理番号", "内容"])

    with st.form("comment_add"):
        period = st.selectbox("期間", ["年間", "半期", "四半期", "月次"])
        ctype = st.selectbox("種別", ["差異説明", "備考", "アクション", "リスク"])
        mg_values = ["全体"]
        if dim["management_no"]:
            mg_values += sorted(df[dim["management_no"]].dropna().astype(str).unique().tolist())
        mg = st.selectbox("管理番号", mg_values)
        content = st.text_area("内容")
        ok = st.form_submit_button("追加")
        if ok and content.strip():
            st.session_state.comments.loc[len(st.session_state.comments)] = [
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                period,
                ctype,
                mg,
                content,
            ]
            st.success("追加しました。")

    st.dataframe(st.session_state.comments, use_container_width=True, hide_index=True)


def main() -> None:
    st.title("システム企画 予算管理ダッシュボード（ローカル）")
    st.caption("指定フォーマット（budget_master.csv / budget_detail.csv）を前提に、移植元レイアウトへ寄せて再構成しています。")

    with st.sidebar:
        st.header("CSVアップロード")
        master_file = st.file_uploader("budget_master.csv", type=["csv"], key="master")
        detail_file = st.file_uploader("budget_detail.csv", type=["csv"], key="detail")

    if not master_file or not detail_file:
        st.info("指定レイアウトの `budget_master.csv` と `budget_detail.csv` をアップロードしてください。")
        return

    master_df = read_csv_with_fallback(master_file)
    detail_df = read_csv_with_fallback(detail_file)
    merged, amount, dim = prep_dataset(master_df, detail_df)

    filtered = merged.copy()
    with st.sidebar:
        st.header("フィルタ")
        if dim["fiscal_year"]:
            f_vals = sorted(filtered[dim["fiscal_year"]].dropna().unique().tolist())
            fv = st.multiselect("年度", f_vals, default=f_vals)
            if fv:
                filtered = filtered[filtered[dim["fiscal_year"]].isin(fv)]
        if dim["system"]:
            s_vals = sorted(filtered[dim["system"]].dropna().astype(str).unique().tolist())
            sv = st.multiselect("システム", s_vals, default=s_vals)
            if sv:
                filtered = filtered[filtered[dim["system"]].astype(str).isin(sv)]

    page = st.sidebar.radio(
        "メニュー",
        ["ダッシュボード", "予算データ入力", "予実差異分析", "中期比較", "レポート", "マスタ管理", "差異コメント"],
    )

    if page == "ダッシュボード":
        render_dashboard(filtered, amount, dim)
    elif page == "予算データ入力":
        render_budget_input(filtered, amount, dim)
    elif page == "予実差異分析":
        render_analysis(filtered, amount, dim)
    elif page == "中期比較":
        render_multi_year(merged, amount, dim)
    elif page == "レポート":
        render_reports(filtered, amount, dim)
    elif page == "マスタ管理":
        render_master(master_df)
    elif page == "差異コメント":
        render_comments(filtered, dim)


if __name__ == "__main__":
    main()
