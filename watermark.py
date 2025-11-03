from __future__ import annotations

import argparse
import random
import string
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List

from PIL import Image, ImageDraw, ImageFont

ASSETS_DIR = Path(__file__).resolve().parent / 'assets' / 'watermark'
FONT_PATH = Path(__file__).resolve().parent / 'assets' / 'fonts' / '汉仪旗黑X2-65W.ttf'
FALLBACK_FONT_PATH = Path(__file__).resolve().parent / 'assets' / 'fonts' / 'NotoSansSC-Regular.otf'

COLOR_WHITE = (255, 255, 255, 255)
COLOR_DARK_GRAY_TEXT = (74, 74, 74, 255)  # #4A4A4A 深灰文字
COLOR_LIGHT_GRAY_BG = (198, 200, 204, 255)  # #C6C8CC 浅灰底
def get_current_info() -> Dict[str, str]:
    now = datetime.now()
    weekdays = ['一', '二', '三', '四', '五', '六', '日']
    weekday = weekdays[now.weekday() % 7]
    return {
        'date': now.strftime('%Y-%m-%d'),
        'time': now.strftime('%H:%M'),
        'weekday': weekday,
    }


_failed_font_names: set[str] = set()


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for candidate in (FONT_PATH, FALLBACK_FONT_PATH):
        try:
            return ImageFont.truetype(str(candidate), size)
        except OSError as exc:  # pragma: no cover - fallback path
            if candidate.name not in _failed_font_names:
                sys.stderr.write(
                    f'警告：无法加载字体 "{candidate.name}" ({exc}). 将尝试其他字体。\n'
                )
                _failed_font_names.add(candidate.name)

    if 'PIL-DEFAULT' not in _failed_font_names:
        sys.stderr.write('警告：无法加载自定义字体，改用 Pillow 默认字体，可能无法显示中文。\n')
        _failed_font_names.add('PIL-DEFAULT')

    return ImageFont.load_default()


def wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> List[str]:
    if not text:
        return []

    lines: List[str] = []
    current = ''

    for char in text:
        if char == '\n':
            if current:
                lines.append(current)
            current = ''
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


def generate_security_code() -> str:
    length = random.randint(12, 16)
    charset = string.ascii_uppercase + string.digits
    return ''.join(random.choices(charset, k=length))


def compute_layout_sizes(
    width: int,
    draw: ImageDraw.ImageDraw,
    time_font: ImageFont.ImageFont,
    small_font: ImageFont.ImageFont,
    location_font_size: int,
    location_text: str,
    time_text: str,
    date_line: str,
    weekday_line: str,
    security_code: str,
    left_padding: int,
    right_padding: int,
    top_padding: int,
    bottom_padding: int,
) -> Dict[str, object]:
    separator_width = max(int(width * 0.0035), 4)
    separator_gap = max(int(width * 0.012), 6)
    after_separator_gap = max(int(width * 0.018), 8)
    logo_gap = max(int(width * 0.02), 12)
    location_gap = 12
    location_line_spacing = 6
    date_line_spacing = 6

    second_ratio = 0.86
    third_ratio = 0.74

    time_bbox = draw.textbbox((0, 0), time_text, font=time_font)
    time_text_width = time_bbox[2] - time_bbox[0]
    time_text_height = time_bbox[3] - time_bbox[1]

    date_bbox = draw.textbbox((0, 0), date_line, font=small_font)
    weekday_bbox = draw.textbbox((0, 0), weekday_line, font=small_font)
    date_line_height = date_bbox[3] - date_bbox[1]
    weekday_line_height = weekday_bbox[3] - weekday_bbox[1]
    date_block_height = date_line_height + date_line_spacing + weekday_line_height

    time_height = max(time_text_height, date_block_height)

    time_position = (left_padding, top_padding - time_bbox[1])
    time_box = (
        left_padding,
        top_padding,
        left_padding + time_text_width,
        top_padding + time_text_height,
    )

    separator_x = time_box[2] + separator_gap
    date_x = separator_x + separator_width + after_separator_gap

    location_text = location_text.strip() or '未知地点'

    min_location_font_size = 18
    min_second_font_size = 12
    min_third_font_size = 10

    location_font_size_current = location_font_size
    location_font = load_font(location_font_size_current)
    lines_cache: List[str] | None = None
    location_heights: List[int] = []
    location_offsets_y: List[int] = []
    location_offsets_x: List[int] = []
    location_block_height = 0

    right_block_layout: Dict[str, object] | None = None
    available_width = max(width - left_padding - right_padding, int(width * 0.25))

    stroke_width = 1

    for _ in range(10):
        title_font_size = max(int(round(location_font_size_current * 1.1)), 1)
        title_font = load_font(title_font_size)
        second_font_size = max(
            int(round(location_font_size_current * second_ratio * 1.1)),
            min_second_font_size,
        )
        third_font_size = max(
            int(round(location_font_size_current * third_ratio * 1.1)),
            min_third_font_size,
        )
        second_font = load_font(second_font_size)
        third_font = load_font(third_font_size)
        right_line_spacing = max(int(location_font_size_current * 0.3), 6)

        right_lines = []
        max_right_width = 0
        total_right_height = 0
        for text, font, role in [
            ('今日水印', title_font, 'title'),
            ('相机真实时间', second_font, 'second'),
            (f'防伪 {security_code}', third_font, 'third'),
        ]:
            bbox = draw.textbbox((0, 0), text, font=font, stroke_width=stroke_width)
            width_span = bbox[2] - bbox[0]
            height_span = bbox[3] - bbox[1]
            max_right_width = max(max_right_width, width_span)
            right_lines.append(
                {
                    'text': text,
                    'font': font,
                    'width': width_span,
                    'height': height_span,
                    'offset': -bbox[1],
                    'role': role,
                }
            )
            total_right_height += height_span

        if len(right_lines) > 1:
            total_right_height += right_line_spacing * (len(right_lines) - 1)

        right_block_layout = {
            'lines': right_lines,
            'width': max_right_width,
            'height': total_right_height,
            'line_spacing': right_line_spacing,
        }

        available_width = max(
            width - left_padding - right_padding - right_block_layout['width'] - logo_gap,
            int(width * 0.25),
        )
        if available_width <= 0:
            available_width = max(width - left_padding - right_padding, 1)

        location_font = title_font
        lines = wrap_text(draw, location_text, location_font, available_width) or [location_text]

        needs_shrink = any(
            draw.textlength(line, font=location_font) > available_width for line in lines
        )

        if needs_shrink and location_font_size_current > min_location_font_size:
            location_font_size_current = max(location_font_size_current - 2, min_location_font_size)
            continue

        line_heights = []
        line_offsets_y = []
        line_offsets_x = []
        total_height = 0
        for line in lines:
            bbox = draw.textbbox((0, 0), line, font=location_font)
            height = bbox[3] - bbox[1]
            line_heights.append(height)
            line_offsets_y.append(-bbox[1])
            line_offsets_x.append(-bbox[0])
            total_height += height

        if len(lines) > 1:
            total_height += location_line_spacing * (len(lines) - 1)

        location_block_height = total_height
        location_heights = line_heights
        location_offsets_y = line_offsets_y
        location_offsets_x = line_offsets_x
        lines_cache = lines
        break

    if lines_cache is None:
        location_font = load_font(location_font_size_current)
        lines_cache = wrap_text(draw, location_text, location_font, available_width) or [location_text]
        location_heights = []
        location_offsets_y = []
        location_offsets_x = []
        location_block_height = 0
        for line in lines_cache:
            bbox = draw.textbbox((0, 0), line, font=location_font)
            height = bbox[3] - bbox[1]
            location_heights.append(height)
            location_offsets_y.append(-bbox[1])
            location_offsets_x.append(-bbox[0])
            location_block_height += height
        if len(lines_cache) > 1:
            location_block_height += location_line_spacing * (len(lines_cache) - 1)

    if right_block_layout is None:
        title_font_size = max(int(round(location_font_size_current * 1.1)), 1)
        title_font = load_font(title_font_size)
        second_font_size = max(
            int(round(location_font_size_current * second_ratio * 1.1)),
            min_second_font_size,
        )
        third_font_size = max(
            int(round(location_font_size_current * third_ratio * 1.1)),
            min_third_font_size,
        )
        second_font = load_font(second_font_size)
        third_font = load_font(third_font_size)
        right_line_spacing = max(int(location_font_size_current * 0.3), 6)
        right_lines = []
        max_right_width = 0
        total_right_height = 0
        for text, font, role in [
            ('今日水印', title_font, 'title'),
            ('相机真实时间', second_font, 'second'),
            (f'防伪 {security_code}', third_font, 'third'),
        ]:
            bbox = draw.textbbox((0, 0), text, font=font, stroke_width=stroke_width)
            width_span = bbox[2] - bbox[0]
            height_span = bbox[3] - bbox[1]
            max_right_width = max(max_right_width, width_span)
            right_lines.append(
                {
                    'text': text,
                    'font': font,
                    'width': width_span,
                    'height': height_span,
                    'offset': -bbox[1],
                    'role': role,
                }
            )
            total_right_height += height_span
        if len(right_lines) > 1:
            total_right_height += right_line_spacing * (len(right_lines) - 1)
        right_block_layout = {
            'lines': right_lines,
            'width': max_right_width,
            'height': total_right_height,
            'line_spacing': right_line_spacing,
        }

    location_total_height = time_height + location_gap + location_block_height
    content_height = max(time_height, location_total_height, right_block_layout['height'])
    content_origin_shift = top_padding

    adjusted_time_position = (
        time_position[0],
        time_position[1] - content_origin_shift,
    )

    date_line_y = top_padding - date_bbox[1] - content_origin_shift
    weekday_line_y = (
        top_padding + date_line_height + date_line_spacing - weekday_bbox[1] - content_origin_shift
    )

    location_start_x = time_box[0] + 2
    location_start_y = top_padding + time_height + location_gap - content_origin_shift

    right_edge = width - right_padding
    right_start_y = top_padding + content_height - right_block_layout['height'] - content_origin_shift
    right_block_layout = {
        **right_block_layout,
        'right_edge': right_edge,
        'top': right_start_y,
    }

    return {
        'time_position': adjusted_time_position,
        'time_box': time_box,
        'time_height': time_height,
        'date_x': date_x,
        'date_line_y': date_line_y,
        'weekday_line_y': weekday_line_y,
        'date_block_height': date_block_height,
        'separator': {
            'x': separator_x,
            'y': top_padding - content_origin_shift,
            'width': separator_width,
            'height': date_block_height,
        },
        'location_font': location_font,
        'location_lines': lines_cache,
        'location_heights': location_heights,
        'location_offsets_y': location_offsets_y,
        'location_offsets_x': location_offsets_x,
        'location_start': (location_start_x, location_start_y),
        'location_line_spacing': location_line_spacing,
        'right_block': right_block_layout,
        'location_font_size': location_font_size_current,
        'content_height': content_height,
        'overlay_height': content_height,
        'available_width': available_width,
    }


def generate_watermark(
    image_path: str,
    output_path: str,
    location: str,
    temperature: str,
    weather: str,
    *,
    date_text: str = '',
    time_text: str = '',
    weekday_text: str = '',
) -> None:
    if not Path(image_path).exists():
        raise FileNotFoundError(f'输入图片不存在：{image_path}')

    info = get_current_info()
    base_image = Image.open(image_path).convert('RGB')
    width, height = base_image.size

    base_dim = min(width, height)
    overlay_base_height = max(int(base_dim * 0.24), 1)
    padding_x = max(int(width * 0.05), 24)
    right_padding = max(int(width * 0.03), 16)
    top_padding = 32
    bottom_padding = 32

    scratch = Image.new('RGBA', (width, overlay_base_height or 1), (0, 0, 0, 0))
    draw_measure = ImageDraw.Draw(scratch)

    primary_color = (255, 255, 255, 255)
    separator_color = (251, 187, 49, 255)
    color_yellow = (249, 199, 79, 255)
    stroke_width = 1
    stroke_fill = (0, 0, 0, 64)

    time_font_size = max(int(overlay_base_height * 0.42), 1)
    time_font = load_font(time_font_size)
    small_font_size = max(int(time_font_size * 0.35), 1)
    small_font = load_font(small_font_size)
    location_font_size = max(int(small_font_size * 0.95), 1)

    time_text = time_text.strip() or info['time']
    date_line = date_text.strip() or info['date']
    temperature = temperature.strip()
    weather = weather.strip()
    weekday_label = weekday_text.strip() or f"星期{info['weekday']}"
    weekday_parts = [weekday_label]
    if weather:
        weekday_parts.append(weather)
    if temperature:
        weekday_parts.append(temperature)
    weekday_line = '  '.join(weekday_parts)

    security_code = generate_security_code()

    max_overlay_ratio = 0.30
    max_overlay_height = max(int(height * max_overlay_ratio), 1)

    layout = compute_layout_sizes(
        width=width,
        draw=draw_measure,
        time_font=time_font,
        small_font=small_font,
        location_font_size=location_font_size,
        location_text=location,
        time_text=time_text,
        date_line=date_line,
        weekday_line=weekday_line,
        security_code=security_code,
        left_padding=padding_x,
        right_padding=right_padding,
        top_padding=top_padding,
        bottom_padding=bottom_padding,
    )
    location_font_size = layout['location_font_size']

    min_time_font_size = 12
    min_small_font_size = 10
    min_location_font_size = 10

    while layout['overlay_height'] > max_overlay_height:
        current_overlay_height = layout['overlay_height']
        if current_overlay_height <= 0:
            break

        scale_factor = max_overlay_height / current_overlay_height

        new_time_font_size = max(int(time_font_size * scale_factor), min_time_font_size)
        new_small_font_size = max(int(small_font_size * scale_factor), min_small_font_size)
        new_location_font_size = max(int(location_font_size * scale_factor), min_location_font_size)

        if (
            new_time_font_size == time_font_size
            and new_small_font_size == small_font_size
            and new_location_font_size == location_font_size
        ):
            if time_font_size > min_time_font_size:
                new_time_font_size = max(time_font_size - 1, min_time_font_size)
            if small_font_size > min_small_font_size:
                new_small_font_size = max(small_font_size - 1, min_small_font_size)
            if location_font_size > min_location_font_size:
                new_location_font_size = max(location_font_size - 1, min_location_font_size)

            if (
                new_time_font_size == time_font_size
                and new_small_font_size == small_font_size
                and new_location_font_size == location_font_size
            ):
                break

        time_font_size = new_time_font_size
        small_font_size = new_small_font_size
        location_font_size = new_location_font_size

        time_font = load_font(time_font_size)
        small_font = load_font(small_font_size)
        layout = compute_layout_sizes(
            width=width,
            draw=draw_measure,
            time_font=time_font,
            small_font=small_font,
            location_font_size=location_font_size,
            location_text=location,
            time_text=time_text,
            date_line=date_line,
            weekday_line=weekday_line,
            security_code=security_code,
            left_padding=padding_x,
            right_padding=right_padding,
            top_padding=top_padding,
            bottom_padding=bottom_padding,
        )
        location_font_size = layout['location_font_size']

    overlay_height = max(layout['content_height'], 1)

    overlay = Image.new('RGBA', (width, overlay_height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    draw.text(layout['time_position'], time_text, font=time_font, fill=primary_color)

    separator = layout['separator']
    draw.rectangle(
        (
            separator['x'],
            separator['y'],
            separator['x'] + separator['width'],
            separator['y'] + separator['height'],
        ),
        fill=separator_color,
    )

    draw.text((layout['date_x'], layout['date_line_y']), date_line, font=small_font, fill=primary_color)
    draw.text(
        (layout['date_x'], layout['weekday_line_y']),
        weekday_line,
        font=small_font,
        fill=primary_color,
    )

    location_font = layout['location_font']
    location_start_x, location_start_y = layout['location_start']
    current_y = location_start_y
    for line, offset_y, line_height, offset_x in zip(
        layout['location_lines'],
        layout['location_offsets_y'],
        layout['location_heights'],
        layout['location_offsets_x'],
    ):
        draw.text(
            (location_start_x + offset_x, current_y + offset_y),
            line,
            font=location_font,
            fill=primary_color,
        )
        current_y += line_height + layout['location_line_spacing']

    right_block = layout['right_block']
    current_y = right_block['top']
    for line in right_block['lines']:
        text_x = right_block['right_edge'] - line['width']
        text_y = current_y + line['offset']
        font = line['font']
        if line['text'] == '今日水印':
            draw.text(
                (text_x, text_y),
                '今',
                font=font,
                fill=primary_color,
                stroke_width=stroke_width,
                stroke_fill=stroke_fill,
            )
            jin_bbox = draw.textbbox(
                (text_x, text_y),
                '今',
                font=font,
                stroke_width=stroke_width,
            )
            stroke_top = jin_bbox[1] + (jin_bbox[3] - jin_bbox[1]) * 0.45
            stroke_bottom = jin_bbox[1] + (jin_bbox[3] - jin_bbox[1]) * 0.62
            draw.rectangle(
                (
                    jin_bbox[0] + 1,
                    int(round(stroke_top)),
                    jin_bbox[2] - 1,
                    int(round(stroke_bottom)),
                ),
                fill=color_yellow,
            )
            rest_x = jin_bbox[2]
            draw.text(
                (rest_x, text_y),
                '日水印',
                font=font,
                fill=primary_color,
                stroke_width=stroke_width,
                stroke_fill=stroke_fill,
            )
        elif line['text'] == '相机真实时间':
            left_text = '相机'
            right_text = '真实时间'
            right_bbox = draw.textbbox((0, 0), right_text, font=font, stroke_width=0)
            rw = right_bbox[2] - right_bbox[0]
            rh = right_bbox[3] - right_bbox[1]

            pad_x = 8
            pad_y = 3
            radius = 6

            right_text_x = text_x + line['width'] - rw
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
            draw.text(
                (text_x, text_y),
                left_text,
                font=font,
                fill=COLOR_WHITE,
                stroke_width=stroke_width,
                stroke_fill=stroke_fill,
            )
        else:
            draw.text(
                (text_x, text_y),
                line['text'],
                font=font,
                fill=primary_color,
                stroke_width=stroke_width,
                stroke_fill=stroke_fill,
            )
        current_y += line['height'] + right_block['line_spacing']

    base_rgba = base_image.convert('RGBA')
    paste_y = height - layout['content_height'] - bottom_padding
    base_rgba.paste(overlay, (0, paste_y), overlay)
    base_rgba.save(output_path)


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description='Generate "今日水印" style overlay on images.')
    parser.add_argument('--input', required=True, help='Path to the source image file.')
    parser.add_argument('--output', required=True, help='Path to save the watermarked image (PNG).')
    parser.add_argument('--location', default='', help='Location text to display.')
    parser.add_argument('--temperature', default='', help='Temperature text to display.')
    parser.add_argument('--weather', default='', help='Weather condition text to display.')
    parser.add_argument('--date', default='', help='Custom date text to display.')
    parser.add_argument('--time', default='', help='Custom time text to display.')
    parser.add_argument('--weekday', default='', help='Custom weekday text to display.')

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
        sys.stderr.write(f'水印生成失败：{exc}\n')
        return 1

    return 0


if __name__ == '__main__':
    sys.exit(main())
