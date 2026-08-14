"""ชื่อนิ้วที่ pipeline กับเว็บใช้ร่วมกัน — ไม่ import bpy จึงเทสได้ด้วย python ปกติ

เคยมีคณิตศาสตร์ unwrap อยู่ในไฟล์นี้ (local_frame, orient_frame, project_to_uv,
group_islands_by_finger) ซึ่งมีไว้กาง UV ให้เล็บที่ปั้นเองจากโมเดลเก่า โมเดลใหม่
มี UV กางเต็ม 0-1 มาให้ทุกเล็บอยู่แล้ว โค้ดชุดนั้นจึงถูกลบทิ้งทั้งหมด
"""
FINGERS = ('thumb', 'index', 'middle', 'ring', 'little')
