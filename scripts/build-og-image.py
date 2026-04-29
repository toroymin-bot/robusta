#!/usr/bin/env python3
"""
D-D16-1 (Day 4 23시 슬롯, 2026-04-29) C-D16-1 / D-D16-1: og.png 실 디자인 생성.

명세 (Confluence Task_2026-04-29 §24.7 D-D16-1):
  - 1200×630 PNG, 배경 #FFFCEB
  - 좌상단 wordmark "Robusta" 64px 검정
  - 중앙 3 노드 좌→우: Roy(인간) → Tori(채팅 버블) → Komi(터미널)
  - 노드 사이 점선 양방향 화살표
  - 하단 카피 "Human + Web AI + Code AI — three-way collaboration" 28px

회귀 위험 0 — 빌드 시점 정적 PNG 생성, 런타임 의존 0.
실행: python3 scripts/build-og-image.py
산출: public/og.png (1200×630)
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "og.png"

WIDTH = 1200
HEIGHT = 630
BG = "#FFFCEB"
INK = "#1A1A1A"
INK_DIM = "#666666"
ACCENT_ROY = "#F5C518"      # 노랑 (참여자 1)
ACCENT_TORI = "#3B82F6"     # 파랑 (Web AI)
ACCENT_KOMI = "#10B981"     # 녹색 (Code AI)


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    """시스템 폰트 fallback chain. macOS 우선, 없으면 PIL default."""
    candidates_bold = [
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/HelveticaNeue.ttc",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    ]
    candidates_regular = [
        "/System/Library/Fonts/HelveticaNeue.ttc",
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
    ]
    for path in candidates_bold if bold else candidates_regular:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def draw_node(
    draw: ImageDraw.ImageDraw,
    cx: int,
    cy: int,
    radius: int,
    fill: str,
    label: str,
    sublabel: str,
    label_font: ImageFont.FreeTypeFont,
    sub_font: ImageFont.FreeTypeFont,
    monogram: str,
    monogram_font: ImageFont.FreeTypeFont,
) -> None:
    # 노드 원
    draw.ellipse(
        (cx - radius, cy - radius, cx + radius, cy + radius),
        fill=fill,
        outline=INK,
        width=3,
    )
    # 모노그램
    bbox = draw.textbbox((0, 0), monogram, font=monogram_font)
    mw = bbox[2] - bbox[0]
    mh = bbox[3] - bbox[1]
    draw.text(
        (cx - mw // 2 - bbox[0], cy - mh // 2 - bbox[1]),
        monogram,
        fill="#FFFFFF",
        font=monogram_font,
    )
    # 라벨
    bbox = draw.textbbox((0, 0), label, font=label_font)
    lw = bbox[2] - bbox[0]
    draw.text(
        (cx - lw // 2 - bbox[0], cy + radius + 18 - bbox[1]),
        label,
        fill=INK,
        font=label_font,
    )
    # 서브라벨
    bbox = draw.textbbox((0, 0), sublabel, font=sub_font)
    sw = bbox[2] - bbox[0]
    draw.text(
        (cx - sw // 2 - bbox[0], cy + radius + 56 - bbox[1]),
        sublabel,
        fill=INK_DIM,
        font=sub_font,
    )


def draw_dotted_arrow(
    draw: ImageDraw.ImageDraw,
    x1: int,
    y: int,
    x2: int,
    color: str = INK_DIM,
) -> None:
    # 점선 (작은 segment 반복)
    seg = 8
    gap = 8
    x = x1
    while x < x2:
        end = min(x + seg, x2)
        draw.line((x, y, end, y), fill=color, width=3)
        x = end + gap
    # 양방향 화살촉
    head = 10
    # 오른쪽 ▶
    draw.polygon(
        [(x2, y), (x2 - head, y - head // 2), (x2 - head, y + head // 2)],
        fill=color,
    )
    # 왼쪽 ◀
    draw.polygon(
        [(x1, y), (x1 + head, y - head // 2), (x1 + head, y + head // 2)],
        fill=color,
    )


def main() -> None:
    img = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(img)

    wordmark_font = load_font(64, bold=True)
    tagline_font = load_font(22, bold=False)
    node_label_font = load_font(28, bold=True)
    node_sub_font = load_font(18, bold=False)
    monogram_font = load_font(56, bold=True)
    bottom_font = load_font(28, bold=False)

    # 좌상단 wordmark "Robusta"
    draw.text((64, 56), "Robusta", fill=INK, font=wordmark_font)
    draw.text(
        (64, 132),
        "Human + Web AI + Code AI",
        fill=INK_DIM,
        font=tagline_font,
    )

    # 중앙 3 노드 (cy = 320, radius = 70)
    radius = 70
    cy = 330
    nodes = [
        (240, ACCENT_ROY, "Roy", "Human", "R"),
        (600, ACCENT_TORI, "Tori", "Web AI · Director", "T"),
        (960, ACCENT_KOMI, "Komi", "Code AI · Engineer", "K"),
    ]
    for cx, color, label, sub, mono in nodes:
        draw_node(
            draw,
            cx,
            cy,
            radius,
            color,
            label,
            sub,
            node_label_font,
            node_sub_font,
            mono,
            monogram_font,
        )

    # 노드 사이 점선 양방향 화살표
    draw_dotted_arrow(draw, 240 + radius + 16, cy, 600 - radius - 16, INK_DIM)
    draw_dotted_arrow(draw, 600 + radius + 16, cy, 960 - radius - 16, INK_DIM)

    # 하단 카피
    bottom_text = "Three-way collaboration — AI talks to AI even when you're not here."
    bbox = draw.textbbox((0, 0), bottom_text, font=bottom_font)
    bw = bbox[2] - bbox[0]
    draw.text(
        (WIDTH // 2 - bw // 2 - bbox[0], HEIGHT - 80 - bbox[1]),
        bottom_text,
        fill=INK,
        font=bottom_font,
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, "PNG", optimize=True)
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
