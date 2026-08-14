"""เทสของ tools/nail_geometry.py — รันด้วย python ปกติ ไม่ต้องเปิด Blender

python -m unittest tools/test_nail_geometry.py
"""
import unittest

import numpy as np

from nail_geometry import (
    TAPER_START,
    base_max_displacement,
    deform_delta,
    local_frame,
    max_uv_distortion,
    project_to_uv,
    triangle_distortion,
    taper_weight,
)


def rectangular_plate(width=1.0, length=2.0, steps_along=9, steps_across=3):
    """เล็บจำลอง: แผ่นสี่เหลี่ยมผืนผ้าแบนในระนาบ XY สัดส่วนใกล้เคียงเล็บจริง (ยาวกว่ากว้าง)"""
    xs = np.linspace(-width / 2, width / 2, steps_across)
    ys = np.linspace(-length / 2, length / 2, steps_along)
    return np.array([[x, y, 0.0] for y in ys for x in xs])


class LocalFrameTests(unittest.TestCase):
    def test_finds_long_axis_along_length(self):
        centroid, axes, t01, w, d, span = local_frame(rectangular_plate())
        self.assertAlmostEqual(abs(axes[0][1]), 1.0, places=6)
        self.assertAlmostEqual(t01.min(), 0.0, places=6)
        self.assertAlmostEqual(t01.max(), 1.0, places=6)
        self.assertAlmostEqual(span, 2.0, places=6)

    def test_tip_is_narrower_end(self):
        xs_wide = np.linspace(-1.0, 1.0, 5)
        xs_narrow = np.linspace(-0.2, 0.2, 5)
        coords = np.array(
            [[x, -1.0, 0.0] for x in xs_wide] + [[x, 1.0, 0.0] for x in xs_narrow],
        )
        _, _, t01, _, _, _ = local_frame(coords)
        tip_mask = t01 > 0.9
        self.assertTrue(np.all(coords[tip_mask][:, 1] > 0))


class TaperWeightTests(unittest.TestCase):
    def test_zero_before_taper_start(self):
        t01 = np.array([0.0, 0.2, 0.44, TAPER_START])
        np.testing.assert_allclose(taper_weight(t01), 0.0)

    def test_one_at_tip(self):
        self.assertAlmostEqual(float(taper_weight(np.array([1.0]))[0]), 1.0)

    def test_monotonic_between_start_and_tip(self):
        weights = taper_weight(np.linspace(TAPER_START, 1.0, 20))
        self.assertTrue(np.all(np.diff(weights) >= 0))


class DeformTests(unittest.TestCase):
    def setUp(self):
        self.coords = rectangular_plate()

    def test_every_shape_leaves_base_still(self):
        for shape in ('almond', 'square', 'squoval', 'stiletto'):
            self.assertLess(base_max_displacement(self.coords, shape), 1e-9, 'shape=%s' % shape)

    def test_every_length_leaves_base_still(self):
        for length in ('short', 'long', 'extra'):
            self.assertLess(base_max_displacement(self.coords, length), 1e-9, 'length=%s' % length)

    def test_stiletto_moves_tip_further_than_almond(self):
        reach_almond = np.linalg.norm(deform_delta(self.coords, 'almond'), axis=1).max()
        reach_stiletto = np.linalg.norm(deform_delta(self.coords, 'stiletto'), axis=1).max()
        self.assertGreater(reach_stiletto, reach_almond)

    def test_extra_length_moves_tip_more_than_short(self):
        reach_short = np.linalg.norm(deform_delta(self.coords, 'short'), axis=1).max()
        reach_extra = np.linalg.norm(deform_delta(self.coords, 'extra'), axis=1).max()
        self.assertGreater(reach_extra, reach_short)

    def test_unknown_target_raises(self):
        with self.assertRaises(ValueError):
            deform_delta(self.coords, 'hexagon')


class ProjectToUvTests(unittest.TestCase):
    def test_preserves_aspect_ratio_not_stretched_to_square(self):
        uv = project_to_uv(rectangular_plate(width=1.0, length=2.0))
        height = uv[:, 1].max() - uv[:, 1].min()
        width = uv[:, 0].max() - uv[:, 0].min()
        self.assertAlmostEqual(height / width, 2.0, places=1)

    def test_stays_within_unit_square_with_padding(self):
        uv = project_to_uv(rectangular_plate())
        self.assertGreaterEqual(uv[:, 0].min(), 0.0)
        self.assertGreaterEqual(uv[:, 1].min(), 0.0)
        self.assertLessEqual(uv[:, 0].max(), 1.0)
        self.assertLessEqual(uv[:, 1].max(), 1.0)

    def test_tip_maps_near_top_of_panel(self):
        # ฝั่งแคบ (y=+1) คือปลายเล็บ ต้องได้ v เล็กกว่าฝั่งโคน (ปลายเล็บอยู่บนสุดของแผง)
        xs_wide = np.linspace(-1.0, 1.0, 5)
        xs_narrow = np.linspace(-0.2, 0.2, 5)
        coords = np.array(
            [[x, -1.0, 0.0] for x in xs_wide] + [[x, 1.0, 0.0] for x in xs_narrow],
        )
        uv = project_to_uv(coords)
        tip_v = uv[5:, 1].mean()
        base_v = uv[:5, 1].mean()
        self.assertLess(tip_v, base_v)


class TriangleDistortionTests(unittest.TestCase):
    def test_identity_mapping_has_no_distortion(self):
        position = np.array([[0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [0.0, 1.0, 0.0]])
        uv = np.array([[0.0, 0.0], [1.0, 0.0], [0.0, 1.0]])
        self.assertAlmostEqual(triangle_distortion(position, uv), 1.0, places=6)

    def test_stretched_uv_reports_distortion_above_one(self):
        position = np.array([[0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [0.0, 1.0, 0.0]])
        uv = np.array([[0.0, 0.0], [0.5, 0.0], [0.0, 1.0]])
        self.assertAlmostEqual(triangle_distortion(position, uv), 2.0, places=6)

    def test_degenerate_triangle_returns_none(self):
        position = np.array([[0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [2.0, 0.0, 0.0]])
        uv = np.array([[0.0, 0.0], [1.0, 0.0], [2.0, 0.0]])
        self.assertIsNone(triangle_distortion(position, uv))


class MaxUvDistortionTests(unittest.TestCase):
    def test_reports_worst_triangle_not_average(self):
        coords = np.array([[0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [1.0, 1.0, 0.0]])
        good_uv = np.array([[0.0, 0.0], [1.0, 0.0], [0.0, 1.0], [1.0, 1.0]])
        bad_uv = np.array([[0.0, 0.0], [1.0, 0.0], [0.0, 1.0], [0.5, 1.0]])
        indices = [0, 1, 2, 1, 3, 2]
        self.assertAlmostEqual(max_uv_distortion(coords, good_uv, indices), 1.0, places=6)
        self.assertGreater(max_uv_distortion(coords, bad_uv, indices), 1.0)


if __name__ == '__main__':
    unittest.main()
