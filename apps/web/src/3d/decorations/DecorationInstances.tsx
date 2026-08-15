import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { InstancedMesh, Matrix4, MeshStandardMaterial, Object3D, Vector3 } from 'three'
import { EDITABLE_NAILS } from '@/features/design/designStore.ts'
import { useDesignStoreApi } from '@/features/design/DesignStoreProvider.tsx'
import type { HandParts } from '@/3d/models/HandModel.tsx'
import { projectUvToSurface } from '@/3d/geometry/surfaceProjection.ts'
import { DECORATION_CATALOG } from './decorationCatalog.ts'

interface Props {
  parts: HandParts
}

/** เพดานจำนวน instance ต่อ catalog entry — 30 ต่อเล็บ (MAX_DECORATIONS_PER_NAIL) × 5 นิ้ว */
const MAX_INSTANCES_PER_CATALOG_ENTRY = 30 * 5

/**
 * เรนเดอร์ของตกแต่งทั้งหมดด้วย InstancedMesh หนึ่งตัวต่อ catalog entry ครอบคลุมทั้งมือ
 *
 * ไม่แยกต่อเล็บเพราะของตกแต่ง catalog เดียวกันแชร์ geometry/material ได้อยู่แล้วไม่ว่า
 * จะอยู่เล็บไหน slot ที่ไม่ได้ใช้ถูกซ่อนด้วยการตั้ง scale เป็น 0 (มองไม่เห็น ไม่กิน
 * draw call เพิ่มเพราะ instanced mesh นับ 1 draw call ต่อ mesh ไม่ใช่ต่อ instance)
 *
 * Matrix ของทุก instance ถูกคำนวณใหม่เมื่อ document เปลี่ยน (มาตรฐานเดียวกับ
 * useNailTextures.ts — เทียบ identity ของ document ก่อนแล้วค่อย rebuild ไม่ใช่ diff
 * ทุกเฟรม) ครอบคลุมทั้งการเพิ่ม/ลบ/ย้ายของตกแต่ง และการเปลี่ยนทรง/ความยาวเล็บหรือ
 * สัดส่วนมือ (ซึ่งเปลี่ยนตำแหน่งที่ projectUvToSurface คำนวณได้โดยอัตโนมัติ เพราะสิ่ง
 * เหล่านั้นก็เปลี่ยน document เหมือนกัน)
 *
 * เมช InstancedMesh ทั้งหมดสร้างและตั้งค่าใน useMemo — ห้ามมีผลข้างเคียง (side effect)
 * ในนั้นเด็ดขาด (เช่น เขียนลง ref) เพราะ React StrictMode เรียก factory ของ useMemo
 * สองรอบใน dev เพื่อจับโค้ดที่ไม่บริสุทธิ์ ถ้าเขียนลง ref ในนั้น รอบที่สองจะทับรอบแรก
 * ทำให้ ref ชี้ไปยัง mesh คนละก้อนกับที่ useMemo คืนค่าจริงและถูกเรนเดอร์ — แล้วโค้ดที่
 * แก้ instance matrix ผ่าน ref จะแก้ mesh ที่ไม่เคยถูกใส่เข้าฉากเลย ของตกแต่งจึงมีข้อมูล
 * ตำแหน่งถูกต้องสมบูรณ์แต่ไม่ปรากฏบนจอเลยแม้แต่พิกเซลเดียว (บั๊กจริงที่เจอและแก้ไปแล้ว
 * ระหว่างตรวจงานด้วยเบราว์เซอร์จริง — ห้ามกลับไปใช้รูปแบบ ref เดิม)
 */
export function DecorationInstances({ parts }: Props) {
  const store = useDesignStoreApi()
  const needsRebuildRef = useRef(false)
  const rebuildRef = useRef<() => void>(() => {})

  const meshes = useMemo(() => DECORATION_CATALOG.map((entry) => {
    const mesh = new InstancedMesh(
      entry.geometry(),
      new MeshStandardMaterial({
        color: entry.defaultColor,
        metalness: entry.metalness,
        roughness: entry.roughness,
      }),
      MAX_INSTANCES_PER_CATALOG_ENTRY,
    )
    mesh.name = `decorations-${entry.id}`
    mesh.count = 0
    mesh.frustumCulled = false
    return mesh
  }), [])

  // อนุพันธ์ล้วนจาก meshes (อาร์เรย์เดียวกับที่เรนเดอร์จริง) ไม่ใช่ ref แยกที่เสี่ยงหลุดจากกัน
  const meshByCatalogId = useMemo(
    () => new Map(meshes.map((mesh, index) => [DECORATION_CATALOG[index]!.id, mesh])),
    [meshes],
  )

  useEffect(() => () => {
    for (const mesh of meshes) {
      mesh.geometry.dispose()
      if (mesh.material instanceof MeshStandardMaterial) mesh.material.dispose()
    }
  }, [meshes])

  useEffect(() => {
    const object = new Object3D()

    const rebuild = () => {
      const document = store.getState().document
      const counters = new Map<string, number>()
      for (const mesh of meshes) mesh.count = 0

      for (const key of EDITABLE_NAILS) {
        const mesh = parts.nails.get(key)
        const nail = document.nails[key]
        if (!mesh) continue
        for (const decoration of nail.decorations) {
          const target = meshByCatalogId.get(decoration.catalogId)
          const entry = DECORATION_CATALOG.find((item) => item.id === decoration.catalogId)
          if (!target || !entry) continue

          const surface = projectUvToSurface(mesh, decoration.u, decoration.v)
          if (!surface) continue

          const bitangent = new Vector3().crossVectors(surface.tangent, surface.normal).normalize()
          const rotatedTangent = surface.tangent.clone()
            .multiplyScalar(Math.cos(decoration.rotation))
            .addScaledVector(bitangent, Math.sin(decoration.rotation))
          const rotatedBitangent = new Vector3().crossVectors(rotatedTangent, surface.normal).normalize()

          object.position.copy(surface.position)
          object.quaternion.setFromRotationMatrix(
            new Matrix4().makeBasis(rotatedTangent, surface.normal, rotatedBitangent),
          )
          const scale = decoration.scale * entry.defaultScale
          object.scale.setScalar(scale)
          object.updateMatrix()

          const instanceIndex = counters.get(decoration.catalogId) ?? 0
          if (instanceIndex < MAX_INSTANCES_PER_CATALOG_ENTRY) {
            target.setMatrixAt(instanceIndex, object.matrix)
            counters.set(decoration.catalogId, instanceIndex + 1)
          }
        }
      }

      for (const mesh of meshes) {
        const catalogId = mesh.name.replace('decorations-', '')
        mesh.count = counters.get(catalogId) ?? 0
        mesh.instanceMatrix.needsUpdate = true
      }
    }

    rebuildRef.current = rebuild
    rebuild()
    let previous = store.getState().document
    // ห้ามเรียก rebuild() ตรง ๆ ในนี้ — subscriber นี้รันแบบ synchronous ทันทีที่
    // document เปลี่ยน โดยไม่มีการรับประกันลำดับกับ subscriber อื่น (เช่น
    // useNailTextures.ts ที่ sync morph target influences) แค่ตั้ง flag ไว้เบา ๆ
    // แล้วให้ useFrame ด้านล่างทำงานหนักจริงหลังจาก r3f อัปเดตฉากของเฟรมนั้นแล้ว
    const unsubscribe = store.subscribe((state) => {
      if (state.document === previous) return
      previous = state.document
      needsRebuildRef.current = true
    })
    return unsubscribe
  }, [parts, store, meshes, meshByCatalogId])

  useFrame(() => {
    if (!needsRebuildRef.current) return
    needsRebuildRef.current = false
    rebuildRef.current()
  })

  return (
    <group name="decoration-instances-group">
      {meshes.map((mesh) => <primitive key={mesh.name} object={mesh} />)}
    </group>
  )
}
