from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List

from PIL import Image, ImageDraw, ImageFont, ImageStat

ASSETS_DIR = Path(__file__).resolve().parent / 'assets' / 'watermark'
FONT_PATH = Path(__file__).resolve().parent / 'assets' / 'fonts' / '汉仪旗黑X2-65W.ttf'
FALLBACK_FONT_PATH = Path(__file__).resolve().parent / 'assets' / 'fonts' / 'NotoSansSC-Regular.otf'
SEPARATOR_PATH = ASSETS_DIR / 'separator.png'
LOGO_PATH = ASSETS_DIR / 'logo.png'


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


def generate_watermark(image_path: str, output_path: str, location: str, temperature: str) -> None:
    if not Path(image_path).exists():
        raise FileNotFoundError(f'输入图片不存在：{image_path}')

    if not SEPARATOR_PATH.exists() or not LOGO_PATH.exists():
        raise FileNotFoundError(
            '缺少必要的水印装饰资源，请将 logo.png 和 separator.png 放入 assets/watermark/ 目录（参见同目录 README）。'
        )

    info = get_current_info()
    base_image = Image.open(image_path).convert('RGB')
    width, height = base_image.size

    overlay_height = max(int(height * 0.24), 220)
    padding_x = max(int(width * 0.04), 48)
    padding_y = 32

    brightness = ImageStat.Stat(base_image.convert('L')).mean[0]
    use_dark_theme = brightness > 160

    if use_dark_theme:
        background_color = (0, 0, 0, 192)
        primary_color = (255, 255, 255, 255)
        accent_color = (255, 69, 58, 255)
    else:
        background_color = (255, 255, 255, 220)
        primary_color = (17, 24, 39, 255)
        accent_color = (230, 62, 58, 255)

    overlay = Image.new('RGBA', (width, overlay_height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.rectangle((0, 0, width, overlay_height), fill=background_color)

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
    separator_target_height = overlay_height - padding_y * 2
    if separator_target_height > 0:
        ratio = separator.width / separator.height
        separator_size = (
            max(int(separator_target_height * ratio), 6),
            separator_target_height,
        )
        separator_resized = separator.resize(separator_size, Image.LANCZOS)
        separator_x = time_box[2] + int(width * 0.02)
        separator_y = (overlay_height - separator_size[1]) // 2
        paste_centered(overlay, separator_resized, (separator_x, separator_y))
        content_start_x = separator_x + separator_size[0] + int(width * 0.02)
    else:
        content_start_x = time_box[2] + int(width * 0.05)

    date_parts: List[str] = [info['date'], f"星期{info['weekday']}"]
    temperature = temperature.strip()
    if temperature:
        date_parts.append(temperature)
    date_text = '  '.join(date_parts)

    draw.text((content_start_x, padding_y + 8), date_text, font=small_font, fill=primary_color)

    logo = Image.open(LOGO_PATH).convert('RGBA')
    logo_target_height = max(int(overlay_height * 0.32), 72)
    logo_ratio = logo.width / logo.height
    logo_size = (int(logo_target_height * logo_ratio), logo_target_height)
    logo_resized = logo.resize(logo_size, Image.LANCZOS)
    logo_x = width - padding_x - logo_size[0]
    logo_y = overlay_height - padding_y - logo_size[1]

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
    location_start_y = max(time_box[3], padding_y + small_font_size + 12)
    location_start_y = max(location_start_y, overlay_height - padding_y - line_height * len(location_lines))

    for index, line in enumerate(location_lines):
        draw.text((content_start_x, location_start_y + index * line_height), line, font=location_font, fill=primary_color)

    paste_centered(overlay, logo_resized, (logo_x, logo_y))

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
