type Primitive = string | number | boolean | null | undefined | ((...args: any[]) => any)

type DeepFlatten<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends Primitive
    ? Record<P extends '' ? K : `${P}.${K}`, T[K]>
    : DeepFlatten<T[K], P extends '' ? K : `${P}.${K}`>
}[keyof T & string]

type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (x: infer I) => void
  ? I
  : never

export type FlatRecord<T> = UnionToIntersection<DeepFlatten<T>>

export function flattenDomainConfig<D extends string, T extends Record<string, any>>(
  domain: D,
  obj: T,
): FlatRecord<Record<D, T>> {
  const result: Record<string, unknown> = {}

  function traverse(current: Record<string, any>, prefix: string) {
    for (const [key, value] of Object.entries(current)) {
      const flat = prefix ? `${prefix}.${key}` : key
      if (
        value !== null &&
        typeof value === 'object' &&
        typeof value !== 'function' &&
        !Array.isArray(value)
      ) {
        traverse(value, flat)
      } else {
        result[flat] = value
      }
    }
  }

  traverse({ [domain]: obj }, '')
  return result as FlatRecord<Record<D, T>>
}
