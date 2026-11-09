"""Smoke-тест: відкриває гру в Chrome (headless), збирає помилки консолі, робить скріншоти.
Запуск: python -m http.server 8765 (у папці minipolia), потім python tools/smoke_test.py
"""
import sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765/"
OUT = sys.argv[2] if len(sys.argv) > 2 else "."

with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True,
                                args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    page = browser.new_page(viewport={"width": 1400, "height": 860})
    logs = []
    page.on("console", lambda m: logs.append(f"[{m.type}] {m.text}"))
    page.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
    page.goto(URL)
    page.wait_for_timeout(9000)
    print(*logs, sep="\n", flush=True)
    page.screenshot(path=f"{OUT}/shot_menu.png", timeout=90000)
    # Усі гравці — боти, щоб гра йшла сама
    page.evaluate("""() => { document.querySelectorAll('[data-bot]').forEach(s => s.value = '1'); }""")
    page.click("[data-start]")
    page.wait_for_timeout(25000)
    page.screenshot(path=f"{OUT}/shot_game.png", timeout=90000)
    page.evaluate("() => { window.minipolia.day.time = 0.9; }")
    page.wait_for_timeout(3000)
    page.screenshot(path=f"{OUT}/shot_night.png", timeout=90000)
    state = page.evaluate("() => JSON.stringify({turn: minipolia.game.state.turnNo, phase: minipolia.game.state.phase, players: minipolia.game.state.players.map(p => [p.name, p.money, p.position]), owners: Object.keys(minipolia.game.state.owners).length, fund: minipolia.game.state.fund})")
    print("STATE", state)
    for l in logs:
        print(l)
    browser.close()
