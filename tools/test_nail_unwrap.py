import unittest

from nail_unwrap import FINGERS


class TestFingers(unittest.TestCase):
    def test_ครบห้านิ้วเรียงจากโป้งไปก้อย(self):
        self.assertEqual(FINGERS, ('thumb', 'index', 'middle', 'ring', 'little'))

    def test_ไม่มีชื่อซ้ำ(self):
        self.assertEqual(len(set(FINGERS)), len(FINGERS))


if __name__ == '__main__':
    unittest.main()
