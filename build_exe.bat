@echo off
setlocal

if not exist .venv (
  python -m venv .venv
)

call .venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt

pyinstaller ^
  --noconfirm ^
  --clean ^
  --onefile ^
  --name BudgetDashboardLocal ^
  --collect-all streamlit ^
  --collect-all plotly ^
  --collect-submodules pandas ^
  --add-data "streamlit_app.py;." ^
  launcher.py

echo.
echo Build complete: dist\BudgetDashboardLocal.exe
endlocal
