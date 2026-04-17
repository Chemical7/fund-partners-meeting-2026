"""Quick two-shot: Journey cover + ACG cover"""
from playwright.sync_api import sync_playwright
from pathlib import Path
import time

OUT = Path(__file__).parent / "_smoke_out"
OUT.mkdir(exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1920, "height": 1080})
    page = ctx.new_page()
    page.goto("http://localhost:8765/index.html", wait_until="networkidle")
    time.sleep(1.5)
    page.screenshot(path=str(OUT / "fund-cover.png"))

    # Switch to ACG tab via JS directly
    page.evaluate("document.querySelectorAll('.tab-btn')[1].click()")
    time.sleep(1.5)
    page.screenshot(path=str(OUT / "acg-cover.png"))

    # Scroll past cover to see pinned ACG
    page.evaluate("document.querySelectorAll('.slide')[2].scrollIntoView({behavior:'instant'})")
    time.sleep(1.2)
    page.screenshot(path=str(OUT / "acg-inner.png"))

    browser.close()
print("done")
