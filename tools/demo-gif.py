# -*- coding: utf-8 -*-
"""Macht aus den Einzelbildern von tools/make-demo.mjs das GIF.

Aufruf (make-demo.mjs tut das selbst):
    python3 tools/demo-gif.py <bilder> <ziel.gif> <breite> <ms-je-bild>

Ein GIF kennt 256 Farben. Damit es trotzdem nicht posterisiert aussieht und
klein bleibt, drei Entscheidungen:

  * Eine Palette fuer alle Bilder. Mit einer eigenen je Bild bekaeme jede
    unveraenderte Flaeche in jedem Bild einen leicht anderen Ton, und das
    GIF muesste jedes Bild ganz speichern statt nur seiner Aenderungen –
    ueber 17 MB statt anderthalb.
  * Die Flaechenfarben der Oberflaeche exakt. Median-Cut mittelt, und aus
    Papierweiss wurde ein Cremeton, aus den Farbfeldern im Design-Reiter
    ein Graugruen. Die 128 haeufigsten exakten Farben bekommen deshalb je
    einen eigenen Platz und werden nie gerastert; die andere Haelfte der
    Palette bekommen Fotos und Kantenglaettung.
  * Fotos und Verlaeufe fein gerastert, geordnet (Bayer) statt mit
    Fehlerstreuung: das Muster haengt nur an der Position, eine
    unveraenderte Flaeche bleibt von Bild zu Bild gleich.

Die Zuordnung zur Palette rechnet numpy selbst. Pillows eigene nimmt einen
Zwischenspeicher mit verminderter Genauigkeit und machte aus reinem Weiss
wieder den Cremeton daneben.
"""
import glob
import sys

import numpy as np
from PIL import Image

AMPLITUDE = 6.0
FLAT_COLORS = 128
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0 - 0.47


def codes(rgb):
    return (rgb[..., 0].astype(np.int64) << 16) | (rgb[..., 1].astype(np.int64) << 8) | rgb[..., 2]


def main(source, target, width, duration):
    files = sorted(glob.glob(source + "/*.png"))
    frames = []
    for name in files:
        image = Image.open(name).convert("RGB")
        height = round(image.height * width / image.width)
        frames.append(np.asarray(image.resize((width, height), Image.LANCZOS)))
    height = frames[0].shape[0]

    #  Jedes vierte Bild: auch was nur kurz zu sehen ist – ein Dialog, die
    #  Farbfelder im Design-Reiter – soll in der Palette vorkommen.
    picks = list(range(0, len(frames), 4))
    sample = np.concatenate([frames[i] for i in picks], axis=0)
    sample_codes = codes(sample).ravel()

    #  Eine Flaechenfarbe ist eine, die als Flaeche vorkommt: ein Punkt, der
    #  seinem rechten und seinem unteren Nachbarn gleicht. Die Zwischentoene
    #  der Kantenglaettung bilden fast nie solche Bloecke – nach blosser
    #  Haeufigkeit verdraengten sie die kleinen Farbfelder aus der Palette.
    grid = codes(sample)
    solid = (grid[:-1, :-1] == grid[:-1, 1:]) & (grid[:-1, :-1] == grid[1:, :-1])
    solid_codes = grid[:-1, :-1][solid]

    #  Die Palette in zwei Haelften: die haeufigsten exakten Farben – Papier,
    #  Hintergrund, Akzent, die Farbfelder im Design-Reiter – bekommen je
    #  einen eigenen Platz; der Rest geht an Median-Cut fuer das, was keine
    #  Flaeche ist, also Fotos und Kantenglaettung.
    values, counts = np.unique(solid_codes, return_counts=True)
    order = np.argsort(counts)[::-1]
    flat = values[order[:FLAT_COLORS]]
    flat = flat[counts[order[:FLAT_COLORS]] >= 30]
    rest = sample.reshape(-1, 3)[~np.isin(sample_codes, flat)]
    side = int(np.ceil(np.sqrt(len(rest))))
    padded = np.zeros((side * side, 3), dtype=np.uint8)
    padded[:len(rest)] = rest
    padded[len(rest):] = rest[0] if len(rest) else 0
    median = Image.fromarray(padded.reshape(side, side, 3)).quantize(
        colors=256 - len(flat), method=Image.Quantize.MEDIANCUT)
    soft = np.array(median.getpalette()[:3 * (256 - len(flat))]).reshape(-1, 3)
    exact = np.stack([(flat >> 16) & 255, (flat >> 8) & 255, flat & 255], axis=1)
    palette = np.concatenate([exact, soft], axis=0)[:256]
    if len(palette) < 256:
        palette = np.concatenate([palette, np.zeros((256 - len(palette), 3), dtype=palette.dtype)])
    palette_bytes = palette.astype(np.uint8).ravel().tolist()

    tile = np.tile(BAYER, (height // 4 + 1, width // 4 + 1))[:height, :width][..., None] * AMPLITUDE
    lookup = {}

    output = []
    for raw in frames:
        keep = np.isin(codes(raw), flat)[..., None]
        shifted = np.where(keep, raw, np.clip(raw.astype(np.float32) + tile, 0, 255)).astype(np.uint8)
        unique, inverse = np.unique(codes(shifted).ravel(), return_inverse=True)
        missing = [code for code in unique if code not in lookup]
        if missing:
            rgb = np.stack([(np.array(missing) >> 16) & 255, (np.array(missing) >> 8) & 255,
                            np.array(missing) & 255], axis=1)
            nearest = ((rgb[:, None, :] - palette[None, :, :]) ** 2).sum(axis=2).argmin(axis=1)
            lookup.update(zip(missing, nearest.tolist()))
        indices = np.array([lookup[code] for code in unique], dtype=np.uint8)[inverse]
        image = Image.fromarray(indices.reshape(height, width), "P")
        image.putpalette(palette_bytes)
        output.append(image)

    output[0].save(target, save_all=True, append_images=output[1:], duration=duration,
                   loop=0, optimize=True, disposal=1)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]))
