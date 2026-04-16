import io
from datetime import datetime
from typing import Optional

import pandas as pd
import plotly.express as px
import streamlit as st

st.set_page_config(page_title="予算管理ダッシュボード（ローカル）", layout="wide")


AMOUNT_ALIASES = {
    "initial": ["initial_plan", "initial_plan_amount", "initial", "plan_initial"],
    "revised": ["revised_plan", "revised_plan_amount", "revised", "plan_revised", "budget"],
    "forecast": ["forecast", "forecast_amount", "landing", "estimate"],
    "actual": ["actual", "actual_amount", "result", "actuals"],
}


def read_csv_with_fallback(uploaded_file) -> pd.DataFrame:
    raw = uploaded_file.getvalue()
    for enc in ("utf-8-sig", "cp932", "utf-8"):
        try:
            return pd.read_csv(io.BytesIO(raw), encoding=enc)
        except Exception:
            continue
    return pd.read_csv(io.BytesIO(raw))


def col(df: pd.DataFrame, candidates: list[str]) -> Optional[str]:
    m = {c.lower(): c for c in df.columns}
    for c in candidates:
        if c.lower() in m:
            return m[c.lower()]
    return None


def pick_amount_cols(df: pd.DataFrame) -> dict[str, str]:
    out: dict[str, str] = {}
    lower_map = {c.lower(): c for c in df.columns}

    for key, aliases in AMOUNT_ALIASES.items():
        for alias in aliases:
            if alias.lower() in lower_map:
                out[key] = lower_map[alias.lower()]
                break

    if "revised" not in out:
        num = df.select_dtypes(include="number").columns.tolist()
        if num:
            out["revised"] = num[-1]
    if "actual" not in out:
        out["actual"] = out.get("revised", "")
    if "forecast" not in out:
        out["forecast"] = out.get("revised", "")
    if "initial" not in out:
        out["initial"] = out.get("revised", "")
    return out


def merge_master_detail(master_df: pd.DataFrame, detail_df: pd.DataFrame) -> pd.DataFrame:
    keys = ["expense_item_id", "item_id", "budget_item_id", "id", "system_id"]
    mcols = {c.lower() for c in master_df.columns}
    dcols = {c.lower() for c in detail_df.columns}
    common = [k for k in keys if k in mcols and k in dcols]
    if not common:
        return detail_df.copy()

    key = common[0]
    left = [c for c in detail_df.columns if c.lower() == key][0]
    right = [c for c in master_df.columns if c.lower() == key][0]
    return detail_df.merge(master_df, left_on=left, right_on=right, how="left", suffixes=("", "_master"))


def ensure_numeric(df: pd.DataFrame, amount_cols: dict[str, str]) -> pd.DataFrame:
    out = df.copy()
    for c in set(amount_cols.values()):
        if c:
            out[c] = pd.to_numeric(out[c], errors="coerce").fillna(0)
    return out


def period_label(month: int, mode: str) -> str:
    if mode == "半期":
        return "H1" if month <= 6 else "H2"
    if month <= 3:
        return "Q1"
    if month <= 6:
        return "Q2"
    if month <= 9:
        return "Q3"
    return "Q4"


def render_dashboard(df: pd.DataFrame, amount: dict[str, str], dim: dict[str, Optional[str]]) -> None:
    st.subheader("ダッシュボード")
    revised = df[amount["revised"]].sum()
    actual = df[amount["actual"]].sum()
    forecast = df[amount["forecast"]].sum()
    initial = df[amount["initial"]].sum()
    remaining = revised - actual
    consumption_rate = (actual / revised * 100) if revised else 0
    variance_rate = ((forecast - revised) / revised * 100) if revised else 0

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("当初計画", f"{initial:,.0f}")
    c2.metric("修正計画", f"{revised:,.0f}")
    c3.metric("実績累計", f"{actual:,.0f}", f"消化率 {consumption_rate:.1f}%")
    c4.metric("着地見込", f"{forecast:,.0f}", f"計画差異 {variance_rate:+.1f}%")

    d1, d2, d3 = st.columns(3)
    d1.metric("残予算", f"{remaining:,.0f}")
    d2.metric("見込-計画", f"{(forecast - revised):+,.0f}")
    d3.metric("対象件数", f"{len(df):,}")

    left, right = st.columns(2)
    if dim["month"]:
        by_month = df.groupby(dim["month"], as_index=False)[[amount["revised"], amount["forecast"], amount["actual"]]].sum()
        by_month = by_month.sort_values(dim["month"])
        fig = px.line(
            by_month,
            x=dim["month"],
            y=[amount["revised"], amount["forecast"], amount["actual"]],
            markers=True,
            title="月別推移（修正計画 / 着地見込 / 実績）",
        )
        left.plotly_chart(fig, use_container_width=True)

        cum = by_month.copy()
        for c in [amount["revised"], amount["forecast"], amount["actual"]]:
            cum[c] = cum[c].cumsum()
        fig_cum = px.line(
            cum,
            x=dim["month"],
            y=[amount["revised"], amount["forecast"], amount["actual"]],
            markers=True,
            title="累積推移",
        )
        right.plotly_chart(fig_cum, use_container_width=True)
    else:
        st.info("月列がないため、月別推移は表示できません。")

    b1, b2 = st.columns(2)
    if dim["category"]:
        by_cat = df.groupby(dim["category"], as_index=False)[amount["actual"]].sum()
        b1.plotly_chart(px.pie(by_cat, names=dim["category"], values=amount["actual"], title="カテゴリ構成（実績）"), use_container_width=True)

    if dim["domain"]:
        by_domain = df.groupby(dim["domain"], as_index=False)[amount["actual"]].sum().sort_values(amount["actual"], ascending=False)
        b2.plotly_chart(px.bar(by_domain, x=dim["domain"], y=amount["actual"], title="ドメイン別実績"), use_container_width=True)

    if dim["system"]:
        sys_sum = df.groupby(dim["system"], as_index=False)[[amount["revised"], amount["forecast"], amount["actual"]].copy()].sum()
        sys_sum["usage_rate"] = sys_sum[amount["actual"]] / sys_sum[amount["revised"]].replace(0, pd.NA) * 100
        sys_sum["variance_rate"] = (sys_sum[amount["forecast"]] - sys_sum[amount["revised"]]) / sys_sum[amount["revised"]].replace(0, pd.NA) * 100
        alerts = sys_sum[(sys_sum["usage_rate"].fillna(0) >= 80) | (sys_sum["variance_rate"].fillna(0) >= 5)]
        st.markdown("#### 超過アラート")
        st.dataframe(alerts.sort_values(["variance_rate", "usage_rate"], ascending=False), use_container_width=True, hide_index=True)

        st.markdown("#### システム別サマリ")
        st.dataframe(sys_sum.sort_values(amount["actual"], ascending=False), use_container_width=True, hide_index=True)


def render_budget_input(df: pd.DataFrame, amount: dict[str, str], dim: dict[str, Optional[str]]) -> None:
    st.subheader("予算データ入力（マトリクス表示）")
    if not (dim["system"] and dim["item"] and dim["month"]):
        st.info("system/item/month 列が必要です。")
        return

    amount_type = st.selectbox("表示金額", ["initial", "revised", "forecast", "actual"], format_func=lambda x: {
        "initial": "当初計画", "revised": "修正計画", "forecast": "着地見込", "actual": "実績"
    }[x])

    piv = pd.pivot_table(
        df,
        index=[dim["system"], dim["item"]],
        columns=dim["month"],
        values=amount[amount_type],
        aggfunc="sum",
        fill_value=0,
    ).reset_index()

    st.data_editor(piv, use_container_width=True, disabled=True, hide_index=True)


def render_variance(df: pd.DataFrame, amount: dict[str, str], dim: dict[str, Optional[str]]) -> None:
    st.subheader("予実差異分析")
    group_label = {
        "system": dim["system"],
        "category": dim["category"],
        "item": dim["item"],
        "domain": dim["domain"],
    }
    available = [k for k, v in group_label.items() if v]
    if not available:
        st.info("分析に必要な分類列がありません。")
        return

    g = st.selectbox("集計軸", available, format_func=lambda x: {
        "system": "システム", "category": "カテゴリ", "item": "費目", "domain": "ドメイン"
    }[x])

    summary = df.groupby(group_label[g], as_index=False)[[amount["initial"], amount["revised"], amount["forecast"], amount["actual"]].copy()].sum()
    summary["planVsActual"] = summary[amount["revised"]] - summary[amount["actual"]]
    summary["forecastVsActual"] = summary[amount["forecast"]] - summary[amount["actual"]]
    summary["forecastVsPlan"] = summary[amount["forecast"]] - summary[amount["revised"]]
    summary["consumptionRate"] = summary[amount["actual"]] / summary[amount["revised"]].replace(0, pd.NA) * 100

    st.dataframe(summary.sort_values("planVsActual"), use_container_width=True, hide_index=True)

    if dim["month"]:
        mode = st.radio("期間集計", ["四半期", "半期"], horizontal=True)
        per = df.copy()
        per["period"] = per[dim["month"]].astype(int).apply(lambda m: period_label(m, mode))
        p = per.groupby("period", as_index=False)[[amount["revised"], amount["forecast"], amount["actual"]]].sum()
        st.plotly_chart(px.bar(p, x="period", y=[amount["revised"], amount["forecast"], amount["actual"]], barmode="group", title=f"{mode}集計"), use_container_width=True)


def render_multi_year(df_all: pd.DataFrame, amount: dict[str, str], dim: dict[str, Optional[str]]) -> None:
    st.subheader("中期比較")
    if not dim["fiscal_year"]:
        st.info("年度列がないため中期比較は表示できません。")
        return

    year_sum = df_all.groupby(dim["fiscal_year"], as_index=False)[[amount["initial"], amount["revised"], amount["forecast"], amount["actual"]]].sum()
    year_sum = year_sum.sort_values(dim["fiscal_year"])
    st.plotly_chart(px.line(year_sum, x=dim["fiscal_year"], y=[amount["revised"], amount["forecast"], amount["actual"]], markers=True, title="年度横断推移"), use_container_width=True)
    st.dataframe(year_sum, use_container_width=True, hide_index=True)


def render_reports(df: pd.DataFrame, amount: dict[str, str], dim: dict[str, Optional[str]]) -> None:
    st.subheader("レポート")
    tabs = st.tabs(["ドメイン別", "システム別", "カテゴリ別", "エクスポート"])

    with tabs[0]:
        if dim["domain"]:
            x = df.groupby(dim["domain"], as_index=False)[[amount["initial"], amount["revised"], amount["forecast"], amount["actual"]]].sum()
            st.dataframe(x, use_container_width=True, hide_index=True)
        else:
            st.info("ドメイン列がありません。")

    with tabs[1]:
        if dim["system"]:
            x = df.groupby(dim["system"], as_index=False)[[amount["initial"], amount["revised"], amount["forecast"], amount["actual"]]].sum()
            x["variance_rate"] = (x[amount["forecast"]] - x[amount["revised"]]) / x[amount["revised"]].replace(0, pd.NA) * 100
            st.dataframe(x, use_container_width=True, hide_index=True)
        else:
            st.info("システム列がありません。")

    with tabs[2]:
        if dim["category"]:
            x = df.groupby(dim["category"], as_index=False)[[amount["initial"], amount["revised"], amount["forecast"], amount["actual"]]].sum()
            st.dataframe(x, use_container_width=True, hide_index=True)
        else:
            st.info("カテゴリ列がありません。")

    with tabs[3]:
        st.download_button("現在フィルタデータをCSV出力", data=df.to_csv(index=False).encode("utf-8-sig"), file_name="export_data.csv", mime="text/csv")


def render_master(master_df: pd.DataFrame, dim: dict[str, Optional[str]]) -> None:
    st.subheader("マスタ管理（参照）")
    st.dataframe(master_df, use_container_width=True, hide_index=True)

    c1, c2, c3 = st.columns(3)
    if dim["system"]:
        c1.metric("システム数", f"{master_df[dim['system']].nunique():,}")
    if dim["category"]:
        c2.metric("カテゴリ数", f"{master_df[dim['category']].nunique():,}")
    if dim["item"]:
        c3.metric("費目数", f"{master_df[dim['item']].nunique():,}")


def render_comments(dim: dict[str, Optional[str]], df: pd.DataFrame) -> None:
    st.subheader("差異コメント")
    if "comments_df" not in st.session_state:
        st.session_state.comments_df = pd.DataFrame(columns=["日時", "期間", "コメント種別", "システム", "内容"])

    with st.form("comment_form"):
        period = st.selectbox("期間", ["年間", "半期", "四半期", "月次"])
        ctype = st.selectbox("コメント種別", ["差異説明", "備考", "アクション", "リスク"])
        system = "全体"
        if dim["system"]:
            vals = sorted(df[dim["system"]].dropna().astype(str).unique().tolist())
            system = st.selectbox("システム", ["全体"] + vals)
        content = st.text_area("内容")
        submitted = st.form_submit_button("コメント追加")

        if submitted and content.strip():
            st.session_state.comments_df.loc[len(st.session_state.comments_df)] = [
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                period,
                ctype,
                system,
                content,
            ]
            st.success("コメントを追加しました。")

    st.dataframe(st.session_state.comments_df, use_container_width=True, hide_index=True)


def main() -> None:
    st.title("システム企画 予算管理ダッシュボード（ローカル完全版）")
    st.caption("移植元ダッシュボードの主要画面構成を、CSVベースでローカル再現しています。")

    with st.sidebar:
        st.header("CSVアップロード")
        master_file = st.file_uploader("budget_master.csv", type=["csv"], key="master")
        detail_file = st.file_uploader("budget_detail.csv", type=["csv"], key="detail")

    if not master_file or not detail_file:
        st.info("`budget_master.csv` と `budget_detail.csv` をアップロードしてください。")
        return

    master_df = read_csv_with_fallback(master_file)
    detail_df = read_csv_with_fallback(detail_file)
    merged_all = merge_master_detail(master_df, detail_df)

    dim = {
        "fiscal_year": col(merged_all, ["fiscal_year", "fy", "year"]),
        "month": col(merged_all, ["month", "period_month"]),
        "domain": col(merged_all, ["domain_name", "system_domain", "domain"]),
        "system": col(merged_all, ["system_name", "system", "system_id"]),
        "category": col(merged_all, ["expense_category_name", "category", "expense_category"]),
        "item": col(merged_all, ["expense_item_name", "item_name", "item", "expense_item_id", "item_id"]),
    }

    amount = pick_amount_cols(merged_all)
    merged_all = ensure_numeric(merged_all, amount)

    filtered = merged_all.copy()
    with st.sidebar:
        st.header("フィルタ")
        if dim["fiscal_year"]:
            ys = sorted(filtered[dim["fiscal_year"]].dropna().unique().tolist())
            yv = st.multiselect("年度", ys, default=ys)
            if yv:
                filtered = filtered[filtered[dim["fiscal_year"]].isin(yv)]
        if dim["system"]:
            ss = sorted(filtered[dim["system"]].dropna().astype(str).unique().tolist())
            sv = st.multiselect("システム", ss, default=ss)
            if sv:
                filtered = filtered[filtered[dim["system"]].astype(str).isin(sv)]
        if dim["category"]:
            cs = sorted(filtered[dim["category"]].dropna().astype(str).unique().tolist())
            cv = st.multiselect("カテゴリ", cs, default=cs)
            if cv:
                filtered = filtered[filtered[dim["category"]].astype(str).isin(cv)]

    pages = st.tabs([
        "ダッシュボード",
        "予算データ入力",
        "予実差異分析",
        "中期比較",
        "レポート",
        "マスタ管理",
        "差異コメント",
    ])

    with pages[0]:
        render_dashboard(filtered, amount, dim)
    with pages[1]:
        render_budget_input(filtered, amount, dim)
    with pages[2]:
        render_variance(filtered, amount, dim)
    with pages[3]:
        render_multi_year(merged_all, amount, dim)
    with pages[4]:
        render_reports(filtered, amount, dim)
    with pages[5]:
        render_master(master_df, dim)
    with pages[6]:
        render_comments(dim, filtered)


if __name__ == "__main__":
    main()
