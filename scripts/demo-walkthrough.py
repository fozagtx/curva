#!/usr/bin/env python3
"""Capture a demo walkthrough of Curva on production."""

from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parents[1] / "docs" / "screenshots" / "demo"
BASE = "https://getcurva.vercel.app"
FIXTURE = "18257865"  # France vs England
REPLAY = "18241006"  # England vs Argentina (settled)


def shot(page, name: str, width: int = 390):
    page.set_viewport_size({"width": width, "height": 844 if width < 800 else 900})
    path = OUT / f"{name}.png"
    page.screenshot(path=str(path), full_page=True)
    print(f"wrote {path}")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # SSE streams never reach networkidle — use domcontentloaded + settle.
        page.goto(BASE, wait_until="domcontentloaded", timeout=60_000)
        page.wait_for_timeout(2500)
        shot(page, "01-lobby-mobile", 390)
        shot(page, "01-lobby-desktop", 1200)

        # hover expand on first match card if present
        card = page.locator("a[href^='/m/']").first
        if card.count():
            card.hover()
            page.wait_for_timeout(400)
            shot(page, "02-lobby-hover", 390)

        page.goto(f"{BASE}/m/{FIXTURE}", wait_until="domcontentloaded", timeout=60_000)
        page.wait_for_timeout(3500)
        shot(page, "03-france-england-mobile", 390)
        shot(page, "03-france-england-desktop", 1200)

        # scroll to Curva Calls
        calls = page.get_by_text("Curva Calls")
        if calls.count():
            calls.first.scroll_into_view_if_needed()
            page.wait_for_timeout(300)
            shot(page, "04-curva-calls", 390)

        page.goto(f"{BASE}/m/{REPLAY}", wait_until="domcontentloaded", timeout=60_000)
        page.wait_for_timeout(3000)
        # start replay if button present
        btn = page.get_by_role("button", name="Replay the drama")
        if btn.count():
            btn.first.click()
            page.wait_for_timeout(4000)
        shot(page, "05-replay-settled", 390)

        browser.close()
    print("demo walkthrough complete")


if __name__ == "__main__":
    main()
