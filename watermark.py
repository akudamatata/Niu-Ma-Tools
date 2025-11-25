from __future__ import annotations

import argparse
import random
import string
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List

from PIL import Image, ImageDraw, ImageFont

ASSETS_DIR = Path(__file__).resolve().parent / "assets" / "watermark"
SEPARATOR_PATH = ASSETS_DIR / "separator.png"
FONT_PATH = Path(__file__).resolve().parent / "assets" / "fonts" / "汉仪旗黑X2-65W.ttf"
FALLBACK_FONT_PATH = Path(__file__).resolve().parent / "assets" / "fonts" / "NotoSansSC-Regular.otf"

# Layout ratios
OVERLAY_HEIGHT_TARGET_RATIO = 0.18
OVERLAY_HEIGHT_MIN_RATIO = 0.16
OVERLAY_HEIGHT_MAX_RATIO = 0.22
BOTTOM_MARGIN_DEFAULT_RATIO = 0.02
BOTTOM_MARGIN_MIN_RATIO = 0.01
BOTTOM_MARGIN_MAX_RATIO = 0.03

LEFT_PANEL_WIDTH_IDEAL_RATIO = 0.36
LEFT_PANEL_WIDTH_MIN_RATIO = 0.33
LEFT_PANEL_WIDTH_MAX_RATIO = 0.40
LEFT_PANEL_BOTTOM_INSET_RATIO = 0.04
LEFT_PANEL_SIDE_PADDING_RATIO = 0.02

RIGHT_BLOCK_HEIGHT_TARGET_RATIO = 0.06
RIGHT_BLOCK_HEIGHT_MIN_RATIO = 0.05
RIGHT_BLOCK_HEIGHT_MAX_RATIO = 0.07
RIGHT_BLOCK_WIDTH_MIN_RATIO = 0.04
RIGHT_BLOCK_WIDTH_MAX_RATIO = 0.06
RIGHT_BLOCK_MARGIN_RATIO = 0.02
RIGHT_BLOCK_LINE_SPACING_RATIO = 0.18

COLOR_WHITE = (255, 255, 255, 255)
COLOR_DARK_GRAY_TEXT = (74, 74, 74, 255)  # #4A4A4A 深灰文字
COLOR_LIGHT_GRAY_BG = (198, 200, 204, 255)  # #C6C8CC 浅灰底
COLOR_PRIMARY = (255, 255, 255, 255)


_failed_font_names: set[str] = set()
_separator_image: Image.Image | None = None


def clamp(value: int, min_value: int, max_value: int) -> int:
    return max(min_value, min(max_value, value))


def get_current_info() -> Dict[str, str]:
    now = datetime.now()
    weekdays = ["一", "二", "三", "四", "五", "六", "日"]
    weekday = weekdays[now.weekday() % 7]
    return {
        "date": now.strftime("%Y年%m月%d日"),
        "time": now.strftime("%H:%M"),
        "weekday": weekday,
    }


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for candidate in (FONT_PATH, FALLBACK_FONT_PATH):
        try:
            return ImageFont.truetype(str(candidate), size)
        except OSError as exc:  # pragma: no cover - fallback path
            if candidate.name not in _failed_font_names:
                sys.stderr.write(
                    f"警告：无法加载字体 \"{candidate.name}\" ({exc}). 将尝试其他字体。\n"
                )
                _failed_font_names.add(candidate.name)

    if "PIL-DEFAULT" not in _failed_font_names:
        sys.stderr.write("警告：无法加载自定义字体，改用 Pillow 默认字体，可能无法显示中文。\n")
        _failed_font_names.add("PIL-DEFAULT")

    return ImageFont.load_default()


def load_separator() -> Image.Image | None:
    global _separator_image

    if _separator_image is not None:
        return _separator_image

    if not SEPARATOR_PATH.exists():
        return None

    try:
        _separator_image = Image.open(SEPARATOR_PATH).convert("RGBA")
    except OSError:
        _separator_image = None

    return _separator_image


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


def fit_font_size(
    draw: ImageDraw.ImageDraw,
    text: str,
    max_width: int,
    max_height: int,
    *,
    initial_size: int,
    min_size: int = 8,
) -> ImageFont.ImageFont:
    size = initial_size
    while size >= min_size:
        font = load_font(size)
        bbox = draw.textbbox((0, 0), text, font=font)
        width = bbox[2] - bbox[0]
        height = bbox[3] - bbox[1]
        if width <= max_width and height <= max_height:
            return font
        size -= 1
    return load_font(min_size)


def draw_left_panel(
    draw: ImageDraw.ImageDraw,
    overlay_image: Image.Image,
    box: tuple[int, int, int, int],
    time_text: str,
    date_text: str,
    location_text: str,
    *,
    category_text: str = "执勤巡逻",
    group_text: str = "松州大队",
) -> None:
    left, top, right, bottom = box
    panel_width = right - left
    panel_height = bottom - top

    BLUE_BG = (20, 80, 200, 190)
    YELLOW_LABEL = (253, 217, 46, 255)
    WHITE = (255, 255, 255, 255)
    RED_DOT = (220, 20, 40, 255)
    ARROW_COLOR = (255, 255, 255, 200)

    radius = max(int(min(panel_width, panel_height) * 0.08), 4)
    draw.rounded_rectangle(box, radius=radius, fill=BLUE_BG)

    padding_x = max(int(panel_width * 0.06), 10)
    padding_y = max(int(panel_height * 0.06), 8)
    inner_left = left + padding_x
    inner_right = right - padding_x

    header_h = max(int(panel_height * 0.26), 1)
    header_bottom = top + header_h

    category_width = max(int(panel_width * 0.38), 1)
    category_box = (left + padding_x, top + padding_y, left + padding_x + category_width, header_bottom)
    draw.rounded_rectangle(category_box, radius=max(int(header_h * 0.25), 2), fill=YELLOW_LABEL)

    header_font = fit_font_size(
        draw,
        group_text,
        category_width - padding_x,
        header_h - padding_y,
        initial_size=max(int(header_h * 0.55), 12),
        min_size=10,
    )
    cat_bbox = draw.textbbox((0, 0), group_text, font=header_font)
    cat_w = cat_bbox[2] - cat_bbox[0]
    cat_h = cat_bbox[3] - cat_bbox[1]
    cat_x = category_box[0] + (category_width - cat_w) / 2
    cat_y = top + (header_h - cat_h) / 2 - cat_bbox[1]
    draw.text((cat_x, cat_y), group_text, font=header_font, fill=COLOR_DARK_GRAY_TEXT)

    group_pad = max(int(panel_width * 0.03), 6)
    group_area_width = max(inner_right - category_box[2] - group_pad, 1)
    group_font = fit_font_size(
        draw,
        category_text,
        group_area_width,
        header_h - padding_y,
        initial_size=max(int(header_h * 0.42), 10),
        min_size=8,
    )
    group_bbox = draw.textbbox((0, 0), category_text, font=group_font)
    group_h = group_bbox[3] - group_bbox[1]
    group_x = category_box[2] + group_pad
    group_y = top + (header_h - group_h) / 2 - group_bbox[1]
    draw.text((group_x, group_y), category_text, font=group_font, fill=WHITE)

    line_y = header_bottom + max(int(panel_height * 0.01), 2)
    draw.line(
        (left + padding_x, line_y, right - padding_x, line_y),
        fill=YELLOW_LABEL,
        width=max(int(panel_height * 0.015), 2),
    )

    arrow_h = max(int(panel_height * 0.10), 4)
    arrow_top = line_y + max(int(panel_height * 0.02), 2)
    arrow_bottom = min(arrow_top + arrow_h, bottom)
    arrow_font = fit_font_size(
        draw,
        "≫ ≫ ≫",
        panel_width - padding_x * 2,
        arrow_h,
        initial_size=max(int(arrow_h * 0.6), 10),
        min_size=8,
    )
    arrow_unit_width = max(int(draw.textlength("≫ ", font=arrow_font)), 1)
    arrow_repeat = max(int(panel_width / arrow_unit_width) + 2, 2)
    arrow_text = "≫ " * arrow_repeat
    arrow_bbox = draw.textbbox((0, 0), arrow_text, font=arrow_font)
    arrow_height = arrow_bbox[3] - arrow_bbox[1]
    arrow_y = arrow_top + (arrow_h - arrow_height) / 2 - arrow_bbox[1]
    draw.text((left + group_pad, arrow_y), arrow_text, font=arrow_font, fill=ARROW_COLOR)

    remaining_height = panel_height - (arrow_bottom - top) - padding_y
    location_block_margin = max(int(panel_height * 0.05), 4)

    time_area_height = max(int(remaining_height * 0.48), 10)
    location_area_height = max(remaining_height - time_area_height - location_block_margin, 10)

    time_font = fit_font_size(
        draw,
        time_text,
        max(int(panel_width * 0.5), 1),
        time_area_height,
        initial_size=max(int(time_area_height * 0.8), 12),
        min_size=12,
    )
    date_font = fit_font_size(
        draw,
        date_text,
        panel_width - padding_x * 2,
        time_area_height,
        initial_size=max(int(time_area_height * 0.45), 10),
        min_size=10,
    )

    time_bbox = draw.textbbox((0, 0), time_text, font=time_font)
    time_w = time_bbox[2] - time_bbox[0]
    time_h = time_bbox[3] - time_bbox[1]
    time_x = left + padding_x
    time_y = arrow_bottom + padding_y + (time_area_height - time_h) / 2 - time_bbox[1]

    date_x_override = None
    date_y_override = None
    time_ratio = time_w / max(panel_width, 1)
    if time_ratio > 0.55:
        # If the time text is too wide (common on portrait images),
        # place the date below the time instead of on the same line.
        date_x_override = time_x
        date_y_override = time_y + time_h + max(int(time_area_height * 0.10), 4)
    draw.text((time_x, time_y), time_text, font=time_font, fill=WHITE)

    separator_img = load_separator()
    separator_width = 0
    separator_height = 0
    separator_gap = max(int(panel_width * 0.025), max(int(padding_x * 0.6), 6))
    separator_x = time_x + time_w + separator_gap
    separator_y = arrow_bottom + padding_y
    if separator_img is not None:
        desired_height = clamp(
            int(max(time_h, int(time_area_height * 0.58)) * 1.05),
            max(int(time_area_height * 0.45), 8),
            max(int(time_area_height * 0.9), 12),
        )
        aspect_ratio = separator_img.width / separator_img.height
        separator_width = max(int(desired_height * aspect_ratio), 2)
        separator_height = desired_height
        separator_y = arrow_bottom + padding_y + (time_area_height - separator_height) / 2
        separator_resized = separator_img.resize((separator_width, separator_height), Image.LANCZOS)
        overlay_image.paste(
            separator_resized,
            (int(separator_x), int(separator_y)),
            separator_resized,
        )

    date_bbox = draw.textbbox((0, 0), date_text, font=date_font)
    date_w = date_bbox[2] - date_bbox[0]
    date_h = date_bbox[3] - date_bbox[1]
    date_anchor = time_x + max(time_w + padding_x, int(panel_width * 0.45))
    if separator_width:
        date_anchor = max(date_anchor, separator_x + separator_width + separator_gap)
    date_x = min(right - padding_x - date_w, date_anchor)
    date_y = arrow_bottom + padding_y + (time_area_height - date_h) / 2 - date_bbox[1]
    if date_x_override is not None:
        date_x = date_x_override
    if date_y_override is not None:
        date_y = date_y_override
    draw.text((date_x, date_y), date_text, font=date_font, fill=WHITE)

    location_top = arrow_bottom + padding_y + time_area_height + location_block_margin
    location_text_clean = location_text.strip() or "未知地点"
    location_font = fit_font_size(
        draw,
        location_text_clean,
        panel_width - padding_x * 2,
        max(location_area_height, 1),
        initial_size=max(int(location_area_height * 0.5), 12),
        min_size=10,
    )

    location_lines = wrap_text(draw, location_text_clean, location_font, panel_width - padding_x * 2)
    if not location_lines:
        location_lines = [location_text_clean]

    location_spacing = max(int(location_font.size * 0.25), 4)
    total_loc_height = 0
    loc_metrics: List[tuple[int, int, int, int]] = []
    for line in location_lines:
        bbox = draw.textbbox((0, 0), line, font=location_font)
        height = bbox[3] - bbox[1]
        loc_metrics.append((bbox[0], bbox[1], bbox[2], bbox[3]))
        total_loc_height += height
    if len(location_lines) > 1:
        total_loc_height += location_spacing * (len(location_lines) - 1)

    dot_size = max(int(location_font.size * 0.7), 8)
    start_y = location_top + max((location_area_height - total_loc_height) / 2, 0)
    dot_x1 = left + padding_x
    dot_y1 = start_y + (loc_metrics[0][3] - loc_metrics[0][1] - dot_size) / 2
    dot_x2 = dot_x1 + dot_size
    dot_y2 = dot_y1 + dot_size
    draw.rectangle((dot_x1, dot_y1, dot_x2, dot_y2), fill=RED_DOT)

    text_x = dot_x2 + max(int(panel_width * 0.02), 6)
    current_y = start_y
    for idx, line in enumerate(location_lines):
        bbox = draw.textbbox((0, 0), line, font=location_font)
        draw.text((text_x, current_y - bbox[1]), line, font=location_font, fill=WHITE)
        current_y += (bbox[3] - bbox[1]) + (location_spacing if idx < len(location_lines) - 1 else 0)


def generate_security_code() -> str:
    length = random.randint(12, 16)
    charset = string.ascii_uppercase + string.digits
    return "".join(random.choices(charset, k=length))


def compute_right_block_layout(
    draw: ImageDraw.ImageDraw,
    width: int,
    image_height: int,
    overlay_height: int,
    security_code: str,
) -> Dict[str, object]:
    target_height = clamp(
        int(image_height * RIGHT_BLOCK_HEIGHT_TARGET_RATIO),
        int(image_height * RIGHT_BLOCK_HEIGHT_MIN_RATIO),
        int(image_height * RIGHT_BLOCK_HEIGHT_MAX_RATIO),
    )
    max_height = min(target_height, overlay_height)
    min_height = max(min(int(image_height * RIGHT_BLOCK_HEIGHT_MIN_RATIO), overlay_height), 1)
    min_width = max(int(width * RIGHT_BLOCK_WIDTH_MIN_RATIO), 1)
    max_width = max(int(width * RIGHT_BLOCK_WIDTH_MAX_RATIO), min_width + 1)
    line_spacing = max(int(target_height * RIGHT_BLOCK_LINE_SPACING_RATIO), 2)

    base_title_ratio = 0.42
    base_second_ratio = 0.32
    base_third_ratio = 0.26

    def measure(scale: float) -> Dict[str, object]:
        title_font = load_font(max(int(target_height * base_title_ratio * scale), 1))
        second_font = load_font(max(int(target_height * base_second_ratio * scale), 1))
        third_font = load_font(max(int(target_height * base_third_ratio * scale), 1))

        lines_raw = [
            ("今日水印", title_font, "title"),
            ("相机真实可验", second_font, "second"),
            (f"防伪 {security_code}", third_font, "third"),
        ]
        max_w = 0
        total_h = 0
        lines: List[Dict[str, object]] = []
        for text, font, role in lines_raw:
            bbox = draw.textbbox((0, 0), text, font=font)
            w = bbox[2] - bbox[0]
            h = bbox[3] - bbox[1]
            max_w = max(max_w, w)
            total_h += h
            lines.append(
                {
                    "text": text,
                    "font": font,
                    "width": w,
                    "height": h,
                    "offset": -bbox[1],
                    "role": role,
                }
            )
        if len(lines) > 1:
            total_h += line_spacing * (len(lines) - 1)
        return {"lines": lines, "width": max_w, "height": total_h}

    scale = 1.0
    layout = measure(scale)
    for _ in range(40):
        if layout["height"] > max_height or layout["width"] > max_width:
            scale *= 0.92
            layout = measure(scale)
            continue
        if layout["height"] < min_height and layout["width"] < max_width:
            scale *= 1.05
            layout = measure(scale)
            if layout["height"] > max_height or layout["width"] > max_width:
                scale /= 1.05
                layout = measure(scale)
                break
            continue
        if layout["width"] < min_width:
            scale *= 1.05
            layout = measure(scale)
            continue
        break

    margin = clamp(int(width * RIGHT_BLOCK_MARGIN_RATIO), 6, max(int(width * 0.05), 12))
    top = max(overlay_height - layout["height"] - margin, 0)
    right_edge = width - margin

    return {
        **layout,
        "line_spacing": line_spacing,
        "right_edge": right_edge,
        "top": top,
        "margin": margin,
    }


def compute_layout_sizes(
    width: int,
    height: int,
    *,
    security_code: str,
) -> Dict[str, object]:
    overlay_height = clamp(
        int(height * OVERLAY_HEIGHT_TARGET_RATIO),
        int(height * OVERLAY_HEIGHT_MIN_RATIO),
        int(height * OVERLAY_HEIGHT_MAX_RATIO),
    )
    bottom_padding = clamp(
        int(height * BOTTOM_MARGIN_DEFAULT_RATIO),
        int(height * BOTTOM_MARGIN_MIN_RATIO),
        int(height * BOTTOM_MARGIN_MAX_RATIO),
    )

    scratch = Image.new("RGBA", (width, overlay_height or 1), (0, 0, 0, 0))
    draw_measure = ImageDraw.Draw(scratch)

    right_block = compute_right_block_layout(
        draw_measure,
        width,
        height,
        overlay_height,
        security_code,
    )

    left_padding = max(int(width * LEFT_PANEL_SIDE_PADDING_RATIO), right_block["margin"])

    return {
        "content_height": overlay_height,
        "overlay_height": overlay_height,
        "bottom_padding": bottom_padding,
        "right_block": right_block,
        "left_padding": left_padding,
        "right_padding": right_block["margin"],
    }


def generate_watermark(
    image_path: str,
    output_path: str,
    location: str,
    temperature: str,
    weather: str,
    *,
    date_text: str = "",
    time_text: str = "",
    weekday_text: str = "",
) -> None:
    if not Path(image_path).exists():
        raise FileNotFoundError(f"输入图片不存在：{image_path}")

    info = get_current_info()
    base_image = Image.open(image_path).convert("RGB")
    width, height = base_image.size
    is_portrait = height > width

    time_text = time_text.strip() or info["time"]
    date_line = date_text.strip() or info["date"]
    temperature = temperature.strip()
    weather = weather.strip()
    weekday_label = weekday_text.strip() or f"星期{info['weekday']}"
    weekday_parts = [weekday_label]
    if weather:
        weekday_parts.append(weather)
    if temperature:
        weekday_parts.append(temperature)
    weekday_line = "  ".join(weekday_parts)

    security_code = generate_security_code()

    layout = compute_layout_sizes(width, height, security_code=security_code)

    right_block = layout["right_block"]
    padding_x = layout["left_padding"]
    right_padding = layout["right_padding"]
    overlay_height = layout["content_height"]

    gap_between_panels = max(int(width * 0.02), 16)

    # Use different width ratios for portrait vs. landscape
    if is_portrait:
        # For portrait images, make the left blue panel much wider,
        # so it visually looks like a horizontal strip near the bottom.
        portrait_ideal_ratio = 0.80
        portrait_min_ratio = 0.75
        portrait_max_ratio = 0.90

        target_panel_width = int(width * portrait_ideal_ratio)
        min_panel_width = int(width * portrait_min_ratio)
        max_panel_width = int(width * portrait_max_ratio)
    else:
        # Keep the original landscape behavior
        target_panel_width = int(width * LEFT_PANEL_WIDTH_IDEAL_RATIO)
        min_panel_width = int(width * LEFT_PANEL_WIDTH_MIN_RATIO)
        max_panel_width = int(width * LEFT_PANEL_WIDTH_MAX_RATIO)

    available_width = width - right_padding - right_block["width"] - gap_between_panels - padding_x
    panel_width = clamp(target_panel_width, min_panel_width, max_panel_width)
    panel_width = min(panel_width, available_width)
    if panel_width < min_panel_width:
        panel_width = max(min_panel_width, available_width)
    panel_width = max(panel_width, int(width * 0.25))

    panel_height = overlay_height - int(overlay_height * LEFT_PANEL_BOTTOM_INSET_RATIO)

    left_panel_box = (
        padding_x,
        0,
        padding_x + panel_width,
        panel_height,
    )

    overlay = Image.new("RGBA", (width, overlay_height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    draw_left_panel(
        draw=draw,
        overlay_image=overlay,
        box=left_panel_box,
        time_text=time_text,
        date_text=date_line,
        location_text=location,
        category_text=weekday_line,
        group_text="松州大队",
    )

    current_y = right_block["top"]
    right_align_edge = right_block.get("right_align_edge")
    pending_title: Dict[str, object] | None = None
    stroke_width = 1
    stroke_fill = (0, 0, 0, 64)
    primary_color = COLOR_PRIMARY
    for line in right_block["lines"]:
        text_x = right_block["right_edge"] - line["width"]
        text_y = current_y + line["offset"]
        font = line["font"]
        if line["text"] == "今日水印":
            pending_title = {
                "line": line,
                "text_y": text_y,
            }
        elif line["text"] == "相机真实可验":
            left_text = "相机"
            right_text = "真实可验"
            right_bbox = draw.textbbox((0, 0), right_text, font=font, stroke_width=0)
            rw = right_bbox[2] - right_bbox[0]
            rh = right_bbox[3] - right_bbox[1]

            pad_x = 8
            pad_y = 3
            radius = 6

            right_text_x = text_x + line["width"] - rw
            rect_x1 = right_text_x - pad_x
            rect_y1 = current_y - 1 - pad_y
            rect_x2 = rect_x1 + rw + pad_x * 2
            rect_y2 = rect_y1 + rh + pad_y * 2

            draw.rounded_rectangle(
                (rect_x1, rect_y1, rect_x2, rect_y2),
                radius=radius,
                fill=COLOR_LIGHT_GRAY_BG,
            )
            draw.text(
                (right_text_x, text_y),
                right_text,
                font=font,
                fill=COLOR_DARK_GRAY_TEXT,
                stroke_width=0,
            )
            left_bbox = draw.textbbox((0, 0), left_text, font=font, stroke_width=stroke_width)
            left_width = left_bbox[2] - left_bbox[0]
            left_gap = 4
            left_text_x = right_text_x - left_gap - left_width
            draw.text(
                (left_text_x, text_y),
                left_text,
                font=font,
                fill=COLOR_WHITE,
                stroke_width=stroke_width,
                stroke_fill=stroke_fill,
            )
            right_align_edge = rect_x2
            right_block["right_align_edge"] = rect_x2
        else:
            if line["text"].startswith("防伪"):
                align_edge = right_align_edge if right_align_edge is not None else right_block["right_edge"]
                text_x = align_edge - line["width"] + 12
            draw.text(
                (text_x, text_y),
                line["text"],
                font=font,
                fill=primary_color,
                stroke_width=stroke_width,
                stroke_fill=stroke_fill,
            )
        current_y += line["height"] + right_block["line_spacing"]

    if pending_title is not None:
        align_edge = right_block.get("right_align_edge", right_align_edge)
        if align_edge is None:
            align_edge = right_block["right_edge"]
        line = pending_title["line"]  # type: ignore[assignment]
        text_y = pending_title["text_y"]  # type: ignore[assignment]
        text_x = align_edge - line["width"]
        draw.text(
            (text_x, text_y),
            "今",
            font=line["font"],
            fill=primary_color,
            stroke_width=stroke_width,
            stroke_fill=stroke_fill,
        )
        jin_bbox = draw.textbbox(
            (text_x, text_y),
            "今",
            font=line["font"],
            stroke_width=stroke_width,
        )
        rest_x = jin_bbox[2]
        draw.text(
            (rest_x, text_y),
            "日水印",
            font=line["font"],
            fill=primary_color,
            stroke_width=stroke_width,
            stroke_fill=stroke_fill,
        )

    base_rgba = base_image.convert("RGBA")
    paste_y = height - layout["content_height"] - layout["bottom_padding"]
    base_rgba.paste(overlay, (0, paste_y), overlay)
    base_rgba.save(output_path)


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

    args = parser.parse_args(list(argv) if argv is not None else None)

    try:
        generate_watermark(
            args.input,
            args.output,
            args.location,
            args.temperature,
            args.weather,
            date_text=args.date,
            time_text=args.time,
            weekday_text=args.weekday,
        )
    except Exception as exc:  # pragma: no cover - runtime safeguard
        sys.stderr.write(f"水印生成失败：{exc}\n")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
