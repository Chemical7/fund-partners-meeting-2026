"""Headless smoke test: load the page, check no JS errors, screenshot key states."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import time

HERE = Path(__file__).parent
URL = "http://localhost:8765/index.html"
OUT = HERE / "_smoke_out"
OUT.mkdir(exist_ok=True)

errors = []

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1920, "height": 1080})
    page = ctx.new_page()

    def on_err(err):
        errors.append(f"PAGE ERROR: {err}")

    def on_msg(msg):
        if msg.type == "error":
            errors.append(f"CONSOLE: {msg.text}")

    page.on("pageerror", on_err)
    page.on("console", on_msg)

    page.goto(URL, wait_until="networkidle")
    time.sleep(1.5)

    # count slides & tiles
    n_slides = page.locator(".slide").count()
    n_tiles = page.locator(".tile").count()
    n_tabs = page.locator(".tab-btn").count()
    print(f"slides={n_slides} tiles={n_tiles} tabs={n_tabs}")

    # Uniqueness: hero set and tile set must not intersect; tile set has no dupes.
    # Heroes may repeat across beats of the same section (by design).
    result = page.evaluate("""() => {
      const heroes = new Set();
      document.querySelectorAll('.slide').forEach(s => {
        if (s.dataset.hero) heroes.add(s.dataset.hero);
      });
      const tiles = [];
      document.querySelectorAll('.tile').forEach(t => {
        const bg = t.style.backgroundImage.match(/url\\("([^"]+)"\\)/);
        if (bg) tiles.push(bg[1]);
      });
      const tileSet = new Set(tiles);
      const tileDupes = tiles.length !== tileSet.size;
      const intersection = [...heroes].filter(h => tileSet.has(h));
      return {
        heroCount: heroes.size,
        tileCount: tiles.length,
        tileUniqueCount: tileSet.size,
        tileDupes,
        intersection,
      };
    }""")
    print(f"heroes={result['heroCount']} tiles={result['tileCount']} (unique {result['tileUniqueCount']})")
    if result['tileDupes']:
        print(f"  DUP tiles within dock!")
    if result['intersection']:
        print(f"  hero/tile overlap: {result['intersection']}")
    # Note: heroes intentionally appear in the final collage now
    assert not result['tileDupes'], "duplicate tiles in dock"

    page.screenshot(path=str(OUT / "01-cover.png"), full_page=False)

    # scroll through each slide
    for i in range(n_slides):
        page.evaluate(f"document.querySelectorAll('.slide')[{i}].scrollIntoView({{behavior:'instant'}})")
        time.sleep(0.6)
    page.screenshot(path=str(OUT / "02-last.png"))

    # test tab switching (scroll back to top first so dock isn't fullscreen)
    if n_tabs >= 2:
        page.evaluate("document.getElementById('scroller').scrollTo({top:0})")
        time.sleep(0.8)
        page.locator(".tab-btn").nth(1).click()
        time.sleep(1.2)
        page.screenshot(path=str(OUT / "03-acg-cover.png"))
        page.evaluate("document.querySelectorAll('.slide')[3].scrollIntoView({behavior:'instant'})")
        time.sleep(0.8)
        page.screenshot(path=str(OUT / "03b-acg-mid.png"))

    # back to field, mid-scroll to show dock lit
    page.evaluate("document.getElementById('scroller').scrollTo({top:0})")
    time.sleep(0.8)
    page.locator(".tab-btn").nth(0).click()
    time.sleep(1.2)
    n_field = page.locator(".slide").count()
    print(f"field version slide count: {n_field}")
    # Nigeria narrative beat (should be slide 2 in field)
    page.evaluate("document.querySelectorAll('.slide')[2].scrollIntoView({behavior:'instant'})")
    time.sleep(0.8)
    page.screenshot(path=str(OUT / "05a-nigeria-beat1.png"))
    # Nigeria data beat (slide 3 — same hero, different text)
    page.evaluate("document.querySelectorAll('.slide')[3].scrollIntoView({behavior:'instant'})")
    time.sleep(0.8)
    page.screenshot(path=str(OUT / "05b-nigeria-beat2.png"))
    # final slide
    page.evaluate(f"document.querySelectorAll('.slide')[{n_field - 1}].scrollIntoView({{behavior:'instant'}})")
    time.sleep(1.5)
    page.screenshot(path=str(OUT / "06-field-final.png"))

    # NEW: scroll back up from final and verify dock un-fullscreens
    page.evaluate(f"document.querySelectorAll('.slide')[{n_field - 2}].scrollIntoView({{behavior:'instant'}})")
    time.sleep(1.2)
    is_fullscreen = page.evaluate("document.getElementById('dock').classList.contains('fullscreen')")
    print(f"after scroll-up from final: dock.fullscreen = {is_fullscreen}")
    page.screenshot(path=str(OUT / "07-scrolled-back-up.png"))

    # Wheel-scroll up from final to prove pointer-events: none lets events through
    page.evaluate(f"document.querySelectorAll('.slide')[{n_field - 1}].scrollIntoView({{behavior:'instant'}})")
    time.sleep(1.0)
    scroll_before = page.evaluate("document.getElementById('scroller').scrollTop")
    page.mouse.move(960, 540)
    page.mouse.wheel(0, -1200)
    time.sleep(1.2)
    scroll_after = page.evaluate("document.getElementById('scroller').scrollTop")
    is_fullscreen_after = page.evaluate("document.getElementById('dock').classList.contains('fullscreen')")
    print(f"wheel scroll: {scroll_before} -> {scroll_after}, fullscreen={is_fullscreen_after}")
    page.screenshot(path=str(OUT / "08-wheel-scroll-up.png"))

    browser.close()

print(f"\n{len(errors)} errors")
for e in errors:
    print(e)
