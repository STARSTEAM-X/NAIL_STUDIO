# Algorithm Design & Complexity — NAIL STUDIO 3D

เอกสารนี้บันทึกอัลกอริทึมสำคัญทุกตัวในระบบตามรูปแบบที่โจทย์กำหนด

**กติกาของเอกสารนี้**

1. ทุกความซับซ้อนต้องอธิบายได้จากโค้ดจริง ไม่ใช่การอ้างลอย ๆ
2. อัลกอริทึมที่แย่กว่า O(n) ต้องมีเหตุผลครบ 6 ข้อตามที่โจทย์กำหนด
3. ช่อง **Benchmark** ที่เขียนว่า `ยังไม่ได้วัด` คือยังไม่ได้วัดจริง — จะเติมใน Phase 14 พร้อมวิธีวัดใน `docs/performance.md`
4. ตัวเลขที่วัดได้แล้ว (เช่น จำนวนสามเหลี่ยมของโมเดล) ระบุวิธีวัดกำกับเสมอ

## นิยามตัวแปรที่ใช้ทั้งเอกสาร

| ตัวแปร | ความหมาย | ขอบเขตจริงในระบบ |
|---|---|---|
| `N` | จำนวนเล็บทั้งหมด | **10** (คงที่) |
| `k` | จำนวนเล็บ/วัตถุที่ **เปลี่ยนจริง** ในการกระทำหนึ่งครั้ง | 1–10 |
| `L` | จำนวนเลเยอร์ต่อเล็บ | ≤ 6 (`MAX_LAYERS`) |
| `S` | จำนวน stroke ต่อเลเยอร์ | ไม่จำกัด (ในทางปฏิบัติ < 500) |
| `n` | จำนวนจุดของ stroke หนึ่งเส้น | 1 – ~2,000 (ตามความยาวการลาก) |
| `V` | จำนวน vertex ของ mesh หนึ่งชิ้น | เล็บ 81–289, มือ **64,074** (วัดได้) |
| `T` | จำนวนสามเหลี่ยมของ mesh | เล็บ 128–512, มือ **118,756** (วัดได้) |
| `D` | จำนวนของตกแต่งต่อเล็บ | ≤ 30 (`MAX_DECORATIONS`) |
| `H` | ความลึกของ history stack | ≤ 100 |
| `P` | จำนวนโปรเจกต์ของผู้ใช้หนึ่งคน | ไม่จำกัด |

---

## A-01 — Andrew's Monotone Chain (Convex Hull)

```
Algorithm:  Andrew's Monotone Chain
Purpose:    หาเส้นขอบนอก (outline) ของเล็บในพิกัด UV เพื่อ (1) วาดกรอบเล็บใน
            แผง 2D (2) ตัดการวาดที่หลุดออกนอกเล็บ (3) จำกัดพื้นที่วางของตกแต่ง
Location:   apps/web/src/3d/geometry/hull.ts   (ยกมาจาก NailDesine-TEST/src/nail/hull.ts)
Input:      Pt2[] — พิกัด UV ของทุก vertex ของเล็บหนึ่งชิ้น (V = 81–289 จุด)
Output:     Pt2[] — จุดยอดของ convex hull เรียงทวนเข็มนาฬิกา

Time Complexity:
  Best Case:     Ω(V log V)   — ต้นทุนการเรียงลำดับเป็นพื้น หลีกเลี่ยงไม่ได้
  Average Case:  Θ(V log V)
  Worst Case:    O(V log V)   — การสร้าง chain เป็น O(V) amortized
                                (แต่ละจุดถูก push 1 ครั้งและ pop ได้ไม่เกิน 1 ครั้ง)

Space Complexity: O(V)  — อาร์เรย์ที่เรียงแล้ว + chain สองเส้น

Why selected:
  - เป็นอัลกอริทึม convex hull ที่ง่ายที่สุดที่ยัง optimal (Ω(n log n) คือขอบล่าง
    ที่พิสูจน์ได้ของปัญหา convex hull แบบเปรียบเทียบ)
  - implementation สั้น 30 บรรทัด ไม่มี edge case แปลก ๆ เรื่องมุม (ไม่ต้องใช้ atan2)
  - เสถียรเชิงตัวเลข: ใช้ cross product ล้วน ไม่มีการหาร

ทำไมยอมให้แย่กว่า O(n) (ตามข้อกำหนดโจทย์):
  1. เป็น preprocessing แท้ ๆ — รันครั้งเดียวตอนโหลดโมเดล ไม่ได้รันในลูปวาดภาพ
  2. ผลลัพธ์ถูก cache ไว้ทั้ง session (outline ไม่เปลี่ยนถ้า UV ไม่เปลี่ยน)
  3. input มีขอบเขตแน่นอน: มากสุด 289 จุด → 289·log₂289 ≈ 2,360 การเปรียบเทียบ
  4. ไม่มีทางเลือก O(n): ขอบล่างของปัญหานี้คือ Ω(n log n) (reduction จาก sorting)
  5. ทางเลือก O(n) มีเฉพาะเมื่อจุดถูกเรียงมาก่อนแล้ว ซึ่ง UV จาก GLB ไม่ได้เรียง
  6. ความถี่การรัน: 10 ครั้งต่อการเปิด editor 1 ครั้ง

Alternative considered:
  (ก) Graham Scan — O(n log n) เท่ากัน แต่ต้องหา pivot + เรียงตามมุม (atan2)
      ซึ่งช้ากว่าและมีปัญหาความแม่นยำ floating point เมื่อจุดเกือบชนกัน
  (ข) Gift Wrapping (Jarvis March) — O(n·h) ที่ h = จำนวนจุดบน hull
      ดีถ้า h เล็กมาก แต่เล็บเป็นรูปโค้ง h อาจใกล้ n → กลายเป็น O(n²)
  (ค) Quickhull — เฉลี่ย O(n log n) แต่ worst case O(n²)
  (ง) ใช้ bounding box แทน — O(n) แต่กรอบสี่เหลี่ยมไม่ตรงกับรูปเล็บที่โค้ง

Why alternative was rejected:
  (ก) ซับซ้อนกว่าโดยไม่ได้เร็วกว่า  (ข)(ค) worst case แย่กว่า
  (ง) ความถูกต้องไม่พอ — จะยอมให้วาดนอกเล็บได้ถึง ~30% ของพื้นที่กรอบ

Benchmark: ยังไม่ได้วัด — จะวัดใน Phase 14
           แผนการวัด: V = 81 / 289 / 5,000 (สังเคราะห์) × 1,000 รอบ, วัดด้วย
           performance.now(), รายงาน median + p95
```

---

## A-02 — Douglas–Peucker แบบถ่วงน้ำหนักแรงกด (Pressure-Weighted)

```
Algorithm:  Ramer–Douglas–Peucker ดัดแปลง (เพิ่มมิติแรงกดเข้าในการวัดค่าเบี่ยงเบน)
Purpose:    ลดจำนวนจุดของเส้นที่ผู้ใช้ลาก ก่อนบันทึกลงเอกสารงาน
            → ไฟล์งานเล็กลง, replay เร็วขึ้น, ส่งขึ้น API เบาลง
Location:   apps/web/src/3d/painting/simplify.ts
Input:      Point[] (x, y ในพิกัด UV, p = แรงกด 0–1), tolerance = 0.004
Output:     Point[] ชุดย่อยที่คงรูปเส้นเดิมภายใน tolerance

Time Complexity:
  Best Case:     Ω(n)      — ทุกจุดอยู่บนเส้นตรง แบ่งครั้งเดียวจบ
  Average Case:  Θ(n log n) — การแบ่งสมดุลโดยประมาณ (T(n)=2T(n/2)+O(n))
  Worst Case:    O(n²)     — จุดที่ไกลสุดอยู่ติดปลายทุกครั้ง (เส้นก้นหอย)

Space Complexity: O(n) — อาร์เรย์ keep[] + explicit stack (ไม่ใช้ recursion จึง
                  ไม่มีความเสี่ยง stack overflow กับเส้นยาว)

Why selected:
  - ให้ผลลัพธ์ที่ "ตามนุษย์มองไม่ออกว่าถูกลดจุด" ที่อัตราการบีบสูง เพราะเก็บจุด
    ที่มีความสำคัญทางรูปทรง (จุดหักเลี้ยว) ไว้เสมอ
  - เวอร์ชันในโปรเจกต์นี้ **ดัดแปลงเอง**: ค่าเบี่ยงเบนของจุดหนึ่ง =
        max(ระยะตั้งฉากจากเส้น, |แรงกดจริง − แรงกดที่ควรเป็น| × 0.02)
    เพราะแรงกดคุมรัศมีแปรง ถ้าตัดจุดที่แรงกดพุ่งขึ้นกลางเส้นทิ้ง เส้นที่ replay
    จะได้รูปคนละแบบกับที่ผู้ใช้เห็นตอนลาก (บั๊กที่ซอร์สเดิมเคยเจอและแก้ไว้)
  - ค่า PRESSURE_WEIGHT = 0.02 หมายถึง "แรงกดเพี้ยนเต็มสเกล 1.0 มีน้ำหนักเท่ากับ
    จุดที่เบี่ยงออกจากเส้น 0.02 หน่วย UV"

ทำไมยอมให้แย่กว่า O(n):
  1. รันครั้งเดียวตอน pointerup เท่านั้น (ไม่ใช่ทุก pointermove)
  2. ผลลัพธ์ถูกใช้ซ้ำตลอดอายุงาน (ทุกครั้งที่ replay/โหลดกลับ)
  3. n มีขอบเขตจากธรรมชาติของการลาก: ~120 Hz × 3 วินาที ≈ 360 จุด
     กรณีสุดโต่งที่ทดสอบไว้ ≈ 2,000 จุด
  4. average case จริงคือ Θ(n log n) — worst case O(n²) ต้องการรูปแบบจุดเฉพาะ
     ที่แทบไม่เกิดจากการลากมือจริง
  5. ทางเลือก O(n) (Radial Distance) ให้คุณภาพเส้นแย่กว่าอย่างเห็นได้ชัด
  6. ที่ n = 2,000 worst case = 4×10⁶ operations ≈ ไม่กี่ ms บน CPU สมัยใหม่
     และเกิดหลังผู้ใช้ปล่อยนิ้วแล้ว (ไม่กระทบ interactive latency)

Alternative considered:
  (ก) Radial Distance / Nth-point decimation — O(n) แต่ตัดจุดหักมุมทิ้ง
  (ข) Visvalingam–Whyatt — O(n log n) ด้วย heap, คุณภาพดีที่การบีบสูงมาก
  (ค) Chaikin / B-spline fitting — O(n) แต่เปลี่ยนรูปเส้น (ไม่ผ่านจุดเดิม)
  (ง) ไม่ลดจุดเลย — O(1)

Why alternative was rejected:
  (ก) มุมแหลมของลายเล็บ (เช่น ลายดาว) จะถูกปาดทิ้ง — คุณภาพงานลด
  (ข) ให้ผลใกล้เคียงกันแต่ต้องดูแล heap เพิ่ม และผสมมิติ "แรงกด" เข้าไปยากกว่า
  (ค) เส้นจะไม่ผ่านจุดที่ผู้ใช้ลากจริง = ผิดเจตนา
  (ง) ไฟล์งานใหญ่ 5–10 เท่า และ replay ตอนโหลดช้าตาม

Benchmark: ยังไม่ได้วัด — Phase 14
           แผนการวัด: n = 100 / 500 / 2000 จุดจากการลากจริงที่บันทึกไว้
           รายงาน: เวลา, อัตราการบีบ (จุดเหลือ/จุดเดิม), ค่า Hausdorff distance
           ระหว่างเส้นเดิมกับเส้นที่ลดแล้ว
```

---

## A-03 — Arc-Length Resampling (Path → Dabs)

```
Algorithm:  Arc-length resampling พร้อม carry ข้ามช่วง (stateful spacing)
Purpose:    แปลง "จุดที่ pointer ส่งมา" เป็น "จุดแต้มสี (dab)" ที่ระยะห่างเท่ากัน
            ตลอดเส้น — เป็นหัวใจที่ทำให้เส้นดูสม่ำเสมอไม่ว่าจะลากเร็วหรือช้า
Location:   apps/web/src/3d/painting/brush.ts  (pathToDabs)
Input:      Point[] (n จุด), size, opacity, spacing, texSize, minPressure
Output:     Dab[] (x, y เป็นพิกเซล, r = รัศมี, alpha)

Time Complexity:
  Best/Average/Worst:  Θ(n + L/step)
    n     = จำนวนจุด input
    L     = ความยาวเส้นรวมในหน่วยพิกเซล
    step  = max(0.5, spacing × size) พิกเซล
  → เชิงเส้นต่อขนาด output ซึ่งเป็นขอบล่างที่หลีกเลี่ยงไม่ได้ (ต้องสร้าง dab ทุกตัว)

Space Complexity: O(n + L/step) — อาร์เรย์ pixels + อาร์เรย์ dabs

Why selected:
  - เดิน segment ทีละคู่แล้วเดินตามความยาวส่วนโค้ง ทำให้ระยะห่าง dab คงที่
    ไม่ขึ้นกับความถี่ที่เบราว์เซอร์ส่ง pointermove (ซึ่งต่างกัน 60–1000 Hz
    ระหว่างอุปกรณ์) — ถ้าไม่ทำ เส้นที่ลากเร็วจะขาดเป็นจุด ๆ
  - ตัวแปร `carry` เก็บ "เศษระยะ" ข้ามรอยต่อของ segment ถ้าไม่มี ระยะห่าง dab
    ตรงหัวมุมจะสั้นผิดปกติจนสีเข้มเป็นจุด
  - แรงกดถูก interpolate เชิงเส้นระหว่างสองจุด → รัศมีเปลี่ยนนุ่มนวล

Alternative considered:
  (ก) แต้ม dab ที่ตำแหน่ง pointer ตรง ๆ — O(n) เร็วกว่า
  (ข) วาดด้วย ctx.lineTo + stroke() — O(n) ใช้ GPU/Skia ของเบราว์เซอร์
  (ค) Catmull-Rom spline ก่อน resample — คุณภาพสูงกว่า, O(n + L/step) เท่ากัน

Why alternative was rejected:
  (ก) คุณภาพเส้นขึ้นกับความเร็วมือและอุปกรณ์ — ผลลัพธ์ไม่คงเส้นคงวา
  (ข) ทำ soft brush / airbrush / รัศมีแปรผันตามแรงกดไม่ได้ (lineWidth คงที่ต่อ path)
  (ค) **ยังเปิดไว้เป็นงานปรับปรุงในอนาคต** — ให้เส้นโค้งเนียนขึ้นตอนลากเร็ว
      แต่ยังไม่ทำในเฟสแรกเพราะเพิ่มความซับซ้อนโดยที่ยังไม่มีข้อมูลว่าผู้ใช้บ่น

Benchmark: ยังไม่ได้วัด — Phase 14 (วัดร่วมกับ A-05 เพราะเป็นคู่หูกัน)
```

---

## A-04 — Incremental Layer Rendering (Append-Only Stroke Cache)

```
Algorithm:  แคชแคนวาสต่อเลเยอร์ + ตรวจ identity ของ stroke ตัวสุดท้ายเพื่อ render ส่วนต่าง
Purpose:    หลีกเลี่ยงการ replay ทุก stroke ใหม่ทุกครั้งที่มีการเปลี่ยนแปลง
Location:   apps/web/src/3d/painting/NailTextureSet.ts  (layerSurface)
Input:      nailKey, Layer { id, strokes[] }
Output:     Surface (แคนวาส 1024² ที่วาดเสร็จแล้ว)

หลักการ:
  เก็บ { count: จำนวนที่วาดไปแล้ว, last: stroke ตัวสุดท้ายที่วาดไปแล้ว } ไว้ในแคช
  ถ้า  count ≤ length  และ  layer.strokes[count - 1] === cache.last
       → เป็นการต่อท้าย วาดเฉพาะ stroke ตัวที่ [count .. length)   → O(Δ)
  ถ้าไม่ใช่ (undo/redo/ลบ stroke/โหลดงานใหม่)
       → วาดใหม่ทั้งเลเยอร์                                        → O(S)

  แก้จากแบบเดิมที่เทียบ identity ของ "อาร์เรย์" (cache.strokes === layer.strokes):
  แบบเดิมใช้ไม่ได้กับ store ที่แก้เอกสารด้วยการสร้างใหม่ (immutable update) เพราะ
  การต่อ stroke หนึ่งเส้นให้อาร์เรย์ก้อนใหม่เสมอ การเทียบจึงไม่ผ่านทุกครั้ง แล้ว
  ทุกเส้นที่วาดจะกลายเป็นการ replay ทั้งเลเยอร์ — คือไม่ได้ประโยชน์อะไรจากแคชเลย
  การเทียบ stroke ตัวสุดท้ายยังเป็น O(1) เท่าเดิม แต่ถูกต้องกับ immutable update

Time Complexity:
  Best Case:     Ω(1)      — ไม่มี stroke ใหม่ (Δ = 0)
  Average Case:  Θ(Δ)      — Δ = จำนวน stroke ที่เพิ่มเข้ามา (ปกติ = 1)
  Worst Case:    O(S · n̄)  — ต้อง replay ทั้งเลเยอร์ (เกิดตอน undo เท่านั้น)
                             S = stroke ต่อเลเยอร์, n̄ = จุดเฉลี่ยต่อ stroke

Space Complexity: O(min(cachedLayers, MAX_LAYER_SURFACES) × TEX_SIZE²)
                  = 12 × 1024² × 4 bytes ≈ 50 MB สูงสุด (เพดานที่ตั้งไว้)
                  รวม composite ของเล็บที่มองเห็น 5 ใบ + wet/scratch 2 ใบ ≈ 80 MB

Why selected:
  - โดยไม่มีแคชนี้ ทุกครั้งที่ผู้ใช้วาดเส้นที่ 200 ระบบต้อง replay 200 เส้น
    → ต้นทุนโตแบบ O(S²) เมื่อวาดสะสม ซึ่งจะทำให้ editor ช้าลงเรื่อย ๆ ตามงาน
  - การเทียบด้วย identity (===) เป็น O(1) และปลอดภัยด้านความถูกต้อง: ถ้าเทียบไม่ผ่าน
    ผลที่ได้คือวาดใหม่ทั้งเลเยอร์ ซึ่งช้ากว่าแต่ยังถูกต้องเสมอ ไม่มีทางได้ภาพผิด
  - ต้นทุนหน่วยความจำถูกคุมด้วย eviction (A-06)

Alternative considered:
  (ก) replay ทั้งหมดทุกครั้ง — O(S) ต่อครั้ง, หน่วยความจำ O(1)
  (ข) เก็บ ImageData snapshot ต่อ stroke — undo เร็วมาก แต่กิน 4 MB/stroke
  (ค) เปรียบเทียบ deep equality ของ strokes — O(S) ต่อการเช็ค ซึ่งฆ่าประโยชน์ทิ้ง
  (ง) วาดทุกเลเยอร์ลงแคนวาสเดียว ไม่แยกเลเยอร์ — ทำ opacity/blend ต่อเลเยอร์ไม่ได้

Why alternative was rejected:
  (ก) ประสิทธิภาพเสื่อมตามปริมาณงานของผู้ใช้ ซึ่งเป็นสิ่งที่ยอมรับไม่ได้
  (ข) 200 stroke × 4 MB = 800 MB — เกินหน่วยความจำเบราว์เซอร์
  (ค) ขัดวัตถุประสงค์  (ง) เสียฟีเจอร์เลเยอร์

Benchmark: ยังไม่ได้วัดเป็นตัวเลข — Slice 8
           ยืนยันเชิงพฤติกรรมแล้วใน NailTextureSet.test.ts: การเพิ่มเส้นที่สอง
           ทำให้เกิดคำสั่งวาดเท่ากับ "หนึ่งเส้น" พอดี และไม่มีการล้างแคนวาสก่อน
           (การล้างคือสัญญาณของการ replay ทั้งเลเยอร์)
           แผนการวัด: เปรียบเทียบ "เวลาต่อการ commit เส้นที่ i" ระหว่างเปิด/ปิดแคช
           ที่ i = 1, 50, 100, 200 → คาดหวังกราฟแบน vs กราฟเชิงเส้น
```

---

## A-05 — Batched Radial Gradient Dab Drawing

```
Algorithm:  สร้าง radial gradient หนึ่งครั้งต่อเส้น แล้วใช้ transform scale ซ้ำ
Purpose:    ลดต้นทุนการสร้าง gradient object ของ Canvas2D ซึ่งเป็น allocation
            ที่แพงและเกิดหลายหมื่นครั้งต่อการ replay หนึ่งรอบ
Location:   apps/web/src/3d/painting/rasterizer.ts  (drawDabs)
Input:      Dab[], color, softness
Output:     — (วาดลง context)

Time Complexity:
  Θ(d) โดย d = จำนวน dab  — ค่าคงที่ต่อ dab ลดลงมาก (จาก 1 gradient allocation
  เหลือ 1 save/translate/scale/arc/fill/restore)

Space Complexity: O(1) — gradient object เดียวต่อการเรียก

หลักการ:
  radial gradient เป็นวงกลมสมมาตรรอบจุดกำเนิด → การ scale ด้วย transform
  ให้ผลเท่ากับการสร้าง gradient ใหม่ที่รัศมีนั้นทุกประการ
  จึงสร้างที่ UNIT_RADIUS = 64 ครั้งเดียว แล้ว scale = dab.r / 64

  กรณี softness ≤ 0.02 ข้ามระบบ gradient ไปใช้ fillStyle สีทึบตรง ๆ (เร็วกว่าอีก)

Why selected:
  - เป็นการ optimize ที่ **ไม่เปลี่ยนผลลัพธ์ภาพเลย** (พิสูจน์ได้จากความสมมาตร)
  - เป็นคอขวดที่ซอร์สเดิมระบุไว้ชัดเจนว่าเป็น "ต้นทุนหลักของการสลับเล็บ"

Alternative considered:
  (ก) สร้าง gradient ใหม่ทุก dab (โค้ดเดิมก่อน optimize)
  (ข) สร้าง sprite/offscreen canvas ของหัวแปรงแล้ว drawImage
  (ค) ย้ายไป WebGL shader

Why alternative was rejected:
  (ก) คือปัญหาที่กำลังแก้
  (ข) **น่าสนใจและอาจเร็วกว่า** — drawImage ของ sprite ที่ cache ไว้มักเร็วกว่า
      fill+gradient แต่ต้องมี sprite หลายขนาดหรือยอมรับ resample artifact
      → เก็บไว้เป็นทางเลือกที่ต้อง **วัดเทียบ** ใน Phase 14 ก่อนตัดสินใจ
  (ค) เกินขอบเขต ต้องเขียน blending pipeline เองทั้งหมด และทำ erase
      (destination-out) ยากขึ้นมาก

Benchmark: ยังไม่ได้วัด — Phase 14
           แผนการวัด: วาด 10,000 dab ด้วย 3 วิธี (gradient ต่อ dab / gradient
           ร่วม+transform / sprite drawImage) วัดเวลารวมและตรวจ pixel diff
```

---

## A-06 — Layer Surface Eviction (Cold-First)

```
Algorithm:  logical clock + เลือกเล็บที่ "เย็นที่สุด" ทิ้งก่อน (คล้าย LRU ระดับเล็บ)
Purpose:    คุมหน่วยความจำของแคนวาส 1024² ไม่ให้เกินเพดาน
Location:   apps/web/src/3d/painting/NailTextureSet.ts  (evictColdSurfaces)
Input:      layerCache: Map<`${nailId}:${layerId}`, LayerCache>, nailTouch: Map<NailId, number>
Output:     — (ลบรายการออกจาก Map)

Time Complexity:
  ปัจจุบัน:  O(N log N + C)  โดย N = จำนวนเล็บ (10), C = ขนาด cache (≤ 60)
             — มาจาก [...entries].sort() ทุกครั้งที่เกินเพดาน
  ที่เสนอ:   O(N + C) ด้วยการหา min แบบเดินครั้งเดียว (ไม่ต้อง sort เต็ม
             เพราะเราต้องการแค่ "เย็นสุด" ทีละตัว ไม่ใช่ลำดับทั้งหมด)

Space Complexity: O(N + C)

หมายเหตุสำคัญ (ความซื่อสัตย์ทางวิศวกรรม):
  ที่ N = 10, N log N ≈ 33 เทียบกับ N = 10 — **ต่างกันไม่ถึงหนึ่งไมโครวินาที**
  และเกิดเฉพาะตอน cache ล้น การเปลี่ยนเป็น heap หรือ clock algorithm จึงเป็น
  "การ optimize ที่ถูกต้องทางทฤษฎีแต่ไร้ผลทางปฏิบัติ" ที่ N นี้
  → **นโยบาย: จะไม่เปลี่ยนจนกว่า profiler จะชี้ว่าเป็นคอขวดจริง** ตามหลัก
    "measure first" ที่โจทย์กำหนด แต่บันทึกไว้ที่นี่เพื่อความครบถ้วนของการวิเคราะห์

Why selected:
  - เล็บที่ผู้ใช้กำลังทำงานอยู่ (activeId) ถูกกันไว้เสมอ ไม่ถูกทิ้ง
  - การทิ้งเป็นรายเล็บ (ไม่ใช่รายเลเยอร์) สอดคล้องกับรูปแบบการใช้งานจริง —
    ผู้ใช้ทำงานทีละเล็บ การทิ้งครึ่งเล็บแล้วต้อง replay ทันทีไม่มีประโยชน์
  - logical clock (นับขึ้นเรื่อย ๆ) แม่นยำกว่า Date.now() และไม่มีปัญหา
    ความละเอียดเวลาต่ำเมื่อเกิดสองเหตุการณ์ในเฟรมเดียวกัน

Alternative considered:
  (ก) ไม่ evict เลย  (ข) LRU แบบ doubly-linked list + Map → O(1) ต่อ operation
  (ค) WeakRef / FinalizationRegistry ปล่อยให้ GC ตัดสิน

Why alternative was rejected:
  (ก) 10 เล็บ × 6 เลเยอร์ × 4 MB = 240 MB — แท็บพังบนมือถือ
  (ข) O(1) จริง แต่โค้ดยาวขึ้น 3 เท่าเพื่อประหยัดเวลาระดับไมโครวินาทีที่ N=10
      → ขัดหลัก KISS ของโจทย์ (จะพิจารณาใหม่ถ้า N โตขึ้นมาก)
  (ค) พฤติกรรมคาดเดาไม่ได้ ทดสอบไม่ได้ และไม่การันตีว่าจะคืนหน่วยความจำทันเวลา

Benchmark: ยังไม่ได้วัด — Phase 14 (วัดเป็น peak heap size ด้วย
           performance.memory และ Chrome DevTools heap snapshot)
```

---

## A-07 — Dirty-Set Rebuild (การอัปเดตตามส่วนที่เปลี่ยน)

```
Algorithm:  Dirty tracking + targeted invalidation
Purpose:    แก้เล็บ 1 นิ้ว → rebuild เฉพาะนิ้วนั้น ไม่ใช่ทั้ง 10
Location:   apps/web/src/3d/core/DirtySet.ts + EditorEngine
Input:      Set<NailKey> ที่คำสั่งประกาศว่าตัวเองแก้อะไรบ้าง
Output:     รายการงาน rebuild

Time Complexity:
  Θ(k) โดย k = จำนวนเล็บที่เปลี่ยนจริง (1 ≤ k ≤ 10)
  เทียบกับแนวทาง naive: Θ(N) = 10 เสมอ

Space Complexity: O(k) — Set ขนาดเล็ก reuse ข้ามเฟรม (ไม่ allocate ใหม่ทุกครั้ง)

Why selected:
  - ตรงกับข้อกำหนดโจทย์ข้อ "Dirty Update Architecture" โดยตรง
  - ทุก Command ต้องประกาศ `affects: NailKey[]` เป็นส่วนหนึ่งของ interface
    → ทำให้ "ลืมประกาศ" กลายเป็น compile error ไม่ใช่บั๊กที่ค่อยมาเจอทีหลัง
  - ข้อยกเว้นที่จงใจ: undo/redo ประกาศ affects = เล็บที่คำสั่งนั้นแตะ (ไม่ใช่ทุกเล็บ)
    ซึ่งดีกว่าซอร์สเดิมที่ emit ทุกเล็บเสมอตอน undo (nailStore.ts:132)

Alternative considered:
  (ก) rebuild ทุกเล็บทุกครั้ง — โค้ดง่ายกว่า
  (ข) เทียบ deep equality หาว่าอะไรเปลี่ยน — O(ขนาดเอกสาร) ต่อครั้ง
  (ค) immutable structural sharing + reference equality (แบบ Immer/Redux)

Why alternative was rejected:
  (ก) rebuild 1 เล็บ ≈ composite 1024² × L เลเยอร์ — คูณ 10 คือ 10 เท่าโดยเปล่า
  (ข) แพงกว่าการ rebuild ที่พยายามจะเลี่ยง
  (ค) เป็นทางเลือกที่ดีและอาจใช้ร่วมกันได้ แต่ผูกกับการต้องทำ document เป็น
      immutable ทั้งก้อน ซึ่งขัดกับการเก็บ stroke แบบ append (A-04 พึ่ง identity
      ของอาร์เรย์ที่ "ต่อท้ายได้")

Benchmark: ยังไม่ได้วัด — Phase 14
           แผนการวัด: วัดเวลา commit 1 คำสั่ง เมื่อ k=1 เทียบกับบังคับ k=10
```

---

## A-08 — BVH-Accelerated Raycasting (three-mesh-bvh)

```
Algorithm:  Bounding Volume Hierarchy (SAH-based split) จาก three-mesh-bvh
Purpose:    เร่งการยิงรังสีเพื่อ (1) หาเล็บที่ pointer ชี้อยู่ (2) ตรวจว่านิ้วอื่น
            บังอยู่หรือไม่ (occlusion) — ทำงานทุก pointermove ระหว่างลากเส้น
Location:   apps/web/src/3d/optimization/bvh.ts + selection/RaycastService.ts
Input:      Ray (origin, direction), mesh เป้าหมาย
Output:     Intersection | null (มี point, uv, faceIndex, object)

Time Complexity:
  การสร้าง (preprocessing):  O(T log T)     T = จำนวนสามเหลี่ยม
  การ query (ต่อรังสี):      O(log T) เฉลี่ย, O(T) worst case (ทุก node ถูกชน)
  แนวทางเดิมของ Three.js:    Θ(T) ทุกครั้ง เสมอ

Space Complexity: O(T) — โครงต้นไม้ + อาร์เรย์ index ที่จัดเรียงใหม่
                  ประมาณการ: ~ที่ T=118,756 คาดว่าหลาย MB — **ต้องวัดจริง**

ตัวเลข input ที่วัดได้จริง (จาก GLB header, ดู source-audit §1.3):
  Hand_Mesh    118,756 tris  ← ใช้ BVH
  Nail_thumb       320 tris  ← ไม่ใช้ BVH
  Nail_index       128 tris  ← ไม่ใช้ BVH
  Nail_middle      320 tris
  Nail_ring        512 tris
  Nail_little      320 tris
  รวม            120,356 tris   (มือ = 98.7% ของทั้งหมด)

ทำไมยอมให้ preprocessing เป็น O(T log T) (ครบ 6 ข้อตามโจทย์):
  1. เหตุผลที่จำเป็น: การยิงรังสีแบบ brute force ต้องตรวจ 118,756 สามเหลี่ยม
     ต่อ 1 pointermove ที่ 120 Hz = 14.25 ล้าน ray-triangle test ต่อวินาที
  2. ทำไมไม่เลือกทางที่เร็วกว่าเชิงความซับซ้อน: **ไม่มี** — การสร้างโครงสร้าง
     เชิงพื้นที่ที่ให้ query O(log n) ต้องเรียง/แบ่งข้อมูล ซึ่งมีขอบล่าง Ω(n log n)
     (ทางเลือกเดียวที่เป็น O(n) คือ uniform grid ซึ่ง query แย่กว่ามากในกรณีนี้)
  3. ความถี่ที่รัน: 1 ครั้งตอนโหลดโมเดล + 1 ครั้งทุกครั้งที่ผู้ใช้เปลี่ยนสัดส่วนมือ
     (debounce แล้ว ≈ ไม่เกิน 1 ครั้ง/วินาทีระหว่างลากสไลเดอร์)
  4. ขนาด input สูงสุดที่คาดไว้: 118,756 tris (คงที่ ผูกกับ asset ไม่ใช่ผู้ใช้)
  5. เวลาที่วัดได้: **ยังไม่ได้วัด** — เป็นตัวเลขที่ต้องวัดก่อนตัดสินใจขั้นสุดท้าย
     ถ้าเกิน ~16 ms ต้องย้ายไป Web Worker (มีแผนไว้แล้วใน optimization/bvhWorker.ts)
  6. ผลกระทบต่อประสิทธิภาพ: แลกเวลาโหลด 1 ครั้ง กับ latency ของทุก pointermove

Why selected:
  - three-mesh-bvh เป็น implementation ที่ใช้กันแพร่หลายและ integrate กับ
    three.js ผ่านการ override Mesh.prototype.raycast ได้ตรง ๆ

**ห้องเครื่องของไลบรารี (ตามข้อกำหนด "อย่าใช้ไลบรารีเป็นกล่องดำ"):**
  ปัญหาที่ไลบรารีแก้: ray-triangle intersection ทั้งหมดคือการค้นหาเชิงพื้นที่
  แนวคิดพื้นฐาน: ห่อสามเหลี่ยมทั้งหมดด้วยกล่อง (AABB) แล้วแบ่งครึ่งเป็นต้นไม้
    ทดสอบรังสีกับกล่อง (ถูกมาก ~9 การเปรียบเทียบ) ถ้าไม่ชน → ตัดทั้งกิ่งทิ้ง
    ทำให้ตัดสามเหลี่ยมส่วนใหญ่ออกได้โดยไม่ต้องทดสอบทีละอัน
  จุดแบ่ง: ใช้ Surface Area Heuristic — เลือกระนาบแบ่งที่ทำให้
    "ค่าคาดหวังของต้นทุนการ traverse" ต่ำสุด (คิดจากพื้นที่ผิวของกล่องลูก
    ซึ่งเป็นสัดส่วนกับความน่าจะเป็นที่รังสีสุ่มจะชน)
  ทำไมช่วย: ความลึกต้นไม้ ≈ log₂(T) ≈ 17 ระดับที่ T = 118,756
  ข้อแลกเปลี่ยน: (1) กินหน่วยความจำเพิ่ม (2) ต้อง rebuild เมื่อ geometry เปลี่ยน
    (3) worst case ยังเป็น O(T) ถ้ารังสีขนานกับผิวและชนทุกกล่อง

Alternative considered:
  (ก) three.js raycast มาตรฐาน — O(T), ไม่ต้อง preprocess, ไม่กินหน่วยความจำเพิ่ม
  (ข) Octree / uniform grid — สร้าง O(T), query O(1) เฉลี่ยแต่แย่ถ้าความหนาแน่นไม่สม่ำเสมอ
  (ค) GPU picking (render object id ลง framebuffer แล้วอ่านพิกเซล) — O(1) ฝั่ง CPU
  (ง) ลด geometry ของมือลงเหลือ proxy mesh หยาบสำหรับ occlusion test

Why alternative was rejected:
  (ก) คือปัญหาที่กำลังแก้ — **แต่จะเก็บไว้เป็น baseline สำหรับ benchmark เปรียบเทียบ**
  (ข) mesh มือมีความหนาแน่นสามเหลี่ยมไม่สม่ำเสมอมาก (นิ้วละเอียด ฝ่ามือหยาบ)
      grid จึงมีเซลล์ว่างเปล่าจำนวนมากและเซลล์ที่แน่นเกินไป
  (ค) ต้อง readPixels ซึ่ง sync GPU↔CPU (stall pipeline) และ **ไม่คืนพิกัด UV**
      ซึ่งเป็นสิ่งที่ระบบวาดต้องใช้ — ตัดออกด้วยเหตุผลเชิงฟังก์ชัน ไม่ใช่ความเร็ว
  (ง) **เป็นทางเลือกที่ดีมากและควรวัดเทียบ** — proxy mesh 2,000 tris อาจให้
      ผลใกล้เคียง BVH โดยไม่ต้องมีไลบรารีเพิ่ม จะทดลองใน Phase 11
      (ข้อเสีย: ต้องสร้าง proxy ใน asset pipeline และความแม่นยำ occlusion ลด)

Benchmark: ยังไม่ได้วัด — Phase 11 + 14 (เป็นการวัดที่สำคัญที่สุดของโครงงาน)
  แผนการวัด:
    เครื่อง/เบราว์เซอร์/ความละเอียด: บันทึกใน docs/performance.md
    ฉากทดสอบ: hand.glb เดิม, กล้องที่ HOME_POSITION, viewport 1280×720
    วิธี: ยิงรังสี 10,000 ครั้งจากตำแหน่ง pointer ที่บันทึกจากการลากจริง
    วัด: median / p95 / p99 ของเวลาต่อรังสี, เวลาสร้าง BVH, หน่วยความจำเพิ่ม
    เปรียบเทียบ: (1) three.js ปกติ (2) BVH (3) proxy mesh (4) BVH+proxy
```

---

## A-09 — Rigid Skin Matrix Folding

```
Algorithm:  พับ skinning transform ของ mesh ที่ผูกบอร์นเดียวให้เหลือเมทริกซ์เดียว
Purpose:    หาตำแหน่ง/ทิศทาง/รัศมีจริงของเล็บในพิกัดโลก เพื่อวางกล้องและวางของตกแต่ง
Location:   apps/web/src/3d/geometry/nailViews.ts  (nailMatrix, viewFor)
Input:      SkinnedMesh ของเล็บหนึ่งชิ้น
Output:     Matrix4 + NailView { center, normal, radius }

Time Complexity:
  ตรวจว่าผูกบอร์นเดียวจริง:  Θ(V × 4)  = Θ(V)   (4 slot ต่อ vertex)
  สร้างเมทริกซ์:              Θ(1)      (คูณเมทริกซ์ 4 ตัว)
  หา center:                  Θ(V)
  หา normal เฉลี่ย:           Θ(V)
  หา radius:                  Θ(V)
  → รวม Θ(V) ต่อเล็บ, Θ(N·V) = Θ(10 × ~200) = ~2,000 operations ต่อการคำนวณ 1 รอบ

Space Complexity: O(1) — reuse Vector3 ตัวเดิม ไม่ allocate ในลูป (สำคัญมาก:
                  การ new Vector3() ในลูป V รอบ จะสร้าง garbage 200 ก้อนต่อเล็บ)

หลักการทางคณิตศาสตร์:
  โดยทั่วไป skinning คือ  p' = Σᵢ wᵢ · (Mmesh · Bind⁻¹ · Boneᵢ · BoneInvᵢ · Bind) · p
  ซึ่งเป็นการผสมเชิงเส้นที่คิดทีละ vertex ไม่ได้ (แต่ละจุดมีน้ำหนักต่างกัน)

  แต่ **ถ้าเล็บผูกบอร์นเดียวด้วยน้ำหนัก 1.0 ทุกจุด** (invariant ที่บังคับไว้ใน
  tools/verify_model.py) ผลรวมจะเหลือพจน์เดียว → เป็น rigid transform ล้วน
  → พับเป็นเมทริกซ์เดียวต่อเล็บได้ ใช้กับทุกจุดเหมือนกัน

  โค้ดตรวจ invariant นี้ตอน runtime ด้วย (throw ถ้าเจอ vertex ที่ผูกหลายบอร์น)
  → ถ้าวันหนึ่ง asset pipeline เปลี่ยน ระบบจะฟ้องทันที ไม่ใช่คำนวณผิดเงียบ ๆ

Why selected:
  - ลดจาก O(V) matrix operation ต่อจุด เหลือ O(1) matrix build + O(V) transform
  - แม่นยำ 100% (ไม่ใช่การประมาณ) ภายใต้ invariant ที่ตรวจสอบได้

Alternative considered:
  (ก) ใช้ mesh.matrixWorld ตรง ๆ — O(1)
  (ข) เรียก THREE.SkinnedMesh.applyBoneTransform() ทีละ vertex — O(V) แต่ค่าคงที่สูงกว่ามาก
  (ค) อ่านตำแหน่งจาก bone.matrixWorld ตรง ๆ ไม่สนใจ geometry

Why alternative was rejected:
  (ก) **ผิด** — matrixWorld เป็น transform ของ Armature ไม่สะท้อนการ deform
      กล้องจะบินไปจ่อตำแหน่งเล็บใน "ท่า rest" (บั๊กที่ซอร์สเดิมเคยเจอ)
  (ข) ทำงานถูกต้องแต่ช้ากว่า และไม่ใช้ประโยชน์จาก invariant ที่เรารู้อยู่แล้ว
  (ค) bone อยู่ที่โคนนิ้ว ไม่ใช่กึ่งกลางเล็บ และไม่ให้รัศมี

Benchmark: ยังไม่ได้วัด — Phase 14 (คาดว่าไม่ใช่คอขวด: รันเฉพาะตอนสัดส่วนเปลี่ยน)
```

---

## A-10 — Command Pattern History (Undo / Redo)

```
Algorithm:  Command Pattern แบบเก็บ delta + การรวมคำสั่ง (coalescing)
Purpose:    Undo/Redo ที่ไม่ต้องคัดลอกสถานะทั้งก้อน
Location:   apps/web/src/3d/history/HistoryStack.ts + history/commands/*
Input:      Command { do(), undo(), affects, label, mergeKey? }
Output:     สถานะเอกสารที่เปลี่ยนไป + Set ของ id ที่ต้อง rebuild

โครงสร้างข้อมูล:
  undoStack: Command[]   (array ใช้เป็น stack — push/pop เป็น O(1) amortized)
  redoStack: Command[]
  MAX_HISTORY = 100

Time Complexity:
  execute(cmd):   O(cost ของ cmd.do) + O(1) push
  undo():         O(cost ของ cmd.undo) + O(1) pop
  redo():         O(1) pop + O(cost ของ do)
  clear():        O(1)  (ตั้ง length = 0)
  ตัดประวัติเกินเพดาน: ปัจจุบัน Array.shift() = O(H)
                        → ใช้ ring buffer แทน = O(1)  ← เลือกอันนี้

Space Complexity:
  O(Σ ขนาด delta ของทุกคำสั่ง)   ไม่ใช่ O(H × ขนาดเอกสาร)

ตัวอย่างขนาด delta ที่แท้จริง:
  SetNailColorCommand      { nailKey, before: '#FFFFFF', after: '#FF0000' }   ~50 bytes
  AddStrokeCommand         { nailKey, layerId, stroke }                       ~n×24 bytes
  MoveDecorationCommand    { nailKey, decoId, before: {u,v,rot}, after }      ~80 bytes
  SetFinishCommand         { nailKey, before, after }                         ~40 bytes

  เทียบกับซอร์สเดิม (structuredClone ทั้ง Design):
  งานที่มี 10 เล็บ × 200 stroke × 300 จุด ≈ 14 MB ต่อ snapshot × 50 = **700 MB**
  แนวทางใหม่: 100 คำสั่ง × ~เฉลี่ย 2 KB = **200 KB**   (ต่างกัน ~3,500 เท่า)
  (ตัวเลขนี้เป็นการประมาณจากขนาดโครงสร้างข้อมูล ไม่ใช่การวัด heap จริง —
   จะยืนยันด้วย heap snapshot ใน Phase 14)

การรวมคำสั่ง (Operation Grouping) ตามที่โจทย์กำหนด:
  1. mergeKey — คำสั่งติดกันที่มี mergeKey เดียวกันภายใน 500 ms จะรวมเป็นหนึ่ง
     ใช้กับ: การลากสไลเดอร์สี/ขนาด/opacity (ไม่งั้น undo 1 ครั้ง = ถอย 1 พิกเซล)
  2. CompositeCommand — คำสั่งหลายตัวที่ต้อง undo พร้อมกัน
     ใช้กับ: "คัดลอกไปทุกเล็บ" (9 คำสั่ง → 1 รายการใน history)

Why selected:
  - เป็นข้อกำหนดโดยตรงของโจทย์
  - ทำให้ "การกระทำหนึ่งครั้ง" มีชื่อ (label) → แสดงใน UI ได้ ("เลิกทำ: เปลี่ยนสีเล็บ")
  - แต่ละ Command เป็นคลาสเล็ก ๆ ที่ unit test ได้อิสระ (do แล้ว undo ต้องได้
    สถานะเดิมเป๊ะ — เป็น property test ที่เขียนได้ตรง ๆ)
  - ประกาศ affects → ต่อกับ dirty set (A-07) โดยตรง

Alternative considered:
  (ก) Snapshot ทั้งเอกสาร (แนวทางของซอร์สเดิมทั้งสองชุด)
  (ข) Immer patches (produceWithPatches → inverse patches)
  (ค) CRDT / operational transform
  (ง) Event sourcing (เก็บ log แล้ว replay จากศูนย์)

Why alternative was rejected:
  (ก) โจทย์ห้ามชัดเจน ("Avoid cloning the entire Three.js scene") และตัวเลข
      ข้างบนแสดงว่ากินหน่วยความจำมากกว่า ~3,500 เท่า
  (ข) **เป็นทางเลือกที่ดีจริง** — Immer สร้าง inverse patch ให้อัตโนมัติ
      แต่: (1) บังคับให้ document เป็น immutable ทั้งก้อน ซึ่งขัดกับ A-04
      ที่พึ่งการต่อท้ายอาร์เรย์ (2) patch ที่ generate อัตโนมัติไม่มี "ความหมาย"
      จึงรวมคำสั่ง (coalescing) และตั้งชื่อใน UI ไม่ได้ (3) เพิ่ม dependency
  (ค) เกินความจำเป็น — ระบบนี้แก้ไขคนเดียวต่อโปรเจกต์ ไม่ใช่ collaborative
      (ถ้าอนาคตต้องการแก้พร้อมกัน Command Pattern ขยายไปทางนั้นได้)
  (ง) undo ต้อง replay ทั้งหมดจากศูนย์ = O(ทุกการกระทำ) ต่อการ undo 1 ครั้ง

Benchmark: ยังไม่ได้วัด — Phase 14
  แผนการวัด: heap snapshot หลังทำ 100 การกระทำ เทียบ Command vs snapshot
              + เวลาต่อการ undo/redo 1 ครั้ง (คาดว่า < 1 ms)
```

---

## A-11 — UV → Surface Projection (การวางของตกแต่ง)

```
Algorithm:  ค้นหาสามเหลี่ยมที่ครอบพิกัด UV แล้ว interpolate ด้วย barycentric coordinates
Purpose:    แปลง "ตำแหน่งของตกแต่งในพิกัด UV" → ตำแหน่ง+ทิศทางจริงในโลก 3 มิติ
            เพื่อวางชิ้นส่วนตกแต่งให้แนบผิวเล็บ และให้ยึดติดแม้เล็บเปลี่ยนรูป
Location:   apps/web/src/3d/geometry/surfaceProjection.ts   ← โมดูลใหม่
Input:      mesh ของเล็บ, (u, v) ∈ [0,1]²
Output:     { position: Vector3, normal: Vector3, tangent: Vector3 } ในพิกัดโลก

วิธีทำ:
  Phase 1 (preprocessing ต่อเล็บ ครั้งเดียวตอนโหลด):
    สร้าง uniform grid 16×16 บนพื้นที่ UV → แต่ละเซลล์เก็บรายการสามเหลี่ยม
    ที่ AABB ใน UV ทับเซลล์นั้น
    Time: O(T)      Space: O(T + 256)

  Phase 2 (query ต่อการวางของตกแต่ง 1 ชิ้น):
    หาเซลล์จาก (u,v) → O(1)
    ทดสอบ point-in-triangle เฉพาะสามเหลี่ยมในเซลล์ → O(T/256) เฉลี่ย
    interpolate position/normal ด้วย barycentric → O(1)

Time Complexity:
  Preprocessing:  Θ(T)   ต่อเล็บ  (T = 128–512 → เล็กมาก)
  Query:
    Best:     Ω(1)
    Average:  Θ(T/G)  โดย G = จำนวนเซลล์ = 256  → ที่ T=512 คือ ~2 สามเหลี่ยม
    Worst:    O(T)    (สามเหลี่ยมทั้งหมดกระจุกในเซลล์เดียว — ไม่เกิดกับ UV ที่ unwrap ดี)

Space Complexity: O(T + G) ต่อเล็บ

Why selected:
  - เล็บมีสามเหลี่ยมน้อยมาก (128–512 ตามที่วัดได้) การใช้โครงสร้างที่ซับซ้อนกว่านี้
    (BVH ใน UV space, kd-tree) จะมี overhead มากกว่าประโยชน์
  - grid สม่ำเสมอทำงานได้ดีเพราะ UV ของเล็บถูก unwrap ให้กระจายเต็มพื้นที่
    โดย tools/nail_unwrap.py อยู่แล้ว (ความหนาแน่นค่อนข้างสม่ำเสมอ)
  - barycentric interpolation ให้ทั้งตำแหน่งและ normal ที่เนียนต่อเนื่อง
  - tangent จากอนุพันธ์ของ UV → ใช้กำหนดว่า "ด้านบน" ของสติกเกอร์ชี้ไปทางไหน
    ทำให้การหมุนของตกแต่งมีความหมายที่คงเส้นคงวา

Alternative considered:
  (ก) เดินทดสอบทุกสามเหลี่ยม — O(T) ต่อ query, ไม่ต้อง preprocess
  (ข) BVH ใน UV space — O(log T) query แต่ overhead สูงที่ T เล็ก
  (ค) ยิงรังสีจากกล้องแล้วเอา uv จาก intersection ตรง ๆ — O(log T) ด้วย BVH
  (ง) วางของตกแต่งเป็น child ของ mesh เล็บด้วย local position

Why alternative was rejected:
  (ก) **จริง ๆ แล้วยอมรับได้ที่ T ≤ 512** — จะ implement แบบนี้ก่อน แล้วเพิ่ม grid
      ต่อเมื่อวัดแล้วพบว่าช้า (measure first) แต่บันทึกการออกแบบ grid ไว้ที่นี่
      เพราะเป็นทางขยายที่เตรียมไว้ถ้าเปลี่ยนไปใช้เล็บความละเอียดสูง
  (ข) T log T preprocessing เพื่อ query ไม่กี่ครั้ง — ไม่คุ้มที่ T นี้
  (ค) **ใช้จริงตอน "วาง" ครั้งแรก** (ผู้ใช้คลิกบนเล็บ) — แต่หลังจากนั้นต้องเก็บเป็น
      UV แล้วแปลงกลับด้วย A-11 ทุกครั้งที่เล็บเปลี่ยนรูป → ทั้งสองอย่างต้องมี
  (ง) พังทันทีที่เล็บ deform หรือเปลี่ยนทรง/ความยาว (เหตุผลเดียวกับ D-10)

Benchmark: ยังไม่ได้วัด — Phase 14
```

---

## A-12 — Keyed Lookup แทนการสแกนอาร์เรย์

```
Algorithm:  Hash-based direct lookup (Map / Set / Record)
Purpose:    ข้อกำหนดโจทย์: "ห้าม array.find() ในลูปแอนิเมชัน"
Location:   ทั่วทั้งระบบ — โดยเฉพาะ 3d/models/PartsRegistry.ts

จุดที่ใช้และเหตุผล:

  1. PartsRegistry: Map<NailKey, Mesh>
     สร้าง: O(V_scene) traverse ครั้งเดียวตอนโหลด
     ค้นหา: O(1)
     แทนที่: PaintController เดิมใช้ NAIL_IDS.find(id => nails[id] === hit.object)
             ซึ่งเป็น O(N) ต่อ pointermove — ที่ N=5 ไม่สำคัญ แต่ควรทำให้ถูก
     วิธีใหม่: Map<Object3D, NailKey> (reverse map) → O(1)

  2. DirtySet: Set<NailKey>  — has/add เป็น O(1)

  3. layerCache: Map<`${nailKey}:${layerId}`, LayerCache>  — O(1)
     หมายเหตุ: คีย์ต้องรวม nailKey ด้วย ไม่ใช่ layerId เปล่า ๆ เพราะคำสั่ง
     "คัดลอกไปทุกเล็บ" อาจทำให้ layerId ซ้ำข้ามเล็บ (บั๊กที่ซอร์สเดิมเคยเจอ)

  4. appliedFinish: Record<NailKey, FinishId>
     ใช้กัน "ตั้งค่าวัสดุซ้ำโดยไม่จำเป็น" ซึ่งจะทำให้ shader ถูก recompile
     → O(1) เทียบค่าแทนการเรียก applyFinish() ทุกครั้ง

  5. decorationsById: Map<DecorationId, Decoration>  — สำหรับ TransformController

Time Complexity: O(1) เฉลี่ยต่อการค้นหา (worst O(m) ถ้า hash ชนกันทุกตัว —
                 ไม่เกิดจริงกับคีย์ที่เป็นสตริงสั้นและ V8 hash)
Space Complexity: O(m) โดย m = จำนวนรายการ

Alternative considered:
  (ก) array.find / array.filter — O(m) ต่อครั้ง
  (ข) object literal ธรรมดา — O(1) เหมือนกัน แต่ไม่มี .size, key ต้องเป็น string,
      และมีความเสี่ยง prototype pollution
  (ค) เรียงอาร์เรย์แล้ว binary search — O(log m) และต้องรักษาความเรียง

Why alternative was rejected:
  (ก) ขัดข้อกำหนดโจทย์โดยตรง และเสื่อมตามขนาดข้อมูล
  (ข) Map เหนือกว่าเมื่อ key ไม่ใช่ string (เช่น Object3D → NailKey) ซึ่งเราต้องใช้
  (ค) ซับซ้อนกว่าโดยได้ผลแย่กว่า O(1)

Benchmark: ไม่จำเป็นต้อง benchmark — เป็นการเลือกโครงสร้างข้อมูลที่ถูกต้อง
           ตามนิยาม ไม่ใช่การ optimize เชิงคาดเดา
```

---

## A-13 — Frame-Coalesced Texture Update

```
Algorithm:  Debounce ด้วย requestAnimationFrame (รวบงานหลายครั้งให้เหลือ 1 ครั้ง/เฟรม)
Purpose:    pointermove มาถี่กว่าเฟรม (สูงสุด ~1000 Hz บน iPad Pro) การ rebuild
            เท็กซ์เจอร์ 1024² ทุกอีเวนต์คือการทำงานทิ้งเปล่า
Location:   apps/web/src/3d/painting/NailTextureSet.ts  (paintDabs → schedule)

Time Complexity:
  ไม่มี debounce:  O(E × TEX_SIZE²)  โดย E = จำนวนอีเวนต์ต่อวินาที (60–1000)
  มี debounce:     O(F × TEX_SIZE²)  โดย F = เฟรมเรต (≤ 60 หรือ 120)
  → ที่ 1000 Hz pointer บนจอ 60 Hz ประหยัดงานได้ ~94%

Space Complexity: O(1) — ธง boolean หนึ่งตัว

หมายเหตุการออกแบบ:
  ในสภาพแวดล้อมทดสอบ (Node/Vitest) ไม่มี requestAnimationFrame → scheduler
  ถอยไปเรียก task ทันทีแบบ synchronous ทำให้เขียนเทสแบบตรงไปตรงมาได้
  นี่คือ dependency injection แบบเบา ๆ ที่ทำให้โค้ดทดสอบได้โดยไม่ต้อง mock timer

Why selected:
  - เป็นวิธีมาตรฐานในการซิงค์งานวาดกับรอบการเรนเดอร์ของเบราว์เซอร์
  - ไม่ทำให้เกิด latency ที่รู้สึกได้ (งานถูกทำก่อน paint ของเฟรมเดียวกัน)

Alternative considered:
  (ก) rebuild ทุกอีเวนต์  (ข) setTimeout(0)  (ค) throttle ตามเวลา (เช่น ทุก 16 ms)

Why alternative was rejected:
  (ก) งานเกิน 94%  (ข) ไม่ซิงค์กับ paint → อาจทำงานเสร็จหลังเฟรมไปแล้ว (ภาพกระตุก)
  (ค) 16 ms ตายตัวไม่ตรงกับจอ 120 Hz และไม่หยุดเมื่อแท็บอยู่เบื้องหลัง

Benchmark: ยังไม่ได้วัด — Phase 14 (วัดเป็น FPS ระหว่างลากเส้นยาว 5 วินาที)
```

---

## A-14 — Keyset Pagination (ฐานข้อมูล)

```
Algorithm:  Keyset (cursor) pagination บน composite index
Purpose:    แบ่งหน้ารายการโปรเจกต์ของผู้ใช้โดยไม่ให้ช้าลงเมื่อเลื่อนไปหน้าลึก ๆ
Location:   apps/api/src/repositories/projectRepository.ts
Input:      userId, cursor (updatedAt, id) ของรายการสุดท้ายในหน้าก่อน, limit
Output:     Project[] + cursor ถัดไป

SQL (แนวคิด):
  SELECT * FROM projects
  WHERE  user_id = $1 AND deleted_at IS NULL
    AND  (updated_at, id) < ($2, $3)
  ORDER  BY updated_at DESC, id DESC
  LIMIT  $4;

  รองรับด้วย index:  (user_id, updated_at DESC, id DESC)  WHERE deleted_at IS NULL

Time Complexity:
  Θ(log P + limit)   — index seek ไปที่ cursor แล้วอ่านต่อเนื่อง limit แถว
  เทียบ OFFSET:  Θ(offset + limit) — ต้องอ่านและทิ้งแถวก่อนหน้าทั้งหมด

Space Complexity: O(limit)

Why selected:
  - ประสิทธิภาพคงที่ไม่ว่าจะเลื่อนไปหน้าที่เท่าไร (หน้าที่ 1 เร็วเท่าหน้าที่ 500)
  - ไม่มีปัญหา "รายการซ้ำ/หาย" เมื่อมีการเพิ่ม/ลบข้อมูลระหว่างที่ผู้ใช้เลื่อน
    (ซึ่ง OFFSET มีเสมอ เพราะตำแหน่งเลื่อน)
  - ใช้ tuple comparison (updated_at, id) เพื่อจัดการกรณี updated_at ซ้ำกัน
    ถ้าใช้แค่ updated_at รายการที่ timestamp เท่ากันจะหายหรือซ้ำได้

Alternative considered:
  (ก) LIMIT/OFFSET  (ข) โหลดทั้งหมดแล้วแบ่งหน้าฝั่ง client  (ค) หมายเลขหน้าจาก row_number()

Why alternative was rejected:
  (ก) O(offset + limit) — หน้าที่ 500 ต้องสแกน 10,000 แถวทิ้ง + ปัญหาข้อมูลเลื่อน
  (ข) ส่งข้อมูลทั้งหมดข้ามเครือข่าย — ขัดกับทุกหลักการ
  (ค) ต้องคำนวณทั้งชุดผลลัพธ์ = แย่กว่า OFFSET

ข้อจำกัดที่ยอมรับ: กระโดดไปหน้าที่ N โดยตรงไม่ได้ (ทำได้แค่ถัดไป/ก่อนหน้า)
  → ยอมรับได้เพราะ UI เป็นแบบ infinite scroll / "โหลดเพิ่ม" ไม่ใช่เลขหน้า

Benchmark: ยังไม่ได้วัด — Phase 14
  แผนการวัด: seed 100,000 โปรเจกต์ → EXPLAIN (ANALYZE, BUFFERS) ที่หน้า 1, 10, 100, 500
  เทียบ keyset vs OFFSET, รายงาน execution time + buffers read
```

---

## A-15 — Argon2id Password Hashing

```
Algorithm:  Argon2id (memory-hard KDF, ผู้ชนะ Password Hashing Competition 2015)
Purpose:    เก็บรหัสผ่านอย่างปลอดภัย
Location:   apps/api/src/services/authService.ts

Time Complexity:
  Θ(t × m)  โดย t = iterations (timeCost), m = memory (memoryCost)
  **จงใจให้ช้า** — นี่คืออัลกอริทึมเดียวในเอกสารนี้ที่ "ช้า" คือคุณสมบัติที่ต้องการ

พารามิเตอร์ที่เลือก (อ้างอิงคำแนะนำ OWASP):
  memoryCost = 19 MiB,  timeCost = 2,  parallelism = 1
  → เป้าหมาย ~50–100 ms ต่อการ hash 1 ครั้งบนเครื่องเซิร์ฟเวอร์ (ต้องวัดจริง)

Space Complexity: O(m) = 19 MiB ต่อการ hash หนึ่งครั้ง (พร้อมกัน)
  ⚠ ผลข้างเคียงที่ต้องบันทึก: 100 request login พร้อมกัน = 1.9 GB RAM
  → จึงต้องมี rate limit ที่ /auth/login และ /auth/register (5 ครั้ง/นาที/IP)
    ซึ่งเป็นเหตุผลด้าน **ทรัพยากร** ไม่ใช่แค่ด้าน brute-force

Why selected:
  - memory-hard: ผู้โจมตีที่ใช้ GPU/ASIC ไม่ได้เปรียบมากเหมือนกับ hash ที่ใช้ CPU
    อย่างเดียว เพราะ GPU มีหน่วยความจำต่อ core จำกัด
  - argon2**id** = ลูกผสมของ argon2i (ทนต่อ side-channel) และ argon2d (ทนต่อ GPU)
  - มี salt ในตัว ไม่ต้องจัดการเอง

Alternative considered:
  (ก) bcrypt  (ข) scrypt  (ค) PBKDF2  (ง) SHA-256 + salt  (จ) plaintext (แบบ CEPP ปัจจุบัน)

Why alternative was rejected:
  (ก) ยังปลอดภัยพอใช้ แต่จำกัดรหัสผ่านที่ 72 bytes และ memory-hardness ต่ำกว่ามาก
  (ข) memory-hard เหมือนกันแต่มีช่องโหว่เชิงทฤษฎีเรื่อง TMTO (time-memory trade-off)
      ที่ Argon2 ออกแบบมาแก้โดยเฉพาะ
  (ค) ไม่ memory-hard — GPU เร่งได้หลายพันเท่า
  (ง) **ไม่ปลอดภัย** — เร็วเกินไป, rainbow table
  (จ) เป็นสิ่งที่ต้องแก้จากซอร์ส CEPP (ดู audit CD-2)

Benchmark: ยังไม่ได้วัด — Phase 12/14
  แผนการวัด: วัดเวลา hash 100 ครั้งบนสเปกเซิร์ฟเวอร์จริง ปรับ memoryCost ให้ได้
  ~100 ms; บันทึกสเปกเครื่องใน docs/performance.md
```

---

## A-16 — HNSW Approximate Nearest Neighbor (ค้นความรู้ RAG)

```
Algorithm:  Hierarchical Navigable Small World graph (pgvector)
Purpose:    หาความรู้ที่ใกล้เคียงกับคำถามผู้ใช้ที่สุด k อันดับ เพื่อประกอบ context
            ให้ LLM (Retrieval-Augmented Generation)
Location:   apps/ai/app/services/rag.py + ดัชนี HNSW บน knowledge_entries.embedding
Input:      เวกเตอร์คำถาม 384 มิติ, k (= 5)
Output:     knowledge_entries k แถว เรียงตามความใกล้เคียง (cosine distance)

Time Complexity:
  การสร้างดัชนี:  O(K · log K · M)   K = จำนวนความรู้, M = จำนวนเพื่อนบ้านต่อ node
  การค้นหา:
    Best/Average:  Θ(log K)   — เดินลงจากชั้นบนสุดของกราฟหลายชั้น
    Worst:         O(K)       — กราฟที่เชื่อมไม่ดี (ไม่เกิดกับพารามิเตอร์มาตรฐาน)
  แบบ brute force (ไม่มีดัชนี): Θ(K · d) โดย d = 384 มิติ

Space Complexity: O(K · M) สำหรับกราฟ + O(K · d · 4 bytes) สำหรับเวกเตอร์
                  ที่ K=10,000: เวกเตอร์ ≈ 15 MB + กราฟ

ทำไมยอมให้ index building เป็น O(K log K · M):
  1. เป็น preprocessing — สร้างครั้งเดียว อัปเดตเฉพาะตอนเพิ่มความรู้ใหม่
     (ซึ่งทำได้เฉพาะ admin ตามการออกแบบด้านความปลอดภัย → นาน ๆ ครั้ง)
  2. เร่ง query ที่เกิดทุกข้อความแชต จาก Θ(K·384) เหลือ Θ(log K)
  3. ไม่ใช่ geometry algorithm แต่เป็น spatial index ในมิติสูง ซึ่งเป็นปัญหาเดียวกัน
  4. ไม่มีทางเลือก O(K) ที่ให้ query เร็วกว่านี้ — การหา exact nearest neighbor
     ในมิติสูงมี "curse of dimensionality" ที่ทำให้ tree-based exact search
     เสื่อมลงเป็น brute force
  5. ทางเลือกที่เร็วกว่าในการสร้าง (IVFFlat, O(K·iterations) ด้วย k-means)
     ให้ recall ต่ำกว่าที่ค่า probe เดียวกัน
  6. ขนาด input: ฐานความรู้ของโครงงานนี้คาดว่า < 5,000 แถว → สร้างดัชนีในไม่กี่วินาที

Why selected:
  - pgvector รองรับในตัว ไม่ต้องมี vector database แยก (Pinecone/Qdrant/Weaviate)
    → ลด service ที่ต้องดูแล 1 ตัว และได้ transaction ร่วมกับข้อมูลอื่น
  - cosine distance เหมาะกับ sentence embedding (ความหมายอยู่ที่ทิศทางไม่ใช่ขนาด)

**ห้องเครื่องของอัลกอริทึม (ไม่ใช้ไลบรารีเป็นกล่องดำ):**
  ปัญหา: หาเพื่อนบ้านใกล้สุดในปริภูมิ 384 มิติ ซึ่ง tree แบบ kd-tree ใช้ไม่ได้ผล
  แนวคิด HNSW: สร้างกราฟหลายชั้น
    - ชั้นบน = เชื่อมแบบ "ทางด่วน" (เพื่อนบ้านห่าง ๆ, node น้อย)
    - ชั้นล่าง = เชื่อมแบบละเอียด (เพื่อนบ้านใกล้, node ครบทุกตัว)
    ค้นหา: เริ่มที่ชั้นบนสุด เดินไปหา node ที่ใกล้เป้าหมายที่สุดแบบ greedy
    แล้วลงชั้นถัดไปทำซ้ำ → เหมือน skip list แต่ในปริภูมิเมตริก
  ทำไมช่วย: จำนวน hop ≈ log K แทนที่จะต้องเทียบทุก node
  ข้อแลกเปลี่ยน: **เป็น approximate** — อาจพลาดเพื่อนบ้านที่ใกล้จริงบางตัว
    ควบคุมด้วย `ef_search` (สูง = แม่นขึ้น ช้าลง) → ต้องวัด recall จริง

Alternative considered:
  (ก) Sequential scan (ไม่มีดัชนี) — exact, Θ(K·d)
  (ข) IVFFlat — แบ่งเป็น cluster ด้วย k-means แล้วค้นเฉพาะ cluster ที่ใกล้
  (ค) Vector database แยก (Qdrant/Pinecone)
  (ง) Full-text search (tsvector) แทน semantic search

Why alternative was rejected:
  (ก) **จะใช้เป็น baseline ตอนเริ่ม** — ที่ K < 1,000 การสแกนทั้งหมดเร็วพอและ
      ให้ผลแม่นยำ 100% → ตามหลัก "measure first" จะเริ่มด้วยแบบนี้แล้วเพิ่ม HNSW
      เมื่อวัดแล้วพบว่าช้าจริง (บันทึกไว้เพื่อความโปร่งใส)
  (ข) สร้างเร็วกว่าและกินหน่วยความจำน้อยกว่า แต่ recall ต่ำกว่าที่ latency เท่ากัน
      และต้อง retrain cluster เมื่อข้อมูลเปลี่ยนมาก
  (ค) เพิ่ม service, เพิ่มความซับซ้อนของ deployment, เสีย transaction ร่วม —
      ไม่คุ้มที่ขนาดข้อมูลระดับพันแถว
  (ง) ผู้ใช้ถามด้วยภาษาธรรมชาติที่ไม่ตรงคำ ("เล็บสีหวาน ๆ" vs ความรู้ที่เขียนว่า
      "โทนพาสเทล") — keyword search จับไม่ได้ แต่ embedding จับได้

Benchmark: ยังไม่ได้วัด — Phase 14
  แผนการวัด: seed ความรู้ 100 / 1,000 / 10,000 แถว
  วัด: latency ของ sequential scan vs HNSW, และ **recall@5** ของ HNSW
       เทียบกับผลลัพธ์ exact (ต้องรายงาน recall ไม่ใช่แค่ความเร็ว —
       ดัชนีที่เร็วแต่หาไม่เจอไม่มีประโยชน์)
```

---

## A-17 — Constrained JSON Generation + Validate-Repair Loop

```
Algorithm:  Schema-constrained generation + วงจร validate → repair แบบมีขอบเขต
Purpose:    ทำให้ LLM สร้าง DesignDocument ที่ผ่าน schema ได้อย่างน่าเชื่อถือ
            เพื่อเปิดในโปรแกรมแก้ไข 3 มิติได้ทันที
Location:   apps/ai/app/services/design_generator.py
Input:      คำขอภาษาธรรมชาติของผู้ใช้ (≤ 2,000 ตัวอักษร)
Output:     DesignDocument ที่ผ่าน validation | ข้อผิดพลาดที่อธิบายได้

ขั้นตอน:
  1. ประกอบ prompt: system + JSON Schema (generate จาก contracts, D-13)
                    + รายการ id ของตกแต่งที่มีจริง + คำขอผู้ใช้
  2. เรียก Ollama ด้วย format:"json"  (บังคับ grammar ระดับ decoder)
  3. parse + validate ด้วย Pydantic (schema เดียวกับ Zod ฝั่ง TS)
  4. ตรวจ referential integrity: decoration id / material code มีอยู่จริงในฐานข้อมูล
  5. ถ้าไม่ผ่าน → ส่ง error กลับเข้า prompt แล้วขอใหม่  (สูงสุด R = 2 รอบ)
  6. ถ้ายังไม่ผ่าน → คืน error ที่ผู้ใช้เข้าใจได้ + บันทึกลง ai_generations

Time Complexity:
  O(R · T_inference)   โดย R ≤ 3 (ครั้งแรก + repair 2)
  T_inference = O(จำนวน token ที่สร้าง) — ครองเวลาทั้งหมดอย่างสิ้นเชิง
  ต้นทุนของ validation เอง: O(ขนาด document) ซึ่งไม่มีนัยสำคัญเทียบกับ inference

Space Complexity: O(ขนาด document + ขนาด context window)

Why selected:
  - **มีสามชั้นป้องกัน ไม่ใช่ชั้นเดียว**:
      ชั้น 1 (decoder grammar) — `format:"json"`
      ชั้น 2 (schema validation) — ตรวจชนิด/ช่วงค่า/enum
      ชั้น 3 (referential integrity) — ตรวจว่า id ที่อ้างมีจริง
    ซอร์สเดิมมีแค่ "regex ลบ ``` แล้ว json.loads" (AD-12) ซึ่งล้มเหลวบ่อย

  ⚠️ **แก้ไขหลัง Spike S5 (2026-08-12)**: ร่างเดิมอ้างว่าชั้น 1 "ทำให้ผลลัพธ์เป็น JSON
  ที่ parse ได้เสมอ" — **วัดแล้วไม่จริง** การเปิด/ปิด `format:"json"` ให้ผลเท่ากันเป๊ะ
  (73.3% ทั้งคู่) เพราะ JSON parse ผ่าน 100% อยู่แล้วแม้ไม่เปิด
  **ปัญหาทั้งหมดอยู่ที่ระดับ schema ไม่ใช่ระดับ syntax**
  → ชั้นที่ทำงานจริงคือชั้น 2 และ 3 เท่านั้น ชั้น 1 เก็บไว้เพราะไม่มีต้นทุน แต่ห้ามนับเป็นเหตุผลหลัก
  - จำกัดรอบ repair ไว้ที่ 2 เพราะ **ต้องมีขอบเขตบน** — ไม่งั้น request หนึ่ง
    อาจวนไม่จบและกิน GPU ทั้งเครื่อง (ปิดความเสี่ยง R-13)
  - บันทึก `repair_attempts` ทุกครั้ง → **ได้ข้อมูลวัดผลว่า prompt ดีขึ้นจริงไหม**

Alternative considered:
  (ก) regex + json.loads แล้วยอมแพ้ (ซอร์สเดิม)
  (ข) วน repair ไม่จำกัดจนกว่าจะผ่าน
  (ค) few-shot prompting อย่างเดียว ไม่มี grammar constraint
  (ง) fine-tune โมเดลให้สร้าง schema นี้โดยเฉพาะ
  (จ) ให้ LLM สร้างเฉพาะ "พารามิเตอร์ระดับสูง" (สี/ทรง/ธีม) แล้วโค้ดประกอบ document เอง

Why alternative was rejected:
  (ก) อัตราความล้มเหลวสูง ประสบการณ์ผู้ใช้แย่ (ได้ error ดิบ)
  (ข) ไม่มีขอบเขตบนของเวลาและทรัพยากร — ยอมรับไม่ได้ในระบบที่มีผู้ใช้จริง
  (ค) โมเดล 8B หลุด schema บ่อยโดยไม่มี grammar constraint
  (ง) เกินขอบเขตโครงงาน (ต้องมีชุดข้อมูล + GPU สำหรับ train) แต่**บันทึกไว้เป็นงานต่อยอด**
  (จ) **เป็นทางเลือกที่ปลอดภัยที่สุดและจะทำเป็น fallback** — ถ้าวัดแล้วพบว่า
      อัตราความสำเร็จของการสร้าง document เต็มรูปแบบต่ำกว่าเกณฑ์ที่ยอมรับได้
      จะถอยมาใช้แนวทางนี้ (LLM ตอบ JSON เล็ก ๆ 5 ฟิลด์ → โค้ดสร้าง document)
      → **การตัดสินใจนี้ต้องรอผลการวัดใน Phase 14 ไม่ตัดสินล่วงหน้า**

Benchmark: **วัดบางส่วนแล้ว** — [Spike S5](spikes/S5-llm-recipe.md) 2026-08-12
  ชุดทดสอบ 15 รายการ (แผนเต็มคือ 100 → ค้างไว้ที่ Slice 6)
  RTX 4050 Laptop 6 GB · typhoon2-8b Q4_K_M · temperature 0.2 · repair สูงสุด 2

  | เงื่อนไข | ผ่านรอบแรก | ผ่านรวม | p50 | p95 |
  |---|---|---|---|---|
  | Recipe 8 ฟิลด์ (D-22) | 53.3% | **73.3%** | 6.3 s | 14.8 s |
  | Document เต็มรูป (ซอร์สเดิม) | **0%** | **13.3%** | 187 s | 461 s |
  | Recipe ไม่มี `format:json` | 53.3% | 73.3% | 8.3 s | 13.3 s |
  | Recipe + qwen2.5:7b | 40% | 60% | 9.3 s | 23.5 s |

  **สถานะเทียบเกณฑ์**: 73.3% < 85% ที่ตั้งไว้ล่วงหน้า → **ยังไม่ผ่าน**
  แต่ยังไม่ถอยไปทางเลือก (จ) เพราะสาเหตุความล้มเหลวทุกเคสเป็นเรื่องเดียวกันและแก้ได้:
  โมเดลละฟิลด์ array ที่ควรว่างทิ้งแทนที่จะใส่ `[]` ซึ่งเป็นข้อบกพร่องของ prompt
  ที่เขียนว่า `"array (0-4) ของ ..."` ไม่ใช่ข้อจำกัดของโมเดล
  → **ต้องแก้ prompt แล้ววัดใหม่ก่อนตัดสินตามเกณฑ์** (งานค้างที่ Slice 6)
```

---

## A-18 — Reciprocal Rank Fusion (รวมผลค้นคืนสองทาง)

```
Algorithm:  Reciprocal Rank Fusion (RRF)
Purpose:    รวมอันดับจาก vector search และ lexical search ให้เป็นอันดับเดียว
            โดยไม่ต้อง normalize คะแนนที่อยู่คนละหน่วย
Location:   apps/ai/app/retrieval/hybrid.py
Input:      สองรายการอันดับ (vector k อันดับ, lexical k อันดับ)
Output:     รายการเดียวเรียงตามคะแนนรวม

สูตร:  score(d) = Σ  1 / (K + rank_i(d))       โดย K = 60 (ค่ามาตรฐาน)
                  i∈{vector, lexical}

Time Complexity:
  Θ(k log k)   — รวมด้วย hash map เป็น Θ(k) แล้วเรียงผลลัพธ์ Θ(k log k)
  โดย k = จำนวนผลลัพธ์ต่อทาง (ใช้ k = 20 แล้วคืน 5 อันดับแรก)

Space Complexity: O(k)

ทำไมยอมให้เป็น O(k log k):
  1. เป็นการเรียงผลลัพธ์ปลายทาง ไม่ใช่การค้นหา
  2. k ถูกกำหนดตายตัวที่ 20 — **ไม่โตตามขนาดฐานข้อมูล** ดังนั้นเวลาคงที่ในทางปฏิบัติ
  3. ต้นทุนจริงถูกครอบงำโดย embedding + LLM inference ซึ่งช้ากว่าหลายพันเท่า
  4. การหา top-5 จาก 40 รายการด้วย heap เป็น O(k log 5) ซึ่งเร็วกว่าในทางทฤษฎี
     แต่ต่างกันไม่ถึงไมโครวินาทีที่ k=20 → **ไม่ทำ** ตามหลัก measure-first
  5. เรียกครั้งเดียวต่อข้อความแชต
  6. เวลาที่วัดได้: ยังไม่ได้วัด

Why selected:
  - **ไม่ต้อง normalize คะแนน** ซึ่งเป็นจุดที่ hybrid search ส่วนใหญ่พัง —
    cosine similarity อยู่ในช่วง [0,1] ส่วน BM25 ไม่มีขอบเขตบน การถ่วงน้ำหนัก
    ด้วย α·vector + (1-α)·lexical ต้องจูน α ใหม่ทุกครั้งที่ข้อมูลเปลี่ยน
  - RRF ใช้แค่ "อันดับ" ไม่ใช้ "คะแนนดิบ" จึงทนต่อความต่างของสเกลโดยสมบูรณ์
  - K = 60 ทำให้อันดับ 1 ได้ 1/61 และอันดับ 20 ได้ 1/80 — ต่างกันไม่มาก
    แปลว่าเอกสารที่ติดอันดับกลาง ๆ **ทั้งสองทาง** ชนะเอกสารที่อันดับ 1 ทางเดียว
    ซึ่งเป็นพฤติกรรมที่ต้องการพอดี

Alternative considered:
  (ก) ถ่วงน้ำหนักคะแนนเชิงเส้น (α·vector + (1-α)·lexical)
  (ข) vector อย่างเดียว (แนวทางเดิม)
  (ค) cross-encoder re-ranking
  (ง) keyword filter หลัง vector search (แนวทางของซอร์สเดิม)

Why alternative was rejected:
  (ก) ต้องจูน α และ normalize คะแนนที่คนละสเกล — เปราะบางเมื่อข้อมูลเปลี่ยน
  (ข) พังกับชื่อเฉพาะ/รหัสสินค้า/ตัวเลข ("GELISH VG08", "ทรง stiletto")
  (ค) คุณภาพดีที่สุด แต่ต้องรันโมเดลอีกตัวต่อผลลัพธ์ทุกชิ้น → latency เพิ่มมาก
      **บันทึกเป็นงานต่อยอด** ถ้าวัดแล้วพบว่า recall ยังไม่พอ
  (ง) **เป็นบั๊กจริงในซอร์สเดิม** (knowledge.py:50-59) — keyword filter ทิ้งผลลัพธ์
      ที่ semantic search หาเจอถูกต้อง ถ้าข้อความไม่มีคำว่า "สี"/"เล็บ"/"ลาย"
      อยู่ตรงตัว เป็นการทำลายงานของ vector search ทั้งหมด

Benchmark: ยังไม่ได้วัด — Phase 14
  แผนการวัด: ชุดคำถามไทย 100 ข้อพร้อมเฉลยเอกสารที่ควรดึง
  วัด recall@5 ของ (1) vector ล้วน (2) lexical ล้วน (3) RRF (4) แนวทางเดิมที่มี keyword filter
  คาดหวังให้เห็นว่า (4) แย่กว่า (1) ซึ่งเป็นหลักฐานว่าบั๊กเดิมมีอยู่จริง
```

---

## A-19 — Embedding-Based Intent Routing

```
Algorithm:  จำแนกเจตนาด้วยความใกล้เคียงของเวกเตอร์กับประโยคตัวอย่าง (nearest-centroid)
Purpose:    ส่งข้อความผู้ใช้ไปยัง handler ที่ถูกต้องก่อนทำ retrieval
            แทนการเทียบ substring ภาษาไทยแบบ hardcode
Location:   apps/ai/app/retrieval/intent.py
Input:      เวกเตอร์ข้อความผู้ใช้ (384 มิติ)
Output:     intent + คะแนนความเชื่อมั่น

เจตนาที่รองรับ:
  qa · generate_design · edit_current · find_template · find_shop · chitchat

วิธี:
  ตอนบูต: embed ประโยคตัวอย่างของแต่ละเจตนา (~10 ประโยค/เจตนา) แล้วเก็บ centroid
  ตอน query: cosine กับ centroid ทั้ง 6 ตัว → เลือกตัวสูงสุด
             ถ้าคะแนนสูงสุด < 0.55 หรือห่างอันดับสองไม่ถึง 0.05 → ให้ LLM ตัดสินแทน

Time Complexity:
  Θ(I · d) = Θ(6 × 384) ≈ 2,300 การคูณ — **ต่ำกว่าไมโครวินาที**
  (การ embed ข้อความเองคือต้นทุนจริง ซึ่งต้องทำอยู่แล้วสำหรับ retrieval)

Space Complexity: O(I · d) = 6 × 384 × 4 bytes ≈ 9 KB (โหลดครั้งเดียวตอนบูต)

Why selected:
  - **ไม่ต้องเรียก LLM** ในเส้นทางปกติ → ประหยัด inference ที่แพงที่สุดในระบบ
  - ใช้เวกเตอร์ที่ต้องคำนวณอยู่แล้วสำหรับ retrieval → ต้นทุนส่วนเพิ่มแทบเป็นศูนย์
  - เพิ่มเจตนาใหม่ = เพิ่มประโยคตัวอย่าง ไม่ต้องแก้โค้ด ไม่ต้อง train
  - มีเกณฑ์ความเชื่อมั่นที่ทำให้ระบบ "รู้ตัวว่าไม่แน่ใจ" แล้วถอยไปใช้ LLM

Alternative considered:
  (ก) เทียบ substring แบบ hardcode (ซอร์สเดิม — knowledge.py:34-44)
  (ข) ให้ LLM จำแนกทุกครั้ง
  (ค) train classifier (logistic regression / SVM) บน embedding
  (ง) ไม่จำแนกเลย ยัดทุกอย่างเข้า prompt เดียว

Why alternative was rejected:
  (ก) `if "สี" in query` จับผิดแทบทุกประโยคที่ไม่ได้ใช้คำตรงตัว และเพิ่มภาษาไม่ได้
  (ข) เพิ่ม LLM call หนึ่งครั้งต่อข้อความ = เพิ่ม latency หลายวินาที เพื่องานที่
      การเทียบเวกเตอร์ทำได้ในไมโครวินาที — **ยังใช้เป็น fallback เมื่อไม่มั่นใจ**
  (ค) ต้องมีชุดข้อมูลติดป้ายและ retrain เมื่อเพิ่มเจตนา — nearest-centroid
      ให้ผลใกล้เคียงโดยไม่ต้อง train เลย จะพิจารณาใหม่ถ้าวัดแล้ว accuracy ไม่พอ
  (ง) prompt ยาวขึ้นมาก คุณภาพตกทุกเจตนา และเรียก retrieval ที่ไม่จำเป็น

Benchmark: ยังไม่ได้วัด — Phase 14
  แผนการวัด: ชุดข้อความไทย 200 ข้อความติดป้ายเจตนาไว้
  วัด accuracy, confusion matrix, และอัตราที่ต้องถอยไปใช้ LLM
```

---

## A-20 — Poisson-Disk Sampling (กระจายของตกแต่งไม่ให้ซ้อนกัน)

```
Algorithm:  Bridson's Poisson-disk sampling (มี spatial grid เร่ง)
Purpose:    วางของตกแต่งหลายชิ้นบนเล็บให้กระจายอย่างเป็นธรรมชาติ
            โดย "ไม่มีสองชิ้นใดอยู่ใกล้กันเกินรัศมี r"
Location:   apps/web/src/3d/generation/scatter.ts
Input:      พื้นที่โซน (zone) ในพิกัด UV, รัศมีขั้นต่ำ r, จำนวนที่ต้องการ n
Output:     จุด (u,v) จำนวน ≤ n ที่ห่างกันอย่างน้อย r ทุกคู่

Time Complexity:
  Θ(n)  — Bridson ใช้ grid ที่ขนาดเซลล์ = r/√2 ซึ่งรับประกันว่ามีจุดได้ไม่เกิน 1 จุด
         ต่อเซลล์ ดังนั้นการตรวจเพื่อนบ้านคือการดู 20 เซลล์รอบ ๆ = O(1) ต่อจุด
  แบบ naive (ตรวจทุกคู่): Θ(n²)

Space Complexity: O(n + G) โดย G = จำนวนเซลล์ในกริด

Why selected:
  - การสุ่มแบบสม่ำเสมอ (uniform random) ให้ผลที่ "จับกลุ่มกันเป็นก้อนและมีช่องว่าง
    ขนาดใหญ่" ซึ่งตาคนอ่านว่า **ไม่ตั้งใจ** — Poisson-disk ให้การกระจายที่ตาคนอ่านว่า
    เป็นธรรมชาติและตั้งใจ (เป็นเหตุผลเดียวกับที่ใช้ในการวางต้นไม้ในเกมและ dithering)
  - รับประกันโดยโครงสร้างว่าของตกแต่งไม่ซ้อนกัน — ไม่ต้องตรวจแล้วขยับทีหลัง
  - เป็น Θ(n) จึงเข้าเกณฑ์ความซับซ้อนที่โจทย์กำหนดโดยไม่ต้องขอยกเว้น

  หมายเหตุ: ต้องใช้ **seeded PRNG** เพื่อให้ recipe เดียวกันได้ผลเดิมเสมอ —
  ซอร์สเดิมมี `seededPoints()` ใน designLibraries.js ที่ใช้หลักการเดียวกันอยู่แล้ว

Alternative considered:
  (ก) uniform random  (ข) กริดตายตัว  (ค) ตรวจทุกคู่แล้วสุ่มใหม่ (rejection sampling)
  (ง) วางมือเป็นตำแหน่งตายตัวต่อ archetype

Why alternative was rejected:
  (ก) จับกลุ่มและเว้นช่องว่าง — ดูเหมือนความผิดพลาด ไม่ใช่ดีไซน์
  (ข) ดูเป็นเครื่องจักรเกินไป ขาดความเป็นธรรมชาติที่งานเล็บต้องการ
  (ค) Θ(n²) และไม่รับประกันว่าจะจบ (อาจวนไม่หยุดถ้าพื้นที่แน่นเกิน)
  (ง) **ใช้จริงสำหรับ zone ที่ต้องการความแม่นยำ** เช่น `tip` (ปลายเล็บ) ที่มีตำแหน่ง
      ที่ถูกต้องชัดเจน — Poisson-disk ใช้เฉพาะ zone `scatter` ที่ต้องการความสุ่ม

Benchmark: ยังไม่ได้วัด — Phase 14 (n ≤ 30 ต่อเล็บ คาดว่าไม่ใช่คอขวด)
```

---

## A-21 — Point-in-Convex-Polygon (ตรวจว่าของตกแต่งอยู่ในเล็บ)

```
Algorithm:  Binary search บน convex polygon (fan decomposition)
Purpose:    ตรวจว่าพิกัด UV ของตกแต่งอยู่ภายในขอบเล็บจริงหรือไม่
            → ของตกแต่งไม่มีทางลอยอยู่นอกเล็บ
Location:   apps/web/src/3d/geometry/pointInHull.ts
Input:      convex hull ของเล็บ (h จุด จาก A-01), จุด (u,v)
Output:     boolean

Time Complexity:
  Best:     Ω(1)      — ตัดออกทันทีด้วยการตรวจสองขอบแรก
  Average:  Θ(log h)
  Worst:    O(log h)
  แบบ naive (ray casting ทั่วไป): Θ(h)

Space Complexity: O(1)

หลักการ:
  hull ที่ได้จาก A-01 **เป็น convex เสมอ** ซึ่งเป็นคุณสมบัติที่ใช้ประโยชน์ได้:
  แบ่ง polygon เป็นรูปพัดจากจุดยอด v₀ แล้ว binary search หาว่าจุดที่ถามอยู่ใน
  ช่องพัดใด (เพราะมุมเรียงจากน้อยไปมากรอบ v₀) จากนั้นตรวจสามเหลี่ยมเดียว
  → ไม่ต้องเดินทุกขอบเหมือน ray casting

Why selected:
  - ใช้ประโยชน์จากคุณสมบัติ convex ที่เรารู้อยู่แล้วจาก A-01 — ถ้าไม่ใช้ ก็เท่ากับ
    ทิ้งข้อมูลที่คำนวณมาแล้วไปเปล่า ๆ
  - เรียกบ่อย: ทุกครั้งที่ลากของตกแต่ง (ต่อ pointermove) × ทุกชิ้น × ตอน validate
    ของ generator → ความต่างระหว่าง O(h) กับ O(log h) สะสมได้จริง
  - h มีค่าประมาณ 20–40 จุดต่อเล็บ → log₂40 ≈ 5 เทียบกับ 40 = เร็วขึ้น ~8 เท่า

Alternative considered:
  (ก) ray casting (crossing number) — Θ(h) ใช้ได้กับ polygon ทุกแบบ
  (ข) winding number — Θ(h) แม่นกว่ากับ polygon ที่ตัดตัวเอง
  (ค) ตรวจกับ bounding box อย่างเดียว — O(1)
  (ง) ตรวจด้วย raycast จริงใน 3D

Why alternative was rejected:
  (ก)(ข) ทำงานถูกต้องแต่ไม่ใช้ประโยชน์จาก convexity ที่มีอยู่ — และ hull ของเราไม่มีทาง
      ตัดตัวเองอยู่แล้วตามนิยาม จึงไม่ต้องการความสามารถส่วนเกินของ winding number
  (ค) เร็วกว่าแต่ผิด — กรอบสี่เหลี่ยมกินพื้นที่นอกเล็บถึง ~30% ของเล็บทรงอัลมอนด์
      ของตกแต่งจะลอยข้างเล็บได้ **ใช้เป็นด่านตัดออกก่อน (early reject) เท่านั้น**
  (ง) แพงกว่ามากและต้องมีฉาก 3D — แต่ตัว hull ทำงานได้ใน Node ไม่ต้องมี WebGL
      ทำให้ทดสอบ generator ด้วย unit test ได้โดยไม่ต้องเปิดเบราว์เซอร์

Benchmark: ยังไม่ได้วัด — Phase 14 (วัดที่ h = 20/40/200 เทียบกับ ray casting)
```

---

## A-22 — Color Contrast & Harmony Scoring (CIELAB ΔE)

```
Algorithm:  แปลง sRGB → CIELAB แล้ววัดระยะ ΔE76 + ตรวจความกลมกลืนของ hue
Purpose:    รับประกันว่าดีไซน์ที่ระบบสร้างมี "สีที่มองเห็น" และ "สีที่เข้ากัน"
            ไม่ใช่ตัวหนังสือสีเทาบนพื้นเทาหรือสีที่ตีกัน
Location:   apps/web/src/3d/generation/colorRules.ts
Input:      สีสองสีในรูป hex
Output:     ΔE (ระยะการรับรู้ความต่าง) + คะแนนความกลมกลืน

Time Complexity: Θ(1) — เป็นสูตรคณิตศาสตร์คงที่ (แปลงพิกัดสี ~30 การดำเนินการ)
Space Complexity: O(1)

กฎที่บังคับใช้:
  ΔE(สีลาย, สีพื้น) ≥ 15        → ลายต้องมองเห็นได้บนพื้น
  ΔE(สีของตกแต่ง, สีพื้น) ≥ 10  → ของตกแต่งต้องไม่จมหายไปกับพื้น
  ความต่างของ hue ต้องอยู่ในรูปแบบใดรูปแบบหนึ่ง:
    analogous (ห่างกัน < 40°) · complementary (150–210°) · triadic (110–130°)
    หรือ monochrome (hue เดียวกัน ต่างที่ความสว่าง)

Why selected:
  - **RGB ไม่สะท้อนการรับรู้ของตา** — ระยะแบบยุคลิดใน RGB บอกไม่ได้ว่าสองสี
    "ดูต่างกันแค่ไหน" เช่น #00FF00 กับ #00EE00 ห่างกันเท่ากับ #000000 กับ #000011
    ในเชิงตัวเลข แต่ตามองเห็นความต่างของคู่แรกน้อยกว่ามาก
  - CIELAB ออกแบบมาให้ระยะเชิงยุคลิดสอดคล้องกับการรับรู้ของมนุษย์ (perceptually uniform)
  - ΔE ≈ 2.3 คือเกณฑ์ที่คนทั่วไปเริ่มแยกออก — เกณฑ์ 10/15 ที่ตั้งไว้จึงมีที่มา
    ไม่ใช่ตัวเลขที่เดาขึ้น
  - เป็นกฎที่ **คำนวณได้และทดสอบได้** ไม่ใช่ความเห็นเชิงศิลปะ

Alternative considered:
  (ก) ระยะยุคลิดใน RGB  (ข) WCAG contrast ratio  (ค) ΔE2000  (ง) ไม่ตรวจเลย

Why alternative was rejected:
  (ก) ไม่สอดคล้องกับการรับรู้ ตามเหตุผลข้างต้น
  (ข) ออกแบบมาสำหรับ **ตัวอักษรบนพื้นหลัง** วัดเฉพาะความสว่าง ไม่สนใจสี —
      สีแดงกับสีเขียวที่ความสว่างเท่ากันได้ ratio 1:1 ทั้งที่ตาแยกออกชัดเจน
      (ยังคงใช้ WCAG สำหรับ UI ของเว็บ แต่ไม่เหมาะกับการประเมินงานศิลป์บนเล็บ)
  (ค) แม่นกว่า ΔE76 จริง โดยเฉพาะในโซนสีน้ำเงินและสีเทา แต่สูตรยาวกว่ามาก
      → **บันทึกเป็นทางเลือกที่จะเปลี่ยนได้ถ้าพบว่า ΔE76 ตัดสินผิดในกรณีจริง**
      เริ่มด้วยตัวที่ง่ายกว่าตามหลัก KISS แล้ววัด
  (ง) เป็นสาเหตุหลักที่ผลลัพธ์จาก LLM ดูไม่สวย

Benchmark: ยังไม่ได้วัด — Phase 14
  แผนการวัด: ให้คน 5 คนให้คะแนนความสวยของดีไซน์ 50 ชิ้น (ผ่านกฎ / ไม่ผ่านกฎ)
  แล้วดูว่าคะแนนของกลุ่มที่ผ่านกฎสูงกว่าอย่างมีนัยสำคัญหรือไม่
  → นี่คือการ **ตรวจสอบว่ากฎที่ตั้งไว้ใช้ได้จริง** ไม่ใช่แค่รันได้
```

---

## 16. สรุปตารางความซับซ้อน

| ID | อัลกอริทึม | Time (avg) | Space | ความถี่ที่รัน | > O(n)? มีเหตุผลรองรับ? |
|---|---|---|---|---|---|
| A-01 | Convex Hull | Θ(V log V) | O(V) | 10 ครั้ง/session | ✔ preprocessing, ขอบล่างของปัญหา |
| A-02 | Douglas–Peucker | Θ(n log n) | O(n) | 1 ครั้ง/stroke | ✔ preprocessing, n มีขอบเขต |
| A-03 | Arc-length resample | Θ(n + L/step) | O(n + L/step) | ทุก pointermove | — เชิงเส้นต่อ output |
| A-04 | Incremental layer render | Θ(Δ) | O(18 × 1024²) | ทุก commit | — |
| A-05 | Batched dab drawing | Θ(d) | O(1) | ทุกการ render เลเยอร์ | — |
| A-06 | Surface eviction | O(N log N) | O(N + C) | เมื่อ cache ล้น | ✔ N=10, ไม่มีนัยสำคัญ (บันทึกไว้) |
| A-07 | Dirty-set rebuild | Θ(k) | O(k) | ทุก commit | — |
| A-08 | **BVH raycast** | build O(T log T) / query O(log T) | O(T) | build: โหลด+เปลี่ยนสัดส่วน / query: ทุก pointermove | ✔ **เอกสารครบ 6 ข้อ** |
| A-09 | Rigid skin folding | Θ(V) | O(1) | เมื่อสัดส่วนเปลี่ยน | — |
| A-10 | Command history | O(1) push/undo | O(Σ delta) | ทุกการกระทำ | — |
| A-11 | UV surface projection | Θ(T/G) query | O(T + G) | ทุกการวาง/แสดงของตกแต่ง | — |
| A-12 | Keyed lookup | O(1) | O(m) | ทุกที่ | — |
| A-13 | Frame coalescing | O(F) แทน O(E) | O(1) | ทุก pointermove | — |
| A-14 | Keyset pagination | Θ(log P + limit) | O(limit) | ทุกการโหลดรายการ | — |
| A-15 | Argon2id | Θ(t × m) — **จงใจช้า** | O(19 MiB) | ทุกการ login/register | ✔ ความปลอดภัย |
| A-16 | **HNSW vector search** | build O(K log K·M) / query Θ(log K) | O(K·M + K·d) | build: เพิ่มความรู้ / query: ทุกข้อความแชต | ✔ **เอกสารครบ 6 ข้อ** |
| A-17 | LLM JSON + repair loop | O(R · T_inference), R ≤ 3 | O(context) | ทุกการสร้างดีไซน์ด้วย AI | ✔ ต้นทุนอยู่ที่ inference มีขอบเขตบน |
| A-18 | Reciprocal Rank Fusion | Θ(k log k), k=20 คงที่ | O(k) | ทุกการค้นคืน | ✔ k ไม่โตตามข้อมูล |
| A-19 | Intent routing (embedding) | Θ(I·d) = Θ(6×384) | O(I·d) ≈ 9 KB | ทุกข้อความแชต | — |
| A-20 | Poisson-disk sampling | Θ(n) | O(n + G) | ทุกการสร้าง/วางของตกแต่งแบบกระจาย | — |
| A-21 | Point-in-convex-polygon | Θ(log h) | O(1) | ทุก pointermove ตอนลากของตกแต่ง | — |
| A-22 | ΔE76 ใน CIELAB | Θ(1) | O(1) | ทุกการตรวจสีตอน compose | — |

---

## 17. สิ่งที่ **ยังไม่ได้วัด** (รายการที่ต้องปิดใน Phase 14)

รายการนี้มีไว้เพื่อความโปร่งใส — ห้ามอ้างผลใด ๆ ก่อนช่องเหล่านี้ถูกเติม

- [ ] เวลาสร้าง BVH ของ `Hand_Mesh` (118,756 tris)
- [ ] หน่วยความจำที่ BVH ใช้
- [ ] เวลา raycast ต่อครั้ง: baseline vs BVH vs proxy mesh
- [ ] เวลาโหลด `hand.glb` 11.2 MB: ปัจจุบัน vs Draco vs Draco+KTX2
- [ ] FPS + frame time ระหว่างลากเส้นบนเล็บ
- [ ] เวลา rebuild เท็กซ์เจอร์ 1 เล็บ ที่ 1/6 เลเยอร์
- [ ] เวลา commit stroke ที่ลำดับที่ 1 / 50 / 200 (พิสูจน์ A-04)
- [ ] Peak heap: Command history vs snapshot history (พิสูจน์ A-10)
- [ ] Draw calls / triangle count ต่อเฟรมจาก `renderer.info`
- [ ] EXPLAIN ANALYZE ของทุก query สำคัญ (พิสูจน์ A-14)
- [ ] เวลา Argon2id hash บนสเปกเซิร์ฟเวอร์จริง
- [ ] latency + **recall@5** ของ HNSW เทียบ sequential scan ที่ K = 100/1,000/10,000 (A-16)
- [ ] อัตราความสำเร็จของ LLM JSON: รอบแรก / หลัง repair / จำนวนรอบเฉลี่ย (A-17)
- [ ] latency p50/p95 ของ Ollama inference บน GPU ที่จะใช้ deploy จริง
- [ ] recall@5 เทียบ 4 แบบ: vector ล้วน · lexical ล้วน · RRF · แนวทางเดิมที่มี keyword filter (A-18)
- [ ] accuracy + confusion matrix ของ intent routing บนข้อความไทย 200 ข้อความ (A-19)
- [ ] **การประเมินโดยมนุษย์**: คน 5 คนให้คะแนนดีไซน์ 50 ชิ้น (ผ่านกฎสี vs ไม่ผ่าน) — พิสูจน์ว่ากฎ A-22 ใช้ได้จริง
- [ ] อัตราผ่าน schema ของ Recipe (8 ฟิลด์) เทียบกับ DesignDocument เต็ม (พิสูจน์ D-22)
- [ ] fps ใน VR บนแว่นจริง ที่ระดับ texture 512 / 1024 (R-16)

---

เอกสารต่อเนื่อง: [architecture.md](architecture.md) · [database.md](database.md) · [source-audit.md](source-audit.md) · [implementation-plan.md](implementation-plan.md)
