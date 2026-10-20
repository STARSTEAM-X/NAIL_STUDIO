import { CanvasTexture, Color, MeshPhysicalMaterial, SRGBColorSpace, DataTexture, RGBAFormat, RepeatWrapping, ShaderChunk, Vector3, type MeshStandardMaterial } from 'three'
import { FINISH_PRESETS } from '@/3d/materials/finishes.ts'
import type { StudioNail, StudioHand } from './sceneSchema.ts'

const DIRECT_DIFFUSE = 'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );'
/** Per-channel wrap width: red light scatters furthest under skin, blue least. */
export const SKIN_SCATTER = new Vector3(.42, .17, .09)

/**
 * Approximate subsurface scattering with per-channel wrapped diffuse lighting:
 * light bleeds past the terminator with a warm red falloff instead of the
 * hard grey edge of plain Lambert, which is what made the skin read as plastic.
 * O(1) per fragment; shadows still apply because directLight.color is shadowed.
 */
function applySkinScatter(material: MeshPhysicalMaterial): void {
  const chunk = ShaderChunk.lights_physical_pars_fragment
  if (!chunk.includes(DIRECT_DIFFUSE)) return // Unknown three.js revision: keep plain PBR.
  material.onBeforeCompile = (shader) => {
    shader.uniforms.skinScatter = { value: SKIN_SCATTER }
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_physical_pars_fragment>', `uniform vec3 skinScatter;
${chunk.replace(DIRECT_DIFFUSE, `{
  float skinNL = dot( geometryNormal, directLight.direction );
  vec3 skinWrap = saturate( ( vec3( skinNL ) + skinScatter ) / ( 1.0 + skinScatter ) );
  // Divide by (1 + w) again to keep the wrapped lobe roughly energy-neutral.
  reflectedLight.directDiffuse += skinWrap / ( 1.0 + skinScatter * .5 ) * directLight.color * BRDF_Lambert( material.diffuseContribution );
}`)}`)
  }
  material.customProgramCacheKey = () => 'studio-skin-scatter-1'
}

export function createSkinMaterial(source: MeshStandardMaterial): MeshPhysicalMaterial {
  const material = new MeshPhysicalMaterial({
    // This asset's roughness map is normalized .77–1, preserving spatial pore
    // variation without multiplying the old blockout's constant .57 twice.
    map: source.map, normalMap: source.normalMap, roughnessMap: source.roughnessMap,
    roughness: 0.58, metalness: 0,
    // Soft warm sheen stands in for the fine vellus/oil layer at grazing angles.
    sheen: 0.22, sheenRoughness: 0.55, sheenColor: new Color('#ffd9c9'),
    specularIntensity: 0.55,
  })
  applySkinScatter(material)
  return material
}
export function updateSkinMaterial(material: MeshPhysicalMaterial, skin: StudioHand['skin']): void {
  material.color.set(skin.tone)
  material.roughness = skin.roughness
  material.normalScale.setScalar(skin.detail)
}

/** Seeded noise: the same saved scene has the same sparkle pattern after reload. */
export function sparkleTexture(): DataTexture {
  const size = 128, pixels = new Uint8Array(size * size * 4)
  let seed = 0x1749
  for (let index = 0; index < pixels.length; index += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const sparkle = seed % 23 === 0
    pixels[index] = sparkle ? seed % 220 + 18 : 128
    pixels[index + 1] = sparkle ? (seed >>> 8) % 220 + 18 : 128
    pixels[index + 2] = 245
    pixels[index + 3] = 255
  }
  const texture = new DataTexture(pixels, size, size, RGBAFormat)
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.repeat.set(3, 3)
  texture.needsUpdate = true
  return texture
}

export interface NailMaterialResource { material: MeshPhysicalMaterial; texture: CanvasTexture; canvas: HTMLCanvasElement; image: HTMLImageElement | null; imageData: string | null; onReady: () => void }
export function createStudioNailMaterial(onReady: () => void): NailMaterialResource {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 512
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  const material = new MeshPhysicalMaterial({ map: texture, roughness: 0.15, clearcoat: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
  return { material, texture, canvas, image: null, imageData: null, onReady }
}

export function updateStudioNailMaterial(resource: NailMaterialResource, nail: StudioNail, sparkle: DataTexture): void {
  const { material, canvas, texture } = resource
  const previousFeatures = `${!!material.normalMap}|${material.transmission > 0}|${material.anisotropy > 0}|${material.transparent}`
  const context = canvas.getContext('2d')
  if (!context) throw new Error('สร้างพื้นผิวเล็บไม่ได้: Canvas 2D ไม่พร้อม')
  const size = canvas.width
  context.fillStyle = nail.baseColor
  context.fillRect(0, 0, size, size)
  const { type, amount, softness, angle } = nail.pattern
  if (type === 'ombre') {
    const radians = angle * Math.PI / 180
    const dx = Math.sin(radians) * size * .5, dy = Math.cos(radians) * size * .5
    const gradient = context.createLinearGradient(size / 2 - dx, size / 2 - dy, size / 2 + dx, size / 2 + dy)
    const start = Math.max(0, Math.min(.99, amount - softness / 2))
    const end = Math.max(start + .001, Math.min(1, amount + softness / 2))
    gradient.addColorStop(0, nail.tipColor); gradient.addColorStop(start, nail.tipColor)
    gradient.addColorStop(end, nail.baseColor); gradient.addColorStop(1, nail.baseColor)
    context.fillStyle = gradient; context.fillRect(0, 0, size, size)
  } else if (type === 'french') {
    context.fillStyle = nail.tipColor
    context.beginPath(); context.moveTo(0, 0); context.lineTo(size, 0)
    const tilt = Math.tan(angle * Math.PI / 360) * size * .12
    context.lineTo(size, size * amount + tilt)
    context.quadraticCurveTo(size / 2, size * Math.max(.01, amount - .22), 0, size * amount - tilt)
    context.closePath(); context.fill()
  }
  if (resource.imageData !== nail.texture) {
    if (resource.image) { resource.image.onload = null; resource.image.onerror = null; resource.image.src = '' }
    resource.imageData = nail.texture
    resource.image = null
    if (nail.texture) {
      const image = new Image()
      resource.image = image
      image.onload = () => {
        if (resource.image !== image) return
        context.drawImage(image, 0, 0, size, size)
        texture.needsUpdate = true; resource.onReady()
      }
      image.onerror = () => { resource.onReady() }
      image.src = nail.texture
    }
  } else if (resource.image?.complete && resource.image.naturalWidth > 0) {
    context.drawImage(resource.image, 0, 0, size, size)
  }
  texture.needsUpdate = true
  const spec = FINISH_PRESETS[nail.finish === 'jelly' ? 'glossy' : nail.finish]
  material.roughness = spec.roughness
  if (nail.finish === 'glossy') material.roughness = .18
  material.metalness = spec.metalness
  material.clearcoat = spec.clearcoat
  material.clearcoatRoughness = spec.clearcoatRoughness
  material.envMapIntensity = spec.envMapIntensity
  material.anisotropy = nail.finish === 'cat_eye' ? .8 : 0
  material.anisotropyRotation = -.5
  material.transmission = nail.finish === 'jelly' ? .55 : 0
  material.thickness = .0015
  material.ior = 1.46
  material.transparent = nail.finish === 'jelly'
  material.opacity = nail.finish === 'jelly' ? nail.opacity : 1
  material.normalMap = spec.sparkle ? sparkle : null
  material.normalScale.setScalar(nail.finish === 'cat_eye' ? .12 : .5)
  const nextFeatures = `${!!material.normalMap}|${material.transmission > 0}|${material.anisotropy > 0}|${material.transparent}`
  if (previousFeatures !== nextFeatures) material.needsUpdate = true
}
