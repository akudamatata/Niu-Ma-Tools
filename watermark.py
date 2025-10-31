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
    secondary_color: tuple[int, int, int, int],
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
        fill=secondary_color,
    )

    rect_x = x + layout['second_width'] + layout['gap']
    rect_y = current_y + (layout['second_line_height'] - layout['rect_height']) // 2
    rect_fill = (120, 120, 120, 200)
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


def render_logo_image(
    small_font_size: int,
    security_code: str,
    primary_color: tuple[int, int, int, int],
    secondary_color: tuple[int, int, int, int],
) -> Image.Image:
    layout = compute_logo_layout(small_font_size, security_code)
    logo_image = Image.new('RGBA', (int(layout['width']), int(layout['height'])), (0, 0, 0, 0))
    logo_draw = ImageDraw.Draw(logo_image)
    draw_logo(logo_draw, (0, 0), primary_color, secondary_color, layout)
    return logo_image


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
    base_logo_image: Image.Image,
    left_padding: int,
    right_padding: int,
    top_padding: int,
    bottom_padding: int,
) -> Dict[str, object]:
    separator_width = 8
    separator_gap = max(int(width * 0.012), 12)
    after_separator_gap = max(int(width * 0.018), 16)
    logo_gap = max(int(width * 0.02), 24)
    location_gap = 12
    location_line_spacing = 6
    date_line_spacing = 6

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

    base_logo_width, base_logo_height = base_logo_image.size
    logo_height = max(base_logo_height, 1)
    logo_width = max(base_logo_width, 1)

    location_font = load_font(location_font_size)
    min_location_font_size = 18

    lines_cache: List[str] | None = None
    location_heights: List[int] = []
    location_offsets: List[int] = []
    location_block_height = 0
    available_width = max(width - left_padding - right_padding - logo_width - logo_gap, int(width * 0.3))

    for _ in range(6):
        available_width = max(
            width - left_padding - right_padding - logo_width - logo_gap,
            int(width * 0.3),
        )
        if available_width <= 0:
            available_width = max(width - left_padding - right_padding, 1)

        lines = wrap_text(draw, location_text, location_font, available_width) or [location_text]

        while (
            location_font_size > min_location_font_size
            and any(draw.textlength(line, font=location_font) > available_width for line in lines)
        ):
            location_font_size -= 2
            location_font = load_font(location_font_size)
            lines = wrap_text(draw, location_text, location_font, available_width) or [location_text]

        line_heights: List[int] = []
        line_offsets: List[int] = []
        total_height = 0
        for line in lines:
            bbox = draw.textbbox((0, 0), line, font=location_font)
            height = bbox[3] - bbox[1]
            line_heights.append(height)
            line_offsets.append(-bbox[1])
            total_height += height

        if len(lines) > 1:
            total_height += location_line_spacing * (len(lines) - 1)

        location_block_height = total_height
        location_heights = line_heights
        location_offsets = line_offsets
        lines_cache = lines

        location_total_height = time_height + location_gap + location_block_height
        content_height = max(time_height, location_total_height, logo_height)

        target_logo_height = max(int(content_height * 0.8), 1)
        if base_logo_height > 0:
            target_logo_width = max(int(base_logo_width * (target_logo_height / base_logo_height)), 1)
        else:
            target_logo_width = logo_width

        if target_logo_height == logo_height and target_logo_width == logo_width:
            break

        logo_height = target_logo_height
        logo_width = target_logo_width

    if lines_cache is None:
        lines_cache = [location_text]

    location_total_height = time_height + location_gap + location_block_height
    content_height = max(time_height, location_total_height, logo_height)
    overlay_height = top_padding + content_height + bottom_padding

    date_line_y = top_padding - date_bbox[1]
    weekday_line_y = top_padding + date_line_height + date_line_spacing - weekday_bbox[1]

    location_start_x = left_padding
    location_start_y = top_padding + time_height + location_gap

    logo_x = width - right_padding - logo_width
    logo_y = top_padding + content_height - logo_height

    return {
        'time_position': time_position,
        'time_box': time_box,
        'time_height': time_height,
        'date_x': date_x,
        'date_line_y': date_line_y,
        'weekday_line_y': weekday_line_y,
        'date_block_height': date_block_height,
        'separator': {
            'x': separator_x,
            'y': top_padding,
            'width': separator_width,
            'height': date_block_height,
        },
        'location_font': location_font,
        'location_lines': lines_cache,
        'location_heights': location_heights,
        'location_offsets': location_offsets,
        'location_start': (location_start_x, location_start_y),
        'location_line_spacing': location_line_spacing,
        'logo_size': (logo_width, logo_height),
        'logo_position': (logo_x, logo_y),
        'content_height': content_height,
        'overlay_height': overlay_height,
        'available_width': available_width,
    }


def generate_watermark(image_path: str, output_path: str, location: str, temperature: str) -> None:
    if not Path(image_path).exists():
        raise FileNotFoundError(f'输入图片不存在：{image_path}')

    info = get_current_info()
    base_image = Image.open(image_path).convert('RGB')
    width, height = base_image.size

    base_dim = min(width, height)
    overlay_base_height = max(int(base_dim * 0.24), 1)
    padding_x = max(int(width * 0.05), 48)
    right_padding = max(int(width * 0.03), 32)
    top_padding = 32
    bottom_padding = 32

    scratch = Image.new('RGBA', (width, overlay_base_height or 1), (0, 0, 0, 0))
    draw_measure = ImageDraw.Draw(scratch)

    primary_color = (255, 255, 255, 255)
    secondary_color = (176, 176, 176, 255)
    separator_color = (251, 187, 49, 255)

    time_font_size = max(int(overlay_base_height * 0.42), 1)
    time_font = load_font(time_font_size)
    small_font_size = max(int(time_font_size * 0.35), 1)
    small_font = load_font(small_font_size)
    location_font_size = max(int(small_font_size * 0.95), 1)

    time_text = info['time']
    date_line = info['date']
    temperature = temperature.strip()
    weekday_line = f"星期{info['weekday']}"
    if temperature:
        weekday_line = f"{weekday_line}  {temperature}"

    security_code = generate_security_code()
    base_logo_image = render_logo_image(
        small_font_size,
        security_code,
        primary_color,
        secondary_color,
    )

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
        base_logo_image=base_logo_image,
        left_padding=padding_x,
        right_padding=right_padding,
        top_padding=top_padding,
        bottom_padding=bottom_padding,
    )

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
        base_logo_image = render_logo_image(
            small_font_size,
            security_code,
            primary_color,
            secondary_color,
        )

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
            base_logo_image=base_logo_image,
            left_padding=padding_x,
            right_padding=right_padding,
            top_padding=top_padding,
            bottom_padding=bottom_padding,
        )

    logo_size = layout['logo_size']
    if base_logo_image.size != logo_size:
        logo_image = base_logo_image.resize(logo_size, Image.LANCZOS)
    else:
        logo_image = base_logo_image

    overlay_height = layout['overlay_height']

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
    for line, offset, height in zip(
        layout['location_lines'], layout['location_offsets'], layout['location_heights']
    ):
        draw.text((location_start_x, current_y + offset), line, font=location_font, fill=primary_color)
        current_y += height + layout['location_line_spacing']

    paste_centered(overlay, logo_image, layout['logo_position'])

    base_rgba = base_image.convert('RGBA')
    paste_y = height - overlay_height
    base_rgba.paste(overlay, (0, paste_y), overlay)
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
