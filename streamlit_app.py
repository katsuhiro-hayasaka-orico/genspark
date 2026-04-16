import io
from typing import Optional

import pandas as pd
import plotly.express as px
import streamlit as st

st.set_page_config(page_title="予算ダッシュボード（ローカル）", layout="wide")


def read_csv_with_fallback(uploaded_file) -> pd.DataFrame:
    raw = uploaded_file.getvalue()
    for enc in ("utf-8-sig", "cp932", "utf-8"):
        try:
            return pd.read_csv(io.BytesIO(raw), encoding=enc)
        except Exception:
            continue
    return pd.read_csv(io.BytesIO(raw))


def detect_amount_column(df: pd.DataFrame) -> Optional[str]:
    priority = [
        "actual_amount",
        "revised_plan_amount",
        "forecast_amount",
        "initial_plan_amount",
        "amount",
        "value",
    ]
    cols = {c.lower(): c for c in df.columns}
    for p in priority:
        if p in cols:
            return cols[p]

    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    if numeric_cols:
        return numeric_cols[-1]
    return None


def pick_first_existing(df: pd.DataFrame, candidates: list[str]) -> Optional[str]:
    cols = {c.lower(): c for c in df.columns}
    for c in candidates:
        if c in cols:
            return cols[c]
    return None


def merge_master_detail(master_df: pd.DataFrame, detail_df: pd.DataFrame) -> pd.DataFrame:
    merge_candidates = [
        "expense_item_id",
        "item_id",
        "budget_item_id",
        "id",
        "system_id",
    ]
    master_cols = {c.lower() for c in master_df.columns}
    detail_cols = {c.lower() for c in detail_df.columns}
    common = [c for c in merge_candidates if c in master_cols and c in detail_cols]

    if not common:
        return detail_df.copy()

    key = common[0]
    left_key = [c for c in detail_df.columns if c.lower() == key][0]
    right_key = [c for c in master_df.columns if c.lower() == key][0]

    return detail_df.merge(master_df, left_on=left_key, right_on=right_key, how="left", suffixes=("", "_master"))


def main() -> None:
    st.title("ローカル予算ダッシュボード")
    st.caption("Cloudflare 等の外部接続なしで、アップロードした CSV だけを可視化します。")

    with st.sidebar:
        st.header("CSV アップロード")
        master_file = st.file_uploader("budget_master.csv", type=["csv"], key="master")
        detail_file = st.file_uploader("budget_detail.csv", type=["csv"], key="detail")

    if not master_file or not detail_file:
        st.info("左のサイドバーから budget_master.csv / budget_detail.csv をアップロードしてください。")
        return

    master_df = read_csv_with_fallback(master_file)
    detail_df = read_csv_with_fallback(detail_file)
    merged_df = merge_master_detail(master_df, detail_df)

    amount_col = detect_amount_column(merged_df)
    if amount_col is None:
        st.error("金額列を判定できませんでした。数値列を含む CSV を指定してください。")
        return

    fy_col = pick_first_existing(merged_df, ["fiscal_year", "fy", "year"])
    month_col = pick_first_existing(merged_df, ["month", "period_month"])
    system_col = pick_first_existing(merged_df, ["system_name", "system", "system_id"])
    category_col = pick_first_existing(merged_df, ["expense_category_name", "category", "expense_category"])

    filtered = merged_df.copy()

    with st.sidebar:
        st.header("フィルタ")
        if fy_col:
            vals = sorted(filtered[fy_col].dropna().unique().tolist())
            fy = st.multiselect("年度", options=vals, default=vals)
            if fy:
                filtered = filtered[filtered[fy_col].isin(fy)]

        if system_col:
            vals = sorted(filtered[system_col].dropna().unique().tolist())
            systems = st.multiselect("システム", options=vals, default=vals)
            if systems:
                filtered = filtered[filtered[system_col].isin(systems)]

    total_amount = pd.to_numeric(filtered[amount_col], errors="coerce").fillna(0).sum()
    rows = len(filtered)

    c1, c2 = st.columns(2)
    c1.metric("合計金額（千円）", f"{total_amount:,.0f}")
    c2.metric("明細件数", f"{rows:,}")

    left, right = st.columns(2)

    if month_col:
        monthly = (
            filtered.assign(_amount=pd.to_numeric(filtered[amount_col], errors="coerce").fillna(0))
            .groupby(month_col, as_index=False)["_amount"]
            .sum()
            .sort_values(month_col)
        )
        fig_line = px.line(monthly, x=month_col, y="_amount", markers=True, title="月別推移")
        left.plotly_chart(fig_line, use_container_width=True)
    else:
        left.info("月次列がないため月別推移は表示できません。")

    if category_col:
        by_cat = (
            filtered.assign(_amount=pd.to_numeric(filtered[amount_col], errors="coerce").fillna(0))
            .groupby(category_col, as_index=False)["_amount"]
            .sum()
            .sort_values("_amount", ascending=False)
        )
        fig_pie = px.pie(by_cat, names=category_col, values="_amount", title="カテゴリ構成")
        right.plotly_chart(fig_pie, use_container_width=True)
    else:
        right.info("カテゴリ列がないためカテゴリ構成は表示できません。")

    st.subheader("詳細データ")
    st.dataframe(filtered, use_container_width=True, hide_index=True)

    st.download_button(
        "フィルタ後データをCSV保存",
        data=filtered.to_csv(index=False).encode("utf-8-sig"),
        file_name="filtered_budget_data.csv",
        mime="text/csv",
    )


if __name__ == "__main__":
    main()
