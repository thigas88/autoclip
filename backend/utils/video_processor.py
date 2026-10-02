"""
视频处理工具
"""
import subprocess
import json
import logging
import re
from typing import List, Dict, Optional
from pathlib import Path
from .ffmpeg_utils import get_ffmpeg_path, get_ffprobe_path

# 修复导入问题
try:
    from ..core.shared_config import CLIPS_DIR, COLLECTIONS_DIR
except ImportError:
    # 如果相对导入失败，尝试绝对导入
    import sys
    from pathlib import Path
    backend_path = Path(__file__).parent.parent
    if str(backend_path) not in sys.path:
        sys.path.insert(0, str(backend_path))
    from ..core.shared_config import CLIPS_DIR, COLLECTIONS_DIR

logger = logging.getLogger(__name__)

# Presets de legenda para FFmpeg drawtext/subtitles filter
SUBTITLE_PRESETS = {
    "none": None,
    "simple_white": {
        "font_size": 24,
        "font_color": "white",
        "border_style": 1,
        "outline": 2,
        "shadow": 0,
        "alignment": 2,  # bottom center
        "margin_v": 30,
    },
    "simple_yellow": {
        "font_size": 24,
        "font_color": "yellow",
        "border_style": 1,
        "outline": 2,
        "shadow": 0,
        "alignment": 2,
        "margin_v": 30,
    },
    "bold_centered": {
        "font_size": 32,
        "font_color": "white",
        "border_style": 1,
        "outline": 3,
        "shadow": 1,
        "alignment": 5,  # center
        "margin_v": 0,
    },
    "karaoke_style": {
        "font_size": 28,
        "font_color": "#00FFFF",
        "border_style": 3,
        "outline": 2,
        "back_color": "&H80000000&",
        "shadow": 0,
        "alignment": 2,
        "margin_v": 40,
    },
    "social_media": {
        "font_size": 36,
        "font_color": "white",
        "border_style": 1,
        "outline": 4,
        "shadow": 2,
        "alignment": 2,
        "margin_v": 80,
        "bold": True,
    },
}


class VideoProcessor:
    """视频处理工具类"""

    def __init__(self, clips_dir: Optional[str] = None, collections_dir: Optional[str] = None):
        # 强制使用传入的项目特定路径，不使用全局路径作为后备
        if not clips_dir:
            raise ValueError("clips_dir 参数是必需的，不能使用全局路径")
        if not collections_dir:
            raise ValueError("collections_dir 参数是必需的，不能使用全局路径")
        
        self.clips_dir = Path(clips_dir)
        self.collections_dir = Path(collections_dir)
    
    @staticmethod
    def sanitize_filename(filename: str) -> str:
        """
        清理文件名，移除或替换不合法的字符
        
        Args:
            filename: 原始文件名
            
        Returns:
            清理后的文件名
        """
        # 移除或替换不合法的字符
        # Windows和Unix系统都不允许的字符: < > : " | ? * \ /
        # 替换为下划线
        sanitized = re.sub(r'[<>:"|?*\\/]', '_', filename)
        
        # 移除前后空格和点
        sanitized = sanitized.strip(' .')
        
        # 限制长度，避免文件名过长
        if len(sanitized) > 100:
            sanitized = sanitized[:100]
        
        # 确保文件名不为空
        if not sanitized:
            sanitized = "untitled"
            
        return sanitized
    
    @staticmethod
    def convert_srt_time_to_ffmpeg_time(srt_time: str) -> str:
        """
        将SRT时间格式转换为FFmpeg时间格式
        
        Args:
            srt_time: SRT时间格式 (如 "00:00:06,140" 或 "00:00:06.140")
            
        Returns:
            FFmpeg时间格式 (如 "00:00:06.140")
        """
        # 将逗号替换为点
        return srt_time.replace(',', '.')
    
    @staticmethod
    def convert_seconds_to_ffmpeg_time(seconds: float) -> str:
        """
        将秒数转换为FFmpeg时间格式
        
        Args:
            seconds: 秒数
            
        Returns:
            FFmpeg时间格式 (如 "00:00:06.140")
        """
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        milliseconds = int((seconds % 1) * 1000)
        
        return f"{hours:02d}:{minutes:02d}:{secs:02d}.{milliseconds:03d}"
    
    @staticmethod
    def convert_ffmpeg_time_to_seconds(time_str: str) -> float:
        """
        将FFmpeg时间格式转换为秒数
        
        Args:
            time_str: FFmpeg时间格式 (如 "00:00:06.140")
            
        Returns:
            秒数
        """
        try:
            # 处理毫秒部分
            if '.' in time_str:
                time_part, ms_part = time_str.split('.')
                milliseconds = int(ms_part)
            else:
                time_part = time_str
                milliseconds = 0
            
            # 解析时分秒
            h, m, s = map(int, time_part.split(':'))
            
            return h * 3600 + m * 60 + s + milliseconds / 1000
        except Exception as e:
            logger.error(f"时间格式转换失败: {time_str}, 错误: {e}")
            return 0.0
    
    @staticmethod
    def extract_clip(input_video: Path, output_path: Path,
                    start_time: str, end_time: str) -> bool:
        """
        从视频中提取指定时间段的片段

        Args:
            input_video: 输入视频路径
            output_path: 输出视频路径
            start_time: 开始时间 (格式: "00:01:25,140")
            end_time: 结束时间 (格式: "00:02:53,500")

        Returns:
            是否成功
        """
        try:
            # 确保输出目录存在
            output_path.parent.mkdir(parents=True, exist_ok=True)

            # 转换时间格式：从SRT格式转换为FFmpeg格式
            ffmpeg_start_time = VideoProcessor.convert_srt_time_to_ffmpeg_time(start_time)
            ffmpeg_end_time = VideoProcessor.convert_srt_time_to_ffmpeg_time(end_time)

            # 计算持续时间
            start_seconds = VideoProcessor.convert_ffmpeg_time_to_seconds(ffmpeg_start_time)
            end_seconds = VideoProcessor.convert_ffmpeg_time_to_seconds(ffmpeg_end_time)
            duration = end_seconds - start_seconds

            # 构建优化的FFmpeg命令
            # 使用 -ss 在输入前进行精确定位，使用 -t 指定持续时间
            ffmpeg_bin = get_ffmpeg_path()
            cmd = [
                ffmpeg_bin,
                '-ss', ffmpeg_start_time,  # 在输入前定位，更精确
                '-i', str(input_video),
                '-t', str(duration),  # 使用持续时间而不是绝对结束时间
                '-c:v', 'copy',  # 复制视频流
                '-c:a', 'copy',  # 复制音频流
                '-avoid_negative_ts', 'make_zero',
                '-y',  # 覆盖输出文件
                str(output_path)
            ]

            # 执行命令
            result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='ignore')

            if result.returncode == 0:
                logger.info(f"成功提取视频片段: {output_path} ({ffmpeg_start_time} -> {ffmpeg_end_time}, 时长: {duration:.2f}秒)")
                return True
            else:
                logger.error(f"提取视频片段失败: {result.stderr}")
                return False

        except Exception as e:
            logger.error(f"视频处理异常: {str(e)}")
            return False

    @staticmethod
    def extract_clip_with_format(
        input_video: Path,
        output_path: Path,
        start_time: str,
        end_time: str,
        aspect_ratio: str = "original",
        subtitle_preset: str = "none",
        srt_path: Optional[Path] = None,
        max_duration: int = 60,
        preferred_min_duration: int = 10,
        preferred_max_duration: int = 25,
        prioritize_viral_length: bool = True,
    ) -> dict:
        """
        Extrai clipe com formatação avançada: crop 9:16, limite de duração e legendas.

        Args:
            input_video: caminho do vídeo fonte
            output_path: caminho de saída do clipe
            start_time / end_time: marcadores SRT ou FFmpeg
            aspect_ratio: 'original' | '9:16' | '16:9'
            subtitle_preset: chave em SUBTITLE_PRESETS
            srt_path: arquivo SRT opcional para queimar legendas
            max_duration: duração máxima absoluta (segundos)
            preferred_min_duration / preferred_max_duration: janela viral preferida
            prioritize_viral_length: se True, descarta clipes fora da janela viral

        Returns:
            dict com 'success' (bool), 'path' (Path|None), 'duration' (float), 'skipped_reason' (str|None)
        """
        result_info = {"success": False, "path": None, "duration": 0.0, "skipped_reason": None}
        try:
            output_path.parent.mkdir(parents=True, exist_ok=True)

            ffmpeg_start = VideoProcessor.convert_srt_time_to_ffmpeg_time(start_time)
            ffmpeg_end = VideoProcessor.convert_srt_time_to_ffmpeg_time(end_time)
            start_sec = VideoProcessor.convert_ffmpeg_time_to_seconds(ffmpeg_start)
            end_sec = VideoProcessor.convert_ffmpeg_time_to_seconds(ffmpeg_end)
            duration = max(0.0, end_sec - start_sec)

            # Filtragem por duração
            if duration <= 0:
                result_info["skipped_reason"] = "duração zero ou negativa"
                logger.warning(f"Clip ignorado (duração inválida): {start_time}->{end_time}")
                return result_info

            if prioritize_viral_length and not (preferred_min_duration <= duration <= preferred_max_duration):
                result_info["skipped_reason"] = f"fora da janela viral ({preferred_min_duration}-{preferred_max_duration}s)"
                logger.info(
                    f"Clip ignorado (prioridade viral): {duration:.1f}s fora de {preferred_min_duration}-{preferred_max_duration}s"
                )
                return result_info

            if duration > max_duration:
                result_info["skipped_reason"] = f"excede duração máxima ({max_duration}s)"
                logger.info(f"Clip ignorado (muito longo): {duration:.1f}s > {max_duration}s")
                return result_info

            ffmpeg_bin = get_ffmpeg_path()
            video_filters: list[str] = []

            # Crop / scale por aspecto
            if aspect_ratio == "9:16":
                # Center-crop para 9:16 e escala para 1080x1920
                video_filters.append(
                    "crop=ih*9/16:ih,scale=1080:1920:flags=lanczos"
                )
            elif aspect_ratio == "16:9":
                video_filters.append(
                    "crop=iw:iw*9/16,scale=1920:1080:flags=lanczos"
                )

            # Legendas embutidas (burn-in) via filtro subtitles
            preset_cfg = SUBTITLE_PRESETS.get(subtitle_preset)
            if preset_cfg and srt_path and srt_path.exists():
                escaped_srt = str(srt_path).replace("\\", "/").replace(":", "\\:")
                force_style_parts = [
                    f"FontSize={preset_cfg.get('font_size', 24)}",
                    f"PrimaryColour=&H00{VideoProcessor._bgr_from_name(preset_cfg.get('font_color', 'white'))}&",
                    f"OutlineColour=&H00000000&",
                    f"BorderStyle={preset_cfg.get('border_style', 1)}",
                    f"Outline={preset_cfg.get('outline', 2)}",
                    f"Shadow={preset_cfg.get('shadow', 0)}",
                    f"Alignment={preset_cfg.get('alignment', 2)}",
                    f"MarginV={preset_cfg.get('margin_v', 30)}",
                ]
                if preset_cfg.get("bold"):
                    force_style_parts.append("Bold=1")
                force_style = ",".join(force_style_parts)
                video_filters.append(
                    f"subtitles='{escaped_srt}':force_style='{force_style}'"
                )

            cmd: list[str] = [
                ffmpeg_bin,
                "-ss", ffmpeg_start,
                "-i", str(input_video),
                "-t", str(duration),
            ]

            if video_filters:
                cmd += ["-vf", ",".join(video_filters)]
                cmd += ["-c:v", "libx264", "-preset", "fast", "-crf", "23"]
            else:
                cmd += ["-c:v", "copy"]

            cmd += [
                "-c:a", "aac", "-b:a", "128k",
                "-movflags", "+faststart",
                "-avoid_negative_ts", "make_zero",
                "-y",
                str(output_path),
            ]

            run = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="ignore")
            if run.returncode != 0:
                logger.error(f"Falha ao extrair clip formatado: {run.stderr[-500:]}")
                result_info["skipped_reason"] = "erro no ffmpeg"
                return result_info

            logger.info(
                f"Clip formatado gerado: {output_path.name} | {duration:.1f}s | ratio={aspect_ratio} | legendas={subtitle_preset}"
            )
            result_info.update({"success": True, "path": output_path, "duration": duration})
            return result_info

        except Exception as e:
            logger.error(f"Exceção em extract_clip_with_format: {e}")
            result_info["skipped_reason"] = f"exceção: {e}"
            return result_info

    @staticmethod
    def _bgr_from_name(color_name: str) -> str:
        """Converte nome simples de cor para hex BGR usado pelo ASS/SSA."""
        mapping = {
            "white": "FFFFFF",
            "yellow": "00FFFF",
            "red": "0000FF",
            "green": "00FF00",
            "cyan": "FFFF00",
            "magenta": "FF00FF",
            "black": "000000",
        }
        if color_name.startswith("#"):
            rgb = color_name.lstrip("#")
            if len(rgb) == 6:
                return rgb[4:6] + rgb[2:4] + rgb[0:2]
        return mapping.get(color_name.lower(), "FFFFFF")
    
    @staticmethod
    def create_collection(clips_list: List[Path], output_path: Path) -> bool:
        """
        将多个视频片段拼接成合集
        
        Args:
            clips_list: 视频片段路径列表
            output_path: 输出合集路径
            
        Returns:
            是否成功
        """
        try:
            # 验证输入参数
            if not clips_list:
                logger.error("clips_list为空，无法创建合集")
                return False
            
            # 验证所有视频文件是否存在
            valid_clips = []
            for clip_path in clips_list:
                if not clip_path.exists():
                    logger.warning(f"视频文件不存在，跳过: {clip_path}")
                    continue
                valid_clips.append(clip_path)
            
            if not valid_clips:
                logger.error("没有有效的视频文件，无法创建合集")
                return False
            
            # 确保输出目录存在
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            # 创建concat文件
            concat_file = output_path.parent / "concat_list.txt"
            
            with open(concat_file, 'w', encoding='utf-8') as f:
                for clip_path in valid_clips:
                    # 使用绝对路径并转义单引号
                    abs_path = clip_path.absolute()
                    escaped_path = str(abs_path).replace("'", "'\"'\"'")
                    f.write(f"file '{escaped_path}'\n")
            
            # 验证concat文件内容
            if concat_file.stat().st_size == 0:
                logger.error("concat文件为空，无法创建合集")
                concat_file.unlink(missing_ok=True)
                return False
            
            # 构建FFmpeg命令 - 使用H.264编码确保兼容性
            ffmpeg_bin = get_ffmpeg_path()
            cmd = [
                ffmpeg_bin,
                '-f', 'concat',
                '-safe', '0',
                '-i', str(concat_file),
                '-c:v', 'libx264',  # 使用H.264视频编码
                '-preset', 'ultrafast',  # 使用最快的编码预设
                '-crf', '28',  # 稍微降低质量以加快编码速度
                '-c:a', 'aac',  # 使用AAC音频编码
                '-b:a', '128k',  # 音频比特率
                '-movflags', '+faststart',  # 优化网络播放
                '-y',
                str(output_path)
            ]
            
            logger.info(f"执行FFmpeg命令: {' '.join(cmd)}")
            
            # 执行命令
            result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='ignore')
            
            # 清理临时文件
            concat_file.unlink(missing_ok=True)
            
            if result.returncode == 0:
                logger.info(f"成功创建合集: {output_path}")
                return True
            else:
                logger.error(f"创建合集失败: {result.stderr}")
                logger.error(f"FFmpeg stdout: {result.stdout}")
                return False
                
        except Exception as e:
            logger.error(f"视频拼接异常: {str(e)}")
            return False
    
    @staticmethod
    def extract_thumbnail(video_path: Path, output_path: Path, time_offset: int = 5) -> bool:
        """
        从视频中提取缩略图
        
        Args:
            video_path: 视频文件路径
            output_path: 输出缩略图路径
            time_offset: 提取时间点（秒）
            
        Returns:
            是否成功
        """
        try:
            # 确保输出目录存在
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            # 构建FFmpeg命令
            cmd = [
                'ffmpeg',
                '-i', str(video_path),
                '-ss', str(time_offset),
                '-vframes', '1',
                '-q:v', '2',  # 高质量
                '-y',  # 覆盖输出文件
                str(output_path)
            ]
            
            # 执行命令
            result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='ignore')
            
            if result.returncode == 0 and output_path.exists():
                logger.info(f"成功提取缩略图: {output_path}")
                return True
            else:
                logger.error(f"提取缩略图失败: {result.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"提取缩略图异常: {str(e)}")
            return False
    
    @staticmethod
    def get_video_info(video_path: Path) -> Dict:
        """
        获取视频信息
        
        Args:
            video_path: 视频文件路径
            
        Returns:
            视频信息字典
        """
        try:
            ffprobe_bin = get_ffprobe_path()
            cmd = [
                ffprobe_bin,
                '-v', 'quiet',
                '-print_format', 'json',
                '-show_format',
                '-show_streams',
                str(video_path)
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='ignore')
            
            if result.returncode == 0:
                info = json.loads(result.stdout)
                return {
                    'duration': float(info['format']['duration']),
                    'size': int(info['format']['size']),
                    'bitrate': int(info['format']['bit_rate']),
                    'streams': info['streams']
                }
            else:
                logger.error(f"获取视频信息失败: {result.stderr}")
                return {}
                
        except Exception as e:
            logger.error(f"获取视频信息异常: {str(e)}")
            return {}
    
    def batch_extract_clips(
        self,
        input_video: Path,
        clips_data: List[Dict],
        aspect_ratio: str = "original",
        subtitle_preset: str = "none",
        srt_path: Optional[Path] = None,
        max_duration: int = 60,
        preferred_min_duration: int = 10,
        preferred_max_duration: int = 25,
        prioritize_viral_length: bool = True,
    ) -> List[Path]:
        """
        批量提取视频片段 com suporte a formato vertical (9:16), janela viral e legendas.

        Args:
            input_video: 输入视频路径
            clips_data: 片段数据列表，每个元素包含id、title、start_time、end_time
            aspect_ratio: 'original' | '9:16' | '16:9'
            subtitle_preset: chave em SUBTITLE_PRESETS ('none' desativa)
            srt_path: caminho do SRT para burn-in de legendas
            max_duration: duração máxima absoluta em segundos
            preferred_min_duration / preferred_max_duration: janela viral preferida
            prioritize_viral_length: se True, ignora clipes fora da janela viral

        Returns:
            Lista de caminhos dos clipes extraídos com sucesso
        """
        successful_clips = []
        use_advanced = (
            aspect_ratio != "original"
            or subtitle_preset != "none"
            or prioritize_viral_length
            or max_duration != 60
        )

        # Primeira passagem: tentar com as configurações originais
        skipped_outside_viral = []
        for clip_data in clips_data:
            clip_id = clip_data['id']
            title = clip_data.get('title', f"片段_{clip_id}")
            start_time = clip_data['start_time']
            end_time = clip_data['end_time']

            # 处理时间格式 - 如果是秒数，转换为SRT格式
            if isinstance(start_time, (int, float)):
                start_time = VideoProcessor.convert_seconds_to_ffmpeg_time(start_time)
            if isinstance(end_time, (int, float)):
                end_time = VideoProcessor.convert_seconds_to_ffmpeg_time(end_time)

            # 使用标题作为文件名，并清理不合法的字符
            # 在文件名中包含clip_id，便于后续合集拼接时查找
            safe_title = VideoProcessor.sanitize_filename(title)
            suffix = "_vertical" if aspect_ratio == "9:16" else ""
            output_path = self.clips_dir / f"{clip_id}_{safe_title}{suffix}.mp4"

            logger.info(
                f"提取切片 {clip_id}: {start_time} -> {end_time}, ratio={aspect_ratio}, "
                f"legendas={subtitle_preset}, saída: {output_path}"
            )

            if use_advanced:
                result = VideoProcessor.extract_clip_with_format(
                    input_video=input_video,
                    output_path=output_path,
                    start_time=start_time,
                    end_time=end_time,
                    aspect_ratio=aspect_ratio,
                    subtitle_preset=subtitle_preset,
                    srt_path=srt_path,
                    max_duration=max_duration,
                    preferred_min_duration=preferred_min_duration,
                    preferred_max_duration=preferred_max_duration,
                    prioritize_viral_length=prioritize_viral_length,
                )
                if result["success"]:
                    successful_clips.append(result["path"])
                    logger.info(
                        f"切片 {clip_id} 提取成功 ({result['duration']:.1f}s)"
                    )
                else:
                    reason = result.get("skipped_reason", "desconhecido")
                    logger.warning(f"切片 {clip_id} ignorado: {reason}")
                    # Rastrear clipes ignorados apenas por janela viral para fallback
                    if prioritize_viral_length and "janela viral" in reason:
                        skipped_outside_viral.append(clip_data)
            else:
                if VideoProcessor.extract_clip(input_video, output_path, start_time, end_time):
                    successful_clips.append(output_path)
                    logger.info(f"切片 {clip_id} 提取成功")
                else:
                    logger.error(f"切片 {clip_id} 提取失败")

        # Fallback: se modo viral estava ativo mas ZERO clipes foram gerados,
        # reprocessar os clipes ignorados por janela viral sem a restrição viral
        if prioritize_viral_length and len(successful_clips) == 0 and len(skipped_outside_viral) > 0:
            logger.warning(
                f"Nenhum clipe na janela viral ({preferred_min_duration}-{preferred_max_duration}s). "
                f"Fallback: gerando {len(skipped_outside_viral)} clipes dentro de max_duration={max_duration}s"
            )
            for clip_data in skipped_outside_viral:
                clip_id = clip_data['id']
                title = clip_data.get('title', f"片段_{clip_id}")
                start_time = clip_data['start_time']
                end_time = clip_data['end_time']

                if isinstance(start_time, (int, float)):
                    start_time = VideoProcessor.convert_seconds_to_ffmpeg_time(start_time)
                if isinstance(end_time, (int, float)):
                    end_time = VideoProcessor.convert_seconds_to_ffmpeg_time(end_time)

                safe_title = VideoProcessor.sanitize_filename(title)
                suffix = "_vertical" if aspect_ratio == "9:16" else ""
                output_path = self.clips_dir / f"{clip_id}_{safe_title}{suffix}.mp4"

                result = VideoProcessor.extract_clip_with_format(
                    input_video=input_video,
                    output_path=output_path,
                    start_time=start_time,
                    end_time=end_time,
                    aspect_ratio=aspect_ratio,
                    subtitle_preset=subtitle_preset,
                    srt_path=srt_path,
                    max_duration=max_duration,
                    preferred_min_duration=preferred_min_duration,
                    preferred_max_duration=preferred_max_duration,
                    prioritize_viral_length=False,  # Desativar filtro viral no fallback
                )
                if result["success"]:
                    successful_clips.append(result["path"])
                    logger.info(
                        f"[FALLBACK] 切片 {clip_id} 提取成功 ({result['duration']:.1f}s)"
                    )
                else:
                    reason = result.get("skipped_reason", "desconhecido")
                    logger.warning(f"[FALLBACK] 切片 {clip_id} ignorado: {reason}")

        return successful_clips
    
    def create_collections_from_metadata(self, collections_data: List[Dict]) -> List[Dict]:
        """
        根据元数据创建合集
        
        Args:
            collections_data: 合集数据列表
            
        Returns:
            成功创建的合集信息列表，包含视频路径和缩略图路径
        """
        successful_collections = []
        
        for collection_data in collections_data:
            collection_id = collection_data['id']
            collection_title = collection_data.get('collection_title', f'合集_{collection_id}')
            clip_ids = collection_data['clip_ids']
            
            # 构建片段路径列表
            clips_list = []
            for clip_id in clip_ids:
                # 查找对应的切片文件
                # 新的文件名格式是: {clip_id}_{title}.mp4
                clip_path = self.clips_dir / f"{clip_id}_*.mp4"
                found_clips = list(self.clips_dir.glob(f"{clip_id}_*.mp4"))
                
                if found_clips:
                    found_clip = found_clips[0]  # 取第一个匹配的文件
                    clips_list.append(found_clip)
                    logger.info(f"找到合集 {collection_id} 的切片: {found_clip.name}")
                else:
                    logger.warning(f"未找到合集 {collection_id} 的切片 {clip_id}")
            
            if clips_list:
                # 使用collection_title作为文件名，并清理不合法的字符
                safe_title = VideoProcessor.sanitize_filename(collection_title)
                output_path = self.collections_dir / f"{safe_title}.mp4"
                
                if VideoProcessor.create_collection(clips_list, output_path):
                    # 生成合集缩略图
                    thumbnail_path = None
                    try:
                        thumbnail_filename = f"{collection_id}_{safe_title}_thumbnail.jpg"
                        thumbnail_path = self.collections_dir / thumbnail_filename
                        
                        # 从视频中提取缩略图（第2秒的帧）
                        thumbnail_success = VideoProcessor.extract_thumbnail(output_path, thumbnail_path, time_offset=2)
                        if thumbnail_success:
                            logger.info(f"合集 {collection_id} 缩略图生成成功: {thumbnail_path}")
                        else:
                            logger.warning(f"合集 {collection_id} 缩略图生成失败")
                            thumbnail_path = None
                    except Exception as e:
                        logger.error(f"生成合集 {collection_id} 缩略图时出错: {e}")
                        thumbnail_path = None
                    
                    # 返回包含视频路径和缩略图路径的信息
                    collection_info = {
                        'collection_id': collection_id,
                        'video_path': str(output_path),
                        'thumbnail_path': str(thumbnail_path) if thumbnail_path else None,
                        'title': collection_title
                    }
                    successful_collections.append(collection_info)
                    logger.info(f"成功创建合集 {collection_id}: {output_path}")
            else:
                logger.warning(f"合集 {collection_id} 没有找到任何有效的切片文件")
        
        return successful_collections