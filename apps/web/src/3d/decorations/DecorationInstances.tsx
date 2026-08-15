import { useEffect, useMemo, useRef } from 'react'
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
 */
export function DecorationInstances({ parts }: Props) {
  const store = useDesignStoreApi()
  const meshRefs = useRef<Map<string, InstancedMesh>>(new Map())

  const meshes = useMemo(() => DECORATION_CATALOG.map((entry) => {
    const mesh = new InstancedMesh(
      entry.geometry(),
      new MeshStandardMaterial({ color: '#d9d9d9', metalness: 0.3, roughness: 0.4 }),
      MAX_INSTANCES_PER_CATALOG_ENTRY,
    )
    mesh.name = `decorations-${entry.id}`
    mesh.count = 0
    meshRefs.current.set(entry.id, mesh)
    return mesh
  }), [])

  useEffect(() => () => {
    for (const mesh of meshRefs.current.values()) {
      mesh.geometry.dispose()
      if (mesh.material instanceof MeshStandardMaterial) mesh.material.dispose()
    }
  }, [])

  useEffect(() => {
    const object = new Object3D()

    const rebuild = () => {
      const document = store.getState().document
      const counters = new Map<string, number>()
      for (const mesh of meshRefs.current.values()) mesh.count = 0

      for (const key of EDITABLE_NAILS) {
        const mesh = parts.nails.get(key)
        const nail = document.nails[key]
        if (!mesh) continue
        for (const decoration of nail.decorations) {
          const target = meshRefs.current.get(decoration.catalogId)
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

      for (const [catalogId, mesh] of meshRefs.current) {
        mesh.count = counters.get(catalogId) ?? 0
        mesh.instanceMatrix.needsUpdate = true
      }
    }

    rebuild()
    let previous = store.getState().document
    const unsubscribe = store.subscribe((state) => {
      if (state.document === previous) return
      previous = state.document
      rebuild()
    })
    return unsubscribe
  }, [parts, store])

  return (
    <>
      {meshes.map((mesh) => <primitive key={mesh.name} object={mesh} />)}
    </>
  )
}
