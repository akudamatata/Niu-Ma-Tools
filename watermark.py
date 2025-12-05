from __future__ import annotations

import argparse
from datetime import datetime
from math import ceil
from pathlib import Path
from typing import Iterable, List, Tuple

from PIL import Image, ImageDraw, ImageFont

ASSETS_DIR = Path(__file__).resolve().parent / "assets" / "watermark"
FONT_PATH = Path(__file__).resolve().parent / "assets" / "fonts" / "汉仪旗黑X2-65W.ttf"
FALLBACK_FONT_PATH = Path(__file__).resolve().parent / "assets" / "fonts" / "NotoSansSC-Regular.otf"


def color_with_alpha(hex_color: str, alpha: float) -> Tuple[int, int, int, int]:
    hex_color = hex_color.lstrip("#")
    r = int(hex_color[0:2], 16)
    g = int(hex_color[2:4], 16)
    b = int(hex_color[4:6], 16)
    return (r, g, b, int(255 * alpha))


BLUE = color_with_alpha("2F63FF", 0.92)
YELLOW = color_with_alpha("FFC83A", 1.0)
RED = color_with_alpha("F2493A", 1.0)
WHITE_PRIMARY = color_with_alpha("FFFFFF", 0.90)
WHITE_SECONDARY = color_with_alpha("FFFFFF", 0.75)
WHITE_DECORATIVE = color_with_alpha("FFFFFF", 0.45)

_failed_font_names: set[str] = set()


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for candidate in (FONT_PATH, FALLBACK_FONT_PATH):
        try:
            return ImageFont.truetype(str(candidate), size)
        except OSError as exc:
            if candidate.name not in _failed_font_names:
                _failed_font_names.add(candidate.name)
                print(f"警告：无法加载字体 \"{candidate.name}\" ({exc})，将尝试备用字体。")

    if "PIL-DEFAULT" not in _failed_font_names:
        _failed_font_names.add("PIL-DEFAULT")
        print("警告：无法加载自定义字体，改用 Pillow 默认字体，可能无法显示中文。")

    return ImageFont.load_default()


def get_current_info() -> dict[str, str]:
    now = datetime.now()
    return {
        "time": now.strftime("%H:%M"),
        "date": now.strftime("%Y年%m月%d日"),
    }


def text_size(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont) -> Tuple[int, int, int, int]:
    return draw.textbbox((0, 0), text, font=font)


def draw_vertical_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.ImageFont,
    center: Tuple[float, float],
    fill: Tuple[int, int, int, int],
    letter_spacing: float,
) -> None:
    if not text:
        return

    widths_heights: List[Tuple[int, int]] = []
    total_height = 0.0
    for ch in text:
        bbox = text_size(draw, ch, font)
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        widths_heights.append((w, h))
        total_height += h
    total_height += letter_spacing * (len(text) - 1)

    start_y = center[1] - total_height / 2
    x_center = center[0]
    y_cursor = start_y
    for idx, ch in enumerate(text):
        bbox = text_size(draw, ch, font)
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        x = x_center - w / 2 - bbox[0]
        y = y_cursor - bbox[1]
        draw.text((x, y), ch, font=font, fill=fill)
        y_cursor += h + (letter_spacing if idx < len(text) - 1 else 0)


def draw_spaced_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    position: Tuple[float, float],
    font: ImageFont.ImageFont,
    fill: Tuple[int, int, int, int],
    letter_spacing: float = 0.0,
) -> Tuple[float, float]:
    x, y = position
    for idx, ch in enumerate(text):
        bbox = text_size(draw, ch, font)
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        draw.text((x - bbox[0], y - bbox[1]), ch, font=font, fill=fill)
        x += w + (letter_spacing if idx < len(text) - 1 else 0)
    return x, y


def wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> List[str]:
    if not text:
        return []

    lines: List[str] = []
    current = ""

    for char in text:
        if char == "\n":
            if current:
                lines.append(current)
            current = ""
            continue

        tentative = current + char
        if draw.textlength(tentative, font=font) <= max_width:
            current = tentative
        else:
            if current:
                lines.append(current)
            current = char

    if current:
        lines.append(current)

    return lines


def generate_watermark(
    image_path: str,
    output_path: str,
    location: str,
    temperature: str,  # kept for API compatibility; not rendered in the new layout
    weather: str,  # kept for API compatibility; not rendered in the new layout
    *,
    date_text: str = "",
    time_text: str = "",
    weekday_text: str = "",  # kept for compatibility; not rendered
    header_left_text: str = "执勤巡逻",
    header_right_text: str = "工作记录",
) -> None:
    if not Path(image_path).exists():
        raise FileNotFoundError(f"输入图片不存在：{image_path}")

    base_image = Image.open(image_path).convert("RGBA")
    width, height = base_image.size
    info = get_current_info()

    W = width
    H = height
    margin = round(0.022 * W)

    card_w = round(0.60 * W)
    card_h = round(0.20 * W)
    card_w = min(card_w, W - margin * 2)
    card_h = min(card_h, H - margin * 3)

    corner_radius = round(0.09 * card_h)
    padding_x = round(0.12 * card_h)
    padding_y = round(0.16 * card_h)

    card_left = margin
    card_bottom = margin * 2
    card_top = max(H - card_bottom - card_h, margin)
    card_right = card_left + card_w

    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    # Card background
    draw.rounded_rectangle(
        (card_left, card_top, card_right, card_top + card_h),
        radius=corner_radius,
        fill=BLUE,
    )

    # Vertical ribbon with notch
    ribbon_w = round(0.17 * card_h)
    notch_depth = round(0.22 * ribbon_w)
    notch_height = round(0.36 * card_h)
    notch_top = card_top + (card_h - notch_height) / 2
    ribbon_points = [
        (card_left, card_top),
        (card_left + ribbon_w, card_top),
        (card_left + ribbon_w, notch_top),
        (card_left + ribbon_w - notch_depth, notch_top + notch_height / 2),
        (card_left + ribbon_w, notch_top + notch_height),
        (card_left + ribbon_w, card_top + card_h),
        (card_left, card_top + card_h),
    ]
    draw.polygon(ribbon_points, fill=YELLOW)

    vertical_text = header_left_text.strip() or "执勤巡逻"
    vertical_font = load_font(round(0.24 * card_h))
    draw_vertical_text(
        draw,
        vertical_text,
        vertical_font,
        (card_left + ribbon_w / 2, card_top + card_h / 2),
        fill=color_with_alpha("000000", 0.9),
        letter_spacing=vertical_font.size * 0.02,
    )

    inner_left = card_left + ribbon_w + padding_x
    inner_right = card_right - padding_x
    text_y = card_top + padding_y

    # Top row
    title_font = load_font(round(0.18 * card_h))
    divider_font = load_font(round(0.15 * card_h))
    title = header_right_text.strip() or "工作记录"
    title_bbox = text_size(draw, title, title_font)
    title_h = title_bbox[3] - title_bbox[1]
    draw.text((inner_left - title_bbox[0], text_y - title_bbox[1]), title, font=title_font, fill=WHITE_PRIMARY)

    divider_text = ">>>>>>>>"
    divider_width = draw.textlength(divider_text, font=divider_font)
    divider_spacing = divider_font.size * 0.08
    divider_x = inner_right - divider_width - divider_spacing * (len(divider_text) - 1)
    draw_spaced_text(
        draw,
        divider_text,
        (divider_x, text_y),
        divider_font,
        fill=WHITE_DECORATIVE,
        letter_spacing=divider_spacing,
    )

    # Time and date
    time_value = time_text.strip() or info["time"]
    date_value = date_text.strip() or info["date"]

    time_font = load_font(round(0.46 * card_h))
    date_font = load_font(round(0.20 * card_h))

    time_top = text_y + title_h + ceil(padding_y * 0.4)
    time_bbox = text_size(draw, time_value, time_font)
    time_h = time_bbox[3] - time_bbox[1]
    time_y = time_top - time_bbox[1]
    draw.text((inner_left - time_bbox[0], time_y), time_value, font=time_font, fill=WHITE_PRIMARY)

    date_bbox = text_size(draw, date_value, date_font)
    date_h = date_bbox[3] - date_bbox[1]
    date_y = time_top + time_h - date_h - date_bbox[1]
    draw.text((inner_left - date_bbox[0], date_y), date_value, font=date_font, fill=WHITE_SECONDARY)

    # Location row (outside card)
    loc_margin_top = round(0.5 * padding_y)
    location_y = card_top + card_h + loc_margin_top
    marker_size = round(0.07 * card_h)
    marker_x = card_left
    draw.rectangle(
        (
            marker_x,
            location_y,
            marker_x + marker_size,
            location_y + marker_size,
        ),
        fill=RED,
    )

    loc_font = load_font(round(0.18 * card_h))
    location_text = (location or "未知地点").strip()
    max_loc_width = card_w
    lines = wrap_text(draw, location_text, loc_font, max_loc_width)
    if not lines:
        lines = [location_text]

    line_spacing = max(int(loc_font.size * 0.15), 2)
    text_x = inner_left
    current_y = location_y
    for idx, line in enumerate(lines):
        bbox = text_size(draw, line, loc_font)
        draw.text((text_x - bbox[0], current_y - bbox[1]), line, font=loc_font, fill=color_with_alpha("FFFFFF", 0.96))
        current_y += (bbox[3] - bbox[1]) + (line_spacing if idx < len(lines) - 1 else 0)

    # Brand group
    brand_w = round(0.165 * W)
    brand_margin = margin
    brand_font_l1 = load_font(round(0.045 * W))
    brand_font_l2 = load_font(round(0.045 * W * 0.65))
    brand_font_l3 = load_font(round(0.045 * W * 0.55))
    brand_lines = [
        ("Your Camera", brand_font_l1, WHITE_PRIMARY),
        ("Traceable & Trusted", brand_font_l2, WHITE_PRIMARY),
        ("Anti-fake: P9XXXX", brand_font_l3, color_with_alpha("FFFFFF", 0.75)),
    ]

    line_heights = [text_size(draw, txt, font)[3] - text_size(draw, txt, font)[1] for txt, font, _ in brand_lines]
    line_spacing_brand = int((sum(line_heights) / len(line_heights)) * 0.07)
    total_brand_height = sum(line_heights) + line_spacing_brand * (len(brand_lines) - 1)
    brand_left = W - brand_margin - brand_w
    brand_top = H - brand_margin - total_brand_height

    current_y = brand_top
    for idx, (txt, font, fill) in enumerate(brand_lines):
        bbox = text_size(draw, txt, font)
        text_x_pos = brand_left - bbox[0]
        text_y_pos = current_y - bbox[1]
        draw.text((text_x_pos, text_y_pos), txt, font=font, fill=fill)
        current_y += (bbox[3] - bbox[1]) + (line_spacing_brand if idx < len(brand_lines) - 1 else 0)

    result = Image.alpha_composite(base_image, overlay)
    result.save(output_path)


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description='Generate "今日水印" style overlay on images.')
    parser.add_argument("--input", required=True, help="Path to the source image file.")
    parser.add_argument("--output", required=True, help="Path to save the watermarked image (PNG).")
    parser.add_argument("--location", default="", help="Location text to display.")
    parser.add_argument("--temperature", default="", help="Temperature text to display.")
    parser.add_argument("--weather", default="", help="Weather condition text to display.")
    parser.add_argument("--date", default="", help="Custom date text to display.")
    parser.add_argument("--time", default="", help="Custom time text to display.")
    parser.add_argument("--weekday", default="", help="Custom weekday text to display.")
    parser.add_argument(
        "--header-left",
        default="",
        help="左侧黄色竖条文字，如：执勤巡逻",
    )
    parser.add_argument(
        "--header-right",
        default="",
        help="卡片顶部标题，如：工作记录",
    )

    args = parser.parse_args(list(argv) if argv is not None else None)

    generate_watermark(
        args.input,
        args.output,
        args.location,
        args.temperature,
        args.weather,
        date_text=args.date,
        time_text=args.time,
        weekday_text=args.weekday,
        header_left_text=args.header_left,
        header_right_text=args.header_right,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
