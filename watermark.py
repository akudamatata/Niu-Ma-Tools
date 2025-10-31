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
SEPARATOR_PATH = ASSETS_DIR / 'separator.png'


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


def paste_centered(base: Image.Image, overlay: Image.Image, position: tuple[int, int]) -> None:
    x, y = position
    base.paste(overlay, (x, y), overlay)


def generate_security_code() -> str:
    length = random.randint(12, 16)
    charset = string.ascii_uppercase + string.digits
    return ''.join(random.choices(charset, k=length))


def compute_logo_layout(small_font_size: int, security_code: str) -> Dict[str, object]:
    body_font = load_font(small_font_size)
    title_font_size = max(int(small_font_size * 1.2), small_font_size + 2)
    title_font = load_font(title_font_size)

    scratch = Image.new('RGBA', (1, 1))
    scratch_draw = ImageDraw.Draw(scratch)

    title_text = '今日水印'
    second_text = '相机'
    real_text = '真实时间'
    third_text = f'防伪 {security_code}'

    title_bbox = scratch_draw.textbbox((0, 0), title_text, font=title_font)
    second_bbox = scratch_draw.textbbox((0, 0), second_text, font=body_font)
    real_bbox = scratch_draw.textbbox((0, 0), real_text, font=body_font)
    third_bbox = scratch_draw.textbbox((0, 0), third_text, font=body_font)

    title_width = title_bbox[2] - title_bbox[0]
    title_height = title_bbox[3] - title_bbox[1]
    second_width = second_bbox[2] - second_bbox[0]
    second_height = second_bbox[3] - second_bbox[1]
    real_width = real_bbox[2] - real_bbox[0]
    real_height = real_bbox[3] - real_bbox[1]
    third_width = third_bbox[2] - third_bbox[0]
    third_height = third_bbox[3] - third_bbox[1]

    gap = max(int(small_font_size * 0.4), 8)
    line_spacing = max(int(small_font_size * 0.45), 8)
    rect_padding_x = max(int(small_font_size * 0.45), 10)
    rect_padding_y = max(int(small_font_size * 0.25), 6)
    rect_width = real_width + rect_padding_x * 2
    rect_height = real_height + rect_padding_y * 2
    rect_radius = max(int(rect_height * 0.3), 6)
    second_line_height = max(second_height, rect_height)

    total_width = max(title_width, second_width + gap + rect_width, third_width)
    total_height = title_height + line_spacing + second_line_height + line_spacing + third_height

    return {
        'title_text': title_text,
        'second_text': second_text,
        'real_text': real_text,
        'third_text': third_text,
        'title_font': title_font,
        'body_font': body_font,
        'title_height': title_height,
        'second_height': second_height,
        'real_height': real_height,
        'third_height': third_height,
        'title_offset_y': -title_bbox[1],
        'second_offset_y': -second_bbox[1],
        'real_offset_y': -real_bbox[1],
        'third_offset_y': -third_bbox[1],
        'second_width': second_width,
        'rect_width': rect_width,
        'rect_height': rect_height,
        'rect_padding_x': rect_padding_x,
        'rect_padding_y': rect_padding_y,
        'rect_radius': rect_radius,
        'second_line_height': second_line_height,
        'gap': gap,
        'line_spacing': line_spacing,
        'width': total_width,
        'height': total_height,
    }


def draw_logo(
    draw: ImageDraw.ImageDraw,
    position: tuple[int, int],
    primary_color: tuple[int, int, int, int],
    layout: Dict[str, object],
) -> None:
    x, y = position
    current_y = y

    draw.text(
        (x, current_y + int(layout['title_offset_y'])),
        layout['title_text'],
        font=layout['title_font'],
        fill=primary_color,
    )
    current_y += layout['title_height'] + layout['line_spacing']

    second_text_y = current_y + (layout['second_line_height'] - layout['second_height']) // 2
    draw.text(
        (x, second_text_y + int(layout['second_offset_y'])),
        layout['second_text'],
        font=layout['body_font'],
        fill=primary_color,
    )

    rect_x = x + layout['second_width'] + layout['gap']
    rect_y = current_y + (layout['second_line_height'] - layout['rect_height']) // 2
    rect_fill = (120, 120, 120, 180)
    draw.rounded_rectangle(
        (
            rect_x,
            rect_y,
            rect_x + layout['rect_width'],
            rect_y + layout['rect_height'],
        ),
        radius=layout['rect_radius'],
        fill=rect_fill,
    )

    real_text_y = rect_y + (layout['rect_height'] - layout['real_height']) // 2 + int(layout['real_offset_y'])
    draw.text(
        (
            rect_x + layout['rect_padding_x'],
            real_text_y,
        ),
        layout['real_text'],
        font=layout['body_font'],
        fill=primary_color,
    )

    current_y += layout['second_line_height'] + layout['line_spacing']
    draw.text(
        (x, current_y + int(layout['third_offset_y'])),
        layout['third_text'],
        font=layout['body_font'],
        fill=primary_color,
    )


def generate_watermark(image_path: str, output_path: str, location: str, temperature: str) -> None:
    if not Path(image_path).exists():
        raise FileNotFoundError(f'输入图片不存在：{image_path}')

    if not SEPARATOR_PATH.exists():
        raise FileNotFoundError('缺少必要的水印装饰资源，请将 separator.png 放入 assets/watermark/ 目录（参见同目录 README）。')

    info = get_current_info()
    base_image = Image.open(image_path).convert('RGB')
    width, height = base_image.size

    overlay_height = max(int(height * 0.18), 200)
    padding_x = max(int(width * 0.04), 48)
    padding_y = 32

    overlay = Image.new('RGBA', (width, overlay_height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    primary_color = (255, 255, 255, 255)
    accent_color = primary_color

    time_font_size = min(int(overlay_height * 0.42), 128)
    time_font = load_font(time_font_size)
    small_font_size = max(int(time_font_size * 0.35), 28)
    small_font = load_font(small_font_size)
    location_font_size = max(int(small_font_size * 0.95), 26)
    location_font = load_font(location_font_size)

    time_text = info['time']
    time_position = (padding_x, padding_y)
    draw.text(time_position, time_text, font=time_font, fill=accent_color)
    time_box = draw.textbbox(time_position, time_text, font=time_font)

    separator = Image.open(SEPARATOR_PATH).convert('RGBA')
    date_parts: List[str] = [info['date'], f"星期{info['weekday']}"]
    temperature = temperature.strip()
    if temperature:
        date_parts.append(temperature)
    date_text = '  '.join(date_parts)

    date_bbox = draw.textbbox((0, 0), date_text, font=small_font)
    date_height = date_bbox[3] - date_bbox[1]
    date_offset_y = -date_bbox[1]

    date_y = padding_y + 8

    separator_target_height = max(date_height, 1)
    if separator_target_height > 0:
        ratio = separator.width / separator.height
        separator_size = (
            max(int(separator_target_height * ratio), 6),
            separator_target_height,
        )
        separator_resized = separator.resize(separator_size, Image.LANCZOS)
        separator_x = time_box[2] + int(width * 0.02)
        separator_y = date_y + (date_height - separator_size[1]) // 2
        paste_centered(overlay, separator_resized, (separator_x, separator_y))
        content_start_x = separator_x + separator_size[0] + int(width * 0.02)
    else:
        content_start_x = time_box[2] + int(width * 0.05)

    draw.text((content_start_x, date_y + date_offset_y), date_text, font=small_font, fill=primary_color)

    security_code = generate_security_code()
    logo_layout = compute_logo_layout(small_font_size, security_code)
    logo_x = width - padding_x - logo_layout['width']
    logo_y = overlay_height - padding_y - logo_layout['height']

    available_width = max(logo_x - content_start_x - 24, int(width * 0.2))
    location_text = location.strip() or '未知地点'
    wrapped_location = wrap_text(draw, location_text, location_font, available_width)

    # 如果仍有文本超过区域宽度，则逐步缩小字体尺寸
    while (
        wrapped_location
        and any(draw.textlength(line, font=location_font) > available_width for line in wrapped_location)
        and location_font_size > 18
    ):
        location_font_size -= 2
        location_font = load_font(location_font_size)
        wrapped_location = wrap_text(draw, location_text, location_font, available_width)

    location_lines = wrapped_location or [location_text]
    line_height = location_font_size + 6
    location_start_y = max(time_box[3], date_y + date_height + max(int(small_font_size * 0.6), 12))
    location_start_y = max(location_start_y, overlay_height - padding_y - line_height * len(location_lines))

    for index, line in enumerate(location_lines):
        draw.text((content_start_x, location_start_y + index * line_height), line, font=location_font, fill=primary_color)

    draw_logo(draw, (logo_x, logo_y), primary_color, logo_layout)

    base_rgba = base_image.convert('RGBA')
    base_rgba.paste(overlay, (0, height - overlay_height), overlay)
    base_rgba.save(output_path)


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description='Generate "今日水印" style overlay on images.')
    parser.add_argument('--input', required=True, help='Path to the source image file.')
    parser.add_argument('--output', required=True, help='Path to save the watermarked image (PNG).')
    parser.add_argument('--location', default='', help='Location text to display.')
    parser.add_argument('--temperature', default='', help='Temperature text to display.')

    args = parser.parse_args(list(argv) if argv is not None else None)

    try:
        generate_watermark(args.input, args.output, args.location, args.temperature)
    except Exception as exc:  # pragma: no cover - runtime safeguard
        sys.stderr.write(f'水印生成失败：{exc}\n')
        return 1

    return 0


if __name__ == '__main__':
    sys.exit(main())
