from dataclasses import dataclass

import numpy as np
import numpy.typing as npt
from scipy import ndimage, signal

FINGERPRINT_SAMPLE_RATE_HZ = 8000
FINGERPRINT_ALGORITHM_VERSION = 1
FRAME_LENGTH_SAMPLES = 1024
HOP_LENGTH_SAMPLES = 256
PEAK_NEIGHBOURHOOD_FREQUENCY_BINS = 21
PEAK_NEIGHBOURHOOD_FRAMES = 11
MAXIMUM_PEAKS_PER_SECOND = 18
TARGET_ZONE_MINIMUM_FRAMES = 1
TARGET_ZONE_MAXIMUM_FRAMES = 63
TARGET_ZONE_MAXIMUM_FREQUENCY_BINS = 96
PAIRS_PER_ANCHOR_PEAK = 4
MINIMUM_SIGNAL_ROOT_MEAN_SQUARE = 1e-4
SECONDS_PER_FRAME = HOP_LENGTH_SAMPLES / FINGERPRINT_SAMPLE_RATE_HZ


@dataclass(frozen=True, slots=True)
class AudioLandmark:
    landmark_hash: int
    anchor_frame: int


@dataclass(frozen=True, slots=True)
class AudioFingerprint:
    landmarks: list[AudioLandmark]
    duration_seconds: float


class AudioTooQuietOrShortError(ValueError):
    pass


def decode_signed_16_bit_little_endian_pcm(pcm_bytes: bytes) -> npt.NDArray[np.float64]:
    if len(pcm_bytes) % 2 != 0:
        raise ValueError("pcm byte length must be even for 16-bit samples")
    samples = np.frombuffer(pcm_bytes, dtype="<i2").astype(np.float64) / 32768.0
    return samples - samples.mean() if samples.size else samples


def calculate_log_magnitude_spectrogram(samples: npt.NDArray[np.float64]) -> npt.NDArray[np.float64]:
    _frequencies, _times, complex_spectrogram = signal.stft(
        samples,
        fs=FINGERPRINT_SAMPLE_RATE_HZ,
        window="hann",
        nperseg=FRAME_LENGTH_SAMPLES,
        noverlap=FRAME_LENGTH_SAMPLES - HOP_LENGTH_SAMPLES,
        boundary=None,
        padded=False,
    )
    magnitude = np.abs(complex_spectrogram)
    return np.asarray(np.log(magnitude + 1e-10), dtype=np.float64)


def find_spectral_peaks(log_spectrogram: npt.NDArray[np.float64], duration_seconds: float) -> list[tuple[int, int]]:
    neighbourhood_maximum = ndimage.maximum_filter(
        log_spectrogram,
        size=(PEAK_NEIGHBOURHOOD_FREQUENCY_BINS, PEAK_NEIGHBOURHOOD_FRAMES),
        mode="constant",
        cval=-np.inf,
    )
    loudness_floor = np.median(log_spectrogram) + 2.0
    is_peak = (log_spectrogram == neighbourhood_maximum) & (log_spectrogram > loudness_floor)
    frequency_bins, frame_indices = np.nonzero(is_peak)
    if frequency_bins.size == 0:
        return []
    peak_strengths = log_spectrogram[frequency_bins, frame_indices]
    maximum_peak_count = max(int(duration_seconds * MAXIMUM_PEAKS_PER_SECOND), 1)
    strongest = np.argsort(-peak_strengths, kind="stable")[:maximum_peak_count]
    chosen = sorted(zip(frame_indices[strongest].tolist(), frequency_bins[strongest].tolist(), strict=True))
    return [(int(frame), int(frequency)) for frame, frequency in chosen]


def pack_landmark_hash(anchor_frequency_bin: int, target_frequency_bin: int, frame_delta: int) -> int:
    return (anchor_frequency_bin << 16) | (target_frequency_bin << 6) | frame_delta


def pair_peaks_into_landmarks(peaks: list[tuple[int, int]]) -> list[AudioLandmark]:
    landmarks: list[AudioLandmark] = []
    for anchor_index, (anchor_frame, anchor_frequency) in enumerate(peaks):
        paired_count = 0
        for target_frame, target_frequency in peaks[anchor_index + 1 :]:
            frame_delta = target_frame - anchor_frame
            if frame_delta > TARGET_ZONE_MAXIMUM_FRAMES:
                break
            if frame_delta < TARGET_ZONE_MINIMUM_FRAMES:
                continue
            if abs(target_frequency - anchor_frequency) > TARGET_ZONE_MAXIMUM_FREQUENCY_BINS:
                continue
            landmarks.append(
                AudioLandmark(pack_landmark_hash(anchor_frequency, target_frequency, frame_delta), anchor_frame)
            )
            paired_count += 1
            if paired_count >= PAIRS_PER_ANCHOR_PEAK:
                break
    return landmarks


def compute_audio_fingerprint(pcm_bytes: bytes, minimum_duration_seconds: float) -> AudioFingerprint:
    samples = decode_signed_16_bit_little_endian_pcm(pcm_bytes)
    duration_seconds = samples.size / FINGERPRINT_SAMPLE_RATE_HZ
    if duration_seconds < minimum_duration_seconds:
        raise AudioTooQuietOrShortError("audio excerpt is too short")
    if float(np.sqrt(np.mean(samples**2))) < MINIMUM_SIGNAL_ROOT_MEAN_SQUARE:
        raise AudioTooQuietOrShortError("audio excerpt is silent")
    peaks = find_spectral_peaks(calculate_log_magnitude_spectrogram(samples), duration_seconds)
    return AudioFingerprint(pair_peaks_into_landmarks(peaks), round(duration_seconds, 3))
