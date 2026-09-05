# BPMN — Business Process Diagram

## 1. Purpose

แสดงกระบวนการทางธุรกิจ (Business Process) ทุกกระบวนการที่ระบบ Nail Studio 3D
รองรับจริง ในรูปแบบแนวคิด BPMN 2.0 — Start/End Event, User Task, Service Task,
Gateway, Data Store, External Service, Error Flow และ Alternative Flow
โดยแบ่ง Swimlane ตามระบบจริง (User / Frontend / Backend API / Database / Storage /
AI Service / External)

## 2. Scope

ครอบคลุม 11 กระบวนการ:

| # | Business Process | โมดูล |
|---|---|---|
| BP-01 | สมัครสมาชิก (Registration) | Auth |
| BP-02 | เข้าสู่ระบบ (Login) | Auth |
| BP-03 | ออกจากระบบ / เซสชันหมดอายุ | Auth |
| BP-04 | สร้างและออกแบบงาน + Autosave (กระบวนการหลัก) | Project / Editor |
| BP-05 | บันทึกเวอร์ชัน + ภาพตัวอย่าง | Project |
| BP-06 | แชร์ผลงานเข้าชุมชน (Publish) | Community |
| BP-07 | มีส่วนร่วมในชุมชน (Like / Comment / Remix / Share) | Community + Notification |
| BP-08 | รายงานเนื้อหาและการกลั่นกรอง (Moderation) | Moderation |
| BP-09 | นัดหมายกับร้าน — เจรจา ยืนยัน ทำงาน รีวิว | Appointment |
| BP-10 | จัดการข้อมูลร้านและบริการ | Shop |
| BP-11 | ผู้ช่วย AI (Chat / Recipe) พร้อม degradation | AI |
| BP-X | Cross-cutting: Error / Exception Handling | ทุกโมดูล |

### ข้อจำกัดของรูปแบบ (ต้องระบุตามข้อกำหนด)

**Mermaid ไม่รองรับสัญลักษณ์ BPMN 2.0 อย่างสมบูรณ์** — ไม่มี Pool/Lane จริง,
ไม่มีสัญลักษณ์ Event/Gateway มาตรฐาน (วงกลม/ข้าวหลามตัด), ไม่มี Message Flow เส้นประ
แบบมาตรฐาน เอกสารนี้จึงใช้ **Mermaid `flowchart` + `subgraph` แทน Pool/Lane** และ
กำกับชนิดของ element ไว้ในป้ายชื่อโหนดตามข้อตกลงด้านล่าง

| ข้อตกลงที่ใช้แทนสัญลักษณ์ BPMN | รูปแบบใน Mermaid |
|---|---|
| Start Event | `([...])` + ข้อความขึ้นต้นด้วย `START:` |
| End Event | `([...])` + ข้อความขึ้นต้นด้วย `END:` |
| Error End Event | `([...])` + ข้อความขึ้นต้นด้วย `ERROR:` |
| User Task | `[...]` + `UT:` |
| Service Task (ระบบทำเอง) | `[...]` + `ST:` |
| Script/Business Rule Task | `[...]` + `BR:` |
| Exclusive Gateway (XOR) | `{...}` |
| Data Store (ฐานข้อมูล/ดิสก์) | `[(...)]` |
| External Service | `[/.../]` |
| Message Flow ข้าม lane | เส้น `-.->` |
| Sequence Flow | เส้น `-->` |

## 3. Source Analysis

| กระบวนการ | หลักฐานในซอร์ส |
|---|---|
| BP-01 / BP-02 / BP-03 | `apps/api/src/auth/{routes,service,repository,session,password}.ts`, `apps/web/src/pages/{Register,Login}Page.tsx`, `features/auth/useAuth.ts` |
| BP-04 | `apps/api/src/projects/{routes,service,repository}.ts`, `apps/web/src/features/design/{useAutosave,useOfflineDraft,offlineDraft}.ts`, `RecoveryDialog.tsx`, `ConflictDialog.tsx` |
| BP-05 | `projects/service.ts:{saveVersion,saveThumbnail}`, `storage/{LocalDiskProvider,mimeSniff}.ts`, `apps/web/src/3d/scene/ThumbnailCapture.tsx` |
| BP-06 | `templates/{routes,service,repository}.ts:createTemplate`, `features/design/ShareTemplateDialog.tsx` |
| BP-07 | `templates/repository.ts:{addTemplateLike,removeTemplateLike,createTemplateComment,shareTemplate,remixTemplate}`, `notifications/repository.ts:createNotification` |
| BP-08 | `templates/repository.ts:{reportTemplate,listPendingTemplateReports}`, `pages/ModerationPage.tsx`, `middleware/requireUser.ts:requireAdmin` |
| BP-09 | `appointments/{routes,service}.ts` (โดยเฉพาะ `allowedTransition`), `apps/web/src/pages/AppointmentDetailPage.tsx`, `features/appointments/**` |
| BP-10 | `shops/{routes,service}.ts:assertShop`, `pages/ShopManagePage.tsx` |
| BP-11 | `apps/api/src/ai/{routes,client}.ts`, `apps/ai/app/routers/{chat,design}.py`, `apps/ai/app/{ollama,repositories}.py`, `app/generation/recipe.py`, `app/chat/{grounding,commands,memory}.py` |
| BP-X | `middleware/errorHandler.ts`, `errors/AppError.ts`, `middleware/{csrf,rateLimit,requestId}.ts` |

## 4. Diagram

### BP-01 — สมัครสมาชิก (Registration)

```mermaid
flowchart TD
    subgraph L1["Lane: User"]
        A1(["START: ต้องการใช้งานระบบ"])
        A2["UT: กรอกชื่อ อีเมล รหัสผ่าน<br/>เลือกบทบาท user หรือ shop<br/>วันเกิด และยอมรับเงื่อนไข"]
        A9["UT: อ่านข้อความผิดพลาด<br/>แล้วแก้ไขข้อมูล"]
    end

    subgraph L2["Lane: Frontend (apps/web)"]
        B1["ST: ตรวจเบื้องต้น<br/>รหัสผ่าน &gt;= 12 ตัว<br/>parseDdMmYyyy(dd/mm/yyyy)"]
        B2["ST: อ่าน cookie nscsrf<br/>แนบ header x-csrf-token"]
        B3["ST: POST /api/v1/auth/register<br/>credentials: include"]
        B4["ST: แสดง details[0].message<br/>ระบุฟิลด์ที่ผิด"]
        B5["ST: setQueryData(auth/me)<br/>navigate('/projects', replace)"]
    end

    subgraph L3["Lane: Backend API (apps/api)"]
        C0["ST: ensureCsrfCookie<br/>ออกโทเคนถ้ายังไม่มี"]
        C1{"csrfProtection<br/>cookie == header ?"}
        C2{"authLimiter<br/>&lt;= 5 ครั้ง/นาที ?"}
        C3["ST: registerSchema.parse(body)"]
        C4["ST: findUserByEmail(email)"]
        C5{"อีเมลถูกใช้แล้ว ?"}
        C6["ST: hashPassword<br/>Argon2id m=19456 t=2 p=1"]
        C7["ST: createUser"]
        C8["ST: createSessionToken 256-bit<br/>hashSessionToken SHA-256"]
        C9["ST: createSession"]
        C10["ST: setAuthCookies<br/>nsid httpOnly + nscsrf<br/>ตอบ 201 พร้อม PublicUser"]
        E1(["ERROR: 403 FORBIDDEN<br/>ขาด/ผิดโทเคน CSRF"])
        E2(["ERROR: 429 RATE_LIMITED"])
        E3(["ERROR: 400 VALIDATION_ERROR"])
        E4(["ERROR: 409 CONFLICT<br/>อีเมลนี้ถูกใช้สมัครไปแล้ว"])
    end

    subgraph L4["Lane: Database"]
        D1[("users")]
        D2[("sessions")]
    end

    Z1(["END: เข้าสู่ระบบอัตโนมัติ<br/>อยู่ที่หน้า /projects"])

    A1 --> A2 --> B1
    B1 -->|ไม่ผ่าน| A9
    B1 -->|ผ่าน| B2 --> B3 -.-> C0
    C0 --> C1
    C1 -->|ไม่| E1 -.-> B4
    C1 -->|ใช่| C2
    C2 -->|เกิน| E2 -.-> B4
    C2 -->|ไม่เกิน| C3
    C3 -->|ZodError| E3 -.-> B4
    C3 -->|ผ่าน| C4
    C4 --> D1
    C4 --> C5
    C5 -->|ใช่| E4 -.-> B4
    C5 -->|ไม่| C6 --> C7 --> D1
    C7 --> C8 --> C9 --> D2
    C9 --> C10 -.-> B5 --> Z1
    B4 --> A9 --> A2
```

**กฎธุรกิจ**
- รหัสผ่านเน้น "ยาว" (>= 12) ไม่บังคับอักขระพิเศษ — ตามคำแนะนำ NIST/OWASP (`packages/contracts/src/auth.ts`)
- `role` รับได้เฉพาะ `user` และ `shop` — สมัครเป็น `admin` ไม่ได้
- `dateOfBirth` และ `termsAccepted` เป็น optional; ถ้าส่ง `termsAccepted: true` จะบันทึก `terms_accepted_at = now()`
- rate limit 5/นาที มีสองเหตุผล: กัน brute force **และ** กัน DoS ที่ชั้น Argon2 (19 MiB ต่อครั้ง)

---

### BP-02 — เข้าสู่ระบบ (Login)

```mermaid
flowchart TD
    subgraph L1["Lane: User"]
        A1(["START: เปิดเว็บ"])
        A2["UT: กรอกอีเมลและรหัสผ่าน"]
        A3["UT: อ่านข้อความผิดพลาด"]
    end

    subgraph L2["Lane: Frontend"]
        B0["ST: GET /auth/me ตอนบูตแอป"]
        B1{"มี session ใช้ได้ ?"}
        B2["ST: POST /auth/login"]
        B3["ST: navigate('/projects')"]
        B4["ST: แสดง ApiRequestError.message"]
    end

    subgraph L3["Lane: Backend API"]
        C1["ST: loginSchema.parse(body)"]
        C2["ST: findUserByEmail(email)"]
        C3["BR: digest = user.passwordHash<br/>หรือ DUMMY_HASH ถ้าไม่พบผู้ใช้<br/>(กัน timing attack)"]
        C4["ST: verifyPassword(digest, password)"]
        C5{"พบผู้ใช้ และ รหัสผ่านถูก ?"}
        C6["ST: ออก session + cookie"]
        E1(["ERROR: 401 UNAUTHENTICATED<br/>'อีเมลหรือรหัสผ่านไม่ถูกต้อง'<br/>ข้อความเดียวกันทั้งสองกรณี"])
    end

    subgraph L4["Lane: Database"]
        D1[("users")]
        D2[("sessions")]
    end

    Z1(["END: อยู่ที่ /projects"])

    A1 --> B0 --> B1
    B1 -->|ใช่| Z1
    B1 -->|ไม่| A2 --> B2 -.-> C1
    C1 --> C2 --> D1
    C2 --> C3 --> C4 --> C5
    C5 -->|ไม่| E1 -.-> B4 --> A3 --> A2
    C5 -->|ใช่| C6 --> D2
    C6 -.-> B3 --> Z1
```

**กฎธุรกิจ** — ระบบต้องใช้เวลาตอบเท่ากันทั้งกรณีอีเมลไม่มีในระบบและรหัสผ่านผิด
จึงเรียก Argon2 เสมอ (`DUMMY_HASH`) เพื่อไม่ให้ผู้โจมตีไล่หาว่าอีเมลใดสมัครไว้แล้ว

---

### BP-03 — ออกจากระบบ / เซสชันหมดอายุ

```mermaid
flowchart TD
    subgraph L1["Lane: User"]
        A1(["START: กด 'ออกจากระบบ'"])
        A2(["START: เปิดหน้าอื่นหลังจากไม่ได้ใช้งานนาน"])
    end

    subgraph L2["Lane: Frontend"]
        B1["ST: POST /auth/logout"]
        B2["ST: queryClient.clear()<br/>navigate('/login', replace)"]
        B3["ST: เรียก API ใด ๆ ที่ต้องล็อกอิน"]
        B4["ST: จับ ApiRequestError status 401<br/>Protected guard → Navigate '/login'"]
    end

    subgraph L3["Lane: Backend API"]
        C1["ST: requireUser<br/>resolveSession(token)"]
        C2["ST: deleteSession(sessionId)<br/>(idempotent — ลบซ้ำไม่ error)"]
        C3["ST: clearAuthCookies<br/>ลบ nsid และ nscsrf"]
        C4{"session หมดอายุ ?<br/>expiresAt &lt;= now"}
        C5["ST: deleteSession แล้วคืน null"]
        E1(["ERROR: 401 UNAUTHENTICATED<br/>'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'"])
    end

    subgraph L4["Lane: Database"]
        D1[("sessions")]
    end

    Z1(["END: อยู่ที่หน้า /login"])

    A1 --> B1 -.-> C1 --> C2 --> D1
    C2 --> C3 -.-> B2 --> Z1
    A2 --> B3 -.-> C4
    C4 -->|ใช่| C5 --> D1
    C5 --> E1 -.-> B4 --> Z1
    C4 -->|ไม่| C1
```

**ข้อสังเกต** — `deleteExpiredSessions()` มีอยู่ใน `auth/repository.ts` แต่
**ไม่มีตัวจับเวลา/งานเบื้องหลังใดเรียกใช้** แถวที่หมดอายุจึงถูกลบเฉพาะตอนมีคนพยายามใช้เท่านั้น

---

### BP-04 — สร้างและออกแบบงาน + Autosave (กระบวนการหลักของระบบ)

```mermaid
flowchart TD
    subgraph L1["Lane: User"]
        A1(["START: อยู่ที่ /projects"])
        A2["UT: ตั้งชื่องานแล้วกด 'สร้าง'"]
        A3["UT: ออกแบบ — เลือกนิ้ว ทรง ความยาว ผิวเล็บ<br/>วาดเส้น จัดเลเยอร์ วางของตกแต่ง ปรับมือ"]
        A4["UT: กด Ctrl+Z / Ctrl+Y"]
        A5["UT: เลือก 'กู้คืน' หรือ 'ทิ้งงานค้าง'"]
        A6["UT: โหลดงานใหม่ (ConflictDialog)"]
    end

    subgraph L2["Lane: Frontend (Editor)"]
        B1["ST: POST /projects → 201<br/>navigate('/editor/:id')"]
        B2["ST: GET /projects/:id"]
        B3{"detail.draft != null<br/>หรือมี record ใน IndexedDB ?"}
        B4["UT: RecoveryDialog"]
        B5["ST: DesignStoreProvider<br/>โหลด openingDocument(detail)"]
        B6["ST: HistoryStack.execute(command)<br/>ring buffer 100 · merge 500ms"]
        B7["ST: debounce 3000 ms<br/>(AUTOSAVE_DELAY_MS)"]
        B8["ST: PUT /projects/:id/draft<br/>{document, baseVersion}"]
        B9{"ตอบกลับ ?"}
        B10["ST: เขียน IndexedDB<br/>nail-studio / drafts"]
        B11["UT: ConflictDialog"]
        B12["ST: แสดงสถานะ 'บันทึกงานค้างแล้ว'"]
    end

    subgraph L3["Lane: Backend API"]
        C1["ST: requireUser + CSRF"]
        C2["ST: saveDraftSchema.parse<br/>(designDocumentSchema เต็มรูปแบบ)"]
        C3["ST: mustOwn(userId, projectId)"]
        C4["ST: latestVersion(projectId)"]
        C5{"input.baseVersion == current ?"}
        C6["ST: saveDraft — เขียนทับ draft เดิม<br/>(PUT จึง idempotent)"]
        E1(["ERROR: 404 NOT_FOUND<br/>(ตอบ 404 แม้เป็นของคนอื่น)"])
        E2(["ERROR: 409 CONFLICT<br/>'งานนี้ถูกบันทึกจากที่อื่นไปแล้ว'"])
        E3(["ERROR: 400 VALIDATION_ERROR"])
    end

    subgraph L4["Lane: Database"]
        D1[("projects<br/>draft_document, draft_updated_at,<br/>draft_base_version")]
        D2[("design_versions")]
    end

    subgraph L5["Lane: Browser Storage"]
        S1[("IndexedDB<br/>'nail-studio' / store 'drafts'")]
    end

    Z1(["END: งานถูกเก็บไว้ ผู้ใช้ทำงานต่อได้"])

    A1 --> A2 --> B1 --> B2 -.-> C3
    C3 --> D1
    B2 --> B3
    B3 -->|มี| B4 --> A5 --> B5
    B3 -->|ไม่มี| B5
    B5 --> A3 --> B6 --> B7 --> B8 -.-> C1 --> C2
    C2 -->|ZodError| E3 -.-> B9
    C2 --> C3
    C3 -->|ไม่ใช่เจ้าของ| E1 -.-> B9
    C3 --> C4 --> D2
    C4 --> C5
    C5 -->|ไม่ตรง| E2 -.-> B9
    C5 -->|ตรง| C6 --> D1
    C6 -.-> B9
    B9 -->|200 OK| B12 --> Z1
    B9 -->|409| B11 --> A6
    B9 -->|เครือข่ายล้ม / 5xx| B10 --> S1
    B10 --> Z1
    A4 --> B6
    A3 --> A3
```

**กฎธุรกิจสำคัญ** (มีคอมเมนต์ยืนยันในซอร์ส)

| กฎ | ที่มา |
|---|---|
| Autosave เขียน **draft** ไม่ใช่สร้างเวอร์ชันใหม่ — ไม่งั้นรายการเวอร์ชันจะมีหลายร้อยแถวต่อการนั่งวาดหนึ่งชั่วโมง | คอมเมนต์ใน `prisma/schema.prisma` model `Project` |
| ห้ามเขียนทับเวอร์ชันล่าสุดแทน — เวอร์ชันต้อง **immutable** ไม่งั้นการย้อนกลับจะได้ของที่ไม่ตรงกับตอนบันทึก | แหล่งเดียวกัน |
| ใช้ `PUT` ไม่ใช่ `POST` เพราะเขียนทับ draft ทั้งก้อน → ยิงซ้ำได้ผลเดิม สำคัญกับ autosave ที่อาจยิงซ้ำเมื่อเครือข่ายสะดุด | `projects/routes.ts` |
| draft ถูกทิ้งเมื่อ `draftBaseVersion != latestVersionNumber` หรือ parse ไม่ผ่าน — งานที่ตั้งใจบันทึกชนะงานที่แค่ค้างอยู่เสมอ | `projects/service.ts:readDraft` |
| autosave ที่เขียนทับงานคนอื่นคือสิ่งที่แย่ที่สุด เพราะเกิดเองโดยผู้ใช้ไม่ได้สั่ง → ตอบ 409 แทนการเขียนทับเงียบ ๆ | `packages/contracts/src/project.ts` |
| ตอบ 404 ไม่ใช่ 403 เมื่อทรัพยากรเป็นของคนอื่น — กันการไล่เดา id เพื่อสำรวจว่าใครมีงานอะไร | `errors/AppError.ts:notFound` |

---

### BP-05 — บันทึกเวอร์ชัน + ภาพตัวอย่าง

```mermaid
flowchart TD
    subgraph L1["Lane: User"]
        A1(["START: กด 'บันทึกเวอร์ชัน'"])
        A2["UT: ตั้งชื่อเวอร์ชัน (ไม่บังคับ)"]
        A3["UT: ตัดสินใจเมื่อเกิดการชนกัน"]
    end

    subgraph L2["Lane: Frontend"]
        B1["ST: อ่าน snapshot จาก designStore<br/>{revision, document}"]
        B2["ST: POST /projects/:id/versions<br/>{document, expectedVersion, label}"]
        B3{"ผลลัพธ์ ?"}
        B4["ST: ThumbnailCapture<br/>เรนเดอร์ฉากเป็น WebP"]
        B5["ST: apiUploadBinary<br/>POST /projects/:id/thumbnail<br/>Content-Type: image/webp"]
        B6["ST: invalidateQueries(projectKeys)<br/>Toast 'บันทึกแล้ว'"]
        B7["UT: ConflictDialog"]
    end

    subgraph L3["Lane: Backend API"]
        C1["ST: createVersionSchema.parse"]
        C2["ST: mustOwn"]
        C3["ST: latestVersion(projectId)"]
        C4{"expectedVersion == current ?"}
        C5["ST: createVersion(current + 1)"]
        C6{"unique(project_id, version_number)<br/>ชนกันหรือไม่ ?"}
        C7["ST: ตอบ 201 {versionNumber}"]
        C8["ST: ตรวจขนาด &lt;= 2 MB"]
        C9["ST: sniffThumbnailMime<br/>ตรวจ magic bytes ต้องเป็น image/webp"]
        C10["ST: storage.put<br/>thumbnails/YYYY/uuid.webp"]
        C11["ST: replaceThumbnail<br/>สร้าง asset + ผูกกับ project"]
        C12["ST: storage.delete(ไฟล์เก่า)<br/>ทำหลัง DB สำเร็จเท่านั้น"]
        E1(["ERROR: 409 CONFLICT<br/>optimistic concurrency"])
        E2(["ERROR: 400 VALIDATION_ERROR<br/>'ไฟล์ไม่ใช่ WebP ที่ถูกต้อง'"])
    end

    subgraph L4["Lane: Database"]
        D1[("design_versions")]
        D2[("assets")]
        D3[("projects.thumbnail_asset_id")]
    end

    subgraph L5["Lane: Storage (local disk)"]
        S1[("STORAGE_ROOT/thumbnails/YYYY/*.webp")]
    end

    Z1(["END: มีเวอร์ชันใหม่ + ภาพตัวอย่าง"])

    A1 --> A2 --> B1 --> B2 -.-> C1 --> C2 --> C3 --> D1
    C3 --> C4
    C4 -->|ไม่ตรง| E1 -.-> B3
    C4 -->|ตรง| C5 --> C6
    C6 -->|ชน| E1
    C6 -->|ไม่ชน| D1
    C5 --> C7 -.-> B3
    B3 -->|409| B7 --> A3
    B3 -->|201| B4 --> B5 -.-> C8
    C8 -->|ใหญ่เกิน| E2 -.-> B6
    C8 --> C9
    C9 -->|ไม่ใช่ WebP| E2
    C9 -->|ผ่าน| C10 --> S1
    C10 --> C11 --> D2
    C11 --> D3
    C11 --> C12 --> S1
    C12 -.-> B6 --> Z1
```

**กฎธุรกิจ** — ลบไฟล์เก่าออกจาก storage **หลัง** อัปเดตฐานข้อมูลสำเร็จเท่านั้น
ถ้าลบก่อนแล้ว DB update ล้มเหลว จะเหลือ `thumbnail_asset_id` ชี้ไปยัง asset ที่ไฟล์หายไปแล้ว
และการลบไฟล์เก่าไม่สำเร็จไม่ถือเป็นความล้มเหลวที่ผู้ใช้ต้องรู้

---

### BP-06 — แชร์ผลงานเข้าชุมชน (Publish Template)

```mermaid
flowchart TD
    subgraph L1["Lane: User (เจ้าของงาน)"]
        A1(["START: กด 'แชร์เข้าชุมชน' ในตัวแก้ไข"])
        A2["UT: เลือกเวอร์ชัน · ตั้งชื่อ · เขียนคำบรรยาย<br/>เลือกหมวด (5 ค่า) และสีหลัก (5 ค่า)"]
    end

    subgraph L2["Lane: Frontend"]
        B1["UT: ShareTemplateDialog"]
        B2["ST: POST /templates<br/>{projectId, versionNumber, name,<br/>caption, category, primaryColor}"]
        B3["ST: navigate('/community')<br/>+ Toast"]
        B4["ST: แสดงข้อผิดพลาด"]
    end

    subgraph L3["Lane: Backend API"]
        C1["ST: createTemplateSchema.parse"]
        C2["ST: createTemplate<br/>ค้น design_version ที่เป็นของผู้ใช้"]
        C3{"พบเวอร์ชันของผู้ใช้ ?"}
        C4["ST: insert nail_templates<br/>origin=original · visibility=public<br/>ผูก design_version_id (FK RESTRICT)"]
        E1(["ERROR: 404 NOT_FOUND<br/>'ไม่พบเวอร์ชันงานที่ต้องการแชร์'"])
    end

    subgraph L4["Lane: Database"]
        D1[("design_versions")]
        D2[("nail_templates")]
    end

    Z1(["END: ผลงานปรากฏในฟีดชุมชน"])

    A1 --> B1 --> A2 --> B2 -.-> C1 --> C2 --> D1
    C2 --> C3
    C3 -->|ไม่พบ| E1 -.-> B4
    C3 -->|พบ| C4 --> D2
    C4 -.-> B3 --> Z1
```

**กฎธุรกิจ** — template ผูกกับ `design_version` ที่ถูก freeze แล้ว และ FK เป็น
`onDelete: Restrict` จึงลบเวอร์ชันที่ถูกแชร์ไปแล้วไม่ได้ (ผลงานในชุมชนจะไม่กลายเป็นลิงก์เสีย)

---

### BP-07 — มีส่วนร่วมในชุมชน (Like / Comment / Remix / Share)

```mermaid
flowchart TD
    subgraph L1["Lane: Viewer"]
        A1(["START: เปิดฟีดหรือหน้าผลงาน"])
        A2{"ทำอะไร ?"}
        A3["UT: กดถูกใจ / เลิกถูกใจ"]
        A4["UT: เขียนคอมเมนต์"]
        A5["UT: กดรีมิกซ์"]
        A6["UT: กดแชร์ (เลือกช่องทาง)"]
    end

    subgraph L2["Lane: Frontend"]
        B1["ST: GET /templates?sort=&amp;category=&amp;color=&amp;cursor="]
        B2["ST: PUT หรือ DELETE /templates/:id/like"]
        B3["ST: POST /templates/:id/comments"]
        B4["ST: POST /templates/:id/remix"]
        B5["ST: POST /templates/:id/share"]
        B6["ST: optimistic update + invalidate"]
        B7["ST: navigate('/editor/:newProjectId')"]
    end

    subgraph L3["Lane: Backend API (ทุกขั้นอยู่ใน prisma.$transaction เดียว)"]
        C0{"template public และยังไม่ถูกลบ ?"}
        C1["ST: createMany(template_likes)<br/>skipDuplicates → idempotent"]
        C2{"inserted.count == 1 ?"}
        C3["BR: like_count + 1"]
        C4["ST: insert template_comments<br/>comment_count + 1"]
        C5["ST: คัดลอก document ของเวอร์ชัน<br/>สร้าง project ใหม่ + version 1<br/>insert template_remixes<br/>remix_count + 1"]
        C6["ST: insert template_shares<br/>share_count + 1"]
        C7{"ผู้กระทำ != เจ้าของผลงาน ?"}
        C8["ST: createNotification<br/>post_like / post_comment / template_remix"]
        E1(["ERROR: 404 NOT_FOUND<br/>'ไม่พบดีไซน์ที่ต้องการ'"])
    end

    subgraph L4["Lane: Database"]
        D1[("nail_templates")]
        D2[("template_likes")]
        D3[("template_comments")]
        D4[("template_remixes + projects + design_versions")]
        D5[("template_shares")]
        D6[("notifications")]
    end

    Z1(["END: ตัวนับอัปเดต + เจ้าของได้รับแจ้งเตือน"])

    A1 --> B1 --> A2
    A2 --> A3 --> B2 -.-> C0
    A2 --> A4 --> B3 -.-> C0
    A2 --> A5 --> B4 -.-> C0
    A2 --> A6 --> B5 -.-> C0
    C0 -->|ไม่| E1
    C0 -->|ใช่| C1
    C1 --> C2
    C2 -->|ใช่| C3 --> D2
    C2 -->|ไม่ ยิงซ้ำ| D1
    C3 --> C7
    C0 --> C4 --> D3 --> C7
    C0 --> C5 --> D4 --> C7
    C0 --> C6 --> D5
    C6 --> D1
    C7 -->|ใช่| C8 --> D6
    C7 -->|ไม่| D1
    C8 -.-> B6 --> Z1
    C5 -.-> B7 --> Z1
    C6 -.-> B6
```

**กฎธุรกิจ**
- ไลก์/รายงานเป็น **idempotent** ที่ระดับฐานข้อมูล (composite PK / unique constraint + `skipDuplicates`) ตัวนับจึงไม่เพี้ยนแม้ผู้ใช้กดรัว
- ตัวนับถูก increment **ใน transaction เดียวกับ insert เสมอ**
- ไม่แจ้งเตือนเมื่อผู้กระทำคือเจ้าของผลงานเอง
- การแชร์ไม่มี unique constraint — ตั้งใจให้แชร์ซ้ำได้หลายครั้ง (เก็บเป็น event)

---

### BP-08 — รายงานเนื้อหาและการกลั่นกรอง (Moderation)

```mermaid
flowchart TD
    subgraph L1["Lane: Reporter (User)"]
        A1(["START: เห็นเนื้อหาไม่เหมาะสม"])
        A2["UT: เลือกเหตุผล<br/>spam / inappropriate / copyright /<br/>harassment / other + รายละเอียด"]
    end

    subgraph L2["Lane: Frontend"]
        B1["UT: ReportDialog"]
        B2["ST: POST /templates/:id/report"]
        B3["ST: Toast 'ส่งรายงานแล้ว'"]
    end

    subgraph L3["Lane: Backend API"]
        C1["ST: templateReportSchema.parse"]
        C2["ST: createMany(content_reports)<br/>skipDuplicates<br/>unique(target_type,target_id,reporter_id)"]
        C3{"inserted.count == 1 ?"}
        C4["BR: report_count + 1"]
        C5{"report_count &gt;= 5<br/>และยังไม่ hidden ?"}
        C6["ST: visibility = hidden<br/>(ผลงานหายจากฟีดทันที)"]
        C7["ST: ตอบ 201<br/>{reportId, reportCount, visibility}"]
    end

    subgraph L4["Lane: Admin"]
        F1(["START: เปิด /admin/reports"])
        F2["UT: อ่านรายการรายงานที่ status = pending"]
        F3(["END: จบที่การอ่าน — ไม่มีปุ่มดำเนินการ"])
    end

    subgraph L5["Lane: Backend (Admin path)"]
        G1["ST: requireUser + requireAdmin"]
        G2["ST: listPendingTemplateReports(50)<br/>เรียงเก่าไปใหม่"]
        E1(["ERROR: 403 FORBIDDEN<br/>'ต้องเป็นผู้ดูแลระบบ'"])
    end

    subgraph L6["Lane: Database"]
        D1[("content_reports")]
        D2[("nail_templates")]
    end

    Z1(["END: รายงานถูกบันทึก"])

    A1 --> B1 --> A2 --> B2 -.-> C1 --> C2 --> D1
    C2 --> C3
    C3 -->|ไม่ รายงานซ้ำ| C7
    C3 -->|ใช่| C4 --> D2
    C4 --> C5
    C5 -->|ใช่| C6 --> D2
    C5 -->|ไม่| C7
    C6 --> C7 -.-> B3 --> Z1
    F1 -.-> G1
    G1 -->|role != admin| E1
    G1 -->|role == admin| G2 --> D1
    G2 -.-> F2 --> F3
```

**ช่องว่างของกระบวนการ (ยืนยันจากซอร์ส)**
- `content_reports.status` **ไม่มีโค้ดใดเปลี่ยนจาก `pending`** — คิวจึงโตขึ้นเรื่อย ๆ
- ไม่มี endpoint สำหรับ ซ่อน/คืนค่า template ด้วยมือ, ลบคอมเมนต์, หรือระงับบัญชี
- การซ่อนอัตโนมัติที่ 5 รายงานเป็น**การกระทำเดียว**ที่ระบบทำกับเนื้อหาที่ถูกรายงาน

---

### BP-09 — นัดหมายกับร้าน (กระบวนการหลายฝ่าย)

```mermaid
flowchart TD
    subgraph L1["Lane: Customer"]
        A1(["START: ต้องการทำเล็บ"])
        A2["UT: ค้นหาร้าน แล้วเปิดหน้าร้าน"]
        A3["UT: เลือกบริการ · เลือกเวลา ·<br/>แนบดีไซน์ (ไม่บังคับ) · เขียนโน้ต"]
        A4["UT: ตอบรับเวลาที่ร้านเสนอ<br/>หรือเสนอเวลาใหม่"]
        A5["UT: ยกเลิก"]
        A6["UT: ให้คะแนน 1–5 + เขียนรีวิว"]
        A7["UT: ส่งข้อความหาร้าน"]
    end

    subgraph L2["Lane: Shop Owner"]
        H1["UT: เปิดคำขอนัดหมาย"]
        H2["UT: ดูคิวงานวันเดียวกัน<br/>GET /appointments/:id/same-day"]
        H3["UT: ตอบรับ / เสนอเวลาใหม่ / ปฏิเสธ"]
        H4["UT: ปิดงานเมื่อทำเสร็จ"]
        H5["UT: ตอบกลับรีวิว"]
    end

    subgraph L3["Lane: Backend API — Appointment State Machine"]
        C1["ST: create — status = pending<br/>+ proposal แรก (proposedBy = customer)"]
        G1{"allowedTransition(from, to) ?"}
        C2["ST: accept — proposal = accepted<br/>proposal อื่นที่ pending = superseded<br/>status = confirmed<br/>agreed_start_at = proposedStartAt"]
        C3["ST: propose — proposal เดิม = superseded<br/>สร้าง proposal ใหม่<br/>status = counter_offered"]
        C4["ST: decline → declined (ร้านเท่านั้น)"]
        C5["ST: cancel → cancelled"]
        C6["ST: complete → completed (ร้านเท่านั้น)"]
        C7["ST: review — insert shop_reviews<br/>คำนวณ rating_avg / rating_count ใหม่"]
        C8["ST: sendMessage — insert appointment_messages"]
        C9["ST: createNotification ทุกครั้งที่สถานะเปลี่ยน<br/>หรือมีข้อความใหม่"]
        E1(["ERROR: 409 CONFLICT<br/>'ไม่สามารถเปลี่ยนสถานะการนัดหมายนี้ได้'"])
        E2(["ERROR: 403 FORBIDDEN<br/>เฉพาะร้าน / เฉพาะลูกค้า"])
        E3(["ERROR: 409 CONFLICT<br/>'กรุณารออีกฝ่ายตอบข้อเสนอก่อน'"])
    end

    subgraph L4["Lane: Database"]
        D1[("appointments")]
        D2[("appointment_proposals")]
        D3[("appointment_messages")]
        D4[("shop_reviews")]
        D5[("shop_profiles.rating_avg / rating_count")]
        D6[("notifications")]
    end

    Z1(["END: completed + มีรีวิว"])
    Z2(["END: declined / cancelled"])

    A1 --> A2 --> A3 --> C1 --> D1
    C1 --> D2
    C1 --> C9 --> D6
    C9 -.-> H1 --> H2 --> H3 --> G1
    G1 -->|ไม่อนุญาต| E1
    G1 -->|ผู้ตอบ == ผู้เสนอ| E3
    G1 -->|ไม่ใช่ร้าน| E2
    G1 -->|อนุญาต| C2
    G1 --> C3
    G1 --> C4
    G1 --> C5
    C3 --> D2
    C3 --> C9
    C9 -.-> A4 --> G1
    C2 --> D1
    C2 --> D2
    C2 --> C9
    C4 --> Z2
    A5 --> C5 --> Z2
    C2 --> H4 --> C6 --> D1
    C6 --> C9
    C9 -.-> A6 --> C7 --> D4
    C7 --> D5
    C7 --> C9
    C7 --> H5 --> Z1
    A7 --> C8 --> D3
    C8 --> C9
```

**State Machine ที่บังคับใน `allowedTransition()`**

```mermaid
stateDiagram-v2
    [*] --> pending : customer สร้างคำขอ
    pending --> confirmed : accept
    pending --> counter_offered : propose (ร้านเท่านั้น)
    pending --> declined : decline (ร้าน)
    pending --> cancelled : cancel
    counter_offered --> confirmed : accept
    counter_offered --> counter_offered : propose (สลับฝ่าย)
    counter_offered --> cancelled : cancel
    confirmed --> completed : complete (ร้าน)
    confirmed --> cancelled : cancel
    confirmed --> no_show : (มี logic แต่ไม่มี route)
    declined --> [*]
    cancelled --> [*]
    completed --> [*]
    no_show --> [*]
```

**กฎธุรกิจ**

| กฎ | หลักฐาน |
|---|---|
| นัดหมายกับร้านของตัวเองไม่ได้ | `appointments/service.ts:create` — `input.shopId === userId` |
| บริการที่เลือกต้องเป็นของร้านนั้นและ `is_active = true` | `create()` |
| ดีไซน์ที่แนบต้องเป็นเวอร์ชันของ project ที่ผู้ใช้เป็นเจ้าของ | `create()` |
| ตอบรับข้อเสนอของตัวเองไม่ได้ (`proposal.proposedBy === actor`) | `accept()` |
| ในขั้น `pending` ร้านเท่านั้นที่เสนอเวลาใหม่ได้ | `propose()` |
| เมื่อยืนยันแล้ว proposal อื่นที่ยัง pending ถูกทำเป็น `superseded` | `accept()` |
| decline / complete / no_show เป็นสิทธิ์ของร้านเท่านั้น | `transition()` |
| รีวิวได้เฉพาะลูกค้า + สถานะ `completed` + หนึ่งนัดหนึ่งรีวิว (unique constraint) | `review()` |
| ลบรีวิวได้เฉพาะผู้เขียน และต้องคำนวณ `rating_avg` ใหม่ทั้งร้าน | `deleteReview()` |
| ทุกการเปลี่ยนสถานะใช้ `updateMany` + เงื่อนไขสถานะเดิม เพื่อกัน race condition | `accept()` — `if (result.count === 0) throw conflict` |

---

### BP-10 — จัดการข้อมูลร้านและบริการ

```mermaid
flowchart TD
    subgraph L1["Lane: Shop Owner"]
        A1(["START: สมัครด้วย role = shop แล้วเข้า /shop/manage"])
        A2["UT: แก้ชื่อร้าน คำอธิบาย ที่ตั้ง เบอร์โทร เวลาเปิด"]
        A3["UT: เพิ่ม / แก้ไข / ปิด บริการ"]
        A4["UT: ตอบกลับรีวิวของลูกค้า"]
    end

    subgraph L2["Lane: Frontend"]
        B1["ST: RoleOnly role='shop'<br/>(ถ้าไม่ใช่ → Navigate '/projects')"]
        B2["ST: PUT /shops/me"]
        B3["ST: POST/PATCH/DELETE /shops/me/services"]
        B4["ST: POST /shops/reviews/:id/reply"]
    end

    subgraph L3["Lane: Backend API"]
        C1["ST: requireUser + CSRF"]
        C2{"assertShop — users.role == 'shop' ?"}
        C3["ST: upsert shop_profiles<br/>create: shopName = user.displayName"]
        C4["ST: update shop_profiles"]
        C5["ST: insert / update shop_services"]
        C6["BR: removeService = ตั้ง is_active=false<br/>(soft delete — กันนัดหมายเดิมพัง)"]
        C7["ST: updateMany shop_reviews<br/>where shopId = me และ deletedAt = null"]
        E1(["ERROR: 403 FORBIDDEN<br/>'ต้องใช้บัญชีร้านเพื่อจัดการข้อมูลร้าน'"])
        E2(["ERROR: 404 NOT_FOUND<br/>'ไม่พบบริการของร้านนี้'"])
    end

    subgraph L4["Lane: Database"]
        D1[("shop_profiles")]
        D2[("shop_services")]
        D3[("shop_reviews")]
    end

    Z1(["END: ข้อมูลร้านปรากฏใน /shops และ /shops/:id"])

    A1 --> B1 --> A2 --> B2 -.-> C1 --> C2
    C2 -->|ไม่| E1
    C2 -->|ใช่| C3 --> D1
    C3 --> C4 --> D1 --> Z1
    A3 --> B3 -.-> C2
    C2 --> C5 --> D2
    C5 --> C6 --> D2
    C6 -->|count == 0| E2
    A4 --> B4 -.-> C2
    C2 --> C7 --> D3
    C7 -->|count == 0| E2
    C7 --> Z1
```

**ข้อสังเกต** — `shop_profiles` ถูกสร้างแบบ **lazy** ผ่าน `assertShop()` (upsert)
ไม่ได้สร้างตอนสมัครสมาชิก ผู้ใช้ role `shop` ที่ยังไม่เคยเข้าหน้าจัดการร้าน
จึงยังไม่ปรากฏในรายชื่อร้าน

---

### BP-11 — ผู้ช่วย AI (Chat / Recipe) พร้อม Degradation

```mermaid
flowchart TD
    subgraph L1["Lane: User"]
        A1(["START: เปิดแท็บ AI ในตัวแก้ไข"])
        A2["UT: พิมพ์คำถาม / คำสั่งออกแบบ"]
        A3["UT: ยืนยันคำสั่งที่ AI เสนอ<br/>(confirm-first)"]
        A4["UT: เลือกสูตรที่ต้องการ"]
    end

    subgraph L2["Lane: Frontend"]
        B1["ST: apiStream('/ai/chat')<br/>อ่าน SSE แยก event ด้วยบรรทัดว่าง"]
        B2["ST: generateAiRecipes(prompt, count)"]
        B3["ST: แสดง token ทีละชิ้น"]
        B4["ST: composer.ts → applyComposedRecipe<br/>ผ่าน HistoryStack เหมือนการแก้ด้วยมือ"]
        B5["ST: แสดงข้อความ 'AI ไม่พร้อมใช้งาน'"]
    end

    subgraph L3["Lane: Backend API (Express)"]
        C1["ST: requireUser + rateLimit 30/นาที"]
        C2["ST: chatSchema / recipeSchema .parse (strict)"]
        C3{"AI_INTERNAL_TOKEN ถูกตั้งค่า ?"}
        C4["ST: postAiStream / postAiJson<br/>header X-AI-Internal-Token<br/>timeout 65,000 ms"]
        C5["ST: pipe SSE ต่อไปยัง client<br/>Cache-Control: no-cache<br/>X-Accel-Buffering: no"]
        E1(["ERROR: 503 INTERNAL_ERROR<br/>'AI service is temporarily unavailable'"])
    end

    subgraph L4["Lane: AI Service (FastAPI)"]
        F1{"require_internal_token<br/>compare_digest ผ่าน ?"}
        F2["ST: repository.knowledge_entries()"]
        F3["ST: IntentRouter.detect(message)<br/>cosine กับ exemplar 6 intent"]
        F4["ST: RetrievalEngine.search<br/>vector + lexical → RRF (k=60)"]
        F5{"should_refuse ?<br/>intent ∈ qa/find_shop/find_template<br/>และไม่มีผลลัพธ์"}
        F6["ST: ส่ง REFUSAL_MESSAGE"]
        F7{"intent == edit_current<br/>และ parse คำสั่งได้ ?"}
        F8["ST: ProposedCommand<br/>confirmation_required = true<br/>(ไม่แก้เอกสารเอง)"]
        F9{"ollama != None ?"}
        F10["ST: stream_generate(prompt)<br/>prompt ระบุว่า sources เป็น<br/>untrusted data ไม่ใช่คำสั่ง"]
        F11["ST: ตอบข้อความ degraded"]
        F12["ST: save_chat(session_id, role, content)"]
        F13["ST: RecipeGenerator.generate"]
        F14{"parse_recipe ผ่าน ?<br/>(ลองซ่อม JSON ได้ 3 ครั้ง)"}
        F15["ST: คืน _FALLBACKS<br/>degraded = true"]
        E2(["ERROR: 401 UNAUTHORIZED<br/>'AI service requires an internal token'"])
    end

    subgraph L5["Lane: Data / External"]
        D1[("knowledge_entries")]
        D2[("ai_chat_messages")]
        X1[/"Ollama<br/>POST /api/generate (stream)"/]
    end

    Z1(["END: ผู้ใช้ได้คำตอบ / สูตรดีไซน์"])

    A1 --> A2 --> B1 -.-> C1 --> C2 --> C3
    C3 -->|ไม่| E1 -.-> B5 --> Z1
    C3 -->|ใช่| C4 -.-> F1
    F1 -->|ไม่| E2 -.-> E1
    F1 -->|ใช่| F2 --> D1
    F2 --> F3 --> F4 --> F5
    F5 -->|ใช่| F6 --> F12
    F5 -->|ไม่| F7
    F7 -->|ใช่| F8 --> F12
    F7 -->|ไม่| F9
    F9 -->|ไม่| F11 --> F12
    F9 -->|ใช่| F10 -.-> X1
    X1 -.->|"ล้มเหลว / ไม่มี token"| F11
    F10 --> F12 --> D2
    F12 --> C5 -.-> B3
    B3 --> A3 --> B4 --> Z1
    A2 --> B2 -.-> C1
    C4 --> F13 --> F14
    F14 -->|ไม่ผ่านครบ 3 ครั้ง| F15
    F14 -->|ผ่าน| F13
    F15 -.-> B2
    F13 -.-> B2 --> A4 --> B4
```

**กฎธุรกิจ / ความปลอดภัย**

| กฎ | หลักฐาน |
|---|---|
| `/health` เท่านั้นที่เปิดสาธารณะ — endpoint อื่นต้องมี `X-AI-Internal-Token` | `apps/ai/README.md`, `app/auth.py` |
| เทียบ token ด้วย `secrets.compare_digest` (constant-time) | `app/auth.py` |
| AI **ไม่แก้เอกสารเอง** — เสนอคำสั่งแล้วรอผู้ใช้ยืนยันเสมอ | `app/chat/commands.py` docstring |
| การเปลี่ยนแปลงที่ผู้ใช้ยืนยันไหลผ่าน `HistoryStack` เดียวกับการแก้ด้วยมือ → undo ได้ | `knowledge_entries` seed + `designStore.applyComposedRecipe` |
| คำถามเชิงข้อเท็จจริงต้องมีแหล่งอ้างอิง — ไม่มีก็ปฏิเสธ ไม่เดา | `app/chat/grounding.py:should_refuse` |
| Sources ถูกห่อด้วย `<untrusted_source>` และ prompt สั่งไม่ให้ทำตามคำสั่งภายใน source | `app/chat/grounding.py`, `app/routers/chat.py` |
| ระบบหลักต้องใช้งานได้แม้ AI ล่ม — degrade เป็น InMemoryRepository / ข้อความ degraded / `_FALLBACKS` | `apps/ai/README.md`, `main.py` lifespan |

---

### BP-X — กระบวนการจัดการข้อผิดพลาด (Cross-cutting)

```mermaid
flowchart TD
    subgraph L1["Lane: Request pipeline"]
        A1(["START: HTTP request เข้ามา"])
        A2["ST: requestId — สร้าง UUID<br/>ใส่ header x-request-id"]
        A3["ST: helmet + cors allowlist"]
        A4{"origin อยู่ใน allowlist ?"}
        A5["ST: express.json limit 4mb"]
        A6{"method ปลอดภัย (GET/HEAD/OPTIONS) ?"}
        A7{"CSRF cookie == header ?"}
        A8{"apiLimiter 600/นาที ?"}
        A9["ST: route handler"]
    end

    subgraph L2["Lane: errorHandler (จุดเดียวของระบบ)"]
        B1{"error เป็นชนิดใด ?"}
        B2["ST: ZodError → 400<br/>VALIDATION_ERROR + details[]"]
        B3["ST: AppError → error.status<br/>ส่งข้อความออกไปตรง ๆ ได้"]
        B4["ST: อื่น ๆ → console.error JSON<br/>{level, requestId, method, path, message, stack}"]
        B5{"isProduction ?"}
        B6["ST: 500 ข้อความกลาง<br/>'เกิดข้อผิดพลาดภายในระบบ'"]
        B7["ST: 500 พร้อมข้อความจริง (dev เท่านั้น)"]
        B8["ST: notFoundHandler → 404<br/>'ไม่พบเส้นทางนี้'"]
    end

    subgraph L3["Lane: Frontend"]
        C1["ST: ApiRequestError<br/>{status, code, details, requestId}"]
        C2{"status 4xx ?"}
        C3["ST: ไม่ retry (TanStack Query)"]
        C4["ST: retry สูงสุด 2 ครั้ง"]
        C5["ST: ErrorState + ปุ่ม 'ลองใหม่อีกครั้ง'<br/>หรือ Toast หรือ role='alert'"]
        C6["ST: ErrorBoundary จับ error<br/>ที่หลุดจากคอมโพเนนต์"]
    end

    Z1(["END: ผู้ใช้เห็นข้อความที่เข้าใจได้<br/>+ requestId ไว้แจ้งปัญหา"])

    A1 --> A2 --> A3 --> A4
    A4 -->|ไม่| C1
    A4 -->|ใช่| A5 --> A6
    A6 -->|ใช่| A8
    A6 -->|ไม่| A7
    A7 -->|ไม่| B3
    A7 -->|ใช่| A8
    A8 -->|เกิน| B3
    A8 -->|ไม่เกิน| A9
    A9 -->|throw| B1
    A9 -->|ไม่มี route| B8 --> B1
    B1 --> B2 --> C1
    B1 --> B3 --> C1
    B1 --> B4 --> B5
    B5 -->|ใช่| B6 --> C1
    B5 -->|ไม่| B7 --> C1
    C1 --> C2
    C2 -->|ใช่| C3 --> C5
    C2 -->|ไม่| C4 --> C5
    C5 --> Z1
    C6 --> Z1
```

## 5. Components / Actors

### 5.1 Swimlane ที่ใช้ในเอกสารนี้

| Lane | ตรงกับอะไรในระบบจริง |
|---|---|
| **User / Customer / Shop Owner / Admin / Reporter** | ผู้ใช้จริงตาม `users.role` |
| **Frontend** | `apps/web` (React SPA) |
| **Backend API** | `apps/api` (Express 5) — รวม middleware, routes, service, repository |
| **AI Service** | `apps/ai` (FastAPI) |
| **Database** | PostgreSQL ผ่าน Prisma / psycopg |
| **Storage** | ดิสก์ในเครื่อง (`STORAGE_ROOT`) ผ่าน `LocalDiskProvider` |
| **Browser Storage** | IndexedDB `nail-studio` / object store `drafts` |
| **External** | Ollama (`OLLAMA_URL`) — optional |

### 5.2 Data Store ที่กระบวนการแตะต้อง

| Data Store | กระบวนการที่เขียน |
|---|---|
| `users` | BP-01 |
| `sessions` | BP-01, BP-02, BP-03 |
| `projects`, `design_versions` | BP-04, BP-05, BP-07 (remix) |
| `assets` + ดิสก์ | BP-05 |
| `nail_templates`, `template_likes/shares/remixes/comments` | BP-06, BP-07 |
| `content_reports` | BP-08 |
| `notifications` | BP-07, BP-09 |
| `shop_profiles`, `shop_services`, `shop_reviews` | BP-09, BP-10 |
| `appointments`, `appointment_proposals`, `appointment_messages` | BP-09 |
| `knowledge_entries`, `ai_chat_messages` | BP-11 |
| IndexedDB `drafts` | BP-04 |

## 6. Flow / Relationship

### 6.1 ความสัมพันธ์ระหว่างกระบวนการ

```mermaid
flowchart LR
    BP01["BP-01 สมัครสมาชิก"] --> BP02["BP-02 เข้าสู่ระบบ"]
    BP02 --> BP04["BP-04 ออกแบบงาน + Autosave"]
    BP04 --> BP05["BP-05 บันทึกเวอร์ชัน"]
    BP05 --> BP06["BP-06 แชร์เข้าชุมชน"]
    BP06 --> BP07["BP-07 มีส่วนร่วมในชุมชน"]
    BP07 -->|"remix สร้าง project ใหม่"| BP04
    BP07 --> BP08["BP-08 รายงาน + Moderation"]
    BP04 -->|"แนบ design version"| BP09["BP-09 นัดหมาย"]
    BP10["BP-10 จัดการร้าน"] --> BP09
    BP04 --> BP11["BP-11 ผู้ช่วย AI"]
    BP11 -->|"สูตรที่ผู้ใช้ยืนยัน"| BP04
    BP02 --> BP03["BP-03 ออกจากระบบ"]
    BPX["BP-X Error Handling"] -.->|ครอบทุกกระบวนการ| BP01
    BPX -.-> BP04
    BPX -.-> BP09
    BPX -.-> BP11
    BP07 --> NOTI["การแจ้งเตือน"]
    BP09 --> NOTI
```

### 6.2 Alternative Flow / Error Flow ที่ครอบคลุม

| กระบวนการ | Alternative Flow | Error Flow |
|---|---|---|
| BP-01 | สมัครเป็น `shop` แทน `user` | 403 CSRF, 429 rate limit, 400 validation, 409 อีเมลซ้ำ |
| BP-02 | มี session อยู่แล้ว → ข้ามหน้า login | 401 (ข้อความเดียวกันทั้งอีเมล/รหัสผิด), 429 |
| BP-03 | เซสชันหมดอายุเอง (ไม่ได้กดออก) | 401 เซสชันหมดอายุ |
| BP-04 | กู้คืน draft, ทิ้ง draft, ทำงานต่อโดยไม่บันทึก | 404 ไม่ใช่เจ้าของ, 409 baseVersion ไม่ตรง, เครือข่ายล่ม → IndexedDB |
| BP-05 | บันทึกโดยไม่ตั้งชื่อเวอร์ชัน | 409 optimistic concurrency, 400 ไฟล์ไม่ใช่ WebP / ใหญ่เกิน 2 MB |
| BP-06 | เลือกเวอร์ชันเก่าแทนเวอร์ชันล่าสุด | 404 ไม่พบเวอร์ชันของผู้ใช้ |
| BP-07 | ไลก์ซ้ำ (ไม่เพิ่มตัวนับ), แชร์ซ้ำ (เพิ่มได้), รีมิกซ์งานตัวเอง (ไม่แจ้งเตือน) | 404 template ไม่ public / ถูกลบ |
| BP-08 | รายงานซ้ำโดยคนเดิม → ไม่เพิ่มตัวนับ | 403 ไม่ใช่ admin |
| BP-09 | ต่อรองเวลาสลับไปมาได้ไม่จำกัดรอบ, ยกเลิกได้ทั้งสองฝ่าย, ลบรีวิวได้ | 409 สถานะไม่อนุญาต, 409 รอฝ่ายตรงข้ามตอบ, 403 สิทธิ์ไม่ถูกฝ่าย, 409 รีวิวซ้ำ |
| BP-10 | ปิดบริการแทนการลบจริง | 403 ไม่ใช่บัญชีร้าน, 404 ไม่พบบริการ |
| BP-11 | ไม่มี knowledge → ปฏิเสธ; ไม่มี Ollama → ข้อความ degraded; JSON เพี้ยน → ซ่อม 3 ครั้ง แล้วใช้ `_FALLBACKS` | 503 AI service ไม่พร้อม, 401 internal token ผิด, 429 เกิน 30/นาที |

### 6.3 ความสอดคล้อง BPMN ↔ Use Case

| BPMN | Use Case ที่ครอบคลุม (ดู `Use case.md`) |
|---|---|
| BP-01 | UC-01 |
| BP-02 | UC-02 |
| BP-03 | UC-03 |
| BP-04 | UC-10, UC-11, UC-12, UC-15, UC-30…UC-36 |
| BP-05 | UC-16, UC-17, UC-18, UC-19, UC-21, UC-22 |
| BP-06 | UC-42 |
| BP-07 | UC-40, UC-41, UC-43, UC-44, UC-45, UC-46, UC-63 |
| BP-08 | UC-47, UC-50, UC-51 |
| BP-09 | UC-80…UC-92 |
| BP-10 | UC-70…UC-76 |
| BP-11 | UC-100, UC-101, UC-102, UC-103, UC-104, UC-105 |
| BP-X | ครอบทุก UC |

## 7. Source References

**Backend**
- `apps/api/src/app.ts`, `server.ts`
- `apps/api/src/auth/{routes,service,repository,session,password}.ts`
- `apps/api/src/projects/{routes,service,repository}.ts`
- `apps/api/src/templates/{routes,service,repository,cursor}.ts`
- `apps/api/src/appointments/{routes,service}.ts`
- `apps/api/src/shops/{routes,service}.ts`
- `apps/api/src/notifications/{routes,service,repository}.ts`
- `apps/api/src/users/{routes,service,repository}.ts`
- `apps/api/src/ai/{routes,client}.ts`
- `apps/api/src/middleware/{requestId,csrf,requireUser,rateLimit,errorHandler}.ts`
- `apps/api/src/errors/AppError.ts`, `apps/api/src/storage/**`

**Frontend**
- `apps/web/src/pages/{Register,Login,Projects,Editor,Community,TemplatePreview,Shops,ShopDetail,ShopManage,Appointments,AppointmentDetail,Moderation}Page.tsx`
- `apps/web/src/features/design/{NailEditor,useAutosave,useOfflineDraft,offlineDraft,RecoveryDialog,ConflictDialog,ShareTemplateDialog}.ts(x)`
- `apps/web/src/features/{auth,projects,community,appointments,shops,notifications,ai}/**`
- `apps/web/src/api/client.ts`, `app/providers.tsx`, `app/router.tsx`

**AI service**
- `apps/ai/app/routers/{chat,design,recommend}.py`
- `apps/ai/app/{auth,main,main_state,repositories,ollama,schemas}.py`
- `apps/ai/app/chat/{grounding,commands,memory}.py`
- `apps/ai/app/retrieval/{engine,intent,lexical,rrf,embedding}.py`
- `apps/ai/app/generation/recipe.py`

**Database**
- `prisma/schema.prisma` (ดูโดยเฉพาะคอมเมนต์ใน model `Project` ที่อธิบายกฎ autosave/versioning)
- `prisma/migrations/**`, `prisma/seed.mjs`

**API endpoints ที่กระบวนการเรียก** — ดูรายการเต็มใน `Use case.md` §7

## 8. Unknown / Missing Information

| ประเด็น | สถานะ |
|---|---|
| **กระบวนการชำระเงิน (Payment Process)** | **UNKNOWN / NOT FOUND** — มีเพียงฟิลด์ราคา (`shop_services.price_thb`, `appointments.price_quoted_thb`) ที่เป็นข้อมูลอ้างอิง ไม่มี payment gateway, ไม่มีตารางธุรกรรม, ไม่มี endpoint ตัดเงิน/คืนเงิน |
| **กระบวนการอนุมัติ (Approval Workflow) ของ admin** | **NOT FOUND** — `content_reports.status` ไม่มีโค้ดใดเปลี่ยนค่า; `shop_profiles.is_verified` ไม่มี endpoint ตั้งค่า |
| **กระบวนการแจ้งเตือนภายนอก** (อีเมล / SMS / Push) | **NOT FOUND** — การแจ้งเตือนอยู่ในตาราง `notifications` และแสดงผ่าน `NotificationBell` เท่านั้น |
| **Background job / Scheduled process** | **NOT FOUND** — ไม่มี cron, queue, worker; `deleteExpiredSessions()` ไม่มีผู้เรียก |
| **กระบวนการ no-show** | มี logic ใน `allowedTransition` + `transition()` แต่ **ไม่มี route** `/appointments/:id/no-show` จึงเรียกไม่ได้ |
| **กระบวนการรีเซ็ตรหัสผ่าน / ยืนยันอีเมล** | **NOT FOUND** |
| **กระบวนการลบบัญชี / ส่งออกข้อมูลส่วนบุคคล** | **NOT FOUND** |
| **BPMN ต้นฉบับ (.bpmn / Camunda / Bizagi)** | **NOT FOUND** ใน repository — เอกสารนี้สร้างจากซอร์สโดยตรง |
| ข้อจำกัดของ Mermaid ต่อ BPMN 2.0 | ระบุไว้แล้วในหัวข้อ 2 — ไม่มี Pool/Lane, Event, Gateway, Message Flow ตามมาตรฐาน จึงใช้ `flowchart` + `subgraph` + คำนำหน้า (`START:`, `UT:`, `ST:`, `BR:`, `ERROR:`) แทน |
